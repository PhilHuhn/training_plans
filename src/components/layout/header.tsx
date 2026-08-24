'use client'
import { Menu, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FeedbackDialog from '@/components/feedback/feedback-dialog'
import { useCurrentUser } from '@/hooks/use-auth'
import { useChatStore } from '@/stores/chat-store'

interface HeaderProps {
  title: string
  /** Position in the sidebar's table of contents; renders as the eyebrow. */
  section?: number
  onMenuClick: () => void
}

export default function Header({ title, section, onMenuClick }: HeaderProps) {
  const { data: user } = useCurrentUser()
  const toggleChat = useChatStore((s) => s.toggleOpen)
  // The panel stays in place when AI is off; the control just cannot be opened.
  const aiDisabled = user?.ai_enabled === false

  return (
    <header className="frosted sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-4 border-b border-foreground/15 px-4 lg:px-7">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0">
        {section !== undefined && (
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">
            Section {section}
          </div>
        )}
        <h1 className="tt-title truncate text-[23px] leading-[1.1]">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {user?.strava_connected && (
          <Badge variant="outline" className="gap-2">
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="smallcaps italic">Strava connected</span>
          </Badge>
        )}

        <FeedbackDialog />

        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleChat}
          disabled={aiDisabled}
          aria-label="Toggle coach panel"
          title={aiDisabled ? (user?.ai_disabled_notice ?? undefined) : 'Toggle coach panel'}
        >
          <PanelRight className="h-[15px] w-[15px]" />
        </Button>
      </div>
    </header>
  )
}
