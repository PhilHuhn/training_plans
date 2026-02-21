import apiClient from './client'
import type { Competition, CompetitionCreate } from '@/lib/types'

export const competitionsApi = {
  list: (include_past = false) =>
    apiClient.get<Competition[]>('/competitions', { params: { include_past } }),

  get: (id: number) => apiClient.get<Competition>(`/competitions/${id}`),

  create: (data: CompetitionCreate) =>
    apiClient.post<Competition>('/competitions', data),

  update: (id: number, data: Partial<CompetitionCreate>) =>
    apiClient.put<Competition>(`/competitions/${id}`, data),

  delete: (id: number) => apiClient.delete(`/competitions/${id}`),
}
