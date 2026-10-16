// 核心/matcher/shensha.mjs
// 丙层 · 神煞派学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP, GUOYIN_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';
import { SHENSHA_YUZHAO_PREDICATES } from './shensha_yuzhao.mjs';

export const SHENSHA_PREDICATES = {
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
  'S-SS-014': (f) => ['甲子', '甲午', '己卯', '己酉'].includes(f.dayGz)
    || ['甲子', '甲午', '己卯', '己酉'].includes(f.hourGz),
  'S-SS-015': (f) => f.hasYangRen && f.yangRenChong,
  'S-SS-016': (f) => {
    const target = GUOYIN_MAP[f.dayStem];
    return Boolean(target && f.branches.includes(target));
  },
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
    const yIdx = BRANCHES.indexOf(f.branches[0]);
    if (yIdx < 0) return false;
    const isYangY = ['甲', '丙', '戊', '庚', '壬'].includes(f.stems[0]);
    const gender = f.chart?.gender || (f.chart?.isMale === false ? '女' : '男');
    const isMale = gender === '男' || gender === 'male' || gender === '乾造' || f.chart?.isMale !== false;
    const isYangOrder = (isYangY && isMale) || (!isYangY && !isMale);
    const target = BRANCHES[isYangOrder ? (yIdx + 7) % 12 : (yIdx + 5) % 12];
    return Boolean(target && f.branches.slice(1).includes(target));
  },
  'S-SS-022': (f) => ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'].includes(f.dayGz),
  'S-SS-023': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SS-024': (f) => {
    const yIdx = BRANCHES.indexOf(f.branches[0]);
    if (yIdx < 0) return false;
    const isYangY = ['甲', '丙', '戊', '庚', '壬'].includes(f.stems[0]);
    const gender = f.chart?.gender || (f.chart?.isMale === false ? '女' : '男');
    const isMale = gender === '男' || gender === 'male' || gender === '乾造' || f.chart?.isMale !== false;
    const isYangOrder = (isYangY && isMale) || (!isYangY && !isMale);
    const gou = isYangOrder ? BRANCHES[(yIdx + 3) % 12] : BRANCHES[(yIdx + 9) % 12];
    const jiao = isYangOrder ? BRANCHES[(yIdx + 9) % 12] : BRANCHES[(yIdx + 3) % 12];
    return f.branches.slice(1).some((b) => b === gou || b === jiao);
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
  'S-SS-031': (f) => {
    const YANG = ['甲', '丙', '戊', '庚', '壬'];
    return f.stems.every((s) => YANG.includes(s));
  },
  'S-SS-032': (f) => {
    const YIN = ['乙', '丁', '己', '辛', '癸'];
    return f.stems.every((s) => YIN.includes(s));
  },
  'S-SS-033': (f) => {
    const hasJieJiao = f.stems.some((s, i) => KE_ELEM[BRANCH_TO_ELEMENT[f.branches[i]]] === STEM_TO_ELEMENT[s]);
    const hasXingOrChong = (f.chart?.gzRelations?.地支刑?.length > 0 || f.chart?.gzRelations?.地支自刑?.length > 0 || f.chongPairs.length > 0);
    return hasJieJiao && hasXingOrChong && (f.roots?.dayMaster?.status !== '安稳');
  },
  'S-SS-034': (f) => {
    const elemCounts = {};
    for (const s of f.stems) {
      const e = STEM_TO_ELEMENT[s];
      elemCounts[e] = (elemCounts[e] || 0) + 1;
    }
    const keys = Object.keys(elemCounts);
    return keys.length === 2 && elemCounts[keys[0]] === 2 && elemCounts[keys[1]] === 2
      && (KE_ELEM[keys[0]] === keys[1] || KE_ELEM[keys[1]] === keys[0]);
  },
  'S-SS-035': (f) => {
    return ['戌', '亥'].includes(f.hourBranch)
      && f.stems.some((s) => ['丙', '丁'].includes(s))
      && f.stems.some((s) => ['甲', '乙'].includes(s))
      && f.stems.some((s) => ['戊', '己'].includes(s));
  },
  'S-SS-036': (f) => {
    const KUI_GANG_PILLARS = ['戊戌', '庚戌', '庚辰', '壬辰'];
    const isKgDay = KUI_GANG_PILLARS.includes(f.dayGz);
    const kgBranches = f.branches.filter((b) => ['辰', '戌'].includes(b));
    return isKgDay && kgBranches.length >= 2;
  },
  'S-SS-037': (f) => {
    return f.stems.includes('庚') && f.stems.includes('甲')
      && f.branches.includes('寅') && f.branches.includes('申');
  },
  'S-SS-038': (f) => {
    return f.branches.includes('子') && f.branches.includes('午')
      && (['子', '午'].includes(f.dayBranch) || ['子', '午'].includes(f.hourBranch));
  },
  'S-SS-039': (f) => {
    return (f.stems.includes('癸') || f.stems.includes('壬'))
      && f.stems.includes('乙')
      && f.branches.includes('卯') && f.branches.includes('酉');
  },
  'S-SS-040': (f) => {
    return f.stems.includes('辛') && (f.stems.includes('乙') || f.stems.includes('丁'))
      && f.branches.includes('巳') && f.branches.includes('亥') && f.branches.includes('酉');
  },
  'S-SS-041': (f) => {
    return f.gzList.includes('甲寅') && f.gzList.includes('辛丑');
  },
  'S-SS-042': (f) => {
    return f.gzList.includes('癸未') && f.gzList.includes('庚申');
  },
  'S-SS-043': (f) => {
    return f.chuanPairs.some((p) => (p.b1 === '酉' && p.b2 === '戌') || (p.b1 === '戌' && p.b2 === '酉'));
  },
  'S-SS-044': (f) => {
    const hasDing = f.stems.includes('丁');
    const hasXunKun = f.branches.some((b) => ['辰', '巳', '未', '申'].includes(b));
    return hasDing && hasXunKun && (f.roots?.byElement?.火?.highestTier === '禄刃专气' || f.roots?.byElement?.火?.count >= 1);
  },
  'S-SS-045': (f) => {
    const fireStems = f.stems.filter((s) => ['丙', '丁'].includes(s)).length;
    const metalBranches = f.branches.filter((b) => ['申', '酉'].includes(b)).length;
    return fireStems >= 2 && metalBranches >= 1 && !f.branches.some((b) => ['亥', '子'].includes(b));
  },
  'S-SS-046': (f) => {
    const metalCount = f.branches.filter((b) => ['申', '酉'].includes(b)).length + f.stems.filter((s) => ['庚', '辛'].includes(s)).length;
    const hasXing = (f.chart?.gzRelations?.地支刑?.length > 0 || f.chart?.gzRelations?.地支自刑?.length > 0);
    return metalCount >= 3 && hasXing;
  },
  'S-SS-047': (f) => {
    const isWoodDay = ['甲', '乙'].includes(f.dayStem);
    const waterBranches = f.branches.filter((b) => ['亥', '子'].includes(b)).length;
    const hasWoodRoot = f.branches.some((b) => ['寅', '卯'].includes(b));
    return isWoodDay && !hasWoodRoot && waterBranches >= 2;
  },
  'S-SS-048': (f) => {
    return f.stems.includes('丙') && f.stems.includes('辛')
      && f.branches.some((b) => ['戌', '亥', '辰', '巳'].includes(b));
  },
  'S-SS-049': (f) => {
    return f.branches.filter((b) => b === '辰').length >= 2;
  },
  'S-SS-050': (f) => {
    return f.branches.filter((b) => b === '戌').length >= 2;
  },
  'S-SS-051': (f) => {
    const LIU_JIA = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];
    return f.gzList.some((gz) => LIU_JIA.includes(gz));
  },
  'S-SS-052': (f) => {
    return f.branches.includes('辰') && f.branches.includes('巳')
      && (['辰', '巳'].includes(f.dayBranch) || ['辰', '巳'].includes(f.hourBranch));
  },
  'S-SS-053': (f) => {
    const isWoodDay = ['甲', '乙'].includes(f.dayStem);
    const metalCount = f.branches.filter((b) => ['申', '酉'].includes(b)).length + f.stems.filter((s) => ['庚', '辛'].includes(s)).length;
    const hasFireOrWater = f.stems.some((s) => ['丙', '丁', '壬', '癸'].includes(s));
    return isWoodDay && metalCount >= 3 && !hasFireOrWater;
  },
  'S-SS-054': (f) => {
    return ['辰', '戌', '丑', '未'].every((b) => f.branches.includes(b));
  },
  'S-SS-055': (f) => {
    return ['子', '午', '卯', '酉'].every((b) => f.branches.includes(b));
  },
  'S-SS-056': (f) => {
    const hasSiJi = ['辰', '戌', '丑', '未'].every((b) => f.branches.includes(b));
    const hasExposedWealthOrOfficer = f.exposedTenGods.some((tg) => ['正官', '七杀', '正财', '偏财', '正印', '偏印'].includes(tg));
    return hasSiJi && hasExposedWealthOrOfficer;
  },
  'S-SS-057': (f) => {
    const isStrong = f.roots?.dayMaster?.highestTier === '禄刃专气' || f.hasLu || f.hasYangRen;
    const xingRel = f.chart?.gzRelations?.地支刑 || [];
    const mainPos = ['日支', '时支'];
    const otherPos = ['年支', '月支'];
    const hitsXing = xingRel.some((x) => (mainPos.includes(x.p1) && otherPos.includes(x.p2)) || (mainPos.includes(x.p2) && otherPos.includes(x.p1)));
    return isStrong && hitsXing;
  },
  'S-SS-058': (f) => {
    const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];
    const YIN_STEMS = ['乙', '丁', '己', '辛', '癸'];
    const YANG_BRANCHES = ['子', '寅', '辰', '午', '申', '戌'];
    const YIN_BRANCHES = ['丑', '卯', '巳', '未', '酉', '亥'];
    const allYang = f.stems.every((s) => YANG_STEMS.includes(s)) && f.branches.every((b) => YANG_BRANCHES.includes(b));
    const allYin = f.stems.every((s) => YIN_STEMS.includes(s)) && f.branches.every((b) => YIN_BRANCHES.includes(b));
    return allYang || allYin;
  },
  'S-SS-059': (f) => {
    const springMetal = ['寅', '卯'].includes(f.monthBranch) && f.branches.filter((b) => ['申', '酉'].includes(b)).length >= 2;
    const autumnWood = ['申', '酉'].includes(f.monthBranch) && f.branches.filter((b) => ['寅', '卯'].includes(b)).length >= 2;
    return springMetal || autumnWood;
  },
  'S-SS-060': (f) => {
    return ['寅', '巳', '申'].every((b) => f.branches.includes(b));
  },
  ...SHENSHA_YUZHAO_PREDICATES,
};

