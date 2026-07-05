'use client'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import type { IntervalSet, TrainingSession, WorkoutDetails } from '@/lib/types'
import {
  useAcceptWorkout,
  useCreateSession,
  useUpdateSession,
} from '@/hooks/use-training'
import { cn } from '@/lib/utils'

type Variant = 'planned' | 'ai' | 'final'

const VARIANT_LABEL: Record<Variant, string> = {
  planned: 'Planned',
  ai: 'AI',
  final: 'Final',
}

function pickInitialVariant(session?: TrainingSession): Variant {
  if (session?.final_workout) return 'final'
  if (session?.recommendation_workout) return 'ai'
  return 'planned'
}

function workoutForVariant(
  session: TrainingSession | undefined,
  variant: Variant,
): WorkoutDetails | undefined {
  if (!session) return undefined
  if (variant === 'planned') return session.planned_workout
  if (variant === 'ai') return session.recommendation_workout
  return session.final_workout
}

interface SessionModalProps {
  open: boolean
  onClose: () => void
  session?: TrainingSession
  date: string
}

const sports = ['running', 'cycling', 'swimming', 'strength', 'hiking', 'rowing', 'other']
const workoutTypes = ['easy', 'tempo', 'interval', 'long_run', 'recovery', 'rest', 'cross_training']
const intensities = ['low', 'moderate', 'high']
const hrZones = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5']
const terrainOptions = ['flat', 'hilly', 'trail', 'track', 'mixed'] as const
type Terrain = (typeof terrainOptions)[number]

const templates: Record<string, Partial<WorkoutDetails>> = {
  easy: { type: 'easy', sport: 'running', description: 'Easy run', intensity: 'low', hr_zone: 'zone2' },
  tempo: { type: 'tempo', sport: 'running', description: 'Tempo run', intensity: 'moderate', hr_zone: 'zone3' },
  intervals: {
    type: 'interval',
    sport: 'running',
    description: '6x400m intervals with 90s recovery',
    intensity: 'high',
    hr_zone: 'zone4',
    intervals: [{ reps: 6, distance_m: 400, recovery: '90s' }],
  },
  long: { type: 'long_run', sport: 'running', description: 'Long run', intensity: 'low', hr_zone: 'zone2' },
  'easy ride': { type: 'easy', sport: 'cycling', description: 'Easy endurance ride', intensity: 'low', hr_zone: 'zone2' },
  swim: { type: 'easy', sport: 'swimming', description: 'Swim session', intensity: 'moderate', hr_zone: 'zone2' },
  strength: { type: 'cross_training', sport: 'strength', description: 'Strength training — core and legs', intensity: 'moderate' },
}

