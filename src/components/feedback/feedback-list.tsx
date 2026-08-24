'use client'
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyFeedback } from '@/hooks/use-feedback'
import { feedbackCategoryLabel, feedbackStatusColor, feedbackStatusLabel } from '@/lib/utils'

/** The submitter's own reports, with whatever the operator did about them. */
export default function FeedbackList() {
  const { data: items, isLoading } = useMyFeedback()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">You haven&rsquo;t sent any feedback yet.</p>
        <p className="text-xs text-muted-foreground">
          Anything you send shows up here with its status.
        </p>
      </div>
    )
  }

  return (
    <ul className="booktabs-top">
      {items.map((item) => (
        <li key={item.id} className="booktabs-mid py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm">{item.title}</span>
            <Badge variant="outline" className={feedbackStatusColor(item.status)}>
              {feedbackStatusLabel(item.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs italic text-muted-foreground">
            {feedbackCategoryLabel(item.category)} · {item.created_at.slice(0, 10)}
          </p>
          <p className="prose-paper mt-1.5 text-sm whitespace-pre-wrap">{item.body}</p>
          {item.admin_note && (
            <div className="marginpar mt-2">
              <span className="smallcaps italic">Reply</span>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.admin_note}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
