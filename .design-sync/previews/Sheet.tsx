import * as React from 'react'
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from 'turbine-turmweg'

export function Open() {
  return (
    <Sheet defaultOpen modal={false}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Wettkampf anlegen</SheetTitle>
          <SheetDescription>
            Ein A-Rennen steuert die Periodisierung der umliegenden Wochen.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm">
          <p>Berlin-Marathon — 21.09.2026</p>
          <p className="text-muted-foreground">Zielzeit 2:45:00 (3:54/km)</p>
        </div>
        <SheetFooter>
          <Button>Speichern</Button>
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
