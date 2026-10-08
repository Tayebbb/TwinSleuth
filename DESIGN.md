---
name: TwinSleuth
description: A technical practice bench for evidence-led diagnosis of simulated industrial faults.
colors:
  canvas: "#edf2f2"
  surface: "#fbfcfa"
  surface-raised: "#ffffff"
  ink: "#142b32"
  ink-soft: "#3e5961"
  ink-muted: "#61757a"
  line: "#d2ddde"
  signal: "#087a72"
  signal-deep: "#075c57"
  signal-soft: "#d9eeea"
  amber: "#efb847"
  amber-deep: "#60420b"
  alarm: "#a6403b"
  confirmed: "#23775c"
typography:
  display:
    fontFamily: "Geist Variable, Geist, Segoe UI, sans-serif"
    fontSize: "clamp(2.65rem, 4.2vw, 4.25rem)"
    fontWeight: 650
    lineHeight: 0.99
    letterSpacing: "-0.065em"
  headline:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "clamp(1.2rem, 1.65vw, 1.55rem)"
    fontWeight: 650
    lineHeight: 1.16
  title:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: ".8rem"
    fontWeight: 650
    lineHeight: 1.22
  body:
    fontFamily: "Geist Variable, Geist, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.48
  label:
    fontFamily: "Geist Mono, Consolas, monospace"
    fontSize: ".68rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: ".075em"
rounded:
  card: "16px"
  control: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-deep}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.control}"
    padding: ".68rem .92rem"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.surface-raised}"
  field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: ".62rem .76rem"
---

# Design System: TwinSleuth

## Overview

**Creative North Star: "The Precision Diagnostic Cockpit"**

TwinSleuth pairs a calm, light work surface with an instrument-dark navigation bar, a live machine illustration, and a clearly prioritized forecast console. Geist Variable improves clarity across compact controls and longer evidence descriptions; monospaced labels keep time, probe identifiers, and measurements easy to scan. A four-stage rail keeps the path from scoping to debrief visible without adding a separate marketing page.

Teal marks active selection and live state. A signal-amber forecast field isolates the learner's immediate commitment, while red is reserved for safety and warning states. The interface labels the PIN-9 scenario “SIMULATED CASE DATA.” Forecasts and selected fault are server-owned: forecast rows remain private until their probe runs, and the selected fault is disclosed only after evaluation. This is a practice simulator, not equipment control.

**Key Characteristics:**
- Responsive 12-column diagnostic grid with a three-panel instrument row.
- Rounded work surfaces with restrained shadows and blueprint texture.
- Segmented progress and evidence rails keep the active stage visible.
- Amber marks the committed forecast; teal marks selected and confirmed states.

## Colors

Cool gray-green canvas and deep technical ink establish the workbench; teal carries interaction, and amber marks the forecast commitment.

### Primary
- **Signal Teal** (`{colors.signal}`): Active probe, callouts, selected causes, live states, and primary run actions.
- **Commit Amber** (`{colors.amber}`): The prediction matrix that asks the learner to commit expected results.

### Secondary
- **Alarm Red** (`{colors.alarm}`): Safety warnings, limit marks, and error feedback.
- **Confirmed Green** (`{colors.confirmed}`): The live E-stop status indicator.

### Neutral
- **Canvas** (`{colors.canvas}`): The page ground with a subtle technical grid.
- **Surface** (`{colors.surface}`): Work panels and primary controls.
- **Raised Surface** (`{colors.surface-raised}`): Inputs and evidence details.
- **Technical Ink** (`{colors.ink}`): Main text, structural rules, and default buttons.
- **Soft Ink** (`{colors.ink-soft}`): Supporting copy and diagram labels.
- **Muted Ink** (`{colors.ink-muted}`): Metadata and secondary labels.
- **Line** (`{colors.line}`): Dividers, control borders, and quiet separators.
- **Signal Wash** (`{colors.signal-soft}`): Selected causes and confirmed evidence.
- **Amber Ink** (`{colors.amber-deep}`): Contrast text and borders on amber, and the commit button.

**The Signal Role Rule.** Keep teal for selected, active, and live states; use amber for the prediction commitment; use red for warnings and errors.

## Typography

**Display and Body Font:** Geist Variable (with Geist and Segoe UI fallbacks)
**Label/Mono Font:** Geist Mono (with Consolas and system monospace fallbacks)

**Character:** Geist's open forms keep machine notes and prediction controls readable at compact widths. Tight display tracking gives the case identity a confident voice; monospaced labels distinguish measurements, IDs, costs, and status data.

