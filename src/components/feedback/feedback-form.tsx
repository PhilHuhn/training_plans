'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSendFeedback } from '@/hooks/use-feedback'
import { feedbackCategoryLabel } from '@/lib/utils'
import type { FeedbackCategory } from '@/lib/types'

const CATEGORIES: FeedbackCategory[] = ['bug', 'feature', 'question', 'other']

function apiMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

/**
 * The submission form, shared by the Settings tab and the header dialog.
 * `pageUrl` is the path the user was on — the most useful piece of context in
 * a bug report, and free to capture.
 */
export default function FeedbackForm({
  pageUrl,
  onSent,
}: {
  pageUrl?: string | null
  onSent?: () => void
}) {
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const send = useSendFeedback()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    send.mutate(
      { category, title: title.trim(), body: body.trim(), page_url: pageUrl ?? null },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setCategory('bug')
          toast.success('Thanks — your feedback is in')
          onSent?.()
        },
        onError: (err) => toast.error(apiMessage(err, 'Could not send your feedback')),
      },
    )
  }

  const canSubmit = title.trim().length >= 3 && body.trim().length >= 5 && !send.isPending

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="feedback-category">Type</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
          <SelectTrigger id="feedback-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {feedbackCategoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-title">Summary</Label>
        <Input
          id="feedback-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Strava sync stops after 200 activities"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-body">Details</Label>
        {/* Textarea is field-sizing-content, so `rows` does nothing — an
            explicit minimum keeps the empty field inviting. */}
        <Textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-32"
          placeholder="What happened, and what did you expect instead?"
          maxLength={5000}
        />
      </div>

      {pageUrl && (
        <p className="text-xs italic text-muted-foreground">
          Sent from <span className="font-mono not-italic">{pageUrl}</span>
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {send.isPending ? 'Sending …' : 'Send feedback'}
      </Button>
    </form>
  )
}
