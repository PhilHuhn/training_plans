import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLUB_TOUR_ID, GETTING_STARTED_TOUR_ID, TOURS, tourById } from "../tour-steps";

// Routes the tour may navigate to. Kept in the test rather than the module so
// a step pointing at a page that does not exist fails here loudly.
const REAL_ROUTES = new Set([
  "/dashboard",
  "/training",
  "/activities",
  "/competitions",
  "/coach",
  "/club",
  "/settings",
  "/changelog",
]);

describe("TOURS", () => {
  it("registers more than one tour, so the framework is not single-use", () => {
    expect(TOURS.length).toBeGreaterThan(1);
  });

  it("has unique tour ids", () => {
    const ids = TOURS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every tour at least one step", () => {
    for (const tour of TOURS) expect(tour.steps.length).toBeGreaterThan(0);
  });

  it("keeps step ids unique within a tour", () => {
    for (const tour of TOURS) {
      const ids = tour.steps.map((s) => s.id);
      expect(new Set(ids).size, `duplicate step id in ${tour.id}`).toBe(ids.length);
    }
  });

  it("only navigates to routes that exist", () => {
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        if (step.route) expect(REAL_ROUTES.has(step.route), `${tour.id}/${step.id}`).toBe(true);
      }
    }
  });

  it("keeps anchors unique within a tour, so a step cannot shadow another", () => {
    for (const tour of TOURS) {
      const anchors = tour.steps.map((s) => s.anchor);
      expect(new Set(anchors).size, `duplicate anchor in ${tour.id}`).toBe(anchors.length);
    }
  });

  it("only uses anchors that some component actually renders", () => {
    // Catches both halves of the drift: a step pointing at an anchor nobody
    // renders (the step silently self-skips), and a data-tour attribute left
    // behind after the step referencing it was removed.
    const rendered = new Set(
      execSync(
        'grep -rho \'data-tour="[^"$]*"\' src --include=*.tsx --exclude-dir=__tests__ || true',
      )
        .toString()
        .split("\n")
        .map((line) => line.replace(/^data-tour="|"$/g, "").trim())
        .filter(Boolean),
    );
    // Template-literal anchors (the sidebar builds `nav-${href}`) cannot be
    // grepped, so they are declared here instead.
    for (const href of ["dashboard", "training", "activities", "competitions", "coach", "club", "settings", "changelog", "admin"]) {
      rendered.add(`nav-${href}`);
    }

    const used = new Set(TOURS.flatMap((t) => t.steps.map((s) => s.anchor)));
    for (const anchor of used) {
      expect(rendered.has(anchor), `no component renders data-tour="${anchor}"`).toBe(true);
    }
    for (const anchor of rendered) {
      if (anchor.startsWith("nav-")) continue; // the sidebar renders all of them
      expect(used.has(anchor), `data-tour="${anchor}" is rendered but no step uses it`).toBe(true);
    }
  });

  it("gives every step a title and body", () => {
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        expect(step.title.length, `${tour.id}/${step.id}`).toBeGreaterThan(0);
        expect(step.body.length, `${tour.id}/${step.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("only uses conditions the provider knows how to resolve", () => {
    // The provider maps these tags to user state; an unmapped tag would
    // silently evaluate to "always true".
    const KNOWN = new Set(["strava-disconnected"]);
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        if (step.when) expect(KNOWN.has(step.when), `${tour.id}/${step.id}`).toBe(true);
      }
    }
  });
});

describe("tourById", () => {
  it("finds the exported ids", () => {
    expect(tourById(GETTING_STARTED_TOUR_ID)?.steps.length).toBeGreaterThan(0);
    expect(tourById(CLUB_TOUR_ID)).toBeDefined();
  });

  it("returns undefined for an unknown id rather than throwing", () => {
    expect(tourById("nope")).toBeUndefined();
  });
});
