import { Candle } from '../data/types';
import { LiquidityLine, LiquidityBox, LiquidityModel, LiquidityBoxState } from './types';

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
      return i; // Return index of first opposite candle
    }
  }

  return null;
}

function isPriceBreakingLine(candle: Candle, linePrice: number): boolean {
  // Check if candle breaks through the line (either high or low crosses it)
  return candle.low <= linePrice && candle.high >= linePrice;
}

function detectReversalStructure(
  candles: Candle[],
  startIndex: number,
  oppositeStartIndex: number
): { lowerWick: number; upperWick: number; endIndex: number } | null {
  if (oppositeStartIndex >= candles.length - 1) return null;

  // Find the end of the opposite move (when trend resumes or reaches end)
  let endIndex = oppositeStartIndex + 1;
  const oppositeDirection = getCandleDirection(candles[oppositeStartIndex]);

  // Look ahead to find where opposite move ends
  for (let i = oppositeStartIndex + 2; i < Math.min(candles.length, oppositeStartIndex + 10); i++) {
    const dir = getCandleDirection(candles[i]);
    if (dir !== oppositeDirection && dir !== Direction.NEUTRAL) {
      endIndex = i - 1;
      break;
    }
    endIndex = i;
  }

  // Calculate wick range for the opposite move period
  let lowerWick = Infinity;
  let upperWick = -Infinity;

  for (let i = oppositeStartIndex; i <= endIndex; i++) {
    lowerWick = Math.min(lowerWick, candles[i].low);
    upperWick = Math.max(upperWick, candles[i].high);
  }

  return { lowerWick, upperWick, endIndex };
}

function isCandleInsideBox(candle: Candle, box: LiquidityBox): boolean {
  // Check if candle's body or wicks are inside the box
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
  
  // Strong displacement means price moved significantly away from the box
  const distance = Math.abs(candle.close - boxMid);
  return distance > boxHeight * 2;
}

function computeBoxState(
  box: LiquidityBox,
  candles: Candle[],
  currentIndex: number
): { state: LiquidityBoxState; touchCount: number; lastTouchIndex: number } {
  let touchCount = 0;
  let lastTouchIndex = -1;
  let firstTouchIndex = -1;
  
  // Track interactions with subsequent candles
  for (let i = box.candleIndex + 1; i <= currentIndex; i++) {
    const candle = candles[i];
    
    if (isCandleInsideBox(candle, box)) {
      touchCount++;
      lastTouchIndex = i;
      if (firstTouchIndex === -1) {
        firstTouchIndex = i;
      }
    }
  }
  
  // Rule 1: Untouched boxes remain permanently visible
  if (touchCount === 0) {
    return { state: 'untouched', touchCount: 0, lastTouchIndex: -1 };
  }
  
  // Rule 2: Active if price is currently inside or recently inside (1-3 candles)
  const candlesSinceLastTouch = currentIndex - lastTouchIndex;
  const recentlyActive = candlesSinceLastTouch <= 3;
  
  if (recentlyActive) {
    return { state: 'active', touchCount, lastTouchIndex };
  }
  
  // Rule 3: Touched and cleared - check for strong displacement away
  if (touchCount > 0 && lastTouchIndex >= 0) {
    const currentCandle = candles[currentIndex];
    
    // Check if price has moved strongly away from the box
    if (hasStrongDisplacement(currentCandle, box)) {
      // Verify no recent interaction (at least 2 candles away)
      if (candlesSinceLastTouch >= 2) {
        return { state: 'cleared', touchCount, lastTouchIndex };
      }
    }
  }
  
  // Default: keep as untouched if touched but not cleared
  return { state: 'untouched', touchCount, lastTouchIndex };
}

