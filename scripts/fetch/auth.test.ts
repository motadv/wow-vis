import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchToken } from './auth.js';

describe('fetchToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns access_token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'test-token' }),
    }));

    const token = await fetchToken('id', 'secret');
    expect(token).toBe('test-token');
  });

  it('throws with status code on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }));

    await expect(fetchToken('id', 'secret')).rejects.toThrow('401');
  });
});
