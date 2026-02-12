export interface LiquidityLine {
  price: number;
  createdAt: number; // timestamp
  candleIndex: number;
}

export type LiquidityBoxState = 'untouched' | 'active' | 'cleared';

export interface LiquidityBox {
  minPrice: number;
  maxPrice: number;
  createdAt: number; // timestamp
  candleIndex: number;
  isUpper: boolean; // true for upper liquidity, false for lower
  state: LiquidityBoxState; // lifecycle state
  touchCount: number;
  lastTouchIndex: number;
}

export interface LiquidityModel {
  lines: LiquidityLine[];
  boxes: LiquidityBox[];
}

// REQ-21: Completed liquidity entry for blocking recreation
export interface CompletedLiquidityEntry {
  minPrice: number;
  maxPrice: number;
  isUpper: boolean;
}

// Tolerance for matching completed zones (small percentage of range)
export const COMPLETED_ZONE_TOLERANCE = 0.05; // 5% tolerance
