'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clubApi } from '@/api/club'
import type { ClubMessage, ClubRole, ClubVisibility } from '@/lib/types'

/**
 * Chat cache key.
 *
 * Deliberately *not* nested under ['club']. useCreateClub, useJoinClub,
 * useLeaveClub and useUpdateMembership all invalidate ['club'], and TanStack
 * matches invalidation by key prefix — so ['club', slug, 'messages'] was being
 * cancelled and refetched by every membership change, including a leave that
 * then refetched against a club the user had just left.
 */
function clubMessagesKey(slug: string | undefined) {
  return ['club-messages', slug] as const
}

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

export function useCreateClub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => clubApi.createClub(name).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] })
    },
  })
}

export function useJoinClub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => clubApi.joinClub(code).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] })
    },
  })
}

export function useLeaveClub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => clubApi.leaveClub(slug).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] })
    },
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

/**
 * Club chat, polled while the page is open.
 *
 * Deliberately plain: every poll replaces the cache with the server's current
 * window. The obvious optimisation — fetch only what arrived since the newest
 * id held, and append — was the first version, and it broke three ways. A
 * forward-only cursor never re-reads a row, so a message someone else deleted
 * stayed on screen; a poll in flight when a mutation wrote to the cache
 * resolved and overwrote it with its own stale snapshot; and refetching could
 * never disagree with the cache, so once it diverged nothing could repair it.
 *
 * A full window is a few kilobytes. Correctness is worth more than that here.
 *
 * The query key carries the slug, so each club has its own cache entry and
 * switching clubs cannot show one club's messages under another's name.
 */
export function useClubMessages(slug: string | undefined) {
  return useQuery({
    queryKey: clubMessagesKey(slug),
    enabled: Boolean(slug),
    refetchInterval: 10_000,
    queryFn: () => clubApi.getMessages(slug as string).then((r) => r.data),
  })
}

export function usePostClubMessage(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => clubApi.postMessage(slug as string, body).then((r) => r.data),
    // Refetch rather than splicing the response in. The window may have rolled
    // past its oldest message to make room, and the server knows where the
    // window sits; the client does not.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubMessagesKey(slug) })
    },
  })
}

export function useDeleteClubMessage(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => clubApi.deleteMessage(slug as string, id).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubMessagesKey(slug) })
    },
  })
}
