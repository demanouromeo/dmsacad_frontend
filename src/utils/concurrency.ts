// Bounded-concurrency parallel map - runs `worker` over `items` with at most `limit` in flight at
// once, preserving result order regardless of completion order (results[i] always corresponds to
// items[i]). Used by every Bilan/report-card whole-section loop that used to await one classe at a
// time via a sequential for-await loop; those loops all end in one combined PDF/CSV built AFTER
// every classe's data has been fetched, so running the per-classe fetches in parallel (instead of
// one after another) cuts wall-clock time roughly `limit`-fold with no change in what gets fetched
// or how the results are ordered. A worker throwing propagates immediately, same as Promise.all.
//
// NOT used for loops that save a separate PDF file per classe inside the loop itself (e.g.
// ReportCardManager.handlePrintAllClasses, PvManager.handlePrintAll) - triggering several
// simultaneous browser downloads at once is a real behavior change, not just a speed-up, so those
// stay sequential.
export const DEFAULT_REPORT_CONCURRENCY = 4;

export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onItemDone?: (item: T, index: number, completed: number, total: number) => void,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  const runNext = async (): Promise<void> => {
    for (;;) {
      const current = nextIndex;
      if (current >= items.length) {
        return;
      }
      nextIndex += 1;
      results[current] = await worker(items[current], current);
      completed += 1;
      onItemDone?.(items[current], current, completed, items.length);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
};
