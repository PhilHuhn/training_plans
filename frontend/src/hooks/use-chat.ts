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

      // Check if AI used tools that modified training data
      if (data.tool_results?.length) {
        const modifyingTools = ['update_session_workout', 'create_session']
        const hadModification = data.tool_results.some((tr) =>
          modifyingTools.includes(tr.tool),
        )
        if (hadModification) {
          queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
        }
      }
    } catch {
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return { sendMessage, isLoading }
}
