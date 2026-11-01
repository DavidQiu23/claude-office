import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_PORT = 47823;
export const CONFIG_DIR = (home: string = homedir()): string => join(home, '.claude-office');
export const CONFIG_FILE = (home?: string): string => join(CONFIG_DIR(home), 'config.json');

/** 任何讀取或解析錯誤都回傳預設值，不拋錯（hook 腳本也會用）。 */
export function loadConfig(home?: string): { port: number } {
  try {
    const port = JSON.parse(readFileSync(CONFIG_FILE(home), 'utf8'))?.port;
    if (Number.isInteger(port) && port > 0 && port < 65536) return { port };
  } catch {}
  return { port: DEFAULT_PORT };
}
