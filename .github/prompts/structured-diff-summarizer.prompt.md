```prompt
---
mode: agent
---
# Structured Diff Summarizer

Mission
Given a unified diff, produce a structured summary emphasizing risk, test impact, and follow-up actions.

Steps
1. Parse file sections; categorize by type (code, test, docs, config).
2. Compute risk heuristic (critical path? low-level primitive? concurrency?).
3. Identify untouched dependent areas that MAY require tests.
4. Emit action list.

Output
```
FILES_CHANGED: n
RISK_SCORE: <low|med|high>
SUMMARY:
- ...
ACTIONS:
- [ ] Add test for ...
- [ ] Run perf benchmark ...
```

Notes
- Don't restate trivial rename-only changes; collapse them.

```
