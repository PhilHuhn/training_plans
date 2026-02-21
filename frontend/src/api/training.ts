import apiClient from './client'
import type { TrainingSession, TrainingWeekResponse, WorkoutDetails, UploadedPlan } from '@/lib/types'

export const trainingApi = {
  sessions: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<TrainingSession[]>('/training/sessions', { params }),

  week: (week_start?: string) =>
    apiClient.get<TrainingWeekResponse>('/training/sessions/week', {
      params: week_start ? { week_start } : undefined,
    }),

  createSession: (data: {
    session_date: string
    source?: string
    planned_workout?: WorkoutDetails
    recommendation_workout?: WorkoutDetails
    notes?: string
  }) => apiClient.post<TrainingSession>('/training/sessions', data),

  updateSession: (
    id: number,
    data: {
      planned_workout?: WorkoutDetails
      recommendation_workout?: WorkoutDetails
      final_workout?: WorkoutDetails
      status?: string
      notes?: string
    },
  ) => apiClient.put<TrainingSession>(`/training/sessions/${id}`, data),

  deleteSession: (id: number) => apiClient.delete(`/training/sessions/${id}`),

  acceptWorkout: (id: number, source: 'planned' | 'ai') =>
    apiClient.post(`/training/sessions/${id}/accept`, null, { params: { source } }),

  generateRecommendations: (params: {
    start_date?: string
    end_date?: string
    consider_uploaded_plan?: boolean
    sports?: string
    sport_availability?: string
  }) => apiClient.post('/training/generate-recommendations', null, { params }),

  uploadPlan: (file: File, start_date?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<UploadedPlan>('/training/upload-plan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: start_date ? { start_date } : undefined,
    })
  },

  convertSession: (workout: WorkoutDetails, target_type: string) =>
    apiClient.post('/training/convert-session', { workout, target_type }),

  uploadedPlans: () => apiClient.get<UploadedPlan[]>('/training/uploaded-plans'),

  deleteUploadedPlan: (id: number) => apiClient.delete(`/training/uploaded-plans/${id}`),

  exportGarmin: (sessionId: number) =>
    apiClient.get(`/training/sessions/${sessionId}/export/garmin`, {
      responseType: 'blob',
    }),
}
