'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Trash2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChatConversation from '@/components/chat/chat-conversation'
import { useChatStore } from '@/stores/chat-store'
import { useCurrentUser } from '@/hooks/use-auth'

export default function CoachPage() {
  const { clearMessages, messages } = useChatStore()
  const { data: user } = useCurrentUser()

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem-3rem)] w-full max-w-3xl flex-col lg:h-[calc(100vh-3.5rem-5rem)]">
      <div className="flex items-center justify-between border-b border-foreground/20 pb-2">
        <p className="text-sm italic text-muted-foreground">
          Session feedback, plan adjustments, race strategy — same conversation as the side
          panel.
        </p>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearMessages}>
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {user && !user.coach_instructions && (
        <p className="border-b border-foreground/10 py-2 text-xs italic text-muted-foreground">
          No coaching persona configured yet — your coach is running with generic defaults.{' '}
          <Link href="/settings" className="inline-flex items-center gap-1 underline">
            <Settings2 className="h-3 w-3" />
            Set up coach instructions &amp; athlete profile in Settings
          </Link>
        </p>
      )}

      <ChatConversation className="flex-1" />
    </div>
  )
}