### Hierarchy
- **Display** (650, `clamp(2.65rem, 4.2vw, 4.25rem)`, `.99`): The PIN-9 case identity; “Refusal” is colored teal.
- **Headline** (650, `clamp(1.2rem, 1.65vw, 1.55rem)`, `1.16`): Panel headings; forecast identity can scale up.
- **Title** (650, `.8rem`, `1.22`): Cause titles and strong row content.
- **Body** (400, `15px`, `1.48`): Main copy, descriptions, and evidence text.
- **Label** (650, `.56rem–.8rem`, usually `.04em–.075em`): IDs, time, measurement, table headings, and operational metadata in Geist Mono/system monospace.

**The Data Face Rule.** Use monospaced type for values and operational labels; use Geist Variable for prose.

## Layout

The page is a centered cockpit capped at `1680px`, with a sticky instrument navigation, a wide case heading, a circular time gauge, and a four-stage progress rail. The first workbench row uses a 12-column dense grid: the machine, causes/probes, and forecast panels span 3 + 4 + 5 columns, filling the row exactly. The evidence ledger, diagnosis, and debrief each span the full width. At tablet widths the scene and worklist use 4 + 8 columns; at phone widths all panels stack in task order.

At widths up to `1180px`, the scene and worklist occupy one-third and two-thirds of the row while the forecast spans the next row. At `820px` and below the main panels stack. On phones, the case rail and prediction commit remain compact and the evidence selector scrolls horizontally. The page supports a `320px` minimum viewport and accounts for bottom safe-area inset on phones.

## Elevation & Depth

Panels use restrained shadows and 16px corners against a subtle drafting grid. Depth stays quiet so the amber forecast and teal active states remain the strongest accents. The arm illustration retains its technical callouts and animates its vector links when the observed state changes.

## Shapes

Cards use 16px corners and controls use 10px corners. Borders stay thin and functional; selected hypotheses and active evidence use teal, while the prediction matrix has a clear amber frame. The machine drawing uses circles for joints and straight, square-ended links.

## Components

### Buttons
- **Shape:** Rounded (`10px`) with a technical ink or signal border.
- **Primary:** Deep signal teal with white text; `.68rem .92rem` padding and at least `44px` height.
- **Hover / Focus:** Enabled buttons lift slightly and shift toward teal; keyboard focus uses a `3px` teal outline offset by `3px`.
- **Secondary / safety:** The unsafe-action control is transparent with a red border and text, filling red on hover. The commit action is amber-ink with white text; its hover changes to ink.

### Cards / Containers
- **Corner Style:** `16px` cards, `10px` controls, and smaller inset marks.
- **Background:** Light canvas with raised surfaces; the forecast matrix uses a pale amber field.
- **Shadow Strategy:** Soft, short shadows separate panels from the technical grid.
- **Border:** Full perimeter panel borders and quiet `1px` internal separators.
- **Internal Padding:** `13–20px` panel padding; register segments use compact spacing.

### Inputs / Fields
- **Style:** White fill, `1px` line stroke, `10px` corners, `.62rem .76rem` padding, and `44px` minimum height for controls.
- **Focus:** A visible `3px` teal outline with `3px` offset.
- **Disabled:** Buttons reduce opacity to `.55` and use a not-allowed cursor. Text areas remain vertically resizable.

### Navigation
- The compact dark bar links directly to machine, test bench, evidence, and diagnosis sections.
- The stage rail exposes the current investigation phase and keeps the next action understandable.

### Signature Components
- **Arm schematic:** Inline, accessible SVG with labelled axis, PIN-9 keypad, datum, sweep, and state-dependent callouts. Its `viewBox` scales with the column; it is `218px` tall by default and adapts to phone width.
- **Prediction matrix:** An amber field groups four cause/result rows and the commit action. The commit stays disabled until each cause has an expected result.
- **Evidence ledger:** A horizontal segmented selector expands one observation at a time and compares the learner forecast with the model result only after that probe runs.
- **Case status:** “Simulated case” identifies the synthetic scenario without using decorative numbered labels.

## Do's and Don'ts

### Do:
- **Do** preserve the visible distinction between learner prediction and observed result.
- **Do** keep the selected fault and unrun forecast rows private until the server's evaluation/probe rules disclose them.
- **Do** use visible keyboard focus and keep controls operable without a pointer.
- **Do** retain the case marker “SIMULATED CASE DATA” when presenting the scenario.

### Don't:
- **Don't** imply that the UI operates physical equipment; it records a simulated unsafe idea as a practice action.
- **Don't** use amber as a generic accent outside the immediate prediction/commit role without evidence from the established system.
- **Don't** infer a server-selected fault from the schematic, active controls, or pre-evaluation state.
