// 核心/matcher/wangshuai.mjs
// 丙层 · 旺衰扶抑派学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';
import { WANGSHUAI_SHENFENG_PREDICATES } from './wangshuai_shenfeng.mjs';
import { WANGSHUAI_SHENFENG_ER_PREDICATES } from './wangshuai_shenfeng_er.mjs';

export const WANGSHUAI_PREDICATES = {
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
  'S-WS-031': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const yinElem = Object.keys(SHENG_ELEM).find((e) => SHENG_ELEM[e] === f.dayElement);
    const yinPct = pcts[yinElem] || 0;
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const yinHeavy = yinPct >= 35 || f.exposedTenGods.filter((t) => t.includes('印')).length >= 2;
    const bodyNotStrong = !f.hasLu && !f.hasYangRen;
    return yinHeavy && hasCai && bodyNotStrong;
  },
  'S-WS-032': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const yinElem = Object.keys(SHENG_ELEM).find((e) => SHENG_ELEM[e] === f.dayElement);
    const yinPct = pcts[yinElem] || 0;
    const noCai = !f.exposedTenGods.some((t) => t.includes('财'));
    const yinHeavy = yinPct >= 40 || f.exposedTenGods.filter((t) => t.includes('印')).length >= 2;
    const bodyWeak = !f.hasLu && !f.hasYangRen;
    return yinHeavy && noCai && bodyWeak;
  },
  'S-WS-033': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const caiElem = KE_ELEM[f.dayElement];
    const caiPct = pcts[caiElem] || 0;
    const caiCount = f.exposedTenGods.filter((t) => t.includes('财')).length;
    const caiHeavy = caiPct >= 30 || caiCount >= 2 || (caiCount >= 1 && f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === caiElem).length >= 1);
    const bodyHealthy = f.hasLu || f.hasYangRen || (pcts[f.dayElement] || 0) >= 25;
    return caiHeavy && bodyHealthy;
  },
  'S-WS-034': (f) => f.chongPairs.length >= 2,
  'S-WS-035': (f) => {
    let stemHeCount = 0;
    for (let i = 0; i < f.stems.length; i++) {
      for (let j = i + 1; j < f.stems.length; j++) {
        const pair = [f.stems[i], f.stems[j]].sort().join('');
        if (['甲己', '乙庚', '丙辛', '丁壬', '戊癸'].includes(pair)) stemHeCount++;
      }
    }
    let branchHeCount = 0;
    for (let i = 0; i < f.branches.length; i++) {
      for (let j = i + 1; j < f.branches.length; j++) {
        const pair = [f.branches[i], f.branches[j]].sort().join('');
        if (['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'].includes(pair)) branchHeCount++;
      }
    }
    return (stemHeCount + branchHeCount) >= 2;
  },
  'S-WS-036': (f) => {
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasGuanSha = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    const bodyWeak = !f.hasLu && !f.hasYangRen;
    return hasCai && hasGuanSha && noYin && bodyWeak;
  },
  'S-WS-037': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const hasYin = f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印');
    const hasShi = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    return (hasGuan && hasYin) || (hasShi && hasCai);
  },
  'S-WS-038': (f) => {
    const pcts = Object.entries(f.elemStrength?.percent || f.elemStrength?.percentages || {})
      .sort((a, b) => b[1] - a[1]);
    if (pcts.length >= 2) {
      const top2Sum = pcts[0][1] + pcts[1][1];
      return top2Sum >= 70 && pcts[0][1] >= 25 && pcts[1][1] >= 25 && (pcts[2]?.[1] || 0) <= 15;
    }
    const branchElems = [...new Set(f.branches.map((b) => BRANCH_TO_ELEMENT[b]))];
    return branchElems.length === 2 && f.stems.every((s) => branchElems.includes(STEM_TO_ELEMENT[s]));
  },
  'S-WS-039': (f) => {
    const stemElems = f.stems.map((s) => STEM_TO_ELEMENT[s]);
    const step01 = SHENG_ELEM[stemElems[0]] === stemElems[1];
    const step12 = SHENG_ELEM[stemElems[1]] === stemElems[2];
    const step23 = SHENG_ELEM[stemElems[2]] === stemElems[3];
    return (step01 && step12) || (step12 && step23) || (step01 && step23);
  },
  'S-WS-040': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const woodPct = pcts['木'] || 0;
    const metalPct = pcts['金'] || 0;
    const bothStrong = woodPct >= 20 && metalPct >= 20;
    const hasWaterOrFire = f.stems.some((s) => ['水', '火'].includes(STEM_TO_ELEMENT[s]));
    return bothStrong && hasWaterOrFire;
  },
  'S-WS-041': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const waterPct = pcts['水'] || 0;
    const firePct = pcts['火'] || 0;
    const bothStrong = waterPct >= 20 && firePct >= 20;
    const hasWoodOrEarth = f.stems.some((s) => ['木', '土'].includes(STEM_TO_ELEMENT[s]));
    return bothStrong && hasWoodOrEarth;
  },
  'S-WS-042': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length > 0) {
      const max = Math.max(...pcts);
      const minNonZero = Math.min(...pcts.filter((p) => p > 0));
      return max >= 50 && minNonZero <= 10;
    }
    const bCounts = {};
    for (const b of f.branches) {
      const e = BRANCH_TO_ELEMENT[b];
      bCounts[e] = (bCounts[e] || 0) + 1;
    }
    return Object.values(bCounts).some((c) => c >= 3);
  },
  'S-WS-043': (f) => {
    const hasCaiGuanExposed = f.exposedTenGods.some((t) => t.includes('财') || t.includes('官'));
    const hasBiJieExposed = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    const hasHiddenShaOrRen = (!f.exposedTenGods.includes('七杀') && f.branches.some((b) => ['酉', '午', '卯', '子'].includes(b) && (f.hasYangRen || f.hasLu)));
    return (hasCaiGuanExposed && hasBiJieExposed) || hasHiddenShaOrRen;
  },
  'S-WS-044': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const isWinter = ['亥', '子', '丑'].includes(f.monthBranch);
    const isSummer = ['巳', '午', '未'].includes(f.monthBranch);
    if (isWinter && (pcts['火'] || 0) <= 10) return true;
    if (isSummer && (pcts['水'] || 0) <= 10) return true;
    return false;
  },
  'S-WS-045': (f) => {
    const dryEarth = f.branches.filter((b) => ['未', '戌'].includes(b)).length;
    const wetEarth = f.branches.filter((b) => ['丑', '辰'].includes(b)).length;
    return dryEarth >= 2 || wetEarth >= 2;
  },
  'S-WS-046': (f) => f.monthMainStemExposed === true,
  'S-WS-047': (f) => f.monthMainStemExposed === false && f.exposedTenGods.length >= 2,
  'S-WS-048': (f) => {
    const isStrong = f.hasLu || f.hasYangRen;
    const hasShiShang = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    const noHeavyGuanSha = f.exposedTenGods.filter((t) => t.includes('杀') || t.includes('官')).length <= 1;
    return isStrong && hasShiShang && noHeavyGuanSha;
  },
  'S-WS-049': (f) => {
    const dayB = BRANCH_TO_ELEMENT[f.dayBranch];
    const monthB = BRANCH_TO_ELEMENT[f.monthBranch];
    const monthS = STEM_TO_ELEMENT[f.monthStem];
    const dayBiOrSheng = SHENG_ELEM[dayB] === f.dayElement || dayB === f.dayElement;
    const monthBiOrSheng = SHENG_ELEM[monthB] === monthS || monthB === monthS;
    return dayBiOrSheng && monthBiOrSheng;
  },
  'S-WS-050': (f) => {
    const mGod = safeTenGod(f.dayStem, f.monthStem);
    const hGod = safeTenGod(f.dayStem, f.hourStem);
    const isYinBi = (mGod.includes('印') || mGod.includes('比')) && (hGod.includes('印') || hGod.includes('比'));
    const isCaiShi = (mGod.includes('食') || mGod.includes('财')) && (hGod.includes('食') || hGod.includes('财'));
    return isYinBi || isCaiShi;
  },
  'S-WS-051': (f) => {
    const hBranch = f.hourBranch;
    const luB = LU_MAP[f.dayStem];
    const renB = REN_MAP[f.dayStem];
    const csList = CHANGSHENG_MAP[f.dayElement] || [];
    return hBranch === luB || hBranch === renB || csList.includes(hBranch);
  },
  'S-WS-052': (f) => {
    const noRoot = f.roots?.dayMaster?.highestTier === '虚浮无根';
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    const notStrong = !f.hasLu && !f.hasYangRen;
    return Boolean(noRoot && noYin && notStrong);
  },
  'S-WS-053': (f) => {
    const yElem = STEM_TO_ELEMENT[f.yearStem];
    const mElem = STEM_TO_ELEMENT[f.monthStem];
    const hElem = STEM_TO_ELEMENT[f.hourStem];
    return (SHENG_ELEM[yElem] === mElem && SHENG_ELEM[mElem] === hElem)
      || (SHENG_ELEM[hElem] === mElem && SHENG_ELEM[mElem] === yElem);
  },
  'S-WS-054': (f) => {
    const hasStemHe = STEM_HE.some(([a, b]) => f.stems.includes(a) && f.stems.includes(b));
    const hasBranchHe = BRANCH_HE.some(([a, b]) => f.branches.includes(a) && f.branches.includes(b));
    return (hasStemHe || hasBranchHe) && f.chongPairs.length === 0;
  },
  'S-WS-055': (f) => {
    const hasShang = f.exposedTenGods.includes('伤官');
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return hasShang && hasGuan && hasCai;
  },
  'S-WS-056': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasCaiOrYin = f.exposedTenGods.some((t) => t.includes('财') || t.includes('印'));
    const notChong = f.chongPairs.length === 0;
    return hasGuan && hasCaiOrYin && notChong;
  },
  'S-WS-057': (f) => {
    const isRooted = f.roots?.dayMaster?.highestTier === '禄刃专气' || f.roots?.dayMaster?.highestTier === '长生源头';
    const isPeace = f.roots?.dayMaster?.status === '安稳' && f.chongPairs.length === 0;
    return Boolean(isRooted && isPeace);
  },
  'S-WS-058': (f) => {
    const noRoot = f.roots?.dayMaster?.highestTier === '虚浮无根';
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const noYinBi = !f.exposedTenGods.some((t) => t.includes('比') || t.includes('印'));
    return Boolean(noRoot && selfPct <= 10 && noYinBi);
  },
  'S-WS-059': (f) => {
    const dayB = f.dayBranch;
    const dayBElem = BRANCH_TO_ELEMENT[dayB];
    const isDiShengTian = SHENG_ELEM[dayBElem] === f.dayElement;
    const dayBranchChong = f.chongPairs.some(([i, j]) => i === 2 || j === 2);
    return Boolean(isDiShengTian && dayBranchChong);
  },
  'S-WS-060': (f) => f.hasYangRen === true && f.exposedTenGods.includes('七杀'),
  ...WANGSHUAI_SHENFENG_PREDICATES,
  ...WANGSHUAI_SHENFENG_ER_PREDICATES,
};

