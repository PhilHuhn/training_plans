import * as React from 'react'
import { Input, Label, Textarea } from 'turbine-turmweg'

export function FormFields() {
  return (
    <div className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="race">Wettkampf</Label>
        <Input id="race" defaultValue="Berlin-Marathon" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" rows={2} defaultValue="Verpflegung ab km 15 testen." />
      </div>
    </div>
  )
}

export function Standalone() {
  return (
    <div className="space-y-2">
      <Label>Sichtbarkeit für Teamkolleg:innen</Label>
      <p className="text-muted-foreground text-xs">
        „Nur Typ" teilt Verfügbarkeit und Einheiten-Typ; Paces bleiben privat.
      </p>
    </div>
  )
}
