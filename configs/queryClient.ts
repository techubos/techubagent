import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes for "static" data
            gcTime: 10 * 60 * 1000, // 10 minutes in memory (renamed from cacheTime in v5)
            refetchOnWindowFocus: false, // Don't refetch on window focus
            retry: 2, // Try 2 times before failing
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        }
    }
});
