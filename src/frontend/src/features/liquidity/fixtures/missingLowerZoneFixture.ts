import { Candle } from '../../data/types';

/**
 * REQ-30: Minimal fixture to reproduce missing lower zone scenario
 * Simulates a reversal structure that should produce a lower liquidity box
 */
export function getMissingLowerZoneFixture(): Candle[] {
  const baseTime = new Date('2020-01-01').getTime();
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  return [
    // Initial bullish trend
    { time: baseTime, open: 10000, high: 12000, low: 9500, close: 11500, volume: 1000 },
    { time: baseTime + monthMs, open: 11500, high: 13000, low: 11000, close: 12800, volume: 1000 },
    { time: baseTime + 2 * monthMs, open: 12800, high: 15000, low: 12500, close: 14500, volume: 1000 },
    
    // Two consecutive bearish candles (opposite move) - should trigger reversal detection
    { time: baseTime + 3 * monthMs, open: 14500, high: 14800, low: 12000, close: 12500, volume: 1000 },
    { time: baseTime + 4 * monthMs, open: 12500, high: 13000, low: 11000, close: 11500, volume: 1000 },
    
    // Continuation of opposite move
    { time: baseTime + 5 * monthMs, open: 11500, high: 12000, low: 10500, close: 11000, volume: 1000 },
    
    // Resume bullish (end of opposite move)
    { time: baseTime + 6 * monthMs, open: 11000, high: 13000, low: 10800, close: 12500, volume: 1000 },
    { time: baseTime + 7 * monthMs, open: 12500, high: 14000, low: 12000, close: 13500, volume: 1000 },
    
    // Additional candles that don't touch the lower zone (10500-11000)
    { time: baseTime + 8 * monthMs, open: 13500, high: 15000, low: 13000, close: 14500, volume: 1000 },
    { time: baseTime + 9 * monthMs, open: 14500, high: 16000, low: 14000, close: 15500, volume: 1000 },
  ];
}
