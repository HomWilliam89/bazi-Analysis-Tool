// 丙层 · 六大主流学派主张动态匹配引擎
// 依据决策台账 D-026 裁定落地：直接以 流派/*.md 的 180 条标准条目为单源事实（SSOT），
// 扫描排盘事实对象，动态匹配并陈列命中之各学派主张、成立条件与古籍出处。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT,
  castChart, hiddenStemsOf, tenGod, nayinOf, shenshaOf,
  gzRelations, elementStrength,
} from './engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 流派目录 = path.join(ROOT, '流派');

const SCHOOL_FILES = [
  { key: 'geju', file: '格局.md', name: '格局派' },
  { key: 'tiaohou', file: '调候.md', name: '调候派' },
  { key: 'wangshuai', file: '旺衰.md', name: '旺衰扶抑派' },
  { key: 'mangpai', file: '盲派象法.md', name: '盲派与象法' },
  { key: 'sanming', file: '古法三命.md', name: '古法三命' },
  { key: 'shensha', file: '神煞.md', name: '神煞派' },
];

let cachedEntries = null;

/**
 * 从 6 个 Markdown 单源文件中动态解析全部 180 条标准条目
 */
export function loadAllSchoolEntries(forceReload = false) {
  if (cachedEntries && !forceReload) return cachedEntries;
  const map = new Map();
  const list = [];

  for (const s of SCHOOL_FILES) {
    const fullPath = path.join(流派目录, s.file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('| S-')) continue;
      const parts = trimmed.split('|').map((p) => p.trim()).slice(1, -1);
      if (parts.length >= 5) {
        const entry = {
          id: parts[0],
          schoolKey: s.key,
          schoolName: s.name,
          claim: parts[1],
          condition: parts[2],
          source: parts[3],
          controversy: parts[4],
        };
        map.set(entry.id, entry);
        list.push(entry);
      }
    }
  }

  cachedEntries = { map, list };
  return cachedEntries;
}

/**
 * 提取命盘之全景干支与十神特征
 */
