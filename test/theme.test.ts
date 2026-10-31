import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_CHECK_MS, startTheme, themeOverride, timeOfDay, type TimeOfDay } from '../web/src/theme.js';

const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m);

describe('timeOfDay', () => {
  it('本地 6:00（含）到 18:00（不含）是白天', () => {
    expect(timeOfDay(at(5, 59))).toBe('night');
    expect(timeOfDay(at(6, 0))).toBe('day');
    expect(timeOfDay(at(17, 59))).toBe('day');
    expect(timeOfDay(at(18, 0))).toBe('night');
    expect(timeOfDay(at(0, 0))).toBe('night');
  });
});

describe('themeOverride', () => {
  it('只認 time=day／time=night', () => {
    expect(themeOverride('?time=day')).toBe('day');
    expect(themeOverride('?time=night')).toBe('night');
    expect(themeOverride('?x=1&time=night')).toBe('night');
    expect(themeOverride('?time=noon')).toBeNull();
    expect(themeOverride('')).toBeNull();
  });
});

describe('startTheme', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('立刻套用一次，之後每分鐘檢查，有變才再套用', () => {
    let t = at(17, 59);
    const apply = vi.fn<(x: TimeOfDay) => void>();
    const stop = startTheme(apply, () => t, '');
    expect(apply.mock.calls.map((c) => c[0])).toEqual(['day']);
    t = at(18, 0);
    vi.advanceTimersByTime(THEME_CHECK_MS);
    expect(apply.mock.calls.map((c) => c[0])).toEqual(['day', 'night']);
    vi.advanceTimersByTime(THEME_CHECK_MS);
    expect(apply).toHaveBeenCalledTimes(2);
    stop();
    t = at(7, 0);
    vi.advanceTimersByTime(THEME_CHECK_MS * 3);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('有網址覆寫就固定，不再檢查', () => {
    const apply = vi.fn<(x: TimeOfDay) => void>();
    startTheme(apply, () => at(12, 0), '?time=night');
    expect(apply.mock.calls.map((c) => c[0])).toEqual(['night']);
    vi.advanceTimersByTime(THEME_CHECK_MS * 3);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
