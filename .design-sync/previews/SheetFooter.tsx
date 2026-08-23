import * as React from 'react'
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from 'turbine-turmweg'

// The footer pins the actions to the bottom of an open Sheet.
export function InSheet() {
  return (
    <Sheet defaultOpen modal={false}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Plan hochladen</SheetTitle>
        </SheetHeader>
        <SheetFooter>
          <Button>Analysieren</Button>
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
