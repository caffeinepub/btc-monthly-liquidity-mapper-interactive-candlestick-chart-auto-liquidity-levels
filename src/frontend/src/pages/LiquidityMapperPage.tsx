import { useMonthlyCandles } from '../features/data/useMonthlyCandles';
import { ChartStates } from '../components/ChartStates';
import { BtcMonthlyChart } from '../components/BtcMonthlyChart';
import { TrendingUp } from 'lucide-react';

export function LiquidityMapperPage() {
  const { data: candles, isLoading, isError, error, refetch } = useMonthlyCandles();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-chart-1 to-chart-2">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">BTC Liquidity Mapper</h1>
              <p className="text-xs text-muted-foreground">Monthly Smart Money Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs sm:flex">
              <div className="h-2 w-2 rounded-full bg-chart-1 animate-pulse" />
              <span className="font-medium">1M Timeframe</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6">
        {isLoading && <ChartStates.Loading />}
        {isError && <ChartStates.Error error={error} onRetry={refetch} />}
        {!isLoading && !isError && (!candles || candles.length === 0) && <ChartStates.Empty />}
        {!isLoading && !isError && candles && candles.length > 0 && (
          <div className="rounded-lg border border-border/40 bg-card/50 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/30">
            <BtcMonthlyChart candles={candles} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container flex h-14 items-center justify-center px-4 text-xs text-muted-foreground">
          <p>
            Built with ❤️ using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                typeof window !== 'undefined' ? window.location.hostname : 'btc-liquidity-mapper'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              caffeine.ai
            </a>{' '}
            · © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
