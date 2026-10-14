export async function fetchInBlockRanges<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchRange: (from: bigint, to: bigint) => Promise<T[]>,
  maxRange = 100n,
): Promise<T[]> {
  if (maxRange < 1n) throw new RangeError('Maximum block range must be positive.');
  if (fromBlock > toBlock) return [];

  const initialRanges: Array<[bigint, bigint]> = [];
  for (let cursor = fromBlock; cursor <= toBlock; cursor += maxRange) {
    const end = cursor + maxRange - 1n > toBlock ? toBlock : cursor + maxRange - 1n;
    initialRanges.push([cursor, end]);
  }

  const fetchAdaptive = async (from: bigint, to: bigint): Promise<T[]> => {
    try {
      return await fetchRange(from, to);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/\b413\b|too many|response (?:is )?too large|block range|query returned more|limited to a \d+ range/i.test(message)) {
        throw error;
      }
      if (from === to) throw error;
      const midpoint = from + (to - from) / 2n;
      const [left, right] = await Promise.all([
        fetchAdaptive(from, midpoint),
        fetchAdaptive(midpoint + 1n, to),
      ]);
      return [...left, ...right];
    }
  };

  // Public RPC history scans can span many chunks. Bounded concurrency avoids
  // keeping the discovery screen in a sequential loading state for each chunk.
  const entries: T[] = [];
  const concurrency = 8;
  for (let index = 0; index < initialRanges.length; index += concurrency) {
    const batch = initialRanges.slice(index, index + concurrency);
    const results = await Promise.all(batch.map(([from, to]) => fetchAdaptive(from, to)));
    entries.push(...results.flat());
  }
  return entries;
}
