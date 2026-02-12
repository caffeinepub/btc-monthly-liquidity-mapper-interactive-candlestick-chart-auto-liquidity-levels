import { AlertCircle, Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorProps {
  error: Error | null;
  onRetry: () => void;
}

function Loading() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center gap-4 rounded-lg border border-border/40 bg-card/30 p-8">
      <Loader2 className="h-12 w-12 animate-spin text-chart-1" />
      <div className="text-center">
        <h3 className="text-lg font-semibold">Loading BTC Data</h3>
        <p className="text-sm text-muted-foreground">Fetching monthly market data...</p>
      </div>
    </div>
  );
}

function Error({ error, onRetry }: ErrorProps) {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center gap-6 rounded-lg border border-border/40 bg-card/30 p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to Load Data</AlertTitle>
        <AlertDescription className="mt-2">
          {error?.message || 'Unable to fetch market data. Please check your connection and try again.'}
        </AlertDescription>
      </Alert>
      <Button onClick={onRetry} variant="outline" size="lg">
        Retry
      </Button>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center gap-4 rounded-lg border border-border/40 bg-card/30 p-8">
      <TrendingUp className="h-12 w-12 text-muted-foreground" />
      <div className="text-center">
        <h3 className="text-lg font-semibold">No Data Available</h3>
        <p className="text-sm text-muted-foreground">No monthly candles found for BTC.</p>
      </div>
    </div>
  );
}

export const ChartStates = {
  Loading,
  Error,
  Empty,
};