export function extractChartFeatures(chartInput) {
  let chart = chartInput;
  if (Array.isArray(chartInput)) {
    // 传入 ['庚申', '戊寅', '甲申', '壬申']
    const pos = ['年柱', '月柱', '日柱', '时柱'];
    chart = {
      pillars: chartInput.map((gz, i) => ({
        position: pos[i],
        gz,
        stem: gz[0],
        branch: gz[1],
      })),
      dayMaster: {
        stem: chartInput[2][0],
        element: STEM_ELEMENT[chartInput[2][0]],
        bornMonthBranch: chartInput[1][1],
      },
    };
  }

  const p = chart.pillars || [];
  const yearGz = p[0]?.gz || '';
  const monthGz = p[1]?.gz || '';
  const dayGz = p[2]?.gz || '';
  const hourGz = p[3]?.gz || '';

  const dayStem = p[2]?.stem || chart.dayMaster?.stem || '';
  const dayElement = STEM_ELEMENT[dayStem] || '';
  const monthBranch = p[1]?.branch || chart.dayMaster?.bornMonthBranch || '';

  const stems = p.map((x) => x.stem);
  const branches = p.map((x) => x.branch);
  const gzList = [yearGz, monthGz, dayGz, hourGz];

  const dayStemIdx = STEMS.indexOf(dayStem);
  const monthBranchIdx = BRANCHES.indexOf(monthBranch);
  const yearStemIdx = STEMS.indexOf(stems[0]);

  // 1. 十神透干（年月时）
  const exposedTenGods = [
    tenGod(dayStem, stems[0]),
    tenGod(dayStem, stems[1]),
    tenGod(dayStem, stems[3]),
  ].filter(Boolean);

  // 月令藏干与本气透干
  const monthHiddenList = (dayStemIdx >= 0 && monthBranchIdx >= 0)
    ? hiddenStemsOf(dayStemIdx, monthBranchIdx)
    : [];
  const mainEntry = monthHiddenList.find((h) => h.role === '本气') || monthHiddenList[0];
  const monthMainStem = mainEntry?.stem || '';
  const monthMainTenGod = mainEntry?.tenGod || tenGod(dayStem, monthMainStem);
  const monthMainStemExposed = stems.slice(0, 2).includes(monthMainStem) || stems[3] === monthMainStem;

  // 2. 地支相冲与相穿
  const chuanPairs = [];
  const chongPairs = [];
  const CHUAN_DEFS = [
    ['子', '未'], ['丑', '午'], ['寅', '巳'],
    ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
  ];
  const CHONG_DEFS = [
    ['子', '午'], ['丑', '未'], ['寅', '申'],
    ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
  ];

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const b1 = branches[i];
      const b2 = branches[j];
      if (CHUAN_DEFS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
        chuanPairs.push([i, j, b1, b2]);
      }
      if (CHONG_DEFS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
        chongPairs.push([i, j, b1, b2]);
      }
    }
  }

  // 3. 禄刃位
  const LU_MAP = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  const REN_MAP = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
  const luBranch = LU_MAP[dayStem] || '';
  const renBranch = REN_MAP[dayStem] || '';
  const hasLu = branches.includes(luBranch);
  const hasYangRen = branches.includes(renBranch);
  const luChong = chongPairs.some(([, , b1, b2]) => b1 === luBranch || b2 === luBranch);
  const luChuan = chuanPairs.some(([, , b1, b2]) => b1 === luBranch || b2 === luBranch);
  const yangRenChong = chongPairs.some(([, , b1, b2]) => b1 === renBranch || b2 === renBranch);

  // 4. 纳音与神煞
  const nayins = gzList.map((gz) => nayinOf(gz));
  const pillarsForShensha = gzList.map((gz) => ({
    stemIndex: STEMS.indexOf(gz[0]),
    branchIndex: BRANCHES.indexOf(gz[1]),
  }));
  let shenshaList = [];
  try {
    const rawSs = shenshaOf(pillarsForShensha, dayStemIdx, yearStemIdx, '男');
    if (Array.isArray(rawSs)) {
      shenshaList = rawSs.map((s) => (typeof s === 'string' ? s : s.name));
    } else if (rawSs && typeof rawSs === 'object') {
      shenshaList = Object.values(rawSs).flatMap((val) => (Array.isArray(val) ? val.map((x) => x.name || x) : []));
    }
  } catch {
    shenshaList = [];
  }

  // 天乙互换判定：年干贵人在日支，且日干贵人在年支
  const TIANYI_MAP = {
    甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
    乙: ['子', '申'], 己: ['子', '申'],
    丙: ['亥', '酉'], 丁: ['亥', '酉'],
    壬: ['巳', '卯'], 癸: ['巳', '卯'],
    辛: ['午', '寅'],
  };
  const yearStem = stems[0];
  const yearBranch = branches[0];
  const dayBranch = branches[2];
  const hasTianYiHuHuan = (TIANYI_MAP[yearStem] || []).includes(dayBranch)
    && (TIANYI_MAP[dayStem] || []).includes(yearBranch);

  // 5. 五行力量概况
  let elemStrength = null;
  try {
    elemStrength = elementStrength(pillarsForShensha);
  } catch {
    elemStrength = null;
  }

  return {
    chart,
    dayStem,
    dayElement,
    monthBranch,
    stems,
    branches,
    gzList,
    yearGz,
    monthGz,
    dayGz,
    hourGz,
    exposedTenGods,
    monthMainStem,
    monthMainTenGod,
    monthMainStemExposed,
    chuanPairs,
    chongPairs,
    luBranch,
    renBranch,
    hasLu,
    hasYangRen,
    luChong,
    luChuan,
    yangRenChong,
    nayins,
    shenshaList,
    hasTianYiHuHuan,
    elemStrength,
    isWinter: ['亥', '子', '丑'].includes(monthBranch),
    isSummer: ['巳', '午', '未'].includes(monthBranch),
    isSpring: ['寅', '卯', '辰'].includes(monthBranch),
    isAutumn: ['申', '酉', '戌'].includes(monthBranch),
  };
}

/**
 * 声明式匹配规则定义（针对 180 条主张进行特征谓词匹配）
 */
