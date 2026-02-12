# Specification

## Summary
**Goal:** Fix missing BTC monthly liquidity zones so the expected ~$27k–$25k lower untouched box is consistently detected and rendered, and ensure untouched liquidity boxes never disappear.

**Planned changes:**
- Adjust monthly BTC liquidity detection to consistently emit the lower untouched liquidity zone around ~$27k–$25k from the reversal-structure (two consecutive opposite candles → wick-based range) logic, and keep it in the computed model as state=`untouched` until first touch.
- Fix liquidity box lifecycle so any box with `touchCount===0` is always preserved and plotted (no suppression/removal due to age, distance, trend bias, replacement, or other non-touch filters).
- Make chart rendering deterministically map each LiquidityBox to x-axis coordinates using `candleIndex` (not timestamps), clamp out-of-bounds indices, and ensure all non-`cleared` boxes render with stable React keys; add dev-only warnings when creation is skipped or rendering cannot resolve coordinates.
- Add a small dev-only regression fixture (minimal hard-coded candles) that reproduces the missing-lower-zone scenario and asserts: lower box is emitted, remains while untouched across recomputation, and only disappears after touched+cleared rules are met.

**User-visible outcome:** On the Monthly BTC chart, the lower liquidity zone around ~$27k–$25k appears reliably as an untouched (neutral) box until price touches it, and untouched zones do not vanish unexpectedly.
