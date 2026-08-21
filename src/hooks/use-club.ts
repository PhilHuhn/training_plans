'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clubApi } from '@/api/club'
import type { ClubRole, ClubVisibility } from '@/lib/types'

export function useMyClubs() {
  return useQuery({
    queryKey: ['club'],
    queryFn: () => clubApi.getMyClubs().then((r) => r.data.memberships),
  })
}

export function useClub(slug: string | undefined) {
  return useQuery({
    queryKey: ['club', slug],
    queryFn: () => clubApi.getClub(slug as string).then((r) => r.data),
    enabled: !!slug,
  })
}

export function useClubOverlay(slug: string | undefined, weekStart: string | undefined) {
  return useQuery({
    queryKey: ['club', slug, 'overlay', weekStart],
    queryFn: () => clubApi.getOverlay(slug as string, weekStart).then((r) => r.data),
    enabled: !!slug,
  })
}

export function useUpdateMembership(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { visibility?: ClubVisibility; user_id?: number; role?: ClubRole }) =>
      clubApi.patchMembership(slug as string, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] })
    },
  })
}
