import * as React from 'react'
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'turbine-turmweg'

// `open` forces the tooltip visible so the card shows the real popover
// instead of just its trigger.
export function Open() {
  return (
    <TooltipProvider>
      <div className="flex justify-center pt-16">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="outline">TRIMP</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Trainingsbelastung nach Bannister
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
