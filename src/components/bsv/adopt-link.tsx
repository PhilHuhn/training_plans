'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'

/**
 * "Als Wettkampf übernehmen" on the public BSV calendar.
 *
 * A client component so the calendar page itself stays cacheable: reading the
 * auth cookie on the server would make every visit a fresh render. Logged in,
 * it opens the competition dialog prefilled; logged out, it leads to sign-up.
 */
export default function AdoptLink({ title, date }: { title: string; date: string }) {
  const token = useAuthStore((s) => s.token)
  // The token only exists in the browser, so the first render has to match the
  // server's logged-out HTML.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const href =
    mounted && token
      ? `/competitions?${new URLSearchParams({ add: title, date })}`
      : '/register'

  return <Link href={href}>Als Wettkampf übernehmen</Link>
}
