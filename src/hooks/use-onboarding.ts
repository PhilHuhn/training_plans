'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api/settings'

/**
 * Records setup progress server-side rather than in localStorage, so a tour
 * someone already sat through does not replay on their phone.
 *
 * Failures are deliberately swallowed by callers: not recording that a tour
 * finished is a small annoyance, and surfacing a toast for it during
 * onboarding would be worse than the bug.
 */
export function usePatchOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { welcomed?: boolean; tour_done?: string }) =>
      settingsApi.patchOnboarding(body).then((r) => r.data),
    onSuccess: () => {
      // Preferences ride on /api/auth/me, which is what the tour reads back.
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}
