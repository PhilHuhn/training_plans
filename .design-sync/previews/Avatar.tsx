import * as React from 'react'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from 'turbine-turmweg'

export function Fallbacks() {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>PH</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>SB</AvatarFallback>
      </Avatar>
    </div>
  )
}

export function WithBadge() {
  return (
    <Avatar>
      <AvatarFallback>PH</AvatarFallback>
      <AvatarBadge />
    </Avatar>
  )
}

// AvatarGroup overlaps its children, so two-letter initials get clipped by the
// next avatar. Single letters keep every member legible under the overlap.
export function Group() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>P</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>M</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>S</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  )
}
