// 丙层 · 六大主流学派主张动态匹配引擎
// 依据决策台账 D-026 裁定落地：直接以 流派/*.md 的 180 条标准条目为单源事实（SSOT），
// 扫描排盘事实对象，动态匹配并陈列命中之各学派主张、成立条件与古籍出处。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  castChart, hiddenStemsOf, tenGod, nayinOf, shenshaOf,
  gzRelations, elementStrength, HIDDEN_STEMS_SPEC, GANZHI,
} from './engine.mjs';
import {
  MATCH_PREDICATES,
  GEJU_PREDICATES,
  TIAOHOU_PREDICATES,
  WANGSHUAI_PREDICATES,
  MANGPAI_PREDICATES,
  SANMING_PREDICATES,
  SHENSHA_PREDICATES,
} from './matcher/index.mjs';

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
  戊: ['子', '丑'], 癸: ['子', '丑'],
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

// 长生与墓库映射
export const CHANGSHENG_MAP = {
  木: ['亥'], 火: ['寅'], 金: ['巳'], 水: ['申'], 土: ['寅', '申'],
};
export const MUKU_MAP = {
  木: ['未', '辰'], 火: ['戌', '未'], 金: ['丑', '戌'], 水: ['辰', '丑'], 土: ['辰', '戌', '丑', '未'],
};

/**
 * 安全纳音推导：支持两字干支字符串直接推导纳音全称（如「丁巳」⇒「沙中土」）
 */
export function safeNayin(gz) {
  if (!gz || typeof gz !== 'string' || gz.length < 2) return '';
  const idx = GANZHI.indexOf(gz);
  if (idx < 0) return '';
  return nayinOf(idx).name || '';
}

/**
 * 胎元推导算法：依《三命通会》《渊海子平》，月干顺推一位、月支顺推三位
 */
export function calculateTaiyuan(monthGz) {
  if (!monthGz || monthGz.length < 2) return null;
  const sIdx = STEMS.indexOf(monthGz[0]);
  const bIdx = BRANCHES.indexOf(monthGz[1]);
  if (sIdx < 0 || bIdx < 0) return null;
  const tyStemIdx = (sIdx + 1) % 10;
  const tyBranchIdx = (bIdx + 3) % 12;
  const gz = STEMS[tyStemIdx] + BRANCHES[tyBranchIdx];
  return {
    gz,
    stem: STEMS[tyStemIdx],
    branch: BRANCHES[tyBranchIdx],
    nayin: safeNayin(gz),
  };
}

/**
 * 命宫推导算法：依《命理探源》《三命通会》，卯上起正月顺数生月、生时加生月逆数至卯
 * 数学公式：命宫支 = (16 - 月建 - 时支序 + 24) % 12；年干五虎遁得命宫干
 */
export function calculateMinggong(yearGz, monthGz, hourGz) {
  if (!yearGz || !monthGz || !hourGz || yearGz.length < 2 || monthGz.length < 2 || hourGz.length < 2) {
    return null;
  }
  const yStemIdx = STEMS.indexOf(yearGz[0]);
  const mBranch = monthGz[1];
  const hBranch = hourGz[1];
  if (yStemIdx < 0 || !BRANCHES.includes(mBranch) || !BRANCHES.includes(hBranch)) return null;

  const mJian = (BRANCHES.indexOf(mBranch) - 2 + 12) % 12 + 1;
  const hIdx = BRANCHES.indexOf(hBranch);
  const mgBranchIdx = (16 - mJian - hIdx + 24) % 12;
  const yinStemIdx = ((yStemIdx % 5) * 2 + 2) % 10;
  const stepsFromYin = (mgBranchIdx - 2 + 12) % 12;
  const mgStemIdx = (yinStemIdx + stepsFromYin) % 10;
  const gz = STEMS[mgStemIdx] + BRANCHES[mgBranchIdx];
  return {
    gz,
    stem: STEMS[mgStemIdx],
    branch: BRANCHES[mgBranchIdx],
    nayin: safeNayin(gz),
  };
}

/**
 * 通根离散图谱推导：纯离散命理状态机（最高根阶、受力状态、清浊形态、位置明细）
 */
