```instructions
---
applyTo: '**/*.prompt.md'
---
# Prompt Refinement Playbook

Goal
Provide a structured series of transformation passes to harden a draft prompt.

Passes
1. Intent Clarification: reduce to one primary objective + optional second.
2. Output Contract: specify format schema (JSON keys / sections) + rejection behavior.
3. Constraint Injection: add guardrails (avoid speculation, cite sources, etc.).
4. Variable Externalization: replace inline specifics with {{PLACEHOLDERS}}.
5. Failure Hooks: instruct model how to respond when lacking data (explicit deferral).

Scoring Heuristics
- Ambiguity ↓, determinism ↑, token efficiency ↔ or ↑.
- Rejects invalid tasks gracefully (structured error object or apology + ask clarifier).

Refinement Prompt Snippet
```
Analyze the following prompt draft. Return JSON with keys: intent, issues[], improvements[], revised.
```

Anti-Patterns
- Hidden multi-step tasks without ordering.
- Implicit success criteria.
- Overloaded persona + task directives.

```
