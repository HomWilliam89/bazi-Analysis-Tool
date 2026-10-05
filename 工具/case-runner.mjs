// 案例跑器（v1）：校验 案例\*.jsonl 的格式与规矩；判据建成后升级为真跑（读引擎、比期望）。
// 用法：node 工具\case-runner.mjs
// 退出码：0 全绿；1 有红项。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 案例目录 = path.join(ROOT, '案例');

let 行数 = 0;
let 红数 = 0;
const 报告 = [];
const ids = new Set();

for (const f of fs.readdirSync(案例目录)) {
  if (!f.endsWith('.jsonl')) continue;
  const lines = fs.readFileSync(path.join(案例目录, f), 'utf8')
    .split(/\r?\n/).filter((l) => l.trim());
  lines.forEach((line, i) => {
    行数 += 1;
    let o;
    try { o = JSON.parse(line); }
    catch { 红数 += 1; 报告.push(`${f}:${i + 1} JSON 解析失败`); return; }
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
    if (errs.length > 0) { 红数 += 1; 报告.push(`${f}:${i + 1} ${errs.join('；')}`); }
  });
}

console.log(`案例校验：${行数} 行，红 ${红数}`);
if (红数 > 0) {
  for (const r of 报告) console.log('  ✗ ' + r);
  process.exit(1);
}
console.log('  ✓ 全绿（判据建成前只验格式，不跑期望）');
