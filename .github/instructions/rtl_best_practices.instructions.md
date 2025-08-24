---
applyTo: '**/*.{v,sv}'
---

# RTL Best Practices (applies to *.v / *.sv files)

Purpose
- Concise, reviewer-friendly guidelines for writing and reviewing synthesizable Verilog/SystemVerilog RTL in this repository.

High-level rules
- RTL-first: Always read the RTL module(s) under review before making changes. Extract widths, parameters, enums, and typedefs from the source rather than guessing.
- Reuse-first: Prefer existing, verified IP and core libraries over new one-off implementations.
- Keep modules parameterized and small; design clear, testable interfaces.

Module declaration
- Signal name should end with `_i` for inputs and `_o` for outputs to maintain consistency and clarity in naming conventions. But this does not apply to clock and reset signals, which should be named just `clk` and `rst` respectively.
- Net type of input and output signals should be `wire` unless otherwise specified. Do not use `logic` for input and output signals.
- Add `default_nettype none` before a module declaration and `default_nettype wire` after the module declaration.

Packed struct & bit-ordering
- SystemVerilog packed structs: the first declared field maps to the Most Significant Bits (MSBs). Verify bit positions when mapping fields to buses or memory.
- Example reminder:
  // first field -> MSBs
  typedef struct packed { logic [7:0] a; logic [3:0] b; } my_t;

always_comb / always_ff rules
- In combinational blocks (`always_comb`), use a single assignment style only — prefer blocking assignments (`=`) for combinational logic.
- In sequential blocks (`always_ff`), use non-blocking assignments (`<=`). Do not mix blocking and non-blocking assignments in the same always block.

Clock domain crossing (CDC)
- Always treat CDC signals with synchronizers. Use a minimum two-stage flip-flop synchronizer for single-bit control/status signals.
- For multi-bit or multi-signal transfers, use FIFOs, handshake protocols, or Gray-encoded pointers + proper synchronizers for pointers.
- Document CDC assumptions in a comment on the interface.

Widths, parameters, and `$bits()`
- Derive widths from authoritative RTL (parameters/localparams, `typedef`s, or `$bits()`), not hard-coded numeric literals.
- Prefer `parameter` or `localparam` definitions at module level for sizes used in multiple places.

Assertions & debug hooks
- Add lightweight SVA checks for protocol invariants (valid/ready, queue fullness, state-machine legal states) where appropriate.
- Add optional debug visibility ports (scan/trace) guarded by `ifdef` macros so they can be removed for synthesis if needed.
- Wrap all assertions using `// synthesis translate_off` and `// synthesis translate_on` to prevent synthesis tools from reading them.

Synthesis and style
- Avoid latches: ensure all combinational outputs are assigned in every branch.
- Avoid inferred RAM mismatches by using vendor-backed primitives or consistent read/write sizing.
- Keep combinational expressions reasonably sized to help timing.
- Always add parentheses around comparison operators in conditions. This ensures that the intended order of operations is clear and prevents potential misinterpretation by the synthesis.

Code review checklist (short)
- [ ] Did you read the RTL and extract widths/params?  
- [ ] Does always_comb use blocking `=` only?  
- [ ] Does always_ff use non-blocking `<=` only?  
- [ ] Are CDC crossings synchronized?  
- [ ] Are widths derived from parameters/typedefs or `$bits()`?  
- [ ] Are lightweight SVA/assertions present for critical protocols?  

Notes
- These are concise recommendations; project-specific conventions may override some items — check module-level comments and `README` documents for exceptions.
- This file is intentionally short; put extensive examples and project scripts into `docs/` or module-level documentation.
