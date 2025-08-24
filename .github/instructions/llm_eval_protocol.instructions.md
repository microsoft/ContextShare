```instructions
---
applyTo: '**/*.prompt.md'
---
# LLM Evaluation Protocol

Objective
Standardize quick, local evaluation passes for new / modified prompt templates.

Phases
1. Scoping: define target behavior, failure modes, and success metrics (precision, format adherence, latency).
2. Test Set: craft 5–10 diverse input cases + 2 adversarial/edge cases.
3. Baseline: capture outputs of current prompt version (hash & store locally).
4. Variant Trial: apply a single structured change; record diff rationale.
5. Scoring: rate each output (1–5) on task success, structure, hallucination risk.
6. Decision: promote variant only if median score improves ≥1 and no regressions on edge cases.

Metrics Template
```
CASE | BASE_OK | VAR_OK | NOTES
1    |   Y     |   Y    |
...
```

Rules
- Single-variable edits per variant (no conflated changes).
- Keep raw outputs for audit; avoid subjective memory-only judgments.
- Automate scoring accumulation when possible.

De-Risking
- Include a harmful-content trap input to ensure safe handling path untouched.
- Document any drop in verbosity if brevity was not an objective.

```
