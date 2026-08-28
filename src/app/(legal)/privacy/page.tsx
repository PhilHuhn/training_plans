import Link from 'next/link'
import type { Metadata } from 'next'
import ObfuscatedEmail from '@/components/legal/obfuscated-email'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — Club Turbine',
  description: 'Wie Club Turbine personenbezogene Daten verarbeitet.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-normal">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const { operator } = site

  return (
    <>
      <div className="smallcaps text-xs italic text-muted-foreground">Rechtliches</div>
      <h1 className="tt-display mt-1 text-4xl font-normal leading-tight">Datenschutzerklärung</h1>
      <p className="mt-2 text-sm italic text-muted-foreground">
        Informationen nach Art. 13 und 14 DSGVO
      </p>

      <div className="rule-top rule-bottom mt-8 py-6">
        <p className="prose-paper">
          Club Turbine verarbeitet deine Trainingsdaten — darunter{' '}
          <strong>Herzfrequenzwerte, also Gesundheitsdaten</strong> im Sinne von Art. 9
          DSGVO. Diese Verarbeitung findet ausschließlich auf Grundlage deiner
          ausdrücklichen Einwilligung statt, die du jederzeit widerrufen kannst. Ohne
          Strava-Verbindung werden keine Gesundheitsdaten verarbeitet.
        </p>
      </div>

      <Section title="Verantwortlicher">
        <address className="not-italic leading-relaxed">
          {operator.name}
          <br />
          {operator.street}
          <br />
          {operator.postalCode} {operator.city}
          <br />
          {operator.country}
        </address>
        <p>
          E-Mail: <ObfuscatedEmail /> · <Link href="/contact">Kontaktformular</Link>
        </p>
        <p className="text-sm text-muted-foreground">
          Ein Datenschutzbeauftragter ist nicht benannt; die Voraussetzungen des § 38 BDSG
          liegen nicht vor.
        </p>
      </Section>

      <Section title="Kontodaten">
        <p className="prose-paper">
          Bei der Registrierung werden Name, E-Mail-Adresse und ein Passwort erhoben. Das
          Passwort wird ausschließlich als bcrypt-Hash gespeichert und ist mir nicht im
          Klartext zugänglich.
        </p>
        <p className="prose-paper">
          <strong>Zweck:</strong> Bereitstellung des Nutzerkontos.{' '}
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
          Nutzungsvertrags).
        </p>
      </Section>

      <Section title="Trainingsdaten und hochgeladene Pläne">
        <p className="prose-paper">
          Von dir angelegte oder hochgeladene Trainingspläne, einzelne Einheiten, Notizen,
          Wettkämpfe, Zielzeiten und Trainingszonen werden gespeichert, um den Dienst zu
          erbringen. Hochgeladene PDF-, Word- oder Markdown-Dateien werden in Text
          umgewandelt und zur Strukturierung an die Claude-API übermittelt (siehe Ziffer 6).
        </p>
        <p className="prose-paper">
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Section>

      <Section title="Strava-Verbindung und Gesundheitsdaten">
        <p className="prose-paper">
          Wenn du dein Strava-Konto verbindest, werden über die Strava-API Aktivitäten
          abgerufen: Datum, Sportart, Distanz, Dauer, Höhenmeter, Kalorien, Pace sowie{' '}
          <strong>durchschnittliche und maximale Herzfrequenz</strong> und Runden-Daten
          einzelner Intervalle. Aus diesen Werten werden Trainingsbelastung und
          Trainingszonen berechnet.
        </p>
        <p className="prose-paper">
          Herzfrequenzwerte sind Gesundheitsdaten nach Art. 4 Nr. 15 DSGVO.{' '}
          <strong>Rechtsgrundlage:</strong> Art. 9 Abs. 2 lit. a DSGVO — deine ausdrückliche
          Einwilligung, die du mit der Autorisierung bei Strava erteilst. Du kannst die
          Verbindung in den Einstellungen jederzeit trennen; damit widerrufst du die
          Einwilligung mit Wirkung für die Zukunft.
        </p>
        <p className="prose-paper">
          Strava ist ein eigenständig Verantwortlicher mit Sitz in den USA. Für dessen
          Verarbeitung gilt die Datenschutzerklärung von Strava.
        </p>
      </Section>

      <Section title="KI-Coach und Trainingsempfehlungen">
        <p className="prose-paper">
          Für Chat-Antworten, Trainingsempfehlungen und die Auswertung hochgeladener Pläne
          werden die dafür nötigen Daten an ein Sprachmodell übermittelt: dein Trainingsprofil,
          aktuelle Belastungswerte, Zonen, anstehende Wettkämpfe sowie der Inhalt deiner
          Chat-Nachrichten. Darin können Gesundheitsdaten enthalten sein. Die Übermittlung
          erfolgt über OpenRouter, Inc., die die Anfrage an den jeweiligen Modellanbieter
          (derzeit Anthropic PBC) weiterleitet.
        </p>
        <p className="prose-paper">
          Die Empfehlungen sind Vorschläge. Sie ersetzen keine medizinische oder
          trainingswissenschaftliche Beratung, und es findet keine automatisierte
          Entscheidung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO statt — jede
          Änderung an deinem Plan wird erst wirksam, wenn du sie annimmst.
        </p>
      </Section>

      <Section title="Auftragsverarbeiter und Drittlandübermittlung">
        <p className="prose-paper">
          Folgende Dienstleister verarbeiten personenbezogene Daten in meinem Auftrag. Mit
          ihnen bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO; die
          Übermittlung in die USA wird auf Standardvertragsklauseln nach Art. 46 Abs. 2
          lit. c DSGVO gestützt.
        </p>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="smallcaps text-sm italic text-muted-foreground">
              Render Services, Inc. — Hosting und Datenbank
            </dt>
            <dd className="prose-paper text-sm">
              Betrieb der Anwendung und der PostgreSQL-Datenbank. Die Server stehen in
              Frankfurt am Main; das Unternehmen hat seinen Sitz in den USA.
            </dd>
          </div>
          <div>
            <dt className="smallcaps text-sm italic text-muted-foreground">
              OpenRouter, Inc. — Vermittlung der Modellanfragen
            </dt>
            <dd className="prose-paper text-sm">
              Leitet die unter Ziffer 5 genannten Daten an den jeweils eingestellten
              Modellanbieter weiter. Sitz in den USA.
            </dd>
          </div>
          <div>
            <dt className="smallcaps text-sm italic text-muted-foreground">
              Anthropic PBC — Sprachmodell
            </dt>
            <dd className="prose-paper text-sm">
              Verarbeitung der unter Ziffer 5 genannten Daten zur Erzeugung von Antworten
              und Empfehlungen. Sitz in den USA.
            </dd>
          </div>
          <div>
            <dt className="smallcaps text-sm italic text-muted-foreground">
              jsDelivr (Content Delivery Network) — Schriftarten
            </dt>
            <dd className="prose-paper text-sm">
              Die verwendeten Computer-Modern-Schriftarten werden derzeit beim Seitenaufruf
              vom CDN jsDelivr nachgeladen. Dabei wird deine IP-Adresse an dessen Server
              übermittelt. Eine Umstellung auf lokale Auslieferung, mit der dieser Aufruf
              vollständig entfällt, ist vorbereitet.
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Spendenlink (Ko-fi)">
        <p className="prose-paper">
          An mehreren Stellen findest du einen Link auf mein Profil beim Spendendienst
          Ko-fi (ko-fi.com). Es handelt sich um einen gewöhnlichen Verweis, nicht um ein
          eingebettetes Widget: Solange du ihn nicht anklickst, wird kein Skript von Ko-fi
          geladen, es werden keine Cookies gesetzt und es werden keine Daten dorthin
          übermittelt.
        </p>
        <p className="prose-paper">
          Erst wenn du dem Link folgst, verlässt du diese Seite und rufst Ko-fi auf; dabei
          wird — wie bei jedem Seitenaufruf — deine IP-Adresse an dessen Server übermittelt.
          Für die weitere Verarbeitung ist der Betreiber von Ko-fi eigenständig
          verantwortlich; es gilt dessen Datenschutzerklärung. Eine Spende ist freiwillig
          und für die Nutzung von Club Turbine zu keinem Zeitpunkt erforderlich.
        </p>
      </Section>

      <Section title="Server-Logs und Cookies">
        <p className="prose-paper">
          Beim Aufruf der Seiten fallen technische Zugriffsdaten an (IP-Adresse, Zeitpunkt,
          aufgerufene Ressource, Statuscode). Sie dienen dem sicheren Betrieb.{' '}
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO.
        </p>
        <p className="prose-paper">
          Es wird ein einziges Cookie gesetzt: <code>access_token</code>, ein
          HttpOnly-Cookie mit deiner Anmelde-Sitzung, gültig für sieben Tage. Es ist für den
          Betrieb des Dienstes unbedingt erforderlich und daher nach § 25 Abs. 2 Nr. 2
          TDDDG einwilligungsfrei. Tracking- oder Analyse-Cookies werden nicht eingesetzt.
        </p>
      </Section>

      <Section title="Kontaktformular">
        <p className="prose-paper">
          Über das <Link href="/contact">Kontaktformular</Link> übermittelte Angaben — Name,
          E-Mail-Adresse und Nachrichtentext — werden per E-Mail zugestellt und zur
          Bearbeitung deiner Anfrage verwendet. <strong>Rechtsgrundlage:</strong> Art. 6
          Abs. 1 lit. f DSGVO, bei vertragsbezogenen Anfragen Art. 6 Abs. 1 lit. b DSGVO.
          Die Nachrichten werden gelöscht, sobald die Anfrage abschließend bearbeitet ist.
        </p>
      </Section>

      <Section title="Speicherdauer">
        <p className="prose-paper">
          Konto-, Trainings- und Aktivitätsdaten werden gespeichert, solange dein Konto
          besteht. Nach einer Löschanfrage werden sie unverzüglich entfernt; Sicherungen
          werden innerhalb von 30 Tagen überschrieben. Trennst du nur die
          Strava-Verbindung, werden keine neuen Aktivitäten mehr abgerufen; bereits
          importierte Aktivitäten kannst du einzeln oder mit dem Konto löschen.
        </p>
      </Section>

      <Section title="Deine Rechte">
        <p className="prose-paper">
          Dir stehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
          (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
          (Art. 20) und Widerspruch (Art. 21 DSGVO) zu. Eine erteilte Einwilligung kannst du
          jederzeit mit Wirkung für die Zukunft widerrufen, ohne dass die Rechtmäßigkeit der
          bis dahin erfolgten Verarbeitung berührt wird.
        </p>
        <p className="prose-paper">
          Für alle Anliegen genügt eine Nachricht an <ObfuscatedEmail /> oder über das{' '}
          <Link href="/contact">Kontaktformular</Link>.
        </p>
        <p className="prose-paper">
          Du hast außerdem das Recht, dich bei einer Aufsichtsbehörde zu beschweren.
          Zuständig ist der Hamburgische Beauftragte für Datenschutz und
          Informationsfreiheit, Ludwig-Erhard-Straße 22, 20459 Hamburg.
        </p>
      </Section>

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
