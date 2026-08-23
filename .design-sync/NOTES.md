# design-sync notes — Turbine Turmweg UI

## What this repo is (and isn't)

This is a **Next.js application**, not a published design-system package:
`private: true`, no `main`/`module`/`exports`/`types`, no `dist/`. The converter's
default path assumes an installed package and **crashes** without help:

- **Always pass `--entry .design-sync/ds-entry.ts`.** Without it the converter
  resolves `PKG_DIR` to `node_modules/turbine-turmweg`, which npm never creates
  for a package inside its own repo → `ENOENT … package.json`.
  `ds-entry.ts` is a barrel that re-exports every `src/components/ui/*` module.
  It lives outside `src/` on purpose so the app's own source stays untouched.
- **`componentSrcMap` is a full enumeration, not a sparse override.** With no
  `.d.ts` tree, `exportedNames()` returns an empty set, and synth-entry
  discovery never runs because `--entry` is supplied. The map is what makes the
  85 components discoverable at all.

**Both files rot when `src/components/ui/` changes.** Regenerate them whenever a
component is added, removed, or renamed — the build will otherwise silently ship
a stale component set.

## The CSS build is a manual pre-step

Tailwind v4 is **not** part of the converter. `cfg.cssEntry` points at a
pre-compiled file that must be rebuilt **before every `package-build.mjs` run**:

```sh
./.ds-sync/node_modules/.bin/tailwindcss \
  -i .design-sync/ds-tailwind.css -o .design-sync/.cache/ds-compiled.css
```

`ds-tailwind.css` imports `src/app/globals.css` (the single source of tokens) and
adds two things the design agent depends on:

- `@source` lines pointing at `src/components/ui` and `.design-sync/previews`.
- A **safelist** (`@source inline(...)`). Tailwind only emits classes it can see,
  and the design agent writes its own layout glue against the shipped stylesheet
  without ever re-running this build. Before the safelist, `bg-accent`,
  `border-border` and `p-6` were simply absent. Do not drop it.

Fonts are wired via `cfg.extraFonts`, **not** through the Tailwind entry:
Tailwind does not rewrite `url()`s relative to the output file, so importing the
font CSS there leaves every `url('./cmunrm.woff')` broken.

## Fonts

Computer Modern is vendored into `.design-sync/fonts/` (8 `.woff` faces, ~1.1 MB)
from `cm-web-fonts` on jsDelivr, so previews and generated designs never depend
on the CDN at render time. The app itself still loads them from the CDN in
`src/app/layout.tsx` — the two are independent on purpose.

`[FONT_MISSING]` for `Latin Modern Roman`, `CMU Serif`, `Charter`,
`CMU Typewriter Text` is **accepted, with Philipp's explicit OK**: those are
fallback aliases behind the primary families we do ship, so the browser never
reaches them. Do not re-raise this as a new warning.

## Known render warns

None. The final run was `bad=0`, `thin=0`, `variantsIdentical=0`. If any warn
appears on a future sync, it is genuinely new — investigate it.

## Preview decisions worth keeping

- **Overlays need `cardMode: "single"` plus a viewport** (Dialog, Sheet,
  SheetHeader, SheetFooter, DropdownMenu, DropdownMenuLabel, Select, Tooltip).
  They render `fixed`/portalled and otherwise escape the card.
- **`Select` open state needs `position="popper"`.** The component's default is
  `item-aligned`, which lays the list over the trigger and clips the first group.
- **`AvatarGroup` needs single-letter fallbacks.** The group overlaps its
  children, so two-letter initials get sliced ("PH" reads as "PF").
- **`Tooltip` needs `open` plus a `TooltipProvider`** to render statically.
- **`Toaster` is deliberately left on the floor card** — sonner renders an empty
  region with no toasts, so there is nothing truthful to show statically.
- **`AlertTitle` / `LongTitle` documents the `line-clamp-1` truncation.** That
  clipped title is the component's real behaviour, not a broken preview.
- Tables use `cardMode: "column"` (Table, TableCaption, TableCell, TableHead) —
  they are wider than a grid cell.

## Environment gotchas (Windows)

- **Stop `http-serve.mjs` before rebuilding.** It holds `ds-bundle/` open and the
  driver fails with `EPERM … rm`. That failure looks like a converter bug; it is
  not.
- **`npm ci` is not usable in this repo on Windows.** `package-lock.json` is
  generated on Linux (for Render's build), and npm resolves optional platform
  packages differently per OS. The faithful-install step was skipped; the
  existing `node_modules` from `npm install` was used instead.
- Local npm is 11.x, the Tailwind CLI staged in `.ds-sync/` resolved to 4.3.3
  while the repo pins `tailwindcss ^4.1.0` (installed: 4.2.4). Output matched, but
  a future minor bump could change the emitted CSS.

## Re-sync risks — what can silently go stale

1. **`ds-entry.ts` and `componentSrcMap`** are snapshots of
   `src/components/ui/`. Neither is derived at build time. Add a component and it
   is invisible to the sync until both are regenerated.
2. **The compiled CSS is not rebuilt by the converter.** Forgetting the Tailwind
   step ships the previous run's stylesheet — including a stale safelist.
3. **The safelist is hand-maintained.** New token families in `globals.css`
   (e.g. a new `--color-*`) will not reach the design agent until they are added
   to `@source inline(...)`.
4. **Vendored fonts were fetched from `@latest`.** They are pinned only by the
   copies in `.design-sync/fonts/`; re-fetching could pull different files.
5. **Only the 19 `ui/` families were scoped.** `src/components/{training,club,
   layout,chat}` are deliberately out — they depend on app state, hooks and
   wire-format types, and would need mock data to preview.
6. 58 of 85 components are on the floor card. That is the deliberate baseline —
   authoring more previews on a later sync is cheap, and existing grades carry
   forward.
