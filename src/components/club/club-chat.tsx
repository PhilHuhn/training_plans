'use client'
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClubMessages, useDeleteClubMessage, usePostClubMessage } from '@/hooks/use-club'
import { useCurrentUser } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { detailOf } from '@/lib/api-error'

const MAX_LENGTH = 2000


/** "14:32" for today, "12 Aug, 14:32" for anything older. */
function formatWhen(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isToday = new Date().toDateString() === d.toDateString()
  if (isToday) return time
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

interface ClubChatProps {
  /** The active club. Changing it swaps the whole conversation. */
  slug: string
  clubName: string
}

export default function ClubChat({ slug, clubName }: ClubChatProps) {
  const { data: user } = useCurrentUser()
  const { data, isLoading } = useClubMessages(slug)
  const messages = data?.messages
  const post = usePostClubMessage(slug)
  const remove = useDeleteClubMessage(slug)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<number | null>(null)

  // Follow the conversation, but only when it actually grew. Scrolling on every
  // render would yank the view away from someone reading back through history
  // each time the ten-second poll returns.
  useEffect(() => {
    const newest = messages?.[messages.length - 1]?.id ?? null
    if (newest !== null && newest !== lastIdRef.current) {
      lastIdRef.current = newest
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages])

  // A different club is a different conversation; forget where we were.
  useEffect(() => {
    lastIdRef.current = null
    setDraft('')
  }, [slug])

  const send = () => {
    const body = draft.trim()
    if (!body) return
    post.mutate(body, {
      onSuccess: () => setDraft(''),
      // The server's own wording ("Message cannot be empty"), not axios'
      // "Request failed with status code 422" — the athlete can act on one
      // of those.
      onError: (err) => toast.error(detailOf(err, 'Could not send that message')),
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Club chat
        </CardTitle>
        <CardDescription>
          Visible to everyone in {clubName}. New messages appear within a few seconds.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-[340px] min-h-[140px] space-y-3 overflow-y-auto pr-1"
        >
          {data?.truncated && (
            <p className="pb-1 text-center text-[11px] italic text-muted-foreground">
              Showing the most recent {data.window_size} messages.
            </p>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !messages || messages.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              Nothing here yet — say hello.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.author_id === user?.id
              return (
                <div key={m.id} className="group/msg">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'text-[13px] font-semibold',
                        mine ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {mine ? 'You' : m.author_name}
                    </span>
                    <span className="text-[11px] italic tabular-nums text-muted-foreground">
                      {formatWhen(m.created_at)}
                    </span>
                    {m.can_delete && (
                      <button
                        type="button"
                        onClick={() => {
                          remove.mutate(m.id, {
                            onError: (err) =>
                              toast.error(detailOf(err, 'Could not delete that message')),
                          })
                        }}
                        aria-label="Delete message"
                        // Always present, faint until hovered. `hidden` with a
                        // hover reveal left this unreachable on a touch screen,
                        // where there is no hover.
                        className="ml-auto text-muted-foreground/40 transition-colors hover:text-destructive focus-visible:text-destructive group-hover/msg:text-muted-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {/* whitespace-pre-wrap keeps line breaks; the text is escaped
                      by React, so no markup from a teammate can render. */}
                  <p className="whitespace-pre-wrap break-words border-l-2 border-foreground/15 pl-2.5 text-sm leading-relaxed">
                    {m.body}
                  </p>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-foreground/15 pt-3">
          <textarea
            value={draft}
            maxLength={MAX_LENGTH}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention
              // everywhere else people type into a chat.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={`Message ${clubName}…`}
            className="min-h-[52px] flex-1 resize-y border border-foreground/20 bg-transparent p-2 text-sm outline-none focus:border-foreground/50"
          />
          <Button onClick={send} disabled={!draft.trim() || post.isPending} size="sm">
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {post.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        {draft.length > MAX_LENGTH - 200 && (
          <p className="text-right text-[11px] italic text-muted-foreground">
            {MAX_LENGTH - draft.length} characters left
          </p>
        )}
      </CardContent>
    </Card>
  )
}
