import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ToolKind } from '../src/state/types.js';
import { CHEER_MS, dwellMs, holdLeft, IDLE_DWELL, IDLE_POSES, pickNext, PoseDriver, poseFor, shouldCheer, UP_DWELL, UP_POSES } from '../web/src/pose.js';

let apply: ReturnType<typeof vi.fn>, d: PoseDriver, r: number, red: boolean;
beforeEach(() => {
  vi.useFakeTimers();
  apply = vi.fn();
  r = 0;
  red = false;
  d = new PoseDriver(apply, { now: () => Date.now(), rand: () => r, reduced: () => red });
});
afterEach(() => vi.useRealTimers());

test('poseFor：工具類型對應到工作 pose，other 與 null 是打字', () => {
  expect(['read', 'edit', 'run', 'web', 'agent', 'think'].map((k) => poseFor(k as ToolKind))).toEqual(['read', 'edit', 'run', 'web', 'agent', 'think']);
  expect(poseFor('other')).toBe('edit');
  expect(poseFor(null)).toBe('edit');
});
test('pickNext：不會跟目前的重複；目前的不在池裡就全部可選', () => {
  expect(pickNext(IDLE_POSES, 'stretch', () => 0)).toBe('coffee');
  expect(pickNext(IDLE_POSES, 'stretch', () => 0.999)).toBe('doze');
  expect(pickNext(IDLE_POSES, 'read', () => 0)).toBe('stretch');
  for (let i = 0; i < 50; i++) expect(pickNext(UP_POSES, 'wave', Math.random)).not.toBe('wave');
});
test('dwellMs 與 holdLeft', () => {
  expect(dwellMs(IDLE_DWELL, () => 0)).toBe(6000);
  expect(dwellMs(IDLE_DWELL, () => 0.5)).toBe(8000);
  expect(dwellMs(UP_DWELL, () => 0.999)).toBeLessThan(5000);
  expect(holdLeft(1000, 1200)).toBe(1300);
  expect(holdLeft(1000, 2600)).toBe(0);
});
test('shouldCheer：只有工作中變輪到你', () => {
  expect(shouldCheer('working', 'idle')).toBe(true);
  expect(shouldCheer('waiting', 'idle')).toBe(false);
  expect(shouldCheer(undefined, 'idle')).toBe(false);
  expect(shouldCheer('idle', 'idle')).toBe(false);
  expect(shouldCheer('working', 'waiting')).toBe(false);
});
test('work：第一個立刻顯示；未滿 1.5 秒的排隊，只留最新的', () => {
  d.work('read');                      // apply('read')
  vi.advanceTimersByTime(300); d.work('edit');
  vi.advanceTimersByTime(300); d.work('run');
  expect(apply).toHaveBeenLastCalledWith('read');
  vi.advanceTimersByTime(899); expect(d.current).toBe('read');
  vi.advanceTimersByTime(1);  expect(d.current).toBe('run');
  expect(apply.mock.calls.map((c) => c[0])).toEqual(['read', 'run']);
});
test('work：已滿 1.5 秒立刻換；換回目前的 pose 就取消排隊；同一個工具不重畫', () => {
  d.work('read'); vi.advanceTimersByTime(1500); d.work('edit');
  expect(d.current).toBe('edit');
  d.work('run'); d.work('edit'); vi.advanceTimersByTime(5000);
  expect(d.current).toBe('edit');
  expect(apply).toHaveBeenCalledTimes(2);
});
test('狀態改變立刻生效，排隊中的工作 pose 不會再出現', () => {
  d.work('read'); vi.advanceTimersByTime(500); d.work('run');
  r = 0; d.up();
  expect(d.current).toBe('raise');
  vi.advanceTimersByTime(2000);
  expect(apply.mock.calls.map((c) => c[0])).not.toContain('run');
});
test('idle：隨機挑一個、6–10 秒後換成不同的；重複呼叫不重來', () => {
  r = 0; d.work('edit'); d.idle();
  expect(d.current).toBe('stretch');
  vi.advanceTimersByTime(5999); d.idle(); expect(d.current).toBe('stretch');
  vi.advanceTimersByTime(1);  expect(d.current).toBe('coffee');
});
test('up：3–5 秒輪替；重複呼叫不重來', () => {
  r = 0; d.up(); expect(d.current).toBe('raise');
  vi.advanceTimersByTime(2999); d.up(); expect(d.current).toBe('raise');
  vi.advanceTimersByTime(1); expect(d.current).toBe('wave');
});
test('cheer：演 1 秒後進入輪替；歡呼中呼叫 idle 不打斷，狀態變了就中止', () => {
  r = 0; d.work('edit'); d.cheer();
  expect(d.current).toBe('cheer');
  d.idle(); vi.advanceTimersByTime(CHEER_MS - 1); expect(d.current).toBe('cheer');
  vi.advanceTimersByTime(1); expect(d.current).toBe('stretch');
  d.cheer(); d.work('think');
  vi.advanceTimersByTime(1000); expect(d.current).toBe('think');
});
test('減少動態：不輪替、不歡呼，輪到你固定 doze、等你處理固定 raise', () => {
  red = true; r = 0.7;
  d.work('edit'); d.cheer(); expect(d.current).toBe('doze');
  vi.advanceTimersByTime(60000); expect(d.current).toBe('doze');
  d.up(); expect(d.current).toBe('raise');
  vi.advanceTimersByTime(60000); expect(d.current).toBe('raise');
});
test('still 與 stop：固定 pose、清掉計時器', () => {
  r = 0; d.idle(); d.still('deliver');
  vi.advanceTimersByTime(60000); expect(d.current).toBe('deliver');
  d.idle(); d.stop(); vi.advanceTimersByTime(60000);
  expect(d.current).toBe('stretch');
});
