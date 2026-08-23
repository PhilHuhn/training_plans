import * as React from 'react'
import { ScrollArea, Separator } from 'turbine-turmweg'

const sessions = [
  ['24.03.', 'Intervalle 6 × 1000 m', '14,0 km'],
  ['26.03.', 'Tempodauerlauf 8 km', '16,0 km'],
  ['28.03.', 'Lockerer Dauerlauf', '10,0 km'],
  ['29.03.', 'Langer Lauf', '32,2 km'],
  ['31.03.', 'Regeneration', '8,0 km'],
  ['02.04.', 'Bergsprints 10 × 20 s', '12,0 km'],
  ['04.04.', 'Lockerer Dauerlauf', '11,0 km'],
  ['05.04.', 'Langer Lauf', '30,0 km'],
]

export function SessionList() {
  return (
    <ScrollArea className="h-48 w-80 border border-foreground/20 p-3">
      {sessions.map(([date, name, km], i) => (
        <div key={date}>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">{date}</span>
            <span className="flex-1 px-3">{name}</span>
            <span>{km}</span>
          </div>
          {i < sessions.length - 1 ? <Separator /> : null}
        </div>
      ))}
    </ScrollArea>
  )
}
