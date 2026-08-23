'use client'
import { useEffect, useState } from 'react'
import { site } from '@/lib/site'

/**
 * Renders the operator's email address without ever serving it as one
 * contiguous string. The parts are joined in the browser after mount, so the
 * HTML that reaches a crawler carries only the halves.
 *
 * § 5 DDG requires the address to be *stated*, so the no-JS fallback spells it
 * out in a form a person can still read and retype.
 */
export default function ObfuscatedEmail({ className }: { className?: string }) {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    setAddress([site.email.user, site.email.domain].join('@'))
  }, [])

  if (!address) {
    return (
      <span className={className}>
        {site.email.user} [at] {site.email.domain.replace('.', ' [dot] ')}
      </span>
    )
  }

  return (
    <a href={`mailto:${address}`} className={className}>
      {address}
    </a>
  )
}
