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
 * 声明式匹配规则定义（针对 210 条主张进行特征谓词匹配，100% 全量覆盖）
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

  // 子平外格群（批次 A：30 条外格全量落地）
  'S-GJ-031': (f) => {
    // 飞天禄马格：庚子/壬子冲午，辛亥/癸亥冲巳
    const isZiDay = ['庚子', '壬子'].includes(f.dayGz);
    const isHaiDay = ['辛亥', '癸亥'].includes(f.dayGz);
    if (!isZiDay && !isHaiDay) return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    if (!noGuanExposed) return false;
    if (isZiDay) {
      const ziCount = f.branches.filter((b) => b === '子').length;
      return ziCount >= 3 && !f.branches.includes('午') && !f.branches.includes('丑');
    }
    const haiCount = f.branches.filter((b) => b === '亥').length;
    return haiCount >= 3 && !f.branches.includes('巳') && !f.branches.includes('寅');
  },
  'S-GJ-032': (f) => {
    // 倒冲禄马格：丙午冲子，丁巳冲亥
    const isBingWu = f.dayGz === '丙午';
    const isDingSi = f.dayGz === '丁巳';
    if (!isBingWu && !isDingSi) return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    if (!noGuanExposed) return false;
    if (isBingWu) {
      const wuCount = f.branches.filter((b) => b === '午').length;
      return wuCount >= 3 && !f.branches.includes('子') && !f.branches.includes('未');
    }
    const siCount = f.branches.filter((b) => b === '巳').length;
    return siCount >= 3 && !f.branches.includes('亥') && !f.branches.includes('申');
  },
  'S-GJ-033': (f) => {
    // 井栏叉格：庚日申子辰全
    if (f.dayStem !== '庚' || !['庚申', '庚子', '庚辰'].includes(f.dayGz)) return false;
    const hasShenZiChen = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const noFireExposed = !f.stems.some((s) => ['丙', '丁'].includes(s));
    const noFireBranch = !f.branches.some((b) => ['巳', '午'].includes(b));
    return hasShenZiChen && noFireExposed && noFireBranch;
  },
  'S-GJ-034': (f) => {
    // 壬骑龙背格：壬辰日辰多
    if (f.dayGz !== '壬辰') return false;
    const chenCount = f.branches.filter((b) => b === '辰').length;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const notDingHe = !f.stems.includes('丁');
    return chenCount >= 2 && noGuanExposed && notDingHe;
  },
  'S-GJ-035': (f) => {
    // 六乙鼠贵格：乙日丙子时
    if (f.dayStem !== '乙' || f.hourGz !== '丙子') return false;
    const noMetalExposed = !f.stems.some((s) => ['庚', '辛'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    return noMetalExposed && noWuChong && noChouBan;
  },
  'S-GJ-036': (f) => {
    // 六阴朝阳格：六辛日戊子时，只宜子字一位
    if (f.dayStem !== '辛' || f.hourGz !== '戊子') return false;
    const ziCount = f.branches.filter((b) => b === '子').length;
    const noFireExposed = !f.stems.some((s) => ['丙', '丁'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    const noSiTian = !f.branches.includes('巳');
    return ziCount === 1 && noFireExposed && noWuChong && noChouBan && noSiTian;
  },
  'S-GJ-037': (f) => {
    // 拱禄格：日时同干虚拱禄位，忌填实
    const dGz = f.dayGz;
    const hGz = f.hourGz;
    if (f.dayStem !== f.hourStem) return false;
    if ((dGz === '癸亥' && hGz === '癸丑') || (dGz === '癸丑' && hGz === '癸亥')) {
      return !f.branches.includes('子');
    }
    if ((dGz === '丁巳' && hGz === '丁未') || (dGz === '丁未' && hGz === '丁巳')) {
      return !f.branches.includes('午');
    }
    if ((dGz === '己未' && hGz === '己巳') || (dGz === '己巳' && hGz === '己未')) {
      return !f.branches.includes('午');
    }
    if ((dGz === '戊辰' && hGz === '戊午') || (dGz === '戊午' && hGz === '戊辰')) {
      return !f.branches.includes('巳');
    }
    return false;
  },
  'S-GJ-038': (f) => {
    // 拱贵格：日时同干虚拱贵人，忌填实
    if (f.dayStem !== f.hourStem) return false;
    return f.gongJia?.clamps?.some((c) => c.type === '拱贵' && !c.isFilled) || false;
  },
  'S-GJ-039': (f) => {
    // 子遥巳禄格：甲子日甲子时
    if (f.dayGz !== '甲子' || f.hourGz !== '甲子') return false;
    const noGuanShaExposed = !f.stems.some((s) => ['庚', '辛'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    const noSiTian = !f.branches.includes('巳');
    return noGuanShaExposed && noWuChong && noChouBan && noSiTian;
  },
  'S-GJ-040': (f) => {
    // 丑遥巳禄格：辛丑/癸丑日丑多
    if (!['辛丑', '癸丑'].includes(f.dayGz)) return false;
    const chouCount = f.branches.filter((b) => b === '丑').length;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const noSiTian = !f.branches.includes('巳');
    const noWeiChong = !f.branches.includes('未');
    return chouCount >= 2 && noGuanExposed && noSiTian && noWeiChong;
  },
  'S-GJ-041': (f) => {
    // 刑合格：癸日甲寅时
    if (!['癸亥', '癸卯', '癸酉'].includes(f.dayGz) || f.hourGz !== '甲寅') return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const noGengShen = !f.stems.includes('庚') && !f.branches.includes('申');
    const noSiTian = !f.branches.includes('巳');
    return noGuanExposed && noGengShen && noSiTian;
  },
  'S-GJ-042': (f) => {
    // 合禄格：戊日庚申时
    if (f.dayStem !== '戊' || f.hourGz !== '庚申') return false;
    const noJiaBing = !f.stems.includes('甲') && !f.stems.includes('丙');
    const noYinChong = !f.branches.includes('寅');
    const noSiTian = !f.branches.includes('巳');
    return noJiaBing && noYinChong && noSiTian;
  },
  'S-GJ-043': (f) => {
    // 六甲趋乾格：甲日亥多
    if (f.dayStem !== '甲') return false;
    const haiCount = f.branches.filter((b) => b === '亥').length;
    const noSiChong = !f.branches.includes('巳');
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    return haiCount >= 2 && noSiChong && noGuanShaExposed;
  },
  'S-GJ-044': (f) => {
    // 六壬趋艮格：壬日寅多
    if (f.dayStem !== '壬') return false;
    const yinCount = f.branches.filter((b) => b === '寅').length;
    const noShenChong = !f.branches.includes('申');
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const notHaiMonth = f.monthBranch !== '亥';
    return yinCount >= 2 && noShenChong && noGuanShaExposed && notHaiMonth;
  },
  'S-GJ-045': (f) => {
    // 勾陈得位格：戊己日坐财官之局
    if (!['戊', '己'].includes(f.dayStem)) return false;
    const hasWoodJu = f.branches.includes('亥') && f.branches.includes('卯') && f.branches.includes('未');
    const hasWaterJu = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const sitsCaiGuan = ['戊寅', '戊子', '戊申', '己卯', '己亥', '己未'].includes(f.dayGz);
    const hasRoot = f.roots?.highestTier && f.roots.highestTier !== '虚浮无根';
    return (hasWoodJu || hasWaterJu || sitsCaiGuan) && hasRoot;
  },
  'S-GJ-046': (f) => {
    // 玄武当权格：壬癸日坐火土财官之局
    if (!['壬', '癸'].includes(f.dayStem)) return false;
    const hasFireJu = f.branches.includes('寅') && f.branches.includes('午') && f.branches.includes('戌');
    const sitsFireEarth = ['壬午', '壬戌', '壬辰', '癸巳', '癸未', '癸丑'].includes(f.dayGz);
    const hasRoot = f.roots?.highestTier && f.roots.highestTier !== '虚浮无根';
    return (hasFireJu || sitsFireEarth) && hasRoot;
  },
  'S-GJ-047': (f) => {
    // 福德秀气格：乙日巳酉丑金局
    if (f.dayStem !== '乙') return false;
    const isDayValid = ['乙巳', '乙酉', '乙丑'].includes(f.dayGz);
    const hasMetalJu = f.branches.includes('巳') && f.branches.includes('酉') && f.branches.includes('丑');
    const isYueYou = f.monthBranch === '酉';
    return isDayValid && (hasMetalJu || isYueYou);
  },
  'S-GJ-048': (f) => {
    // 魁罡格：戊戌、庚戌、庚辰、壬辰四日
    if (!['戊戌', '庚戌', '庚辰', '壬辰'].includes(f.dayGz)) return false;
    const hasRoot = f.roots?.isSelfRooted || f.roots?.isMonthRooted || (f.roots?.branchCounts >= 2);
    const noZhengGuan = !f.exposedTenGods.includes('正官');
    return hasRoot && noZhengGuan;
  },
  'S-GJ-049': (f) => {
    // 金神格：乙丑、己巳、癸酉时
    if (!['乙丑', '己巳', '癸酉'].includes(f.hourGz)) return false;
    if (!['甲', '己', '乙'].includes(f.dayStem)) return false;
    const hasFire = f.stems.some((s) => ['丙', '丁'].includes(s)) || f.branches.some((b) => ['巳', '午', '寅'].includes(b));
    return hasFire;
  },
  'S-GJ-050': (f) => {
    // 日贵格：丁酉、丁亥、癸巳、癸卯自坐天乙
    if (!['丁酉', '丁亥', '癸巳', '癸卯'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChongOrChuan = (f.chongPairs || []).some((p) => p.includes(dayBranch)) || (f.chuanPairs || []).some((p) => p.includes(dayBranch));
    return !isChongOrChuan;
  },
  'S-GJ-051': (f) => {
    // 日德格：甲寅、丙辰、戊辰、庚辰、壬戌五日
    if (!['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChongOrChuan = (f.chongPairs || []).some((p) => p.includes(dayBranch)) || (f.chuanPairs || []).some((p) => p.includes(dayBranch));
    return !isChongOrChuan;
  },
  'S-GJ-052': (f) => {
    // 日禄归时格：时支见日禄无官杀
    if (f.branches[3] !== f.luBranch) return false;
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const hourNotChong = !(f.chongPairs || []).some((p) => p.includes(f.branches[3]));
    return noGuanShaExposed && hourNotChong;
  },
  'S-GJ-053': (f) => {
    // 禄马同乡格：壬午、癸巳自坐财官
    if (!['壬午', '癸巳'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChong = (f.chongPairs || []).some((p) => p.includes(dayBranch));
    return !isChong;
  },
  'S-GJ-054': (f) => {
    // 天元一气格：四干完全相同
    return f.stems.length === 4 && f.stems.every((s) => s === f.stems[0]);
  },
  'S-GJ-055': (f) => {
    // 地支一字格：四支完全相同
    return f.branches.length === 4 && f.branches.every((b) => b === f.branches[0]);
  },
  'S-GJ-056': (f) => {
    // 两干不杂格：年月同干且日时同干，四柱恰好两干各半
    const uniqueStems = new Set(f.stems);
    if (uniqueStems.size !== 2) return false;
    const yearMonthSame = f.stems[0] === f.stems[1] && f.stems[2] === f.stems[3];
    const altSame = f.stems[0] === f.stems[2] && f.stems[1] === f.stems[3];
    return yearMonthSame || altSame;
  },
  'S-GJ-057': (f) => {
    // 胞胎逢印格：时支为日干五行绝位且月令有印生扶
    const JUE_BRANCH = { 甲: '申', 乙: '酉', 丙: '亥', 丁: '子', 戊: '亥', 己: '子', 庚: '寅', 辛: '卯', 壬: '巳', 癸: '午' };
    const isHourJue = f.branches[3] === JUE_BRANCH[f.dayStem];
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    return isHourJue && hasYin;
  },
  'S-GJ-058': (f) => {
    // 夹丘格：日时相隔一位虚夹四库之一
    const MUKU = ['辰', '戌', '丑', '未'];
    const dBranch = f.branches[2];
    const hBranch = f.branches[3];
    const BRANCH_SEQ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const dIdx = BRANCH_SEQ.indexOf(dBranch);
    const hIdx = BRANCH_SEQ.indexOf(hBranch);
    if (Math.abs(dIdx - hIdx) === 2) {
      const midIdx = (dIdx + hIdx) / 2;
      const midBranch = BRANCH_SEQ[midIdx];
      return MUKU.includes(midBranch) && !f.branches.includes(midBranch);
    }
    return false;
  },
  'S-GJ-059': (f) => {
    // 从革格：庚辛日生申酉月，地支巳酉丑或申酉戌金局全
    if (!['庚', '辛'].includes(f.dayStem)) return false;
    const isSiYouChou = f.branches.includes('巳') && f.branches.includes('酉') && f.branches.includes('丑');
    const isShenYouXu = f.branches.includes('申') && f.branches.includes('酉') && f.branches.includes('戌');
    const noHeavyFire = f.stems.filter((s) => ['丙', '丁'].includes(s)).length <= 1;
    return (isSiYouChou || isShenYouXu) && noHeavyFire;
  },
  'S-GJ-060': (f) => {
    // 润下格：壬癸日生亥子月，地支申子辰或亥子丑水局全
    if (!['壬', '癸'].includes(f.dayStem)) return false;
    const isShenZiChen = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const isHaiZiChou = f.branches.includes('亥') && f.branches.includes('子') && f.branches.includes('丑');
    const noHeavyEarth = f.stems.filter((s) => ['戊', '己'].includes(s)).length === 0;
    return (isShenZiChen || isHaiZiChou) && noHeavyEarth;
  },

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
    (f.isWinter && (f.stems.includes('丙') || f.stems.includes('丁')) && (
      f.roots?.byElement?.['火']?.highestTier === '禄刃专气'
      || f.roots?.byElement?.['火']?.highestTier === '长生源头'
      || f.branches.some((b) => ['巳', '午', '寅'].includes(b))
    ))
    || (f.isSummer && (f.stems.includes('壬') || f.stems.includes('癸')) && (
      f.roots?.byElement?.['水']?.highestTier === '禄刃专气'
      || f.roots?.byElement?.['水']?.highestTier === '长生源头'
      || f.branches.some((b) => ['亥', '子', '申', '辰'].includes(b))
    ))
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
    if (f.roots?.dayMaster?.highestTier === '虚浮无根' && f.roots?.dayMaster?.details?.length === 0) return true;
    const bElems = f.branches.map((b) => BRANCH_TO_ELEMENT[b]);
    const xuTou = f.stems.some((s, idx) => idx !== 2 && !bElems.includes(STEM_TO_ELEMENT[s]));
    const zuoShi = f.stems.some((s, idx) => idx !== 2 && bElems.includes(STEM_TO_ELEMENT[s]));
    return (xuTou && zuoShi) || (f.roots?.dayMaster?.isSelfRooted && xuTou);
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
    const tyEl = f.taiyuan?.nayin?.slice(-1);
    const mgEl = f.minggong?.nayin?.slice(-1);
    const tySheng = tyEl && (SHENG_ELEM[tyEl] === yEl || tyEl === yEl);
    const mgSheng = mgEl && (SHENG_ELEM[mgEl] === yEl || mgEl === yEl);
    const others = f.nayins.slice(1).map((n) => n?.slice(-1));
    const pillarSheng = others.some((e) => SHENG_ELEM[e] === yEl);
    return Boolean(tySheng || mgSheng || pillarSheng);
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
    if (f.gongJia?.hasGongLu || f.gongJia?.hasGongGui || (f.gongJia?.jiaPairs?.length || 0) > 0) return true;
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
    if (f.gongJia?.hasFeiTianDaoChong) return true;
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
  'S-SM-028': (f) => {
    const checkChongKe = (gzA, gzB) => {
      if (!gzA || !gzB || gzA.length < 2 || gzB.length < 2) return false;
      const bA = gzA[1], bB = gzB[1];
      const sA = gzA[0], sB = gzB[0];
      const isChong = CHONG_DEFS.some(([x, y]) => (bA === x && bB === y) || (bA === y && bB === x));
      const sAEl = STEM_TO_ELEMENT[sA], sBEl = STEM_TO_ELEMENT[sB];
      const isKe = KE_ELEM[sAEl] === sBEl || KE_ELEM[sBEl] === sAEl;
      return isChong && isKe;
    };
    const ty = f.taiyuan?.gz;
    const mg = f.minggong?.gz;
    const hasChongKeTaiMing = checkChongKe(f.dayGz, ty) || checkChongKe(f.hourGz, ty)
      || checkChongKe(f.dayGz, mg) || checkChongKe(f.hourGz, mg);
    return Boolean(hasChongKeTaiMing || f.chongPairs.some(([i, j]) => i === 2 || j === 2 || i === 3 || j === 3));
  },
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
