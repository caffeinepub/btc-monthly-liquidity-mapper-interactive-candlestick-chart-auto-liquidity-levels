export interface Candle {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Normalize Binance kline data to Candle format
 * Binance format: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
 */
export function normalizeBinanceKline(kline: unknown[]): Candle {
  if (!Array.isArray(kline) || kline.length < 6) {
    throw new Error('Invalid kline data structure');
  }

  return {
    time: Number(kline[0]), // Open time in ms
    open: parseFloat(String(kline[1])),
    high: parseFloat(String(kline[2])),
    low: parseFloat(String(kline[3])),
    close: parseFloat(String(kline[4])),
    volume: parseFloat(String(kline[5])) || 0,
  };
}

/**
 * Normalize CoinGecko OHLC data to Candle format
 * CoinGecko format: [timestamp, open, high, low, close]
 */
export function normalizeCoinGeckoOHLC(ohlc: unknown[]): Candle {
  if (!Array.isArray(ohlc) || ohlc.length < 5) {
    throw new Error('Invalid OHLC data structure');
  }

  return {
    time: Number(ohlc[0]),
    open: parseFloat(String(ohlc[1])),
    high: parseFloat(String(ohlc[2])),
    low: parseFloat(String(ohlc[3])),
    close: parseFloat(String(ohlc[4])),
    volume: 0, // CoinGecko OHLC endpoint doesn't provide volume
  };
}
