# Specification

## Summary
**Goal:** Update liquidity box lifecycle and rendering so untouched zones stay permanently visible, active zones are highlighted when price is interacting, and cleared zones are removed—without changing the underlying liquidity detection algorithm.

**Planned changes:**
- Adjust liquidity box lifecycle rules so untouched (never price-touched) upper/lower boxes are never removed due to time passing or price moving away without a touch.
- Add “Active Liquidity Zone” state when price is currently inside a box or when 1–3 recent candles are forming inside it; recompute state on monthly candle updates and update styling immediately on enter/exit.
- Implement “Touched and Cleared” invalidation so boxes are removed from the model and chart once touched and then clearly displaced away with no ongoing interaction (no faded/history rendering).
- Update chart rendering and legend to use 3 states: Untouched (neutral, semi-transparent, thin border), Active (highlight, higher opacity, clearer border), Invalidated (not rendered), with English labels and no “Inactive” legend item.
- Ensure deterministic, performant recomputation on candle series updates and prevent duplicate/overlapping boxes for the same logical zone while preserving existing wick-based coordinates and base detection logic.

**User-visible outcome:** On the chart, untouched liquidity zones persist until first interaction, zones the market is currently trading within are clearly highlighted as active, and zones that have been touched and then cleared disappear automatically; the legend reflects only Untouched and Active states.
