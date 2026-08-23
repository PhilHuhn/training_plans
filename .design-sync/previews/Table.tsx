import * as React from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'turbine-turmweg'

export function WeeklyPlan() {
  const rows = [
    ['Mo', 'Ruhetag', '—', '—'],
    ['Di', 'Intervalle 6 × 1000 m', '14,0 km', '3:32/km'],
    ['Mi', 'Lockerer Dauerlauf', '12,0 km', '5:10/km'],
    ['Do', 'Tempodauerlauf 8 km', '16,0 km', '3:55/km'],
    ['Fr', 'Ruhetag', '—', '—'],
    ['Sa', 'Lockerer Dauerlauf', '10,0 km', '5:15/km'],
    ['So', 'Langer Lauf', '32,2 km', '4:45/km'],
  ]
  return (
    <Table>
      <TableCaption>Trainingswoche 12 — Marathonaufbau, Zielzeit 2:45</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Tag</TableHead>
          <TableHead>Einheit</TableHead>
          <TableHead>Distanz</TableHead>
          <TableHead>Pace</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([day, session, distance, pace]) => (
          <TableRow key={day}>
            <TableCell className="smallcaps">{day}</TableCell>
            <TableCell>{session}</TableCell>
            <TableCell>{distance}</TableCell>
            <TableCell>{pace}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function Compact() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Wettkampf</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Ziel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Berlin-Marathon</TableCell>
          <TableCell>21.09.2026</TableCell>
          <TableCell>2:45:00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Halbmarathon Hamburg</TableCell>
          <TableCell>28.06.2026</TableCell>
          <TableCell>1:17:30</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
