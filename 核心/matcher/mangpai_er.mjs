// 核心/matcher/mangpai_er.mjs
// 丙层 · 盲派象法高级应象与实战断法定式收官谓词集 (S-MP-091～S-MP-120)
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const MANGPAI_ER_PREDICATES = {
  // S-MP-091: 活木用丙火为开花泄秀定式
  'S-MP-091': (f) => ['甲', '乙'].includes(f.dayStem) && f.stems.includes('丙')
    && (f.branches.some((b) => ['寅', '卯', '辰', '亥', '未'].includes(b)) || (f.elemStrength?.percentages?.['木'] || 0) >= 25),

  // S-MP-092: 死木怕焚火旺易早死定式
  'S-MP-092': (f) => ['甲', '乙'].includes(f.dayStem)
    && !f.branches.some((b) => ['寅', '卯', '亥'].includes(b))
    && ((f.elemStrength?.percentages?.['火'] || 0) >= 35 || f.branches.filter((b) => ['巳', '午'].includes(b)).length >= 2),

  // S-MP-093: 丁火是一种光故不怕其旺定式
  'S-MP-093': (f) => f.dayStem === '丁'
    && (['巳', '午', '未'].includes(f.monthBranch) || f.branches.filter((b) => ['巳', '午', '寅'].includes(b)).length >= 2),

  // S-MP-094: 丙火过旺怕焚灭定式
  'S-MP-094': (f) => f.dayStem === '丙'
    && (f.elemStrength?.percentages?.['火'] || 0) >= 40
    && !f.stems.includes('壬') && !f.stems.includes('癸'),

  // S-MP-095: 戊土燥重丙戊一家定式
  'S-MP-095': (f) => f.dayStem === '戊'
    && (f.stems.includes('丙') || f.branches.filter((b) => ['戌', '未'].includes(b)).length >= 2),

  // S-MP-096: 己土卑湿喜禄和丁火旺之定式
  'S-MP-096': (f) => f.dayStem === '己'
    && (f.stems.includes('丁') || f.branches.includes('午')),

  // S-MP-097: 庚金制化得宜即可成材但不喜旺定式
  'S-MP-097': (f) => f.dayStem === '庚'
    && (f.elemStrength?.percentages?.['金'] || 0) >= 40
    && f.branches.filter((b) => ['申', '酉'].includes(b)).length >= 2,

  // S-MP-098: 辛金夏遭克最喜旺水冬遇寒最宜丁火定式
  'S-MP-098': (f) => f.dayStem === '辛'
    && ((['巳', '午', '未'].includes(f.monthBranch) && (f.stems.some((s) => ['壬', '癸'].includes(s)) || f.branches.some((b) => ['亥', '子'].includes(b))))
      || (['亥', '子', '丑'].includes(f.monthBranch) && (f.stems.includes('丁') || f.branches.includes('午')))),

  // S-MP-099: 水流有方向从年上往时上流定式
  'S-MP-099': (f) => (f.elemStrength?.percentages?.['水'] || 0) >= 20
    && (f.yearBranch === '辰' || f.hourBranch === '辰'),

  // S-MP-100: 辰子叫半拱局不叫入墓定式
  'S-MP-100': (f) => f.branches.includes('辰') && f.branches.includes('子'),

  // S-MP-101: 戌拱午不叫入库定式
  'S-MP-101': (f) => f.branches.includes('戌') && f.branches.includes('午'),

  // S-MP-102: 丑是财库穿不动定式
  'S-MP-102': (f) => f.branches.includes('丑') && f.branches.includes('午')
    && f.chuanPairs.some(([, , b1, b2]) => (b1 === '丑' && b2 === '午') || (b1 === '午' && b2 === '丑')),

  // S-MP-103: 穿不是开墓是推倒定式
  'S-MP-103': (f) => f.chuanPairs.some(([, , b1, b2]) => ['辰', '戌', '丑', '未'].includes(b1) || ['辰', '戌', '丑', '未'].includes(b2)),

  // S-MP-104: 刑事犯罪多数会在八字中出现劫杀亡神象
  'S-MP-104': (f) => {
    const ss = f.chart?.shenSha || [];
    const hasJie = ss.some((s) => s.name?.includes('劫煞'));
    const hasWang = ss.some((s) => s.name?.includes('亡神'));
    return hasJie || hasWang;
  },

  // S-MP-105: 金羊刃也是牢狱象
  'S-MP-105': (f) => (f.dayStem === '庚' && f.branches.includes('酉'))
    || (f.dayStem === '辛' && f.branches.includes('申')),

  // S-MP-106: 金性的官杀为忌代表因金导致的祸象
  'S-MP-106': (f) => ['甲', '乙'].includes(f.dayStem)
    && ((f.elemStrength?.percentages?.['金'] || 0) >= 30 || f.branches.filter((b) => ['申', '酉'].includes(b)).length >= 2),

  // S-MP-107: 流年印坐驿马食伤坐驿马离家远学象
  'S-MP-107': (f) => {
    const ss = f.chart?.shenSha || [];
    const hasYima = ss.some((s) => s.name?.includes('驿马'));
    return hasYima && f.exposedTenGods.some((g) => ['正印', '偏印', '食神', '伤官'].includes(g));
  },

  // S-MP-108: 官杀坐驿马工作外出远调运输象
  'S-MP-108': (f) => {
    const ss = f.chart?.shenSha || [];
    const hasYima = ss.some((s) => s.name?.includes('驿马'));
    return hasYima && f.exposedTenGods.some((g) => ['正官', '七杀'].includes(g));
  },

  // S-MP-109: 身弱财虚透不算穷人也不会很富象
  'S-MP-109': (f) => {
    const caiGods = ['正财', '偏财'];
    const hasCai = f.stems.some((s, idx) => idx !== 2 && caiGods.includes(safeTenGod(f.dayStem, s)));
    const bElems = f.branches.map((b) => BRANCH_TO_ELEMENT[b]);
    const caiElem = KE_ELEM[f.dayElement];
    return hasCai && !bElems.includes(caiElem);
  },

  // S-MP-110: 一合财就要看身强身弱原则定式
  'S-MP-110': (f) => f.stems.some((s, idx) => idx !== 2 && safeTenGod(f.dayStem, s) === '正财' && STEM_HE[f.dayStem] === s)
    || (GANZHI[f.dayGz] && ['戊子', '壬午', '丁亥', '辛巳'].includes(f.dayGz)),

  // S-MP-111: 伤官正财求名求利贪心无厌象
  'S-MP-111': (f) => f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('正财'),

  // S-MP-112: 正官正印适合公职幕僚象
  'S-MP-112': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('正印'),

  // S-MP-113: 七杀正印权威司法权力象
  'S-MP-113': (f) => f.exposedTenGods.includes('七杀') && f.exposedTenGods.includes('正印'),

  // S-MP-114: 正印食神慈母老师贵人象
  'S-MP-114': (f) => f.exposedTenGods.includes('正印') && f.exposedTenGods.includes('食神'),

  // S-MP-115: 七杀劫财军人黑道象
  'S-MP-115': (f) => f.exposedTenGods.includes('七杀') && f.exposedTenGods.includes('劫财'),

  // S-MP-116: 正财比劫好吃懒做身弱无力象
  'S-MP-116': (f) => f.exposedTenGods.includes('正财') && (f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财')),

  // S-MP-117: 伤官劫财是非难缠象
  'S-MP-117': (f) => f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('劫财'),

  // S-MP-118: 伤官七杀劫财坏脾气象
  'S-MP-118': (f) => f.exposedTenGods.includes('伤官') && f.exposedTenGods.includes('七杀') && f.exposedTenGods.includes('劫财'),

  // S-MP-119: 食神正官正印好性格象
  'S-MP-119': (f) => f.exposedTenGods.includes('食神') && f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('正印'),

  // S-MP-120: 正官七杀说到做到一言九鼎象
  'S-MP-120': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),
};
