import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from './contact-form'
import ObfuscatedEmail from '@/components/legal/obfuscated-email'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Kontakt — Turbine Turmweg',
  description: 'Nachricht an den Betreiber von Turbine Turmweg.',
}

export default function ContactPage() {
  return (
    <>
      <div className="smallcaps text-xs italic text-muted-foreground">Kontakt</div>
      <h1 className="tt-display mt-1 text-4xl font-normal leading-tight">Schreib mir</h1>
      <p className="prose-paper mt-4 max-w-xl text-muted-foreground">
        Fragen zum Dienst, Fehlermeldungen oder Anliegen zum Datenschutz — dieses Formular
        erreicht mich direkt. Antworten kommen {site.contactResponseTime}.
      </p>

      <ContactForm />

      <div className="rule-top mt-12 pt-6">
        <p className="text-sm text-muted-foreground">
          Lieber direkt per E-Mail? <ObfuscatedEmail /> — die Postanschrift steht im{' '}
          <Link href="/imprint">Impressum</Link>.
        </p>
      </div>
    </>
  )
}
