// @vitest-environment jsdom
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFairLog } from '@/components/fair/event-log';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

describe('createFairLog', () => {
  it('sends what was queued in one batch after five seconds', async () => {
    const send = vi.fn(); const log = createFairLog(send);
    log.add('stall', 'dhaga'); log.add('shortlist', 'dhaga:0'); log.add('quest', 'meet3');
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([{ kind: 'stall', detail: 'dhaga' }, { kind: 'shortlist', detail: 'dhaga:0' }, { kind: 'quest', detail: 'meet3' }]);
    log.destroy();
  });
  it('sends batches of at most ten', () => {
    const send = vi.fn(); const log = createFairLog(send);
    for (let i = 0; i < 25; i++) log.add('stall', `m${i}`);
    log.flush();
    expect(send.mock.calls.map(c => c[0].length)).toEqual([10, 10, 5]);
    log.destroy();
  });
  it('keeps only the newest 50 when it is far behind', () => {
    const send = vi.fn(); const log = createFairLog(send);
    for (let i = 0; i < 60; i++) log.add('stall', `m${i}`);
    log.flush();
    const sent = send.mock.calls.flatMap(c => c[0] as Array<{ detail: string }>);
    expect(sent).toHaveLength(50);
    expect(sent[0].detail).toBe('m10');
    expect(sent[49].detail).toBe('m59');
    log.destroy();
  });
  it('cuts a long detail to 80 characters', () => {
    const send = vi.fn(); const log = createFairLog(send);
    log.add('stall', 'x'.repeat(100)); log.flush();
    expect(send.mock.calls[0][0][0].detail).toHaveLength(80);
    log.destroy();
  });
  it('never throws or retries when sending fails, whether it throws or rejects', async () => {
    const throwing = vi.fn(() => { throw new Error('offline'); }), rejecting = vi.fn(async () => { throw new Error('500'); });
    for (const send of [throwing, rejecting]) {
      const log = createFairLog(send);
      log.add('stall', 'a');
      expect(() => log.flush()).not.toThrow();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(send).toHaveBeenCalledTimes(1);
      log.destroy();
    }
  });
  it('sends at once when the page is hidden or closed', () => {
    const send = vi.fn(); const log = createFairLog(send);
    log.add('stall', 'a');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(send).toHaveBeenCalledTimes(1);
    log.add('stall', 'b'); window.dispatchEvent(new Event('pagehide'));
    expect(send).toHaveBeenCalledTimes(2);
    log.destroy();
  });
  it('sends what is left on destroy and then does nothing more', async () => {
    const send = vi.fn(); const log = createFairLog(send);
    log.add('stall', 'a'); log.destroy();
    expect(send).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('pagehide')); await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('the game feeds the log from the places things happen (source contract)', () => {
  const game = fs.readFileSync('src/components/fair/FairGame.tsx', 'utf8');
  it('sends the first-party events to /api/fair/events with the code and token, and keeps them away from GA', () => {
    expect(game).toMatch(/createFairLog\(/);
    expect(game).toContain("'/api/fair/events'");
    expect(game).toMatch(/keepalive: true/);
  });
  it('queues a stall, a shortlist item, each activity and each finished quest', () => {
    expect(game).toMatch(/gaFairStallOpen\(slot\.maker\);[^}]*logRef\.current\?\.add\('stall', slot\.maker\.id\)/);
    expect(game).toMatch(/logRef\.current\?\.add\('shortlist', item\.key\)/);
    expect(game).toMatch(/r\.completed\.forEach\(q => logRef\.current\?\.add\('quest', q\.id\)\)/);
    for (const a of ['balloon', 'music', 'holy_dip', 'tug_of_war']) expect(game, a).toContain(`logRef.current?.add('activity', '${a}')`);
  });
});
