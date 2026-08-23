import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Columns3,
  FileText,
  MessageCircle,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

// TODO(monetization): the app is free for everyone right now. Donations and
// Steady accounts are planned — when they land, replace the "Free to use"
// section below with the real pricing/supporter copy and wire up the links.

const FEATURES = [
  {
    icon: Columns3,
    title: "Three-column training view",
    body:
      "The uploaded plan, the AI recommendation, and the workout you accepted sit side by side. Nothing is overwritten — you can always read back what the original block asked for.",
  },
  {
    icon: FileText,
    title: "Bring the plan you already have",
    body:
      "PDF, Word, Markdown or .ics goes in; .ics comes back out, so the week lands in the calendar you already use.",
  },
  {
    icon: Zap,
    title: "Strava sync",
    body:
      "Runs, rides, swims and full lap data flow in automatically. A 6 × 1000 m session arrives split by repetition, not flattened into one average.",
  },
  {
    icon: MessageCircle,
    title: "A coach that edits the plan",
    body:
      "It knows your zones, accumulated load and upcoming races, and it changes the plan rather than describing a change you then have to make yourself.",
  },
  {
    icon: Trophy,
    title: "Races and zones",
    body:
      "A, B and C races with goal times and countdowns. Zones derive from your own Strava history, with the full change history kept.",
  },
  {
    icon: Users,
    title: "Club overlay",
    body:
      "Finds the sessions your week already shares with teammates — Tuesday intervals, Sunday long run — without bending anyone's training to fit.",
  },
];

const REQUIREMENTS = [
  {
    title: "A Strava account",
    body: "Connected once. History from the past year is read on first sync.",
  },
  {
    title: "Your current plan",
    body:
      "PDF, Word, Markdown or .ics — or nothing, and let the coach draft the first block.",
  },
  {
    title: "One goal race",
    body: "With a date. Zones, load targets and the taper are derived from it.",
  },
];

// Illustrative figures from a sample marathon build. The strip is labelled as a
// sample so a visitor never mistakes it for their own data.
const SAMPLE_WEEK = [
  { label: "Threshold", value: "3:32/km" },
  { label: "Longest run", value: "32.2 km" },
  { label: "Week volume", value: "84 km" },
  { label: "Load", value: "412" },
];

