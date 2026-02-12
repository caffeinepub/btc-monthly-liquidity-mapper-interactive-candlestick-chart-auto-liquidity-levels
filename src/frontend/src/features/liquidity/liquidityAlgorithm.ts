import { Candle } from '../data/types';
import { LiquidityLine, LiquidityBox, LiquidityModel, LiquidityBoxState, CompletedLiquidityEntry, COMPLETED_ZONE_TOLERANCE } from './types';
import { logSkippedBoxCreation, logReversalStructureDetected, logBoxCreated } from './diagnostics';

enum Direction {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

function getCandleDirection(candle: Candle): Direction {
  if (candle.close > candle.open) return Direction.BULLISH;
  if (candle.close < candle.open) return Direction.BEARISH;
  return Direction.NEUTRAL;
}

function detectTwoConsecutiveOpposite(
  candles: Candle[],
  startIndex: number,
  currentDirection: Direction
): number | null {
  if (startIndex + 1 >= candles.length) return null;

  const oppositeDirection = currentDirection === Direction.BULLISH ? Direction.BEARISH : Direction.BULLISH;

  for (let i = startIndex; i < candles.length - 1; i++) {
    const dir1 = getCandleDirection(candles[i]);
    const dir2 = getCandleDirection(candles[i + 1]);

    if (dir1 === oppositeDirection && dir2 === oppositeDirection) {
      return i;
    }
  }

  return null;
}

function isPriceBreakingLine(candle: Candle, linePrice: number): boolean {
  return candle.low <= linePrice && candle.high >= linePrice;
}

/**
 * REQ-27: Enhanced reversal structure detection with improved end-of-opposite-move logic
 * to ensure lower zones like ~27k-25k are consistently detected.
 */
function detectReversalStructure(
  candles: Candle[],
  startIndex: number,
  oppositeStartIndex: number
): { lowerWick: number; upperWick: number; lowerBodyBound: number; upperBodyBound: number; endIndex: number } | null {
  if (oppositeStartIndex >= candles.length - 1) return null;

  let endIndex = oppositeStartIndex + 1;
  const oppositeDirection = getCandleDirection(candles[oppositeStartIndex]);
  
  // REQ-27: Increased lookahead to capture longer opposite moves
  const maxLookahead = Math.min(candles.length - oppositeStartIndex - 1, 30);

  let consecutiveNonOpposite = 0;
  for (let i = oppositeStartIndex + 2; i < oppositeStartIndex + maxLookahead; i++) {
    if (i >= candles.length) break;
    
    const dir = getCandleDirection(candles[i]);
    
    if (dir === Direction.NEUTRAL) {
      endIndex = i;
      continue;
    }
    
    if (dir !== oppositeDirection) {
      consecutiveNonOpposite++;
      if (consecutiveNonOpposite >= 2) {
        endIndex = i - 2;
        break;
      }
    } else {
      consecutiveNonOpposite = 0;
      endIndex = i;
    }
  }

  // REQ-27: Calculate wick and body ranges
  let lowerWick = Infinity;
  let upperWick = -Infinity;
  let lowerBodyBound = Infinity;
  let upperBodyBound = -Infinity;

  for (let i = oppositeStartIndex; i <= endIndex; i++) {
    const candle = candles[i];
    lowerWick = Math.min(lowerWick, candle.low);
    upperWick = Math.max(upperWick, candle.high);
    
    const bodyLow = Math.min(candle.open, candle.close);
    const bodyHigh = Math.max(candle.open, candle.close);
    lowerBodyBound = Math.min(lowerBodyBound, bodyLow);
    upperBodyBound = Math.max(upperBodyBound, bodyHigh);
  }

  return { lowerWick, upperWick, lowerBodyBound, upperBodyBound, endIndex };
}

function isCandleInsideBox(candle: Candle, box: LiquidityBox): boolean {
  return (
    (candle.low <= box.maxPrice && candle.low >= box.minPrice) ||
    (candle.high <= box.maxPrice && candle.high >= box.minPrice) ||
    (candle.low <= box.minPrice && candle.high >= box.maxPrice) ||
    (candle.close >= box.minPrice && candle.close <= box.maxPrice) ||
    (candle.open >= box.minPrice && candle.open <= box.maxPrice)
  );
}

function hasStrongDisplacement(candle: Candle, box: LiquidityBox): boolean {
  const boxMid = (box.minPrice + box.maxPrice) / 2;
  const boxHeight = box.maxPrice - box.minPrice;
  const distance = Math.abs(candle.close - boxMid);
  return distance > boxHeight * 2;
}

function matchesCompletedZone(
  box: { minPrice: number; maxPrice: number; isUpper: boolean },
  completedZones: CompletedLiquidityEntry[]
): boolean {
  const boxRange = box.maxPrice - box.minPrice;
  const tolerance = boxRange * COMPLETED_ZONE_TOLERANCE;

  return completedZones.some(completed => {
    if (completed.isUpper !== box.isUpper) return false;
    
    const minMatch = Math.abs(completed.minPrice - box.minPrice) <= tolerance;
    const maxMatch = Math.abs(completed.maxPrice - box.maxPrice) <= tolerance;
    
    return minMatch && maxMatch;
  });
}

/**
 * REQ-28: Exported lifecycle evaluation helper for re-evaluating persisted boxes
 */
export function evaluateBoxLifecycle(
  box: LiquidityBox,
  candles: Candle[],
  currentIndex: number
): { state: LiquidityBoxState; touchCount: number; lastTouchIndex: number } {
  let touchCount = 0;
  let lastTouchIndex = -1;
  
  for (let i = box.candleIndex + 1; i <= currentIndex; i++) {
    const candle = candles[i];
    
    if (isCandleInsideBox(candle, box)) {
      touchCount++;
      lastTouchIndex = i;
    }
  }
  
  // REQ-28: CRITICAL - Untouched boxes MUST remain untouched
  if (touchCount === 0) {
    return { state: 'untouched', touchCount: 0, lastTouchIndex: -1 };
  }
  
  const candlesSinceLastTouch = currentIndex - lastTouchIndex;
  const recentlyActive = candlesSinceLastTouch <= 3;
  
  if (recentlyActive) {
    return { state: 'active', touchCount, lastTouchIndex };
  }
  
  // REQ-28: Check for cleared state (touched + strong displacement)
  if (touchCount > 0 && lastTouchIndex >= 0) {
    const currentCandle = candles[currentIndex];
    
    if (hasStrongDisplacement(currentCandle, box)) {
      if (candlesSinceLastTouch >= 2) {
        return { state: 'cleared', touchCount, lastTouchIndex };
      }
    }
  }
  
  return { state: 'untouched', touchCount, lastTouchIndex };
}

function deduplicateBoxes(boxes: LiquidityBox[]): LiquidityBox[] {
  const deduplicated: LiquidityBox[] = [];
  
  for (const box of boxes) {
    const identical = deduplicated.find(
      (existing) =>
        existing.isUpper === box.isUpper &&
        existing.candleIndex === box.candleIndex &&
        Math.abs(existing.minPrice - box.minPrice) < 0.01 &&
        Math.abs(existing.maxPrice - box.maxPrice) < 0.01
    );
    
    if (!identical) {
      deduplicated.push(box);
    }
  }
  
  return deduplicated;
}

export function computeLiquidityModel(candles: Candle[]): LiquidityModel {
  if (candles.length === 0) {
    return { lines: [], boxes: [] };
  }

  const lines: LiquidityLine[] = [];
  const rawBoxes: LiquidityBox[] = [];
  
  const invalidatedBoxes: Set<string> = new Set();
  const completedZones: CompletedLiquidityEntry[] = [];

  const getBoxSignature = (box: { minPrice: number; maxPrice: number; isUpper: boolean; candleIndex: number }): string => {
    return `${box.isUpper ? 'U' : 'L'}-${box.minPrice.toFixed(2)}-${box.maxPrice.toFixed(2)}-${box.candleIndex}`;
  };

  let currentLinePrice = candles[0].low;
  let currentLineIndex = 0;

  lines.push({
    price: currentLinePrice,
    createdAt: candles[0].time,
    candleIndex: 0,
  });

  let currentDirection = Direction.BULLISH;
  let searchIndex = 1;

  while (searchIndex < candles.length) {
    const candle = candles[searchIndex];

    if (isPriceBreakingLine(candle, currentLinePrice)) {
      const oppositeIndex = detectTwoConsecutiveOpposite(candles, searchIndex + 1, currentDirection);

      if (oppositeIndex !== null) {
        const oppositeCandle = candles[oppositeIndex];
        const newLinePrice = currentDirection === Direction.BULLISH ? oppositeCandle.low : oppositeCandle.high;

        lines.push({
          price: newLinePrice,
          createdAt: oppositeCandle.time,
          candleIndex: oppositeIndex,
        });

        const reversal = detectReversalStructure(candles, searchIndex, oppositeIndex);

        if (reversal) {
          logReversalStructureDetected(
            oppositeIndex,
            reversal.endIndex,
            reversal.lowerWick,
            reversal.upperWick,
            currentDirection
          );

          // REQ-27: Create lower box with improved bounds calculation
          const lowerBoxMin = reversal.lowerWick;
          const lowerBoxMax = reversal.lowerBodyBound;
          
          const isLowerBoxValid = 
            isFinite(lowerBoxMin) && 
            isFinite(lowerBoxMax) && 
            lowerBoxMin < lowerBoxMax &&
            (lowerBoxMax - lowerBoxMin) > 0.01;

          if (isLowerBoxValid) {
            const lowerBox = {
              minPrice: lowerBoxMin,
              maxPrice: lowerBoxMax,
              createdAt: candles[oppositeIndex].time,
              candleIndex: oppositeIndex,
              isUpper: false,
              state: 'untouched' as LiquidityBoxState,
              touchCount: 0,
              lastTouchIndex: -1,
            };
            
            if (!matchesCompletedZone(lowerBox, completedZones)) {
              rawBoxes.push(lowerBox);
              logBoxCreated('lower', lowerBoxMin, lowerBoxMax, oppositeIndex);
            } else {
              logSkippedBoxCreation({
                oppositeStartIndex: oppositeIndex,
                endIndex: reversal.endIndex,
                lowerWick: reversal.lowerWick,
                upperWick: reversal.upperWick,
                lowerBodyBound: reversal.lowerBodyBound,
                upperBodyBound: reversal.upperBodyBound,
                computedLowerBoxMin: lowerBoxMin,
                computedLowerBoxMax: lowerBoxMax,
                computedUpperBoxMin: 0,
                computedUpperBoxMax: 0,
                reason: 'Lower box matches completed zone (already touched+cleared)',
              });
            }
          } else {
            logSkippedBoxCreation({
              oppositeStartIndex: oppositeIndex,
              endIndex: reversal.endIndex,
              lowerWick: reversal.lowerWick,
              upperWick: reversal.upperWick,
              lowerBodyBound: reversal.lowerBodyBound,
              upperBodyBound: reversal.upperBodyBound,
              computedLowerBoxMin: lowerBoxMin,
              computedLowerBoxMax: lowerBoxMax,
              computedUpperBoxMin: 0,
              computedUpperBoxMax: 0,
              reason: `Invalid lower box bounds: min=${lowerBoxMin.toFixed(2)}, max=${lowerBoxMax.toFixed(2)}`,
            });
          }

          // Create upper box
          if (reversal.endIndex - oppositeIndex >= 1) {
            const upperBoxMin = reversal.upperBodyBound;
            const upperBoxMax = reversal.upperWick;
            
            const isUpperBoxValid = 
              isFinite(upperBoxMin) && 
              isFinite(upperBoxMax) && 
              upperBoxMin < upperBoxMax &&
              (upperBoxMax - upperBoxMin) > 0.01;

            if (isUpperBoxValid) {
              const upperBox = {
                minPrice: upperBoxMin,
                maxPrice: upperBoxMax,
                createdAt: candles[reversal.endIndex].time,
                candleIndex: reversal.endIndex,
                isUpper: true,
                state: 'untouched' as LiquidityBoxState,
                touchCount: 0,
                lastTouchIndex: -1,
              };
              
              if (!matchesCompletedZone(upperBox, completedZones)) {
                rawBoxes.push(upperBox);
                logBoxCreated('upper', upperBoxMin, upperBoxMax, reversal.endIndex);
              } else {
                logSkippedBoxCreation({
                  oppositeStartIndex: oppositeIndex,
                  endIndex: reversal.endIndex,
                  lowerWick: reversal.lowerWick,
                  upperWick: reversal.upperWick,
                  lowerBodyBound: reversal.lowerBodyBound,
                  upperBodyBound: reversal.upperBodyBound,
                  computedLowerBoxMin: lowerBoxMin,
                  computedLowerBoxMax: lowerBoxMax,
                  computedUpperBoxMin: upperBoxMin,
                  computedUpperBoxMax: upperBoxMax,
                  reason: 'Upper box matches completed zone (already touched+cleared)',
                });
              }
            } else {
              logSkippedBoxCreation({
                oppositeStartIndex: oppositeIndex,
                endIndex: reversal.endIndex,
                lowerWick: reversal.lowerWick,
                upperWick: reversal.upperWick,
                lowerBodyBound: reversal.lowerBodyBound,
                upperBodyBound: reversal.upperBodyBound,
                computedLowerBoxMin: lowerBoxMin,
                computedLowerBoxMax: lowerBoxMax,
                computedUpperBoxMin: upperBoxMin,
                computedUpperBoxMax: upperBoxMax,
                reason: `Invalid upper box bounds: min=${upperBoxMin.toFixed(2)}, max=${upperBoxMax.toFixed(2)}`,
              });
            }
          }
        }

        currentLinePrice = newLinePrice;
        currentLineIndex = oppositeIndex;
        currentDirection = currentDirection === Direction.BULLISH ? Direction.BEARISH : Direction.BULLISH;
        searchIndex = oppositeIndex + 2;
      } else {
        break;
      }
    } else {
      searchIndex++;
    }
  }

  // REQ-28: Evaluate lifecycle for all boxes
  const currentIndex = candles.length - 1;
  const processedBoxes: LiquidityBox[] = [];

  for (const box of rawBoxes) {
    const signature = getBoxSignature(box);
    
    if (invalidatedBoxes.has(signature)) {
      continue;
    }
    
    const { state, touchCount, lastTouchIndex } = evaluateBoxLifecycle(box, candles, currentIndex);
    
    const updatedBox = {
      ...box,
      state,
      touchCount,
      lastTouchIndex,
    };
    
    if (state === 'cleared') {
      invalidatedBoxes.add(signature);
      completedZones.push({
        minPrice: box.minPrice,
        maxPrice: box.maxPrice,
        isUpper: box.isUpper,
      });
      continue;
    }
    
    processedBoxes.push(updatedBox);
  }

  const finalBoxes = deduplicateBoxes(processedBoxes);
  const recentLines = lines.slice(-5);

  return {
    lines: recentLines,
    boxes: finalBoxes,
  };
}
