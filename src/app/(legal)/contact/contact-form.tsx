'use client'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Status = { kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
          website: data.get('website'),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ kind: 'error', message: json.error ?? 'Die Nachricht konnte nicht gesendet werden.' })
        return
      }
      form.reset()
      setStatus({ kind: 'sent' })
    } catch {
      setStatus({
        kind: 'error',
        message: 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.',
      })
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="rule-top rule-bottom mt-8 py-8">
        <p className="smallcaps text-sm italic text-muted-foreground">Nachricht gesendet</p>
        <p className="prose-paper mt-2">
          Danke — deine Nachricht ist angekommen. Eine Antwort geht an die Adresse, die du
          angegeben hast.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setStatus({ kind: 'idle' })}>
          Weitere Nachricht schreiben
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={200} autoComplete="name" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
        <p className="text-xs italic text-muted-foreground">
          Wird ausschließlich verwendet, um dir zu antworten.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Nachricht</Label>
        {/* The Textarea sizes to its content (field-sizing-content), so `rows`
            has no effect — an explicit minimum keeps the empty field inviting. */}
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          className="min-h-48"
        />
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website (bitte frei lassen)</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === 'error' && (
        <p className="border-l-2 border-destructive py-1 pl-3 text-sm text-destructive">
          {status.message}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Wird gesendet…' : 'Nachricht senden'}
        </Button>
        <span className="text-xs italic text-muted-foreground">
          Mit dem Absenden stimmst du der Verarbeitung deiner Angaben zur Beantwortung zu.
        </span>
      </div>
    </form>
  )
}
