# Stage one visual revamp — QA report

**Baseline:** `bdb2cf57e18d06e4e4ec043038071d23f6a1b21c`
**Working branch:** `codex/stage-one-visual-revamp`
**Preview:** local synthetic data only; Playwright blocked requests outside the local preview and dummy local API.

## Verification

- Production build: passed.
- Unit/regression suite: passed — 25 files, 144 tests.
- TypeScript check (`npx tsc --noEmit`): passed.
- Impeccable scan: passed with no findings.
- `git diff --check`: passed.
- Browser checks: passed for the nine destinations, mobile More destinations, financial labels, large amounts, wallet credit breakdown and fee-first payment preview, dialog labels/errors and keyboard focus containment/restoration, browser back/forward, filtered/empty/error/loading states, artwork rendering, reduced motion, and responsive layouts at 390, 768, and 1440 CSS pixels.
- Selected desktop navigation contrast: 15.23:1. Secondary hero action: 6.69:1.
- Browser reported no uncaught page errors. Seventeen requests to the dummy loopback API were intentionally blocked; associated console errors were expected.
- 200% reflow was checked using a 720 CSS-pixel viewport (equivalent to 1440px at 200%) because browser zoom controls were unavailable in headless Chromium.
- Targeted mobile polish recheck (2026-10-09, 390 CSS px): Quick Log renders one plus icon with no duplicate plus character; the wallet summary says available money and unused card capacity are shown separately; Activity Log backup controls stack inside the header card. The Restore Backup control remained within the 350px card (x=20–370), with document and body scroll widths at the 390px viewport width. No uncaught page errors.

## Captures

All captures include the visible `SYNTHETIC DATA · LOCAL PREVIEW ONLY` watermark.

| Filename | Dimensions |
| --- | ---: |
| `dashboard-1440-SYNTHETIC.png` | 1440 × 1313 |
| `dashboard-768-SYNTHETIC.png` | 768 × 2242 |
| `dashboard-390-SYNTHETIC.png` | 390 × 2977 |
| `mobile-more-390-SYNTHETIC.png` | 390 × 940 |
| `activity-log-390-SYNTHETIC.png` | 390 × 930 |

## Scope and repository state

Financial formulas and mutations were not changed. No production connection, migration, security change, merge, or manual deployment was performed. The reviewed implementation and synthetic captures are presented in draft PR #2.
