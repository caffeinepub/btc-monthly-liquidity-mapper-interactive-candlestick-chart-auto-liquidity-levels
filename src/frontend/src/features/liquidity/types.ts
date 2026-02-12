export interface LiquidityLine {
  price: number;
  createdAt: number; // timestamp
  candleIndex: number;
}

export interface LiquidityBox {
  minPrice: number;
  maxPrice: number;
  createdAt: number; // timestamp
  candleIndex: number;
  isActive: boolean;
  isUpper: boolean; // true for upper liquidity, false for lower
  touchCount: number;
  lastTouchIndex: number;
}

export interface LiquidityModel {
  lines: LiquidityLine[];
  boxes: LiquidityBox[];
}
