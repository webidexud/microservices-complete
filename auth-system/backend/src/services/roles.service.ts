// auth-system/backend/src/services/roles.service.ts
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class RolesService {

  // Permisos estáticos del sistema
  private readonly STATIC_PERMISSIONS = [
    // Usuarios
    'users.create', 'users.read', 'users.update', 'users.delete',
    // Roles
    'roles.create', 'roles.read', 'roles.update', 'roles.delete',
    // Microservicios
    'microservices.create', 'microservices.read', 'microservices.update', 'microservices.delete',
    // Sistema
    'system.config', 'system.logs', 'system.health',
    // Dashboard
    'dashboard.view', 'dashboard.analytics',
    // Perfil
    'profile.read', 'profile.update',
    // Super admin
    '*'
  ];

  // ✅ NUEVA: Obtener permisos dinámicos de microservicios
  async getDynamicPermissions(): Promise<string[]> {
    try {
      const microservices = await prisma.microservice.findMany({
        where: { isActive: true },
        select: { name: true }
      });

      const dynamicPermissions: string[] = [];
      
      microservices.forEach(ms => {
        const serviceName = ms.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        dynamicPermissions.push(
          `${serviceName}.access`,
          `${serviceName}.view`,
          `${serviceName}.use`,
          `${serviceName}.admin`
        );
      });

      return dynamicPermissions;
    } catch (error) {
      logger.error('Error al obtener permisos dinámicos:', error);
      return [];
    }
  }

  // ✅ NUEVA: Obtener TODOS los permisos (estáticos + dinámicos)
  async getAllPermissions(): Promise<string[]> {
    const dynamicPermissions = await this.getDynamicPermissions();
    return [...this.STATIC_PERMISSIONS, ...dynamicPermissions];
  }

  // ✅ ACTUALIZADA: Obtener permisos agrupados
  async getAvailablePermissions() {
    try {
      const dynamicPermissions = await this.getDynamicPermissions();
      const allPermissions = [...this.STATIC_PERMISSIONS, ...dynamicPermissions];

      // Agrupar permisos dinámicamente
      const grouped: { [key: string]: string[] } = {
        users: this.STATIC_PERMISSIONS.filter(p => p.startsWith('users.')),
        roles: this.STATIC_PERMISSIONS.filter(p => p.startsWith('roles.')),
        microservices: this.STATIC_PERMISSIONS.filter(p => p.startsWith('microservices.')),
        system: this.STATIC_PERMISSIONS.filter(p => p.startsWith('system.')),
        dashboard: this.STATIC_PERMISSIONS.filter(p => p.startsWith('dashboard.')),
        profile: this.STATIC_PERMISSIONS.filter(p => p.startsWith('profile.')),
        special: this.STATIC_PERMISSIONS.filter(p => p === '*')
      };

      // Agregar permisos dinámicos por microservicio
      const microservices = await prisma.microservice.findMany({
        where: { isActive: true },
        select: { name: true }
      });

      microservices.forEach(ms => {
        const serviceName = ms.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const servicePermissions = dynamicPermissions.filter(p => p.startsWith(`${serviceName}.`));
        if (servicePermissions.length > 0) {
          grouped[serviceName] = servicePermissions;
        }
      });

      return {
        all: allPermissions,
        static: this.STATIC_PERMISSIONS,
        dynamic: dynamicPermissions,
        grouped
      };

    } catch (error) {
      logger.error('Error al obtener permisos disponibles:', error);
      throw new Error('Error al obtener permisos disponibles');
    }
  }

  // ✅ ACTUALIZADA: Crear rol con validación dinámica
  async createRole(roleData: {
    name: string;
    description?: string;
    permissions: string[];
  }, createdBy: number) {
    try {
      // Verificar que el nombre no exista
      const existingRole = await prisma.role.findUnique({
        where: { name: roleData.name }
      });

      if (existingRole) {
        throw new Error('Ya existe un rol con ese nombre');
      }

      // Validar permisos (estáticos + dinámicos)
      const allPermissions = await this.getAllPermissions();
      const invalidPermissions = roleData.permissions.filter(
        permission => !allPermissions.includes(permission)
      );

      if (invalidPermissions.length > 0) {
        throw new Error(`Permisos inválidos: ${invalidPermissions.join(', ')}`);
      }

      // Crear rol
      const newRole = await prisma.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions
        }
      });

      logger.info(`Rol creado: ${roleData.name}`, { 
        roleId: newRole.id, 
        createdBy 
      });

      return newRole;

    } catch (error: any) {
      logger.error('Error al crear rol:', error);
      throw error;
    }
  }

  // ✅ ACTUALIZADA: Actualizar rol con validación dinámica
  async updateRole(id: number, roleData: {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  }, updatedBy: number) {
    try {
      // Verificar que el rol existe
      const existingRole = await prisma.role.findUnique({
        where: { id }
      });

      if (!existingRole) {
        throw new Error('Rol no encontrado');
      }

      // Verificar que no sea un rol del sistema que no se puede modificar
      if (['super_admin', 'admin', 'user'].includes(existingRole.name) && roleData.name && roleData.name !== existingRole.name) {
        throw new Error('No se puede cambiar el nombre de los roles del sistema');
      }

      // Verificar duplicado de nombre si se actualiza
      if (roleData.name && roleData.name !== existingRole.name) {
        const duplicate = await prisma.role.findUnique({
          where: { name: roleData.name }
        });

        if (duplicate) {
          throw new Error('Ya existe un rol con ese nombre');
        }
      }

      // Validar permisos si se actualizan (estáticos + dinámicos)
      if (roleData.permissions) {
        const allPermissions = await this.getAllPermissions();
        const invalidPermissions = roleData.permissions.filter(
          permission => !allPermissions.includes(permission)
        );

        if (invalidPermissions.length > 0) {
          throw new Error(`Permisos inválidos: ${invalidPermissions.join(', ')}`);
        }
      }

      // Actualizar rol
      const updatedRole = await prisma.role.update({
        where: { id },
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
          isActive: roleData.isActive
        }
      });

      logger.info(`Rol actualizado: ${updatedRole.name}`, { 
        roleId: id, 
        updatedBy 
      });

      return updatedRole;

    } catch (error: any) {
      logger.error('Error al actualizar rol:', error);
      throw error;
    }
  }

  // ✅ NUEVA: Crear permisos automáticamente al registrar microservicio
  async createMicroservicePermissions(microserviceName: string) {
    try {
      const serviceName = microserviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const permissions = [
        `${serviceName}.access`,
        `${serviceName}.view`,
        `${serviceName}.use`,
        `${serviceName}.admin`
      ];

      // Agregar automáticamente al super_admin
      const superAdminRole = await prisma.role.findUnique({
        where: { name: 'super_admin' }
      });

      if (superAdminRole) {
        const currentPermissions = superAdminRole.permissions as string[];
        const newPermissions = [...new Set([...currentPermissions, ...permissions])];

        await prisma.role.update({
          where: { id: superAdminRole.id },
          data: { permissions: newPermissions }
        });

        logger.info(`Permisos de ${microserviceName} agregados al super_admin`, { permissions });
      }

      return permissions;

    } catch (error) {
      logger.error('Error al crear permisos de microservicio:', error);
      throw error;
    }
  }

  // ✅ NUEVA: Verificar si usuario tiene acceso a microservicio
  async userCanAccessMicroservice(userId: number, microserviceName: string): Promise<boolean> {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
          role: {
            select: {
              permissions: true,
              isActive: true
            }
          }
        }
      });

      const serviceName = microserviceName.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const userRole of userRoles) {
        if (!userRole.role.isActive) continue;
        
        const rolePermissions = userRole.role.permissions as string[];
        
        // Super admin tiene acceso a todo
        if (rolePermissions.includes('*')) {
          return true;
        }
        
        // Verificar permisos específicos del microservicio
        if (rolePermissions.some(p => p.startsWith(`${serviceName}.`))) {
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.error('Error al verificar acceso a microservicio:', error);
      return false;
    }
  }

  // Resto de métodos sin cambios...
  async getRoles(params: any = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = params;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [roles, total] = await Promise.all([
        prisma.role.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            userRoles: {
              select: { userId: true }
            }
          }
        }),
        prisma.role.count({ where })
      ]);

      const rolesWithUserCount = roles.map(role => ({
        ...role,
        userCount: role.userRoles.length,
        userRoles: undefined
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        roles: rolesWithUserCount,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      logger.error('Error al obtener roles:', error);
      throw new Error('Error al obtener roles');
    }
  }

  async deleteRole(id: number) {
    try {
      const role = await prisma.role.findUnique({
        where: { id }
      });

      if (!role) {
        throw new Error('Rol no encontrado');
      }

      // No permitir eliminar roles críticos del sistema
      if (['super_admin'].includes(role.name)) {
        throw new Error('No se puede eliminar el rol de super administrador');
      }

      await prisma.role.delete({ where: { id } });

      logger.info(`Rol eliminado: ${role.name}`, { roleId: id });

    } catch (error: any) {
      logger.error('Error al eliminar rol:', error);
      throw error;
    }
  }

  async userHasPermission(userId: number, permission: string): Promise<boolean> {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
          role: {
            select: {
              permissions: true,
              isActive: true
            }
          }
        }
      });

      for (const userRole of userRoles) {
        if (!userRole.role.isActive) continue;
        
        const rolePermissions = userRole.role.permissions as string[];
        
        // Super admin tiene todos los permisos
        if (rolePermissions.includes('*')) {
          return true;
        }
        
        // Verificar permiso específico
        if (rolePermissions.includes(permission)) {
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.error('Error al verificar permisos del usuario:', error);
      return false;
    }
  }
}