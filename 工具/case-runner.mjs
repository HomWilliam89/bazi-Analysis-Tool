// 案例跑器（v2 真跑版）：校验 案例\*.jsonl 格式，并驱动排盘底座与体用模块进行真跑回归断言。
// 用法：node 工具\case-runner.mjs [--strict] [--format-only]
// 退出码：0 全绿 / 挂账分歧明确可控；1 格式解析错误或 --strict 模式下存在断言失败。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEMS, BRANCHES, castChart, gzRelations, shenshaOf } from '../核心/engine.mjs';
import {
  tiyongRouteOf, canControlOf, canTransformOf, canBindOf,
  protectionChainOf, youJiuOf, fanwangOf, xiangzhanOf, siXiangOf,
  selfHiddenCombineOf,
} from '../核心/tiyong.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 案例目录 = path.join(ROOT, '案例');
const isStrict = process.argv.includes('--strict');
const formatOnly = process.argv.includes('--format-only');

function pillarsOf(gzList) {
  const pos = ['年柱', '月柱', '日柱', '时柱'];
  return gzList.map((gz, i) => ({
    position: pos[i],
    gz,
    stem: gz[0],
    branch: gz[1],
    stemIndex: STEMS.indexOf(gz[0]),
    branchIndex: BRANCHES.indexOf(gz[1]),
  }));
}

let 行数 = 0;
let 格式红数 = 0;
const 格式报告 = [];
const ids = new Set();
const casesToRun = [];

// ====================================================================
// 1. 案例文件与 Schema 格式校验
// ====================================================================
for (const f of fs.readdirSync(案例目录)) {
  if (!f.endsWith('.jsonl')) continue;
  const lines = fs.readFileSync(path.join(案例目录, f), 'utf8')
    .split(/\r?\n/).filter((l) => l.trim());
  lines.forEach((line, i) => {
    行数 += 1;
    let o;
    try { o = JSON.parse(line); }
    catch { 格式红数 += 1; 格式报告.push(`${f}:${i + 1} JSON 解析失败`); return; }
    const errs = [];
    if (!o || typeof o !== 'object') {
      errs.push('须是对象');
    } else {
      if (typeof o.id !== 'string' || !/^C-\d+$/.test(o.id)) errs.push('id 须形如 C-###');
      else if (ids.has(o.id)) errs.push('id 重复');
      else ids.add(o.id);
      if (!Array.isArray(o.判据) || o.判据.length === 0) errs.push('判据 须是非空数组');
      if (!o.盘 || (typeof o.盘.ganzhi === 'undefined' && typeof o.盘.birth === 'undefined')) {
        errs.push('盘 须含 ganzhi 或 birth');
      }
      if (typeof o.期望 === 'undefined') {
        errs.push('期望 字段缺失');
      } else if (o.期望 === null) {
        if (!o.说明) errs.push('期望为 null 时 说明 必须挂决策编号');
      } else if (typeof o.期望 !== 'object') {
        errs.push('期望 须是对象或 null');
      }
    }
    if (errs.length > 0) {
      格式红数 += 1;
      格式报告.push(`${f}:${i + 1} ${errs.join('；')}`);
    } else {
      casesToRun.push(o);
    }
  });
}

console.log('======================================================================');
console.log('八字分析工具 · 案例真跑回归跑器 (v2)');
console.log('======================================================================');
console.log(`[格式检查] 案例总行数：${行数} 行，格式红项：${格式红数}`);
if (格式红数 > 0) {
  for (const r of 格式报告) console.log('  ✗ ' + r);
  process.exit(1);
}
console.log('  ✓ 案例格式与 Schema 全绿\n');

if (formatOnly) {
  process.exit(0);
}

// ====================================================================
// 2. 驱动引擎推演与断言比对（真跑回归）
// ====================================================================
console.log('[真跑回归推演与断言比对]');
console.log('----------------------------------------------------------------------');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

