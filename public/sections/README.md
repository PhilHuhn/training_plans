# Section photography

Drop a photo in here and it appears behind that section's header. Nothing else
to change — the filenames below are fixed by `src/lib/section-imagery.ts`.

| File | Section |
|---|---|
| `dashboard.jpg` | Dashboard |
| `training.jpg` | Training |
| `activities.jpg` | Activities |
| `competitions.jpg` | Competitions |
| `coach.jpg` | Coach |
| `club.jpg` | Club |
| `settings.jpg` | Settings |

**A missing file is not an error.** The header renders exactly as it does today
until the photo exists, so these can be added one at a time, in any order.

## What works here

The header strip is very wide and very short — roughly 1400×64 on a desktop —
and the photo is drawn at about 32% opacity, cleared out across the left-hand
sixth so the section title stays crisp.

- **Contrast is what matters, not brightness.** Tested both ways: a pale photo
  on the app's cream paper (`#FAF8F2`) disappears completely, while a mid-tone
  or darker image with a clear shape — a ridge line, a treeline, a horizon —
  reads immediately. If in doubt, pick the one with the stronger silhouette.
- **Wide and calm.** Landscape crops with a strong horizontal line. Anything
  busy turns to mush at this size.
- **~1600×400 or wider**, JPEG, under ~200 KB. It is a texture, not a picture;
  resolution beyond this is wasted bytes on every page load.
- **Off-centre subjects are fine** — adjust `position` in `section-imagery.ts`
  (a CSS `object-position`) to move the crop.
- **Too strong or too faint?** Set `opacity` on that entry in
  `section-imagery.ts` (0–1, default 0.32). No component changes needed.

## Licensing

These files are committed to the repository and served publicly, so use images
you have the right to distribute — your own photographs, or a licence that
permits redistribution. Record the source in this file when you add one.