function deduplicateBoxes(boxes: LiquidityBox[]): LiquidityBox[] {
  const deduplicated: LiquidityBox[] = [];
  
  for (const box of boxes) {
    // Check if a similar box already exists
    const similar = deduplicated.find(
      (existing) =>
        existing.isUpper === box.isUpper &&
        Math.abs(existing.minPrice - box.minPrice) < (box.maxPrice - box.minPrice) * 0.1 &&
        Math.abs(existing.maxPrice - box.maxPrice) < (box.maxPrice - box.minPrice) * 0.1
    );
    
    if (!similar) {
      deduplicated.push(box);
    } else {
      // Keep the one with more recent creation or better state
      const existingIndex = deduplicated.indexOf(similar);
      if (box.state === 'active' && similar.state !== 'active') {
        deduplicated[existingIndex] = box;
      } else if (box.candleIndex > similar.candleIndex && box.state === similar.state) {
        deduplicated[existingIndex] = box;
      }
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

  // Step 1: Initial horizontal line at first candle's lower wick
  let currentLinePrice = candles[0].low;
  let currentLineIndex = 0;

  lines.push({
    price: currentLinePrice,
    createdAt: candles[0].time,
    candleIndex: 0,
  });

  let currentDirection = Direction.BULLISH; // Start assuming bullish
  let searchIndex = 1;

  // Step 2: Process candles for breakouts and opposite candle detection (unchanged)
  while (searchIndex < candles.length) {
    const candle = candles[searchIndex];

    // Check if current line is broken
    if (isPriceBreakingLine(candle, currentLinePrice)) {
      // Line broken, look for next two consecutive opposite candles
      const oppositeIndex = detectTwoConsecutiveOpposite(candles, searchIndex + 1, currentDirection);

      if (oppositeIndex !== null) {
        // Create new line at wick of first opposite candle
        const oppositeCandle = candles[oppositeIndex];
        const newLinePrice = currentDirection === Direction.BULLISH ? oppositeCandle.low : oppositeCandle.high;

        lines.push({
          price: newLinePrice,
          createdAt: oppositeCandle.time,
          candleIndex: oppositeIndex,
        });

        // Detect reversal structure for liquidity boxes
        const reversal = detectReversalStructure(candles, searchIndex, oppositeIndex);

        if (reversal) {
          // Create lower liquidity box
          rawBoxes.push({
            minPrice: reversal.lowerWick,
            maxPrice: reversal.lowerWick + (reversal.upperWick - reversal.lowerWick) * 0.2,
            createdAt: candles[oppositeIndex].time,
            candleIndex: oppositeIndex,
            isUpper: false,
            state: 'untouched',
            touchCount: 0,
            lastTouchIndex: -1,
          });

          // Create upper liquidity box if there's a small opposite move
          if (reversal.endIndex - oppositeIndex >= 1) {
            rawBoxes.push({
              minPrice: reversal.upperWick - (reversal.upperWick - reversal.lowerWick) * 0.2,
              maxPrice: reversal.upperWick,
              createdAt: candles[reversal.endIndex].time,
              candleIndex: reversal.endIndex,
              isUpper: true,
              state: 'untouched',
              touchCount: 0,
              lastTouchIndex: -1,
            });
          }
        }

        currentLinePrice = newLinePrice;
        currentLineIndex = oppositeIndex;
        currentDirection = currentDirection === Direction.BULLISH ? Direction.BEARISH : Direction.BULLISH;
        searchIndex = oppositeIndex + 2;
      } else {
        break; // No more opposite candles found
      }
    } else {
      searchIndex++;
    }
  }

  // Step 3: Apply new lifecycle rules - compute state for each box
  const currentIndex = candles.length - 1;
  const processedBoxes: LiquidityBox[] = [];

  for (const box of rawBoxes) {
    const { state, touchCount, lastTouchIndex } = computeBoxState(box, candles, currentIndex);
    
    // Only keep boxes that are not cleared
    if (state !== 'cleared') {
      processedBoxes.push({
        ...box,
        state,
        touchCount,
        lastTouchIndex,
      });
    }
  }

  // Step 4: Deduplicate overlapping boxes
  const finalBoxes = deduplicateBoxes(processedBoxes);

  // Keep only the most recent relevant lines (last 5)
  const recentLines = lines.slice(-5);

  return {
    lines: recentLines,
    boxes: finalBoxes,
  };
}