for (const c of casesToRun) {
  const gzStr = c.盘.ganzhi ? c.盘.ganzhi.join(' ') : JSON.stringify(c.盘.birth);
  console.log(`▶ 案例 ${c.id}【${gzStr}】 挂钩判据: [${c.判据.join(', ')}]`);
  console.log(`  说明: ${c.说明}`);

  if (c.期望 === null) {
    console.log('  ⚪ 期望值为 null（待裁定挂账，跳过断言）\n');
    continue;
  }

  const chart = c.盘.ganzhi ? {
    pillars: pillarsOf(c.盘.ganzhi),
    dayMaster: {
      stem: c.盘.ganzhi[2][0],
      element: ['木', '火', '土', '金', '水'][[0, 0, 1, 1, 2, 2, 3, 3, 4, 4][STEMS.indexOf(c.盘.ganzhi[2][0])]],
      bornMonthBranch: c.盘.ganzhi[1][1],
    },
  } : castChart(c.盘.birth);
  if (!chart.relations) chart.relations = gzRelations(chart.pillars, null);
  if (!chart.shensha) {
    const dayStemIdx = STEMS.indexOf(chart.pillars[2].stem);
    const yearStemIdx = STEMS.indexOf(chart.pillars[0].stem);
    chart.shensha = shenshaOf(chart.pillars, dayStemIdx, yearStemIdx, '男');
  }
  const yongArg = c.期望.用神五行 ?? (Array.isArray(c.期望.用神) ? c.期望.用神[0] : null);
  const jiArg = Array.isArray(c.期望.忌神) ? c.期望.忌神[0] : null;

  let res;
  try {
    res = tiyongRouteOf(chart, {
      ...(yongArg ? { 用神五行: yongArg } : {}),
      ...(jiArg ? { 忌神五行: jiArg } : {}),
    });
  } catch (err) {
    console.log(`  ✗ [推演异常] 引擎执行出错: ${err.message}\n`);
    totalAssertions += 1;
    failedAssertions += 1;
    failureDetails.push({ id: c.id, item: '引擎执行', exp: '正常输出', act: err.message, p: c.判据 });
    continue;
  }

  // 断言 1: 通路威胁
  if (typeof c.期望.通路威胁 !== 'undefined') {
    totalAssertions += 1;
    const act = res.第一_财官威胁?.官杀?.构成威胁 ? '构成威胁' : '不构成威胁';
    const ok = act === c.期望.通路威胁;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [通路威胁] 期望: ${c.期望.通路威胁} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [通路威胁] 期望: ${c.期望.通路威胁} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '通路威胁', exp: c.期望.通路威胁, act, p: c.判据 });
    }
  }

  // 断言 2: 官杀担力 / 大势定性
  const expDanli = c.期望.官杀承载 ?? (c.期望.大势定性?.includes('体弱') || c.期望.大势定性?.includes('不可任') ? '不可任' : null);
  if (expDanli) {
    totalAssertions += 1;
    const act = res.主要矛盾?.官杀吉凶?.日主担力 ?? '—';
    const ok = act === expDanli;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [官杀担力] 期望: ${expDanli} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [官杀担力] 期望: ${expDanli} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '官杀担力', exp: expDanli, act, p: c.判据 });
    }
  }

  // 断言 3: 从格判定
  if (typeof c.期望.从格判定 !== 'undefined') {
    totalAssertions += 1;
    const act = (res.从格改判?.适用性?.includes('从格成立') || res.从格杂质检验?.综合?.includes('成从')) ? '从势' : '正格';
    const ok = act === c.期望.从格判定;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [从格判定] 期望: ${c.期望.从格判定} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [从格判定] 期望: ${c.期望.从格判定} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '从格判定', exp: c.期望.从格判定, act, p: c.判据 });
    }
  }

  // 断言 3b: 所从之势 (D-015 裁定)
  if (typeof c.期望.所从之势 !== 'undefined') {
    totalAssertions += 1;
    const act = res.从格改判?.所从之势 ?? '—';
    const ok = act === c.期望.所从之势;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [所从之势] 期望: ${c.期望.所从之势} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [所从之势] 期望: ${c.期望.所从之势} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '所从之势', exp: c.期望.所从之势, act, p: c.判据 });
    }
  }


  // 断言 4: 护卫状态
  if (typeof c.期望.护卫状态 !== 'undefined') {
    totalAssertions += 1;
    const act = (res.第三_用神护卫?.有效护卫?.length > 0 && !res.第三_用神护卫?.有路可直克用神) ? '有护卫' : '无护卫';
    const ok = act === c.期望.护卫状态;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [护卫状态] 期望: ${c.期望.护卫状态} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [护卫状态] 期望: ${c.期望.护卫状态} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '护卫状态', exp: c.期望.护卫状态, act, p: c.判据 });
    }
  }

  // 断言 5: 用神五行 / 路线
  if (typeof c.期望.用神五行 !== 'undefined') {
    totalAssertions += 1;
    const act = res.用神五行 ?? res.用神原表值 ?? '—';
    const ok = act === c.期望.用神五行;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [用神五行] 期望: ${c.期望.用神五行} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [用神五行] 期望: ${c.期望.用神五行} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '用神五行', exp: c.期望.用神五行, act, p: c.判据 });
    }
  }

  // 断言 6: 印比有情
  if (typeof c.期望.印比有情 !== 'undefined') {
    totalAssertions += 1;
    const act = (res.第二_印比有情?.结论?.includes('印比无情') || res.第二_印比有情?.结论?.includes('无情') || res.第二_印比有情?.有情的印比?.length === 0) ? '无情' : '有情';
    const ok = act === c.期望.印比有情;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [印比有情] 期望: ${c.期望.印比有情} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [印比有情] 期望: ${c.期望.印比有情} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '印比有情', exp: c.期望.印比有情, act, p: c.判据 });
    }
  }

  // 断言 7: 结构稳定
  if (typeof c.期望.结构稳定 !== 'undefined') {
    totalAssertions += 1;
    const act = (res.第四_结构稳定?.动摇计数?.合计 === 0) ? '稳固' : '动摇';
    const ok = act === c.期望.结构稳定;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [结构稳定] 期望: ${c.期望.结构稳定} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [结构稳定] 期望: ${c.期望.结构稳定} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '结构稳定', exp: c.期望.结构稳定, act, p: c.判据 });
    }
  }

  // 断言 8: 制神有效
  if (typeof c.期望.制神有效 !== 'undefined') {
    totalAssertions += 1;
    const zhiRes = canControlOf(chart, c.期望.制神五行, c.期望.被制五行);
    const act = zhiRes.结论.startsWith('**能制**') ? '能制' : '不能制';
    const ok = act === c.期望.制神有效;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [制神有效] 期望: ${c.期望.制神有效} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [制神有效] 期望: ${c.期望.制神有效} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '制神有效', exp: c.期望.制神有效, act, p: c.判据 });
    }
  }

  // 断言 9: 化神有效
  if (typeof c.期望.化神有效 !== 'undefined') {
    totalAssertions += 1;
    const huaRes = canTransformOf(chart, c.期望.化神五行);
    const act = (huaRes.化名 === '真化' || huaRes.结论.startsWith('**能化尽**')) ? '能化' : '不能化';
    const ok = act === c.期望.化神有效;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [化神有效] 期望: ${c.期望.化神有效} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [化神有效] 期望: ${c.期望.化神有效} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '化神有效', exp: c.期望.化神有效, act, p: c.判据 });
    }
  }

  // 断言 10: 合绊定性
  if (typeof c.期望.合绊定性 !== 'undefined') {
    totalAssertions += 1;
    const bindRes = canBindOf(chart, c.期望.合神五行, { 有故: c.期望.合意图 === '有故' });
    let act = '未合';
    if (bindRes.结论.includes('合住且为我所用')) act = '合住且为我所用';
    else if (bindRes.结论.includes('合住而不为我所用')) act = '合住而不为我所用';
    const ok = act === c.期望.合绊定性;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [合绊定性] 期望: ${c.期望.合绊定性} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [合绊定性] 期望: ${c.期望.合绊定性} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '合绊定性', exp: c.期望.合绊定性, act, p: c.判据 });
    }
  }

  // 断言 11: 护卫链结局
  if (typeof c.期望.护卫链结局 !== 'undefined') {
    totalAssertions += 1;
    const chainRes = protectionChainOf(chart, c.期望.用神五行);
    const act = chainRes.结局?.类 ?? '—';
    const ok = act === c.期望.护卫链结局;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [护卫链结局] 期望: ${c.期望.护卫链结局} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [护卫链结局] 期望: ${c.期望.护卫链结局} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '护卫链结局', exp: c.期望.护卫链结局, act, p: c.判据 });
    }
  }

  // 断言 12: 有救底线
  if (typeof c.期望.有救底线 !== 'undefined') {
    totalAssertions += 1;
    const yjRes = youJiuOf(chart, c.期望.用神五行);
    let act = '无救';
    if (yjRes.档.startsWith('最强')) act = '有救且有力';
    else if (yjRes.档.startsWith('次强')) act = '次强有救';
    else if (yjRes.档.startsWith('中强')) act = '中强有救';
    else if (yjRes.档.includes('虚露')) act = '救而无力';
    const ok = act === c.期望.有救底线;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [有救底线] 期望: ${c.期望.有救底线} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [有救底线] 期望: ${c.期望.有救底线} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '有救底线', exp: c.期望.有救底线, act, p: c.判据 });
    }
  }

  // 断言 13: 犯旺判定
  if (typeof c.期望.犯旺判定 !== 'undefined') {
    totalAssertions += 1;
    const fwRes = fanwangOf(chart, { 岁运: c.期望.岁运 });
    const act = fwRes.有 ? '犯旺' : '不犯旺';
    const ok = act === c.期望.犯旺判定;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [犯旺判定] 期望: ${c.期望.犯旺判定} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [犯旺判定] 期望: ${c.期望.犯旺判定} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '犯旺判定', exp: c.期望.犯旺判定, act, p: c.判据 });
    }
  }

  // 断言 14: 相战择优
  if (typeof c.期望.相战择优 !== 'undefined') {
    totalAssertions += 1;
    const xzRes = xiangzhanOf(chart, { 用神五行: c.期望.用神五行 });
    const raw = xzRes.相战[0]?.择优?.净判 ?? '无好用手段';
    const act = raw.replace(/\*\*/g, '');
    const ok = act === c.期望.相战择优;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [相战择优] 期望: ${c.期望.相战择优} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [相战择优] 期望: ${c.期望.相战择优} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '相战择优', exp: c.期望.相战择优, act, p: c.判据 });
    }
  }

  // 断言 15: 月令四象
  if (typeof c.期望.月令四象 !== 'undefined') {
    totalAssertions += 1;
    const sxRes = siXiangOf(chart.dayMaster.bornMonthBranch);
    const act = sxRes.两法一致 ? '两法一致' : '两法不一致';
    const ok = act === c.期望.月令四象;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [月令四象] 期望: ${c.期望.月令四象} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [月令四象] 期望: ${c.期望.月令四象} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '月令四象', exp: c.期望.月令四象, act, p: c.判据 });
    }
  }

  // 断言 16: 暗合判定 (P-015 · D-029 裁定)
  if (typeof c.期望.暗合判定 !== 'undefined') {
    totalAssertions += 1;
    const act = res.自合暗合?.判定 ?? selfHiddenCombineOf(chart).判定;
    const ok = act === c.期望.暗合判定;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [暗合判定] 期望: ${c.期望.暗合判定} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [暗合判定] 期望: ${c.期望.暗合判定} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '暗合判定', exp: c.期望.暗合判定, act, p: c.判据 });
    }
  }

  // 断言 17: 鸳鸯合判定 (D-035 裁定)
  if (typeof c.期望.鸳鸯合 !== 'undefined') {
    totalAssertions += 1;
    const act = (chart.relations?.鸳鸯合?.length > 0) ? '有鸳鸯合' : '无鸳鸯合';
    const ok = act === c.期望.鸳鸯合;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [鸳鸯合] 期望: ${c.期望.鸳鸯合} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [鸳鸯合] 期望: ${c.期望.鸳鸯合} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '鸳鸯合', exp: c.期望.鸳鸯合, act, p: c.判据 });
    }
  }

  // 断言 18: 反吟判定 (D-035 裁定)
  if (typeof c.期望.反吟判定 !== 'undefined') {
    totalAssertions += 1;
    const act = (chart.relations?.反吟?.length > 0) ? '有反吟' : '无反吟';
    const ok = act === c.期望.反吟判定;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [反吟判定] 期望: ${c.期望.反吟判定} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [反吟判定] 期望: ${c.期望.反吟判定} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '反吟判定', exp: c.期望.反吟判定, act, p: c.判据 });
    }
  }

  // 断言 19: 暗禄判定 (D-033 裁定)
  if (typeof c.期望.暗禄 !== 'undefined') {
    totalAssertions += 1;
    const hasAnlu = chart.shensha?.some((s) => s.name === '暗禄');
    const hasAnluDay = chart.shensha?.some((s) => s.name === '暗禄日');
    let act = '无暗禄';
    if (hasAnlu && hasAnluDay) act = '暗禄兼暗禄日';
    else if (hasAnluDay) act = '暗禄日';
    else if (hasAnlu) act = '有暗禄';

    const ok = act === c.期望.暗禄;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [暗禄] 期望: ${c.期望.暗禄} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [暗禄] 期望: ${c.期望.暗禄} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '暗禄', exp: c.期望.暗禄, act, p: c.判据 });
    }
  }

  // 断言 20: 双轨意象研判 (D-031 裁定)
  if (typeof c.期望.双轨意象 !== 'undefined') {
    totalAssertions += 1;
    const target = c.期望.双轨意象;
    let act = '未命中';
    const entries = res.双轨意象?.关系条目 ?? [];
    if (Array.isArray(entries)) {
      const match = entries.find((item) => {
        if (target.类别 && item.类别 !== target.类别) return false;
        if (target.字 && !item.字.includes(target.字[0]) && !item.字.includes(target.字[1])) return false;
        return true;
      });
      if (match) {
        act = match.定性;
      }
    }
    const exp = target.定性;
    const ok = act === exp;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [双轨意象] 期望: ${target.类别 ?? ''}${target.字 ?? ''}${exp} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [双轨意象] 期望: ${target.类别 ?? ''}${target.字 ?? ''}${exp} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '双轨意象', exp, act, p: c.判据 });
    }
  }

  // 断言 21: 受力仲裁判定 (D-030 裁定)
  if (typeof c.期望.受力仲裁 !== 'undefined') {
    totalAssertions += 1;
    const target = c.期望.受力仲裁;
    let act = '未命中';
    const zhicheng = res.第四_结构稳定?.多重仲裁?.逐支受力 ?? [];
    if (Array.isArray(zhicheng)) {
      const match = zhicheng.find((z) => {
        if (target.宫位 && !z.宫位.startsWith(target.宫位[0])) return false;
        if (target.字 && z.字 !== target.字) return false;
        return true;
      });
      if (match) {
        act = match.最终受力;
      }
    }
    const exp = target.受力;
    const ok = act === exp;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [受力仲裁] 期望: ${target.宫位 ?? ''}${target.字 ?? ''}${exp} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [受力仲裁] 期望: ${target.宫位 ?? ''}${target.字 ?? ''}${exp} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '受力仲裁', exp, act, p: c.判据 });
    }
  }

  // 断言 22: 体系覆盖判定 (D-037 裁定 · 认怂出口)
  if (typeof c.期望.体系覆盖 !== 'undefined') {
    totalAssertions += 1;
    const act = res.覆盖?.covered ? '已覆盖' : '未覆盖';
    const exp = c.期望.体系覆盖;
    const ok = act === exp;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [体系覆盖] 期望: ${exp} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [体系覆盖] 期望: ${exp} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '体系覆盖', exp, act, p: c.判据 });
    }
  }

  // 断言 23: 从儿比劫判定 (D-032 裁定 · 判据 P-016)
  if (typeof c.期望.从儿比劫 !== 'undefined') {
    totalAssertions += 1;
    const act = res.从儿分析?.比劫判定?.角色 ?? '非从儿';
    const ok = act === c.期望.从儿比劫;
    if (ok) {
      passedAssertions += 1;
      console.log(`  ✓ [从儿比劫] 期望: ${c.期望.从儿比劫} == 实际: ${act}`);
    } else {
      failedAssertions += 1;
      console.log(`  ✗ [从儿比劫] 期望: ${c.期望.从儿比劫} != 实际: ${act}`);
      failureDetails.push({ id: c.id, item: '从儿比劫', exp: c.期望.从儿比劫, act, p: c.判据 });
    }
  }

  console.log('');
}

console.log('----------------------------------------------------------------------');
console.log('【回归统计汇总】');
console.log(`  - 案例总数：${casesToRun.length} 盘`);
console.log(`  - 断言总项：${totalAssertions} 项`);
console.log(`  - 吻合项数：${passedAssertions} 项`);
console.log(`  - 分歧项数：${failedAssertions} 项`);

if (failedAssertions > 0) {
  console.log('\n★ 检出以下待对账分歧（挂账待依据判据收口）：');
  failureDetails.forEach((f) => {
    console.log(`  · [${f.id}] 项: ${f.item} ｜ 期望: ${f.exp} ｜ 实际: ${f.act} ｜ 依据判据: [${f.p.join(', ')}]`);
  });
  console.log('\n处置依据（AGENTS.md §6）：');
  console.log('  - A 类实现偏差：依已裁判据修复推演函数对应逻辑');
  console.log('  - B 类判据/期望冲突：登记台账由使用者裁定定案');
  if (isStrict) {
    process.exit(1);
  }
} else {
  console.log('\n✓ 全案回归断言 100% 吻合！');
}
