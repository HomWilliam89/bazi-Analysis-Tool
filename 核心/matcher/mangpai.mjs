// 核心/matcher/mangpai.mjs
// 丙层 · 盲派与象法学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const MANGPAI_PREDICATES = {
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
  'S-MP-031': (f) => f.branches.includes('巳') && f.branches.includes('申'),
  'S-MP-032': (f) => f.chuanPairs.some(([, , b1, b2]) => (b1 === '申' && b2 === '亥') || (b1 === '亥' && b2 === '申') || (b1 === '寅' && b2 === '巳') || (b1 === '巳' && b2 === '寅')),
  'S-MP-033': (f) => [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]].some(([i, j]) => (f.branches[i] === '卯' && f.branches[j] === '戌') || (f.branches[i] === '戌' && f.branches[j] === '卯')),
  'S-MP-034': (f) => [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]].some(([i, j]) => (f.branches[i] === '辰' && f.branches[j] === '酉') || (f.branches[i] === '酉' && f.branches[j] === '辰')),
  'S-MP-035': (f) => [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]].some(([i, j]) => (f.branches[i] === '寅' && f.branches[j] === '亥') || (f.branches[i] === '亥' && f.branches[j] === '寅')),
  'S-MP-036': (f) => [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]].some(([i, j]) => (f.branches[i] === '子' && f.branches[j] === '丑') || (f.branches[i] === '丑' && f.branches[j] === '子')),
  'S-MP-037': (f) => f.gzList.some((gz) => ['丁亥', '己亥', '辛巳', '癸巳', '壬午', '甲午', '戊子', '丙戌', '壬戌'].includes(gz)),
  'S-MP-038': (f) => {
    const counts = {};
    f.branches.forEach((b) => { counts[b] = (counts[b] || 0) + 1; });
    return (counts['午'] >= 2 && f.branches.includes('戌'))
      || (counts['子'] >= 2 && f.branches.includes('辰'))
      || (counts['卯'] >= 2 && f.branches.includes('未'))
      || (counts['酉'] >= 2 && f.branches.includes('丑'));
  },
  'S-MP-039': (f) => {
    const b = f.branches;
    return (b.includes('申') && b.includes('辰') && !b.includes('子'))
      || (b.includes('亥') && b.includes('未') && !b.includes('卯'))
      || (b.includes('寅') && b.includes('戌') && !b.includes('午'))
      || (b.includes('巳') && b.includes('丑') && !b.includes('酉'));
  },
  'S-MP-040': (f) => (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-MP-041': (f) => {
    const hasZhuBi = f.stems[3] === f.dayStem || f.branches.slice(2).includes(LU_MAP[f.dayStem]) || f.branches.slice(2).includes(REN_MAP[f.dayStem]);
    const hasBinCai = [safeTenGod(f.dayStem, f.stems[0]), safeTenGod(f.dayStem, f.stems[1])].some((t) => t === '正财' || t === '偏财');
    return hasZhuBi && hasBinCai;
  },
  'S-MP-042': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官')),
  'S-MP-043': (f) => (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')) && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-MP-044': (f) => (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀')) && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印') || ['寅', '卯', '巳', '午', '申', '酉', '亥', '子'].includes(f.branches[2])),
  'S-MP-045': (f) => ['辰', '戌', '丑', '未'].includes(f.branches[2]) || ['辰', '戌', '丑', '未'].includes(f.branches[3]),
  'S-MP-046': (f) => {
    const dGz = f.gzList[2];
    const hGz = f.gzList[3];
    return (dGz === '癸亥' && hGz === '癸丑') || (dGz === '癸丑' && hGz === '癸亥')
      || (dGz === '丁巳' && hGz === '丁未') || (dGz === '丁未' && hGz === '丁巳')
      || (dGz === '戊辰' && hGz === '戊午') || (dGz === '戊午' && hGz === '戊辰')
      || (f.dayStem === '癸' && f.branches.includes('亥') && f.branches.includes('丑'))
      || (f.dayStem === '丁' && f.branches.includes('巳') && f.branches.includes('未'));
  },
  'S-MP-047': (f) => ['子', '午', '卯', '酉'].includes(f.branches[0]) || ['子', '午', '卯', '酉'].includes(f.branches[1]),
  'S-MP-048': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财') || f.exposedTenGods.includes('伤官')),
  'S-MP-049': (f) => f.exposedTenGods.includes('食神') && f.exposedTenGods.includes('七杀'),
  'S-MP-050': (f) => {
    if (f.chuanPairs.length === 0) return false;
    return (f.exposedTenGods.includes('食神') || f.monthMainTenGod === '食神')
      && (f.exposedTenGods.includes('七杀') || f.monthMainTenGod === '七杀');
  },
  'S-MP-051': (f) => {
    const ku = f.branches.filter((b) => ['辰', '戌', '丑', '未'].includes(b));
    if (ku.length === 0) return false;
    const guanElem = KE_ELEM[f.dayElement];
    return ku.some((b) => {
      if (b === '戌' && guanElem === '火') return true;
      if (b === '辰' && guanElem === '水') return true;
      if (b === '丑' && guanElem === '金') return true;
      if (b === '未' && guanElem === '木') return true;
      return false;
    });
  },
  'S-MP-052': (f) => f.branches.includes('巳'),
  'S-MP-053': (f) => f.chongPairs.some(([, , b1, b2]) => (b1 === '辰' && b2 === '戌') || (b1 === '戌' && b2 === '辰')),
  'S-MP-054': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)) && f.chongPairs.length > 0,
  'S-MP-055': (f) => f.branches.some((b) => ['辰', '丑'].includes(b)) || f.branches.some((b) => ['戌', '未'].includes(b)),
  'S-MP-056': (f) => ['壬', '癸'].includes(f.dayStem) && f.branches.some((b) => ['申', '酉', '亥', '子'].includes(b)),
  'S-MP-057': (f) => BRANCH_HE.some(([a, b]) => f.branches.includes(a) && f.branches.includes(b)),
  'S-MP-058': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-MP-059': (f) => [[0, 2], [0, 3], [1, 2], [1, 3]].some(([i, j]) => {
    const s1 = f.stems[i]; const s2 = f.stems[j];
    const b1 = f.branches[i]; const b2 = f.branches[j];
    const sHe = STEM_HE.some(([x, y]) => (s1 === x && s2 === y) || (s1 === y && s2 === x));
    const bHe = BRANCH_HE.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x));
    return sHe || bHe;
  }),
  'S-MP-060': (f) => {
    const dayBranch = f.branches[2];
    const caiElem = KE_ELEM[f.dayElement];
    return BRANCH_HE.some(([x, y]) => {
      if (dayBranch === x) return BRANCH_TO_ELEMENT[y] === caiElem;
      if (dayBranch === y) return BRANCH_TO_ELEMENT[x] === caiElem;
      return false;
    }) || ['寅', '卯', '巳', '午', '申', '酉', '亥', '子'].some((b) => b === dayBranch && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')));
  },
};
