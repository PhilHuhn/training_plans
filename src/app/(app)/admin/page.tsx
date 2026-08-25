'use client'
import { useMemo, useState } from 'react'
import { ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAdminAddMembership,
  useAdminClubs,
  useAdminRemoveMembership,
  useAdminUpdateMembership,
  useAdminUsers,
  useAiSettings,
  useSetUserAdmin,
  useUpdateAiSettings,
  useUpdateClubAdmin,
} from '@/hooks/use-admin'
import {
  useAdminFeedback,
  useDeleteFeedback,
  useUpdateFeedback,
} from '@/hooks/use-feedback'
import type { AdminUserWire, ClubRole, ClubVisibility, FeedbackStatus } from '@/lib/types'
import { feedbackCategoryLabel } from '@/lib/utils'

const ROLES: ClubRole[] = ['coach', 'captain', 'athlete']
const VISIBILITIES: [ClubVisibility, string][] = [
  ['typ_only', 'Type only'],
  ['full', 'Everything'],
]

const FEEDBACK_STATUSES: [FeedbackStatus, string][] = [
  ['open', 'Open'],
  ['planned', 'Planned'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
  ['declined', "Won't do"],
]

function apiMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

/** Is this query failing because the caller isn't an admin, rather than erroring? */
function isForbidden(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 403
}

const selectClass =
  'border border-foreground/20 bg-transparent px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring'

export default function AdminPage() {
  const users = useAdminUsers()
  const clubs = useAdminClubs()
  const setUserAdmin = useSetUserAdmin()
  const updateClub = useUpdateClubAdmin()
  const updateMembership = useAdminUpdateMembership()
  const addMembership = useAdminAddMembership()
  const removeMembership = useAdminRemoveMembership()
  const aiSettings = useAiSettings()
  const updateAiSettings = useUpdateAiSettings()
  const adminFeedback = useAdminFeedback()
  const updateFeedback = useUpdateFeedback()
  const deleteFeedback = useDeleteFeedback()

  const [addTo, setAddTo] = useState<Record<number, string>>({})

  const clubById = useMemo(
    () => new Map((clubs.data ?? []).map((c) => [c.id, c])),
    [clubs.data],
  )

  if (users.isError || clubs.isError) {
    const forbidden = isForbidden(users.error) || isForbidden(clubs.error)
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
        <h2 className="mb-2 font-serif text-lg">
          {forbidden ? 'Not authorized' : 'Could not load the admin data'}
        </h2>
        <p className="text-sm italic text-muted-foreground">
          {forbidden
            ? 'This page is for platform operators. Your account does not have admin access.'
            : 'Something went wrong fetching users and clubs. Try reloading.'}
        </p>
      </div>
    )
  }

  if (users.isLoading || clubs.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 lg:px-8">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const mutate = <T,>(
    run: (body: T, opts: { onSuccess: () => void; onError: (e: unknown) => void }) => void,
    body: T,
    success: string,
    failure: string,
  ) =>
    run(body, {
      onSuccess: () => toast.success(success),
      onError: (err: unknown) => toast.error(apiMessage(err, failure)),
    })

  const toggleAdmin = (u: AdminUserWire) => {
    if (u.admin_via_env) {
      toast.error('This account is an admin via ADMIN_EMAILS — change the env var instead')
      return
    }
    mutate(
      setUserAdmin.mutate,
      { userId: u.id, isAdmin: !u.is_admin },
      u.is_admin ? `Removed admin from ${u.name}` : `${u.name} is now an admin`,
      'Could not change admin access',
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      {/* AI features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI features
          </CardTitle>
          <CardDescription>
            The coach, plan generation, plan parsing and the Strava profile summary all run on
            the same upstream model. Switching this off stops every one of them from spending
            credit — the rest of the app is unaffected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border border-foreground/20">
              {([true, false] as const).map((value) => (
                <button
                  key={String(value)}
                  onClick={() =>
                    mutate(
                      updateAiSettings.mutate,
                      { enabled: value },
                      value ? 'AI features are on' : 'AI features are off',
                      'Could not change the AI setting',
                    )
                  }
                  disabled={updateAiSettings.isPending}
                  className={
                    aiSettings.data?.enabled === value
                      ? 'bg-foreground px-3 py-1.5 text-xs text-background'
                      : 'px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:text-foreground'
                  }
                >
                  {value ? 'On' : 'Off'}
                </button>
              ))}
            </div>
            <span className="text-xs italic text-muted-foreground">
              {aiSettings.data?.effective
                ? 'Users can use the AI features.'
                : 'Users see the notice below instead.'}
            </span>
          </div>

          {aiSettings.data && !aiSettings.data.api_key_configured && (
            <p className="border-l-2 border-destructive py-1 pl-3 text-sm text-destructive">
              No AI_API_KEY (or ANTHROPIC_API_KEY) is set, so AI is off regardless of this
              switch.
            </p>
          )}

          <div className="booktabs-top border-foreground/15 pt-3 text-xs">
            <span className="smallcaps italic text-muted-foreground">Provider</span>{' '}
            <span className="tabular-nums">{aiSettings.data?.provider_label ?? '—'}</span>
          </div>

          <div className="space-y-1.5">
            <p className="smallcaps text-xs italic text-muted-foreground">
              Model — leave empty for the provider default
              {aiSettings.data ? ` (${aiSettings.data.effective_model})` : ''}
            </p>
            <SavedTextField
              key={aiSettings.data?.model ?? ''}
              value={aiSettings.data?.model ?? ''}
              className="w-full max-w-xl font-mono text-xs"
              placeholder={aiSettings.data?.effective_model ?? ''}
              onSave={(model) =>
                mutate(
                  updateAiSettings.mutate,
                  { model },
                  'Model saved',
                  'Could not save the model',
                )
              }
            />
            <p className="text-xs italic text-muted-foreground">
              {aiSettings.data?.provider === 'openrouter'
                ? 'OpenRouter namespaces its models — e.g. anthropic/claude-sonnet-4.5 or a cheaper slug. Changing this takes effect on the next request; no redeploy.'
                : 'A bare Anthropic model id, e.g. claude-sonnet-5.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="smallcaps text-xs italic text-muted-foreground">
              What users see while it is off
            </p>
            <SavedTextField
              key={aiSettings.data?.notice ?? ''}
              value={aiSettings.data?.notice ?? ''}
              className="w-full max-w-xl"
              onSave={(notice) =>
                mutate(
                  updateAiSettings.mutate,
                  { notice },
                  'Notice saved',
                  'Could not save the notice',
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered users</CardTitle>
          <CardDescription>
            {users.data?.length ?? 0} accounts. Role and visibility changes here bypass the
            coach-only restrictions on the club page.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="booktabs-top booktabs-mid">
                <th className="py-2 text-left smallcaps font-normal">User</th>
                <th className="py-2 text-left smallcaps font-normal">Joined</th>
                <th className="py-2 text-left smallcaps font-normal">Strava</th>
                <th className="py-2 text-left smallcaps font-normal">Clubs</th>
                <th className="py-2 text-left smallcaps font-normal">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id} className="booktabs-mid align-top">
                  <td className="py-2 pr-4">
                    <div>{u.name}</div>
                    <div className="text-xs italic text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs tabular-nums text-muted-foreground">
                    {u.created_at.slice(0, 10)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {u.strava_connected ? 'connected' : '—'}
                  </td>
                  <td className="py-2 pr-4">
                    {u.memberships.length === 0 && (
                      <span className="text-xs italic text-muted-foreground">no clubs</span>
                    )}
                    <div className="space-y-1">
                      {u.memberships.map((m) => (
                        <div key={m.club_id} className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs">{m.club_name}</span>
                          <select
                            className={selectClass}
                            value={m.role}
                            onChange={(e) =>
                              mutate(
                                updateMembership.mutate,
                                {
                                  club_id: m.club_id,
                                  user_id: u.id,
                                  role: e.target.value as ClubRole,
                                },
                                'Role updated',
                                'Could not update the role',
                              )
                            }
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <select
                            className={selectClass}
                            value={m.visibility}
                            onChange={(e) =>
                              mutate(
                                updateMembership.mutate,
                                {
                                  club_id: m.club_id,
                                  user_id: u.id,
                                  visibility: e.target.value as ClubVisibility,
                                },
                                'Visibility updated',
                                'Could not update visibility',
                              )
                            }
                          >
                            {VISIBILITIES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            aria-label={`Remove ${u.name} from ${m.club_name}`}
                            className="text-muted-foreground transition-colors hover:text-accent"
                            onClick={() => {
                              if (!confirm(`Remove ${u.name} from ${m.club_name}?`)) return
                              mutate(
                                removeMembership.mutate,
                                { club_id: m.club_id, user_id: u.id },
                                'Membership removed',
                                'Could not remove the membership',
                              )
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <select
                      className={`${selectClass} mt-1.5`}
                      value={addTo[u.id] ?? ''}
                      onChange={(e) => {
                        const clubId = Number(e.target.value)
                        setAddTo((prev) => ({ ...prev, [u.id]: '' }))
                        if (!clubId) return
                        mutate(
                          addMembership.mutate,
                          { club_id: clubId, user_id: u.id },
                          `Added to ${clubById.get(clubId)?.name ?? 'club'}`,
                          'Could not add to that club',
                        )
                      }}
                    >
                      <option value="">add to club …</option>
                      {clubs.data
                        ?.filter((c) => !u.memberships.some((m) => m.club_id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={setUserAdmin.isPending}
                      className={
                        u.is_admin
                          ? 'border border-foreground bg-foreground px-2 py-0.5 text-xs text-background'
                          : 'border border-foreground/20 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
                      }
                    >
                      {u.is_admin ? (u.admin_via_env ? 'admin (env)' : 'admin') : 'grant'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Clubs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clubs</CardTitle>
          <CardDescription>
            {clubs.data?.length ?? 0} clubs. The paid tier unlocks club theming and the sponsor
            slot.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="booktabs-top booktabs-mid">
                <th className="py-2 text-left smallcaps font-normal">Club</th>
                <th className="py-2 text-left smallcaps font-normal">Members</th>
                <th className="py-2 text-left smallcaps font-normal">Join code</th>
                <th className="py-2 text-left smallcaps font-normal">Tier</th>
                <th className="py-2 text-left smallcaps font-normal">Donation URL</th>
              </tr>
            </thead>
            <tbody>
              {clubs.data?.map((c) => (
                <tr key={c.id} className="booktabs-mid">
                  <td className="py-2 pr-4">
                    <div>{c.name}</div>
                    <div className="text-xs italic text-muted-foreground">/{c.slug}</div>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{c.member_count}</td>
                  <td className="py-2 pr-4">
                    <code className="font-mono text-xs tracking-widest">{c.join_code}</code>
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      className={selectClass}
                      value={c.plan_tier}
                      onChange={(e) =>
                        mutate(
                          updateClub.mutate,
                          { clubId: c.id, plan_tier: e.target.value as 'free' | 'paid' },
                          'Tier updated',
                          'Could not update the tier',
                        )
                      }
                    >
                      <option value="free">free</option>
                      <option value="paid">paid</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <SavedTextField
                      key={c.donation_url ?? ''}
                      value={c.donation_url}
                      placeholder="https://ko-fi.com/…"
                      onSave={(url) =>
                        mutate(
                          updateClub.mutate,
                          { clubId: c.id, donation_url: url || null },
                          'Donation link saved',
                          'Could not save the donation link',
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback</CardTitle>
          <CardDescription>
            {adminFeedback.data?.length ?? 0} submissions. The note you write here is shown to
            the person who sent it, under Settings &rsaquo; Feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {adminFeedback.data?.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No feedback yet.
            </p>
          ) : (
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="booktabs-top booktabs-mid">
                  <th className="py-2 text-left smallcaps font-normal">From</th>
                  <th className="py-2 text-left smallcaps font-normal">Report</th>
                  <th className="py-2 text-left smallcaps font-normal">Status</th>
                  <th className="py-2 text-left smallcaps font-normal">Your reply</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {adminFeedback.data?.map((f) => (
                  <tr key={f.id} className="booktabs-mid align-top">
                    <td className="py-2 pr-4">
                      <div>{f.user_name}</div>
                      <div className="text-xs italic text-muted-foreground">{f.user_email}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {f.created_at.slice(0, 10)}
                      </div>
                    </td>
                    <td className="max-w-md py-2 pr-4">
                      <div className="flex items-baseline gap-2">
                        <span className="smallcaps text-xs italic text-muted-foreground">
                          {feedbackCategoryLabel(f.category)}
                        </span>
                        <span>{f.title}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                        {f.body}
                      </p>
                      {f.page_url && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {f.page_url}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        className={selectClass}
                        value={f.status}
                        onChange={(e) =>
                          mutate(
                            updateFeedback.mutate,
                            { id: f.id, status: e.target.value as FeedbackStatus },
                            'Status updated',
                            'Could not update the status',
                          )
                        }
                      >
                        {FEEDBACK_STATUSES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <SavedTextField
                        key={f.admin_note ?? ''}
                        value={f.admin_note ?? ''}
                        placeholder="Shown to the submitter…"
                        className="w-48"
                        onSave={(admin_note) =>
                          mutate(
                            updateFeedback.mutate,
                            { id: f.id, admin_note },
                            'Reply saved',
                            'Could not save the reply',
                          )
                        }
                      />
                    </td>
                    <td className="py-2">
                      <button
                        aria-label={`Delete feedback from ${f.user_name}`}
                        className="text-muted-foreground transition-colors hover:text-accent"
                        onClick={() => {
                          if (!confirm(`Delete this feedback from ${f.user_name}?`)) return
                          mutate(
                            deleteFeedback.mutate,
                            f.id,
                            'Feedback deleted',
                            'Could not delete the feedback',
                          )
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Inline text editor that only fires a mutation when the value actually
 * changed — a stray focus/blur should not cost a request or a toast.
 *
 * `key` is set to the saved value by callers so the draft resets when the row
 * refetches after a successful save.
 */
function SavedTextField({
  value,
  onSave,
  placeholder,
  className = 'w-52',
}: {
  value: string | null
  onSave: (next: string) => void
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value ?? '')

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className={`${className} border border-foreground/20 bg-transparent px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring`}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={draft === (value ?? '')}
        onClick={() => onSave(draft.trim())}
      >
        Save
      </Button>
    </div>
  )
}
