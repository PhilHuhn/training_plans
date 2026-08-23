import * as React from 'react'
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'turbine-turmweg'

export function SessionCard() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Intervalle 6 × 1000 m</CardTitle>
        <CardDescription>Dienstag, 24. März — Schwelle</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Bearbeiten
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="prose-paper">
        <p>
          20 min Einlaufen, danach 6 × 1000 m bei 3:32/km mit je 90 s Trabpause.
          Die letzten beiden Intervalle bewusst kontrolliert laufen — der lange
          Lauf am Sonntag hat Vorrang vor einem forcierten Abschluss.
        </p>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="smallcaps text-muted-foreground text-sm">geplant</span>
        <Button size="sm">Als erledigt markieren</Button>
      </CardFooter>
    </Card>
  )
}

export function Minimal() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Wochenumfang</CardTitle>
        <CardDescription>Kalenderwoche 12</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl">84,2 km</p>
        <p className="text-muted-foreground text-sm">+6,4 km gegenüber Vorwoche</p>
      </CardContent>
    </Card>
  )
}

export function WithoutHeader() {
  return (
    <Card className="max-w-sm">
      <CardContent className="prose-paper">
        <p>
          Ruhetag. Kein Lauf geplant — Mobilität und 20 min lockeres Radfahren
          sind erlaubt, wenn sich die Beine schwer anfühlen.
        </p>
      </CardContent>
    </Card>
  )
}
