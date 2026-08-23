import * as React from 'react'
import { Badge } from 'turbine-turmweg'

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Schwelle</Badge>
      <Badge variant="secondary">Grundlage</Badge>
      <Badge variant="outline">Wettkampf</Badge>
      <Badge variant="destructive">Ausgefallen</Badge>
      <Badge variant="ghost">Ruhetag</Badge>
      <Badge variant="link">Details</Badge>
    </div>
  )
}

export function SessionTypes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Intervalle</Badge>
      <Badge>Tempodauerlauf</Badge>
      <Badge variant="secondary">Langer Lauf</Badge>
      <Badge variant="secondary">Regeneration</Badge>
      <Badge variant="outline">A-Rennen</Badge>
    </div>
  )
}
