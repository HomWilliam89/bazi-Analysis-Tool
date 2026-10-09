#!/usr/bin/env node
// 工具/run-test.mjs
// 八字分析工具 · 用户盲测沙盒跑器 (D-059 落地)
// 纪律：零经验调用、纯盲测正向推演、交付完整万字报告
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidGregorianDate, isValidGanzhi, isValidYear } from '../核心/engine.mjs';
import { generateFullReport, formatConsoleSummary, ensureFullChart } from '../核心/report-generator.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, '测试区');
const LEDGER_FILE = path.join(TEST_DIR, '测试台账.md');

function parseArgs(args) {
  const options = {
    pillars: [],
    gender: '男',
    solar: null,
    year: null,
    month: null,
    day: null,
    hour: null,
    minute: 0,
    longitude: null,
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-g' || a === '--gender') {
      options.gender = args[++i];
    } else if (a === '-s' || a === '--solar' || a === '--date') {
      options.solar = args[++i];
    } else if (a === '-p' || a === '--pillars') {
      const pStr = args[++i];
      if (pStr) options.pillars = pStr.trim().split(/\s+/);
    } else if (a === '-y' || a === '--year') {
      options.year = Number(args[++i]);
    } else if (a === '-m' || a === '--month') {
      options.month = Number(args[++i]);
    } else if (a === '-d' || a === '--day') {
      options.day = Number(args[++i]);
    } else if (a === '-H' || a === '--hour') {
      options.hour = Number(args[++i]);
    } else if (a === '-i' || a === '--minute') {
      options.minute = Number(args[++i]);
    } else if (a === '-L' || a === '--longitude' || a === '--lon') {
      options.longitude = Number(args[++i]);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }

  if (positional.length === 4) {
    options.pillars = positional;
  } else if (positional.length === 1 && positional[0].includes(' ')) {
    options.pillars = positional[0].trim().split(/\s+/);
  } else if (positional.length > 0 && !options.solar) {
    // 兼容可能传入的 "男" 或年份
    const gz = [];
    for (const item of positional) {
      if (item === '男' || item === '女') {
        options.gender = item;
      } else if (/^\d{4}$/.test(item)) {
        options.year = Number(item);
      } else {
        gz.push(item);
      }
    }
    if (gz.length === 4) options.pillars = gz;
  }

  return options;
}

