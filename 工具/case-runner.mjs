// 案例跑器（v2 真跑版）：校验 案例\*.jsonl 格式，并驱动排盘底座与体用模块进行真跑回归断言。
// 用法：node 工具\case-runner.mjs [--strict] [--format-only]
// 退出码：0 全绿 / 挂账分歧明确可控；1 格式解析错误或 --strict 模式下存在断言失败。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEMS, BRANCHES, castChart } from '../核心/engine.mjs';
import { tiyongRouteOf } from '../核心/tiyong.mjs';

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

  const chart = c.盘.ganzhi ? { pillars: pillarsOf(c.盘.ganzhi) } : castChart(c.盘.birth);
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
