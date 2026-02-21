import apiClient from './client'
import type { ZoneEstimate } from '@/lib/types'

export const settingsApi = {
  estimateZones: (days_back = 90) =>
    apiClient.get<ZoneEstimate>('/settings/zones/estimate', { params: { days_back } }),

  applyEstimatedZones: (days_back = 90) =>
    apiClient.post<ZoneEstimate>('/settings/zones/apply-estimate', null, {
      params: { days_back },
    }),

  updateZones: (data: Record<string, unknown>) =>
    apiClient.put('/settings/zones', data),

  zoneHistory: (limit = 10) =>
    apiClient.get('/settings/zones/history', { params: { limit } }),

  updateAccount: (data: { name?: string; email?: string }) =>
    apiClient.put('/settings/account', data),

  changePassword: (data: {
    current_password: string
    new_password: string
    confirm_password: string
  }) => apiClient.put('/settings/password', data),
}
