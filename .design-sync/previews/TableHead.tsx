import * as React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'turbine-turmweg'

// TableHead renders as the italic small-caps header cell of the booktabs rule.
export function ColumnHeaders() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Einheit</TableHead>
          <TableHead>Distanz</TableHead>
          <TableHead>Ø Puls</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>24.03.</TableCell>
          <TableCell>Intervalle 6 × 1000 m</TableCell>
          <TableCell>14,0 km</TableCell>
          <TableCell>168</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>26.03.</TableCell>
          <TableCell>Tempodauerlauf</TableCell>
          <TableCell>16,0 km</TableCell>
          <TableCell>161</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
