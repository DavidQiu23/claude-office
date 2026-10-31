// 使用者是否要求減少動態（prefers-reduced-motion: reduce）。每次呼叫都查，系統設定中途改了也會跟上
export const reduceMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
