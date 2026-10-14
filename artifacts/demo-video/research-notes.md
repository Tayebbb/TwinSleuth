# Demo video research notes

Checked 14 October 2026. Primary sources take precedence over demo advice.

## Event requirements and submission risk

- The [Next Byte Hacks V5 overview](https://next-byte-hacks-v5.devpost.com/) says a demo video should be **1–3 minutes**. Its [rules page](https://next-byte-hacks-v5.devpost.com/rules) says **2–5 minutes**. The pages do not resolve the conflict. This requested 05:00 runtime meets the rules page's ceiling and exceeds the overview's cap; ask the organizers which limit governs.
- The rules require a newly created project built during the event, working functionality, accessible source code, and compliance with applicable licenses, API terms, and tool policies. The overview also says the main work must occur during the event and requests a public repository. The first repository commit is dated 8 October 2026, two days after the listed 6 October event opening. That is consistent with the event dates but does not prove project provenance; the submitter must confirm eligibility.
- [The GitHub repository](https://github.com/Tayebbb/TwinSleuth) is publicly readable as checked on 14 October. The current checkout has no `LICENSE`, `COPYING`, or `NOTICE` file; the submitter should confirm project licensing and applicable dependency/API terms before submission. Git history's first commit is 8 October, within the event dates, but does not establish authorship or when work began.
- The event deadline is 31 October 2026, 5:00 p.m. EDT ([schedule](https://next-byte-hacks-v5.devpost.com/details/dates)). The overview and rules also differ on age wording and judging categories; check with organizers if those affect submission.

## Demo guidance

- [Devpost's video best practices](https://help.devpost.com/article/84-video-making-best-practices) favor a narrated screencast, direct explanation, edited takes, and a public/playable video. The article was updated 27 May 2026.
- Devpost's [hackathon video tips](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video) recommend scripting, opening with what the project does, and showing the working input-to-result path. Its general “around three minutes” advice defers to event-specific rules, which conflict here.
- [Devpost's presentation guide](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo) recommends a brief setup, a working demonstration, a concise technical explanation, and a closing value statement.

## Comparable submissions

These are submission-page observations, not direct video reviews: the linked Vimeo/YouTube players could not be played by the available research tools.

- [Paper Cuts](https://devpost.com/software/paper-cuts) lists Grand Prize, Finalist, and Best UI/UX awards. Its page describes a visible draw → recognition → enhancement → play progression. Transferable idea: show one causal chain and hold on the payoff. Award claims are from the Devpost page.
- [Storytopia (Google Cloud Run Hackathon 2025)](https://devpost.com/software/storytopia-bu917p) lists Grand Prize. Its page describes a child drawing transformed through character and lesson choices into an illustrated quest, with timing disclosure for long generation. Transferable idea: follow one user-created artifact through each stage and label waits or acceleration honestly. Do not confuse this page with the unrelated older Storytopia entry.
- [MLB Pitcher Mechanics Scorecard](https://devpost.com/software/pull-the-pitcher) lists Overall Grand Prize. Its page describes source video, keyframes, analysis overlays, and a pitcher-specific baseline. Transferable idea: frame the evidence around a concrete decision and compare against an explicit baseline.

## Creative decisions for TwinSleuth

Open on the actual P1 refusal case and Skeptic challenge. Follow the repo's documented no-key learner path: commit P1, revise to P3, observe P3, observe P4, defend H1 with four cited claims, then inspect the deterministic debrief. Show the balanced forecast and evidence-reduction result while they are visible. Use a small diagram only for the verified client/server/ledger boundary. State plainly that the plant and measurements are simulated and that TwinSleuth is not an industrial safety system or validated learning study.
