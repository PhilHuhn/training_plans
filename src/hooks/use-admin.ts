'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type MembershipTarget } from '@/api/admin'
import type { ClubPlanTier, ClubRole, ClubVisibility } from '@/lib/types'

/** Both admin tables refetch together — a role change moves rows in each. */
function useInvalidateAdmin() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['club'] })
  }
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers().then((r) => r.data.users),
    retry: false, // a 403 is an answer, not a transient failure
  })
}

export function useAdminClubs() {
  return useQuery({
    queryKey: ['admin', 'clubs'],
    queryFn: () => adminApi.getClubs().then((r) => r.data.clubs),
    retry: false,
  })
}

export function useSetUserAdmin() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) =>
      adminApi.setUserAdmin(userId, isAdmin).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useUpdateClubAdmin() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: ({
      clubId,
      ...body
    }: {
      clubId: number
      plan_tier?: ClubPlanTier
      donation_url?: string | null
    }) => adminApi.updateClub(clubId, body).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAdminUpdateMembership() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (body: MembershipTarget & { role?: ClubRole; visibility?: ClubVisibility }) =>
      adminApi.updateMembership(body).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAdminAddMembership() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (body: MembershipTarget & { role?: ClubRole; visibility?: ClubVisibility }) =>
      adminApi.addMembership(body).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAdminRemoveMembership() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (body: MembershipTarget) => adminApi.removeMembership(body).then((r) => r.data),
    onSuccess: invalidate,
  })
}
