'use client'
import { useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { useChatStore } from '@/stores/chat-store'

export function useChat() {
  const { messages, addMessage, setLoading, isLoading } = useChatStore()
  const queryClient = useQueryClient()

  const sendMessage = async (content: string) => {
    const userMessage = { role: 'user' as const, content }
    addMessage(userMessage)
    setLoading(true)

    try {
      const allMessages = [...messages, userMessage]
      const res = await chatApi.sendMessage(allMessages)
      const data = res.data

      addMessage(data.message)

      // Check if AI used tools that modified data
      if (data.tool_results?.length) {
        const modifyingTools = ['update_session_workout', 'create_session']
        const hadModification = data.tool_results.some((tr) =>
          modifyingTools.includes(tr.tool),
        )
        if (hadModification) {
          queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
          queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
        }
        // Coach updated the athlete profile → refresh user so Settings shows it
        if (data.tool_results.some((tr) => tr.tool === 'update_athlete_profile')) {
          queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        }
      }
    } catch (err) {
      // The route already turns upstream failures into a message that is safe
      // to show and says whether retrying can help; the raw cause stays in the
      // server log. Falling back to a generic line only when there is no body.
      const detail =
        (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      addMessage({
        role: 'assistant',
        content:
          typeof detail === 'string' && detail.trim() !== ''
            ? detail
            : 'Sorry, I could not reach the coach. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return { sendMessage, isLoading }
}