'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  trainingApi,
  type GenerateParams,
  type GenerateProgressEvent,
  type UploadProgressEvent,
} from '@/api/training'
import type { WorkoutDetails } from '@/lib/types'

export function useTrainingWeek(weekStart?: string) {
  return useQuery({
    queryKey: ['trainingWeek', weekStart],
    queryFn: () => trainingApi.week(weekStart).then((r) => r.data),
  })
}

export function useTrainingRange(start?: string, weeks = 4) {
  return useQuery({
    queryKey: ['trainingRange', start, weeks],
    queryFn: () => trainingApi.range(start, weeks).then((r) => r.data),
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: trainingApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
    },
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: {
        planned_workout?: WorkoutDetails
        recommendation_workout?: WorkoutDetails
        final_workout?: WorkoutDetails
        status?: string
        notes?: string
        rpe_actual?: number
      }
    }) => trainingApi.updateSession(id, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
    },
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => trainingApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
    },
  })
}

export function useAcceptWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, source }: { id: number; source: 'planned' | 'ai' }) =>
      trainingApi.acceptWorkout(id, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
    },
  })
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      params,
      onProgress,
    }: {
      params: GenerateParams
      onProgress?: (event: GenerateProgressEvent) => void
    }) => trainingApi.generateRecommendationsStream(params, onProgress ?? (() => {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
    },
  })
}

/**
 * Imports a plan file, reporting the server's real stages as it goes.
 *
 * The invalidations are the point as much as the upload is: before this hook
 * was wired up, the Settings page called the api layer directly and a
 * successful import left the training grid showing stale data until a remount.
 */
export function useUploadPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      start_date,
      onProgress,
    }: {
      file: File
      start_date?: string
      onProgress?: (event: UploadProgressEvent) => void
    }) => trainingApi.uploadPlanStream(file, start_date, onProgress ?? (() => {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
      queryClient.invalidateQueries({ queryKey: ['uploadedPlans'] })
    },
  })
}

export function useUploadedPlans() {
  return useQuery({
    queryKey: ['uploadedPlans'],
    queryFn: () => trainingApi.uploadedPlans().then((r) => r.data),
  })
}