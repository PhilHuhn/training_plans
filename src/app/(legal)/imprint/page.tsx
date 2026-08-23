import Link from 'next/link'
import type { Metadata } from 'next'
import ObfuscatedEmail from '@/components/legal/obfuscated-email'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Impressum — Club Turbine',
  description: 'Anbieterkennzeichnung nach § 5 DDG.',
}

export default function ImprintPage() {
  const { operator } = site

  return (
    <>
      <div className="smallcaps text-xs italic text-muted-foreground">Rechtliches</div>
      <h1 className="tt-display mt-1 text-4xl font-normal leading-tight">Impressum</h1>
      <p className="mt-2 text-sm italic text-muted-foreground">
        Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
      </p>

      <div className="rule-top mt-8 pt-8">
        <h2 className="text-lg font-normal">Diensteanbieter</h2>
        <address className="mt-3 not-italic leading-relaxed">
          {operator.name}
          <br />
          {operator.street}
          <br />
          {operator.postalCode} {operator.city}
          <br />
          {operator.country}
        </address>
        <p className="mt-3 text-sm italic text-muted-foreground">
          Club Turbine wird als privates, nicht gewerbliches Projekt betrieben. Ein
          Registereintrag, eine Umsatzsteuer-Identifikationsnummer und eine zuständige
          Aufsichtsbehörde bestehen daher nicht.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-normal">Kontakt</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-[9rem_1fr]">
          <dt className="smallcaps text-sm italic text-muted-foreground">E-Mail</dt>
          <dd>
            <ObfuscatedEmail />
          </dd>
          <dt className="smallcaps text-sm italic text-muted-foreground">Kontaktformular</dt>
          <dd>
            <Link href="/contact">Zum Kontaktformular</Link>
          </dd>
        </dl>
        <p className="prose-paper mt-4 text-sm text-muted-foreground">
          Neben der E-Mail-Adresse steht ein Kontaktformular als zweiter, unmittelbarer
          Kommunikationsweg zur Verfügung. Anfragen darüber werden{' '}
          {site.contactResponseTime} beantwortet.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-normal">Verantwortlich für den Inhalt</h2>
        <p className="mt-3 leading-relaxed">
          {operator.name}, Anschrift wie oben.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-normal">Verbraucherstreitbeilegung</h2>
        <p className="prose-paper mt-3">
          Ich bin weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).
        </p>
        <p className="prose-paper mt-3 text-sm text-muted-foreground">
          Ein Hinweis auf die Online-Streitbeilegungsplattform der Europäischen Kommission
          entfällt: Die Plattform wurde zum 20. Juli 2025 eingestellt.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-normal">Haftung für Inhalte und Links</h2>
        <p className="prose-paper mt-3">
          Als Diensteanbieter bin ich nach § 7 Abs. 1 DDG für eigene Inhalte auf diesen
          Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG bin ich
          als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte
          fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
          rechtswidrige Tätigkeit hinweisen.
        </p>
        <p className="prose-paper mt-3">
          Dieses Angebot enthält Verweise auf externe Websites Dritter, auf deren Inhalte
          ich keinen Einfluss habe. Für diese fremden Inhalte kann ich keine Gewähr
          übernehmen; verantwortlich ist stets der jeweilige Anbieter oder Betreiber. Bei
          Bekanntwerden von Rechtsverletzungen werden entsprechende Links umgehend entfernt.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-normal">Urheberrecht</h2>
        <p className="prose-paper mt-3">
          Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
          dem deutschen Urheberrecht. Die von dir hochgeladenen Trainingspläne und die aus
          Strava importierten Aktivitätsdaten bleiben deine Inhalte; sie werden
          ausschließlich zur Erbringung des Dienstes verarbeitet.
        </p>
      </div>

      <p className="mt-12 text-sm italic text-muted-foreground">
        Stand: {new Date(site.lastUpdated).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </>
  )
}
