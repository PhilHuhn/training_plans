import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from 'turbine-turmweg'

// AlertTitle only reads correctly inside its Alert — both cells show the full
// composition so the title's weight and spacing are judged in context.
export function InAlert() {
  return (
    <Alert className="max-w-md">
      <AlertTitle>Zonen aktualisiert</AlertTitle>
      <AlertDescription>
        Schwellenpace auf 3:48/km angehoben, basierend auf dem 10-km-Test.
      </AlertDescription>
    </Alert>
  )
}

export function LongTitle() {
  return (
    <Alert variant="destructive" className="max-w-md">
      <AlertTitle>
        Die geplante Einheit kollidiert mit einem A-Wettkampf in derselben Woche
      </AlertTitle>
      <AlertDescription>Verschiebe sie um mindestens zwei Tage.</AlertDescription>
    </Alert>
  )
}
