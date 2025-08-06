const { Pool } = require('pg');
const logger = require('../utils/logger');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Configuración de la conexión - SSL CORREGIDO
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'sso_db',
                user: process.env.DB_USER || 'sso_user',
                password: process.env.DB_PASSWORD || 'sso_password123',
                
                // Configuraciones de pool
                max: 20, // Máximo número de conexiones
                min: 2,  // Mínimo número de conexiones
                idleTimeoutMillis: 30000, // 30 segundos
                connectionTimeoutMillis: 5000, // 5 segundos
                maxUses: 7500, // Número máximo de usos por conexión
                
                // SSL DESHABILITADO para desarrollo y Docker local
                ssl: false,
                
                // Configuraciones adicionales
                application_name: 'sso-microservice',
                statement_timeout: 30000, // 30 segundos timeout para queries
                query_timeout: 30000,
                connectionString: process.env.DATABASE_URL || undefined
            });

            // Event listeners para el pool
            this.pool.on('connect', (client) => {
                logger.debug('Nueva conexión establecida con la base de datos');
            });

            this.pool.on('error', (err, client) => {
                logger.error('Error inesperado en cliente de base de datos:', err);
            });

            this.pool.on('remove', (client) => {
                logger.debug('Conexión removida del pool');
            });

            // Probar la conexión
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW(), version()');
            client.release();

            this.isConnected = true;
            logger.info('✅ Conexión a PostgreSQL establecida exitosamente');
            logger.info(`📊 Versión de PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);
            logger.info(`🕐 Tiempo del servidor: ${result.rows[0].now}`);
            
            return true;
        } catch (error) {
            this.isConnected = false;
            logger.error('❌ Error conectando a PostgreSQL:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.end();
                this.isConnected = false;
                logger.info('✅ Pool de conexiones de PostgreSQL cerrado');
            }
        } catch (error) {
            logger.error('❌ Error cerrando pool de PostgreSQL:', error);
            throw error;
        }
    }

    async query(text, params = []) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        const start = Date.now();
        
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            // Log para queries lentas (más de 100ms)
            if (duration > 100) {
                logger.warn(`🐌 Query lenta (${duration}ms):`, {
                    query: text.substring(0, 100),
                    params: params.length,
                    rows: result.rowCount
                });
            }
            
            logger.debug(`📊 Query ejecutada en ${duration}ms:`, {
                query: text.substring(0, 50),
                params: params.length,
                rows: result.rowCount
            });
            
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            logger.error(`❌ Error en query (${duration}ms):`, {
                query: text.substring(0, 100),
                params: params.length,
                error: error.message
            });
            throw error;
        }
    }

    async transaction(callback) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Métodos de utilidad para operaciones comunes
    async getStats() {
        try {
            const stats = {
                totalConnections: this.pool.totalCount,
                idleConnections: this.pool.idleCount,
                waitingConnections: this.pool.waitingCount
            };
            return stats;
        } catch (error) {
            logger.error('Error obteniendo estadísticas del pool:', error);
            return null;
        }
    }

    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`);
        
        const query = `
            INSERT INTO ${table} (${keys.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    async update(table, id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((key, index) => `${key} = $${index + 2}`);
        
        const query = `
            UPDATE ${table}
            SET ${setClause.join(', ')}
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await this.query(query, [id, ...values]);
        return result.rows[0];
    }

    async delete(table, id) {
        const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
        const result = await this.query(query, [id]);
        return result.rows[0];
    }

    async findById(table, id) {
        const query = `SELECT * FROM ${table} WHERE id = $1`;
        const result = await this.query(query, [id]);
        return result.rows[0];
    }

    async count(table, conditions = {}) {
        let query = `SELECT COUNT(*) FROM ${table}`;
        let values = [];

        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map((key, index) => `${key} = $${index + 1}`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
            values = Object.values(conditions);
        }

        const result = await this.query(query, values);
        return parseInt(result.rows[0].count);
    }

    async exists(table, conditions) {
        const count = await this.count(table, conditions);
        return count > 0;
    }

    // Método para ejecutar funciones personalizadas de PostgreSQL
    async callFunction(functionName, params = []) {
        const placeholders = params.map((_, index) => `$${index + 1}`);
        const query = `SELECT * FROM ${functionName}(${placeholders.join(', ')})`;
        
        const result = await this.query(query, params);
        return result.rows;
    }

    // Health check específico
    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health_check');
            return {
                status: 'healthy',
                connected: this.isConnected,
                stats: await this.getStats(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Crear instancia singleton
const database = new Database();

module.exports = database;