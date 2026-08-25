'use client'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { changelogApi } from '@/api/changelog'
import { compareKinds, splitEmphasis, type ChangeKind, type Release } from '@/lib/changelog'
import { APP_VERSION } from '@/lib/version'

/** Groups a release's notes under their heading, in a stable reading order. */
function byKind(release: Release): [ChangeKind, string[]][] {
  const groups = new Map<ChangeKind, string[]>()
  for (const change of release.changes) {
    const list = groups.get(change.kind) ?? []
    list.push(change.text)
    groups.set(change.kind, list)
  }
  return [...groups.entries()].sort((a, b) => compareKinds(a[0], b[0]))
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ChangelogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['changelog'],
    queryFn: changelogApi.get,
  })

  const releases = data?.releases ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-7">
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScrollText className="mb-3 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm italic text-muted-foreground">Nothing here yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-9">
          {releases.map((release) => {
            // APP_VERSION is inlined at build time, so this marks the release
            // you are actually looking at rather than merely the newest one.
            const running = release.version === APP_VERSION
            return (
              <li key={release.version}>
                <div className="rule-bottom flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2">
                  <h2 className="tt-display tabular-nums text-[22px]">v{release.version}</h2>
                  {release.date && (
                    <span className="text-[13px] italic text-muted-foreground">
                      {formatDate(release.date)}
                    </span>
                  )}
                  {running && (
                    <span className="smallcaps ml-auto border border-primary/40 px-2 py-0.5 text-[11px] italic text-primary">
                      You are here
                    </span>
                  )}
                </div>

                <div className="mt-3.5 space-y-3.5">
                  {byKind(release).map(([kind, texts]) => (
                    <div key={kind}>
                      <div className="smallcaps text-[11.5px] italic text-muted-foreground">
                        {kind}
                      </div>
                      <ul className="mt-1 space-y-1.5">
                        {texts.map((text) => (
                          <li
                            key={text}
                            className="border-l-2 border-foreground/15 pl-3 text-[15px] leading-relaxed"
                          >
                            {splitEmphasis(text).map((seg, i) =>
                              seg.bold ? (
                                <strong key={i} className="font-semibold">
                                  {seg.text}
                                </strong>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              ),
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
