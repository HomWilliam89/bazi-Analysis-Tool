// 丙层 · 六大主流学派主张动态匹配引擎
// 依据决策台账 D-026 裁定落地：直接以 流派/*.md 的 180 条标准条目为单源事实（SSOT），
// 扫描排盘事实对象，动态匹配并陈列命中之各学派主张、成立条件与古籍出处。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  castChart, hiddenStemsOf, tenGod, nayinOf, shenshaOf,
  gzRelations, elementStrength,
} from './engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 流派目录 = path.join(ROOT, '流派');

// 天干地支汉字至五行汉字之快速映射字典
export const STEM_TO_ELEMENT = Object.fromEntries(
  STEMS.map((s, i) => [s, ELEMENTS[STEM_ELEMENT[i]]])
);
export const BRANCH_TO_ELEMENT = Object.fromEntries(
  BRANCHES.map((b, i) => [b, ELEMENTS[BRANCH_ELEMENT[i]]])
);

// 五行生克关系基础映射
export const SHENG_ELEM = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const KE_ELEM = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 健壮的十神推导函数：支持天干字符或数字索引自适应解析（防范字符传参缺陷）
 */
export function safeTenGod(a, b) {
  const idxA = typeof a === 'number' ? a : STEMS.indexOf(a);
  const idxB = typeof b === 'number' ? b : STEMS.indexOf(b);
  if (idxA < 0 || idxA > 9 || idxB < 0 || idxB > 9) return '';
  return tenGod(idxA, idxB);
}

/**
 * 干支旬空推导：返回该干支所在旬轮空之两个地支
 */
export function getKongWang(gz) {
  if (!gz || gz.length < 2) return [];
  const sIdx = STEMS.indexOf(gz[0]);
  const bIdx = BRANCHES.indexOf(gz[1]);
  if (sIdx < 0 || bIdx < 0) return [];
  const xunShou = (bIdx - sIdx + 12) % 12;
  return [BRANCHES[(xunShou + 10) % 12], BRANCHES[(xunShou + 11) % 12]];
}

// 模块级特征映射常量表
export const TIANYI_MAP = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
  辛: ['午', '寅'],
};

export const LU_MAP = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

export const REN_MAP = {
  甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午',
  己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑',
};

export const CHUAN_DEFS = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'],
  ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];

export const CHONG_DEFS = [
  ['子', '午'], ['丑', '未'], ['寅', '申'],
  ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];

export const STEM_HE = [
  ['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸'],
];

export const BRANCH_HE = [
  ['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未'],
];

export const ZAISHA_MAP = {
  申: '午', 子: '午', 辰: '午',
  寅: '子', 午: '子', 戌: '子',
  巳: '卯', 酉: '卯', 丑: '卯',
  亥: '酉', 卯: '酉', 未: '酉',
};

export const YUANCHEN_MAP = {
  子: '未', 丑: '申', 寅: '酉', 卯: '戌',
  辰: '亥', 巳: '子', 午: '丑', 未: '寅',
  申: '卯', 酉: '辰', 戌: '巳', 亥: '午',
};

export const HONGLUAN_MAP = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子',
  辰: '亥', 巳: '戌', 午: '酉', 未: '申',
  申: '未', 酉: '午', 戌: '巳', 亥: '辰',
};

export const TIANXI_MAP = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午',
  辰: '巳', 巳: '辰', 午: '卯', 未: '寅',
  申: '丑', 酉: '子', 戌: '亥', 亥: '戌',
};

