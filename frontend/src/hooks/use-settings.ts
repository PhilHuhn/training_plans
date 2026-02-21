import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api/settings'

export function useZoneHistory(limit = 10) {
  return useQuery({
    queryKey: ['zoneHistory', limit],
    queryFn: async () => {
      const res = await settingsApi.zoneHistory(limit)
      return res.data
    },
  })
}

export function useRevertZones() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (historyId: number) => settingsApi.revertZones(historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['zoneHistory'] })
    },
  })
}
