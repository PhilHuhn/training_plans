'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link2, Unlink, RefreshCw, Save, History, RotateCcw, Zap, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import ClubSettingsCard from '@/components/club/club-settings-card'
import FeedbackForm from '@/components/feedback/feedback-form'
import FeedbackList from '@/components/feedback/feedback-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyClubs } from '@/hooks/use-club'
import { useTour } from '@/components/tour/tour-provider'
import { GETTING_STARTED_TOUR_ID } from '@/lib/tour-steps'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'
import { useZoneHistory, useRevertZones } from '@/hooks/use-settings'
import { stravaApi } from '@/api/strava'
import { settingsApi } from '@/api/settings'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  calculateHrZonesFromMax,
  calculateHrZonesFromThreshold,
  calculatePaceZonesFromThreshold,
} from '@/lib/zone-calc'

/* ── Zone definitions matching Strava ── */
const HR_ZONES = [
  { key: 'zone1', label: 'Z1 Active Recovery' },
  { key: 'zone2', label: 'Z2 Endurance' },
  { key: 'zone3', label: 'Z3 Tempo' },
  { key: 'zone4', label: 'Z4 Threshold' },
  { key: 'zone5', label: 'Z5 Anaerobic' },
]
const HR_ZONE_KEYS = HR_ZONES.map((z) => z.key)

const PACE_ZONES = [
  { key: 'zone1', label: 'Z1 Active Recovery' },
  { key: 'zone2', label: 'Z2 Endurance' },
  { key: 'zone3', label: 'Z3 Tempo' },
  { key: 'zone4', label: 'Z4 Threshold' },
  { key: 'zone5', label: 'Z5 VO2 Max' },
  { key: 'zone6', label: 'Z6 Anaerobic' },
]
const PACE_ZONE_KEYS = PACE_ZONES.map((z) => z.key)

const POWER_ZONES = [
  { key: 'zone1', label: 'Z1 Active Recovery' },
  { key: 'zone2', label: 'Z2 Endurance' },
  { key: 'zone3', label: 'Z3 Tempo' },
  { key: 'zone4', label: 'Z4 Threshold' },
  { key: 'zone5', label: 'Z5 VO2 Max' },
  { key: 'zone6', label: 'Z6 Anaerobic' },
  { key: 'zone7', label: 'Z7 Neuromuscular' },
]
const POWER_ZONE_KEYS = POWER_ZONES.map((z) => z.key)

type ZoneMap = Record<string, { min: number; max: number }>

/* ── Helpers ── */
const fmtPace = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const parsePace = (value: string): number => {
  const parts = value.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0]) || 0
    const s = parseInt(parts[1]) || 0
    return m * 60 + s
  }
  return parseInt(value) || 0
}

/** Update a zone's max and auto-cascade the next zone's min */
function updateIntZoneMax(
  zones: ZoneMap,
  setZones: React.Dispatch<React.SetStateAction<ZoneMap>>,
  keys: string[],
  zoneKey: string,
  newMax: number,
  offset: number, // +1 for HR/power (ascending), 0 for pace (descending values)
) {
  const idx = keys.indexOf(zoneKey)
  const updated = { ...zones, [zoneKey]: { ...zones[zoneKey], max: newMax } }
  if (idx >= 0 && idx < keys.length - 1) {
    const nextKey = keys[idx + 1]
    updated[nextKey] = { ...updated[nextKey], min: newMax + offset }
  }
  setZones(updated)
}

export default function SettingsPage() {
  const { data: user } = useCurrentUser()
  // Plan parsing and the coach both run on Claude, so both follow the switch.
  const { data: memberships } = useMyClubs()
  const hasClub = (memberships?.length ?? 0) > 0
  const [tab, setTab] = useState('account')
  const logout = useLogout()
  const queryClient = useQueryClient()
  const tour = useTour()
  const searchParams = useSearchParams()
  const { data: zoneHistory, isLoading: historyLoading } = useZoneHistory(20)
  const revertZones = useRevertZones()

  // Strava OAuth callback detection
  useEffect(() => {
    const stravaParam = searchParams?.get('strava')
    if (stravaParam === 'connected') {
      toast.success('Strava connected successfully!')
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    } else if (stravaParam === 'error') {
      const reason = searchParams?.get('reason') || 'unknown'
      toast.error(`Strava connection failed: ${reason}`)
    }
  }, [searchParams, queryClient])

  // Strava
  const [stravaLoading, setStravaLoading] = useState(false)

  const connectStrava = async () => {
    setStravaLoading(true)
    try {
      const res = await stravaApi.getAuthUrl()
      window.location.href = res.data.auth_url
    } catch {
      toast.error('Failed to get Strava auth URL')
      setStravaLoading(false)
    }
  }

  const disconnectStrava = async () => {
    try {
      await stravaApi.disconnect()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      toast.success('Strava disconnected')
    } catch {
      toast.error('Failed to disconnect Strava')
    }
  }

  // ── Zone state ──
  const prefs = user?.preferences || {}
  const [maxHr, setMaxHr] = useState(String(prefs.max_hr || 190))
  const [restingHr, setRestingHr] = useState(String(prefs.resting_hr || 50))
  const [thresholdHr, setThresholdHr] = useState(String(prefs.threshold_hr || ''))
  const [hrZones, setHrZones] = useState<ZoneMap>(
    (prefs.hr_zones as ZoneMap) || {},
  )
  const [paceZones, setPaceZones] = useState<ZoneMap>(
    (prefs.pace_zones as ZoneMap) || {},
  )
  const [thresholdPace, setThresholdPace] = useState(
    prefs.threshold_pace ? fmtPace(prefs.threshold_pace) : '',
  )
  // When enabled, "Estimate" pins the manually entered Max/Resting/Threshold HR
  // instead of re-deriving them from activity data.
  const [keepHrAnchors, setKeepHrAnchors] = useState(false)
  const [ftp, setFtp] = useState(String(prefs.ftp || ''))
  const [cyclingPowerZones, setCyclingPowerZones] = useState<ZoneMap>(
    (prefs.cycling_power_zones as ZoneMap) || {},
  )
  const [zonesLoading, setZonesLoading] = useState(false)
  const [hrEstimating, setHrEstimating] = useState(false)
  const [paceEstimating, setPaceEstimating] = useState(false)
  const [powerEstimating, setPowerEstimating] = useState(false)
  // Estimate-quality hints surfaced from the server (e.g. "based on N sustained tempo runs")
  const [hrEstimateHint, setHrEstimateHint] = useState<string | null>(null)
  const [paceEstimateHint, setPaceEstimateHint] = useState<string | null>(null)

  // ── Pace raw text state (fixes input bug) ──
  // We store the raw text the user types; only parse+reformat on blur.
  const [paceRawValues, setPaceRawValues] = useState<Record<string, string>>({})
  const [paceFieldFocused, setPaceFieldFocused] = useState<string | null>(null)

  /** Build initial raw values from numeric pace zones */
  const syncPaceRawFromZones = useCallback((zones: ZoneMap) => {
    const raw: Record<string, string> = {}
    for (const z of PACE_ZONE_KEYS) {
      if (zones[z]?.min) raw[`${z}_min`] = fmtPace(zones[z].min)
      if (zones[z]?.max) raw[`${z}_max`] = fmtPace(zones[z].max)
    }
    setPaceRawValues(raw)
  }, [])

  useEffect(() => {
    if (user?.preferences) {
      const p = user.preferences
      setMaxHr(String(p.max_hr || 190))
      setRestingHr(String(p.resting_hr || 50))
      setThresholdHr(String(p.threshold_hr || ''))
      setThresholdPace(p.threshold_pace ? fmtPace(p.threshold_pace) : '')
      if (p.hr_zones) setHrZones(p.hr_zones as ZoneMap)
      if (p.pace_zones) {
        const pz = p.pace_zones as ZoneMap
        setPaceZones(pz)
        syncPaceRawFromZones(pz)
      }
      setFtp(String(p.ftp || ''))
      if (p.cycling_power_zones) setCyclingPowerZones(p.cycling_power_zones as ZoneMap)
    }
  }, [user, syncPaceRawFromZones])

  /** Commit a pace raw value: parse, update zones, cascade, reformat */
  const commitPaceValue = (zoneKey: string, field: 'min' | 'max') => {
    const rawKey = `${zoneKey}_${field}`
    const raw = paceRawValues[rawKey] || ''
    const seconds = parsePace(raw)

    if (field === 'max') {
      // Update max and cascade next zone's min ("+1" convention: the next,
      // faster zone starts one second below this zone's fast end)
      const idx = PACE_ZONE_KEYS.indexOf(zoneKey)
      const updated = { ...paceZones, [zoneKey]: { ...paceZones[zoneKey], max: seconds } }
      if (idx >= 0 && idx < PACE_ZONE_KEYS.length - 1) {
        const nextKey = PACE_ZONE_KEYS[idx + 1]
        updated[nextKey] = { ...updated[nextKey], min: seconds - 1 }
      }
      setPaceZones(updated)
      // Reformat raw values for affected fields
      const newRaw = { ...paceRawValues, [rawKey]: fmtPace(seconds) }
      if (idx >= 0 && idx < PACE_ZONE_KEYS.length - 1) {
        newRaw[`${PACE_ZONE_KEYS[idx + 1]}_min`] = fmtPace(seconds - 1)
      }
      setPaceRawValues(newRaw)
    } else {
      // min field (only zone1 is editable)
      setPaceZones({ ...paceZones, [zoneKey]: { ...paceZones[zoneKey], min: seconds } })
      setPaceRawValues({ ...paceRawValues, [rawKey]: fmtPace(seconds) })
    }
  }

  // ── Manual calculation from anchor values (no data, no server) ──
  const calcHrZones = () => {
    const max = parseInt(maxHr, 10)
    const rest = parseInt(restingHr, 10)
    const thr = thresholdHr ? parseInt(thresholdHr, 10) : null
    if (!max || !rest || max <= rest) {
      toast.error('Enter valid Max HR and Resting HR first')
      return
    }
    if (thr && (thr >= max || thr <= rest)) {
      toast.error('Threshold HR must be between Resting HR and Max HR')
      return
    }
    setHrZones((thr ? calculateHrZonesFromThreshold(thr, max, rest) : calculateHrZonesFromMax(max, rest)) as ZoneMap)
    setHrEstimateHint(
      thr
        ? 'Calculated from your values · threshold anchored at top of Z4'
        : 'Calculated from your values · Karvonen (HR-reserve) formula',
    )
    toast.success('HR zones calculated from your values')
  }

  const calcPaceZones = () => {
    const tp = parsePace(thresholdPace)
    if (!tp || tp < 100 || tp > 900) {
      toast.error('Enter a valid threshold pace first (e.g. 4:30)')
      return
    }
    setThresholdPace(fmtPace(tp))
    const pz = calculatePaceZonesFromThreshold(tp) as ZoneMap
    setPaceZones(pz)
    syncPaceRawFromZones(pz)
    setPaceEstimateHint('Calculated from your threshold pace')
    toast.success('Pace zones calculated from threshold pace')
  }

  // ── Per-section estimation ──
  const estimateHr = async () => {
    setHrEstimating(true)
    try {
      // Resting HR is never derivable from activity data — always pin the UI
      // value. Max/threshold are pinned only when the user asked to keep them.
      const rest = parseInt(restingHr, 10)
      const max = parseInt(maxHr, 10)
      const thr = thresholdHr ? parseInt(thresholdHr, 10) : null
      const anchors = {
        resting_hr: Number.isFinite(rest) ? rest : null,
        ...(keepHrAnchors && Number.isFinite(max) ? { max_hr: max } : {}),
        ...(keepHrAnchors && thr ? { threshold_hr: thr } : {}),
      }
      const res = await settingsApi.estimateHrZones(90, anchors)
      const d = res.data
      setMaxHr(String(d.max_hr))
      setRestingHr(String(d.resting_hr))
      if (d.threshold_hr) setThresholdHr(String(d.threshold_hr))
      setHrZones(d.hr_zones as ZoneMap)
      const thresholdLabel =
        d.threshold_hr_source === 'manual'
          ? 'your pinned threshold HR'
          : d.threshold_hr_source === 'sustained_efforts'
            ? 'sustained efforts (≥20 min)'
            : 'max-HR fraction'
      const hint = d.threshold_hr
        ? `Based on ${d.activities_analyzed} runs · threshold HR from ${thresholdLabel}${keepHrAnchors ? ' · your base values kept' : ''}`
        : `Based on ${d.activities_analyzed} runs · max HR only (need ≥3 sustained runs for threshold)`
      setHrEstimateHint(hint)
      toast.success(`HR zones estimated from ${d.activities_analyzed} activities`)
    } catch {
      toast.error('Failed to estimate HR zones')
    } finally {
      setHrEstimating(false)
    }
  }

  const estimatePace = async () => {
    setPaceEstimating(true)
    try {
      // Pass current HR anchors so sustained-effort detection uses accurate values
      const rest = parseInt(restingHr, 10)
      const max = parseInt(maxHr, 10)
      const res = await settingsApi.estimatePaceZones(90, {
        resting_hr: Number.isFinite(rest) ? rest : null,
        max_hr: Number.isFinite(max) ? max : null,
      })
      const d = res.data
      setThresholdPace(fmtPace(d.threshold_pace))
      const pz = d.pace_zones as ZoneMap
      setPaceZones(pz)
      syncPaceRawFromZones(pz)
      const sourceLabel =
        d.threshold_pace_source === 'sustained_runs'
          ? `median pace of sustained tempo runs`
          : d.threshold_pace_source === 'riegel'
            ? `Riegel projection from your fastest run`
            : `20th-percentile of all runs (weak fallback — log a tempo or race effort to improve)`
      setPaceEstimateHint(`Based on ${d.activities_analyzed} runs · ${sourceLabel}`)
      toast.success(`Pace zones estimated from ${d.activities_analyzed} activities`)
    } catch {
      toast.error('Failed to estimate pace zones')
    } finally {
      setPaceEstimating(false)
    }
  }

  const estimatePower = async () => {
    setPowerEstimating(true)
    try {
      const res = await settingsApi.estimatePowerZones()
      const d = res.data
      setFtp(String(d.ftp))
      setCyclingPowerZones(d.cycling_power_zones as ZoneMap)
      toast.success(
        d.note
          ? d.note
          : `FTP estimated at ${d.ftp}W from ${d.rides_with_power || 0} rides with power`,
      )
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
            'Failed to estimate power zones')
          : 'Failed to estimate power zones'
      toast.error(msg)
    } finally {
      setPowerEstimating(false)
    }
  }

  const saveZones = async () => {
    setZonesLoading(true)
    try {
      const thrHr = thresholdHr ? parseInt(thresholdHr, 10) : null
      const thrPace = thresholdPace ? parsePace(thresholdPace) : null
      await settingsApi.updateZones({
        max_hr: parseInt(maxHr),
        resting_hr: parseInt(restingHr),
        threshold_hr: Number.isFinite(thrHr) && thrHr ? thrHr : null,
        threshold_pace: thrPace && thrPace > 0 ? thrPace : null,
        hr_zones: hrZones,
        pace_zones: paceZones,
        ftp: ftp ? parseInt(ftp) : undefined,
        cycling_power_zones: Object.keys(cyclingPowerZones).length > 0 ? cyclingPowerZones : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['zoneHistory'] })
      toast.success('Zones saved')
    } catch (err: unknown) {
      // Surface server-side validation errors verbatim
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      toast.error(detail || 'Failed to save zones')
    } finally {
      setZonesLoading(false)
    }
  }

  // Account
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')

  // Coach
  const [coachInstructions, setCoachInstructions] = useState(user?.coach_instructions || '')
  const [athleteProfile, setAthleteProfile] = useState(user?.athlete_profile || '')
  const [coachSaving, setCoachSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setCoachInstructions(user.coach_instructions || '')
      setAthleteProfile(user.athlete_profile || '')
    }
  }, [user])

  const saveCoach = async () => {
    setCoachSaving(true)
    try {
      await settingsApi.updateCoach({
        coach_instructions: coachInstructions || null,
        athlete_profile: athleteProfile || null,
      })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      toast.success('Coach settings saved')
    } catch {
      toast.error('Failed to save coach settings')
    } finally {
      setCoachSaving(false)
    }
  }

  const saveAccount = async () => {
    try {
      await settingsApi.updateAccount({ name, email })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    }
  }

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const changePassword = async () => {
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await settingsApi.changePassword({
        current_password: currentPw,
        new_password: newPw,
        confirm_password: confirmPw,
      })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password changed')
    } catch {
      toast.error('Failed to change password')
    }
  }

  /** Calculate 7 Coggan power zones from FTP */
  const calculatePowerFromFtp = () => {
    const ftpVal = parseInt(ftp)
    if (!ftpVal || ftpVal <= 0) {
      toast.error('Enter a valid FTP value first')
      return
    }
    setCyclingPowerZones({
      zone1: { min: 0, max: Math.round(ftpVal * 0.55) },
      zone2: { min: Math.round(ftpVal * 0.55) + 1, max: Math.round(ftpVal * 0.75) },
      zone3: { min: Math.round(ftpVal * 0.75) + 1, max: Math.round(ftpVal * 0.90) },
      zone4: { min: Math.round(ftpVal * 0.90) + 1, max: Math.round(ftpVal * 1.05) },
      zone5: { min: Math.round(ftpVal * 1.05) + 1, max: Math.round(ftpVal * 1.20) },
      zone6: { min: Math.round(ftpVal * 1.20) + 1, max: Math.round(ftpVal * 1.50) },
      zone7: { min: Math.round(ftpVal * 1.50) + 1, max: Math.round(ftpVal * 2.00) },
    })
    toast.success('Power zones calculated from FTP')
  }

  const stravaConnected = user?.strava_connected

  return (
    <div className="mx-auto max-w-2xl">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
          <TabsTrigger value="training" className="flex-1">Training</TabsTrigger>
          <TabsTrigger value="coach" className="flex-1">Coach</TabsTrigger>
          <TabsTrigger value="club" className="flex-1">Club</TabsTrigger>
          <TabsTrigger value="feedback" className="flex-1">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6 pt-6">
        {/* Strava */}
        <Card data-tour="strava-connect">
          <CardHeader>
            <CardTitle className="text-base">Strava Connection</CardTitle>
            <CardDescription>Sync your activities from Strava</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.strava_connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-none bg-emerald-500" />
                    Connected
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={disconnectStrava}>
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={connectStrava} disabled={stravaLoading}>
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                {stravaLoading ? 'Connecting...' : 'Connect Strava'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={saveAccount}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Update Account
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        {/* Getting started */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finding your way around</CardTitle>
            <CardDescription>
              Re-run the setup steps, or walk through the app again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => tour.start(GETTING_STARTED_TOUR_ID)}>
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              Replay the tour
            </Button>
            <Link
              href="/welcome"
              className="text-sm italic text-muted-foreground hover:text-foreground"
            >
              Re-run setup
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm</Label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={changePassword} disabled={!currentPw || !newPw}>
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card>
          <CardContent className="p-4">
            <Button variant="outline" onClick={logout} className="w-full text-destructive hover:text-destructive">
              Sign Out
            </Button>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6 pt-6">
        {/* ════════════════ Training Zones ════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training Zones</CardTitle>
            <CardDescription>Heart rate, pace and power zones for training</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ── Heart Rate Zones (5) ── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium">Heart Rate Zones</h4>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={calcHrZones}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Calc Zones
                  </Button>
                  {stravaConnected && (
                    <Button variant="outline" size="sm" onClick={estimateHr} disabled={hrEstimating}>
                      <Zap className={`mr-1.5 h-3.5 w-3.5 ${hrEstimating ? 'animate-pulse' : ''}`} />
                      {hrEstimating ? 'Estimating...' : 'Estimate'}
                    </Button>
                  )}
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max HR</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={maxHr}
                    onChange={(e) => setMaxHr(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Resting HR</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={restingHr}
                    onChange={(e) => setRestingHr(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Threshold HR</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="optional"
                    value={thresholdHr}
                    onChange={(e) => setThresholdHr(e.target.value)}
                  />
                </div>
              </div>
              {stravaConnected && (
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-foreground"
                    checked={keepHrAnchors}
                    onChange={(e) => setKeepHrAnchors(e.target.checked)}
                  />
                  Keep my Max/Resting/Threshold when estimating (re-derive zones only)
                </label>
              )}
              {hrEstimateHint && (
                <p className="mb-3 text-xs italic text-muted-foreground">{hrEstimateHint}</p>
              )}
              <div className="space-y-2">
                {HR_ZONES.map(({ key, label }, i) => (
                  <div key={key} className="grid grid-cols-[140px_1fr_1fr] items-center gap-2">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="Min"
                      value={hrZones[key]?.min || ''}
                      disabled={i > 0}
                      onChange={(e) =>
                        setHrZones({
                          ...hrZones,
                          [key]: { ...hrZones[key], min: parseInt(e.target.value) || 0 },
                        })
                      }
                    />
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="Max"
                      value={hrZones[key]?.max || ''}
                      onChange={(e) =>
                        updateIntZoneMax(hrZones, setHrZones, HR_ZONE_KEYS, key, parseInt(e.target.value) || 0, 1)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* ── Pace Zones (6) ── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium">Pace Zones (min/km)</h4>
                {stravaConnected && (
                  <Button variant="outline" size="sm" onClick={estimatePace} disabled={paceEstimating}>
                    <Zap className={`mr-1.5 h-3.5 w-3.5 ${paceEstimating ? 'animate-pulse' : ''}`} />
                    {paceEstimating ? 'Estimating...' : 'Estimate'}
                  </Button>
                )}
              </div>
              <div className="mb-3 grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Threshold Pace (m:ss per km)</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. 4:30"
                    value={thresholdPace}
                    onChange={(e) => setThresholdPace(e.target.value)}
                    onBlur={() => {
                      const tp = parsePace(thresholdPace)
                      if (tp > 0) setThresholdPace(fmtPace(tp))
                    }}
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={calcPaceZones}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Calc Zones
                </Button>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Slower pace = higher number. Z1 is slowest, Z6 is fastest.
              </p>
              {paceEstimateHint && (
                <p className="mb-2 text-xs italic text-muted-foreground">{paceEstimateHint}</p>
              )}
              <div className="space-y-2">
                {PACE_ZONES.map(({ key, label }, i) => {
                  const minRawKey = `${key}_min`
                  const maxRawKey = `${key}_max`
                  return (
                    <div key={key} className="grid grid-cols-[140px_1fr_1fr] items-center gap-2">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Slow (m:ss)"
                        value={
                          paceFieldFocused === minRawKey
                            ? paceRawValues[minRawKey] ?? ''
                            : paceZones[key]?.min
                              ? fmtPace(paceZones[key].min)
                              : ''
                        }
                        disabled={i > 0}
                        onFocus={() => {
                          setPaceFieldFocused(minRawKey)
                          if (paceZones[key]?.min && !paceRawValues[minRawKey]) {
                            setPaceRawValues((prev) => ({ ...prev, [minRawKey]: fmtPace(paceZones[key].min) }))
                          }
                        }}
                        onChange={(e) =>
                          setPaceRawValues((prev) => ({ ...prev, [minRawKey]: e.target.value }))
                        }
                        onBlur={() => {
                          commitPaceValue(key, 'min')
                          setPaceFieldFocused(null)
                        }}
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="Fast (m:ss)"
                        value={
                          paceFieldFocused === maxRawKey
                            ? paceRawValues[maxRawKey] ?? ''
                            : paceZones[key]?.max
                              ? fmtPace(paceZones[key].max)
                              : ''
                        }
                        onFocus={() => {
                          setPaceFieldFocused(maxRawKey)
                          if (paceZones[key]?.max && !paceRawValues[maxRawKey]) {
                            setPaceRawValues((prev) => ({ ...prev, [maxRawKey]: fmtPace(paceZones[key].max) }))
                          }
                        }}
                        onChange={(e) =>
                          setPaceRawValues((prev) => ({ ...prev, [maxRawKey]: e.target.value }))
                        }
                        onBlur={() => {
                          commitPaceValue(key, 'max')
                          setPaceFieldFocused(null)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* ── Cycling Power Zones (7) ── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium">Cycling Power Zones</h4>
                {stravaConnected && (
                  <Button variant="outline" size="sm" onClick={estimatePower} disabled={powerEstimating}>
                    <Zap className={`mr-1.5 h-3.5 w-3.5 ${powerEstimating ? 'animate-pulse' : ''}`} />
                    {powerEstimating ? 'Estimating...' : 'Estimate'}
                  </Button>
                )}
              </div>
              <div className="mb-3 grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">FTP (watts)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="e.g. 250"
                    value={ftp}
                    onChange={(e) => setFtp(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={calculatePowerFromFtp}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Calc Zones
                </Button>
              </div>
              <div className="space-y-2">
                {POWER_ZONES.map(({ key, label }, i) => (
                  <div key={key} className="grid grid-cols-[140px_1fr_1fr] items-center gap-2">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="Min W"
                      value={cyclingPowerZones[key]?.min || ''}
                      disabled={i > 0}
                      onChange={(e) =>
                        setCyclingPowerZones({
                          ...cyclingPowerZones,
                          [key]: { ...cyclingPowerZones[key], min: parseInt(e.target.value) || 0 },
                        })
                      }
                    />
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="Max W"
                      value={cyclingPowerZones[key]?.max || ''}
                      onChange={(e) =>
                        updateIntZoneMax(
                          cyclingPowerZones,
                          setCyclingPowerZones,
                          POWER_ZONE_KEYS,
                          key,
                          parseInt(e.target.value) || 0,
                          1,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button size="sm" onClick={saveZones} disabled={zonesLoading}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Zones
            </Button>
          </CardContent>
        </Card>

        {/* Zone History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Zone History
            </CardTitle>
            <CardDescription>See how your training zones evolved over time</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !zoneHistory || zoneHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No zone history yet. Save or estimate your zones to start tracking changes.
              </p>
            ) : (
              <div className="space-y-2">
                {zoneHistory.map((entry, index) => {
                  const isLatest = index === 0
                  const date = entry.calculated_at
                    ? new Date(entry.calculated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unknown date'

                  const sourceLabel =
                    entry.source === 'strava_estimate'
                      ? 'Strava Estimate'
                      : entry.source === 'reverted'
                        ? 'Reverted'
                        : 'Manual'

                  const sourceColor = 'bg-transparent text-foreground border border-foreground/40 italic smallcaps'

                  // Build compact summary
                  const parts: string[] = []
                  if (entry.max_hr) parts.push(`Max HR: ${entry.max_hr}`)
                  if (entry.hr_zones?.zone1 && entry.hr_zones?.zone5) {
                    parts.push(`HR: ${entry.hr_zones.zone1.min}–${entry.hr_zones.zone5.max}`)
                  }
                  if (entry.threshold_pace) {
                    const mins = Math.floor(entry.threshold_pace / 60)
                    const secs = Math.floor(entry.threshold_pace % 60)
                    parts.push(`Threshold: ${mins}:${String(secs).padStart(2, '0')}/km`)
                  }
                  if (entry.ftp) parts.push(`FTP: ${entry.ftp}W`)

                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start justify-between rounded-none border-y border-foreground/20 p-3 ${
                        isLatest ? 'border-y-2 border-foreground' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{date}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${sourceColor}`}
                          >
                            {sourceLabel}
                          </Badge>
                          {entry.source === 'strava_estimate' && entry.activities_analyzed && (
                            <span className="text-[10px] text-muted-foreground">
                              ({entry.activities_analyzed} activities)
                            </span>
                          )}
                          {isLatest && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {parts.length > 0 ? parts.join(' · ') : 'No zone data'}
                        </p>
                      </div>
                      {!isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-7 shrink-0 text-xs"
                          disabled={revertZones.isPending}
                          onClick={() => {
                            revertZones.mutate(entry.id, {
                              onSuccess: () => {
                                toast.success('Zones reverted successfully')
                              },
                              onError: () => {
                                toast.error('Failed to revert zones')
                              },
                            })
                          }}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Revert
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        </TabsContent>

        <TabsContent value="coach" className="space-y-6 pt-6">
        {/* Coach configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coach</CardTitle>
            <CardDescription>
              Persona and athlete profile for the AI coach (chat panel and Coach page)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Coach Instructions</Label>
              <p className="text-xs text-muted-foreground">
                Defines how your coach communicates and trains you (methodology, tone, what to
                push back on).
              </p>
              <textarea
                className="w-full border border-foreground/20 bg-transparent p-2 font-mono text-xs leading-relaxed outline-none focus:border-foreground/50"
                rows={10}
                value={coachInstructions}
                onChange={(e) => setCoachInstructions(e.target.value)}
                placeholder="Paste your coaching persona / project instructions here…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Athlete Profile</Label>
              <p className="text-xs text-muted-foreground">
                Living document — your coach updates this from chat when new facts emerge
                (injuries, PRs, learnings). Review and edit here.
              </p>
              <textarea
                className="w-full border border-foreground/20 bg-transparent p-2 font-mono text-xs leading-relaxed outline-none focus:border-foreground/50"
                rows={14}
                value={athleteProfile}
                onChange={(e) => setAthleteProfile(e.target.value)}
                placeholder="Paste your athlete profile here…"
              />
            </div>
            <Button size="sm" onClick={saveCoach} disabled={coachSaving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {coachSaving ? 'Saving…' : 'Save Coach Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Runner Profile */}
        {user?.profile_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Runner Profile</CardTitle>
              <CardDescription>AI-generated summary based on your activities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {user.profile_summary}
              </p>
            </CardContent>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="club" className="space-y-6 pt-6">
        {/* Club membership (renders nothing for solo users) */}
        <ClubSettingsCard />
        {!hasClub && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Club</CardTitle>
              <CardDescription>You are not in a club yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Start one or join with a code from the{' '}
                <Link href="/club" className="underline">
                  Club page
                </Link>
                . Membership settings show up here once you are in.
              </p>
            </CardContent>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6 pt-6">
        {/* Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send feedback</CardTitle>
            <CardDescription>
              Found a bug, or missing something? Tell me here — everything is free to use, and
              what people report is what gets built next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your submissions</CardTitle>
            <CardDescription>What happened to everything you have sent.</CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackList />
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
