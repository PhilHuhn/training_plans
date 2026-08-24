'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { feedbackApi } from '@/api/feedback'
import type { FeedbackCreate, FeedbackStatus } from '@/lib/types'

/** A submission changes both the submitter's list and the admin table. */
function useInvalidateFeedback() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['feedback'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] })
  }
}

export function useMyFeedback() {
  return useQuery({
    queryKey: ['feedback'],
    queryFn: () => feedbackApi.list().then((r) => r.data),
  })
}

export function useSendFeedback() {
  const invalidate = useInvalidateFeedback()
  return useMutation({
    mutationFn: (data: FeedbackCreate) => feedbackApi.create(data).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useAdminFeedback() {
  return useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: () => feedbackApi.adminList().then((r) => r.data.feedback),
    retry: false, // a 403 is an answer, not a transient failure
  })
}

export function useUpdateFeedback() {
  const invalidate = useInvalidateFeedback()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number
      status?: FeedbackStatus
      admin_note?: string | null
    }) => feedbackApi.adminUpdate(id, body).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useDeleteFeedback() {
  const invalidate = useInvalidateFeedback()
  return useMutation({
    mutationFn: (id: number) => feedbackApi.adminDelete(id).then((r) => r.data),
    onSuccess: invalidate,
  })
}
