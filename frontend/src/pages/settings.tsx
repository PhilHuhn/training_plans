import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { Link2, Unlink, RefreshCw, Upload, Save, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'
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

  // Strava success detection
  useEffect(() => {
    if (searchParams.get('success') === 'strava_connected') {
      toast.success('Strava connected successfully!')
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
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
  const [zonesLoading, setZonesLoading] = useState(false)

  useEffect(() => {
    if (user?.preferences) {
      const p = user.preferences
      setMaxHr(String(p.max_hr || 190))
      setRestingHr(String(p.resting_hr || 50))
      if (p.hr_zones) setHrZones(p.hr_zones as Record<string, { min: number; max: number }>)
      if (p.pace_zones) setPaceZones(p.pace_zones as Record<string, { min: number; max: number }>)
    }
  }, [user])

  const estimateZones = async () => {
    setZonesLoading(true)
    try {
      await settingsApi.applyEstimatedZones()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
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
      })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
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
                  <span className="text-xs text-center text-muted-foreground">
                    {paceZones[z]?.min ? formatPaceZoneValue(paceZones[z].min) : '-'}
                  </span>
                  <span className="text-xs text-center text-muted-foreground">
                    {paceZones[z]?.max ? formatPaceZoneValue(paceZones[z].max) : '-'}
                  </span>
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
