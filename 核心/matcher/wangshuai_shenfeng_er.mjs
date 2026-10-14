// 核心/matcher/wangshuai_shenfeng_er.mjs
// 丙层 · 旺衰扶抑派《神峰通考》动静盖头生克与病药说第二批 30 条特征匹配谓词（S-WS-091～S-WS-120）
// 严格遵守单文件 < 400 行红线架构防御
// 原料母本：明代张楠《神峰通考》（男女合婚说、印绶格、月支正财格、伤官食神格、身弱论、弃命从杀格）

import {
  STEMS, BRANCHES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod,
} from './helpers.mjs';

export const WANGSHUAI_SHENFENG_ER_PREDICATES = {
  // S-WS-091: 男女合婚说·男比劫重配女伤食重
  'S-WS-091': (f) => {
    const pcts = f.elemStrength?.percent || {};
    const selfPct = pcts[f.dayElement] || 0;
    const shiShangElem = SHENG_ELEM[f.dayElement];
    const shiShangPct = pcts[shiShangElem] || 0;
    const hasBiJie = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    const hasShiShang = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    return Boolean((selfPct >= 35 && hasBiJie) || (shiShangPct >= 30 && hasShiShang));
  },

  // S-WS-092: 偏官格附弃命从杀格·六阴从杀六阳难
  'S-WS-092': (f) => {
    const isYin = ['乙', '丁', '己', '辛', '癸'].includes(f.dayStem);
    const guanShaElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === f.dayElement);
    const guanShaPct = (f.elemStrength?.percent || {})[guanShaElem] || 0;
    const hasGuanSha = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return Boolean(hasGuanSha && guanShaPct >= 28 && (isYin || !f.hasLu));
  },

  // S-WS-093: 弃命从杀格·从财忌杀从杀喜财
  'S-WS-093': (f) => {
    const pcts = f.elemStrength?.percent || {};
    const caiElem = KE_ELEM[f.dayElement];
    const guanElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === f.dayElement);
    const caiPct = pcts[caiElem] || 0;
    const guanPct = pcts[guanElem] || 0;
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasGuan = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return Boolean(hasCai && hasGuan && (caiPct + guanPct >= 35));
  },

  // S-WS-094: 印绶格·四柱印太旺日主有气见屠破印
  'S-WS-094': (f) => {
    const pcts = f.elemStrength?.percent || {};
    const yinElem = Object.keys(SHENG_ELEM).find((k) => SHENG_ELEM[k] === f.dayElement);
    const yinPct = pcts[yinElem] || 0;
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasRoot = f.roots?.dayMaster?.highestTier !== '虚浮无根';
    return Boolean(yinPct >= 35 && hasCai && hasRoot);
  },

  // S-WS-095: 印绶格·重重生气若无官常作清高技艺看
  'S-WS-095': (f) => {
    const guanElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === f.dayElement);
    const guanPct = (f.elemStrength?.percent || {})[guanElem] || 0;
    const hasGuan = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    const yinElem = Object.keys(SHENG_ELEM).find((k) => SHENG_ELEM[k] === f.dayElement);
    const yinPct = (f.elemStrength?.percent || {})[yinElem] || 0;
    return Boolean(yinPct >= 28 && !hasGuan && guanPct === 0);
  },

  // S-WS-096: 印绶格·印绶干头重见比运入财乡福禄真
  'S-WS-096': (f) => {
    const yinElem = Object.keys(SHENG_ELEM).find((k) => SHENG_ELEM[k] === f.dayElement);
    const mElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const hasYin = mElem === yinElem || f.exposedTenGods.some((t) => t.includes('印'));
    const hasBi = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    return Boolean(hasYin && hasBi);
  },

  // S-WS-097: 印绶格·真假印辩枯苗得雨畏冲克
  'S-WS-097': (f) => {
    const isBingHai = f.dayStem === '丙' && f.monthBranch === '亥';
    const isMuQiu = f.dayElement === '木' && ['申', '酉', '戌'].includes(f.monthBranch) && f.exposedTenGods.some((t) => t.includes('印'));
    const isHuoDong = f.dayElement === '火' && ['亥', '子', '丑'].includes(f.monthBranch) && f.exposedTenGods.some((t) => t.includes('印'));
    return Boolean(isBingHai || isMuQiu || isHuoDong);
  },

  // S-WS-098: 月支正财格·逢财喜杀身旺比劫多喜官杀制劫
  'S-WS-098': (f) => {
    const pcts = f.elemStrength?.percent || {};
    const selfPct = pcts[f.dayElement] || 0;
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasBi = f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫'));
    return Boolean(hasCai && hasBi && (selfPct >= 30 || f.hasLu || f.hasYangRen));
  },

  // S-WS-099: 月支正财格·弃命从财不论阴阳畏入印生根地
  'S-WS-099': (f) => {
    const caiElem = KE_ELEM[f.dayElement];
    const caiPct = (f.elemStrength?.percent || {})[caiElem] || 0;
    const noBiYin = !f.exposedTenGods.some((t) => t.includes('比') || t.includes('劫') || t.includes('印'));
    const noRoot = f.roots?.dayMaster?.highestTier === '虚浮无根';
    return Boolean(caiPct >= 40 && noBiYin && noRoot);
  },

  // S-WS-100: 月支正财格·正财有气喜强身旺利名长身弱财旺反成祸
  'S-WS-100': (f) => {
    const caiElem = KE_ELEM[f.dayElement];
    const caiPct = (f.elemStrength?.percent || {})[caiElem] || 0;
    const mElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const hasCai = mElem === caiElem || f.exposedTenGods.some((t) => t.includes('正财'));
    const selfPct = (f.elemStrength?.percent || {})[f.dayElement] || 0;
    return Boolean(hasCai && (caiPct >= 22 || f.exposedTenGods.includes('正财')) && (selfPct >= 28 || selfPct <= 15 || f.hasLu));
  },

  // S-WS-101: 伤官食神格·男伤有财多儿女伤财印荣夫
  'S-WS-101': (f) => {
    const hasShiShang = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return Boolean(hasShiShang && hasCai && hasYin);
  },

  // S-WS-102: 伤官食神格·伤官伤尽最为奇犹恐伤多反不宜
  'S-WS-102': (f) => {
    const shiShangElem = SHENG_ELEM[f.dayElement];
    const shiShangPct = (f.elemStrength?.percent || {})[shiShangElem] || 0;
    const noGuan = !f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    const selfPct = (f.elemStrength?.percent || {})[f.dayElement] || 0;
    return Boolean(shiShangPct >= 38 && noGuan && selfPct <= 20);
  },

  // S-WS-103: 伤官食神格·食神明朗寿元长继母逢之不可当
  'S-WS-103': (f) => {
    return f.exposedTenGods.includes('食神') && f.exposedTenGods.includes('偏印');
  },

  // S-WS-104: 伤官食神格·食神生旺喜生财日主刚强福禄来
  'S-WS-104': (f) => {
    const selfPct = (f.elemStrength?.percent || {})[f.dayElement] || 0;
    const hasShiShang = f.exposedTenGods.some((t) => t.includes('食') || t.includes('伤'));
    const hasCai = f.exposedTenGods.some((t) => t.includes('财'));
    return Boolean((selfPct >= 28 || f.hasLu) && hasShiShang && hasCai);
  },

  // S-WS-105: 身弱论·阳木无根生丑水多贵金折乙木生丑金多从杀火多折
  'S-WS-105': (f) => ['甲', '乙'].includes(f.dayStem) && f.monthBranch === '丑',

  // S-WS-106: 身弱论·丙火无根子申全见无制无生贫贱
  'S-WS-106': (f) => {
    return f.dayStem === '丙' && f.branches.includes('子') && f.branches.includes('申')
      && !f.branches.some((b) => ['寅', '巳', '午'].includes(b));
  },

  // S-WS-107: 身弱论·六甲坐申三重见子北方水大漂木
  'S-WS-107': (f) => {
    return f.dayGz === '甲申' && f.branches.filter((b) => b === '子').length >= 2;
  },

  // S-WS-108: 身弱论·己入亥宫怕阴木月逢印生自然福
  'S-WS-108': (f) => f.dayStem === '己' && f.monthBranch === '亥',

  // S-WS-109: 身弱论·己日逢杀印旺财伏东南贵高财足
  'S-WS-109': (f) => {
    const hasYi = f.stems.includes('乙');
    const huoPct = (f.elemStrength?.percent || {})['火'] || 0;
    return f.dayStem === '己' && hasYi && (huoPct >= 25 || f.exposedTenGods.some((t) => t.includes('印')));
  },

  // S-WS-110: 身弱论·壬寅壬戌阳土透出不混官星名显荣禄
  'S-WS-110': (f) => {
    return ['壬寅', '壬戌'].includes(f.dayGz) && f.stems.includes('戊') && !f.stems.includes('己');
  },

  // S-WS-111: 身弱论·阴水无根火乡有贵阳水无根火乡即畏
  'S-WS-111': (f) => {
    const isRenGui = ['壬', '癸'].includes(f.dayStem);
    const huoPct = (f.elemStrength?.percent || {})['火'] || 0;
    const noRoot = f.roots?.dayMaster?.highestTier === '虚浮无根';
    return Boolean(isRenGui && huoPct >= 28 && noRoot);
  },

  // S-WS-112: 身弱论·丁酉阴柔不怕多水比肩透露格中反忌
  'S-WS-112': (f) => {
    const shuiPct = (f.elemStrength?.percent || {})['水'] || 0;
    const hasGuanSha = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return f.dayGz === '丁酉' && (shuiPct >= 25 || hasGuanSha);
  },

  // S-WS-113: 身弱论·戊寅日主何愁杀旺露火成名水来漂荡
  'S-WS-113': (f) => f.dayGz === '戊寅',

  // S-WS-114: 身弱论·庚午日主支火炎炎见土则贵见水为嫌
  'S-WS-114': (f) => {
    const fireBranches = f.branches.filter((b) => ['巳', '午', '未'].includes(b) || (b === '寅' && f.branches.includes('午')));
    return f.dayGz === '庚午' && fireBranches.length >= 2;
  },

  // S-WS-115: 身弱论·癸巳无根火土重见透财名彰露根则贱
  'S-WS-115': (f) => {
    const pcts = f.elemStrength?.percent || {};
    const huoTuPct = (pcts['火'] || 0) + (pcts['土'] || 0);
    return f.dayGz === '癸巳' && huoTuPct >= 40;
  },

  // S-WS-116: 弃命从杀格·甲乙无根怕逢申酉杀合逢之双目必朽
  'S-WS-116': (f) => {
    const isWood = f.dayElement === '木';
    const jinPct = (f.elemStrength?.percent || {})['金'] || 0;
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return Boolean(isWood && ['申', '酉'].includes(f.monthBranch) && jinPct >= 35 && !hasYin);
  },

  // S-WS-117: 弃命从杀格·甲木无根生于五月水多转贵金多则折
  'S-WS-117': (f) => {
    const shuiPct = (f.elemStrength?.percent || {})['水'] || 0;
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    return f.dayStem === '甲' && f.monthBranch === '午' && (shuiPct >= 10 || hasYin);
  },

  // S-WS-118: 弃命从杀格·丙火申提无根从杀有根南旺脱根寿促
  'S-WS-118': (f) => {
    const shuiPct = (f.elemStrength?.percent || {})['水'] || 0;
    const hasGuan = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return f.dayStem === '丙' && f.monthBranch === '申' && (shuiPct >= 20 || hasGuan);
  },

  // S-WS-119: 弃命从杀格·阳火无根水乡必忌阴火无根水乡有救
  'S-WS-119': (f) => {
    return ['丙', '丁'].includes(f.dayStem) && ['亥', '子'].includes(f.monthBranch);
  },

  // S-WS-120: 弃命从杀格·阴火酉月弃命就财北方入格南地为灾
  'S-WS-120': (f) => {
    const jinPct = (f.elemStrength?.percent || {})['金'] || 0;
    const noRoot = f.roots?.dayMaster?.highestTier === '虚浮无根';
    return f.dayStem === '丁' && f.monthBranch === '酉' && (jinPct >= 25 || noRoot);
  },
};
