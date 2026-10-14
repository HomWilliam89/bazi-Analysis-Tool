// 核心/matcher/geju_chengbai.mjs
// 丙层 · 格局派《子平真诠》论用神成败救应排他特征匹配谓词集（S-GJ-061～S-GJ-090）
import {
  STEMS, BRANCHES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, STEM_HE, BRANCH_HE, CHONG_DEFS, LU_MAP, REN_MAP,
} from './helpers.mjs';

const YIN_ELEM = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };

function hasStemHe(stems, targetStem, dayStem) {
  return stems.some((s) => s !== targetStem && s !== dayStem && STEM_HE.some(([a, b]) => (a === targetStem && b === s) || (a === s && b === targetStem)));
}

export const GEJU_CHENGBAI_PREDICATES = {
  // S-GJ-061: 正官格逢财印，又无刑冲破害为成格
  'S-GJ-061': (f) => {
    const hasGuan = f.monthMainTenGod?.includes('正官') || f.exposedTenGods.includes('正官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const noShang = !f.exposedTenGods.includes('伤官');
    const noSha = !f.exposedTenGods.includes('七杀');
    const noMonthChong = !f.chongPairs.some(([ci, cj]) => ci === 1 || cj === 1);
    return hasGuan && hasCai && hasYin && noShang && noSha && noMonthChong;
  },

  // S-GJ-062: 官逢伤克刑冲为破格
  'S-GJ-062': (f) => {
    const hasGuan = f.monthMainTenGod?.includes('正官') || f.exposedTenGods.includes('正官');
    if (!hasGuan) return false;
    const shangPo = f.exposedTenGods.includes('伤官') && !f.exposedTenGods.some((t) => t.includes('印'));
    const monthChong = f.chongPairs.some(([ci, cj]) => ci === 1 || cj === 1);
    return shangPo || monthChong;
  },

  // S-GJ-063: 官逢伤透印以解之（败中有救）
  'S-GJ-063': (f) => {
    const hasGuan = f.monthMainTenGod?.includes('正官') || f.exposedTenGods.includes('正官');
    const hasShang = f.exposedTenGods.includes('伤官')
      || (f.dayElement === '水' && (f.branches.includes('寅') || f.branches.includes('卯')))
      || (f.dayElement === '木' && (f.branches.includes('巳') || f.branches.includes('午')))
      || (f.dayElement === '火' && (f.branches.includes('辰') || f.branches.includes('戌') || f.branches.includes('丑') || f.branches.includes('未')))
      || (f.dayElement === '土' && (f.branches.includes('申') || f.branches.includes('酉')))
      || (f.dayElement === '金' && (f.branches.includes('亥') || f.branches.includes('子')));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return hasGuan && hasShang && hasYin;
  },

  // S-GJ-064: 官格杂煞而合煞以清之（败中有救）
  'S-GJ-064': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasSha = f.exposedTenGods.includes('七杀');
    if (!hasGuan || !hasSha) return false;
    const shaStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '七杀');
    return shaStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-065: 官格逢刑冲而会合以解之（败中有救）
  'S-GJ-065': (f) => {
    const isMonthGuan = f.monthMainTenGod?.includes('正官');
    const monthChong = f.chongPairs.some(([ci, cj]) => ci === 1 || cj === 1);
    if (!isMonthGuan || !monthChong) return false;
    const mb = f.branches[1];
    return f.branches.some((b, i) => i !== 1 && BRANCH_HE.some(([x, y]) => (x === mb && y === b) || (x === b && y === mb)));
  },

  // S-GJ-066: 财旺生官身强为成格
  'S-GJ-066': (f) => {
    const isCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasGuan = f.exposedTenGods.includes('正官');
    const noShangSha = !f.exposedTenGods.includes('伤官') && !f.exposedTenGods.includes('七杀');
    const isStrong = (f.roots?.dayMaster?.count || 0) >= 1 || f.hasLu || f.hasYangRen;
    return isCai && hasGuan && noShangSha && isStrong;
  },

  // S-GJ-067: 财逢食生而身强带比为成格
  'S-GJ-067': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasShi = f.exposedTenGods.includes('食神');
    const hasBi = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    const noSha = !f.exposedTenGods.includes('七杀');
    return hasCai && hasShi && hasBi && noSha;
  },

  // S-GJ-068: 财格财轻比重为破格
  'S-GJ-068': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const heavyBi = f.exposedTenGods.filter((t) => t.includes('比') || t.includes('劫')).length >= 1
      || f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === f.dayElement).length >= 2;
    const noGuanSha = !f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    const noShiShang = !f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    return hasCai && heavyBi && noGuanSha && noShiShang;
  },

  // S-GJ-069: 财格财透七煞为破格
  'S-GJ-069': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    const noShi = !f.exposedTenGods.includes('食神');
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    const noJie = !f.exposedTenGods.includes('劫财');
    return hasCai && hasSha && noShi && noYin && noJie;
  },

  // S-GJ-070: 财逢劫透食以化之（救应）
  'S-GJ-070': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasJie = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    const hasShi = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    return hasCai && hasJie && hasShi;
  },

  // S-GJ-071: 财逢劫生官以制之（救应）
  'S-GJ-071': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasJie = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    const hasGuan = f.exposedTenGods.includes('正官');
    return hasCai && hasJie && hasGuan;
  },

  // S-GJ-072: 财逢煞食神制煞以生财（救应）
  'S-GJ-072': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasShi = f.exposedTenGods.includes('食神');
    const noXiao = !f.exposedTenGods.includes('偏印');
    return hasCai && hasSha && hasShi && noXiao;
  },

  // S-GJ-073: 财逢煞或存财而合煞（救应）
  'S-GJ-073': (f) => {
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.some((t) => t.includes('财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    if (!hasCai || !hasSha) return false;
    const shaStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '七杀');
    return shaStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-074: 印轻逢煞官印双全为成格
  'S-GJ-074': (f) => {
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const noHeavyCai = !f.exposedTenGods.some((t) => t.includes('财'));
    return hasYin && hasGuanSha && noHeavyCai;
  },

  // S-GJ-075: 身印两旺而用食伤泄气为成格
  'S-GJ-075': (f) => {
    const isYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const bodyStrong = (f.roots?.dayMaster?.count || 0) >= 1 || f.hasLu || f.hasYangRen;
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const noCaiGuan = !f.exposedTenGods.some((t) => t.includes('财') || t.includes('官') || t.includes('杀'));
    return isYin && bodyStrong && hasShiShang && noCaiGuan;
  },

  // S-GJ-076: 印轻逢财贪财坏印为破格
  'S-GJ-076': (f) => {
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const noGuanSha = !f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    const noJie = !f.exposedTenGods.some((t) => t.includes('劫') || t.includes('比'));
    return hasYin && hasCai && noGuanSha && noJie;
  },

  // S-GJ-077: 身强印重而透煞为破格
  'S-GJ-077': (f) => {
    const isYin = f.monthMainTenGod?.includes('印');
    const masterRoots = f.roots?.dayMaster?.count || 0;
    const hasSha = f.exposedTenGods.includes('七杀');
    const noShiShang = !f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    return isYin && masterRoots >= 2 && hasSha && noShiShang && noCai;
  },

  // S-GJ-078: 印逢财劫财以解之（救应）
  'S-GJ-078': (f) => {
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasJie = f.exposedTenGods.some((t) => t.includes('劫') || t.includes('比'));
    return hasYin && hasCai && hasJie;
  },

  // S-GJ-079: 印逢财合财而存印（救应）
  'S-GJ-079': (f) => {
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    const caiStems = f.stems.filter((s) => safeTenGod(f.dayStem, s).includes('财'));
    if (!hasYin || caiStems.length === 0) return false;
    return caiStems.some((cs) => hasStemHe(f.stems, cs, f.dayStem));
  },

  // S-GJ-080: 食神生财身旺为成格
  'S-GJ-080': (f) => {
    const hasShi = f.monthMainTenGod?.includes('食神') || f.exposedTenGods.includes('食神');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const isStrong = (f.roots?.dayMaster?.count || 0) >= 1 || f.hasLu || f.hasYangRen;
    const noXiao = !f.exposedTenGods.includes('偏印');
    return hasShi && hasCai && isStrong && noXiao;
  },

  // S-GJ-081: 食带煞而无财为成格
  'S-GJ-081': (f) => {
    const hasShi = f.monthMainTenGod?.includes('食神') || f.exposedTenGods.includes('食神');
    const hasSha = f.monthMainTenGod?.includes('七杀') || f.exposedTenGods.includes('七杀');
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    return hasShi && hasSha && noCai;
  },

  // S-GJ-082: 食神逢枭夺食为破格
  'S-GJ-082': (f) => {
    const hasShi = f.exposedTenGods.includes('食神');
    const hasXiao = f.exposedTenGods.includes('偏印');
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    const noSha = !f.exposedTenGods.includes('七杀');
    return hasShi && hasXiao && noCai && noSha;
  },

  // S-GJ-083: 食逢枭就煞以成格（救应）
  'S-GJ-083': (f) => {
    const hasShi = f.exposedTenGods.includes('食神');
    const hasXiao = f.exposedTenGods.includes('偏印');
    const hasSha = f.exposedTenGods.includes('七杀');
    return hasShi && hasXiao && hasSha;
  },

  // S-GJ-084: 食逢枭生财以护食（救应）
  'S-GJ-084': (f) => {
    const hasShi = f.exposedTenGods.includes('食神');
    const hasXiao = f.exposedTenGods.includes('偏印');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasShi && hasXiao && hasCai;
  },

  // S-GJ-085: 身强七煞逢制为成格
  'S-GJ-085': (f) => {
    const hasSha = f.monthMainTenGod?.includes('七杀') || f.exposedTenGods.includes('七杀') || f.stems.some((s) => safeTenGod(f.dayStem, s) === '七杀');
    const isStrong = (f.roots?.dayMaster?.count || 0) >= 1 || f.hasLu || f.hasYangRen;
    const hasZhi = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    const noXiao = !f.exposedTenGods.includes('偏印');
    return hasSha && isStrong && hasZhi && noCai && noXiao;
  },

  // S-GJ-086: 七煞逢财无制为破格
  'S-GJ-086': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const noZhi = !f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    return hasSha && hasCai && noZhi && noYin;
  },

  // S-GJ-087: 煞逢食制逢财以去印存食（救应）
  'S-GJ-087': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasShi = f.exposedTenGods.includes('食神');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasSha && hasShi && hasYin && hasCai;
  },

  // S-GJ-088: 伤官佩印伤旺印根为成格
  'S-GJ-088': (f) => {
    const hasShang = f.monthMainTenGod?.includes('伤官') || f.exposedTenGods.includes('伤官');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const yinElem = YIN_ELEM[f.dayElement];
    const yinRooted = (f.roots?.byElement?.[yinElem]?.count || 0) >= 1;
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    return hasShang && hasYin && yinRooted && noCai;
  },

  // S-GJ-089: 伤官生财带煞煞逢合（救应）
  'S-GJ-089': (f) => {
    const hasShang = f.exposedTenGods.includes('伤官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasSha = f.exposedTenGods.includes('七杀');
    if (!hasShang || !hasCai || !hasSha) return false;
    const shaStems = f.stems.filter((s) => safeTenGod(f.dayStem, s) === '七杀');
    return shaStems.some((ss) => hasStemHe(f.stems, ss, f.dayStem));
  },

  // S-GJ-090: 阳刃透官煞露财印不见伤官为成格
  'S-GJ-090': (f) => {
    const isYangRen = f.branches[1] === f.renBranch;
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const hasCaiYin = f.exposedTenGods.some((t) => t.includes('财') || t.includes('印'));
    const noShang = !f.exposedTenGods.includes('伤官');
    return isYangRen && hasGuanSha && hasCaiYin && noShang;
  },
};
