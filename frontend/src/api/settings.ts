import apiClient from './client'
import type { ZoneEstimate, ZoneHistoryEntry, ZoneRange } from '@/lib/types'

export interface HrEstimateResponse {
  max_hr: number
  resting_hr: number
  hr_zones: Record<string, ZoneRange>
  activities_analyzed: number
}

export interface PaceEstimateResponse {
  threshold_pace: number
  pace_zones: Record<string, ZoneRange>
  activities_analyzed: number
}

export interface PowerEstimateResponse {
  ftp: number
  cycling_power_zones: Record<string, ZoneRange>
  activities_analyzed: number
  rides_with_power?: number
  note?: string
}

export const settingsApi = {
  estimateZones: (days_back = 90) =>
    apiClient.get<ZoneEstimate>('/settings/zones/estimate', { params: { days_back } }),

  applyEstimatedZones: (days_back = 90) =>
    apiClient.post<ZoneEstimate>('/settings/zones/apply-estimate', null, {
      params: { days_back },
    }),

  estimateHrZones: (days_back = 90) =>
    apiClient.post<HrEstimateResponse>('/settings/zones/estimate-hr', null, {
      params: { days_back },
    }),

  estimatePaceZones: (days_back = 90) =>
    apiClient.post<PaceEstimateResponse>('/settings/zones/estimate-pace', null, {
      params: { days_back },
    }),

  estimatePowerZones: (days_back = 90) =>
    apiClient.post<PowerEstimateResponse>('/settings/zones/estimate-power', null, {
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
