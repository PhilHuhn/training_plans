import * as React from 'react'
import { Separator } from 'turbine-turmweg'

export function Horizontal() {
  return (
    <div className="max-w-sm">
      <p className="smallcaps text-muted-foreground text-sm">Woche 12</p>
      <Separator className="my-3" />
      <p className="text-sm">84,2 km in 7 Einheiten</p>
    </div>
  )
}

export function Vertical() {
  return (
    <div className="flex h-10 items-center gap-4 text-sm">
      <span>32,2 km</span>
      <Separator orientation="vertical" />
      <span>4:45/km</span>
      <Separator orientation="vertical" />
      <span>2:33:12</span>
    </div>
  )
}