export default function SessionModal({ open, onClose, session, date }: SessionModalProps) {
  const createSession = useCreateSession()
  const updateSession = useUpdateSession()
  const acceptWorkout = useAcceptWorkout()

  const [variant, setVariant] = useState<Variant>(() => pickInitialVariant(session))

  const existing = workoutForVariant(session, variant)
  const [sport, setSport] = useState(existing?.sport || 'running')
  const [type, setType] = useState(existing?.type || 'easy')
  const [description, setDescription] = useState(existing?.description || '')
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km?.toString() || '')
  const [durationMin, setDurationMin] = useState(existing?.duration_min?.toString() || '')
  const [intensity, setIntensity] = useState(existing?.intensity || '')
  const [hrZone, setHrZone] = useState(existing?.hr_zone || '')
  const [paceRange, setPaceRange] = useState(existing?.pace_range || '')
  const [powerTarget, setPowerTarget] = useState(existing?.power_target_watts?.toString() || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [terrain, setTerrain] = useState(existing?.terrain || '')
  const [elevationTarget, setElevationTarget] = useState(existing?.elevation_target_m?.toString() || '')
  const [intervals, setIntervals] = useState<IntervalSet[]>(existing?.intervals || [])

  // When the modal opens, snap to the most-likely-relevant variant (Final → AI → Planned).
  useEffect(() => {
    if (open) setVariant(pickInitialVariant(session))
  }, [open, session])

  // Whenever variant changes (or the modal opens/session changes), reload form fields
  // from the selected variant's workout.
  useEffect(() => {
    if (!open) return
    const w = workoutForVariant(session, variant)
    setSport(w?.sport || 'running')
    setType(w?.type || 'easy')
    setDescription(w?.description || '')
    setDistanceKm(w?.distance_km?.toString() || '')
    setDurationMin(w?.duration_min?.toString() || '')
    setIntensity(w?.intensity || '')
    setHrZone(w?.hr_zone || '')
    setPaceRange(w?.pace_range || '')
    setPowerTarget(w?.power_target_watts?.toString() || '')
    setNotes(w?.notes || '')
    setTerrain(w?.terrain || '')
    setElevationTarget(w?.elevation_target_m?.toString() || '')
    setIntervals(w?.intervals || [])
  }, [open, session, variant])

  const applyTemplate = (key: string) => {
    const t = templates[key]
    if (t) {
      setSport(t.sport || 'running')
      setType(t.type || 'easy')
      setDescription(t.description || '')
      setIntensity(t.intensity || '')
      setHrZone(t.hr_zone || '')
      setPaceRange('')
      setPowerTarget('')
      setIntervals(t.intervals || [])
    }
  }

  const addInterval = () => {
    setIntervals([...intervals, { reps: 4, distance_m: 400, recovery: '90s' }])
  }

  const removeInterval = (index: number) => {
    setIntervals(intervals.filter((_, i) => i !== index))
  }

  const updateInterval = (index: number, updates: Partial<IntervalSet>) => {
    setIntervals(intervals.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  // Determine which fields to show based on sport
  const showPace = sport === 'running'
  const showPower = sport === 'cycling'
  const showDistance = sport !== 'strength'

  const handleSave = () => {
    // Spread the loaded variant workout as the base so fields the form doesn't
    // edit (alternative_workout, training_phase, estimated_load, rpe_target, …)
    // survive a save instead of being silently stripped.
    const base = workoutForVariant(session, variant) ?? {}
    const workout: WorkoutDetails = {
      ...base,
      type,
      sport,
      description,
      distance_km: distanceKm ? parseFloat(distanceKm) : undefined,
      duration_min: durationMin ? parseInt(durationMin) : undefined,
      intensity: intensity || undefined,
      hr_zone: hrZone || undefined,
      pace_range: showPace && paceRange ? paceRange : undefined,
      power_target_watts: showPower && powerTarget ? parseInt(powerTarget) : undefined,
      notes: notes || undefined,
      terrain: (terrain || undefined) as Terrain | undefined,
      elevation_target_m: elevationTarget ? parseInt(elevationTarget) : undefined,
      intervals: intervals.length > 0 ? intervals : undefined,
    }

    // Write to the column that matches the active variant.
    const columnKey = variant === 'planned'
      ? 'planned_workout'
      : variant === 'ai'
        ? 'recommendation_workout'
        : 'final_workout'

    if (session) {
      updateSession.mutate(
        { id: session.id, data: { [columnKey]: workout } as Record<string, WorkoutDetails> },
        { onSuccess: onClose },
      )
    } else {
      // Create flow: only Planned and AI variants are creatable without an
      // existing session. "Final" implies an accept on an existing session.
      const createField = variant === 'ai' ? 'recommendation_workout' : 'planned_workout'
      const createSource = variant === 'ai' ? 'app_recommendation' : 'manual'
      createSession.mutate(
        { session_date: date, [createField]: workout, source: createSource } as Parameters<
          typeof createSession.mutate
        >[0],
        { onSuccess: onClose },
      )
    }
  }

  /** Accept the *currently displayed* variant as Final. */
  const handleAcceptAsFinal = () => {
    if (!session) return
    if (variant === 'planned' || variant === 'ai') {
      acceptWorkout.mutate(
        { id: session.id, source: variant },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = createSession.isPending || updateSession.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit' : 'Add'} Workout — {date}</DialogTitle>
        </DialogHeader>

        {/* Variant selector — Planned / AI / Final */}
        <div className="mb-3 flex items-center gap-2">
          {(['planned', 'ai', 'final'] as Variant[]).map((v) => {
            const has = !!workoutForVariant(session, v)
            const isActive = variant === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={cn(
                  'group flex flex-col items-start px-2 py-1 text-left transition-colors border-l-2',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={isActive}
              >
                <span className="text-xs italic smallcaps">{VARIANT_LABEL[v]}</span>
                <span className="text-[10px] italic text-muted-foreground/80">
                  {has ? 'populated' : 'empty'}
                </span>
              </button>
            )
          })}
          {variant !== 'final' && session && workoutForVariant(session, variant) && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handleAcceptAsFinal}
              disabled={acceptWorkout.isPending}
            >
              {acceptWorkout.isPending ? 'Accepting…' : `Accept ${VARIANT_LABEL[variant]} as Final`}
            </Button>
          )}
        </div>

        {/* View-only AI metadata for the active variant */}
        {(() => {
          const w = workoutForVariant(session, variant)
          if (!w || (!w.training_phase && !w.estimated_load && !w.rpe_target)) return null
          const parts: string[] = []
          if (w.training_phase) parts.push(`Phase ${w.training_phase}`)
          if (w.estimated_load) parts.push(`Load ${w.estimated_load}`)
          if (w.rpe_target) parts.push(`RPE ${w.rpe_target}`)
          return (
            <p className="mb-2 border-y border-foreground/15 py-1 text-[10px] italic smallcaps text-muted-foreground">
              {parts.join(' · ')}
            </p>
          )
        })()}

        <Tabs defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
            <TabsTrigger value="intervals" className="flex-1">
              Intervals{intervals.length > 0 ? ` (${intervals.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-2">
            {/* Quick templates */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(templates).map((key) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => applyTemplate(key)}
                >
                  {key}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Sport</Label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sports.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workoutTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Intensity</Label>
                <Select value={intensity} onValueChange={setIntensity}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {intensities.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {showDistance && (
                <div className="space-y-1.5">
                  <Label>Distance (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>HR Zone</Label>
                <Select value={hrZone} onValueChange={setHrZone}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {hrZones.map((z) => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showPace && (
                <div className="space-y-1.5">
                  <Label>Pace Range</Label>
                  <Input
                    placeholder="5:00-5:30"
                    value={paceRange}
                    onChange={(e) => setPaceRange(e.target.value)}
                  />
                </div>
              )}
              {showPower && (
                <div className="space-y-1.5">
                  <Label>Power Target (W)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 200"
                    value={powerTarget}
                    onChange={(e) => setPowerTarget(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Terrain</Label>
                <Select value={terrain} onValueChange={setTerrain}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {terrainOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Elevation (m)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={elevationTarget}
                  onChange={(e) => setElevationTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Read-only preview of the AI's easier alternative (swap lives on the card) */}
            {(() => {
              const alt = workoutForVariant(session, variant)?.alternative_workout
              if (!alt) return null
              const metrics: string[] = []
              if (alt.distance_km) metrics.push(`${alt.distance_km} km`)
              if (alt.duration_min) metrics.push(`${alt.duration_min} min`)
              if (alt.pace_range) metrics.push(alt.pace_range)
              if (alt.hr_zone) metrics.push(alt.hr_zone)
              return (
                <div className="border-l-2 border-foreground/25 pl-3 py-1">
                  <p className="text-[10px] italic smallcaps text-muted-foreground">
                    Alternative (easier option)
                  </p>
                  <p className="text-xs text-foreground/80">
                    {alt.type ? `${alt.type.replace(/_/g, ' ')} — ` : ''}
                    {alt.description}
                  </p>
                  {metrics.length > 0 && (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {metrics.join(' · ')}
                    </p>
                  )}
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="intervals" className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Interval sets — used for the Garmin FIT export and shown on the session card.
              </p>
              <Button variant="outline" size="sm" onClick={addInterval}>
                <Plus className="mr-1 h-3 w-3" />
                Add set
              </Button>
            </div>

            {intervals.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No interval sets. AI-generated interval sessions appear here automatically.
              </p>
            )}

            <div className="space-y-2">
              {intervals.map((ivl, i) => (
                <div key={i} className="flex items-start gap-2 border-y border-foreground/15 p-3">
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Reps</Label>
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        value={ivl.reps ?? ''}
                        onChange={(e) =>
                          updateInterval(i, { reps: e.target.value ? parseInt(e.target.value) : undefined })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Distance (m)</Label>
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        value={ivl.distance_m ?? ''}
                        onChange={(e) =>
                          updateInterval(i, { distance_m: e.target.value ? parseInt(e.target.value) : undefined })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Target pace</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="3:45"
                        value={ivl.target_pace ?? ''}
                        onChange={(e) => updateInterval(i, { target_pace: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Recovery</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="90s jog"
                        value={ivl.recovery ?? ''}
                        onChange={(e) => updateInterval(i, { recovery: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5 h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeInterval(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!description || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}