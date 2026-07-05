import apiClient from './client'
import type { ZoneEstimate, ZoneHistoryEntry, ZoneRange } from '@/lib/types'

export interface HrEstimateResponse {
  max_hr: number
  resting_hr: number
  threshold_hr?: number
  threshold_hr_source?: 'sustained_efforts' | 'max_fraction' | 'manual'
  hr_zones: Record<string, ZoneRange>
  activities_analyzed: number
}

export interface PaceEstimateResponse {
  threshold_pace: number
  threshold_pace_source?: 'sustained_runs' | 'riegel' | 'percentile'
  pace_zones: Record<string, ZoneRange>
  activities_analyzed: number
}

/** Anchor values the user wants pinned during estimation (not re-derived from data). */
export interface EstimateAnchors {
  max_hr?: number | null
  resting_hr?: number | null
  threshold_hr?: number | null
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

  estimateHrZones: (days_back = 90, anchors?: EstimateAnchors) =>
    apiClient.post<HrEstimateResponse>('/settings/zones/estimate-hr', anchors ?? null, {
      params: { days_back },
    }),

  estimatePaceZones: (days_back = 90, anchors?: Pick<EstimateAnchors, 'max_hr' | 'resting_hr'>) =>
    apiClient.post<PaceEstimateResponse>('/settings/zones/estimate-pace', anchors ?? null, {
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
