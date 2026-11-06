// node dist/installer/main.js install|uninstall
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addHooks, hookCommand, removeHooks } from './settings.js';

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const action = process.argv[2];
if (action !== 'install' && action !== 'uninstall') fail('用法：node dist/installer/main.js install|uninstall');

const file = join(homedir(), '.claude', 'settings.json');
let settings: any = {};
const exists = existsSync(file);
if (action === 'uninstall' && !exists) {
  console.log(`沒有 ${file}，不需要移除`);
  process.exit(0);
}
if (exists) {
  try {
    const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
    settings = text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    fail('settings.json 不是合法的 JSON，已中止，未做任何修改');
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    fail('settings.json 不是合法的 JSON，已中止，未做任何修改');
}
if (settings.hooks != null && (typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)))
  fail('settings.json 的 hooks 欄位不是物件，已中止，未做任何修改');

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'hook', 'send.js');
const next = action === 'install' ? addHooks(settings, hookCommand(script)) : removeHooks(settings);

mkdirSync(dirname(file), { recursive: true });
const bak = `${file}.claude-office.bak`;
if (exists && !existsSync(bak)) copyFileSync(file, bak); // 只保留最初的原始檔
// 先寫暫存檔再換名：寫到一半中斷時，原本的 settings.json 還是完整的。換名對象是連結指向的真正檔案，連結本身留著
const target = exists ? realpathSync(file) : file;
const tmp = `${target}.claude-office.tmp`;
writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
renameSync(tmp, target);
console.log(action === 'install' ? `已安裝 hooks：${file}` : `已移除 hooks：${file}`);
