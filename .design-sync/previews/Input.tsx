import * as React from 'react'
import { Input, Label } from 'turbine-turmweg'

export function WithLabel() {
  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="goal">Zielzeit Marathon</Label>
      <Input id="goal" defaultValue="2:45:00" />
    </div>
  )
}

export function Types() {
  return (
    <div className="max-w-sm space-y-3">
      <Input placeholder="Name der Einheit" />
      <Input type="number" defaultValue={32.2} />
      <Input type="date" defaultValue="2026-09-21" />
    </div>
  )
}

export function States() {
  return (
    <div className="max-w-sm space-y-3">
      <Input defaultValue="Aktiv" />
      <Input defaultValue="Gesperrt" disabled />
      <Input defaultValue="Ungültige Pace" aria-invalid />
    </div>
  )
}