const MATCH_PREDICATES = {
  // 格局派
  'S-GJ-001': (f) => f.monthMainStemExposed,
  'S-GJ-002': (f) => f.exposedTenGods.includes('正官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-003': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-004': (f) => f.exposedTenGods.includes('食神') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-005': (f) => ['庚', '辛'].includes(f.dayStem) && f.isWinter && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀')),
  'S-GJ-006': (f) => (f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')) && f.exposedTenGods.includes('七杀'),
  'S-GJ-007': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-008': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-009': (f) => (f.branches[1] === f.luBranch || f.branches[1] === f.renBranch) && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正财')),
  'S-GJ-011': (f) => f.branches.filter((b) => BRANCH_ELEMENT[b] === f.dayElement).length >= 3,
  'S-GJ-013': (f) => f.hasYangRen && (f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官')),
  'S-GJ-014': (f) => ['辰', '戌', '丑', '未'].includes(f.monthBranch),
  'S-GJ-016': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && f.exposedTenGods.includes('正官'),
  'S-GJ-018': (f) => f.exposedTenGods.includes('偏印') && f.exposedTenGods.includes('食神'),
  'S-GJ-020': (f) => ['甲', '乙'].includes(f.dayStem) && f.isSummer && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('正官')),
  'S-GJ-022': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-024': (f) => f.hasYangRen && f.yangRenChong,
  'S-GJ-025': (f) => f.branches[3] === f.luBranch,
  'S-GJ-026': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-028': (f) => tenGod(f.dayStem, f.stems[3]) === '七杀',
  'S-GJ-029': (f) => ['壬午', '癸巳', '甲午'].includes(f.dayGz),
  'S-GJ-030': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),

  // 调候派
  'S-TH-001': (f) => f.isWinter && ['甲', '乙', '壬', '癸'].includes(f.dayStem),
  'S-TH-002': (f) => f.isSummer && ['戊', '己', '庚', '辛'].includes(f.dayStem),
  'S-TH-003': (f) => f.dayStem === '辛' && f.isAutumn,
  'S-TH-004': (f) => f.dayStem === '甲' && f.isSpring,
  'S-TH-005': (f) => f.isWinter || f.isSummer,
  'S-TH-006': (f) => f.dayStem === '甲' && f.isWinter && f.stems.includes('庚') && f.stems.includes('丁'),
  'S-TH-007': (f) => f.isSummer && ['壬', '癸'].includes(f.dayStem),
  'S-TH-008': (f) => f.branches.some((b) => ['辰', '丑', '未', '戌'].includes(b)),
  'S-TH-009': (f) => f.isWinter && ['庚', '辛'].includes(f.dayStem),
  'S-TH-010': (f) => ['甲', '乙'].includes(f.dayStem) && f.isAutumn,
  'S-TH-011': (f) => f.dayStem === '甲' && ['寅', '卯'].includes(f.monthBranch),
  'S-TH-012': (f) => f.dayStem === '乙' && f.isSummer,
  'S-TH-013': (f) => f.dayStem === '丙' && f.isAutumn,
  'S-TH-014': (f) => f.dayStem === '壬' && f.isWinter,
  'S-TH-015': (f) => f.dayStem === '戊' && f.isSummer,
  'S-TH-016': (f) => f.dayStem === '辛' && f.monthBranch === '酉',
  'S-TH-017': (f) => f.dayStem === '己' && f.monthBranch === '丑',
  'S-TH-018': (f) => f.dayStem === '戊' && f.monthBranch === '寅',
  'S-TH-019': (f) => f.dayStem === '庚' && f.monthBranch === '午',
  'S-TH-020': (f) => ['庚', '辛'].includes(f.dayStem) && (f.isAutumn || f.isWinter) && f.stems.some((s) => ['壬', '癸'].includes(s)),
  'S-TH-021': (f) => ['甲', '乙'].includes(f.dayStem) && f.stems.some((s) => ['丙', '丁'].includes(s)),
  'S-TH-022': (f) => f.dayStem === '癸' && f.monthBranch === '子',
  'S-TH-023': (f) => f.dayStem === '乙' && f.isAutumn,
  'S-TH-024': (f) => f.dayStem === '丙' && f.monthBranch === '子',
  'S-TH-025': (f) => f.dayStem === '丁' && f.isSpring,
  'S-TH-026': (f) => f.dayStem === '己' && f.monthBranch === '午',
  'S-TH-027': (f) => ['庚', '辛'].includes(f.dayStem) && f.isWinter,
  'S-TH-028': (f) => f.dayStem === '壬' && f.isSummer,
  'S-TH-029': (f) => f.dayStem === '戊' && f.monthBranch === '戌',
  'S-TH-030': (f) => true,

  // 旺衰扶抑派
  'S-WS-001': (f) => f.exposedTenGods.includes('七杀'),
  'S-WS-002': (f) => ['乙', '丁', '己', '辛', '癸'].includes(f.dayStem),
  'S-WS-003': (f) => f.chongPairs.length > 0,
  'S-WS-004': (f) => true,
  'S-WS-005': (f) => f.hasLu || f.hasYangRen,
  'S-WS-006': (f) => f.exposedTenGods.filter((t) => t.includes('印')).length >= 2,
  'S-WS-009': (f) => (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-WS-010': (f) => (f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-WS-011': (f) => ['庚', '辛'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_ELEMENT[b] === '土').length >= 2,
  'S-WS-012': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')),
  'S-WS-014': (f) => ['甲', '乙'].includes(f.dayStem) && f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀')),
  'S-WS-015': (f) => true,
  'S-WS-016': (f) => true,
  'S-WS-017': (f) => ['丙', '丁'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_ELEMENT[b] === '木').length >= 2,
  'S-WS-018': (f) => ['戊', '己'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_ELEMENT[b] === '水').length >= 2,
  'S-WS-019': (f) => ['丙', '丁'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_ELEMENT[b] === '金').length >= 2,
  'S-WS-020': (f) => true,
  'S-WS-027': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),
  'S-WS-028': (f) => f.exposedTenGods.some((t) => t.includes('印')) && f.exposedTenGods.some((t) => t.includes('财')),
  'S-WS-030': (f) => true,

  // 盲派与象法
  'S-MP-001': (f) => true,
  'S-MP-002': (f) => f.chuanPairs.length > 0,
  'S-MP-003': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)) && f.chongPairs.length > 0,
  'S-MP-004': (f) => true,
  'S-MP-005': (f) => f.hasLu && (f.luChong || f.luChuan),
  'S-MP-006': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')),
  'S-MP-008': (f) => f.chongPairs.length > 0,
  'S-MP-011': (f) => f.hasLu && f.luChuan,
  'S-MP-013': (f) => true,
  'S-MP-014': (f) => f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('七杀'),
  'S-MP-015': (f) => (f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-MP-016': (f) => (f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('偏财')) && (f.exposedTenGods.includes('伤官') || f.exposedTenGods.includes('食神')),
  'S-MP-017': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('伤官'),
  'S-MP-018': (f) => f.stems.some((s, idx) => tenGod(f.dayStem, s) === '正印' && tenGod(f.dayStem, f.stems[idx === 0 ? 1 : 0]) === '正官'),
  'S-MP-022': (f) => f.hasLu && f.luChuan,
  'S-MP-025': (f) => f.hasYangRen && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-MP-028': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)),
  'S-MP-029': (f) => f.shenshaList.includes('驿马') || f.chongPairs.some(([i, j]) => i === 3 || j === 3),
  'S-MP-030': (f) => f.chuanPairs.length > 0,

  // 古法三命
  'S-SM-001': (f) => true,
  'S-SM-002': (f) => true,
  'S-SM-007': (f) => f.hasTianYiHuHuan || f.shenshaList.includes('天乙贵人'),
  'S-SM-009': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SM-011': (f) => (f.stems.includes('乙') && f.stems.includes('丙') && f.stems.includes('丁'))
    || (f.stems.includes('甲') && f.stems.includes('戊') && f.stems.includes('庚'))
    || (f.stems.includes('辛') && f.stems.includes('壬') && f.stems.includes('癸')),
  'S-SM-012': (f) => ['壬午', '癸巳'].includes(f.dayGz) || ['壬午', '癸巳'].includes(f.yearGz),
  'S-SM-016': (f) => f.hasTianYiHuHuan,
  'S-SM-017': (f) => true,
  'S-SM-019': (f) => f.nayins.some((n) => n.includes('水')) && f.nayins.some((n) => n.includes('火')),
  'S-SM-021': (f) => f.chongPairs.some(([i, j]) => (i === 0 && j === 1) || (i === 2 && j === 3)),
  'S-SM-022': (f) => f.chongPairs.length > 0,
  'S-SM-024': (f) => true,
  'S-SM-028': (f) => f.chongPairs.some(([i, j]) => i === 2 || j === 2 || i === 3 || j === 3),
  'S-SM-030': (f) => f.shenshaList.includes('天乙贵人'),

  // 神煞派
  'S-SS-001': (f) => f.shenshaList.includes('天乙贵人') || (TIANYI_MAP[f.dayStem] || []).some((b) => f.branches.includes(b)),
  'S-SS-002': (f) => f.hasYangRen,
  'S-SS-003': (f) => f.shenshaList.includes('将星') || f.shenshaList.includes('华盖'),
  'S-SS-004': (f) => ['戊戌', '庚戌', '庚辰', '壬辰'].includes(f.dayGz),
  'S-SS-005': (f) => f.shenshaList.includes('亡神') || f.shenshaList.includes('劫煞'),
  'S-SS-006': (f) => f.shenshaList.includes('驿马') || f.chongPairs.length > 0,
  'S-SS-007': (f) => f.shenshaList.includes('文昌') || f.shenshaList.includes('学堂'),
  'S-SS-008': (f) => f.shenshaList.includes('桃花') || f.shenshaList.includes('咸池'),
  'S-SS-009': (f) => ['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸亥'].includes(f.dayGz),
  'S-SS-010': (f) => true,
  'S-SS-011': (f) => ['甲', '己'].includes(f.dayStem) && ['乙丑', '己巳', '癸酉'].includes(f.hourGz),
  'S-SS-012': (f) => f.shenshaList.includes('天德') || f.shenshaList.includes('月德'),
  'S-SS-013': (f) => f.shenshaList.includes('孤辰') || f.shenshaList.includes('寡宿'),
  'S-SS-014': (f) => ['甲子', '甲午', '己卯', '己酉'].includes(f.dayGz),
  'S-SS-015': (f) => f.hasYangRen && f.yangRenChong,
  'S-SS-016': (f) => ['甲戌', '乙亥', '丙丑', '丁寅', '戊丑', '己寅', '庚辰', '辛巳', '壬未', '癸申'].includes(f.dayGz),
  'S-SS-017': (f) => (['甲', '乙'].includes(f.dayStem) && f.branches.some((b) => ['子', '午'].includes(b)))
    || (['丙', '丁'].includes(f.dayStem) && f.branches.some((b) => ['卯', '酉'].includes(b))),
  'S-SS-019': (f) => ['丙午', '丁未', '戊子', '戊午', '己丑', '己未'].includes(f.dayGz),
  'S-SS-020': (f) => ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未'].includes(f.dayGz),
  'S-SS-022': (f) => ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'].includes(f.dayGz),
  'S-SS-023': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SS-026': (f) => f.hasLu && f.shenshaList.includes('驿马'),
  'S-SS-030': (f) => true,
};

