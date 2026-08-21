import apiClient from './client'
import type {
  ClubDetailResponse,
  ClubOverlayResponse,
  ClubRole,
  ClubSummary,
  ClubVisibility,
} from '@/lib/types'

export const clubApi = {
  getMyClubs: () => apiClient.get<{ memberships: ClubSummary[] }>('/club'),

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
