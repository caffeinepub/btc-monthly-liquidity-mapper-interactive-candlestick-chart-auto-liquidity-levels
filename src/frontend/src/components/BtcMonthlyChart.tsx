import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Candle } from '../features/data/types';
import { useLiquidityModel } from '../features/liquidity/useLiquidityModel';

interface BtcMonthlyChartProps {
  candles: Candle[];
}

interface CandleChartData {
  time: string;
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  range: [number, number];
  color: string;
}

export function BtcMonthlyChart({ candles }: BtcMonthlyChartProps) {
  const { lines, boxes } = useLiquidityModel(candles);

  const chartData = useMemo<CandleChartData[]>(() => {
    return candles.map((candle) => {
      const date = new Date(candle.time);
      const isGreen = candle.close >= candle.open;
      return {
        time: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        date: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        range: [Math.min(candle.open, candle.close), Math.max(candle.open, candle.close)] as [number, number],
        color: isGreen ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))',
      };
    });
  }, [candles]);

  const priceRange = useMemo(() => {
    if (candles.length === 0) return { min: 0, max: 100000 };
    const allPrices = candles.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const padding = (max - min) * 0.1;
    return {
      min: Math.floor(min - padding),
      max: Math.ceil(max + padding),
    };
  }, [candles]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <p className="mb-2 text-xs font-semibold text-foreground">{data.time}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Open:</span>
            <span className="font-mono font-medium text-foreground">${data.open.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">High:</span>
            <span className="font-mono font-medium text-chart-2">${data.high.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Low:</span>
            <span className="font-mono font-medium text-destructive">${data.low.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Close:</span>
            <span className="font-mono font-medium text-foreground">${data.close.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  const CandlestickShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload || !payload.open || !payload.close || !payload.high || !payload.low) return null;

    const { open, close, high, low, color } = payload;
    const isGreen = close >= open;

    const centerX = x + width / 2;
    const bodyTop = Math.min(open, close);
    const bodyBottom = Math.max(open, close);
    const bodyHeight = Math.abs(close - open);

    const chartHeight = 600 - 40;
    const pricePerPixel = (priceRange.max - priceRange.min) / chartHeight;

    const highY = y - ((high - bodyBottom) / pricePerPixel);
    const lowY = y + height + ((bodyTop - low) / pricePerPixel);
    const bodyY = y;
    const bodyPixelHeight = height;

    return (
      <g>
        <line
          x1={centerX}
          y1={highY}
          x2={centerX}
          y2={bodyY}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={centerX}
          y1={bodyY + bodyPixelHeight}
          x2={centerX}
          y2={lowY}
          stroke={color}
          strokeWidth={1}
        />
        <rect
          x={x + 1}
          y={bodyY}
          width={Math.max(width - 2, 1)}
          height={Math.max(bodyPixelHeight, 1)}
          fill={isGreen ? color : 'transparent'}
          stroke={color}
          strokeWidth={isGreen ? 0 : 1}
        />
      </g>
    );
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={600}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <defs>
            <linearGradient id="bullishGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="bearishGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            domain={[priceRange.min, priceRange.max]}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* REQ-28 & REQ-29: Render all non-cleared boxes with stable keys */}
          {boxes.map((box) => {
            const startIndex = Math.max(0, Math.min(box.candleIndex, candles.length - 1));
            const x1 = chartData[startIndex]?.time;
            const x2 = chartData[chartData.length - 1]?.time;
            
            // REQ-28: Development-only rendering warning
            if (!x1 || !x2) {
              if (import.meta.env.DEV) {
                console.warn(
                  '[RENDERING WARNING] Liquidity box coordinate resolution failed:',
                  {
                    minPrice: box.minPrice,
                    maxPrice: box.maxPrice,
                    candleIndex: box.candleIndex,
                    isUpper: box.isUpper,
                    state: box.state,
                    resolvedStartIndex: startIndex,
                    chartDataLength: chartData.length,
                  }
                );
              }
              return null;
            }

            let fillColor: string;
            let strokeColor: string;
            let fillOpacity: number;
            
            if (box.state === 'active') {
              fillColor = 'hsl(var(--liquidity-active))';
              strokeColor = 'hsl(var(--liquidity-active-border))';
              fillOpacity = 0.2;
            } else {
              fillColor = 'hsl(var(--liquidity-untouched))';
              strokeColor = 'hsl(var(--liquidity-untouched-border))';
              fillOpacity = 0.15;
            }

            // REQ-29: Stable React key to prevent flicker
            const stableKey = `box-${box.isUpper ? 'U' : 'L'}-${box.candleIndex}-${box.minPrice.toFixed(2)}-${box.maxPrice.toFixed(2)}`;

            return (
              <ReferenceArea
                key={stableKey}
                x1={x1}
                x2={x2}
                y1={box.minPrice}
                y2={box.maxPrice}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={box.state === 'active' ? 1.5 : 1}
                strokeDasharray={box.state === 'active' ? '4 2' : '3 3'}
              />
            );
          })}

          {lines.map((line, idx) => (
            <ReferenceLine
              key={`line-${idx}`}
              y={line.price}
              stroke="hsl(var(--accent))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              label={{
                value: `$${line.price.toLocaleString()}`,
                position: 'right',
                fill: 'hsl(var(--accent))',
                fontSize: 10,
              }}
            />
          ))}

          <Bar dataKey="range" shape={<CandlestickShape />} isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded border border-[hsl(var(--liquidity-untouched-border))] bg-[hsl(var(--liquidity-untouched))] opacity-60" />
          <span className="text-muted-foreground">Untouched Liquidity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded border border-[hsl(var(--liquidity-active-border))] bg-[hsl(var(--liquidity-active))] opacity-70" />
          <span className="text-muted-foreground">Active Zone (1-3 candles)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 bg-[hsl(var(--accent))]" style={{ backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--accent)) 0, hsl(var(--accent)) 5px, transparent 5px, transparent 10px)' }} />
          <span className="text-muted-foreground">Liquidity Lines</span>
        </div>
      </div>
    </div>
  );
}