export default async function LandingPage() {
  const jar = await cookies();
  if (jar.get("access_token")) {
    redirect("/training");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Masthead */}
      <div className="frosted sticky top-0 z-30 flex items-center justify-between border-b border-foreground/15 px-6 py-3.5 lg:px-11">
        <div className="flex items-baseline gap-2.5">
          <span className="tt-title text-[19px]">Turbine Turmweg</span>
          <span className="smallcaps hidden text-xs italic text-muted-foreground sm:inline">
            manual, ed. 2026
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="smallcaps hidden text-[13px] italic text-foreground no-underline hover:underline sm:inline"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="smallcaps hidden text-[13px] italic text-foreground no-underline hover:underline sm:inline"
          >
            Pricing
          </a>
          <Link
            href="/login"
            className="bg-foreground px-4 py-2 text-sm text-background no-underline transition-opacity hover:opacity-85 hover:no-underline"
          >
            Open the app
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="surface-band relative overflow-hidden px-6 pb-16 pt-20 lg:px-11 lg:pb-[72px] lg:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(120% 80% at 78% 8%, color-mix(in srgb, var(--primary) 14%, transparent) 0%, transparent 58%), radial-gradient(90% 70% at 8% 96%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-[2] mx-auto max-w-5xl">
          <div className="smallcaps flex items-center gap-2.5 text-sm italic text-muted-foreground">
            <span className="inline-block h-px w-8 bg-current" />
            A training plan companion
          </div>
          <h1 className="tt-display mt-4 max-w-[22ch] text-5xl font-normal leading-[1.02] lg:text-[76px]">
            Keep the plan you have.{" "}
            <span className="italic text-primary">Train the week you&rsquo;re in.</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-[1.5] text-muted-foreground lg:text-xl">
            Three versions of every week — uploaded plan, coach recommendation, and what
            you actually accepted — held side by side. Nothing is overwritten.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link
              href="/register"
              className="bg-foreground px-7 py-3.5 text-base text-background no-underline transition-opacity hover:opacity-85 hover:no-underline"
            >
              Start with your own plan
            </Link>
            <Link
              href="/login"
              className="border border-foreground bg-background/60 px-7 py-3.5 text-base text-foreground no-underline transition-colors hover:border-primary hover:text-primary hover:no-underline"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-14 border-b border-foreground/20 border-t-[1.5px] border-t-foreground py-4">
            <div className="smallcaps mb-3 text-[11px] italic text-muted-foreground">
              A sample marathon week
            </div>
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {SAMPLE_WEEK.map(({ label, value }) => (
                <div key={label}>
                  <dt className="smallcaps text-xs italic text-muted-foreground">{label}</dt>
                  <dd className="tt-display tabular-nums text-[28px]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Abstract */}
      <div className="px-6 lg:px-11">
        <div className="rule-top rule-bottom mx-auto max-w-3xl px-6 py-6 lg:px-10">
          <div className="smallcaps mb-2.5 text-center text-[13px] italic text-muted-foreground">
            Abstract
          </div>
          <p className="prose-paper m-0 text-base leading-[1.6]">
            Turbine Turmweg reads the plan you already train from, syncs what you actually
            ran, and lets a coach that knows your zones edit the week in place. It is a
            document, not a dashboard: every session keeps its history, every change is
            legible, and the whole season exports back to the calendar you started with.
          </p>
        </div>
      </div>

      {/* What it does */}
      <div id="features" className="scroll-mt-20 px-6 pt-16 lg:px-11 lg:pt-[72px]">
        <div className="mx-auto max-w-4xl">
          <div className="mb-9 flex items-baseline justify-between border-b border-foreground/20 pb-3">
            <h2 className="tt-display m-0 text-[30px] font-normal">What it does</h2>
            <span className="smallcaps text-[13px] italic text-muted-foreground">six parts</span>
          </div>

          <div className="hairline-grid grid md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="surface-tile px-7 py-6">
                <div className="flex items-baseline gap-3">
                  <span className="tabular-nums text-[13px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="tt-title flex items-center gap-2.5 text-[19px]">
                    <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {title}
                  </span>
                </div>
                <p className="prose-paper mt-2.5 text-sm leading-[1.6] text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coach log pull-quote */}
      <div className="surface-band relative mt-20 overflow-hidden px-6 py-[72px] lg:px-11">
        <div className="relative z-[2] mx-auto max-w-3xl text-center">
          <div className="smallcaps text-[13px] italic text-muted-foreground">
            From the coach log
          </div>
          <p className="tt-title mt-4 text-2xl italic leading-[1.4] lg:text-[28px]">
            &ldquo;Your threshold has drifted from 3:41 to 3:32/km over six weeks. I left
            Sunday at 32.2 km but moved the surges into the second half.&rdquo;
          </p>
          <div className="mt-4 text-sm italic text-muted-foreground">
            edited the plan directly — 2 sessions changed, both revisions kept
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="scroll-mt-20 px-6 lg:px-11">
        <div className="mx-auto grid max-w-4xl items-start gap-10 border-b border-foreground/20 border-t-[3px] border-t-foreground py-8 md:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="tt-display text-[30px]">Free to use</div>
            <div className="smallcaps mt-1.5 text-[13px] italic text-muted-foreground">
              no tiers · no per-athlete pricing
            </div>
          </div>
          <p className="prose-paper m-0 text-[15px] leading-[1.65] text-muted-foreground">
            Turbine Turmweg is run by the Turmweg club for its own members and anyone else
            who wants it. There is no subscription and no plan tier. You pay for your own
            AI usage if you lean on the coach heavily; everything else costs nothing.
          </p>
        </div>
      </div>

      {/* What you need */}
      <div className="px-6 pt-14 lg:px-11">
        <div className="mx-auto max-w-4xl">
          <div className="smallcaps mb-4 text-[15px] italic">What you need to get started</div>
          <div className="hairline-grid grid md:grid-cols-3">
            {REQUIREMENTS.map(({ title, body }, i) => (
              <div key={title} className="bg-background px-6 py-5">
                <div className="tabular-nums text-[13px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-1.5 text-[17px]">{title}</div>
                <p className="prose-paper mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Closing call to action */}
      <div className="surface-invert mt-[72px] px-6 py-16 lg:px-11">
        <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="tt-display text-3xl leading-[1.15] lg:text-[38px]">
              Next week is already written.
            </div>
            <div className="mt-2 text-base italic opacity-70">
              Upload it, sync Strava, and let the coach take it from there.
            </div>
          </div>
          <Link
            href="/register"
            className="whitespace-nowrap bg-background px-7 py-3.5 text-base text-foreground no-underline transition-opacity hover:opacity-85 hover:no-underline"
          >
            Create an account
          </Link>
        </div>
      </div>

      {/* Colophon */}
      <div className="px-6 pb-10 pt-6 lg:px-11">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 text-[13px] italic text-muted-foreground sm:flex-row sm:justify-between">
          <span>Turbine Turmweg — Hamburg, 2026</span>
          <span className="flex flex-wrap gap-4">
            <Link href="/login">Sign in</Link>
            <Link href="/imprint">Impressum</Link>
            <Link href="/privacy">Datenschutz</Link>
            <Link href="/contact">Kontakt</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
