// auth-system/backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear roles del sistema
  console.log('👥 Creando roles del sistema...');
  
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'Administrador del sistema con acceso completo',
      permissions: [
        'users.create', 'users.read', 'users.update', 'users.delete',
        'roles.create', 'roles.read', 'roles.update', 'roles.delete',
        'microservices.create', 'microservices.read', 'microservices.update', 'microservices.delete',
        'system.config', 'system.logs', 'system.health',
        'dashboard.view', 'dashboard.analytics'
      ]
    }
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador con permisos de gestión',
      permissions: [
        'users.create', 'users.read', 'users.update',
        'roles.read',
        'microservices.read', 'microservices.update',
        'dashboard.view'
      ]
    }
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Usuario básico del sistema',
      permissions: [
        'profile.read', 'profile.update',
        'dashboard.view'
      ]
    }
  });

  // Crear usuario administrador por defecto
  console.log('👤 Creando usuario administrador...');
  
  const hashedPassword = await bcrypt.hash(
    process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
    parseInt(process.env.BCRYPT_ROUNDS || '12')
  );

  const adminUser = await prisma.user.upsert({
    where: { username: process.env.DEFAULT_ADMIN_USERNAME || 'admin' },
    update: {},
    create: {
      username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@sistema.com',
      password: hashedPassword,
      firstName: process.env.DEFAULT_ADMIN_FIRST_NAME || 'Administrador',
      lastName: process.env.DEFAULT_ADMIN_LAST_NAME || 'Sistema',
      isActive: true
    }
  });

  // Asignar rol super_admin al usuario administrador
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id
    }
  });

  // Crear usuarios de ejemplo (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log('👥 Creando usuarios de ejemplo...');
    
    const demoUsers = [
      {
        username: 'demo_admin',
        email: 'demo.admin@ejemplo.com',
        firstName: 'Demo',
        lastName: 'Administrador',
        role: adminRole.id
      },
      {
        username: 'demo_user',
        email: 'demo.user@ejemplo.com',
        firstName: 'Demo',
        lastName: 'Usuario',
        role: userRole.id
      }
    ];

    for (const userData of demoUsers) {
      const hashedDemoPassword = await bcrypt.hash('demo123', 12);
      
      const user = await prisma.user.upsert({
        where: { username: userData.username },
        update: {},
        create: {
          username: userData.username,
          email: userData.email,
          password: hashedDemoPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isActive: true
        }
      });

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: userData.role
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId: userData.role
        }
      });
    }
  }

  // Crear microservicios de ejemplo
  console.log('🔧 Creando microservicios de ejemplo...');
  
  const microservices = [
    {
      name: 'Sistema Principal',
      description: 'Aplicación principal del ecosistema',
      url: 'http://localhost:8000',
      healthCheckUrl: 'http://localhost:8000/health',
      allowedRoles: ['super_admin', 'admin', 'user']
    },
    {
      name: 'API de Productos',
      description: 'Microservicio de gestión de productos',
      url: 'http://localhost:8001',
      healthCheckUrl: 'http://localhost:8001/api/health',
      allowedRoles: ['super_admin', 'admin']
    },
    {
      name: 'Servicio de Reportes',
      description: 'Generación de reportes y analytics',
      url: 'http://localhost:8002',
      healthCheckUrl: 'http://localhost:8002/health',
      allowedRoles: ['super_admin', 'admin']
    }
  ];

  for (const service of microservices) {
    await prisma.microservice.upsert({
      where: { name: service.name },
      update: {},
      create: service
    });
  }

  console.log('✅ Seed completado exitosamente!');
  console.log(`
📊 Resumen de datos creados:
👤 Usuario administrador: ${process.env.DEFAULT_ADMIN_USERNAME || 'admin'}
🔑 Contraseña: ${process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'}
📧 Email: ${process.env.DEFAULT_ADMIN_EMAIL || 'admin@sistema.com'}

🚀 ¡El sistema está listo para usar!
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });