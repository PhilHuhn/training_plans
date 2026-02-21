import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { Link2, Unlink, RefreshCw, Upload, Save, User as UserIcon, History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'
import { useZoneHistory, useRevertZones } from '@/hooks/use-settings'
import { stravaApi } from '@/api/strava'
import { settingsApi } from '@/api/settings'
import { trainingApi } from '@/api/training'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export default function SettingsPage() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { data: zoneHistory, isLoading: historyLoading } = useZoneHistory(20)
  const revertZones = useRevertZones()

  // Strava OAuth callback detection
  useEffect(() => {
    const stravaParam = searchParams.get('strava')
    if (stravaParam === 'connected') {
      toast.success('Strava connected successfully!')
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    } else if (stravaParam === 'error') {
      const reason = searchParams.get('reason') || 'unknown'
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

  // Zones
  const prefs = user?.preferences || {}
  const [maxHr, setMaxHr] = useState(String(prefs.max_hr || 190))
  const [restingHr, setRestingHr] = useState(String(prefs.resting_hr || 50))
  const [hrZones, setHrZones] = useState<Record<string, { min: number; max: number }>>(
    (prefs.hr_zones as Record<string, { min: number; max: number }>) || {},
  )
  const [paceZones, setPaceZones] = useState<Record<string, { min: number; max: number }>>(
    (prefs.pace_zones as Record<string, { min: number; max: number }>) || {},
  )
  const [ftp, setFtp] = useState(String(prefs.ftp || ''))
  const [cyclingPowerZones, setCyclingPowerZones] = useState<Record<string, { min: number; max: number }>>(
    (prefs.cycling_power_zones as Record<string, { min: number; max: number }>) || {},
  )
  const [zonesLoading, setZonesLoading] = useState(false)

  useEffect(() => {
    if (user?.preferences) {
      const p = user.preferences
      setMaxHr(String(p.max_hr || 190))
      setRestingHr(String(p.resting_hr || 50))
      if (p.hr_zones) setHrZones(p.hr_zones as Record<string, { min: number; max: number }>)
      if (p.pace_zones) setPaceZones(p.pace_zones as Record<string, { min: number; max: number }>)
      setFtp(String(p.ftp || ''))
      if (p.cycling_power_zones) setCyclingPowerZones(p.cycling_power_zones as Record<string, { min: number; max: number }>)
    }
  }, [user])

  const estimateZones = async () => {
    setZonesLoading(true)
    try {
      await settingsApi.applyEstimatedZones()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['zoneHistory'] })
      toast.success('Zones estimated from Strava data')
    } catch {
      toast.error('Failed to estimate zones')
    } finally {
      setZonesLoading(false)
    }
  }

  const saveZones = async () => {
    setZonesLoading(true)
    try {
      await settingsApi.updateZones({
        max_hr: parseInt(maxHr),
        resting_hr: parseInt(restingHr),
        hr_zones: hrZones,
        pace_zones: paceZones,
        ftp: ftp ? parseInt(ftp) : undefined,
        cycling_power_zones: Object.keys(cyclingPowerZones).length > 0 ? cyclingPowerZones : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['zoneHistory'] })
      toast.success('Zones saved')
    } catch {
      toast.error('Failed to save zones')
    } finally {
      setZonesLoading(false)
    }
  }

  // Account
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

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

  // Upload plan
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await trainingApi.uploadPlan(file)
      toast.success(`Parsed ${(res.data as { parsed_sessions_count: number }).parsed_sessions_count} sessions from ${file.name}`)
    } catch {
      toast.error('Failed to upload plan')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const formatPaceZoneValue = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const parsePaceZoneValue = (value: string): number => {
    const parts = value.split(':')
    if (parts.length === 2) {
      const m = parseInt(parts[0]) || 0
      const s = parseInt(parts[1]) || 0
      return m * 60 + s
    }
    return parseInt(value) || 0
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Strava */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Strava Connection</CardTitle>
          <CardDescription>Sync your activities from Strava</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.strava_connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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

      {/* Training Zones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Training Zones</CardTitle>
              <CardDescription>Heart rate and pace zones for training</CardDescription>
            </div>
            {user?.strava_connected && (
              <Button variant="outline" size="sm" onClick={estimateZones} disabled={zonesLoading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${zonesLoading ? 'animate-spin' : ''}`} />
                Estimate from Strava
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* HR params */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max HR</Label>
              <Input type="number" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Resting HR</Label>
              <Input type="number" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </div>
          </div>

          {/* HR Zones */}
          <div>
            <h4 className="mb-2 text-sm font-medium">HR Zones</h4>
            <div className="space-y-2">
              {['zone1', 'zone2', 'zone3', 'zone4', 'zone5'].map((z) => (
                <div key={z} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
                  <Label className="text-xs capitalize">{z}</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Min"
                    value={hrZones[z]?.min || ''}
                    onChange={(e) =>
                      setHrZones({
                        ...hrZones,
                        [z]: { ...hrZones[z], min: parseInt(e.target.value) || 0 },
                      })
                    }
                  />
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Max"
                    value={hrZones[z]?.max || ''}
                    onChange={(e) =>
                      setHrZones({
                        ...hrZones,
                        [z]: { ...hrZones[z], max: parseInt(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Pace Zones */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Pace Zones (min/km)</h4>
            <div className="space-y-2">
              {['zone1', 'zone2', 'zone3', 'zone4', 'zone5'].map((z) => (
                <div key={z} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
                  <Label className="text-xs capitalize">{z}</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Min (m:ss)"
                    value={paceZones[z]?.min ? formatPaceZoneValue(paceZones[z].min) : ''}
                    onChange={(e) =>
                      setPaceZones({
                        ...paceZones,
                        [z]: { ...paceZones[z], min: parsePaceZoneValue(e.target.value) },
                      })
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Max (m:ss)"
                    value={paceZones[z]?.max ? formatPaceZoneValue(paceZones[z].max) : ''}
                    onChange={(e) =>
                      setPaceZones({
                        ...paceZones,
                        [z]: { ...paceZones[z], max: parsePaceZoneValue(e.target.value) },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Cycling Power Zones */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Cycling Power Zones</h4>
            <div className="mb-3 grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="space-y-1.5">
                <Label>FTP (watts)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 250"
                  value={ftp}
                  onChange={(e) => setFtp(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  const ftpVal = parseInt(ftp)
                  if (!ftpVal || ftpVal <= 0) {
                    toast.error('Enter a valid FTP value first')
                    return
                  }
                  setCyclingPowerZones({
                    zone1: { min: 0, max: Math.round(ftpVal * 0.55) },
                    zone2: { min: Math.round(ftpVal * 0.56), max: Math.round(ftpVal * 0.75) },
                    zone3: { min: Math.round(ftpVal * 0.76), max: Math.round(ftpVal * 0.90) },
                    zone4: { min: Math.round(ftpVal * 0.91), max: Math.round(ftpVal * 1.05) },
                    zone5: { min: Math.round(ftpVal * 1.06), max: Math.round(ftpVal * 1.50) },
                  })
                  toast.success('Power zones calculated from FTP')
                }}
              >
                Calculate from FTP
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'zone1', label: 'Z1 Recovery' },
                { key: 'zone2', label: 'Z2 Endurance' },
                { key: 'zone3', label: 'Z3 Tempo' },
                { key: 'zone4', label: 'Z4 Threshold' },
                { key: 'zone5', label: 'Z5 VO2max' },
              ].map(({ key, label }) => (
                <div key={key} className="grid grid-cols-[100px_1fr_1fr] items-center gap-2">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="Min W"
                    value={cyclingPowerZones[key]?.min || ''}
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
                      setCyclingPowerZones({
                        ...cyclingPowerZones,
                        [key]: { ...cyclingPowerZones[key], max: parseInt(e.target.value) || 0 },
                      })
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
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
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

                const sourceColor =
                  entry.source === 'strava_estimate'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : entry.source === 'reverted'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'

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
                    className={`flex items-start justify-between rounded-lg border p-3 ${
                      isLatest ? 'border-primary/30 bg-primary/5' : ''
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

      {/* Upload Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Training Plan</CardTitle>
          <CardDescription>Upload a PDF, Word, or text file with your training plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading && (
              <Badge variant="secondary">
                <Upload className="mr-1 h-3 w-3 animate-pulse" />
                Parsing...
              </Badge>
            )}
          </div>
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
    </div>
  )
}
