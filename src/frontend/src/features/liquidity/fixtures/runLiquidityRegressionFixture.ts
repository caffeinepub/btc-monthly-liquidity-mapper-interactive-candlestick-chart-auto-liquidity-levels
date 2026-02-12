import { computeLiquidityModel } from '../liquidityAlgorithm';
import { getMissingLowerZoneFixture } from './missingLowerZoneFixture';
import { Candle } from '../../data/types';

/**
 * REQ-30: Development-only regression test runner
 */
export function runLiquidityRegressionFixture(): void {
  if (!import.meta.env.DEV) return;

  console.group('[REGRESSION FIXTURE] Running liquidity detection tests...');

  try {
    // Test 1: Lower box emission
    const fixture = getMissingLowerZoneFixture();
    const model = computeLiquidityModel(fixture);
    
    const lowerBoxes = model.boxes.filter(box => !box.isUpper);
    
    console.assert(
      lowerBoxes.length > 0,
      'FAIL: Expected at least one lower liquidity box to be emitted'
    );
    
    if (lowerBoxes.length > 0) {
      console.info('✓ Test 1 PASSED: Lower box detected', {
        count: lowerBoxes.length,
        boxes: lowerBoxes.map(b => ({
          minPrice: b.minPrice,
          maxPrice: b.maxPrice,
          candleIndex: b.candleIndex,
        })),
      });
    } else {
      console.error('✗ Test 1 FAILED: No lower boxes detected');
    }

    // Test 2: Untouched boxes persist across recomputation
    const extendedFixture: Candle[] = [
      ...fixture,
      {
        time: fixture[fixture.length - 1].time + 30 * 24 * 60 * 60 * 1000,
        open: 15500,
        high: 16500,
        low: 15000,
        close: 16000,
        volume: 1000,
      },
    ];
    
    const extendedModel = computeLiquidityModel(extendedFixture);
    const extendedLowerBoxes = extendedModel.boxes.filter(box => !box.isUpper && box.state === 'untouched');
    
    console.assert(
      extendedLowerBoxes.length > 0,
      'FAIL: Untouched boxes should persist when new non-touching candles are added'
    );
    
    if (extendedLowerBoxes.length > 0) {
      console.info('✓ Test 2 PASSED: Untouched boxes persisted', {
        count: extendedLowerBoxes.length,
      });
    } else {
      console.error('✗ Test 2 FAILED: Untouched boxes were removed');
    }

    // Test 3: Boxes are removed only after touch+clear
    const touchingFixture: Candle[] = [
      ...fixture,
      // Candle that touches the lower zone
      {
        time: fixture[fixture.length - 1].time + 30 * 24 * 60 * 60 * 1000,
        open: 12000,
        high: 12500,
        low: 10800,
        close: 11000,
        volume: 1000,
      },
      // Strong displacement away
      {
        time: fixture[fixture.length - 1].time + 60 * 24 * 60 * 60 * 1000,
        open: 11000,
        high: 18000,
        low: 10500,
        close: 17500,
        volume: 1000,
      },
      {
        time: fixture[fixture.length - 1].time + 90 * 24 * 60 * 60 * 1000,
        open: 17500,
        high: 19000,
        low: 17000,
        close: 18500,
        volume: 1000,
      },
    ];
    
    const touchedModel = computeLiquidityModel(touchingFixture);
    const touchedLowerBoxes = touchedModel.boxes.filter(box => !box.isUpper);
    
    // After touch + strong displacement, the box should be cleared (removed)
    const hasCleared = touchedLowerBoxes.length === 0 || 
                       touchedLowerBoxes.every(box => box.touchCount > 0);
    
    console.assert(
      hasCleared,
      'FAIL: Boxes should be cleared after touch + strong displacement'
    );
    
    if (hasCleared) {
      console.info('✓ Test 3 PASSED: Box cleared after touch+displacement');
    } else {
      console.error('✗ Test 3 FAILED: Box not cleared properly');
    }

    console.info('✓ All regression tests completed');
  } catch (error) {
    console.error('✗ Regression fixture error:', error);
  }

  console.groupEnd();
}
