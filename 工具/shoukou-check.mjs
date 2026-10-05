// 收口检查器（v1）：检查本仓文档的收口与编码纪律。只读、零依赖。
// 用法：node 工具\shoukou-check.mjs
// 退出码：0 全绿；1 有红项。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 禁词清单（本文件是唯一维护处；文档中不得出现这些词）
const 禁词 = ['已过期', '旧口径', '待补', '待实现', '原文保留', '已作废', '历史件', '旧版此处'];
// 检查范围
const 检查目标 = ['文档', '规矩', '流派', 'README.md', 'AGENTS.md'];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const 问题 = [];
let 文件数 = 0;

for (const 目标 of 检查目标) {
  const full = path.join(ROOT, 目标);
  if (!fs.existsSync(full)) continue;
  const files = fs.statSync(full).isDirectory() ? walk(full) : [full];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    文件数 += 1;
    const rel = path.relative(ROOT, f);
    const buf = fs.readFileSync(f);
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      问题.push(`${rel}：带 BOM（须 UTF-8 无 BOM）`);
    }
    const text = buf.toString('utf8');
    const 乱码数 = (text.match(/\uFFFD/g) || []).length;
    if (乱码数 > 0) 问题.push(`${rel}：解码出 ${乱码数} 个替换符（疑似非 UTF-8）`);
    for (const 词 of 禁词) {
      if (text.includes(词)) 问题.push(`${rel}：出现禁词「${词}」`);
    }
  }
}

console.log(`收口检查：${文件数} 个 md，红 ${问题.length}`);
if (问题.length > 0) {
  for (const q of 问题) console.log('  ✗ ' + q);
  process.exit(1);
}
console.log('  ✓ 全绿');
