import apiClient from './client'
import type {
  TrainingSession,
  TrainingWeekResponse,
  WorkoutDetails,
  UploadedPlan,
} from '@/lib/types'

export interface GenerateProgressEvent {
  type: 'status' | 'done' | 'error'
  stage?: 'preparing' | 'thinking' | 'writing' | 'saving'
  sessions?: number
  saved?: number
  message?: string
}

export interface GenerateParams {
  start_date?: string
  end_date?: string
  consider_uploaded_plan?: boolean
  sports?: string
  sport_availability?: string
}

/**
 * Streaming variant of generate-recommendations: consumes the SSE progress
 * feed and invokes `onEvent` per event. Resolves with the number of saved
 * sessions once the server reports completion; rejects on an error event.
 */
async function generateRecommendationsStream(
  params: GenerateParams,
  onEvent: (event: GenerateProgressEvent) => void,
): Promise<{ saved: number }> {
  const qs = new URLSearchParams({ stream: 'true' })
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value))
  }
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null

  const res = await fetch(`/api/training/generate-recommendations?${qs.toString()}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok || !res.body) {
    throw new Error(`Generation request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: { saved: number } | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      let event: GenerateProgressEvent
      try {
        event = JSON.parse(dataLine.slice(6)) as GenerateProgressEvent
      } catch {
        continue
      }
      onEvent(event)
      if (event.type === 'error') {
        throw new Error(event.message || 'Failed to generate recommendations')
      }
      if (event.type === 'done') {
        result = { saved: event.saved ?? 0 }
      }
    }
  }

  if (!result) throw new Error('Generation ended unexpectedly — please try again')
  return result
}

export interface TrainingRangeResponse {
  range_start: string
  range_end: string
  weeks: Array<
    TrainingWeekResponse & {
      total_distance_final?: number
    }
  >
}

export const trainingApi = {
  sessions: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<TrainingSession[]>('/training/sessions', { params }),

  week: (week_start?: string) =>
    apiClient.get<TrainingWeekResponse>('/training/sessions/week', {
      params: week_start ? { week_start } : undefined,
    }),

  range: (start?: string, weeks = 4) =>
    apiClient.get<TrainingRangeResponse>('/training/sessions/range', {
      params: { ...(start ? { start } : {}), weeks },
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

  generateRecommendations: (params: GenerateParams) =>
    apiClient.post('/training/generate-recommendations', null, { params }),

  generateRecommendationsStream,

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

  exportIcs: (start?: string, end?: string) =>
    apiClient.get('/training/export/ics', {
      responseType: 'blob',
      params: { ...(start ? { start } : {}), ...(end ? { end } : {}) },
    }),

  importIcs: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<{ imported: number; duplicates: number; skipped: string[] }>(
      '/training/import/ics',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
}
