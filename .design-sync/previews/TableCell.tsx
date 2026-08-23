import * as React from 'react'
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'turbine-turmweg'

// Cells are judged inside a real row — including one carrying a Badge, which is
// how the app marks session type.
export function DataCells() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Einheit</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Pace</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>6 × 1000 m</TableCell>
          <TableCell>
            <Badge>Schwelle</Badge>
          </TableCell>
          <TableCell>3:32/km</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>32,2 km</TableCell>
          <TableCell>
            <Badge variant="secondary">Grundlage</Badge>
          </TableCell>
          <TableCell>4:45/km</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
