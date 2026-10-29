import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

let tmpHome: string;
beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'co-'));
  mkdirSync(join(tmpHome, '.claude-office'));
});

afterEach(() => rmSync(tmpHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

test('沒有設定檔時用預設 port', () => {
  expect(loadConfig(tmpHome)).toEqual({ port: 47823 });
});
test('讀取設定檔中的 port', () => {
  writeFileSync(join(tmpHome, '.claude-office', 'config.json'), '{"port":50000}');
  expect(loadConfig(tmpHome)).toEqual({ port: 50000 });
});
test('設定檔壞掉時用預設 port', () => {
  writeFileSync(join(tmpHome, '.claude-office', 'config.json'), '{not json');
  expect(loadConfig(tmpHome).port).toBe(47823);
});
