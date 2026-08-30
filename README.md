# Shibb — a pseudolocalization plugin for Figma

# Overview
Find localization bugs before sending copy to vendors or engineering. Shibb
generates realistic pseudolocalized content, automatically detects layout
failures, protects placeholders and other non-localizable content, simulates
RTL and multilingual edge cases, and helps designers catch internationalization
issues before they hit your bottom line.

# Features
- 📦 Finds hidden Auto Layout issues
- ✏️ Checks inferred containers to catch text-nesting errors
- 🌍 Realistic multilingual pseudolocalization — not just Latin with accents
- 🔒 Recognizes and ignores placeholders, dates, IDs, and other non-localizable content
- 📏 Applies IBM's dynamic text expansion rules based on visual length, not character count
- 📐 Checks for collisions between lines
- 🔤 Script-aware dynamic Noto assignment & missing script check
- 🎯 Deterministic pseudoLOC output persists across runs
- 📋 Summary report describes each issue, with an exportable summary
- ↔️ RTL (Arabic & Hebrew) option
- 🈳 True edge-case stress testing via CJK, Thai, & Vietnamese charsets
- 🌓 Automatically matches Figma's light/dark theme
- 📍 Review panel avoids covering the exact issue it's describing

## Details

- Shibb replaces each string in your selection with **visually-similar
  homoglyphs** (Greek, Cyrillic, and accented Latin look-alikes — e.g. Latin
  `O` → Greek `Ο`/`Ω` or Cyrillic `О`), then pads these with a mix of Thai,
  Cyrillic, CJK, and Vietnamese (multi-diacritic-stack) characters to hit a
  target expansion length. Expansion is banded by source string length,
  calibrated against IBM's "Guidelines to design global solutions" table (as
  reproduced by [W3C i18n](https://www.w3.org/International/articles/article-text-size.en.html)):
  short strings (≤10 chars) get +200%, tapering down to +30% for strings
  over 70 characters. Targets are computed on **grapheme count**
  (`Intl.Segmenter`, with a plain-character-count fallback if that API isn't
  available in a given Figma app version), not raw string length, so
  combining marks don't inflate the sizing math.
- Pseudolocalized text is wrapped in `[ ]` — a standard pseudoloc convention
  that makes clipped or truncated brackets easy to spot visually.
- **Output is deterministic per node.** The same text layer, run again with
  unchanged source text, produces the same pseudolocalized string and the
  same overflow verdict every time — seeded per node (from its ID and
  current text), not randomized per run.
- Optional **RTL toggle**: mixes Arabic and Hebrew word-chunks (including
  Arabic-Indic digits and combining harakat/niqqud) into the padding,
  roughly one word in three, so strings end up with embedded RTL runs
  rather than a segregated block — closer to how real bidi bugs show up in
  mixed-language product copy. A genuine strong-RTL character leads the
  line when this is on, so the paragraph's actual reading direction flips,
  with the bracket and source text rendering as an embedded LTR island
  inside it — similar to how real RTL-locale UI often looks.
- Optional **vertical edge-case characters** toggle: draws more heavily from
  pre-assembled multi-mark sequences (a Thai consonant with a vowel *and*
  tone mark stacked together, Vietnamese letters with two combining marks
  at once, Arabic consonant+shadda gemination when RTL is also on) rather
  than isolated marks scattered through ordinary padding. Recommended for
  Thai, Vietnamese, and Arabic — Google's Material Design "Tall" script
  tier also includes Hindi (Devanagari) and Telugu, which aren't in this
  plugin's character set or font-assignment logic yet. Hebrew, despite
  having niqqud, is classified "English-like" by Google, not "Tall" — it's
  in the RTL toggle for bidi testing, not vertical stress.
- **Per-script font assignment**: Thai, Arabic, Hebrew, and CJK characters
  each get their own Noto family (`Noto Sans Thai/Arabic/Hebrew/JP`) rather
  than falling back to core Noto Sans, which only covers Latin, Greek, and
  Cyrillic. A failed font load for a given family falls back to Noto Sans
  for that run and is logged as an error with a direct link to install it.
- **Overflow detection measures against the original typeface**, not Noto
  Sans, for fixed-size text nodes (`textAutoResize: NONE`) — the plugin
  temporarily auto-resizes the node in its original font to measure real
  overflow, then restores the original box exactly (size and position).
- **Auto-layout / "hug" text nodes** get a complementary check: growth is
  flagged when it escapes an ancestor with `clipsContent: true` further up
  the tree.
- **Implied-container detection** catches two patterns neither of the above
  checks can see: (1) a decorative shape drawn as a "text field" with the
  actual text sitting on top as an unrelated, unclipped sibling layer, and
  (2) a direct parent frame with a deliberate, explicit size that isn't set
  to clip (e.g. a plain frame, or an auto-layout frame with at least one
  axis not set to hug). Both infer containment geometrically rather than
  structurally, and both are labeled "(inferred)" in the issue message,
  which also suggests enabling `Clip content` or confirming the text is
  meant to be unconstrained.
- A sized-but-non-clipping frame is a mixed bag depending on context — a
  real risk for ordinary translatable content, but a reasonable pattern for
  system-chrome mockups ("Status Bar," "Time," "Battery," "Connections,"
  the standard layer names from official iOS/Android device-mockup kits)
  representing OS-rendered elements no translator ever touches. **The
  plugin already skips locked layers**, so the simplest way to exclude
  status-bar chrome from testing is to lock those layers in your source
  file — no naming convention or exceptions list required.
- **Non-localizable content is protected**, not just interpolation
  placeholders. `{{name}}`, `${username}`, `{count}`, `%s`/`%d`/`%1$s`,
  dates (ISO 8601, numeric, and month-name formats), times, GUIDs/UUIDs,
  URLs, email addresses, currency and percent values, plain numbers, and
  hex color codes all pass through untouched — only the surrounding prose
  gets pseudolocalized. If a whole line is *nothing but* one of these (a
  layer that's just a date, just an email address, just a placeholder) the
  entire node is skipped rather than bracket-wrapped and padded around
  content that was never meant to carry translatable text. **Deliberately
  not covered**: brand names and proper nouns. That's a vocabulary
  judgment, not a structural pattern — it needs a maintained glossary, not
  a regex, and isn't implemented here.
- **A node that's already pseudolocalized and unchanged since gets
  skipped**, rather than pseudolocalized again — re-running the plugin
  doesn't compound bracket-wraps on top of previous runs. Detected by
  comparing a node's current text against the exact output the plugin last
  wrote to it (stored via `setPluginData`), not just a boolean flag — so
  editing or reverting the source text after a prior run is recognized as
  new content and processed normally, rather than skipped by mistake. Its
  count shows in the Summary as its own plain stat, separate from the
  other skip reasons — there's nothing to act on here, so it doesn't get a
  chevron, a review panel, or per-item explanatory text the way locked/
  hidden, empty, and excluded skips do.
- **Style preservation**: font size, letter spacing, and (if explicitly
  set) line height are captured from the original typeface and reapplied
  to the Noto replacement, so it approximates the source typeface's
  density rather than defaulting to Noto's own spacing.
- Locked and hidden text layers are skipped automatically, as are empty
  text layers and the non-localizable/already-pseudolocalized cases above
  — all counted together in the Summary as "Excluded / empty layers
  skipped," with the specific reason shown per layer when you expand that
  row.
- **Locking checks the whole ancestor chain, not just the layer itself.**
  Confirmed directly from Figma's own docs: a node's `locked` property is
  independent of its parent's — a text layer can report `locked: false`
  even while sitting inside a locked frame, and Figma's lock doesn't stop
  a plugin from writing to it either way (it only blocks *user*
  interaction on canvas). Found via real testing: a locked "Keyboard"
  frame whose "Emoji" and "Dictation" keys were individually unlocked
  still got pseudolocalized, because only the node's own flag was being
  checked. Every ancestor up to the page is now checked, so locking a
  parent frame protects everything under it, matching what locking a
  frame actually implies to a person using Figma — even though Figma's
  own API doesn't enforce that assumption on its own.

## How it runs

Two commands, both invoked from the Figma plugin menu:

- **Run** executes immediately against the current selection — no panel,
  no button, no checkboxes to set first. It reports back via a compact
  native toast: "Issues: 3, Skipped: 1, Errors: 2" (each segment only
  appears if its count is above zero), or "No issues found" if the design's
  clean. If there's anything worth reviewing, the toast includes a
  **Details** button that opens the full Summary on demand.
- **Settings** opens a separate small panel. Three toggles at the top —
  Include RTL edge cases, Include vertical glyph edge cases, Always show
  Summary report — followed by Done/Cancel, then a **Support** section at
  the bottom with a link to file feedback or feature requests. Changes
  autosave immediately — no Save button — and persist across every file
  you open on this machine (via `figma.clientStorage`, scoped per-user and
  not synced across machines). Turning "Always show Summary report" on
  skips the toast entirely and opens the Summary on every run, even a
  clean one.

## The Summary

The post-run Summary displays:
1. LOC issues found
2. Locked/hidden layers skipped
3. Excluded/empty layers skipped
4. Already pseudolocalized (a plain count only — nothing to review, since
   there's nothing to act on)
5. Errors, such as missing typefaces

**One reviewer covers every category combined**, not four separate ones.
LOC issues, locked/hidden skips, excluded/empty skips, and errors are
concatenated into a single paged sequence — issues first, then errors,
then skips, the same priority order the panel always used to decide what
to show first — and paged through via one `<`/`>` pair and one "N of M"
counter, fixed in the same place regardless of which category is current.
This replaced an earlier version where each row expanded its own
independent reviewer, which put the counter and buttons inside whichever
category happened to be open — but a single shared counter that just sat
generically at the top, disconnected from any row, turned out to have the
opposite problem: nothing visually tied "item 15 of 44" to the specific
category it actually belonged to. The fix keeps the nav bar fixed (still
solving the original "buttons shouldn't move" problem) but physically
relocates the content itself — node name and messages — via JS to sit
directly after whichever category row is current, sharing that row's
lighter background so the two read as one nested unit rather than two
disconnected pieces of UI. Category rows stay the standard background
otherwise; only the current one lightens, together with its content.
Clicking a row with findings jumps the shared cursor to wherever that
category starts in the combined sequence.

The `<`/`>` buttons sit in a fixed header, separate from the relocating
content below them, so they never shift position as you page through
items of different lengths or different categories — which is what
actually makes them reliable for fast click-through review. Both wrap
around at the ends — `>` on the last item goes to the first, `<` on the
first goes to the last — matching how left/right arrow key navigation
already behaves.

Clicking through jumps the canvas selection and viewport to the relevant
layer, and the panel checks whether its own on-screen position now
overlaps that layer — if so, it nudges itself to whichever nearby position
(up/down/left/right) requires the least movement while staying fully
visible, or leaves itself alone if no such position exists. Candidate
positions are sized by the actual overlap between panel and node, not the
node's full dimensions — a real, reported bug: a node much wider than the
panel (a 699px-wide flagged layer against a 320px panel) made "push past
the entire node" jump far more than necessary and commonly land outside
the visible viewport, when clearing just the actual overlap (capped at the
panel's own width/height, regardless of how large the node is) is always
sufficient. **Known limitation**: Figma's `figma.ui.reposition()` stops
having any effect once the panel has been manually dragged by the user —
a Plugin API limitation, not something fixable from plugin code. It's
possible `getPosition()` also returns stale coordinates after a manual
drag, which would affect this independently of the fix above — unconfirmed,
since it can't be tested without live Figma access.

Info icons next to "LOC issues found" and "Errors" show a definition on
hover or keyboard focus (Material 3 plain-tooltip pattern — no click
needed, and the tooltip clamps itself to stay within the panel rather than
running off the edge).

An **Export Summary** link (tertiary style, matching Settings' Cancel —
not a bordered button) appears whenever any row has findings, including
"Already pseudolocalized," and generates a downloadable `.txt` file
listing everything from the Summary: every LOC issue, every locked/hidden
and excluded/empty skip, every error, and the already-pseudolocalized
count, each in plain language with a direct resource link where relevant
(e.g. a font's install page).

The Summary follows Figma's own light/dark theme automatically, via
`figma.showUI`'s `themeColors` option and Figma's `.figma-dark` class on
`<html>` — it updates live if the user switches theme mid-session, no
reload needed. Review-panel messages use one neutral color regardless of
condition type (horizontal/vertical overflow, line collision) — orange,
blue, and magenta used to differentiate these, but that made color the
only thing telling two stacked messages apart whenever their wording was
similar, which isn't accessible for colorblindness and isn't what color
should be used for. Messages are numbered instead when a layer has more
than one. Error messages keep a distinct red — that's a severity signal,
a legitimate use of color, not an enumeration one. None of this touches
how flagged text looks *on the canvas* — the contrast-optimized fill
color and the magenta line-collision stroke are a separate system, for
spotting issues while scanning a design rather than while reading the
Summary, and weren't part of this change.

## Deliberately out of scope (by design)

- **Full sentence-level RTL** isn't implemented — the RTL toggle embeds
  Arabic/Hebrew word-chunks within otherwise-LTR strings. Testing a fully
  mirrored RTL layout (icon flipping, alignment reversal, direction-aware
  components) is a different, larger test surface than what this plugin
  covers.
- **Whole-page / whole-file scanning has no dedicated feature.** `Ctrl+A`
  (or `Cmd+A`) on a page selects everything at the top level, and the
  plugin's collector recurses into every child of whatever's selected —
  frames, groups, sections, component instances — so a page-wide run needs
  no new code, just that keyboard shortcut before running. No whole-*file*
  (multi-page) option is offered by design.

## Files

Standard three-file Figma plugin structure: `manifest.json`, `code.js`
(main thread logic), and `ui.html` (the panel UI, loaded via manifest's
`"ui"` field into an iframe — Figma's documented "easiest way" to use
`figma.showUI()`).

- `manifest.json` — plugin config, including the two-command menu (`Run`
  and `Settings...`)
- `code.js` — main thread logic (runs in Figma's plugin sandbox)
- `ui.html` — the plugin UI panel, rendering either the Settings view or
  the Summary depending on which command launched it

**A single-file version was tried and reverted.** `ui.html`'s entire
contents were briefly embedded directly into `code.js` as a template
literal string, passed straight to `figma.showUI()` — an approach Figma's
own docs confirm is supported, intended to reduce the plugin to two files
total. In practice this caused the panel to load with a blank body: the
native title bar rendered, but the injected content didn't, with a
console error (`Failed to execute 'write' on 'Document': Invalid or
unexpected token`, inside Figma's `data:text/html;base64` loading path for
raw-string UIs specifically). The exact mechanism wasn't confirmed —
diagnosing it further would need live debugging access this project
doesn't have — but the failure was reproducible and specific to the
raw-string approach, so it was reverted back to the standard three-file,
separate-`ui.html` structure, which had been working reliably throughout
the rest of this project.

## Easy tuning points

- `expansionRatio()` in `code.js` — the five IBM-calibrated expansion bands
- `HOMOGLYPHS` — which look-alike characters get used per letter
- `PAD_POOL_BASE` / `PAD_POOL_RTL` — which scripts get used for padding
- `SCRIPT_FONT` — which Noto family is used per detected script
- `SIGNAL_PALETTE` — the candidate overflow-flag colors
- `buildPadding()` — the ~35% RTL word-mix rate
