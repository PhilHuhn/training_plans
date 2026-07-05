'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth-store'

export function useCurrentUser() {
  const { token, setUser } = useAuthStore()
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await authApi.me()
      setUser(res.data)
      return res.data
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogin() {
  const { setAuth } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const tokenRes = await authApi.login(email, password)
      const token = tokenRes.data.access_token
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('access_token', token)
      }
      const userRes = await authApi.me()
      return { token, user: userRes.data }
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user)
      queryClient.setQueryData(['currentUser'], user)
      router.push('/training')
    },
  })
}

export function useRegister() {
  const { setAuth } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string
      email: string
      password: string
    }) => {
      const tokenRes = await authApi.register(name, email, password)
      const token = tokenRes.data.access_token
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('access_token', token)
      }
      const userRes = await authApi.me()
      return { token, user: userRes.data }
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user)
      queryClient.setQueryData(['currentUser'], user)
      router.push('/training')
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  return async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // network errors are fine — we still clear local state
    }
    logout()
    queryClient.clear()
    router.push('/login')
  }
}
