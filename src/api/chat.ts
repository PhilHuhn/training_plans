import apiClient from './client'
import type { ChatMessage, ChatResponse } from '@/lib/types'

export const chatApi = {
  sendMessage: (messages: ChatMessage[]) =>
    apiClient.post<ChatResponse>('/chat/message', { messages, stream: false }),

  sendMessageStream: (messages: ChatMessage[]) => {
    const token = localStorage.getItem('access_token')
    return fetch('/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, stream: true }),
    })
  },
}
