import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { addHooks, HOOK_EVENTS, hookCommand, MARKER, removeHooks } from '../src/installer/settings.js';

const CMD = hookCommand('C:\\x\\send.js');
const countOurs = (s: any, ev: string) =>
  s.hooks[ev].filter((e: any) => e.hooks.some((h: any) => h.command.includes(MARKER))).length;

const user = {
  theme: 'dark',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'lint' }] }],
  },
};

test('保留使用者原有的 hooks 與其他設定', () => {
  const out: any = addHooks(user, CMD);
  expect(out.theme).toBe('dark');
  expect(out.hooks.Stop[0]).toEqual(user.hooks.Stop[0]);
  expect(out.hooks.PreToolUse[0]).toEqual(user.hooks.PreToolUse[0]);
  for (const ev of HOOK_EVENTS) expect(countOurs(out, ev)).toBe(1);
  expect(out.hooks.PostToolUse[0].matcher).toBe('*');
  for (const ev of ['PostToolUseFailure', 'PermissionRequest']) expect(out.hooks[ev][0].matcher).toBe('*');
  for (const ev of ['Notification', 'Elicitation', 'ElicitationResult', 'StopFailure']) expect(out.hooks[ev][0].matcher).toBeUndefined();
  expect(out.hooks.Stop[1].matcher).toBeUndefined();
  expect(user.hooks.Stop).toHaveLength(1); // 輸入不被修改
});

test('重複安裝不會重複加入', () => {
  const out: any = addHooks(addHooks(user, CMD), CMD);
  for (const ev of HOOK_EVENTS) expect(countOurs(out, ev)).toBe(1);
});

test('移除後回到安裝前的內容', () => {
  expect(removeHooks(addHooks(user, CMD))).toEqual(user);
  expect(removeHooks(addHooks({}, CMD))).toEqual({});
  expect(removeHooks(addHooks({ a: 1 }, CMD))).toEqual({ a: 1 });
});

test('欄位缺漏或型別怪異時不拋錯', () => {
  expect(() => addHooks({ hooks: null }, CMD)).not.toThrow();
  expect(() => addHooks({ hooks: { Stop: 'x' } }, CMD)).not.toThrow();
  expect(() => removeHooks({ hooks: null })).not.toThrow();
  expect(() => removeHooks({ hooks: { Stop: 'x', Foo: [null, 3] } })).not.toThrow();
  expect(removeHooks({ hooks: { Stop: 'x' } })).toEqual({ hooks: { Stop: 'x' } });
});

test('hookCommand 把反斜線換成正斜線並加引號', () => {
  expect(hookCommand('C:\\My Apps\\x.js')).toBe('node "C:/My Apps/x.js" --tag=claude-office');
});

// 本檔建立的暫存 home，每個測試結束後刪除
const homes: string[] = [];
afterEach(() => { for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

function main(action: string, initial?: string) {
  const home = mkdtempSync(join(tmpdir(), 'inst-home-'));
  homes.push(home);
  const file = join(home, '.claude', 'settings.json');
  if (initial !== undefined) {
    mkdirSync(join(home, '.claude'));
    writeFileSync(file, initial);
  }
  const r = spawnSync(process.execPath, [resolve('dist/installer/main.js'), action], {
    encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home },
  });
  return { r, file };
}

test('settings.json 不存在時建立新檔', () => {
  const { r, file } = main('install');
  expect(r.status).toBe(0);
  const s = JSON.parse(readFileSync(file, 'utf8'));
  for (const ev of HOOK_EVENTS) expect(countOurs(s, ev)).toBe(1);
  expect(s.hooks.Stop[0].hooks[0].command).toMatch(/^node ".*\/hook\/send\.js" --tag=claude-office$/);
});

test('settings.json 不合法時中止且檔案不變', () => {
  const { r, file } = main('install', '{ not json');
  expect(r.status).toBe(1);
  expect(r.stderr).toContain('不是合法的 JSON');
  expect(readFileSync(file, 'utf8')).toBe('{ not json');
  expect(existsSync(file + '.claude-office.bak')).toBe(false);
});

test('hooks 不是物件時中止且檔案不變', () => {
  const text = '{"hooks":"oops"}';
  const { r, file } = main('install', text);
  expect(r.status).toBe(1);
  expect(readFileSync(file, 'utf8')).toBe(text);
});

test('安裝時產生備份', () => {
  const text = '{"theme":"dark"}';
  const { r, file } = main('install', text);
  expect(r.status).toBe(0);
  expect(readFileSync(file + '.claude-office.bak', 'utf8')).toBe(text);
});

test('uninstall 把設定還原', () => {
  const text = JSON.stringify({ theme: 'dark' }, null, 2) + '\n';
  const { file } = main('install', text);
  const r = spawnSync(process.execPath, [resolve('dist/installer/main.js'), 'uninstall'], {
    encoding: 'utf8', env: { ...process.env, USERPROFILE: join(file, '..', '..'), HOME: join(file, '..', '..') },
  });
  expect(r.status).toBe(0);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ theme: 'dark' });
});

test('重複安裝與移除都不覆蓋第一次的備份', () => {
  const text = '{"theme":"dark"}';
  const { file } = main('install', text);
  const home = join(file, '..', '..');
  for (const a of ['install', 'uninstall'])
    spawnSync(process.execPath, [resolve('dist/installer/main.js'), a], { env: { ...process.env, USERPROFILE: home, HOME: home } });
  expect(readFileSync(file + '.claude-office.bak', 'utf8')).toBe(text);
});

test('開頭有 BOM 的合法 settings.json 可以安裝', () => {
  const { r, file } = main('install', '﻿{"theme":"dark"}');
  expect(r.status).toBe(0);
  const s = JSON.parse(readFileSync(file, 'utf8'));
  expect(s.theme).toBe('dark');
  expect(countOurs(s, 'Stop')).toBe(1);
});

test('空檔或只有空白的 settings.json 視為 {}', () => {
  for (const text of ['', '  \n ']) {
    const { r, file } = main('install', text);
    expect(r.status).toBe(0);
    expect(countOurs(JSON.parse(readFileSync(file, 'utf8')), 'Stop')).toBe(1);
  }
});
