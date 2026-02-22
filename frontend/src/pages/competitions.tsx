import { useState } from 'react'
import { Plus, MapPin, Calendar, Target, Trash2, Pencil, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import {
  useCompetitions,
  useCreateCompetition,
  useUpdateCompetition,
  useDeleteCompetition,
} from '@/hooks/use-competitions'
import { formatGoalTime, priorityColor } from '@/lib/utils'
import { toast } from 'sonner'
import type { Competition, CompetitionCreate, RaceType, RacePriority } from '@/lib/types'

const raceTypes: RaceType[] = ['5K', '10K', 'HM', 'M', '50K', '100K', '50M', '100M', 'OTHER']
const priorities: RacePriority[] = ['A', 'B', 'C']

function CompetitionModal({
  open,
  onClose,
  competition,
}: {
  open: boolean
  onClose: () => void
  competition?: Competition
}) {
  const create = useCreateCompetition()
  const update = useUpdateCompetition()
  const isEdit = !!competition

  const [name, setName] = useState(competition?.name || '')
  const [raceType, setRaceType] = useState<RaceType>(competition?.race_type || '10K')
  const [raceDate, setRaceDate] = useState(competition?.race_date || '')
  const [priority, setPriority] = useState<RacePriority>(competition?.priority || 'B')
  const [location, setLocation] = useState(competition?.location || '')
  const [goalTimeH, setGoalTimeH] = useState(
    competition?.goal_time ? String(Math.floor(competition.goal_time / 3600)) : '',
  )
  const [goalTimeM, setGoalTimeM] = useState(
    competition?.goal_time ? String(Math.floor((competition.goal_time % 3600) / 60)) : '',
  )
  const [goalTimeS, setGoalTimeS] = useState(
    competition?.goal_time ? String(competition.goal_time % 60) : '',
  )
  const [notes, setNotes] = useState(competition?.notes || '')

  const handleSave = () => {
    const goalTime =
      goalTimeH || goalTimeM || goalTimeS
        ? (parseInt(goalTimeH || '0') * 3600 +
            parseInt(goalTimeM || '0') * 60 +
            parseInt(goalTimeS || '0')) || undefined
        : undefined

    const data: CompetitionCreate = {
      name,
      race_type: raceType,
      race_date: raceDate,
      priority,
      location: location || undefined,
      goal_time: goalTime,
      notes: notes || undefined,
    }

    if (isEdit) {
      update.mutate(
        { id: competition.id, data },
        {
          onSuccess: () => {
            toast.success('Competition updated')
            onClose()
          },
        },
      )
    } else {
      create.mutate(data, {
        onSuccess: () => {
          toast.success('Competition created')
          onClose()
        },
      })
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Add'} Competition</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update competition details.' : 'Add a new race to your calendar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Race name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Race Type</Label>
              <Select value={raceType} onValueChange={(v) => setRaceType(v as RaceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {raceTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as RacePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p} Race {p === 'A' ? '(Main)' : p === 'B' ? '(Important)' : '(Training)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Goal Time</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" min="0" placeholder="H" value={goalTimeH} onChange={(e) => setGoalTimeH(e.target.value)} />
              <Input type="number" min="0" max="59" placeholder="M" value={goalTimeM} onChange={(e) => setGoalTimeM(e.target.value)} />
              <Input type="number" min="0" max="59" placeholder="S" value={goalTimeS} onChange={(e) => setGoalTimeS(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name || !raceDate || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CompetitionsPage() {
  const { data: competitions, isLoading } = useCompetitions()
  const deleteCompetition = useDeleteCompetition()
  const [modal, setModal] = useState<{ open: boolean; competition?: Competition }>({ open: false })

  const handleDelete = (id: number) => {
    deleteCompetition.mutate(id, {
      onSuccess: () => toast.success('Competition deleted'),
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setModal({ open: true })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Competition
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !competitions?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No competitions yet.</p>
            <p className="text-xs text-muted-foreground">Add your upcoming races to get tailored training plans.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {competitions.map((comp) => (
            <Card key={comp.id} className="shadow-brutal-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{comp.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {comp.race_type}
                    </Badge>
                  </div>
                  <Badge variant="outline" className={priorityColor(comp.priority)}>
                    {comp.priority} Race
                  </Badge>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(comp.race_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {comp.days_until !== undefined && comp.days_until >= 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {comp.days_until}d
                      </Badge>
                    )}
                  </div>
                  {comp.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{comp.location}</span>
                    </div>
                  )}
                  {comp.goal_time && (
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5" />
                      <span>Goal: {formatGoalTime(comp.goal_time)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setModal({ open: true, competition: comp })}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(comp.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompetitionModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        competition={modal.competition}
      />
    </div>
  )
}
