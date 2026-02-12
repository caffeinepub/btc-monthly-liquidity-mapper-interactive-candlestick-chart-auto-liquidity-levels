/**
 * Reusable fetch utilities for market data requests with timeout and error handling
 */

export interface FetchOptions {
  timeout?: number; // milliseconds
  signal?: AbortSignal;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

/**
 * Fetch with automatic timeout using AbortController
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, signal } = options;

  // Create timeout signal
  const timeoutSignal = AbortSignal.timeout(timeout);

  // Combine with any existing signal if provided
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, { signal: combinedSignal });

    if (!response.ok) {
      throw new MarketDataError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        throw new MarketDataError('Request timed out - please try again');
      }
      if (error.name === 'AbortError') {
        throw new MarketDataError('Request was cancelled');
      }
    }
    throw error;
  }
}

/**
 * Validate that response contains expected data structure
 */
export function validateArrayResponse(data: unknown, minLength = 1): data is unknown[] {
  return Array.isArray(data) && data.length >= minLength;
}

/**
 * Parse JSON with error handling
 */
export async function parseJSON<T>(response: Response): Promise<T> {
  try {
    return await response.json();
  } catch (error) {
    throw new MarketDataError('Invalid response format - unable to parse data');
  }
}
