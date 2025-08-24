```instructions
---
applyTo: '**/*.sv'
---
# Design Review Checklist (SystemVerilog)

Purpose
Provide a concise, high-signal checklist to drive consistent SystemVerilog design reviews.

Checklist (Core)
- [ ] Interface clarity: parameters, widths, directions documented.
- [ ] Reset strategy consistent (sync vs async) & documented.
- [ ] Clock domain crossings identified & safely synchronized.
- [ ] No unintended latches; combinational blocks fully assigned.
- [ ] Packed struct ordering verified (MSB alignment) when casting.
- [ ] Assertions cover protocol invariants & illegal states.
- [ ] Reuse: evaluated existing IP before new logic.
- [ ] Power/timing hotspots annotated or measured (early estimate OK).

Quality Hooks
- Add lightweight SVA for each FSM: one-hot / legal encodings.
- Add parameter sanity assertions (`$bits()` matches expectations).
- Provide a minimal waveform capture recipe for debug.

Reviewer Prompts
Ask:
1. What is the narrowest interface surface we can expose?
2. Can any logic be pushed into reusable library modules?
3. Are there test visibility hooks missing that would preempt debug pain?

Exit Criteria
All core checklist items checked OR explicitly waived with rationale.

```