export function analyzeRoots(stems, branches, dayStem, chongPairs = [], chuanPairs = []) {
  const dayElem = STEM_TO_ELEMENT[dayStem] || '';
  const posNames = ['年柱', '月柱', '日柱', '时柱'];
  const byElement = {};

  for (const elem of ELEMENTS) {
    const rootDetails = [];
    let hasLu = false;
    let hasRen = false;
    let hasBenQi = false;
    let hasChangSheng = false;
    let hasMuKu = false;
    let isSelfRooted = false;
    let isMonthRooted = false;
    let isHourRooted = false;
    let isYearRooted = false;

    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      const bIdx = BRANCHES.indexOf(b);
      if (bIdx < 0) continue;
      const hidden = HIDDEN_STEMS_SPEC[bIdx] || [];
      for (const [hStem, hRole] of hidden) {
        const hElem = STEM_TO_ELEMENT[hStem];
        if (hElem === elem) {
          let tier = '墓库微根';
          if (hRole === '本') {
            hasBenQi = true;
            if (elem === dayElem && b === LU_MAP[dayStem]) hasLu = true;
            if (elem === dayElem && b === REN_MAP[dayStem]) hasRen = true;
            tier = '禄刃专气';
          } else if ((CHANGSHENG_MAP[elem] || []).includes(b)) {
            hasChangSheng = true;
            tier = '长生源头';
          } else {
            hasMuKu = true;
            tier = '墓库微根';
          }

          if (i === 2 && elem === dayElem) isSelfRooted = true;
          if (i === 1) isMonthRooted = true;
          if (i === 3) isHourRooted = true;
          if (i === 0) isYearRooted = true;

          const isChong = chongPairs.some(([ci, cj]) => ci === i || cj === i);
          const isChuan = chuanPairs.some(([ci, cj]) => ci === i || cj === i);
          const status = isChong ? '冲拔动摇' : (isChuan ? '刑穿受损' : '安稳');

          rootDetails.push({
            pillar: posNames[i] || '',
            branch: b,
            stem: hStem,
            role: hRole === '本' ? '本气' : (hRole === '中' ? '中气' : '余气'),
            tier,
            status,
          });
        }
      }
    }

    let highestTier = '虚浮无根';
    if (hasBenQi || hasLu || hasRen) highestTier = '禄刃专气';
    else if (hasChangSheng) highestTier = '长生源头';
    else if (hasMuKu || rootDetails.length > 0) highestTier = '墓库微根';

    let overallStatus = '无根';
    if (rootDetails.length > 0) {
      const allDamaged = rootDetails.every((r) => r.status !== '安稳');
      const anyChong = rootDetails.some((r) => r.status === '冲拔动摇');
      const anyChuan = rootDetails.some((r) => r.status === '刑穿受损');
      if (allDamaged && anyChong) overallStatus = '独根被拔';
      else if (anyChong) overallStatus = '冲拔动摇';
      else if (anyChuan) overallStatus = '刑穿受损';
      else overallStatus = '安稳';
    }

    let purity = '无根';
    if (rootDetails.length > 0) {
      const rootBranches = [...new Set(rootDetails.map((r) => r.branch))];
      const allSiZheng = rootBranches.every((b) => ['子', '卯', '酉'].includes(b));
      const allSiSheng = rootBranches.every((b) => ['寅', '巳', '申', '亥', '午'].includes(b));
      const anyMuKu = rootBranches.some((b) => ['辰', '戌', '丑', '未'].includes(b));
      const isExposed = stems.some((s) => STEM_TO_ELEMENT[s] === elem);

      if (allSiZheng) purity = '专气纯粹';
      else if (allSiSheng) purity = '生化清和';
      else if (anyMuKu && isExposed) purity = '杂气引清';
      else if (anyMuKu) purity = '墓库伏杂';
      else purity = '清和兼杂';
    }

    byElement[elem] = {
      highestTier,
      status: overallStatus,
      purity,
      isSelfRooted,
      isMonthRooted,
      isHourRooted,
      isYearRooted,
      count: rootDetails.length,
      details: rootDetails,
    };
  }

  return {
    dayMaster: byElement[dayElem] || {
      highestTier: '虚浮无根',
      status: '无根',
      purity: '无根',
      isSelfRooted: false,
      isMonthRooted: false,
      isHourRooted: false,
      isYearRooted: false,
      count: 0,
      details: [],
    },
    byElement,
  };
}

/**
 * 虚邀暗拱与暗夹推导：三合拱中神、相邻隔位暗夹（拱禄/拱贵/夹刃）、倒冲飞天禄马
 */
