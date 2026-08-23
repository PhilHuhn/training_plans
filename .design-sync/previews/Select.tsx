import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'turbine-turmweg'

export function Closed() {
  return (
    <Select defaultValue="schwelle">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Einheitentyp wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="grundlage">Grundlagenlauf</SelectItem>
        <SelectItem value="schwelle">Schwelle</SelectItem>
        <SelectItem value="intervalle">Intervalle</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function Open() {
  return (
    <div className="pb-40">
      <Select defaultOpen defaultValue="schwelle">
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6}>
          <SelectGroup>
            <SelectLabel>Grundlage</SelectLabel>
            <SelectItem value="grundlage">Lockerer Dauerlauf</SelectItem>
            <SelectItem value="lang">Langer Lauf</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Intensiv</SelectLabel>
            <SelectItem value="schwelle">Schwelle</SelectItem>
            <SelectItem value="intervalle">Intervalle</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
