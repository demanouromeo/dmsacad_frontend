// Runs `fn` over `items` with at most `limit` calls in flight at once, preserving result order.
// Report-card loads fan out dozens of concurrent mark fetches (subjects x dbsequences/competences)
// - on shared remote hosting this was enough to exceed the MySQL account's connection limit
// (SQLSTATE[HY000] [2002] "Operation not permitted" under load, confirmed by replaying the same
// burst directly against the remote API), which silently corrupted computed averages since a
// failed fetch looks identical to "no marks yet". Capping concurrency keeps the burst under
// whatever limit the host enforces without needing to know its exact value.
export const mapWithConcurrencyLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  };
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
};
