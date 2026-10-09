// Após um deploy, chunk antigo 404 → recarrega UMA vez (sem loop).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkReload';

describe('chunkReload', () => {
  const reload = vi.fn();
  beforeEach(() => {
    sessionStorage.clear(); reload.mockClear();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('reconhece as mensagens de chunk ausente dos navegadores', () => {
    for (const m of ['Failed to fetch dynamically imported module: https://x/a.js', 'Importing a module script failed.', 'error loading dynamically imported module', 'Loading chunk 12 failed', 'ChunkLoadError: x']) {
      expect(isChunkLoadError(m), m).toBe(true);
    }
    expect(isChunkLoadError('TypeError: x is not a function')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('recarrega uma vez e ignora um segundo erro dentro de 10s', () => {
    expect(reloadOnceForChunkError('TypeError')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(reloadOnceForChunkError('Loading chunk 3 failed')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForChunkError('Loading chunk 4 failed')).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_001);
    expect(reloadOnceForChunkError('Loading chunk 4 failed')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
