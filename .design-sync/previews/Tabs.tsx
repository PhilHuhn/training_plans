import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'turbine-turmweg'

export function Default() {
  return (
    <Tabs defaultValue="woche" className="max-w-md">
      <TabsList>
        <TabsTrigger value="woche">Woche</TabsTrigger>
        <TabsTrigger value="monat">Monat</TabsTrigger>
        <TabsTrigger value="saison">Saison</TabsTrigger>
      </TabsList>
      <TabsContent value="woche">
        <p className="text-sm">84,2 km in 7 Einheiten, 3 davon intensiv.</p>
      </TabsContent>
      <TabsContent value="monat">
        <p className="text-sm">332 km — bislang stärkster Monat der Saison.</p>
      </TabsContent>
      <TabsContent value="saison">
        <p className="text-sm">2 480 km seit Januar.</p>
      </TabsContent>
    </Tabs>
  )
}

export function LineVariant() {
  return (
    <Tabs defaultValue="geplant" className="max-w-md">
      <TabsList variant="line">
        <TabsTrigger value="geplant">Geplant</TabsTrigger>
        <TabsTrigger value="erledigt">Erledigt</TabsTrigger>
      </TabsList>
      <TabsContent value="geplant">
        <p className="text-sm">Intervalle 6 × 1000 m bei 3:32/km.</p>
      </TabsContent>
      <TabsContent value="erledigt">
        <p className="text-sm">Tempodauerlauf 8 km bei 3:55/km.</p>
      </TabsContent>
    </Tabs>
  )
}
