import apiClient from './client'
import type { ZoneEstimate, ZoneHistoryEntry } from '@/lib/types'

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
    apiClient.get<ZoneHistoryEntry[]>('/settings/zones/history', { params: { limit } }),

  revertZones: (historyId: number) =>
    apiClient.post('/settings/zones/revert/' + historyId),

  updateAccount: (data: { name?: string; email?: string }) =>
    apiClient.put('/settings/account', data),

  changePassword: (data: {
    current_password: string
    new_password: string
    confirm_password: string
  }) => apiClient.put('/settings/password', data),
}
