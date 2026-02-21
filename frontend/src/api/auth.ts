import apiClient from './client'
import type { Token, User } from '@/lib/types'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<Token>('/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    apiClient.post<Token>('/auth/register', { name, email, password }),

  me: () => apiClient.get<User>('/auth/me'),

  refresh: () => apiClient.post<Token>('/auth/refresh'),
}
