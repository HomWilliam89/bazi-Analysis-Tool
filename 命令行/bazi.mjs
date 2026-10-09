#!/usr/bin/env node
// 命令行/bazi.mjs
// 八字分析工具 · 期 5 核心命令行总装交付入口（D-039 落地）
// 用法示例：
//   1. 生辰模式：node 命令行/bazi.mjs --solar "1990-05-20 14:30" --gender 男
//   2. 四柱模式：node 命令行/bazi.mjs 庚午 辛巳 乙酉 癸未
//   3. 导出报告：node 命令行/bazi.mjs --solar "1990-05-20 14:30" -o 报告.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidGregorianDate, isValidGanzhi, isValidYear } from '../核心/engine.mjs';
import { generateFullReport, formatConsoleSummary, ensureFullChart } from '../核心/report-generator.mjs';

function printHelp() {
  console.log(`
======================================================================
八字分析工具 · 三段式全景命理解读命令行工具 (bazi CLI v1.0)
======================================================================

【基本用法】
  node 命令行/bazi.mjs [四柱列表 | 生辰选项] [输出选项]

【使用模式 1：四柱模式】
  node 命令行/bazi.mjs 庚午 辛巳 乙酉 癸未 [-y 1990] [--gender 男|女]
  node 命令行/bazi.mjs --pillars "庚午 辛巳 乙酉 癸未" [-y 1990] [--gender 男|女]

【使用模式 2：公历生辰模式】
  node 命令行/bazi.mjs --solar "1990-05-20 14:30" [--gender 男|女] [-L 113.3]
  node 命令行/bazi.mjs -y 1990 -m 5 -d 20 -H 14 -i 30 [-g 男|女] [-L 113.3]

【常用参数选项】
  -H, --hour <小时>          出生小时（0-23）
  -i, --minute <分钟>        出生分钟（0-59，默认 0）
  -L, --longitude <经度>     出生地经度（东经为正，如 113.3，用于真太阳时天文校正；默认按北京时间 120°E 平太阳时）
  -y, --year <年份>          生辰年份或四柱推算时代基准年（1000-2500）
  -g, --gender <性别>        命主性别：男（默认）| 女
  -o, --output <文件路径>    导出万字级深度 Markdown 决策咨询报告至指定文件
  -f, --format <类型>        输出格式：console（默认控制台概览）| md（完整 Markdown）| json（原始数据）
  --full                     在控制台终端直接打印完整万字 Markdown 报告
  -h, --help                 显示本帮助信息并退出

【核心交付特色】
  1. 第一段：客观排盘事实（竖排四柱卡片、五行能量对比条、得令得地得势旺衰、真太阳时经度校正披露）
  2. 第二段：丙层各派并陈（格局派、滴天髓、穷通调候、盲派、新派、神煞象义六派不选边）
  3. 第三段：乙体系体用路线法推演（子平成破救应、去留路线、全景双通路、财富流年、心性战略规划）
  4. 第四段：四重免责声明与科学唯物认知导引
======================================================================
`);
}

function parseCliArgs(args) {
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
    output: null,
    format: 'console',
    full: false,
    help: false,
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') {
      options.help = true;
    } else if (a === '-o' || a === '--output') {
      options.output = args[++i];
    } else if (a === '-f' || a === '--format') {
      options.format = args[++i];
    } else if (a === '--full') {
      options.full = true;
    } else if (a === '-g' || a === '--gender') {
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

  // 若存在位置参数四柱：如 庚午 辛巳 乙酉 癸未
  if (positional.length === 4) {
    options.pillars = positional;
  } else if (positional.length === 1 && positional[0].includes(' ')) {
    options.pillars = positional[0].trim().split(/\s+/);
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2)) {
  const opts = parseCliArgs(argv);

  if (opts.help || (argv.length === 0 && !opts.solar && opts.pillars.length === 0)) {
    printHelp();
    return 0;
  }

  // 经度合法性校验
  if (opts.longitude !== null) {
    if (!Number.isFinite(opts.longitude) || opts.longitude < -180 || opts.longitude > 180) {
      console.error(`错误：经度「${opts.longitude}」不合法，须为 -180 至 180 之间的有效数值（东经为正）`);
      return 1;
    }
  }

  let input;

  if (opts.solar) {
    // 解析形如 "1990-05-20 14:30" 或 "1990-05-20T14:30"
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
      console.error(`错误：同时指定了生辰公历「${opts.solar}」与年份参数「-y ${opts.year}」，两者年份冲突，请勿传入不一致年份`);
      return 1;
    }
    if (!isValidYear(y)) {
      console.error(`错误：年份「${y}」不合法，仅支持公元 1000 至 2500 年之间整数年份`);
      return 1;
    }
    if (!isValidGregorianDate(y, m, d) || h < 0 || h > 23 || min < 0 || min >= 60) {
      console.error(`错误：生辰日期或时间「${opts.solar}」不合法，超出公历历法有效天数或时间范围`);
      return 1;
    }
    input = {
      year: y,
      month: m,
      day: d,
      hour: h,
      minute: min,
      gender: opts.gender,
    };
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
  } else if (opts.year !== null || opts.month !== null || opts.day !== null) {
    if (opts.year === null || opts.month === null || opts.day === null) {
      console.error('错误：指定年/月/日生辰时，必须同时提供 --year、--month 与 --day 参数');
      return 1;
    }
    const y = opts.year;
    const m = opts.month;
    const d = opts.day;
    const h = opts.hour ?? 12;
    const min = opts.minute ?? 0;
    if (!isValidYear(y)) {
      console.error(`错误：年份「${y}」不合法，仅支持公元 1000 至 2500 年之间整数年份`);
      return 1;
    }
    if (!isValidGregorianDate(y, m, d) || h < 0 || h > 23 || min < 0 || min >= 60) {
      console.error(`错误：生辰日期或时间「${y}-${m}-${d} ${h}:${min}」不合法，超出公历历法有效范围`);
      return 1;
    }
    input = {
      year: y,
      month: m,
      day: d,
      hour: h,
      minute: min,
      gender: opts.gender,
    };
  } else {
    console.error('错误：必须指定生辰（--solar "YYYY-MM-DD HH:mm"）或四柱（年柱 月柱 日柱 时柱）。输入 -h 查看帮助。');
    return 1;
  }

  let report;
  try {
    report = generateFullReport(input, {
      gender: opts.gender,
      year: opts.year,
      longitude: opts.longitude,
    });
  } catch (err) {
    console.error(`执行排盘推演失败：${err.message}`);
    return 1;
  }

  // 1. 若指定文件导出
  if (opts.output) {
    const outPath = path.resolve(process.cwd(), opts.output);
    try {
      fs.writeFileSync(outPath, report.markdown, 'utf8');
      console.log(`\n✓ 成功导出万字级深度 Markdown 决策咨询报告至：\n  ${outPath}\n`);
    } catch (err) {
      console.error(`写入输出文件失败：${err.message}`);
      return 1;
    }
  }

  // 2. 控制台输出
  if (opts.format === 'json') {
    console.log(JSON.stringify(report.chart, null, 2));
  } else if (opts.format === 'md' || opts.format === 'markdown' || opts.full) {
    console.log(report.markdown);
  } else {
    // 默认 console 概览
    console.log(formatConsoleSummary(report.chart));
    if (!opts.output) {
      console.log('提示：使用 --full 可在终端打印完整万字解读，或使用 -o <file.md> 导出 Markdown 文件。\n');
    }
  }

  return 0;
}

// 若直接以脚本执行
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  runCli().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
