import { describe, expect, it } from 'vitest';
import { fetchInBlockRanges } from './chunkedLogs';

describe('fetchInBlockRanges', () => {
  it('queries bounded adjacent ranges and preserves result order', async () => {
    const ranges: string[] = [];
    const result = await fetchInBlockRanges(10n, 14n, async (from, to) => {
      ranges.push(`${from}-${to}`);
      const blocks: bigint[] = [];
      for (let block = from; block <= to; block += 1n) blocks.push(block);
      return blocks;
    }, 2n);

    expect(ranges).toEqual(['10-11', '12-13', '14-14']);
    expect(result).toEqual([10n, 11n, 12n, 13n, 14n]);
  });

  it('reduces range size after provider errors and retries without skipping blocks', async () => {
    const ranges: string[] = [];
    const result = await fetchInBlockRanges(0n, 7n, async (from, to) => {
      ranges.push(`${from}-${to}`);
      if (to - from >= 4n) throw new Error('eth_getLogs is limited to a 3 range');
      const blocks: bigint[] = [];
      for (let block = from; block <= to; block += 1n) blocks.push(block);
      return blocks;
    }, 8n);

    expect(result).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n]);
    expect(ranges[0]).toBe('0-7');
    expect(ranges).toContain('0-3');
  });

  it('scans long histories in bounded concurrent batches and preserves order', async () => {
    const ranges: string[] = [];
    let active = 0;
    let peak = 0;
    const result = await fetchInBlockRanges(0n, 9n, async (from, to) => {
      ranges.push(`${from}-${to}`);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
      const blocks: bigint[] = [];
      for (let block = from; block <= to; block += 1n) blocks.push(block);
      return blocks;
    }, 2n);

    expect(result).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);
    expect(ranges).toHaveLength(5);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it('returns immediately for an empty block range', async () => {
    const fetchRange = async () => { throw new Error('should not be called'); };
    await expect(fetchInBlockRanges(11n, 10n, fetchRange)).resolves.toEqual([]);
  });

  it('rejects a non-positive chunk size', async () => {
    await expect(fetchInBlockRanges(0n, 10n, async () => [], 0n)).rejects.toThrow('Maximum block range must be positive.');
  });
});
