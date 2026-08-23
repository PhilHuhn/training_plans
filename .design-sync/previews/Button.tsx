import * as React from 'react'
import { Button } from 'turbine-turmweg'

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Einheit speichern</Button>
      <Button variant="secondary">Entwurf</Button>
      <Button variant="outline">Woche wechseln</Button>
      <Button variant="ghost">Abbrechen</Button>
      <Button variant="link">Alle Aktivitäten</Button>
      <Button variant="destructive">Plan löschen</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
    </div>
  )
}

export function WithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Einheit anlegen
      </Button>
      <Button variant="outline" size="icon" aria-label="Exportieren">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
      </Button>
    </div>
  )
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Aktiv</Button>
      <Button disabled>Deaktiviert</Button>
      <Button variant="outline" disabled>
        Kein Strava-Konto
      </Button>
    </div>
  )
}
