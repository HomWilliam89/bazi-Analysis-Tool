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
};
