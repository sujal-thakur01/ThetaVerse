type ExecutionMeta = Record<string, string | number | boolean | null | undefined>;

const formatMeta = (meta?: ExecutionMeta) => {
  if (!meta) {
    return '';
  }

  const entries = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return entries.length > 0 ? ` | ${entries.join(', ')}` : '';
};

export const logExecution = (scope: string, message: string, meta?: ExecutionMeta) => {
  console.info(`[Frontend] ${scope}: ${message}${formatMeta(meta)}`);
};

export function withExecutionLog<TArgs extends unknown[], TResult>(
  scope: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult,
  meta?: ExecutionMeta,
) {
  return async (...args: TArgs) => {
    const startedAt = performance.now();
    logExecution(scope, 'started', meta);

    try {
      const result = await handler(...args);
      logExecution(scope, 'completed', {
        ...meta,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return result;
    } catch (error) {
      console.error(`[Frontend] ${scope}: failed`, error);
      throw error;
    }
  };
}