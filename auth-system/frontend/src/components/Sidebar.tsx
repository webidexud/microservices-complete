// auth-system/frontend/src/components/Sidebar.tsx - VERSIÓN DINÁMICA COMPLETA
import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Server, 
  LogOut,
  User,
  BarChart3,
  ExternalLink
} from 'lucide-react'
import { useAuthStore } from '../services/auth'
import api from '../services/api'

interface Microservice {
  id: number
  name: string
  description: string
  url: string
  isActive: boolean
}

const Sidebar = () => {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [microservices, setMicroservices] = useState<Microservice[]>([])
  const [loading, setLoading] = useState(true)

  // Navegación estática (siempre aparece)
  const staticNavigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard',
    },
    {
      name: 'Usuarios',
      href: '/users',
      icon: Users,
      current: location.pathname === '/users',
      permission: 'users.read'
    },
    {
      name: 'Roles',
      href: '/roles',
      icon: Shield,
      current: location.pathname === '/roles',
      permission: 'roles.read'
    },
    {
      name: 'Microservicios',
      href: '/microservices',
      icon: Server,
      current: location.pathname === '/microservices',
      permission: 'microservices.read'
    }
  ]

  // Cargar microservicios disponibles para el usuario
  useEffect(() => {
    loadUserMicroservices()
  }, [user])

  const loadUserMicroservices = async () => {
    try {
      setLoading(true)
      
      // Obtener todos los microservicios activos
      const response = await api.get('/microservices?isActive=true')
      const allMicroservices = response.data.microservices || []
      
      // Filtrar solo los que el usuario puede acceder
      const accessibleMicroservices = allMicroservices.filter((ms: Microservice) => 
        userCanAccessMicroservice(ms.name)
      )
      
      setMicroservices(accessibleMicroservices)
    } catch (error) {
      console.error('Error loading microservices:', error)
      setMicroservices([])
    } finally {
      setLoading(false)
    }
  }

  // Verificar si el usuario tiene permisos para un microservicio
  const userCanAccessMicroservice = (microserviceName: string): boolean => {
    if (!user?.permissions) return false
    
    // Super admin tiene acceso a todo
    if (user.permissions.includes('*')) return true
    
    const serviceName = microserviceName.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Verificar si tiene algún permiso del microservicio
    return user.permissions.some(permission => 
      permission.startsWith(`${serviceName}.`)
    )
  }

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true
    if (!user?.permissions) return false
    
    // Super admin tiene todos los permisos
    if (user.permissions.includes('*')) return true
    
    return user.permissions.includes(permission)
  }

  // Obtener URL para microservicio
  const getMicroserviceUrl = (ms: Microservice): string => {
    const serviceName = ms.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    return `/${serviceName}/Dashboard`
  }

  // Filtrar navegación estática basado en permisos
  const filteredStaticNavigation = staticNavigation.filter(item => 
    hasPermission(item.permission)
  )

  const handleLogout = () => {
    logout()
  }

  const NavigationItem = ({ item }: { item: typeof staticNavigation[0] }) => {
    const Icon = item.icon
    
    return (
      <Link
        key={item.name}
        to={item.href}
        className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          item.current
            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className="mr-3 h-5 w-5" />
        {item.name}
      </Link>
    )
  }

  const MicroserviceItem = ({ microservice }: { microservice: Microservice }) => {
    const microserviceUrl = getMicroserviceUrl(microservice)
    
    return (
      <a
        key={microservice.id}
        href={`http://localhost${microserviceUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between px-4 py-2 ml-4 text-sm font-medium rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        title={microservice.description}
      >
        <span className="flex items-center">
          <BarChart3 className="mr-3 h-4 w-4" />
          {microservice.name}
        </span>
        <ExternalLink className="h-3 w-3 opacity-50" />
      </a>
    )
  }

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo/Header */}
      <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
        <h2 className="text-white text-lg font-semibold">Auth System</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {/* Navegación estática */}
        {filteredStaticNavigation.map((item) => (
          <NavigationItem key={item.name} item={item} />
        ))}

        {/* Separador si hay microservicios */}
        {microservices.length > 0 && (
          <div className="pt-4 pb-2">
            <div className="border-t border-gray-200 pt-4">
              <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Microservicios
              </h3>
              
              {loading ? (
                <div className="px-4 py-2 text-sm text-gray-500">
                  Cargando...
                </div>
              ) : (
                <div className="space-y-1">
                  {microservices.map((microservice) => (
                    <MicroserviceItem key={microservice.id} microservice={microservice} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* User info y logout */}
      <div className="border-t border-gray-200 p-4">
        {/* Info del usuario */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.username}
            </p>
          </div>
        </div>

        {/* Botón de logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}

export default Sidebar