export const JIE_MAP = {
  甲: ['申', '酉'], 己: ['申', '酉'],
  乙: ['午', '未'], 庚: ['午', '未'],
  丙: ['辰', '巳'], 辛: ['辰', '巳'],
  丁: ['寅', '卯'], 壬: ['寅', '卯'],
  戊: ['戌', '亥', '子'], 癸: ['戌', '亥', '丑'],
};

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
        element: STEM_TO_ELEMENT[chartInput[2][0]] || '',
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
  const dayElement = STEM_TO_ELEMENT[dayStem] || '';
  const monthBranch = p[1]?.branch || chart.dayMaster?.bornMonthBranch || '';

  const stems = p.map((x) => x.stem);
  const branches = p.map((x) => x.branch);
  const gzList = [yearGz, monthGz, dayGz, hourGz];

  const dayStemIdx = STEMS.indexOf(dayStem);
  const monthBranchIdx = BRANCHES.indexOf(monthBranch);
  const yearStemIdx = STEMS.indexOf(stems[0]);

  // 1. 十神透干（年月时）
  const exposedTenGods = [
    safeTenGod(dayStemIdx, STEMS.indexOf(stems[0])),
    safeTenGod(dayStemIdx, STEMS.indexOf(stems[1])),
    safeTenGod(dayStemIdx, STEMS.indexOf(stems[3])),
  ].filter(Boolean);

  // 月令藏干与本气透干
  const monthHiddenList = (dayStemIdx >= 0 && monthBranchIdx >= 0)
    ? hiddenStemsOf(dayStemIdx, monthBranchIdx)
    : [];
  const mainEntry = monthHiddenList.find((h) => h.role === '本气') || monthHiddenList[0];
  const monthMainStem = mainEntry?.stem || '';
  const monthMainTenGod = mainEntry?.tenGod || safeTenGod(dayStem, monthMainStem);
  const monthMainStemExposed = stems.slice(0, 2).includes(monthMainStem) || stems[3] === monthMainStem;

  // 2. 地支相冲与相穿
  const chuanPairs = [];
  const chongPairs = [];

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
 * 声明式匹配规则定义（针对 180 条主张进行特征谓词匹配，100% 全量覆盖）
 */
