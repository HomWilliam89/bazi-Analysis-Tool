// 核心/matcher/geju_jiuying.mjs
// 丙层 · 格局派《子平真诠》论用神成败救应全章大圆满排他特征匹配谓词集（S-GJ-091～S-GJ-120）
import {
  STEMS, BRANCHES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, STEM_HE, BRANCH_HE, CHONG_DEFS, LU_MAP, REN_MAP,
} from './helpers.mjs';

function hasStemHe(stems, targetStem, dayStem) {
  return stems.some((s) => s !== targetStem && s !== dayStem && STEM_HE.some(([a, b]) => (a === targetStem && b === s) || (a === s && b === targetStem)));
}

export const GEJU_JIUYING_PREDICATES = {
  // S-GJ-091: 财格透印而位置妥贴，两不相克
  'S-GJ-091': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const caiIndices = [0, 1, 3].filter((i) => safeTenGod(f.dayStem, f.stems[i]).includes('财'));
    const yinIndices = [0, 1, 3].filter((i) => safeTenGod(f.dayStem, f.stems[i]).includes('印'));
    const separated = caiIndices.some((ci) => yinIndices.some((yi) => Math.abs(ci - yi) > 1));
    return hasCai && hasYin && separated;
  },

  // S-GJ-092: 伤官旺、身主弱而透煞印
  'S-GJ-092': (f) => {
    const isShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return isShang && hasSha && hasYin;
  },

  // S-GJ-093: 伤官带煞而无财
  'S-GJ-093': (f) => {
    const isShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const hasSha = f.exposedTenGods.includes('七杀');
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    return isShang && hasSha && noCai;
  },

  // S-GJ-094: 伤官非金水而见官
  'S-GJ-094': (f) => {
    const isShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const hasGuan = f.exposedTenGods.includes('正官');
    const isJinShui = ['庚', '辛'].includes(f.dayStem) && ['亥', '子'].includes(f.monthBranch);
    return isShang && hasGuan && !isJinShui;
  },

  // S-GJ-095: 佩印而伤轻身旺
  'S-GJ-095': (f) => {
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasShang = f.exposedTenGods.includes('伤官');
    const bodyStrong = f.hasLu || f.hasYangRen || (f.roots?.dayMaster?.highestTier === '禄刃专气');
    const shangWeak = !f.branches.some((b) => BRANCH_TO_ELEMENT[b] === SHENG_ELEM[f.dayElement]);
    return hasYin && hasShang && (bodyStrong || shangWeak);
  },

  // S-GJ-096: 阳刃无官煞
  'S-GJ-096': (f) => {
    if (!f.hasYangRen && f.monthBranch !== f.renBranch) return false;
    const hasGuanSha = f.exposedTenGods.some((t) => (t.includes('官') && !t.includes('伤')) || t.includes('杀'));
    return !hasGuanSha;
  },

  // S-GJ-097: 阳刃用官煞带伤食重印以护之
  'S-GJ-097': (f) => {
    const isRen = f.hasYangRen || f.monthBranch === f.renBranch;
    const hasGuanSha = f.exposedTenGods.some((t) => (t.includes('官') && !t.includes('伤')) || t.includes('杀'));
    const hasShangShi = f.exposedTenGods.some((t) => t.includes('伤') || t.includes('食'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return isRen && hasGuanSha && hasShangShi && hasYin;
  },

  // S-GJ-098: 建禄月劫透官而逢财印
  'S-GJ-098': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return isLuJie && hasGuan && (hasCai || hasYin);
  },

  // S-GJ-099: 建禄月劫透财而逢食伤
  'S-GJ-099': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasShangShi = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    return isLuJie && hasCai && hasShangShi;
  },

  // S-GJ-100: 建禄月劫透煞而遇制伏
  'S-GJ-100': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasZhi = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    return isLuJie && hasSha && hasZhi;
  },

  // S-GJ-101: 建禄月劫无财官透煞印
  'S-GJ-101': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const noCaiGuan = !f.exposedTenGods.some((t) => t.includes('财') || t.includes('正官'));
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return isLuJie && noCaiGuan && hasSha && hasYin;
  },

  // S-GJ-102: 建禄月劫用官遇伤伤被合
  'S-GJ-102': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const hasGuan = f.exposedTenGods.includes('正官');
    const shangStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '伤官');
    if (!isLuJie || !hasGuan || shangStems.length === 0) return false;
    return shangStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-103: 建禄月劫用财带煞而煞被合
  'S-GJ-103': (f) => {
    const isLuJie = (f.monthBranch === f.luBranch) || (f.monthMainTenGod?.includes('比肩') || f.monthMainTenGod?.includes('劫财'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const shaStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '七杀');
    if (!isLuJie || !hasCai || shaStems.length === 0) return false;
    return shaStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-104: 正官逢财而又逢伤
  'S-GJ-104': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官') || f.monthMainTenGod?.includes('正官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasShang = f.exposedTenGods.includes('伤官');
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    return hasGuan && hasCai && hasShang && noYin;
  },

  // S-GJ-105: 透官而又逢合
  'S-GJ-105': (f) => {
    const guanStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '正官');
    if (guanStems.length === 0) return false;
    return guanStems.some((gs) => hasStemHe(f.stems, gs, f.dayStem));
  },

  // S-GJ-106: 印透食以泄气而又遇财露
  'S-GJ-106': (f) => {
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const hasShi = f.exposedTenGods.includes('食神');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasYin && hasShi && hasCai;
  },

  // S-GJ-107: 透煞以生印而又透财
  'S-GJ-107': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasSha && hasYin && hasCai;
  },

  // S-GJ-108: 食神带煞印而又逢财
  'S-GJ-108': (f) => {
    const hasShi = f.monthMainTenGod?.includes('食神') || f.exposedTenGods.includes('食神');
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasShi && hasSha && hasYin && hasCai;
  },

  // S-GJ-109: 伤官生财而财又逢合
  'S-GJ-109': (f) => {
    const hasShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const caiStems = f.stems.filter((s) => safeTenGod(f.dayStem, s).includes('财'));
    if (!hasShang || caiStems.length === 0) return false;
    return caiStems.some((cs) => hasStemHe(f.stems, cs, f.dayStem));
  },

  // S-GJ-110: 从透出而变
  'S-GJ-110': (f) => {
    if (f.monthMainStemExposed) return false;
    return f.exposedTenGods.length > 0;
  },

  // S-GJ-111: 从会合而变
  'S-GJ-111': (f) => {
    const SANHE = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
    const hasSanhe = SANHE.some((arr) => arr.every((b) => f.branches.includes(b)));
    const SANHUI = [['寅', '卯', '辰'], ['巳', '午', '未'], ['申', '酉', '戌'], ['亥', '子', '丑']];
    const hasSanhui = SANHUI.some((arr) => arr.every((b) => f.branches.includes(b)));
    return hasSanhe || hasSanhui;
  },

  // S-GJ-112: 变而不失本格
  'S-GJ-112': (f) => {
    if (!f.monthMainStemExposed) return false;
    return f.exposedTenGods.length >= 2;
  },

  // S-GJ-113: 互用而两相得者
  'S-GJ-113': (f) => {
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasShi = f.exposedTenGods.includes('食神');
    return (hasCai && hasGuan) || (hasShi && hasCai);
  },

  // S-GJ-114: 互用而两不相谋者
  'S-GJ-114': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasShang = f.exposedTenGods.includes('伤官');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return (hasGuan && hasShang) || (hasYin && hasCai);
  },

  // S-GJ-115: 合伤存官
  'S-GJ-115': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const shangStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '伤官');
    if (!hasGuan || shangStems.length === 0) return false;
    return shangStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-116: 因成得败
  'S-GJ-116': (f) => {
    const hasShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    return hasShang && hasCai && hasSha;
  },

  // S-GJ-117: 因败得成
  'S-GJ-117': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasShang = f.exposedTenGods.includes('伤官');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return hasGuan && hasShang && hasYin;
  },

  // S-GJ-118: 冻水不能生木
  'S-GJ-118': (f) => {
    if (!['甲', '乙'].includes(f.dayStem)) return false;
    if (!['亥', '子', '丑'].includes(f.monthBranch)) return false;
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const noFire = !f.stems.some((s) => ['丙', '丁'].includes(s)) && !f.branches.some((b) => ['巳', '午'].includes(b));
    return hasYin && noFire;
  },

  // S-GJ-119: 用之冬金，其秀百倍
  'S-GJ-119': (f) => {
    if (!['庚', '辛'].includes(f.dayStem)) return false;
    if (!['亥', '子', '丑'].includes(f.monthBranch)) return false;
    const hasGuanSha = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return hasGuanSha;
  },

  // S-GJ-120: 伤用神甚于伤身，伤相甚于伤用
  'S-GJ-120': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官') || f.monthMainTenGod?.includes('正官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasShi = f.exposedTenGods.includes('食神');
    return (hasGuan && (hasCai || hasYin)) || (hasSha && hasShi);
  },
};
