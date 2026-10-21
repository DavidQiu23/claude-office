export const HOOK_EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'Notification', 'Stop', 'SubagentStop', 'SessionEnd',
] as const;
export const MARKER = '--tag=claude-office';

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export const hookCommand = (scriptPath: string): string =>
  `node "${scriptPath.replace(/\\/g, '/')}" ${MARKER}`;

const ours = (entry: unknown): boolean =>
  isObj(entry) && Array.isArray(entry.hooks) &&
  entry.hooks.some((h: unknown) => isObj(h) && typeof h.command === 'string' && h.command.includes(MARKER));

/** 回傳去掉本工具項目的事件陣列（欄位不是陣列就視為空）。 */
const without = (v: unknown): unknown[] => (Array.isArray(v) ? v.filter((e) => !ours(e)) : []);

/** 純函式：不修改輸入。呼叫端須確保 settings.hooks 若存在則為物件。 */
export function addHooks(settings: Obj, command: string): Obj {
  const hooks: Obj = isObj(settings.hooks) ? { ...settings.hooks } : {};
  for (const ev of HOOK_EVENTS) {
    const entry: Obj = { hooks: [{ type: 'command', command }] };
    if (ev === 'PreToolUse' || ev === 'PostToolUse') entry.matcher = '*';
    hooks[ev] = [...without(hooks[ev]), entry];
  }
  return { ...settings, hooks };
}

export function removeHooks(settings: Obj): Obj {
  if (!isObj(settings.hooks)) return { ...settings };
  const hooks: Obj = { ...settings.hooks };
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    const kept = without(hooks[ev]);
    if (kept.length) hooks[ev] = kept;
    else delete hooks[ev];
  }
  const { hooks: _old, ...rest } = settings;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}
