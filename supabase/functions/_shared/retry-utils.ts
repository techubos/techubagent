
// Retry Utility with Exponential Backoff
// Usage: await retryWithBackoff(() => apiCall(), { maxAttempts: 3 })

export interface RetryConfig {
    maxAttempts: number;
    initialDelayMs: number;
    factor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 1000, // 1 second
    factor: 2 // 1, 2, 4, 8, 16...
};

export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    contextName: string, // e.g. "Evolution API"
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    onRetry?: (attempt: number, delay: number, error: any) => void
): Promise<T> {
    let attempt = 1;
    let delay = config.initialDelayMs;

    while (true) {
        try {
            return await operation();
        } catch (error) {
            if (attempt >= config.maxAttempts) {
                // Final failure
                console.error(`[${contextName}] Final Failure after ${attempt} attempts: ${error.message}`);
                throw error;
            }

            // Log Retry
            console.warn(`[${contextName}] Attempt ${attempt} failed. Retrying in ${delay}ms. Error: ${error.message}`);

            if (onRetry) {
                onRetry(attempt, delay, error);
            }

            // Wait
            await new Promise(resolve => setTimeout(resolve, delay));

            attempt++;
            delay *= config.factor;
        }
    }
}
