# TwinSleuth — visual system

## Status and source of truth

**Approved direction:** warm lab notebook; laptop/desktop first, responsive on smaller screens. The UI has not been implemented or visually reviewed yet, so this is a design contract rather than a description of a shipped interface.

Use [`handoff.md`](../../handoff.md), section **“UI system and states,”** as the token and screen-state source until `src/web/styles/tokens.css` exists. When it does, that stylesheet becomes the sole source for primitive → semantic → component CSS variables; update this document to point to the implemented variables rather than duplicating their values. This approved direction overrides generic search-generated portfolio or landing-page recommendations.

## Visual principles

- Make it feel like a student's careful troubleshooting notebook: paper surfaces, ink-dark text, ruled evidence rows, restrained teal actions.
- Keep cause reasoning, evidence, and agent feedback readable at a glance. Use indigo for the learner's predictions/model forecast, teal for observations, amber for the Skeptic, red for contradictory beliefs, and green for supported claims. Always pair color with a visible label or symbol.
- Use a purposeful 2D SVG arm/keypad illustration, not a stock dashboard hero, control-room interface, or generic chat layout. At the initial `SAFETY_REJECT`, the arm stays still; a dotted path may show the rejected intent.
- Reserve the main bench for the diagnostic loop. At 1280×800, keep scene/status/budget/timeline on the left and learner beliefs/probes/predictions on the right. The debrief presents the learner-belief timeline beside the evidence-supported timeline.
- Prefer system-friendly UI typography and a monospace face for IDs, measurements, probe costs, and event traces. The selected CSS font aliases are in `handoff.md`; avoid a decorative academic serif that harms compact lab data readability.

## Interaction and accessibility

- Use native buttons, radios, checkboxes, and labeled form controls. Match keyboard order to visual order and keep a clear 2px focus ring.
- Keep explanatory text around 16px; meet at least 4.5:1 contrast for body text. Aim for 44px or larger touch targets, and avoid horizontal overflow at narrow widths.
- Respect `prefers-reduced-motion`. Animation may show only server-returned trajectories. Every prediction/observation difference must remain clear without animation, color, sound, hover, or pointer interaction.
- Use stable hover/pressed states that do not move neighboring content. Disabled actions must look and behave disabled.

## Required component language

- **Prediction:** dashed indigo surface, labeled `YOUR PREDICTION`.
- **Observation:** solid teal surface, labeled `OBSERVED`.
- **Revealed forecast:** indigo row labeled `MODEL PREDICTED`, shown only after its probe runs.
- **Skeptic:** amber question card with `Revise`, `Run anyway`, and `Why?` actions. It challenges the learner's prediction without presenting a verdict.
- **Debrief:** score ring and criterion bars; paired timelines; path compared with the exact solver policy; evidence-linked claim checks; full forecast table; fault reveal last.

Keep these components consistent across bench, trace drawer, and debrief. The complete product flow and screen behavior live in `handoff.md`; update this guide if an approved direction or implemented token changes.
