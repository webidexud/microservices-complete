import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './services/auth'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Microservices from './pages/Microservices'

function App() {
  const { isAuthenticated, user } = useAuthStore()

  // ✅ REDIRECCIÓN AUTOMÁTICA: Si solo tiene acceso a Excel2db, redirigir directamente
  useEffect(() => {
    if (isAuthenticated && user?.permissions) {
      // Verificar si solo tiene permisos de Excel2db
      const hasOnlyExcelAccess = () => {
        const permissions = user.permissions || []
        
        // No es super admin
        if (permissions.includes('*')) return false
        
        // No tiene permisos del dashboard principal
        const hasDashboardPermissions = permissions.some(perm => 
          perm.includes('dashboard.') || 
          perm.includes('users.') || 
          perm.includes('roles.') || 
          perm.includes('microservices.')
        )
        
        // SÍ tiene permisos de Excel2db
        const hasExcelPermissions = permissions.some(perm => 
          perm.includes('excel2db.')
        )
        
        return !hasDashboardPermissions && hasExcelPermissions
      }

      // Si solo tiene acceso a Excel, redirigir automáticamente
      if (hasOnlyExcelAccess()) {
        console.log('🚀 Usuario solo tiene acceso a Excel2db - Redirigiendo...')
        window.location.href = 'http://localhost/excel2db/Dashboard'
      }
    }
  }, [isAuthenticated, user])

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Ruta de login */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } 
          />
          
          {/* Rutas protegidas */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/roles" element={<Roles />} />
                    <Route path="/microservices" element={<Microservices />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App