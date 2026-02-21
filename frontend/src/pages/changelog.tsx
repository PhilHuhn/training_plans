import { useQuery } from '@tanstack/react-query'
import { GitCommit, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { changelogApi } from '@/api/changelog'

export default function ChangelogPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['changelog'],
    queryFn: changelogApi.get,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Failed to load changelog.
          </CardContent>
        </Card>
      ) : !data?.entries?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GitCommit className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No changelog entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.entries.map((entry) => (
            <Card key={entry.date}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {entry.commits.length} commit{entry.commits.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {entry.commits.map((commit) => (
                    <div key={commit.hash} className="flex items-start gap-3 text-sm">
                      <Badge variant="outline" className="mt-0.5 font-mono text-[10px]">
                        {commit.hash}
                      </Badge>
                      <div className="flex-1">
                        <p>{commit.message}</p>
                        <p className="text-xs text-muted-foreground">{commit.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
