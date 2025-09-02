# ContextHub – Comprehensive Test Plan

## 1. Scope & Objectives
Validate functional correctness, stability, security, privacy (no unintended data exposure), and regression safety of the VS Code extension that manages AI catalog resources (chatmodes, instructions, prompts, tasks) including new unified root catalog override and legacy per‑category overrides.

## 2. Components Under Test
1. Resource discovery (catalog folders, per‑category overrides, unified root override).
2. Classification (filename heuristic under root override).
3. Activation / deactivation lifecycle and modified state detection.
4. User runtime‑only resource protection.
5. Remote source fetching (single file, directory with index.json) & caching (TTL).
6. Configuration precedence (root override vs per‑category overrides).
7. Virtual repository derivation when only overrides set.
8. Diff support path resolution (logical; UI diff manual).
9. Security & privacy constraints (no accidental network / path traversal / overwrites outside scope).
10. Hats presets: discovery (catalog/workspace/user), apply activation, and save flows.

## 3. Risk Areas & Mitigations
| Risk | Impact | Mitigation/Test Cases |
|------|--------|-----------------------|
| Misclassification via heuristic | Missing or wrong category | Root override classification suite |
| User resource deletion | Data loss | Deactivate user resource negative test |
| Remote fetch failures | Missing resources / crash | Simulated remote 404 & malformed index tests |
| Stale cache | Serving outdated content | TTL expiry test |
| Override precedence confusion | Wrong set of resources | Root vs per‑category precedence test |
| Modified state false negative | Users lose edits silently | Activation + edit + state test |
| Path traversal in remote index | Security breach | Index with '../' entries ignored test (TODO) |
| Excess network calls | Performance / privacy | Cache hit test counts fetches |
| Large recursion | Performance | Stress recursion test (TODO) |
| Writing outside runtime | Security breach | Target path confinement test |

## 4. Test Matrix
### A. Discovery & Classification
A1 Base catalog scan
A2 Root override recursion
A3 Root override precedence over per‑category
A4 Direct category override path equals category dir
A5 Override fallback to baseDir when already category
A6 Empty categories graceful handling

### B. User Resources
B1 Runtime‑only detection
B2 Deactivation protection
B3 Catalog + runtime same filename -> MODIFIED state

### C. Activation Lifecycle
C1 Activate INACTIVE -> ACTIVE
C2 Runtime edit -> MODIFIED
C3 Deactivate returns INACTIVE
C4 Deactivate from MODIFIED -> INACTIVE

### D. Remote & Cache (mocked)
D1 Single remote file fetch
D2 Directory remote with index.json
D3 Cache hit inside TTL (method call count stable) (TODO JS adaptation)
D4 Cache expiry refetch (TODO)
D5 Remote failure skip (404) (TODO)
D6 Malformed index.json (ignore) (TODO)

### E. Security / Privacy
E1 No fetch when no remote override (ensure fetch not called) (TODO)
E2 Path traversal '../' in index ignored (TODO)
E3 Root override explicit absolute path accepted
E4 Remote content never executed (only read/write) – code inspection/manual

### F. Robustness
F1 Missing catalog dir -> empty list
F2 Permission/stat error resilience (simulate stat throwing) (TODO)
F3 Large recursion (1000 files) performance (TODO)

### G. Config Changes
G1 Switch per‑category -> root (re‑discovery) (TODO)
G2 Change TTL (affects cache) (TODO)

## 5. Test Levels
- Unit: JS test harness with mock file/remote services (current implementation).
- Integration (manual): Install VSIX, trigger commands, verify UI.

## 6. Tooling
Custom lightweight JS runner (no external test framework) due to offline constraints.

## 7. Pass / Fail Criteria
All automated unit tests pass (exit 0). Outstanding TODO cases documented; must be implemented before release candidate.

## 8. Remaining TODO Automated Cases
Listed above as (TODO). Implement iteratively; treat unimplemented tests as blockers before final release tag.

## 9. Manual Release Checklist
1. Update CHANGELOG.md with a new section for this version and verify package.json version.
2. Install VSIX; visually confirm tree shows expected categories.
3. Toggle root override setting; legacy overrides ignored.
4. Activate all; modify a runtime file; ensure state shows modified.
5. Attempt to deactivate a user resource (blocked).
6. Configure remote directory; confirm index.json retrieval and caching.
7. Inspect runtime cache directory for correct files.
8. Review network calls (if possible via proxy log) limited to configured URLs.

## 10. Security & Privacy Review Points
- No telemetry code present.
- All network calls originate from explicit override URLs.
- Caching occurs under runtime path .github/.copilot_catalog_cache.
- Path traversal protection: ensure sanitized joins (future explicit test).
- User content not uploaded anywhere.

## 11. Future Enhancements
- Add hashing for faster modified detection on large files.
- Introduce allowlist/denylist for remote domains.
- Add integrity checksum for remote files (index.json containing hashes).

---
This file should evolve; update as new features land.
