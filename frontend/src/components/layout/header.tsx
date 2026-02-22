import { Menu, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'
import { useChatStore } from '@/stores/chat-store'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { data: user } = useCurrentUser()
  const toggleChat = useChatStore((s) => s.toggleOpen)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b-2 border-[#092B37] bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-lg font-bold uppercase tracking-wider">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {user?.strava_connected && (
          <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
            <span className="h-1.5 w-1.5 rounded-none bg-emerald-500" />
            Strava connected
          </Badge>
        )}

        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9"
          onClick={toggleChat}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
