```task
# LLM Prompt Experiment Task

Goal
Run controlled A/B evaluation of two prompt variants across a small deterministic test set.

Inputs
- Variant A file path
- Variant B file path
- Test cases JSON path

Procedure
1. Load test cases (array of objects with input + expected keys).
2. For each variant, generate outputs; compute simple metrics (exact_match, length, token_estimate).
3. Aggregate deltas: improvement count, regressions, ties.
4. Emit ranking recommendation with confidence heuristic.

Output JSON
```
{
  "cases": [{"id":1,"a_ok":true,"b_ok":false,"note":"..."}],
  "aggregate": {"a_wins":3,"b_wins":2,"ties":1},
  "recommend":"A",
  "confidence":"medium"
}
```

Safeguards
- Skip cases exceeding token limit threshold; mark skipped.

```
