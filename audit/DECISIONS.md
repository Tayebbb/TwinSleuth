# Decisions (judge pass)

- Skipped (ask-first): none required a dependency, rubric change, or deletion.
- Not changed (design call): `same-prediction` / `premature-elimination` trigger *presence* still varies with the evidence-consistent set, so challenge kind is a weak side channel. Candidate set is already derivable from revealed P-rows; closing it needs a product decision (always-emit generic challenge?).
- Not changed: `episodes.revision` column counts AGENT_RUN seqs; unused by reads (fold is authoritative). Dead/misleading; remove in a later schema pass.
- Not committed: `capture:demo` regenerates tracked `submission/` media; restored to HEAD (no visual change).
