import * as React from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from 'turbine-turmweg'

// The caption sits below the table in italic muted type — the LaTeX convention.
export function BelowTable() {
  return (
    <Table>
      <TableCaption>
        Tabelle 1: Umfang und Intensität der Aufbauwochen 10–12
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Woche</TableHead>
          <TableHead>Umfang</TableHead>
          <TableHead>Harte Einheiten</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>10</TableCell>
          <TableCell>78,0 km</TableCell>
          <TableCell>2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>11</TableCell>
          <TableCell>81,5 km</TableCell>
          <TableCell>2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>12</TableCell>
          <TableCell>84,2 km</TableCell>
          <TableCell>3</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
