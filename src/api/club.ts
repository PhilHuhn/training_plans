import apiClient from './client'
import type {
  ClubCreatedResponse,
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

  patchMembership: (
    slug: string,
    body: { visibility?: ClubVisibility; user_id?: number; role?: ClubRole },
  ) => apiClient.patch<{ role: ClubRole; visibility: ClubVisibility }>(
    `/club/${slug}/membership`,
    body,
  ),
}
