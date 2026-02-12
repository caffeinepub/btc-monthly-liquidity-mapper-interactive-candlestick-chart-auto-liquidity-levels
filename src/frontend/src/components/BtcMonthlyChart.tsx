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

  // Convert candles to chart format
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

  // Calculate price range for better chart scaling
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

  // Custom shape for candlestick rendering
  const CandlestickShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload || !payload.open || !payload.close || !payload.high || !payload.low) return null;

    const { open, close, high, low, color } = payload;
    const isGreen = close >= open;

    // Calculate dimensions
    const centerX = x + width / 2;
    const bodyTop = Math.min(open, close);
    const bodyBottom = Math.max(open, close);
    const bodyHeight = Math.abs(close - open);

    // Scale factor for converting price to pixels
    const chartHeight = 600 - 40; // Approximate chart height minus margins
    const pricePerPixel = (priceRange.max - priceRange.min) / chartHeight;

    // Calculate Y positions (inverted because SVG Y increases downward)
    const highY = y - ((high - bodyBottom) / pricePerPixel);
    const lowY = y + height + ((bodyTop - low) / pricePerPixel);
    const bodyY = y;
    const bodyPixelHeight = height;

    return (
      <g>
        {/* Upper wick */}
        <line
          x1={centerX}
          y1={highY}
          x2={centerX}
          y2={bodyY}
          stroke={color}
          strokeWidth={1}
        />
        {/* Lower wick */}
        <line
          x1={centerX}
          y1={bodyY + bodyPixelHeight}
          x2={centerX}
          y2={lowY}
          stroke={color}
          strokeWidth={1}
        />
        {/* Body */}
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

          {/* Liquidity boxes with 3-state rendering */}
          {boxes.map((box, idx) => {
            const startIndex = candles.findIndex((c) => c.time >= box.createdAt);
            if (startIndex === -1) return null;

            // 3-state color system
            let fillColor: string;
            let strokeColor: string;
            let fillOpacity: number;
            
            if (box.state === 'active') {
              // Active: Strong highlight (yellow/orange)
              fillColor = 'hsl(var(--liquidity-active))';
              strokeColor = 'hsl(var(--liquidity-active-border))';
              fillOpacity = 0.2;
            } else {
              // Untouched: Neutral (soft blue/gray)
              fillColor = 'hsl(var(--liquidity-untouched))';
              strokeColor = 'hsl(var(--liquidity-untouched-border))';
              fillOpacity = 0.15;
            }

            return (
              <ReferenceArea
                key={`box-${idx}`}
                x1={chartData[startIndex]?.time}
                x2={chartData[chartData.length - 1]?.time}
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

          {/* Liquidity lines */}
          {lines.map((line, idx) => (
            <ReferenceLine
              key={`line-${idx}`}
              y={line.price}
              stroke="hsl(var(--accent))"
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{
                value: 'Liq',
                fill: 'hsl(var(--accent))',
                fontSize: 10,
                position: 'right',
              }}
            />
          ))}

          {/* Candlesticks using Bar with custom shape */}
          <Bar dataKey="range" shape={<CandlestickShape />}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded-sm border border-[hsl(var(--accent))] bg-[hsl(var(--accent))]" style={{ opacity: 0.3 }} />
          <span className="text-muted-foreground">Liquidity Line</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded-sm border-[1.5px] border-[hsl(var(--liquidity-active-border))] bg-[hsl(var(--liquidity-active))]" style={{ opacity: 0.25 }} />
          <span className="text-muted-foreground">Active Liquidity Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded-sm border border-[hsl(var(--liquidity-untouched-border))] bg-[hsl(var(--liquidity-untouched))]" style={{ opacity: 0.2 }} />
          <span className="text-muted-foreground">Untouched Liquidity Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-2))]" />
          <span className="text-muted-foreground">Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-[hsl(var(--destructive))]" />
          <span className="text-muted-foreground">Bearish</span>
        </div>
      </div>
    </div>
  );
}
