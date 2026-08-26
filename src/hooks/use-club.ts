'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clubApi } from '@/api/club'
import type { ClubMessage, ClubRole, ClubVisibility } from '@/lib/types'

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
 * The accumulation lives here rather than in the component so switching clubs
 * cannot leak messages between them: the query key carries the slug, so each
 * club gets its own cache entry and its own cursor.
 *
 * Polling only ever asks for what arrived after the newest id already held, so
 * a quiet club costs an empty array every ten seconds rather than the whole
 * conversation. TanStack pauses `refetchInterval` when the tab is hidden.
 */
export function useClubMessages(slug: string | undefined) {
  const queryClient = useQueryClient()
  const key = ['club', slug, 'messages']

  return useQuery({
    queryKey: key,
    enabled: Boolean(slug),
    refetchInterval: 10_000,
    queryFn: async () => {
      const held = queryClient.getQueryData<ClubMessage[]>(key) ?? []
      const after = held.length > 0 ? held[held.length - 1].id : undefined
      const { data } = await clubApi.getMessages(slug as string, after)

      if (!after) return data.messages
      if (data.messages.length === 0) return held

      // De-duplicate on id: an optimistic post and the poll that follows it can
      // both carry the same message.
      const seen = new Set(held.map((m) => m.id))
      return [...held, ...data.messages.filter((m) => !seen.has(m.id))]
    },
  })
}

export function usePostClubMessage(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => clubApi.postMessage(slug as string, body).then((r) => r.data),
    onSuccess: (message) => {
      // Append directly rather than invalidating: the query function is
      // incremental, so a refetch would ask for messages after this one and
      // return nothing, leaving the poster waiting ten seconds to see their
      // own message.
      queryClient.setQueryData<ClubMessage[]>(['club', slug, 'messages'], (held) =>
        held?.some((m) => m.id === message.id) ? held : [...(held ?? []), message],
      )
    },
  })
}

export function useDeleteClubMessage(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => clubApi.deleteMessage(slug as string, id).then((r) => r.data),
    onSuccess: (_data, id) => {
      // Same reason as above: an incremental refetch would never notice a
      // deletion, so the cache is edited in place.
      queryClient.setQueryData<ClubMessage[]>(['club', slug, 'messages'], (held) =>
        (held ?? []).filter((m) => m.id !== id),
      )
    },
  })
}
