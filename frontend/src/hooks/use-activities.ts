import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { activitiesApi } from '@/api/activities'
import { stravaApi } from '@/api/strava'

export function useActivities(params?: {
  start_date?: string
  end_date?: string
  activity_type?: string
  page?: number
  per_page?: number
}) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: () => activitiesApi.list(params).then((r) => r.data),
  })
}

export function useActivityStats(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ['activityStats', params],
    queryFn: () => activitiesApi.stats(params).then((r) => r.data),
  })
}

export function useStatsBySport(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ['statsBySport', params],
    queryFn: () => activitiesApi.statsBySport(params).then((r) => r.data),
  })
}

export function useWeeklyBySport(weeks?: number) {
  return useQuery({
    queryKey: ['weeklyBySport', weeks],
    queryFn: () => activitiesApi.weeklyBySport(weeks).then((r) => r.data),
  })
}

export function useStravaSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (daysBack?: number) => stravaApi.sync(daysBack).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['activityStats'] })
      queryClient.invalidateQueries({ queryKey: ['statsBySport'] })
      queryClient.invalidateQueries({ queryKey: ['weeklyBySport'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}
