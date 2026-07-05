import apiClient from './client'
import type { ChangelogEntry } from '@/lib/types'

export const changelogApi = {
  get: () => apiClient.get<{ entries: ChangelogEntry[] }>('/changelog').then((r) => r.data),
}
