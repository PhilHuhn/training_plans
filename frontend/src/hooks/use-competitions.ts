import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { competitionsApi } from '@/api/competitions'
import type { CompetitionCreate } from '@/lib/types'

export function useCompetitions(includePast = false) {
  return useQuery({
    queryKey: ['competitions', includePast],
    queryFn: () => competitionsApi.list(includePast).then((r) => r.data),
  })
}

export function useCreateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CompetitionCreate) => competitionsApi.create(data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitions'] }),
  })
}

export function useUpdateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CompetitionCreate> }) =>
      competitionsApi.update(id, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitions'] }),
  })
}

export function useDeleteCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => competitionsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitions'] }),
  })
}
