// auth-system/frontend/src/services/auth.ts - REEMPLAZAR COMPLETAMENTE
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from './api'

export interface User {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  permissions: string[]
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
}

// ✅ Funciones para manejar cookies
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        try {
          const response = await api.post('/auth/login', {
            username,
            password,
          })

          const { user, accessToken, refreshToken } = response.data

          // ✅ GUARDAR EN COOKIES (para nginx)
          setCookie('accessToken', accessToken, 1); // 1 día
          setCookie('refreshToken', refreshToken, 7); // 7 días

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
          })
        } catch (error: any) {
          throw new Error(error.response?.data?.error || 'Error en el login')
        }
      },

      logout: async () => {
        try {
          const { refreshToken } = get()
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken })
          }
        } catch (error) {
          console.warn('Error al cerrar sesión:', error)
        } finally {
          // ✅ LIMPIAR COOKIES
          deleteCookie('accessToken');
          deleteCookie('refreshToken');
          
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        // ✅ ACTUALIZAR COOKIES
        setCookie('accessToken', accessToken, 1);
        setCookie('refreshToken', refreshToken, 7);
        
        set({ accessToken, refreshToken })
      },

      setUser: (user: User) => {
        set({ user })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)