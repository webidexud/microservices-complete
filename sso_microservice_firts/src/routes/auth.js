const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const database = require('../config/database');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

// Validaciones de entrada
const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email válido es requerido'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password debe tener mínimo 6 caracteres')
];

const refreshValidation = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token es requerido')
];

// Funciones auxiliares
async function getUserWithRolesAndPermissions(userId) {
    try {
        const userQuery = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, 
                   u.is_active, u.is_verified, u.last_login,
                   array_agg(DISTINCT r.name) as role_names,
                   array_agg(DISTINCT r.display_name) as role_display_names,
                   array_agg(DISTINCT p.name) as permission_names
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = $1 AND u.is_active = true
            GROUP BY u.id
        `;

        const result = await database.query(userQuery, [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];
        
        // Obtener permisos detallados
        const permissionsQuery = `
            SELECT DISTINCT p.id, p.name, p.display_name, p.description, p.module, p.action, p.resource
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $1
        `;

        const permissionsResult = await database.query(permissionsQuery, [userId]);
        user.permissions = permissionsResult.rows;

        return user;
    } catch (error) {
        logger.error('Error getting user with roles and permissions:', error);
        throw error;
    }
}

function generateTokens(user) {
    const payload = {
        id: user.id,
        email: user.email,
        roles: user.role_names || [],
        permissions: (user.permissions || []).map(p => p.name)
    };

    const jti = `${user.id}_${Date.now()}`;
    const accessToken = jwt.sign(
        { ...payload, jti, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
        { id: user.id, jti, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
}

// RUTAS

// LOGIN
router.post('/login', loginValidation, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';

        // Buscar usuario
        const userQuery = `
            SELECT id, email, password_hash, first_name, last_name, 
                   is_active, is_verified, login_attempts, locked_until
            FROM users 
            WHERE email = $1
        `;

        const result = await database.query(userQuery, [email]);
        
        if (result.rows.length === 0) {
            logger.security('Login attempt with non-existent email', { 
                email, 
                ip: clientIp 
            });
            
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const user = result.rows[0];

        // Verificar si está bloqueado
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            logger.security('Login attempt on locked account', { 
                userId: user.id, 
                email, 
                ip: clientIp 
            });
            
            return res.status(423).json({
                success: false,
                message: 'Cuenta temporalmente bloqueada por múltiples intentos fallidos'
            });
        }

        // Verificar si está activo
        if (!user.is_active) {
            logger.security('Login attempt on inactive account', { 
                userId: user.id, 
                email, 
                ip: clientIp 
            });
            
            return res.status(401).json({
                success: false,
                message: 'Cuenta inactiva'
            });
        }

        // Verificar password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            // Incrementar intentos fallidos
            let loginAttempts = (user.login_attempts || 0) + 1;
            let lockUntil = loginAttempts >= 5 ? 
                new Date(Date.now() + 15 * 60 * 1000) : null; // 15 minutos
            
            await database.query(
                `UPDATE users SET 
                 login_attempts = $1, 
                 locked_until = $2, 
                 updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $3`,
                [loginAttempts, lockUntil, user.id]
            );

            logger.security('Failed login attempt', { 
                userId: user.id, 
                email, 
                ip: clientIp,
                attempts: loginAttempts,
                locked: !!lockUntil
            });
            
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Login exitoso - resetear intentos y obtener datos completos
        await database.query(
            `UPDATE users SET 
             login_attempts = 0, 
             locked_until = NULL, 
             last_login = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [user.id]
        );

        // Obtener usuario con roles y permisos
        const fullUser = await getUserWithRolesAndPermissions(user.id);
        
        if (!fullUser) {
            logger.error('Error loading user data after successful login', { userId: user.id });
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }

        // Generar tokens
        const { accessToken, refreshToken } = generateTokens(fullUser);

        // Decodificar para obtener JTI
        const decodedToken = jwt.decode(accessToken);
        const jti = decodedToken.jti || `${fullUser.id}_${Date.now()}`;

        // Guardar sesión
        const sessionData = {
            userId: fullUser.id,
            email: fullUser.email,
            ip: clientIp,
            userAgent,
            loginTime: new Date().toISOString(),
            refreshToken
        };

        await redis.storeSession(jti, sessionData, 7 * 24 * 60 * 60); // 7 días

        // Cachear datos del usuario
        await redis.cacheUser(fullUser.id, {
            id: fullUser.id,
            email: fullUser.email,
            firstName: fullUser.first_name,
            lastName: fullUser.last_name,
            roles: fullUser.role_names || [],
            permissions: fullUser.permissions
        }, 3600); // 1 hora

        const duration = Date.now() - startTime;
        
        logger.auth('Successful login', {
            userId: fullUser.id,
            email: fullUser.email,
            ip: clientIp,
            duration,
            roles: fullUser.role_names,
            permissionCount: fullUser.permissions.length
        });

        // Incrementar contador de logins exitosos
        await redis.incrementCounter('stats:successful_logins');

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                user: {
                    id: fullUser.id,
                    email: fullUser.email,
                    firstName: fullUser.first_name,
                    lastName: fullUser.last_name,
                    avatar: fullUser.avatar_url,
                    roles: fullUser.role_names || [],
                    permissions: fullUser.permissions.map(p => p.name),
                    lastLogin: fullUser.last_login
                },
                accessToken,
                refreshToken,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Login error', { 
            error: error.message, 
            stack: error.stack,
            duration,
            ip: req.ip
        });
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// VERIFICAR TOKEN
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        
        // Obtener datos frescos del cache o base de datos
        let cachedUser = await redis.getCachedUser(user.id);
        
        if (!cachedUser) {
            const fullUser = await getUserWithRolesAndPermissions(user.id);
            if (!fullUser) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }
            
            cachedUser = {
                id: fullUser.id,
                email: fullUser.email,
                firstName: fullUser.first_name,
                lastName: fullUser.last_name,
                roles: fullUser.role_names || [],
                permissions: fullUser.permissions
            };
            
            await redis.cacheUser(user.id, cachedUser, 3600);
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: cachedUser.id,
                    email: cachedUser.email,
                    firstName: cachedUser.firstName,
                    lastName: cachedUser.lastName,
                    roles: cachedUser.roles,
                    permissions: cachedUser.permissions.map(p => p.name),
                    isAuthenticated: true
                }
            }
        });

    } catch (error) {
        logger.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

// REFRESH TOKEN
router.post('/refresh', refreshValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { refreshToken } = req.body;

        // Verificar refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        } catch (error) {
            logger.security('Invalid refresh token attempt', { 
                ip: req.ip,
                error: error.message
            });
            
            return res.status(401).json({
                success: false,
                message: 'Refresh token inválido'
            });
        }

        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        // Obtener usuario actualizado
        const fullUser = await getUserWithRolesAndPermissions(decoded.id);
        
        if (!fullUser) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Generar nuevos tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(fullUser);

        logger.auth('Token refreshed', {
            userId: fullUser.id,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Token renovado exitosamente',
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            }
        });

    } catch (error) {
        logger.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// LOGOUT
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        const token = req.token;

        // Decodificar token para obtener información
        const decoded = jwt.decode(token);
        const jti = decoded.jti || `${user.id}_${decoded.iat}`;

        // Agregar token a blacklist
        const tokenTTL = decoded.exp - Math.floor(Date.now() / 1000);
        if (tokenTTL > 0) {
            await redis.blacklistToken(jti, tokenTTL);
        }

        // Eliminar sesión
        await redis.deleteSession(jti);

        // Limpiar cache del usuario
        await redis.invalidateUserCache(user.id);

        logger.auth('User logged out', {
            userId: user.id,
            email: user.email,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Logout exitoso'
        });

    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PERFIL DEL USUARIO
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Obtener perfil completo
        const profileQuery = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url,
                   u.is_verified, u.created_at, u.updated_at, u.last_login,
                   array_agg(DISTINCT r.name) as roles,
                   array_agg(DISTINCT r.display_name) as role_names,
                   COUNT(DISTINCT us.id) as active_sessions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_revoked = false
            WHERE u.id = $1
            GROUP BY u.id
        `;

        const result = await database.query(profileQuery, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const profile = result.rows[0];

        // Obtener permisos
        const permissions = await database.callFunction('get_user_permissions', [userId]);

        res.json({
            success: true,
            data: {
                user: {
                    id: profile.id,
                    email: profile.email,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    avatar: profile.avatar_url,
                    isVerified: profile.is_verified,
                    createdAt: profile.created_at,
                    updatedAt: profile.updated_at,
                    lastLogin: profile.last_login,
                    roles: profile.roles.filter(r => r !== null),
                    roleNames: profile.role_names.filter(r => r !== null),
                    permissions: permissions.map(p => p.permission_name),
                    activeSessions: parseInt(profile.active_sessions)
                }
            }
        });

    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// CAMBIAR PASSWORD
router.put('/change-password', authMiddleware, [
    body('currentPassword').notEmpty().withMessage('Password actual es requerido'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nuevo password debe tener mínimo 6 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Obtener password actual
        const result = await database.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar password actual
        const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        
        if (!isValidPassword) {
            logger.security('Failed password change attempt', {
                userId,
                ip: req.ip
            });
            
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual incorrecta'
            });
        }

        // Hashear nueva contraseña
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Actualizar contraseña
        await database.update('users', userId, {
            password_hash: newPasswordHash
        });

        logger.audit('password_changed', userId, {
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });

    } catch (error) {
        logger.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// VERIFICAR PERMISOS
router.post('/check-permission', authMiddleware, [
    body('permission').notEmpty().withMessage('Permiso es requerido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const userId = req.user.id;
        const { permission } = req.body;

        // Verificar permiso usando función de PostgreSQL
        const result = await database.callFunction('user_has_permission', [userId, permission]);
        const hasPermission = result[0]?.user_has_permission || false;

        res.json({
            success: true,
            data: {
                userId,
                permission,
                hasPermission
            }
        });

    } catch (error) {
        logger.error('Permission check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// OBTENER SESIONES ACTIVAS
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sessionsQuery = `
            SELECT id, token_jti, ip_address, user_agent, service_name,
                   created_at, expires_at, is_revoked
            FROM user_sessions 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;

        const result = await database.query(sessionsQuery, [userId]);

        res.json({
            success: true,
            data: {
                sessions: result.rows.map(session => ({
                    id: session.id,
                    jti: session.token_jti,
                    ipAddress: session.ip_address,
                    userAgent: session.user_agent,
                    serviceName: session.service_name,
                    createdAt: session.created_at,
                    expiresAt: session.expires_at,
                    isRevoked: session.is_revoked,
                    isCurrent: session.token_jti === jwt.decode(req.token)?.jti
                }))
            }
        });

    } catch (error) {
        logger.error('Sessions fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// REVOCAR SESIÓN
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Verificar que la sesión pertenece al usuario
        const session = await database.query(
            'SELECT id, token_jti FROM user_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (session.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sesión no encontrada'
            });
        }

        // Revocar sesión
        await database.query(
            `UPDATE user_sessions 
             SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP, revoked_by = $1 
             WHERE id = $2`,
            [userId, sessionId]
        );

        // Agregar token a blacklist
        const jti = session.rows[0].token_jti;
        await redis.blacklistToken(jti, 24 * 60 * 60); // 24 horas

        logger.audit('session_revoked', userId, {
            sessionId,
            jti,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Sesión revocada exitosamente'
        });

    } catch (error) {
        logger.error('Session revocation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;