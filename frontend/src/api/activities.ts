import apiClient from './client'
import type { ActivityListResponse, ActivityStats, SportStatsResponse, WeeklyBySportResponse } from '@/lib/types'

export const activitiesApi = {
  list: (params?: {
    start_date?: string
    end_date?: string
    activity_type?: string
    page?: number
    per_page?: number
  }) => apiClient.get<ActivityListResponse>('/activities', { params }),

  get: (id: number) => apiClient.get(`/activities/${id}`),

  stats: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<ActivityStats>('/activities/stats/summary', { params }),

  statsBySport: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<SportStatsResponse>('/activities/stats/by-sport', { params }),

  weeklyBySport: (weeks?: number) =>
    apiClient.get<WeeklyBySportResponse>('/activities/stats/weekly-by-sport', { params: { weeks } }),
}
