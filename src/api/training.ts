import apiClient from './client'
import { readSseStream } from '@/lib/sse'
import type { ImportProgress } from '@/lib/import-progress'
import type {
  TrainingSession,
  TrainingWeekResponse,
  WorkoutDetails,
  UploadedPlan,
} from '@/lib/types'

/**
 * The bearer token, read straight from storage.
 *
 * These two calls use `fetch` rather than the axios client so they can read a
 * streaming response body, which means they also miss the client's refresh
 * interceptor. An expired token surfaces as a failed request the caller
 * reports; it does not silently sign anyone out.
 */
function authHeaders(): Record<string, string> | undefined {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

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

  const res = await fetch(`/api/training/generate-recommendations?${qs.toString()}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok || !res.body) {
    throw new Error(`Generation request failed (${res.status})`)
  }

  let result: { saved: number } | null = null

  await readSseStream<GenerateProgressEvent>(res.body, (event) => {
    onEvent(event)
    if (event.type === 'error') {
      throw new Error(event.message || 'Failed to generate recommendations')
    }
    if (event.type === 'done') {
      result = { saved: event.saved ?? 0 }
    }
  })

  if (!result) throw new Error('Generation ended unexpectedly — please try again')
  return result
}

export type UploadProgressEvent =
  | ({ type: 'status' } & ImportProgress)
  | { type: 'done'; result: UploadedPlan }
  | { type: 'error'; message: string }

/**
 * Streaming variant of upload-plan: sends the file and consumes the server's
 * stage feed, so the reader sees the document being read, parsed and saved
 * rather than a spinner for the whole of a multi-minute model call.
 *
 * There is no byte-level upload percentage here on purpose. `fetch` cannot
 * report request-body progress and axios cannot read a streaming response, so
 * it is stages or a percentage — and on a file capped at 10MB the transfer is
 * seconds while the parse is minutes.
 */
async function uploadPlanStream(
  file: File,
  startDate: string | undefined,
  onEvent: (event: UploadProgressEvent) => void,
): Promise<UploadedPlan> {
  const qs = new URLSearchParams({ stream: 'true' })
  if (startDate) qs.set('start_date', startDate)

  const formData = new FormData()
  formData.append('file', file)

  // Content-Type is left unset deliberately: the browser must add the
  // multipart boundary itself.
  const res = await fetch(`/api/training/upload-plan?${qs.toString()}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  if (!res.ok || !res.body) {
    // A rejection before the stream opens (auth, file type, size cap) still
    // arrives as a normal JSON error response.
    let detail = ''
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? ''
    } catch {
      // non-JSON body — fall back to the status
    }
    throw new Error(detail || `Upload failed (${res.status})`)
  }

  let result: UploadedPlan | null = null

  await readSseStream<UploadProgressEvent>(res.body, (event) => {
    onEvent(event)
    if (event.type === 'error') {
      throw new Error(event.message || 'Failed to import the plan')
    }
    if (event.type === 'done') {
      result = event.result
    }
  })

  if (!result) throw new Error('The import ended unexpectedly — please try again')
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

  uploadPlanStream,

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
