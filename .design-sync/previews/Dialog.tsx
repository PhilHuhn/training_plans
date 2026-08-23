import * as React from 'react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'turbine-turmweg'

// defaultOpen renders the real open dialog inside the card.
export function Open() {
  return (
    <Dialog defaultOpen modal={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Einheit umwandeln</DialogTitle>
          <DialogDescription>
            Die geplante Einheit wird durch den Vorschlag des Coaches ersetzt.
            Der ursprüngliche Workout bleibt als Alternative erhalten.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <Button>Umwandeln</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