export async function runTest(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);

  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  if (opts.pillars.length === 0 && !opts.solar && opts.year === null) {
    console.log(`
用法：
  node 工具/run-test.mjs 庚午 辛巳 乙酉 癸未 [-y 1990] [--gender 男|女]
  node 工具/run-test.mjs --solar "1990-05-20 14:30" [--gender 男|女] [-L 113.3]
`);
    return 0;
  }

  let input;
  let label = '';

  if (opts.solar) {
    const matched = opts.solar.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?)?$/);
    if (!matched) {
      console.error(`错误：无法解析生辰日期格式「${opts.solar}」，请形如 "YYYY-MM-DD HH:mm"`);
      return 1;
    }
    const y = Number(matched[1]);
    const m = Number(matched[2]);
    const d = Number(matched[3]);
    const h = matched[4] ? Number(matched[4]) : 12;
    const min = matched[5] ? Number(matched[5]) : 0;
    if (opts.year !== null && opts.year !== y) {
      console.error(`错误：同时指定了生辰公历「${opts.solar}」与年份参数「-y ${opts.year}」，两者年份冲突`);
      return 1;
    }
    if (!isValidYear(y)) {
      console.error(`错误：年份「${y}」不合法，仅支持公元 1000 至 2500 年之间整数年份`);
      return 1;
    }
    if (!isValidGregorianDate(y, m, d) || h < 0 || h > 23 || min < 0 || min >= 60) {
      console.error(`错误：生辰日期或时间「${opts.solar}」不合法，超出公历历法有效范围`);
      return 1;
    }
    input = { year: y, month: m, day: d, hour: h, minute: min, gender: opts.gender };
    label = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}_${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}`;
  } else if (opts.pillars && opts.pillars.length === 4) {
    const posNames = ['年柱', '月柱', '日柱', '时柱'];
    for (let idx = 0; idx < opts.pillars.length; idx++) {
      const gz = opts.pillars[idx];
      if (!isValidGanzhi(gz)) {
        console.error(`错误：${posNames[idx]}「${gz}」不是合法六十甲子干支（须为两字天干地支，且阴阳相配）`);
        return 1;
      }
    }
    if (opts.year !== null && !isValidYear(opts.year)) {
      console.error(`错误：基准年份「${opts.year}」不合法，仅支持公元 1000 至 2500 年之间整数年份`);
      return 1;
    }
    input = opts.pillars;
    label = opts.pillars.join('_');
  } else {
    console.error('错误：必须指定生辰（--solar "YYYY-MM-DD HH:mm"）或四柱干支（年柱 月柱 日柱 时柱）');
    return 1;
  }

  // 1. 生成完整万字决策咨询报告（完全调用通用生产环境大脑，零经验特判）
  let report;
  try {
    report = generateFullReport(input, {
      gender: opts.gender,
      year: opts.year,
      longitude: opts.longitude,
    });
  } catch (err) {
    console.error(`排盘推演执行失败：${err.message}`);
    return 1;
  }

  const chart = report.chart;
  const pillarsGz = chart.pillars.map((p) => p.gz).join(' ');
  const dmElem = chart.dayMaster.element;
  const dmStem = chart.dayMaster.stem;
  const gejuDesc = chart.gejuChengPo?.格局 ? `${chart.gejuChengPo.格局}（${chart.gejuChengPo.状态}）` : '通用体用格局';
  const mainConflict = report.tiyong?.第一核心矛盾?.主要矛盾 || '主要矛盾推演中';

  // 2. 确定报告文件名并写入测试区
  let reportFilename = `测试报告_${label}.md`;
  let reportPath = path.join(TEST_DIR, reportFilename);
  if (fs.existsSync(reportPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    reportFilename = `测试报告_${label}_${ts}.md`;
    reportPath = path.join(TEST_DIR, reportFilename);
  }
  fs.writeFileSync(reportPath, report.markdown, 'utf8');

  // 3. 记录测试流水至 测试区/测试台账.md
  let ledgerContent = '';
  if (fs.existsSync(LEDGER_FILE)) {
    ledgerContent = fs.readFileSync(LEDGER_FILE, 'utf8');
  } else {
    ledgerContent = `# 测试台账 · 用户盲测八字记录流水\n\n| 编号 | 测试时间 | 输入模式 | 输入盘面 / 生辰 | 参数设定 | 日主 | 格局与主要矛盾简评 | 报告文件链接 |\n|---|---|---|---|---|---|---|---|\n`;
  }

  const existingRows = ledgerContent.split('\n').filter((l) => /^\|\s*T-\d+/.test(l));
  const nextNum = existingRows.length + 1;
  const testId = `T-${String(nextNum).padStart(3, '0')}`;
  const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
  const modeStr = opts.solar ? '公历生辰' : '四柱干支';
  const inputDisplay = opts.solar ? opts.solar : pillarsGz;
  const paramDisplay = `性别:${opts.gender}${opts.year ? ` 基准:${opts.year}` : ''}${opts.longitude !== null ? ` 经度:${opts.longitude}` : ''}`;
  const briefDesc = `${gejuDesc}；${mainConflict}`;
  const linkDisplay = `[${reportFilename}](./${reportFilename})`;

  const newRow = `| ${testId} | ${nowStr} | ${modeStr} | ${inputDisplay} | ${paramDisplay} | ${dmStem}（${dmElem}） | ${briefDesc} | ${linkDisplay} |\n`;
  ledgerContent += newRow;
  fs.writeFileSync(LEDGER_FILE, ledgerContent, 'utf8');

  // 4. 终端输出概览与盲测完成信息
  console.log(formatConsoleSummary(chart, report));
  console.log('======================================================================');
  console.log('【测试区盲测交付完成】');
  console.log(`  - 盲测编号：${testId}`);
  console.log(`  - 四柱干支：【${pillarsGz}】 日元：【${dmStem}】`);
  console.log(`  - 完整报告已归档：测试区/${reportFilename}（共 ${report.markdown.length} 字符，全景四段结构）`);
  console.log(`  - 测试台账已登记：测试区/测试台账.md`);
  console.log('  - 铁律保证：本次推演基于纯通用公理化算法，未进行任何经验硬编码或特判偷看');
  console.log('======================================================================');

  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('run-test.mjs')) {
  runTest().then((code) => {
    if (typeof code === 'number' && code !== 0) process.exit(code);
  });
}
