'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/lib/types'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
}

const isBrowser = typeof window !== 'undefined'

const readToken = (): string | null =>
  isBrowser ? window.localStorage.getItem('access_token') : null

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: readToken(),
      user: null,
      setAuth: (token, user) => {
        if (isBrowser) window.localStorage.setItem('access_token', token)
        set({ token, user })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        if (isBrowser) window.localStorage.removeItem('access_token')
        set({ token: null, user: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      storage: createJSONStorage(() =>
        isBrowser ? window.localStorage : (undefined as unknown as Storage),
      ),
      skipHydration: !isBrowser,
    },
  ),
)
