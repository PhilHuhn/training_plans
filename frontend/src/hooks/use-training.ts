import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trainingApi } from '@/api/training'
import type { WorkoutDetails } from '@/lib/types'

export function useTrainingWeek(weekStart?: string) {
  return useQuery({
    queryKey: ['trainingWeek', weekStart],
    queryFn: () => trainingApi.week(weekStart).then((r) => r.data),
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: trainingApi.createSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainingWeek'] }),
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
      }
    }) => trainingApi.updateSession(id, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainingWeek'] }),
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => trainingApi.deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainingWeek'] }),
  })
}

export function useAcceptWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, source }: { id: number; source: 'planned' | 'ai' }) =>
      trainingApi.acceptWorkout(id, source),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainingWeek'] }),
  })
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      start_date?: string
      end_date?: string
      consider_uploaded_plan?: boolean
    }) => trainingApi.generateRecommendations(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainingWeek'] }),
  })
}

export function useUploadPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, start_date }: { file: File; start_date?: string }) =>
      trainingApi.uploadPlan(file, start_date).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
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
