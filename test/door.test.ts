import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DOOR_HOLD, DOOR_MS, ElevatorDoor } from '../web/src/door.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const door = () => {
  const shows: boolean[] = [];
  return { d: new ElevatorDoor((o) => shows.push(o)), shows };
};

test('一趟：開 300ms 後叫 atOpen，停一下再關 300ms，關好才 resolve', async () => {
  const { d, shows } = door();
  const at = vi.fn(), closed = vi.fn();
  void d.ride(at).then(closed);
  expect(shows).toEqual([true]);
  vi.advanceTimersByTime(DOOR_MS - 1);
  expect(at).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(at).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(DOOR_HOLD);
  expect(shows).toEqual([true, false]);
  await vi.advanceTimersByTimeAsync(DOOR_MS - 1);
  expect(closed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(closed).toHaveBeenCalledTimes(1);
  expect(d.state).toBe('closed');
});

test('門開著時再搭：atOpen 不會同步呼叫（呼叫端先登記好），下一輪就叫', () => {
  const { d } = door();
  d.ride();
  vi.advanceTimersByTime(DOOR_MS);
  expect(d.state).toBe('open');
  const at = vi.fn();
  d.ride(at);
  expect(at).not.toHaveBeenCalled();
  vi.advanceTimersByTime(0);
  expect(at).toHaveBeenCalledTimes(1);
});

test('同一層 9 個人每 300ms 到一位（新樓層）：每個人都出得來，最後一起關門', async () => {
  const { d, shows } = door();
  const registered = new Set<number>(), out: number[] = [];
  let done = 0;
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      // 同 building.ts 的順序：先 enter（搭電梯）再登記 —— 舊版就是在這裡掉人
      void d.ride(() => { if (registered.has(i)) out.push(i); }).then(() => done++);
      registered.add(i);
    }, i * 300);
  }
  await vi.advanceTimersByTimeAsync(9 * 300 + DOOR_MS + DOOR_HOLD + DOOR_MS);
  expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(done).toBe(9);
  expect(d.state).toBe('closed');
  expect(shows.at(-1)).toBe(false);
});

test('開門中再搭：開好時一起叫；關到一半再搭：重新打開，等最後一次關好才一起 resolve', async () => {
  const { d, shows } = door();
  const order: string[] = [];
  void d.ride(() => order.push('a')).then(() => order.push('a closed'));
  vi.advanceTimersByTime(100);
  void d.ride(() => order.push('b'));
  vi.advanceTimersByTime(DOOR_MS - 100);
  expect(order).toEqual(['a', 'b']);
  vi.advanceTimersByTime(DOOR_HOLD + 100); // 關到一半
  expect(d.state).toBe('closing');
  void d.ride(() => order.push('c'));
  expect(shows).toEqual([true, false, true]);
  await vi.advanceTimersByTimeAsync(DOOR_MS);
  expect(order).toEqual(['a', 'b', 'c']);
  await vi.advanceTimersByTimeAsync(DOOR_HOLD + DOOR_MS);
  expect(order).toEqual(['a', 'b', 'c', 'a closed']);
});

test('cancel：計時器與等著的事作廢，之後還能正常搭', async () => {
  const { d } = door();
  const at = vi.fn(), closed = vi.fn();
  void d.ride(at).then(closed);
  d.cancel();
  await vi.advanceTimersByTimeAsync(5000);
  expect(at).not.toHaveBeenCalled();
  expect(closed).not.toHaveBeenCalled();
  const at2 = vi.fn();
  d.ride(at2);
  vi.advanceTimersByTime(DOOR_MS);
  expect(at2).toHaveBeenCalledTimes(1);
});
