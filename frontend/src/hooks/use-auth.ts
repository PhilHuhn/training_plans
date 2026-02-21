import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth-store'
import { useNavigate } from 'react-router'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const tokenRes = await authApi.login(email, password)
      const token = tokenRes.data.access_token
      localStorage.setItem('access_token', token)
      const userRes = await authApi.me()
      return { token, user: userRes.data }
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user)
      queryClient.setQueryData(['currentUser'], user)
      navigate('/training')
    },
  })
}

export function useRegister() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
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
      localStorage.setItem('access_token', token)
      const userRes = await authApi.me()
      return { token, user: userRes.data }
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user)
      queryClient.setQueryData(['currentUser'], user)
      navigate('/training')
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    logout()
    queryClient.clear()
    navigate('/login')
  }
}
