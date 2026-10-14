---
name: TwinSleuth
description: A technical practice bench for evidence-led diagnosis of simulated industrial faults.
colors:
  canvas: "#edf2f2"
  surface: "#fbfcfa"
  surface-raised: "#ffffff"
  ink: "#142b32"
  ink-soft: "#3e5961"
  ink-muted: "#53686a"
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
    fontFamily: "Saira Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "2.65rem"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Saira Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, Consolas, monospace"
    fontSize: ".68rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: ".075em"
rounded:
  card: "0px"
  control: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
---

# TwinSleuth Design System

## Source of truth

The shipped styles are authoritative: tokens are in src/web/styles/tokens.css; layout, component states, and breakpoints are in src/web/styles/app.css; rendered components are in src/web/main.tsx. Keep this brief aligned with those files.

## Visual direction

TwinSleuth is a calm technical workbench for two simulated diagnosis cases. Use an ink-and-paper base, teal for active and confirmed states, amber for the committed prediction, and red for warnings. Prefer flat, ruled work areas over dashboard cards. The interface is a simulation and must never look like connected equipment control.

## Color roles

- Canvas and surfaces use cool gray-green neutrals; ink provides readable contrast.
- Teal marks active selection, completed progress, and live status.
- Amber frames the prediction commitment and related cost.
- Red marks simulated safety warnings and contradictory/error states.
- Pair every meaningful color with text, icon, or shape; do not rely on color alone.

## Typography

- Display and panel headings use **Saira Semi Condensed**.
- Body and explanatory copy use **Source Sans 3**.
- IDs, measurements, costs, and event details use **IBM Plex Mono**.
- Body text starts at 15px with 1.5 line-height. Controls and touch targets are at least 44px high.

## Layout and surfaces

- Center the workbench within a 1480px maximum shell.
- The desktop bench uses a 12-column layout: machine scene spans 3 columns, causes/probes span 5, and prediction spans 4. Evidence, diagnosis, and debrief follow below.
- At narrower widths, collapse panels into task order and prevent horizontal overflow. Support a 320px minimum viewport.
- Work areas use thin rules and minimal elevation. Controls use 6px corners; panels remain square-edged.
- Keep prediction, observation, and post-run model forecast visibly distinct and explicitly labelled.

## Interaction and accessibility

- Use native controls, visible keyboard focus, and at least 44px target height.
- Respect prefers-reduced-motion. State animation may reflect only server-returned observations.
- Keep the stage rail, retry/error states, and active case legible at laptop and phone sizes.
- Preserve the learner loop: predict, test within budget, compare evidence, and defend a diagnosis.

## Trust boundary

The server owns hidden truth, unrun forecasts, observations, budget, scoring, and diagnosis. Never expose a selected fault before evaluation or an unrun forecast row. Examiner feedback stays advisory; deterministic code remains authoritative. This is synthetic practice, not industrial safety guidance.
