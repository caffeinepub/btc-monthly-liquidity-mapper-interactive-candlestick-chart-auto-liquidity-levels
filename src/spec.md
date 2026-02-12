# Specification

## Summary
**Goal:** Fix the BTC monthly chart “Failed to Load Data” issue by switching to a more reliable free public monthly OHLCV source and making client-side fetching resilient.

**Planned changes:**
- Replace the current CoinGecko-based monthly candle fetch (derived from daily aggregation) with a faster, free public endpoint (no API key) that returns BTC 1M OHLCV directly, while keeping the existing Candle interface stable.
- Normalize primary endpoint responses into the existing Candle format (time in ms; open/high/low/close as numbers; volume present even if 0) to remain compatible with the BTC chart and liquidity computations.
- Add hardened fetch behavior for monthly candles: timeout/abort via AbortController, clearer failure handling, and automatic fallback to at least one secondary free public endpoint before showing an error.
- Update BTC chart loading/error UI copy to reference “market data” generically (no provider-specific mentions), keep English text, and ensure Retry triggers a fresh attempt (including fallback behavior).

**User-visible outcome:** The BTC monthly chart loads reliably and renders monthly candles without provider-specific messaging, and if a data source intermittently fails the page retries with a fallback source before showing a friendly error with a working Retry option.