/**
 * 核心对外匹配接口：输入盘面（四柱干支数组或排盘事实对象），输出命中的各派主张
 */
export function matchSchoolClaims(chartInput, options = {}) {
  const { map, list } = loadAllSchoolEntries();
  const features = extractChartFeatures(chartInput);

  const matched = [];
  const bySchool = {
    geju: [],
    tiaohou: [],
    wangshuai: [],
    mangpai: [],
    sanming: [],
    shensha: [],
  };

  for (const entry of list) {
    const fn = MATCH_PREDICATES[entry.id];
    let isHit = false;
    if (typeof fn === 'function') {
      try {
        isHit = fn(features);
      } catch {
        isHit = false;
      }
    }

    if (isHit) {
      const item = {
        id: entry.id,
        schoolName: entry.schoolName,
        claim: entry.claim,
        condition: entry.condition,
        source: entry.source,
        controversy: entry.controversy,
      };
      matched.push(item);
      if (bySchool[entry.schoolKey]) {
        bySchool[entry.schoolKey].push(item);
      }
    }
  }

  return {
    chart: features.chart,
    features,
    totalEntriesScanned: list.length,
    totalMatched: matched.length,
    matched,
    bySchool,
  };
}

/**
 * CLI 格式化输出
 */
export function formatSchoolMatches(result) {
  const lines = [];
  lines.push('======================================================================');
  lines.push(`八字各派主张并陈（丙层动态匹配引擎 · 扫描 ${result.totalEntriesScanned} 条标准条目）`);
  lines.push('======================================================================');
  lines.push(`命盘四柱：${result.features.gzList.join(' ')}  (日元：${result.features.dayStem}木/火/土/金/水)`);
  lines.push(`命中主张总计：${result.totalMatched} 条\n`);

  for (const s of SCHOOL_FILES) {
    const items = result.bySchool[s.key] || [];
    lines.push(`▶ 【${s.name}】 命中 ${items.length} 条：`);
    if (items.length === 0) {
      lines.push('   (本盘暂无该派强特征命中)');
    } else {
      for (const it of items) {
        lines.push(`   • [${it.id}] ${it.claim}`);
        lines.push(`     出处: ${it.source}`);
        if (it.controversy && it.controversy !== '—') {
          lines.push(`     分歧: ${it.controversy}`);
        }
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

// CLI 直跑支持
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const gzArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let gzInput = ['庚申', '戊寅', '甲申', '壬申'];
  if (gzArgs.length === 4) {
    gzInput = gzArgs;
  } else if (gzArgs.length === 1 && gzArgs[0].includes(' ')) {
    gzInput = gzArgs[0].trim().split(/\s+/);
  }
  const res = matchSchoolClaims(gzInput);
  console.log(formatSchoolMatches(res));
}
