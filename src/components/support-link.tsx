import { Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/lib/site'

/**
 * The Ko-fi link.
 *
 * One component so the destination lives in exactly one place and every
 * appearance carries the same `rel` — `noopener` matters here because the link
 * opens a payment page in a new tab.
 *
 * There is no embedded widget on purpose; see the note on `site.kofi`.
 */

interface SupportLinkProps {
  /** `button` for a bordered call to action, `inline` for a quiet text link. */
  variant?: 'button' | 'inline'
  /** Overrides the label. The default suits both variants. */
  children?: React.ReactNode
  className?: string
  /** Closes the sidebar sheet on mobile, where the link sits inside one. */
  onClick?: () => void
}

export default function SupportLink({
  variant = 'inline',
  children,
  className,
  onClick,
}: SupportLinkProps) {
  return (
    <a
      href={site.kofi.url}
      target="_blank"
      rel="noopener noreferrer"
      // The label is often just "Ko-fi" — enough beside Impressum and
      // Datenschutz, thin on its own next to a version number. The title says
      // what following it does, including that it opens a new tab.
      title="Support Club Turbine on Ko-fi — opens in a new tab"
      onClick={onClick}
      className={cn(
        'transition-colors',
        variant === 'button'
          ? 'inline-flex items-center gap-2 border border-foreground px-7 py-3.5 text-base text-foreground no-underline hover:border-primary hover:text-primary hover:no-underline'
          // No colour and no underline rule of its own, so beside the
          // Impressum/Datenschutz links in a footer it behaves exactly like
          // them. The sidebar colophon overrides both at the call site.
          : 'inline-flex items-center gap-1.5',
        className,
      )}
    >
      <Coffee className={variant === 'button' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
      {children ?? 'Buy me a coffee'}
    </a>
  )
}
