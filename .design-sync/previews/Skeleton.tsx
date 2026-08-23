import * as React from 'react'
import { Skeleton } from 'turbine-turmweg'

export function SessionCardLoading() {
  return (
    <div className="max-w-sm space-y-3 border border-foreground/20 p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  )
}

export function TextLines() {
  return (
    <div className="max-w-sm space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
