import apiClient from './client'
import type {
  AdminClubWire,
  AiSettingsWire,
  AdminUserWire,
  ClubPlanTier,
  ClubRole,
  ClubVisibility,
} from '@/lib/types'

export interface MembershipTarget {
  club_id: number
  user_id: number
}

export const adminApi = {
  getAiSettings: () => apiClient.get<AiSettingsWire>('/admin/settings/ai'),

  updateAiSettings: (body: { enabled?: boolean; notice?: string }) =>
    apiClient.patch<AiSettingsWire>('/admin/settings/ai', body),

  getUsers: () => apiClient.get<{ users: AdminUserWire[] }>('/admin/users'),

  getClubs: () => apiClient.get<{ clubs: AdminClubWire[] }>('/admin/clubs'),

  setUserAdmin: (userId: number, isAdmin: boolean) =>
    apiClient.patch<{ id: number; is_admin: boolean }>(`/admin/users/${userId}`, {
      is_admin: isAdmin,
    }),

  updateClub: (clubId: number, body: { plan_tier?: ClubPlanTier; donation_url?: string | null }) =>
    apiClient.patch<{ id: number; plan_tier: ClubPlanTier; donation_url: string | null }>(
      `/admin/clubs/${clubId}`,
      body,
    ),

  addMembership: (
    body: MembershipTarget & { role?: ClubRole; visibility?: ClubVisibility },
  ) => apiClient.post('/admin/memberships', body),

  updateMembership: (
    body: MembershipTarget & { role?: ClubRole; visibility?: ClubVisibility },
  ) => apiClient.patch('/admin/memberships', body),

  removeMembership: (body: MembershipTarget) =>
    apiClient.delete('/admin/memberships', { data: body }),
}
