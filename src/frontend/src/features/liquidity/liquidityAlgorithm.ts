import { Candle } from '../data/types';
import { LiquidityLine, LiquidityBox, LiquidityModel } from './types';

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

export function computeLiquidityModel(candles: Candle[]): LiquidityModel {
  if (candles.length === 0) {
    return { lines: [], boxes: [] };
  }

  const lines: LiquidityLine[] = [];
  const boxes: LiquidityBox[] = [];

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

  // Step 2: Process candles for breakouts and opposite candle detection
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
          boxes.push({
            minPrice: reversal.lowerWick,
            maxPrice: reversal.lowerWick + (reversal.upperWick - reversal.lowerWick) * 0.2, // 20% of range
            createdAt: candles[oppositeIndex].time,
            candleIndex: oppositeIndex,
            isActive: true,
            isUpper: false,
            touchCount: 0,
            lastTouchIndex: -1,
          });

          // Create upper liquidity box if there's a small opposite move
          if (reversal.endIndex - oppositeIndex >= 1) {
            boxes.push({
              minPrice: reversal.upperWick - (reversal.upperWick - reversal.lowerWick) * 0.2,
              maxPrice: reversal.upperWick,
              createdAt: candles[reversal.endIndex].time,
              candleIndex: reversal.endIndex,
              isActive: true,
              isUpper: true,
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

  // Step 3: Apply box invalidation rules
  const activeBoxes: LiquidityBox[] = [];

  boxes.forEach((box) => {
    let shouldKeep = true;
    let touchCount = 0;
    let lastTouchIndex = -1;

    // Check interactions with subsequent candles
    for (let i = box.candleIndex + 1; i < candles.length; i++) {
      const candle = candles[i];

      // Check if candle touches the box
      const touches =
        (candle.low <= box.maxPrice && candle.low >= box.minPrice) ||
        (candle.high <= box.maxPrice && candle.high >= box.minPrice) ||
        (candle.low <= box.minPrice && candle.high >= box.maxPrice);

      if (touches) {
        touchCount++;
        lastTouchIndex = i;

        // Rule: If touched and then clear move away (more than 3 candles later and price far away)
        if (i - lastTouchIndex > 3) {
          const currentCandle = candles[candles.length - 1];
          const boxMid = (box.minPrice + box.maxPrice) / 2;
          const distance = Math.abs(currentCandle.close - boxMid);
          const boxHeight = box.maxPrice - box.minPrice;

          if (distance > boxHeight * 3) {
            shouldKeep = false;
            break;
          }
        }
      }

      // Rule: Upper liquidity cleared (price breaks above and stays above)
      if (box.isUpper && candle.close > box.maxPrice) {
        const subsequentAbove = candles.slice(i, i + 2).every((c) => c.close > box.maxPrice);
        if (subsequentAbove) {
          shouldKeep = false;
          break;
        }
      }
    }

    // Rule: Keep active if only 1-3 candles interacted and price still around
    if (touchCount > 0 && touchCount <= 3 && lastTouchIndex >= 0) {
      const candlesSinceTouch = candles.length - 1 - lastTouchIndex;
      if (candlesSinceTouch <= 5) {
        shouldKeep = true;
      }
    }

    // Rule: Time-based cleanup - if touched long ago and many candles passed
    if (lastTouchIndex >= 0) {
      const candlesSinceTouch = candles.length - 1 - lastTouchIndex;
      if (candlesSinceTouch > 20) {
        shouldKeep = false;
      }
    }

    if (shouldKeep) {
      activeBoxes.push({
        ...box,
        touchCount,
        lastTouchIndex,
        isActive: touchCount <= 3 || lastTouchIndex < 0,
      });
    }
  });

  // Keep only the most recent relevant lines (last 5)
  const recentLines = lines.slice(-5);

  return {
    lines: recentLines,
    boxes: activeBoxes,
  };
}
