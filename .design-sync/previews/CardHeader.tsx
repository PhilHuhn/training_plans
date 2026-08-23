import * as React from 'react'
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'turbine-turmweg'

// CardHeader is only meaningful inside a Card — both cells show it in place.
export function WithAction() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Langer Lauf</CardTitle>
        <CardDescription>Sonntag, 29. März — 32 km im Grundlagenbereich</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Verschieben
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Letzte 8 km progressiv auf Marathonpace.</p>
      </CardContent>
    </Card>
  )
}

export function TitleAndDescription() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Wettkampfziele</CardTitle>
        <CardDescription>Saison 2026</CardDescription>
      </CardHeader>
    </Card>
  )
}
