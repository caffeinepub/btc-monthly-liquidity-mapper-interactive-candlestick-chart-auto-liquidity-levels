import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';

// Placeholder for future backend queries
// Currently, data is fetched client-side from CoinGecko

export function useBackendCandles() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['backend-candles'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMonthlyCandles();
    },
    enabled: !!actor && !isFetching,
  });
}
