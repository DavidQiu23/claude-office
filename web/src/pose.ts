// 人物動作的 pose 規則與計時（不碰 DOM，可用假計時器測）；見 docs/superpowers/specs/2026-11-01-figure-actions-design.md
import type { EmployeeStatus, ToolKind } from '../../src/state/types.js';
import { reduceMotion } from './motion.js';

export type WorkPose = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'think';
export type IdlePose = 'stretch' | 'coffee' | 'phone' | 'doze';
export type UpPose = 'raise' | 'wave' | 'hop';
export type Pose = WorkPose | IdlePose | UpPose | 'cheer' | 'deliver';

export const MIN_POSE_MS = 1500; // 工作 pose 至少維持多久才換下一個
export const CHEER_MS = 1000; // 工作做完的歡呼
export const DELIVER_MS = 1000; // 遞文件
export const IDLE_POSES: readonly IdlePose[] = ['stretch', 'coffee', 'phone', 'doze'];
export const UP_POSES: readonly UpPose[] = ['raise', 'wave', 'hop'];
export const IDLE_DWELL: readonly [number, number] = [6000, 10000]; // 輪到你：每個 pose 停多久（ms）
export const UP_DWELL: readonly [number, number] = [3000, 5000]; // 等你處理

/** 工具類型 → 工作 pose；other 與 null 是打字 */
export function poseFor(kind: ToolKind | null): WorkPose {
  return kind === null || kind === 'other' ? 'edit' : kind;
}

/** 從池裡排除目前的 pose 後依 rand 挑一個（目前的不在池裡就全部可選） */
export function pickNext<P extends Pose>(pool: readonly P[], current: Pose | null, rand: () => number): P {
  const rest = pool.filter((p) => p !== current);
  return rest[Math.floor(rand() * rest.length)];
}

export const dwellMs = (range: readonly [number, number], rand: () => number): number => range[0] + rand() * (range[1] - range[0]);
export const holdLeft = (since: number, now: number): number => Math.max(0, MIN_POSE_MS - (now - since));
/** 只有工作中變輪到你才歡呼 */
export const shouldCheer = (prev: EmployeeStatus | undefined, next: EmployeeStatus): boolean => prev === 'working' && next === 'idle';

export interface DriverOpts { rand?: () => number; now?: () => number; reduced?: () => boolean }
type Mode = 'work' | 'idle' | 'up' | 'cheer' | 'still';

export class PoseDriver {
  private cur: Pose | null = null;
  private mode: Mode | null = null;
  private since = 0; // 目前 pose 開始的時間
  private queued: Pose | null = null; // 工作 pose 排隊中的下一個
  private t: ReturnType<typeof setTimeout> | undefined;
  private rand: () => number;
  private now: () => number;
  private reduced: () => boolean;

  get current(): Pose | null {
    return this.cur;
  }

  /** apply(p)：畫面換成這個 pose（加減 data-pose） */
  constructor(private apply: (p: Pose | null) => void, opts: DriverOpts = {}) {
    this.rand = opts.rand ?? Math.random;
    this.now = opts.now ?? (() => performance.now());
    this.reduced = opts.reduced ?? reduceMotion;
  }

  /** 工作中：換工具要等目前的 pose 滿 MIN_POSE_MS，期間只留最新的 */
  work(kind: ToolKind | null): void {
    const p = poseFor(kind);
    if (this.mode !== 'work') {
      this.reset('work');
      this.show(p);
      return;
    }
    if (p === this.cur) {
      this.queued = null;
      clearTimeout(this.t);
      return;
    }
    const left = holdLeft(this.since, this.now());
    if (left === 0) {
      this.queued = null;
      clearTimeout(this.t);
      this.show(p);
      return;
    }
    this.queued = p;
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      const q = this.queued;
      this.queued = null;
      if (q) this.show(q);
    }, left);
  }

  /** 輪到你：在 IDLE_POSES 之間輪替（減少動態時固定 doze） */
  idle(): void {
    if (this.mode === 'idle' || this.mode === 'cheer') return;
    this.reset('idle');
    if (this.reduced()) this.show('doze');
    else this.rotate(IDLE_POSES, IDLE_DWELL);
  }

  /** 等你處理：在 UP_POSES 之間輪替（減少動態時固定 raise） */
  up(): void {
    if (this.mode === 'up') return;
    this.reset('up');
    if (this.reduced()) this.show('raise');
    else this.rotate(UP_POSES, UP_DWELL);
  }

  /** 工作做完：歡呼 CHEER_MS 再進入 idle（減少動態時直接 idle） */
  cheer(): void {
    if (this.reduced()) return this.idle();
    this.reset('cheer');
    this.show('cheer');
    this.t = setTimeout(() => {
      this.mode = 'still';
      this.idle();
    }, CHEER_MS);
  }

  /** 固定在某個 pose（null 是沒有 pose） */
  still(p: Pose | null): void {
    this.reset('still');
    this.show(p);
  }

  stop(): void {
    clearTimeout(this.t);
  }

  private reset(mode: Mode): void {
    clearTimeout(this.t);
    this.queued = null;
    this.mode = mode;
  }

  private show(p: Pose | null): void {
    this.cur = p;
    this.since = this.now();
    this.apply(p);
  }

  private rotate<P extends Pose>(pool: readonly P[], range: readonly [number, number]): void {
    this.show(pickNext(pool, this.cur, this.rand));
    this.t = setTimeout(() => this.rotate(pool, range), dwellMs(range, this.rand));
  }
}
