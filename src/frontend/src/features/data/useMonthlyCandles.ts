import { useQuery } from '@tanstack/react-query';
import { Candle, normalizeBinanceKline, normalizeCoinGeckoOHLC } from './types';
import { fetchWithTimeout, validateArrayResponse, parseJSON, MarketDataError } from './fetchUtils';

/**
 * Fetch BTC monthly candles from Binance public API (primary source)
 */
async function fetchFromBinance(): Promise<Candle[]> {
  const now = Date.now();
  const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60 * 1000;

  // Binance public API endpoint - no authentication required
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1M&startTime=${fiveYearsAgo}&limit=1000`;

  const response = await fetchWithTimeout(url, { timeout: 15000 });
  const data = await parseJSON<unknown[]>(response);

  if (!validateArrayResponse(data, 1)) {
    throw new MarketDataError('No candle data received');
  }

  return data.map((item) => normalizeBinanceKline(item as unknown[]));
}

/**
 * Fetch BTC monthly candles from CoinGecko OHLC endpoint (fallback source)
 */
async function fetchFromCoinGecko(): Promise<Candle[]> {
  // CoinGecko OHLC endpoint with 90-day lookback (returns monthly candles automatically)
  const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=max';

  const response = await fetchWithTimeout(url, { timeout: 15000 });
  const data = await parseJSON<unknown[]>(response);

  if (!validateArrayResponse(data, 1)) {
    throw new MarketDataError('No candle data received');
  }

  return data.map((item) => normalizeCoinGeckoOHLC(item as unknown[]));
}

/**
 * Fetch BTC monthly candles with automatic fallback
 */
async function fetchBTCMonthlyCandles(): Promise<Candle[]> {
  const errors: Error[] = [];

  // Try primary source (Binance)
  try {
    const candles = await fetchFromBinance();
    if (candles.length > 0) {
      return candles;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error('Unknown error from primary source'));
  }

  // Try fallback source (CoinGecko)
  try {
    const candles = await fetchFromCoinGecko();
    if (candles.length > 0) {
      return candles;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error('Unknown error from fallback source'));
  }

  // All sources failed
  const errorMessages = errors.map((e) => e.message).join('; ');
  throw new MarketDataError(
    `Unable to fetch market data. Please check your connection and try again. (${errorMessages})`
  );
}

export function useMonthlyCandles() {
  return useQuery<Candle[]>({
    queryKey: ['btc-monthly-candles'],
    queryFn: fetchBTCMonthlyCandles,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1, // React Query will retry once, then our fallback logic handles additional attempts
    refetchOnWindowFocus: false,
  });
}
