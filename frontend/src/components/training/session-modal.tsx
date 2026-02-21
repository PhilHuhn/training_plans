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
import type { TrainingSession, WorkoutDetails, WorkoutStep } from '@/lib/types'
import { useCreateSession, useUpdateSession } from '@/hooks/use-training'

interface SessionModalProps {
  open: boolean
  onClose: () => void
  session?: TrainingSession
  date: string
}

const workoutTypes = ['easy', 'tempo', 'interval', 'long_run', 'recovery', 'rest', 'cross_training']
const intensities = ['low', 'moderate', 'high']
const hrZones = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5']
const stepTypes: WorkoutStep['step_type'][] = ['warmup', 'active', 'recovery', 'rest', 'cooldown', 'repeat']

const templates: Record<string, Partial<WorkoutDetails>> = {
  easy: { type: 'easy', description: 'Easy run', intensity: 'low', hr_zone: 'zone2' },
  tempo: { type: 'tempo', description: 'Tempo run', intensity: 'moderate', hr_zone: 'zone3' },
  intervals: {
    type: 'interval',
    description: '6x400m intervals with 90s recovery',
    intensity: 'high',
    hr_zone: 'zone4',
    intervals: [{ reps: 6, distance_m: 400, recovery: '90s' }],
  },
  long: { type: 'long_run', description: 'Long run', intensity: 'low', hr_zone: 'zone2' },
}

export default function SessionModal({ open, onClose, session, date }: SessionModalProps) {
  const createSession = useCreateSession()
  const updateSession = useUpdateSession()

  const existing = session?.planned_workout
  const [type, setType] = useState(existing?.type || 'easy')
  const [description, setDescription] = useState(existing?.description || '')
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km?.toString() || '')
  const [durationMin, setDurationMin] = useState(existing?.duration_min?.toString() || '')
  const [intensity, setIntensity] = useState(existing?.intensity || '')
  const [hrZone, setHrZone] = useState(existing?.hr_zone || '')
  const [paceRange, setPaceRange] = useState(existing?.pace_range || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [steps, setSteps] = useState<WorkoutStep[]>(existing?.structured?.steps || [])

  useEffect(() => {
    if (open) {
      const w = session?.planned_workout
      setType(w?.type || 'easy')
      setDescription(w?.description || '')
      setDistanceKm(w?.distance_km?.toString() || '')
      setDurationMin(w?.duration_min?.toString() || '')
      setIntensity(w?.intensity || '')
      setHrZone(w?.hr_zone || '')
      setPaceRange(w?.pace_range || '')
      setNotes(w?.notes || '')
      setSteps(w?.structured?.steps || [])
    }
  }, [open, session])

  const applyTemplate = (key: string) => {
    const t = templates[key]
    if (t) {
      setType(t.type || 'easy')
      setDescription(t.description || '')
      setIntensity(t.intensity || '')
      setHrZone(t.hr_zone || '')
    }
  }

  const addStep = (stepType: WorkoutStep['step_type']) => {
    setSteps([
      ...steps,
      {
        step_type: stepType,
        duration_type: 'open',
        target_type: 'open',
      },
    ])
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, updates: Partial<WorkoutStep>) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const handleSave = () => {
    const workout: WorkoutDetails = {
      type,
      description,
      distance_km: distanceKm ? parseFloat(distanceKm) : undefined,
      duration_min: durationMin ? parseInt(durationMin) : undefined,
      intensity: intensity || undefined,
      hr_zone: hrZone || undefined,
      pace_range: paceRange || undefined,
      notes: notes || undefined,
      structured:
        steps.length > 0
          ? { name: `${type} workout`, steps, sport: 'running' }
          : undefined,
    }

    if (session) {
      updateSession.mutate(
        { id: session.id, data: { planned_workout: workout } },
        { onSuccess: onClose },
      )
    } else {
      createSession.mutate(
        { session_date: date, planned_workout: workout, source: 'manual' },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = createSession.isPending || updateSession.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit' : 'Add'} Workout - {date}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
            <TabsTrigger value="structured" className="flex-1">Structured</TabsTrigger>
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

            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                />
              </div>
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
              <div className="space-y-1.5">
                <Label>Pace Range</Label>
                <Input
                  placeholder="5:00-5:30"
                  value={paceRange}
                  onChange={(e) => setPaceRange(e.target.value)}
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
          </TabsContent>

          <TabsContent value="structured" className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2">
              {stepTypes.map((st) => (
                <Button
                  key={st}
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(st)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {st}
                </Button>
              ))}
            </div>

            {steps.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Add steps to build a structured workout
              </p>
            )}

            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {step.step_type}
                      </Badge>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Step name"
                        value={step.name || ''}
                        onChange={(e) => updateStep(i, { name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={step.duration_type || 'open'}
                        onValueChange={(v) =>
                          updateStep(i, { duration_type: v as WorkoutStep['duration_type'] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="time">Time</SelectItem>
                          <SelectItem value="distance">Distance</SelectItem>
                          <SelectItem value="lap_button">Lap</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        placeholder="Value"
                        value={step.duration_value ?? ''}
                        onChange={(e) =>
                          updateStep(i, {
                            duration_value: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                      />
                      <Select
                        value={step.target_type || 'open'}
                        onValueChange={(v) =>
                          updateStep(i, { target_type: v as WorkoutStep['target_type'] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">No target</SelectItem>
                          <SelectItem value="pace">Pace</SelectItem>
                          <SelectItem value="heart_rate">HR</SelectItem>
                          <SelectItem value="heart_rate_zone">HR Zone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {step.step_type === 'repeat' && (
                      <Input
                        className="h-7 w-24 text-xs"
                        type="number"
                        placeholder="Repeats"
                        value={step.repeat_count ?? ''}
                        onChange={(e) =>
                          updateStep(i, {
                            repeat_count: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(i)}
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
