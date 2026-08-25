/**
 * Guided-tour content.
 *
 * Data only, and pure — no React, no DOM, no server imports — so steps can be
 * added or reworded without touching the machinery, and so the registry can be
 * unit-tested (every anchor unique, every route real).
 *
 * A step points at an element carrying `data-tour="<anchor>"`. Anchors that
 * aren't on the page are skipped rather than treated as an error: below the
 * `lg` breakpoint the sidebar lives in a Sheet and its anchors genuinely do not
 * exist, and a spotlight over nothing is worse than a missing step.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right";

/**
 * A precondition the provider resolves against the current user. Kept as a tag
 * rather than a predicate so this module stays free of the User type.
 */
export type TourCondition = "strava-disconnected";

export interface TourStep {
  id: string;
  /** Matches `data-tour="…"` on the element to highlight. */
  anchor: string;
  title: string;
  body: string;
  /** Navigate here before looking for the anchor. */
  route?: string;
  placement?: TourPlacement;
  /** Skip the step unless this holds. */
  when?: TourCondition;
}

export interface TourDefinition {
  id: string;
  label: string;
  steps: TourStep[];
}

export const GETTING_STARTED_TOUR_ID = "getting-started";
export const CLUB_TOUR_ID = "club-coach";

export const TOURS: TourDefinition[] = [
  {
    id: GETTING_STARTED_TOUR_ID,
    label: "Getting started",
    steps: [
      {
        id: "contents",
        anchor: "nav-training",
        route: "/training",
        placement: "right",
        title: "Everything lives in the contents",
        body: "The sidebar is the table of contents: Dashboard for the long view, Training for the week ahead, Activities for what you have actually done. The number beside each one matches the section number in the header.",
      },
      {
        id: "training-week",
        anchor: "training-week",
        route: "/training",
        placement: "top",
        title: "Your week, in two columns",
        body: "What you planned sits beside what the coach suggests. Nothing the AI writes changes your plan until you accept it — the two columns stay separate on purpose.",
      },
      {
        id: "strava",
        anchor: "strava-connect",
        route: "/settings",
        placement: "bottom",
        when: "strava-disconnected",
        title: "Connect Strava when you're ready",
        body: "This is the one thing worth doing early. Completed runs flow in automatically, and the charts and coaching advice are built from them.",
      },
      {
        id: "coach",
        anchor: "chat-toggle",
        placement: "left",
        title: "The coach is always one click away",
        body: "Open the panel from any page and ask about a session, a race, or last week's numbers. It can read your plan and your activities, and it can write suggestions back into the week.",
      },
      {
        id: "club",
        anchor: "nav-club",
        route: "/club",
        placement: "right",
        title: "Clubs run on a join code",
        body: "Start a club and you get a code to hand out; paste someone else's to join theirs. Your training stays as private as you set it — joining never widens what teammates can see.",
      },
      {
        id: "feedback",
        anchor: "feedback",
        placement: "left",
        title: "Tell me what's broken",
        body: "Bugs, missing features, anything confusing. You can see what happened to each one under Settings → Feedback.",
      },
    ],
  },
  {
    id: CLUB_TOUR_ID,
    label: "Coaching a club",
    steps: [
      {
        id: "club-roles",
        anchor: "nav-club",
        route: "/club",
        placement: "right",
        title: "Coaches control the roster",
        body: "As a coach you can change a member's role and how much of their training the rest of the club sees. Everything else about their plan stays theirs.",
      },
    ],
  },
];

export function tourById(id: string): TourDefinition | undefined {
  return TOURS.find((t) => t.id === id);
}
