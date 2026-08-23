import * as React from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from 'turbine-turmweg'

export function Open() {
  return (
    <div className="pb-48">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Einheit</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Dienstag, 24. März</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            Bearbeiten
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Als erledigt markieren</DropdownMenuItem>
          <DropdownMenuItem>Nach Garmin exportieren</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Einheit löschen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
