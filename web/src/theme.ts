// 日夜主題：只看本地時間（或網址參數），不看系統深色模式
export type TimeOfDay = 'day' | 'night';

/** 本地 6:00（含）到 18:00（不含）是白天，其餘是夜晚 */
export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  return h >= 6 && h < 18 ? 'day' : 'night';
}

/** 網址參數 ?time=day／?time=night 固定主題；其他值或沒有參數回傳 null */
export function themeOverride(search: string): TimeOfDay | null {
  const v = new URLSearchParams(search).get('time');
  return v === 'day' || v === 'night' ? v : null;
}

export const THEME_CHECK_MS = 60_000;

/** 有覆寫就固定；否則立刻 apply 一次，之後每 THEME_CHECK_MS 檢查，有變才再 apply。回傳停止函式 */
export function startTheme(apply: (t: TimeOfDay) => void, now: () => Date = () => new Date(), search: string = location.search): () => void {
  const fixed = themeOverride(search);
  if (fixed) {
    apply(fixed);
    return () => {};
  }
  let cur = timeOfDay(now());
  apply(cur);
  const timer = setInterval(() => {
    const t = timeOfDay(now());
    if (t !== cur) {
      cur = t;
      apply(t);
    }
  }, THEME_CHECK_MS);
  return () => clearInterval(timer);
}
