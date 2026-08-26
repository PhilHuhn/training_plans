/**
 * Optional photography behind each section header.
 *
 * The registry maps a route to a file the operator drops into
 * `public/sections/`. Nothing here ships an image: a section with no file
 * simply renders the header exactly as it did before, so the app is never
 * waiting on assets to look right.
 *
 * Pure — no React, no fs — so the mapping and the fallback behaviour are
 * testable, and adding a section is a data change rather than a component one.
 */

export interface SectionImage {
  /** Path under /public. */
  src: string;
  /**
   * Describes the photo for someone who cannot see it. Deliberately required:
   * a decorative-only image would take `alt=""`, but these carry a section's
   * sense of place, and an empty alt is a decision worth making explicitly.
   */
  alt: string;
  /**
   * CSS object-position. Header strips are extremely wide and short, so the
   * interesting part of a photo is rarely the centre — this is what stops a
   * runner's head being cropped out of every banner.
   */
  position?: string;
  /**
   * How strongly the photo shows through, 0–1. Defaults to 0.32, which reads on
   * the cream paper without fighting the heading. Turn it down for a dark or
   * busy image rather than editing the component.
   */
  opacity?: number;
}

/**
 * Route → image. Keys are exact pathnames, matching how sectionFor() resolves.
 *
 * Filenames are fixed by this table rather than derived, so dropping a file in
 * with the wrong name fails visibly (no image) instead of silently matching the
 * wrong section.
 */
export const SECTION_IMAGES: Record<string, SectionImage> = Object.assign(Object.create(null), {
  "/dashboard": {
    src: "/sections/dashboard.jpg",
    alt: "Early-morning road stretching into open country",
    position: "center 60%",
  },
  "/training": {
    src: "/sections/training.jpg",
    alt: "A track marked out in lanes, seen along the straight",
    position: "center 55%",
  },
  "/activities": {
    src: "/sections/activities.jpg",
    alt: "Running shoes mid-stride on wet tarmac",
    position: "center 50%",
  },
  "/competitions": {
    src: "/sections/competitions.jpg",
    alt: "A race start line crowded with runners",
    position: "center 45%",
  },
  "/coach": {
    src: "/sections/coach.jpg",
    alt: "A notebook and stopwatch on a bench beside a track",
    position: "center 50%",
  },
  "/club": {
    src: "/sections/club.jpg",
    alt: "A group of runners setting off together",
    position: "center 45%",
  },
  "/settings": {
    src: "/sections/settings.jpg",
    alt: "Neatly arranged running kit laid out on a table",
    position: "center 50%",
  },
});

/**
 * The image for a route, or null when that section has none.
 *
 * Null is the normal case until files exist, and the caller renders nothing —
 * so a missing photo costs a plain header, never a broken one.
 *
 * The null-prototype map above and the hasOwnProperty check here are the same
 * guard @/server/services/strava-return uses, for the same reason: a plain
 * object literal answers `map["constructor"]` with a function, so a lookup that
 * should have missed returns something truthy instead.
 */
export function sectionImageFor(pathname: string): SectionImage | null {
  return Object.prototype.hasOwnProperty.call(SECTION_IMAGES, pathname)
    ? SECTION_IMAGES[pathname]
    : null;
}
