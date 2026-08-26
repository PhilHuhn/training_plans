import apiClient from './client'
import type {
  ClubCreatedResponse,
  ClubMessage,
  ClubDetailResponse,
  ClubOverlayResponse,
  ClubRole,
  ClubSummary,
  ClubVisibility,
} from '@/lib/types'

export const clubApi = {
  getMyClubs: () => apiClient.get<{ memberships: ClubSummary[] }>('/club'),

  createClub: (name: string) => apiClient.post<ClubCreatedResponse>('/club', { name }),

  joinClub: (code: string) => apiClient.post<ClubSummary>('/club/join', { code }),

  leaveClub: (slug: string) => apiClient.delete<void>(`/club/${slug}/membership`),

  getClub: (slug: string) => apiClient.get<ClubDetailResponse>(`/club/${slug}`),

  getOverlay: (slug: string, weekStart?: string) =>
    apiClient.get<ClubOverlayResponse>(`/club/${slug}/overlay`, {
      params: weekStart ? { week: weekStart } : undefined,
    }),

  getMessages: (slug: string, after?: number) =>
    apiClient.get<{ messages: ClubMessage[] }>(`/club/${slug}/messages`, {
      params: after ? { after } : undefined,
    }),

  postMessage: (slug: string, body: string) =>
    apiClient.post<ClubMessage>(`/club/${slug}/messages`, { body }),

  deleteMessage: (slug: string, id: number) =>
    apiClient.delete<void>(`/club/${slug}/messages/${id}`),

  patchMembership: (
    slug: string,
    body: { visibility?: ClubVisibility; user_id?: number; role?: ClubRole },
  ) => apiClient.patch<{ role: ClubRole; visibility: ClubVisibility }>(
    `/club/${slug}/membership`,
    body,
  ),
}
