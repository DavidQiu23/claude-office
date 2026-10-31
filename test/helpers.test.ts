// 助理從伺服器狀態到名牌的整條純邏輯：reduce → helperRoster → buildingPlan → plateText。
// 照 scripts/simulate.ts 的 crm 段落跑兩輪（--loop 每輪用同樣的 session id 與 tool_use_id）
import { expect, test } from 'vitest';
import { reduce } from '../src/state/reduce.js';
import { emptyState, type HookEvent, type OfficeState } from '../src/state/types.js';
import { buildingPlan, HELPER_LINGER, helperRoster, plateText, type Floor, type HelperTrack } from '../web/src/floors.js';

const CWD = '/sim/crm';
const ev = (n: string, hook_event_name: string, extra: Partial<HookEvent> = {}): Omit<HookEvent, 'sentAt'> => ({ hook_event_name, session_id: `${n}-sim`, cwd: CWD, ...extra });
const spawn = (id: string, description: string, subagent_type?: string) =>
  ev('crm0', 'PreToolUse', { tool_name: 'Task', tool_use_id: id, tool_input: { description, ...(subagent_type ? { subagent_type } : {}) } });
const done = (id: string) => ev('crm0', 'PostToolUse', { tool_name: 'Task', tool_use_id: id });
const CRM = ['crm0', 'crm1', 'crm2'];

/** 一輪：上班、派三個助理、陸續完成、主人 Stop、全部下班。每個事件之間隔 GAP */
const round = [
  ...CRM.map((n) => ev(n, 'UserPromptSubmit', { prompt: `處理 ${n}` })),
  spawn('sim-c1', '盤點客戶資料表欄位', 'Explore'),
  spawn('sim-c2', ''),
  spawn('sim-c3', '比對舊版匯出格式'),
  ev('crm0', 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'docs/schema.md' } }),
  done('sim-c2'),
  done('sim-c1'),
  done('sim-c3'),
  ev('crm1', 'Stop'),
  ev('crm2', 'Stop'),
  ev('crm0', 'Stop'),
  ...CRM.map((n) => ev(n, 'SessionEnd')),
];
const GAP = 1500;

/** 每個座位的名牌（空桌 null） */
const plates = (plan: Floor[]) => plan.flatMap((f) => f.seats.map((s) => (s.occ ? plateText(s.occ) : null)));

test('助理名牌：兩輪重複的 tool_use_id，工作中都是「↳ …」、完成才「↳ ✓ 完成」，走了以後空桌沒有名牌', () => {
  let state: OfficeState = emptyState();
  let track = new Map<string, HelperTrack>(), gone = new Set<string>();
  let seats = new Map<string, number>(), minDesks = new Map<string, number>();
  let now = 0;
  const frame = () => {
    const emps = Object.values(state.employees);
    const r = helperRoster(track, gone, emps, now);
    track = r.stay;
    gone = r.gone;
    const helpers = [...r.stay.values()].map(({ owner, a }) => ({ owner, a }));
    const next = buildingPlan(emps, [], helpers, seats, minDesks);
    seats = next.helperSeats;
    minDesks = next.minDesks;
    // 每個助理的名牌底色都和他目前的狀態一致
    for (const f of next.plan) for (const s of f.seats) {
      if (s.occ?.kind !== 'assistant') continue;
      expect(plateText(s.occ).tone).toBe(s.occ.a.status === 'done' ? 'done' : 'assistant');
    }
    return next.plan;
  };

  for (let loop = 0; loop < 2; loop++) {
    for (const [i, e] of round.entries()) {
      now += GAP;
      state = reduce(state, { ...e, sentAt: now } as HookEvent).state;
      const plan = frame();
      if (i === 5 || i === 6) {
        // 三個助理都派出去了、還沒有人完成（第二輪 key 和第一輪一樣）
        expect(plates(plan).slice(3)).toEqual([
          { text: '↳ Explore · 盤點客戶資料表欄位', tone: 'assistant' },
          { text: '↳ 助理', tone: 'assistant' },
          { text: '↳ 比對舊版匯出格式', tone: 'assistant' },
        ]);
      }
      if (i === 7) expect(plates(plan).slice(3).map((p) => p?.tone)).toEqual(['assistant', 'done', 'assistant']);
      if (i === round.length - 4) {
        // 主人 Stop 之後再過 HELPER_LINGER：三個助理都走了，座位 3–5 的桌子留著、沒有名牌
        now += HELPER_LINGER;
        const after = frame();
        expect(after[0].desks).toBe(6);
        expect(plates(after).slice(3)).toEqual([null, null, null]);
      }
    }
    expect(Object.keys(state.employees)).toEqual([]);
    expect(frame()).toEqual([]);
    expect(minDesks.size).toBe(0);
  }
});
