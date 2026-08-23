import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from 'turbine-turmweg'

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

export function Default() {
  return (
    <Alert className="max-w-md">
      <InfoIcon />
      <AlertTitle>Strava-Sync abgeschlossen</AlertTitle>
      <AlertDescription>
        42 neue Aktivitäten importiert. Die Zonen wurden nicht verändert.
      </AlertDescription>
    </Alert>
  )
}

export function Destructive() {
  return (
    <Alert variant="destructive" className="max-w-md">
      <InfoIcon />
      <AlertTitle>Wochenumfang deutlich über Plan</AlertTitle>
      <AlertDescription>
        118 km statt geplanter 84 km. Vor der nächsten harten Einheit einen
        Regenerationstag einplanen.
      </AlertDescription>
    </Alert>
  )
}

export function TitleOnly() {
  return (
    <Alert className="max-w-md">
      <AlertTitle>Kein Wettkampf hinterlegt</AlertTitle>
    </Alert>
  )
}
