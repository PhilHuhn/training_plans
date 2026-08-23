import * as React from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from 'turbine-turmweg'

// The header only reads correctly inside an open Sheet.
export function InSheet() {
  return (
    <Sheet defaultOpen modal={false}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Zonen bearbeiten</SheetTitle>
          <SheetDescription>
            Änderungen wirken sich auf alle künftigen Empfehlungen aus.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}
