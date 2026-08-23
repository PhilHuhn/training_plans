import * as React from 'react'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from 'turbine-turmweg'

// The overflow counter only makes sense as the last child of an AvatarGroup.
// Single-letter fallbacks keep the overlapped avatars legible next to it.
export function InGroup() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>P</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>M</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+9</AvatarGroupCount>
    </AvatarGroup>
  )
}

export function LargeOverflow() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>T</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+128</AvatarGroupCount>
    </AvatarGroup>
  )
}
