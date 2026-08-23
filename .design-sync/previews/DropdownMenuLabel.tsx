import * as React from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'turbine-turmweg'

// The label is the non-interactive section heading of an open menu.
export function InMenu() {
  return (
    <div className="pb-40">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">Woche</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Zeitraum</DropdownMenuLabel>
          <DropdownMenuItem>Diese Woche</DropdownMenuItem>
          <DropdownMenuItem>Nächste Woche</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Ansicht</DropdownMenuLabel>
          <DropdownMenuItem>Nur geplante Einheiten</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
