import * as React from 'react'
import { Label, Textarea } from 'turbine-turmweg'

export function SessionNotes() {
  return (
    <div className="max-w-md space-y-1.5">
      <Label htmlFor="rpe">Notiz zur Einheit</Label>
      <Textarea
        id="rpe"
        rows={4}
        defaultValue={
          'Beine ab dem vierten Intervall schwer, Pace aber gehalten. RPE 8. Wade rechts leicht spürbar — im Auge behalten.'
        }
      />
    </div>
  )
}

export function Empty() {
  return (
    <div className="max-w-md">
      <Textarea rows={3} placeholder="Wie hat sich die Einheit angefühlt?" />
    </div>
  )
}

export function Disabled() {
  return (
    <div className="max-w-md">
      <Textarea rows={3} disabled defaultValue="Einheit bereits abgeschlossen." />
    </div>
  )
}