export function analyzeGongJia(gzList, dayStem, branches) {
  const gongChong = [];
  const jiaPairs = [];
  let hasGongLu = false;
  let hasGongGui = false;
  let hasJiaRen = false;

  const SANHE_GONG = [
    [['申', '辰'], '子', '水'],
    [['辰', '申'], '子', '水'],
    [['寅', '戌'], '午', '火'],
    [['戌', '寅'], '午', '火'],
    [['亥', '未'], '卯', '木'],
    [['未', '亥'], '卯', '木'],
    [['巳', '丑'], '酉', '金'],
    [['丑', '巳'], '酉', '金'],
  ];

  for (const [[b1, b2], mid, elem] of SANHE_GONG) {
    if (branches.includes(b1) && branches.includes(b2) && !branches.includes(mid)) {
      if (!gongChong.some((g) => g.mid === mid)) {
        gongChong.push({ pair: [b1, b2], mid, elem });
      }
    }
  }

  // 隔位暗夹 (相邻柱地支隔一位)
  for (let i = 0; i < branches.length - 1; i++) {
    const b1 = branches[i];
    const b2 = branches[i + 1];
    const idx1 = BRANCHES.indexOf(b1);
    const idx2 = BRANCHES.indexOf(b2);
    if (idx1 < 0 || idx2 < 0) continue;

    let clamped = '';
    if ((idx1 + 2) % 12 === idx2) {
      clamped = BRANCHES[(idx1 + 1) % 12];
    } else if ((idx2 + 2) % 12 === idx1) {
      clamped = BRANCHES[(idx2 + 1) % 12];
    }

    if (clamped && !branches.includes(clamped)) {
      const isLu = clamped === LU_MAP[dayStem];
      const isGui = (TIANYI_MAP[dayStem] || []).includes(clamped);
      const isRen = clamped === REN_MAP[dayStem];
      if (isLu) hasGongLu = true;
      if (isGui) hasGongGui = true;
      if (isRen) hasJiaRen = true;
      jiaPairs.push({ pair: [b1, b2], clamped, isLu, isGui, isRen });
    }
  }

  // 飞天禄马倒冲：庚子/壬子日支多见子水倒冲午，辛亥/癸亥日支多见亥水倒冲巳
  const dayGz = gzList[2] || '';
  const subBranches = branches;
  let hasFeiTianDaoChong = false;
  if (['庚子', '壬子'].includes(dayGz)) {
    const ziCount = subBranches.filter((b) => b === '子').length;
    if (ziCount >= 3 && !subBranches.includes('午')) hasFeiTianDaoChong = true;
  } else if (['辛亥', '癸亥'].includes(dayGz)) {
    const haiCount = subBranches.filter((b) => b === '亥').length;
    if (haiCount >= 3 && !subBranches.includes('巳')) hasFeiTianDaoChong = true;
  }

  return {
    gongChong,
    jiaPairs,
    hasGongLu,
    hasGongGui,
    hasJiaRen,
    hasFeiTianDaoChong,
  };
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
  const nayins = gzList.map((gz) => safeNayin(gz));
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

  // 6. 路径 A 高阶易学特征：胎元、命宫、通根离散图谱、虚邀暗夹与纳音物性
  const taiyuan = calculateTaiyuan(monthGz);
  const minggong = calculateMinggong(yearGz, monthGz, hourGz);
  const roots = analyzeRoots(stems, branches, dayStem, chongPairs, chuanPairs);
  const gongJia = analyzeGongJia(gzList, dayStem, branches);
  const nayinDetails = {
    yearNayin: nayins[0] || '',
    monthNayin: nayins[1] || '',
    dayNayin: nayins[2] || '',
    hourNayin: nayins[3] || '',
    taiyuanNayin: taiyuan?.nayin || '',
    minggongNayin: minggong?.nayin || '',
  };

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
    yearStem: stems[0],
    monthStem: stems[1],
    hourStem: stems[3],
    yearBranch: branches[0],
    dayBranch: branches[2],
    hourBranch: branches[3],
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
    nayinDetails,
    shenshaList,
    hasTianYiHuHuan,
    elemStrength,
    taiyuan,
    minggong,
    roots,
    gongJia,
    isWinter: ['亥', '子', '丑'].includes(monthBranch),
    isSummer: ['巳', '午', '未'].includes(monthBranch),
    isSpring: ['寅', '卯', '辰'].includes(monthBranch),
    isAutumn: ['申', '酉', '戌'].includes(monthBranch),
  };
}

/**
 * 丙层 · 六大学派学理排他特征匹配谓词集（解耦分拆至 matcher/ 独立子模块，D-070 落地）
 */
export {
  MATCH_PREDICATES,
  GEJU_PREDICATES,
  TIAOHOU_PREDICATES,
  WANGSHUAI_PREDICATES,
  MANGPAI_PREDICATES,
  SANMING_PREDICATES,
  SHENSHA_PREDICATES,
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
