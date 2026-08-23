## How to build with Turbine Turmweg

This system deliberately looks like a **typeset LaTeX document**, not a web app:
Computer Modern serif throughout, cream paper, hairline rules, and **square
corners everywhere** (`--radius: 0`). If a screen you build looks like generic
Material or Bootstrap, it is wrong for this system.

### Setup

No global provider is required — every token lives in `styles.css`, so importing
that stylesheet is the whole setup. Two exceptions:

- `Tooltip` must sit inside a `TooltipProvider` (wrap it once, high in the tree).
- `Toaster` must be mounted once in the app shell for toasts to appear.

```jsx
<TooltipProvider>
  <App />
  <Toaster />
</TooltipProvider>
```

### The styling idiom: Tailwind utilities bound to tokens

Style with **Tailwind v4 utility classes**, never hand-written hex values. The
colour utilities resolve to CSS custom properties, so they carry the design
language automatically. The shipped stylesheet generates these families:

| Family | Real class names |
|---|---|
| Surfaces | `bg-background` `bg-card` `bg-popover` `bg-muted` `bg-secondary` `bg-sidebar` |
| Ink | `text-foreground` `text-muted-foreground` `text-primary` `text-destructive` |
| Emphasis | `bg-primary` `text-primary-foreground` · `bg-accent` `text-accent-foreground` · `bg-destructive` `text-destructive-foreground` |
| Rules | `border-border` `border-input` plus `border-t` `border-b` `border-2` |
| Type | `font-serif` `font-mono` · `text-xs` … `text-5xl` |
| Layout | `flex` `grid` `grid-cols-1…12` `gap-*` `p-*` `m-*` `space-y-*` `max-w-*` |

Palette anchors, for recognition rather than for typing by hand: paper
`#FAF8F2`, ink `#0A0A0A`, hyperref blue `#1F3A93` (primary and links), maroon
`#7E1F2E` (accent and destructive).

### The document utilities — use them, they are the house style

| Class | Effect |
|---|---|
| `prose-paper` | justified body text with automatic hyphenation |
| `smallcaps` | small caps with letter-spacing — used for status labels and metadata |
| `rule-top` / `rule-bottom` | 1.5px full-width rules |
| `booktabs-top` / `booktabs-mid` / `booktabs-bottom` | table rules, if you build a table by hand |
| `marginpar` | left-ruled margin note in muted type |

Section numbering is automatic: put `class="tex-numbered"` on a `<main>` and its
`<h2>`/`<h3>` headings are numbered `1.`, `1.1` by CSS counters.

Tables should use the `Table` family rather than raw `<table>` — it already
applies the booktabs convention (thick top and bottom rules, one hairline under
the header, **no row stripes**). Never add zebra striping.

### Where the truth lives

Read `styles.css` and the files it imports before styling anything — that closure
is the entire visual contract. Per-component API and usage live in each
component's `.d.ts` and `.prompt.md`.

### An idiomatic composition

```jsx
<Card className="max-w-md">
  <CardHeader>
    <CardTitle>Intervalle 6 × 1000 m</CardTitle>
    <CardDescription>Dienstag, 24. März — Schwelle</CardDescription>
    <CardAction>
      <Button variant="ghost" size="sm">Bearbeiten</Button>
    </CardAction>
  </CardHeader>
  <CardContent className="prose-paper">
    <p>20 min Einlaufen, danach 6 × 1000 m bei 3:32/km mit je 90 s Trabpause.</p>
  </CardContent>
  <CardFooter className="justify-between">
    <span className="smallcaps text-muted-foreground text-sm">geplant</span>
    <Button size="sm">Als erledigt markieren</Button>
  </CardFooter>
</Card>
```

`Button` carries the variant vocabulary the rest of the system echoes:
`default` `secondary` `outline` `ghost` `link` `destructive`, in sizes
`xs` `sm` `default` `lg` plus the `icon*` squares.
