export async function fetchInBlockRanges<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchRange: (from: bigint, to: bigint) => Promise<T[]>,
  maxRange = 100n,
): Promise<T[]> {
  const entries: T[] = [];
  let cursor = fromBlock;
  let range = maxRange;

  while (cursor <= toBlock) {
    const end = cursor + range - 1n > toBlock ? toBlock : cursor + range - 1n;
    try {
      entries.push(...await fetchRange(cursor, end));
      cursor = end + 1n;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/\b413\b|too many|response (?:is )?too large|block range|query returned more|limited to a \d+ range/i.test(message)) {
        throw error;
      }
      if (range === 1n) throw error;
      range = range / 2n || 1n;
    }
  }

  return entries;
}
