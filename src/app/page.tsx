import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  Calendar,
  FileUp,
  MessageCircle,
  Trophy,
  Users,
  Watch,
  Zap,
} from "lucide-react";

// TODO(monetization): the app is free for everyone right now. Donations and
// Steady accounts are planned — when they land, replace the "Free to use"
// section below with the real pricing/supporter copy and wire up the links.

const SECTIONS = [
  {
    icon: Calendar,
    title: "Three-column training view",
    body:
      "Your uploaded plan, the AI recommendation, and the workout you finally accepted — side by side, week by week. Nothing is overwritten: you always see where a session came from.",
  },
  {
    icon: FileUp,
    title: "Bring the plan you already have",
    body:
      "Drop in a PDF, Word, or Markdown plan and it is read into structured sessions. Or import an .ics calendar. Export back out as .ics whenever you want your plan somewhere else.",
  },
  {
    icon: Zap,
    title: "Strava sync",
    body:
      "Connect Strava once and your runs, rides, swims, and lap data flow in automatically — so planned and actual training sit next to each other instead of in two apps.",
  },
  {
    icon: MessageCircle,
    title: "An AI coach that can edit the plan",
    body:
      "Turbi knows your zones, your recent training load, and your upcoming races. Ask for a lighter week or a different long run, and it changes the plan instead of just describing what it would do.",
  },
  {
    icon: Trophy,
    title: "Races and zones",
    body:
      "Track A/B/C races with goal times and a countdown. Derive heart-rate, pace, and cycling-power zones from your own Strava history, with the full history of every change kept.",
  },
  {
    icon: Users,
    title: "Club overlay",
    body:
      "If you train with a club, the overlay finds the sessions your week already shares with your teammates — and marks the rest as parallel. It never bends anyone's session to fit someone else's. You choose how much your teammates see.",
  },
  {
    icon: Watch,
    title: "Onto your watch",
    body:
      "Structured workouts export as Garmin .fit files, so the session you planned is the session your watch counts down.",
  },
];

export default async function LandingPage() {
  const jar = await cookies();
  if (jar.get("access_token")) {
    redirect("/training");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        {/* Title block (mimics LaTeX \title / \author / \date) */}
        <header className="text-center">
          <Zap className="mx-auto mb-6 h-7 w-7" aria-hidden />
          <div className="text-xs italic smallcaps text-muted-foreground">Manual</div>
          <h1 className="mt-1 text-4xl leading-tight tracking-tight font-serif">
            Turbine&nbsp;Turmweg
          </h1>
          <p className="mt-2 text-sm italic text-muted-foreground">
            A training plan companion — from 5K to ultramarathons
          </p>
        </header>

        {/* Abstract */}
        <section className="mt-12 border-y border-foreground/30 py-6">
          <div className="mb-2 text-center text-xs italic smallcaps text-muted-foreground">
            Abstract
          </div>
          <p className="prose-paper text-[0.95rem]">
            Turbine Turmweg keeps one running plan in one place. It reads the plan you
            already have, pulls your finished sessions in from Strava, and lets an AI
            coach that knows your zones and your race calendar suggest what the next week
            should look like. You accept, edit, or ignore every suggestion — the plan
            stays yours. Sessions export to your Garmin watch or to any calendar, and if
            you train with a club, it will show you which sessions your week already
            shares with your teammates.
          </p>
        </section>

        {/* Call to action */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="border border-foreground bg-foreground px-5 py-2 text-sm text-background no-underline transition-opacity hover:opacity-85 hover:no-underline"
          >
            Create a free account
          </Link>
          <Link
            href="/login"
            className="border border-foreground/30 px-5 py-2 text-sm text-foreground no-underline transition-colors hover:border-primary hover:text-primary hover:no-underline"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-center text-xs italic text-muted-foreground">
          Free to use. No credit card, no trial timer.
        </p>

        {/* What it does */}
        <section className="mt-16">
          <div className="mb-6 text-xs italic smallcaps text-muted-foreground">
            Contents
          </div>
          <ol className="space-y-8">
            {SECTIONS.map((section, idx) => {
              const Icon = section.icon;
              return (
                <li key={section.title} className="flex gap-4">
                  <div className="w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">
                    {idx + 1}.
                  </div>
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-semibold leading-snug">
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {section.title}
                    </h2>
                    <p className="prose-paper mt-1 text-[0.92rem] text-foreground/85">
                      {section.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Pricing — see the monetization TODO at the top of this file. */}
        <section className="mt-16 border-t-2 border-b border-foreground/40 py-6">
          <h2 className="text-base font-semibold">Free to use</h2>
          <p className="prose-paper mt-1 text-[0.92rem] text-foreground/85">
            Every feature described above is free, for everyone, with no usage limits and
            nothing held back behind a paid tier. Donations and supporter accounts are
            planned for later so the project can cover its own hosting and AI costs —
            until then there is nothing to pay and nothing to cancel.
          </p>
        </section>

        {/* What you need */}
        <section className="mt-10">
          <h2 className="text-base font-semibold">What you need to get started</h2>
          <ul className="mt-2 space-y-1 text-[0.92rem] text-foreground/85">
            <li>— An email address and a password. That is the whole sign-up.</li>
            <li>— Optionally, a Strava account to sync your finished sessions.</li>
            <li>— Optionally, a plan file (PDF, Word, Markdown, or .ics) to import.</li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-foreground/20 pt-4 text-center text-xs italic text-muted-foreground">
          Turbine Turmweg ·{" "}
          <Link href="/login" className="hover:underline">
            Sign in
          </Link>{" "}
          ·{" "}
          <Link href="/register" className="hover:underline">
            Create account
          </Link>
        </footer>
      </main>
    </div>
  );
}
