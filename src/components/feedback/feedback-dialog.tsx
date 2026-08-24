'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FeedbackForm from './feedback-form'

/**
 * The always-reachable way to report something, so a bug can be filed at the
 * moment it happens rather than after navigating to Settings. The full history
 * of what came of it lives in Settings › Feedback.
 */
export default function FeedbackDialog() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquarePlus className="h-[15px] w-[15px]" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Bugs, feature requests, questions — all welcome. You can follow what happens to
              it under Settings › Feedback.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm pageUrl={pathname} onSent={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
