import { useMemo } from 'react';
import { Candle } from '../data/types';
import { computeLiquidityModel } from './liquidityAlgorithm';
import { LiquidityModel } from './types';

export function useLiquidityModel(candles: Candle[]): LiquidityModel {
  return useMemo(() => {
    if (!candles || candles.length === 0) {
      return { lines: [], boxes: [] };
    }

    return computeLiquidityModel(candles);
  }, [candles]);
}
