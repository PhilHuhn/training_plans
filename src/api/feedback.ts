import apiClient from './client'
import type { AdminFeedbackWire, FeedbackCreate, FeedbackItem, FeedbackStatus } from '@/lib/types'

export const feedbackApi = {
  /** The caller's own submissions. */
  list: () => apiClient.get<FeedbackItem[]>('/feedback'),

  create: (data: FeedbackCreate) => apiClient.post<FeedbackItem>('/feedback', data),

  adminList: () => apiClient.get<{ feedback: AdminFeedbackWire[] }>('/admin/feedback'),

  adminUpdate: (id: number, body: { status?: FeedbackStatus; admin_note?: string | null }) =>
    apiClient.patch<FeedbackItem>(`/admin/feedback/${id}`, body),

  adminDelete: (id: number) => apiClient.delete(`/admin/feedback/${id}`),
}