export const MATCH_PREDICATES = {
  // 格局派（30 条全量闭环）
  'S-GJ-001': (f) => f.monthMainStemExposed,
  'S-GJ-002': (f) => f.exposedTenGods.includes('正官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-003': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-004': (f) => f.exposedTenGods.includes('食神') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-005': (f) => ['庚', '辛'].includes(f.dayStem) && f.isWinter && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀')),
  'S-GJ-006': (f) => (f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')) && f.exposedTenGods.includes('七杀'),
  'S-GJ-007': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-008': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-009': (f) => (f.branches[1] === f.luBranch || f.branches[1] === f.renBranch) && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正财')),
  'S-GJ-010': (f) => {
    const noYinBiExposed = !f.exposedTenGods.some((t) => t.includes('印') || t.includes('比') || t.includes('劫'));
    const hasGuanSha = f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官');
    const monthIsGuanSha = f.monthMainTenGod?.includes('官') || f.monthMainTenGod?.includes('杀');
    const branchHasSelf = f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    return noYinBiExposed && (hasGuanSha || monthIsGuanSha) && !branchHasSelf;
  },
  'S-GJ-011': (f) => f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === f.dayElement).length >= 3,
  'S-GJ-012': (f) => {
    const noYinBiExposed = !f.exposedTenGods.some((t) => t.includes('印') || t.includes('比') || t.includes('劫'));
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const monthIsCai = f.monthMainTenGod?.includes('财');
    const branchHasSelf = f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    return noYinBiExposed && (hasCai || monthIsCai) && !branchHasSelf && !f.hasLu && !f.hasYangRen;
  },
  'S-GJ-013': (f) => f.hasYangRen && (f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官')),
  'S-GJ-014': (f) => ['辰', '戌', '丑', '未'].includes(f.monthBranch),
  'S-GJ-015': (f) => {
    const allElems = new Set([...f.stems.map((s) => STEM_TO_ELEMENT[s]), ...f.branches.map((b) => BRANCH_TO_ELEMENT[b])]);
    if (allElems.size <= 2) {
      const arr = [...allElems];
      return arr.length === 2 && (SHENG_ELEM[arr[0]] === arr[1] || SHENG_ELEM[arr[1]] === arr[0]);
    }
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const entries = Object.entries(pcts).sort((a, b) => b[1] - a[1]);
    if (entries.length >= 2 && entries[0][1] + entries[1][1] >= 85) {
      return SHENG_ELEM[entries[0][0]] === entries[1][0] || SHENG_ELEM[entries[1][0]] === entries[0][0];
    }
    return false;
  },
  'S-GJ-016': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && f.exposedTenGods.includes('正官'),
  'S-GJ-017': (f) => {
    const monthIsYin = f.monthMainTenGod?.includes('印');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    return (monthIsYin || hasYin) && hasCai && !hasGuanSha;
  },
  'S-GJ-018': (f) => f.exposedTenGods.includes('偏印') && f.exposedTenGods.includes('食神'),
  'S-GJ-019': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const hasBiJie = f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财');
    return hasGuan && !hasSha && hasCai && hasBiJie;
  },
  'S-GJ-020': (f) => ['甲', '乙'].includes(f.dayStem) && f.isSummer && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('正官')),
  'S-GJ-021': (f) => (
    f.exposedTenGods.includes('七杀')
    && f.exposedTenGods.includes('食神')
    && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财'))
  ),
  'S-GJ-022': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-023': (f) => {
    const isLuJie = f.branches[1] === f.luBranch || f.branches[1] === f.renBranch || f.monthMainTenGod?.includes('比') || f.monthMainTenGod?.includes('劫');
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    return isLuJie && hasShiShang && hasCai && noYin;
  },
  'S-GJ-024': (f) => f.hasYangRen && f.yangRenChong,
  'S-GJ-025': (f) => f.branches[3] === f.luBranch,
  'S-GJ-026': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-027': (f) => (
    (f.exposedTenGods.includes('偏财') || (f.monthMainTenGod === '偏财' && f.exposedTenGods.includes('正财')))
    && (f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财'))
    && f.exposedTenGods.includes('正官')
  ),
  'S-GJ-028': (f) => safeTenGod(f.dayStem, f.stems[3]) === '七杀',
  'S-GJ-029': (f) => ['壬午', '癸巳', '甲午'].includes(f.dayGz),
  'S-GJ-030': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),

  // 调候派（30 条全量闭环）
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
  'S-TH-030': (f) => (
    (f.isWinter && (f.stems.includes('丙') || f.stems.includes('丁')) && f.branches.some((b) => ['巳', '午', '寅'].includes(b)))
    || (f.isSummer && (f.stems.includes('壬') || f.stems.includes('癸')) && f.branches.some((b) => ['亥', '子', '申', '辰'].includes(b)))
  ),

  // 旺衰扶抑派（30 条全量闭环）
  'S-WS-001': (f) => f.exposedTenGods.includes('七杀'),
  'S-WS-002': (f) => ['乙', '丁', '己', '辛', '癸'].includes(f.dayStem),
  'S-WS-003': (f) => f.chongPairs.length > 0,
  'S-WS-004': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length > 0) {
      return pcts.some((pct) => pct >= 50);
    }
    const branchElems = f.branches.map((b) => BRANCH_TO_ELEMENT[b]);
    const counts = {};
    for (const e of branchElems) counts[e] = (counts[e] || 0) + 1;
    return Object.values(counts).some((c) => c >= 3);
  },
  'S-WS-005': (f) => f.hasLu || f.hasYangRen,
  'S-WS-006': (f) => f.exposedTenGods.filter((t) => t.includes('印')).length >= 2,
  'S-WS-007': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const branchSelfCount = f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === f.dayElement).length;
    const isZhuanWang = selfPct >= 50 || branchSelfCount >= 3;
    const noGuanSha = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    return isZhuanWang && noGuanSha;
  },
  'S-WS-008': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const hasWeakSupport = f.exposedTenGods.some((t) => t.includes('比') || t.includes('印'))
      || f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    const branchSelfMainCount = f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === f.dayElement).length;
    return selfPct > 0 && selfPct <= 18 && hasWeakSupport && branchSelfMainCount <= 1 && !f.hasLu;
  },
  'S-WS-009': (f) => (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-WS-010': (f) => (f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-WS-011': (f) => ['庚', '辛'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === '土').length >= 2,
  'S-WS-012': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')),
  'S-WS-013': (f) => {
    const noSelfBranch = !f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    const yinCount = f.exposedTenGods.filter((t) => t.includes('印')).length;
    const yinBranches = f.branches.filter((b) => {
      const bElem = BRANCH_TO_ELEMENT[b];
      return SHENG_ELEM[bElem] === f.dayElement;
    }).length;
    return noSelfBranch && (yinCount >= 2 || (yinCount >= 1 && yinBranches >= 2));
  },
  'S-WS-014': (f) => ['甲', '乙'].includes(f.dayStem) && f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀')),
  'S-WS-015': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length > 0) {
      const maxPct = Math.max(...pcts);
      return maxPct <= 45 && f.chongPairs.length === 0;
    }
    return f.chongPairs.length === 0 && f.chuanPairs.length === 0;
  },
  'S-WS-016': (f) => {
    const monthElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const notLing = monthElem !== f.dayElement;
    const deDiOrDang = (f.hasLu || f.hasYangRen) || (f.stems.filter((s) => STEM_TO_ELEMENT[s] === f.dayElement).length >= 2);
    return notLing && deDiOrDang;
  },
  'S-WS-017': (f) => ['丙', '丁'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === '木').length >= 2,
  'S-WS-018': (f) => ['戊', '己'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === '水').length >= 2,
  'S-WS-019': (f) => ['丙', '丁'].includes(f.dayStem) && f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === '金').length >= 2,
  'S-WS-020': (f) => (
    (f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')))
    || (f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('正官') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')))
  ),
  'S-WS-021': (f) => {
    const sameStemCount = f.stems.filter((s) => STEM_TO_ELEMENT[s] === f.dayElement).length;
    const noRoot = !f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement) && !f.hasLu && !f.hasYangRen;
    return sameStemCount >= 2 && noRoot;
  },
  'S-WS-022': (f) => {
    const bSet = new Set(f.branches);
    const hasHui = [['寅', '卯', '辰'], ['巳', '午', '未'], ['申', '酉', '戌'], ['亥', '子', '丑']]
      .some((trio) => trio.every((b) => bSet.has(b)));
    const hasHe = [['申', '子', '辰'], ['巳', '酉', '丑'], ['寅', '午', '戌'], ['亥', '卯', '未']]
      .some((trio) => trio.every((b) => bSet.has(b)));
    const branchElemCounts = {};
    for (const b of f.branches) {
      const e = BRANCH_TO_ELEMENT[b];
      branchElemCounts[e] = (branchElemCounts[e] || 0) + 1;
    }
    const has3Same = Object.values(branchElemCounts).some((c) => c >= 3);
    return hasHui || hasHe || has3Same;
  },
  'S-WS-023': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const noMainBranch = !f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    return selfPct > 0 && selfPct <= 15 && noMainBranch;
  },
  'S-WS-024': (f) => {
    const JUE_MAP = {
      甲: '申', 乙: '酉', 丙: '亥', 丁: '子',
      戊: '亥', 己: '子', 庚: '寅', 辛: '卯',
      壬: '巳', 癸: '午',
    };
    const jueB = JUE_MAP[f.dayStem];
    const hasJueBranch = f.branches[1] === jueB || f.branches[2] === jueB;
    const hasYinExposed = f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印');
    return Boolean(hasJueBranch && hasYinExposed);
  },
  'S-WS-025': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length > 0) {
      const max = Math.max(...pcts);
      const min = Math.min(...pcts);
      return max >= 45 && min <= 8;
    }
    return f.chongPairs.length >= 2;
  },
  'S-WS-026': (f) => {
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    const notStrong = !f.hasLu && !f.hasYangRen;
    return hasShiShang && noYin && notStrong;
  },
  'S-WS-027': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),
  'S-WS-028': (f) => f.exposedTenGods.some((t) => t.includes('印')) && f.exposedTenGods.some((t) => t.includes('财')),
  'S-WS-029': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀');
    const noZhiHua = !f.exposedTenGods.includes('食神') && !f.exposedTenGods.some((t) => t.includes('印'));
    const weak = !f.hasLu && !f.hasYangRen;
    return hasSha && noZhiHua && weak;
  },
  'S-WS-030': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length > 0) {
      const maxPct = Math.max(...pcts);
      const zeros = pcts.filter((p) => p === 0).length;
      return maxPct >= 50 || zeros >= 2 || f.chongPairs.length >= 2;
    }
    return f.chongPairs.length >= 2;
  },

  // 盲派与象法（30 条全量闭环）
  'S-MP-001': (f) => f.chongPairs.some(([i, j]) => (i < 2 && j >= 2) || (i >= 2 && j < 2))
    || f.chuanPairs.some(([i, j]) => (i < 2 && j >= 2) || (i >= 2 && j < 2)),
  'S-MP-002': (f) => f.chuanPairs.length > 0,
  'S-MP-003': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)) && f.chongPairs.length > 0,
  'S-MP-004': (f) => {
    const branchElems = f.branches.map((b) => BRANCH_TO_ELEMENT[b]);
    return f.stems.some((s, idx) => idx !== 2 && !branchElems.includes(STEM_TO_ELEMENT[s]));
  },
  'S-MP-005': (f) => f.hasLu && (f.luChong || f.luChuan),
  'S-MP-006': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')),
  'S-MP-007': (f) => f.hasLu && f.stems.includes(f.dayStem),
  'S-MP-008': (f) => f.chongPairs.length > 0,
  'S-MP-009': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const muHuo = (pcts['木'] || 0) + (pcts['火'] || 0);
    const jinShui = (pcts['金'] || 0) + (pcts['水'] || 0);
    return muHuo >= 65 || jinShui >= 65;
  },
  'S-MP-010': (f) => {
    const kuBranches = f.branches.filter((b) => ['辰', '戌', '丑', '未'].includes(b));
    const kuChong = f.chongPairs.some(([, , b1, b2]) => ['辰', '戌', '丑', '未'].includes(b1) && ['辰', '戌', '丑', '未'].includes(b2));
    return kuBranches.length >= 2 && !kuChong;
  },
  'S-MP-011': (f) => f.hasLu && f.luChuan,
  'S-MP-012': (f) => f.chongPairs.length > 0 && f.chuanPairs.length > 0,
  'S-MP-013': (f) => f.chuanPairs.some(([i, j]) => (i < 2 && j >= 2) || (i >= 2 && j < 2)),
  'S-MP-014': (f) => f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('七杀'),
  'S-MP-015': (f) => (f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-MP-016': (f) => (f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('偏财')) && (f.exposedTenGods.includes('伤官') || f.exposedTenGods.includes('食神')),
  'S-MP-017': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('伤官'),
  'S-MP-018': (f) => f.stems.some((s, idx) => safeTenGod(f.dayStem, s) === '正印' && safeTenGod(f.dayStem, f.stems[idx === 0 ? 1 : 0]) === '正官'),
  'S-MP-019': (f) => {
    return [2, 3].some((idx) => {
      const sTen = safeTenGod(f.dayStem, f.stems[idx]);
      const bElem = BRANCH_TO_ELEMENT[f.branches[idx]];
      const isGuanStem = sTen === '正官' || sTen === '七杀';
      const isCaiBranch = KE_ELEM[f.dayElement] === bElem;
      const isCaiStem = sTen === '正财' || sTen === '偏财';
      const isGuanBranch = KE_ELEM[bElem] === f.dayElement;
      return (isGuanStem && isCaiBranch) || (isCaiStem && isGuanBranch);
    });
  },
  'S-MP-020': (f) => {
    const bElems = f.branches.map((b) => BRANCH_TO_ELEMENT[b]);
    const xuTou = f.stems.some((s, idx) => idx !== 2 && !bElems.includes(STEM_TO_ELEMENT[s]));
    const zuoShi = f.stems.some((s, idx) => idx !== 2 && bElems.includes(STEM_TO_ELEMENT[s]));
    return xuTou && zuoShi;
  },
  'S-MP-021': (f) => {
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const sEl = STEM_TO_ELEMENT[f.stems[i]];
      const bEl = BRANCH_TO_ELEMENT[f.branches[i]];
      if (KE_ELEM[sEl] === bEl || KE_ELEM[bEl] === sEl) count++;
    }
    return count >= 2;
  },
  'S-MP-022': (f) => f.hasLu && f.luChuan,
  'S-MP-023': (f) => {
    const hasStemHe = [[0, 1], [1, 2], [2, 3]].some(([i, j]) => {
      const s1 = f.stems[i];
      const s2 = f.stems[j];
      return STEM_HE.some(([a, b]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
    });
    const hasBranchHe = [[0, 1], [1, 2], [2, 3]].some(([i, j]) => {
      const b1 = f.branches[i];
      const b2 = f.branches[j];
      return BRANCH_HE.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
    });
    return hasStemHe || hasBranchHe;
  },
  'S-MP-024': (f) => {
    if (!['甲', '乙'].includes(f.dayStem)) return false;
    const hasWater = f.branches.some((b) => ['亥', '子', '辰', '丑'].includes(b)) || f.stems.some((s) => ['壬', '癸'].includes(s));
    const hasWoodRoot = f.branches.some((b) => ['寅', '卯', '辰', '未'].includes(b));
    return (hasWater && hasWoodRoot) || (!hasWater && !hasWoodRoot);
  },
  'S-MP-025': (f) => f.hasYangRen && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-MP-026': (f) => (
    f.chongPairs.some(([i, j]) => i === 2 || j === 2)
    || f.chuanPairs.some(([i, j]) => i === 2 || j === 2)
  ),
  'S-MP-027': (f) => {
    const dayStemHe = [1, 3].some((idx) => {
      const s = f.stems[idx];
      return STEM_HE.some(([a, b]) => (f.dayStem === a && s === b) || (f.dayStem === b && s === a));
    });
    const dayBranchHe = [1, 3].some((idx) => {
      const b = f.branches[idx];
      return BRANCH_HE.some(([x, y]) => (f.branches[2] === x && b === y) || (f.branches[2] === y && b === x));
    });
    return dayStemHe || dayBranchHe;
  },
  'S-MP-028': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)),
  'S-MP-029': (f) => f.shenshaList.includes('驿马') || f.chongPairs.some(([i, j]) => i === 3 || j === 3),
  'S-MP-030': (f) => f.chuanPairs.length > 0,

  // 古法三命（30 条全量闭环）
  'S-SM-001': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearNayinEl = f.nayins[0]?.slice(-1);
    const dayNayinEl = f.nayins[2]?.slice(-1);
    return Boolean(yearNayinEl && dayNayinEl && yearNayinEl !== dayNayinEl);
  },
  'S-SM-002': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearEl = f.nayins[0]?.slice(-1);
    const dayEl = f.nayins[2]?.slice(-1);
    const sheng = SHENG_ELEM[yearEl] === dayEl || SHENG_ELEM[dayEl] === yearEl;
    return sheng && f.hasLu;
  },
  'S-SM-003': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    return (yEl === '水' && f.branches.some((b) => ['申', '子', '辰', '亥'].includes(b)))
      || (yEl === '火' && f.branches.some((b) => ['寅', '午', '戌', '巳'].includes(b)))
      || (yEl === '木' && f.branches.some((b) => ['亥', '卯', '未', '寅'].includes(b)))
      || (yEl === '金' && f.branches.some((b) => ['巳', '酉', '丑', '申'].includes(b)));
  },
  'S-SM-004': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const others = f.nayins.slice(1).map((n) => n?.slice(-1));
    return others.some((e) => SHENG_ELEM[e] === yEl);
  },
  'S-SM-005': (f) => {
    const hasXiao = f.exposedTenGods.includes('偏印');
    const hasShi = f.exposedTenGods.includes('食神');
    if (!hasXiao || !hasShi || !f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    return SHENG_ELEM[yEl] === dEl || SHENG_ELEM[dEl] === yEl;
  },
  'S-SM-006': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yN = f.nayins[0] || '';
    const dN = f.nayins[2] || '';
    return yN.slice(-1) === dN.slice(-1) || yN === dN;
  },
  'S-SM-007': (f) => f.hasTianYiHuHuan || f.shenshaList.includes('天乙贵人'),
  'S-SM-008': (f) => {
    if (!f.dayGz || !f.nayins) return false;
    const sIdx = STEMS.indexOf(f.dayGz[0]);
    const bIdx = BRANCHES.indexOf(f.dayGz[1]);
    if (sIdx < 0 || bIdx < 0) return false;
    const xunShouBranch = (bIdx - sIdx + 12) % 12;
    if (xunShouBranch === 0 || xunShouBranch === 6) {
      return f.nayins.some((n) => n?.endsWith('水'));
    }
    if (xunShouBranch === 2 || xunShouBranch === 8) {
      return f.nayins.some((n) => n?.endsWith('金'));
    }
    return false;
  },
  'S-SM-009': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SM-010': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mEl = f.nayins[1]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const hEl = f.nayins[3]?.slice(-1);
    const monthKe = KE_ELEM[mEl] === yEl;
    const timeSheng = SHENG_ELEM[dEl] === yEl || SHENG_ELEM[hEl] === yEl;
    return monthKe && timeSheng;
  },
  'S-SM-011': (f) => (f.stems.includes('乙') && f.stems.includes('丙') && f.stems.includes('丁'))
    || (f.stems.includes('甲') && f.stems.includes('戊') && f.stems.includes('庚'))
    || (f.stems.includes('辛') && f.stems.includes('壬') && f.stems.includes('癸')),
  'S-SM-012': (f) => ['壬午', '癸巳'].includes(f.dayGz) || ['壬午', '癸巳'].includes(f.yearGz),
  'S-SM-013': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const WANG_BRANCHES = {
      水: ['申', '子', '亥'], 木: ['亥', '卯', '寅'],
      火: ['寅', '午', '巳'], 金: ['巳', '酉', '申'], 土: ['辰', '戌', '丑', '未', '巳', '午'],
    };
    const wb = WANG_BRANCHES[yEl] || [];
    return wb.includes(f.branches[1]) || wb.includes(f.branches[3]);
  },
  'S-SM-014': (f) => {
    const GONG_PAIRS = [
      ['癸亥', '癸丑'], ['癸丑', '癸亥'],
      ['丁巳', '丁未'], ['丁未', '丁巳'],
      ['己巳', '己未'], ['己未', '己巳'],
      ['戊辰', '戊午'], ['戊午', '戊辰'],
    ];
    const hasGongLu = GONG_PAIRS.some(([d, h]) => f.dayGz === d && f.hourGz === h);
    const diff = Math.abs(BRANCHES.indexOf(f.branches[2]) - BRANCHES.indexOf(f.branches[3]));
    return hasGongLu || diff === 2;
  },
  'S-SM-015': (f) => {
    const noGuanSha = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const branchCounts = {};
    for (const b of f.branches) branchCounts[b] = (branchCounts[b] || 0) + 1;
    const hasMulti = Object.values(branchCounts).some((c) => c >= 2);
    return noGuanSha && hasMulti;
  },
  'S-SM-016': (f) => f.hasTianYiHuHuan,
  'S-SM-017': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearEl = f.nayins[0]?.slice(-1);
    const dayEl = f.nayins[2]?.slice(-1);
    return KE_ELEM[yearEl] === dayEl || KE_ELEM[dayEl] === yearEl;
  },
  'S-SM-018': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const set = new Set(f.nayins.map((n) => n?.slice(-1)));
    return set.size >= 3;
  },
  'S-SM-019': (f) => f.nayins.some((n) => n.includes('水')) && f.nayins.some((n) => n.includes('火')),
  'S-SM-020': (f) => {
    const isShuiMing = f.nayins && f.nayins[0]?.endsWith('水');
    return Boolean(isShuiMing && (f.branches[2] === '亥' || f.branches[3] === '亥'));
  },
  'S-SM-021': (f) => f.chongPairs.some(([i, j]) => (i === 0 && j === 1) || (i === 2 && j === 3)),
  'S-SM-022': (f) => f.chongPairs.length > 0,
  'S-SM-023': (f) => f.chongPairs.some(([i, j]) => i === 0) || f.branches.slice(1).includes(f.branches[0]),
  'S-SM-024': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const [y, m, d, h] = f.nayins.map((n) => n?.slice(-1));
    return (SHENG_ELEM[y] === m && SHENG_ELEM[m] === d) || (SHENG_ELEM[m] === d && SHENG_ELEM[d] === h);
  },
  'S-SM-025': (f) => {
    const isQuanZhongShui = ['甲申', '乙酉'].includes(f.yearGz);
    const hasTu = f.stems.includes('戊') || f.stems.includes('己') || f.branches.includes('戌') || f.branches.includes('未');
    const hasJin = f.stems.some((s) => ['庚', '辛'].includes(s)) || f.branches.some((b) => ['申', '酉'].includes(b));
    return isQuanZhongShui && !hasTu && hasJin;
  },
  'S-SM-026': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mEl = f.nayins[1]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const hEl = f.nayins[3]?.slice(-1);
    const isKe = KE_ELEM[mEl] === yEl;
    const isSheng = SHENG_ELEM[dEl] === yEl || SHENG_ELEM[hEl] === yEl;
    return isKe && (isSheng || f.hasTianYiHuHuan || f.shenshaList.includes('天乙贵人'));
  },
  'S-SM-027': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const hasGuan = f.exposedTenGods.includes('正官');
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const nayinKe = KE_ELEM[dEl] === yEl;
    return hasGuan && nayinKe;
  },
  'S-SM-028': (f) => f.chongPairs.some(([i, j]) => i === 2 || j === 2 || i === 3 || j === 3),
  'S-SM-029': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    return KE_ELEM[dEl] === yEl || KE_ELEM[yEl] === dEl;
  },
  'S-SM-030': (f) => f.shenshaList.includes('天乙贵人'),

  // 神煞派（30 条全量闭环）
  'S-SS-001': (f) => f.shenshaList.includes('天乙贵人') || (TIANYI_MAP[f.dayStem] || []).some((b) => f.branches.includes(b)),
  'S-SS-002': (f) => f.hasYangRen,
  'S-SS-003': (f) => f.shenshaList.includes('将星') || f.shenshaList.includes('华盖'),
  'S-SS-004': (f) => ['戊戌', '庚戌', '庚辰', '壬辰'].includes(f.dayGz),
  'S-SS-005': (f) => f.shenshaList.includes('亡神') || f.shenshaList.includes('劫煞'),
  'S-SS-006': (f) => f.shenshaList.includes('驿马') || f.chongPairs.length > 0,
  'S-SS-007': (f) => f.shenshaList.includes('文昌') || f.shenshaList.includes('学堂'),
  'S-SS-008': (f) => f.shenshaList.includes('桃花') || f.shenshaList.includes('咸池'),
  'S-SS-009': (f) => ['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸亥'].includes(f.dayGz),
  'S-SS-010': (f) => {
    const kw = getKongWang(f.dayGz);
    return [f.branches[0], f.branches[1], f.branches[3]].some((b) => kw.includes(b));
  },
  'S-SS-011': (f) => ['甲', '己'].includes(f.dayStem) && ['乙丑', '己巳', '癸酉'].includes(f.hourGz),
  'S-SS-012': (f) => f.shenshaList.includes('天德') || f.shenshaList.includes('月德'),
  'S-SS-013': (f) => f.shenshaList.includes('孤辰') || f.shenshaList.includes('寡宿'),
  'S-SS-014': (f) => ['甲子', '甲午', '己卯', '己酉'].includes(f.dayGz),
  'S-SS-015': (f) => f.hasYangRen && f.yangRenChong,
  'S-SS-016': (f) => ['甲戌', '乙亥', '丙丑', '丁寅', '戊丑', '己寅', '庚辰', '辛巳', '壬未', '癸申'].includes(f.dayGz),
  'S-SS-017': (f) => (['甲', '乙'].includes(f.dayStem) && f.branches.some((b) => ['子', '午'].includes(b)))
    || (['丙', '丁'].includes(f.dayStem) && f.branches.some((b) => ['卯', '酉'].includes(b))),
  'S-SS-018': (f) => {
    const mB = f.monthBranch;
    if (['寅', '午', '戌'].includes(mB)) return f.stems.some((s) => ['丙', '丁', '戊', '癸'].includes(s));
    if (['申', '子', '辰'].includes(mB)) return f.stems.some((s) => ['壬', '癸', '丙', '辛'].includes(s));
    if (['巳', '酉', '丑'].includes(mB)) return f.stems.some((s) => ['庚', '辛', '乙'].includes(s));
    if (['亥', '卯', '未'].includes(mB)) return f.stems.some((s) => ['甲', '乙', '丁', '壬'].includes(s));
    return false;
  },
  'S-SS-019': (f) => ['丙午', '丁未', '戊子', '戊午', '己丑', '己未'].includes(f.dayGz),
  'S-SS-020': (f) => ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未'].includes(f.dayGz),
  'S-SS-021': (f) => {
    const target = YUANCHEN_MAP[f.branches[0]];
    return Boolean(target && f.branches.slice(1).includes(target));
  },
  'S-SS-022': (f) => ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'].includes(f.dayGz),
  'S-SS-023': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SS-024': (f) => {
    const yIdx = BRANCHES.indexOf(f.branches[0]);
    if (yIdx < 0) return false;
    const target1 = BRANCHES[(yIdx + 3) % 12];
    const target2 = BRANCHES[(yIdx + 9) % 12];
    return f.branches.slice(1).some((b) => b === target1 || b === target2);
  },
  'S-SS-025': (f) => {
    const target = ZAISHA_MAP[f.branches[0]];
    return Boolean(target && f.branches.includes(target));
  },
  'S-SS-026': (f) => f.hasLu && f.shenshaList.includes('驿马'),
  'S-SS-027': (f) => {
    const yB = f.branches[0];
    const hl = HONGLUAN_MAP[yB];
    const tx = TIANXI_MAP[yB];
    return f.branches.slice(1).some((b) => b === hl || b === tx);
  },
  'S-SS-028': (f) => {
    const targets = JIE_MAP[f.dayStem] || [];
    return targets.includes(f.branches[3]);
  },
  'S-SS-029': (f) => {
    const XUAN_ZHEN = ['甲', '辛', '卯', '午', '申'];
    const count = [...f.stems, ...f.branches].filter((char) => XUAN_ZHEN.includes(char)).length;
    return count >= 3;
  },
  'S-SS-030': (f) => {
    if (!Array.isArray(f.shenshaList) || f.shenshaList.length === 0) return false;
    const monthElem = BRANCH_TO_ELEMENT[f.monthBranch];
    return f.shenshaList.some((s) => ['天乙贵人', '将星', '文昌贵人', '禄神'].includes(s))
      && (f.hasLu || f.hasYangRen || f.branches.some((b) => BRANCH_TO_ELEMENT[b] === monthElem));
  },
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
  lines.push(`命盘四柱：${result.features.gzList.join(' ')}  (日元：${result.features.dayStem}${result.features.dayElement})`);
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
