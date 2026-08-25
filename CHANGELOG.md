# Changelog

What changed in Club Turbine, in plain language.

Entries are written by hand for the people using the app — they are not generated
from git. The version at the top of this file is the app's version: releasing and
writing the note here are the same act, so the number in the sidebar always has
something behind it. See `npm run release`.

## [1.2.0] — 2026-08-25
### Added
- The training-load chart now carries on for the next seven days, projected from the
  sessions on your calendar — so you can see what the week you have planned does to your
  form before you run it. The projected stretch is shaded and drawn with a finer line: it
  assumes you train the plan as written, so it is a forecast, not a measurement.
- Races you add on the Competitions page now show up on the training calendar on their
  date, in both the grid and the list.
- Races also appear on the dashboard chart as diamonds, filled for an A-race. A-races get
  a vertical line as well, so your goal races read as landmarks on the curve.

## [1.1.0] — 2026-08-25

### Added
- Import a training plan straight from the Training page. The **Import Plan** button sits
  next to **AI Plan**, takes a PDF, Word, text or Markdown file, and you can drop the file
  onto it rather than hunting through a file picker.
- Watch your plan being read. The import now shows what it is doing — reading the document,
  working out the shape of the plan, listing sessions as it finds them, saving them to your
  calendar — instead of a spinner that could sit there for minutes with nothing to say.

### Changed
- Your calendar fills in the moment an import finishes. It used to need a page reload before
  the new sessions appeared.
- Importing a plan is noticeably quicker, most visibly on long plans.
- A plan with no dates of its own now starts from the block you are looking at, and the
  import window says which date that is before you commit to it.
- This page. It now lists releases in plain language rather than a running list of code
  changes.

### Removed
- The **Import .ics** and **Export .ics** buttons have gone from the Training toolbar. They
  were rarely used and crowded out the controls that are.

## [1.0.0] — 2026-08-25

### Added
- A welcome page after signing up, which offers to connect Strava there and then — the step
  people were most likely to miss and then wonder why the app looked empty.
- A guided tour that points out where things live and what to do first.
- The running version now shows in the bottom-left corner, linking here.

### Changed
- When the AI coach is unavailable, the app now says why — out of credit, rate-limited,
  temporarily down — instead of failing quietly.

## [0.5.0] — 2026-08-24

### Added
- Join a club with a code.
- A feedback box, so you can tell us what is wrong without leaving the app.

### Changed
- Charts now use one consistent colour per sport across the whole app.

## [0.4.0] — 2026-08-23

### Added
- Imprint, privacy policy and a contact form.

### Changed
- A new look across the app, modelled on a printed training manual.
- The app is now called **Club Turbine** throughout.

## [0.3.0] — 2026-08-22

### Added
- A landing page explaining what the app is for.

### Changed
- The interface is now in English throughout. Some screens had German left in them.

## [0.2.0] — 2026-08-21

### Added
- Club overlay: see how your week lines up with the rest of the club.
- The AI coach, as a chat panel and its own page.
- Import and export your plan as a calendar file.
