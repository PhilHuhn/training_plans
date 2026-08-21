'use client'
import { X, Trash2, MessageCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat-store'
import ChatConversation from '@/components/chat/chat-conversation'

export default function ChatPanel() {
  const { isOpen, setOpen, clearMessages } = useChatStore()

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <SheetTitle className="text-base">AI Coach</SheetTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearMessages}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <ChatConversation className="flex-1" />
      </SheetContent>
    </Sheet>
  )
}
