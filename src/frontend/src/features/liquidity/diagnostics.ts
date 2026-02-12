/**
 * Development-only diagnostics helper for liquidity detection.
 * REQ-27: Enhanced to include body bounds in skip diagnostics.
 */

interface ReversalStructureDiagnostic {
  oppositeStartIndex: number;
  endIndex: number;
  lowerWick: number;
  upperWick: number;
  lowerBodyBound: number;
  upperBodyBound: number;
  computedLowerBoxMin: number;
  computedLowerBoxMax: number;
  computedUpperBoxMin: number;
  computedUpperBoxMax: number;
  reason: string;
}

export function logSkippedBoxCreation(diagnostic: ReversalStructureDiagnostic): void {
  if (import.meta.env.DEV) {
    console.warn(
      '[LIQUIDITY DETECTION] Box creation skipped after reversal structure detected:',
      {
        structure: {
          oppositeStartIndex: diagnostic.oppositeStartIndex,
          endIndex: diagnostic.endIndex,
          span: diagnostic.endIndex - diagnostic.oppositeStartIndex + 1,
        },
        wickRange: {
          lower: diagnostic.lowerWick.toFixed(2),
          upper: diagnostic.upperWick.toFixed(2),
          range: (diagnostic.upperWick - diagnostic.lowerWick).toFixed(2),
        },
        bodyBounds: {
          lower: diagnostic.lowerBodyBound.toFixed(2),
          upper: diagnostic.upperBodyBound.toFixed(2),
          range: (diagnostic.upperBodyBound - diagnostic.lowerBodyBound).toFixed(2),
        },
        computedBounds: {
          lowerBox: {
            min: diagnostic.computedLowerBoxMin.toFixed(2),
            max: diagnostic.computedLowerBoxMax.toFixed(2),
            range: (diagnostic.computedLowerBoxMax - diagnostic.computedLowerBoxMin).toFixed(2),
            valid: diagnostic.computedLowerBoxMin < diagnostic.computedLowerBoxMax && 
                   isFinite(diagnostic.computedLowerBoxMin) && 
                   isFinite(diagnostic.computedLowerBoxMax),
          },
          upperBox: {
            min: diagnostic.computedUpperBoxMin.toFixed(2),
            max: diagnostic.computedUpperBoxMax.toFixed(2),
            range: (diagnostic.computedUpperBoxMax - diagnostic.computedUpperBoxMin).toFixed(2),
            valid: diagnostic.computedUpperBoxMin < diagnostic.computedUpperBoxMax && 
                   isFinite(diagnostic.computedUpperBoxMin) && 
                   isFinite(diagnostic.computedUpperBoxMax),
          },
        },
        reason: diagnostic.reason,
      }
    );
  }
}

export function logReversalStructureDetected(
  oppositeStartIndex: number,
  endIndex: number,
  lowerWick: number,
  upperWick: number,
  currentDirection: string
): void {
  if (import.meta.env.DEV) {
    console.info(
      '[LIQUIDITY DETECTION] Reversal structure detected:',
      {
        oppositeStartIndex,
        endIndex,
        span: endIndex - oppositeStartIndex + 1,
        currentDirection,
        wickRange: {
          lower: lowerWick.toFixed(2),
          upper: upperWick.toFixed(2),
          range: (upperWick - lowerWick).toFixed(2),
        },
      }
    );
  }
}

export function logBoxCreated(
  boxType: 'lower' | 'upper',
  minPrice: number,
  maxPrice: number,
  candleIndex: number
): void {
  if (import.meta.env.DEV) {
    console.info(
      `[LIQUIDITY DETECTION] ${boxType.toUpperCase()} box created:`,
      {
        type: boxType,
        minPrice: minPrice.toFixed(2),
        maxPrice: maxPrice.toFixed(2),
        range: (maxPrice - minPrice).toFixed(2),
        candleIndex,
      }
    );
  }
}
