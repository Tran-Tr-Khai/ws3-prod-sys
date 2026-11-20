import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTenteringOrder } from './tenteringApi';

afterEach(() => vi.unstubAllGlobals());

describe('tentering API adapter', () => {
  it('encodes the SOP and maps a missing record to null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTenteringOrder('TE-01', 'PD 01/02')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('PD%2001%2F02');
    expect(String(fetchMock.mock.calls[0][0])).toContain('machine_id=TE-01');
  });
});
