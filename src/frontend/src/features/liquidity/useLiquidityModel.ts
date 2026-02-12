import { useMemo, useRef } from 'react';
import { Candle } from '../data/types';
import { computeLiquidityModel, evaluateBoxLifecycle } from './liquidityAlgorithm';
import { LiquidityModel, LiquidityBox } from './types';

/**
 * REQ-28: Enhanced hook with box persistence across recomputations
 */
export function useLiquidityModel(candles: Candle[]): LiquidityModel {
  const previousBoxesRef = useRef<LiquidityBox[]>([]);

  return useMemo(() => {
    if (!candles || candles.length === 0) {
      return { lines: [], boxes: [] };
    }

    // Compute fresh model
    const freshModel = computeLiquidityModel(candles);
    
    // REQ-28: Merge with previously persisted boxes
    const currentIndex = candles.length - 1;
    const mergedBoxes: LiquidityBox[] = [...freshModel.boxes];
    
    // Re-evaluate previously persisted boxes against latest candles
    for (const prevBox of previousBoxesRef.current) {
      // Check if this box is already in the fresh model
      const alreadyExists = mergedBoxes.some(
        box =>
          box.candleIndex === prevBox.candleIndex &&
          box.isUpper === prevBox.isUpper &&
          Math.abs(box.minPrice - prevBox.minPrice) < 0.01 &&
          Math.abs(box.maxPrice - prevBox.maxPrice) < 0.01
      );
      
      if (!alreadyExists) {
        // Re-evaluate this persisted box
        const { state, touchCount, lastTouchIndex } = evaluateBoxLifecycle(
          prevBox,
          candles,
          currentIndex
        );
        
        // Only keep if not cleared
        if (state !== 'cleared') {
          mergedBoxes.push({
            ...prevBox,
            state,
            touchCount,
            lastTouchIndex,
          });
        }
      }
    }
    
    // Store merged boxes for next computation
    previousBoxesRef.current = mergedBoxes;
    
    const model = {
      lines: freshModel.lines,
      boxes: mergedBoxes,
    };
    
    // REQ-28: Development-only invariant checks
    if (import.meta.env.DEV) {
      const untouchedBoxes = model.boxes.filter(box => box.touchCount === 0);
      const invalidUntouched = untouchedBoxes.filter(box => box.state !== 'untouched');
      
      if (invalidUntouched.length > 0) {
        console.warn(
          '[INVARIANT VIOLATION] Untouched liquidity boxes with incorrect state detected:',
          invalidUntouched.map(box => ({
            minPrice: box.minPrice,
            maxPrice: box.maxPrice,
            candleIndex: box.candleIndex,
            isUpper: box.isUpper,
            state: box.state,
            touchCount: box.touchCount,
          }))
        );
      }
      
      // REQ-27: Sanity check for lower untouched boxes
      const lowerUntouchedBoxes = model.boxes.filter(
        box => !box.isUpper && box.state === 'untouched'
      );
      
      if (lowerUntouchedBoxes.length === 0 && candles.length > 10) {
        console.warn(
          '[SANITY CHECK] No lower untouched liquidity boxes detected. ' +
          'This may indicate a detection issue if reversal structures exist.'
        );
      } else if (lowerUntouchedBoxes.length > 0) {
        console.info(
          `[SANITY CHECK] ${lowerUntouchedBoxes.length} lower untouched box(es) detected:`,
          lowerUntouchedBoxes.map(box => ({
            minPrice: box.minPrice.toFixed(2),
            maxPrice: box.maxPrice.toFixed(2),
            candleIndex: box.candleIndex,
          }))
        );
      }
    }

    return model;
  }, [candles]);
}
