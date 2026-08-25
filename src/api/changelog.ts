import apiClient from './client'
import type { Release } from '@/lib/types'

export const changelogApi = {
  get: () => apiClient.get<{ releases: Release[] }>('/changelog').then((r) => r.data),
}
