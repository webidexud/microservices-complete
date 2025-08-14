// auth-system/frontend/src/pages/Login.tsx - ESTILO SALESKIP

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../services/auth'
import { Eye, EyeOff, Shield, Sparkles } from 'lucide-react'

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario es requerido'),
  password: z.string().min(1, 'Contraseña es requerida'),
})

type LoginFormData = z.infer<typeof loginSchema>

const Login = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const login = useAuthStore((state) => state.login)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError('')

    try {
      await login(data.username, data.password)
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 relative overflow-hidden">
        {/* Efectos de fondo */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
        </div>
        
        {/* Contenido del hero */}
        <div className="relative z-10 flex flex-col justify-center h-full px-12 lg:px-16">
          {/* Logo/Icono */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Título principal */}
          <div className="mb-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Hello
              <br />
              <span className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
                AuthSystem!
              </span>
              <span className="inline-block ml-3 animate-wave">👋</span>
            </h1>
            
            <p className="text-xl text-blue-100 leading-relaxed max-w-lg">
              Controla y gestiona el acceso a todos tus microservicios desde un solo lugar. 
              Seguridad centralizada y productividad maximizada.
            </p>
          </div>

          {/* Features destacadas */}
          <div className="space-y-4 mb-12">
            <div className="flex items-center text-blue-100">
              <Sparkles className="w-5 h-5 mr-3 text-blue-300" />
              <span>Autenticación centralizada para todos los servicios</span>
            </div>
            <div className="flex items-center text-blue-100">
              <Sparkles className="w-5 h-5 mr-3 text-blue-300" />
              <span>Gestión de roles y permisos granular</span>
            </div>
            <div className="flex items-center text-blue-100">
              <Sparkles className="w-5 h-5 mr-3 text-blue-300" />
              <span>Dashboard intuitivo y fácil de usar</span>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-blue-200 text-sm">
            © 2025 AuthSystem. Todos los derechos reservados.
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario de login */}
      <div className="w-full max-w-md bg-white flex flex-col justify-center px-8 py-12">
        {/* Header del formulario */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            AuthSystem
          </h2>
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome Back!
          </h3>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Campo Email/Usuario */}
          <div>
            <input
              {...register('username')}
              type="text"
              placeholder="usuario@gmail.com"
              className="w-full px-0 py-3 text-lg text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
            />
            {errors.username && (
              <p className="mt-2 text-sm text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Campo Contraseña */}
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full px-0 py-3 text-lg text-gray-900 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer pr-10"
            />
            <button
              type="button"
              className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
            {errors.password && (
              <p className="mt-2 text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Botón de login */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Login Now'
              )}
            </button>
          </div>
        </form>

        {/* Credenciales de prueba */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-3 text-center">
            🔐 Credenciales de prueba
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-700 font-medium">Usuario:</span>
              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                admin
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-700 font-medium">Contraseña:</span>
              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                admin123
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login