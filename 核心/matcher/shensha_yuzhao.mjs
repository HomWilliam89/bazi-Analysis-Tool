// 核心/matcher/shensha_yuzhao.mjs
// 丙层 · 神煞派《玉照定真经》干支刑冲定位铁断大圆满学理排他特征匹配谓词集 (S-SS-061 ~ S-SS-120)
import {
  safeNayin, KE_ELEM,
} from './helpers.mjs';

export const SHENSHA_YUZHAO_PREDICATES = {
  'S-SS-061': (f) => {
    const hasDeHe = f.shenshaList.some((s) => s.includes('天德合') || s.includes('月德合'));
    return hasDeHe && f.chongPairs.length === 0;
  },
  'S-SS-062': (f) => {
    const isDayHourChong = f.chongPairs.some(([i, j]) => (i === 2 && j === 3) || (i === 3 && j === 2));
    const dayElem = safeNayin(f.dayGz).slice(-1);
    const hourElem = safeNayin(f.hourGz).slice(-1);
    const isNayinKe = dayElem && hourElem && (KE_ELEM[dayElem] === hourElem || KE_ELEM[hourElem] === dayElem);
    return isDayHourChong && isNayinKe;
  },
  'S-SS-063': (f) => {
    const mB = f.monthBranch;
    const tB = f.taiyuan?.branch;
    const chongOrXingMonth = f.chongPairs.filter(([, , b1, b2]) => b1 === mB || b2 === mB).length
      + f.chuanPairs.filter(([, , b1, b2]) => b1 === mB || b2 === mB).length;
    const chongOrXingTai = tB ? (f.chongPairs.filter(([, , b1, b2]) => b1 === tB || b2 === tB).length
      + f.chuanPairs.filter(([, , b1, b2]) => b1 === tB || b2 === tB).length) : 0;
    return chongOrXingMonth >= 2 || chongOrXingTai >= 2;
  },
  'S-SS-064': (f) => {
    const hasYou = f.branches.includes('酉');
    const isAttacked = f.branches.some((b) => ['巳', '午', '卯', '戌'].includes(b));
    const noWaterHeal = !f.stems.some((s) => ['壬', '癸'].includes(s));
    return hasYou && isAttacked && noWaterHeal;
  },
  'S-SS-065': (f) => {
    const hasHai = f.branches.includes('亥');
    const hasKuiGang = f.branches.some((b) => ['辰', '戌'].includes(b));
    const waterHeavy = (f.branches.filter((b) => ['亥', '子'].includes(b)).length + f.stems.filter((s) => ['壬', '癸'].includes(s)).length) >= 2;
    return hasHai && hasKuiGang && waterHeavy;
  },
  'S-SS-066': (f) => {
    const hasGui = f.stems.includes('癸');
    const waterMetalCount = f.stems.filter((s) => ['壬', '癸', '庚', '辛'].includes(s)).length
      + f.branches.filter((b) => ['亥', '子', '申', '酉'].includes(b)).length;
    const noEarthDam = !f.stems.some((s) => ['戊', '己'].includes(s));
    return hasGui && waterMetalCount >= 4 && noEarthDam;
  },
  'S-SS-067': (f) => {
    const hasYueDe = f.shenshaList.includes('月德');
    const hasYueDeDouble = f.shenshaList.filter((s) => s.includes('月德')).length >= 2;
    const hasDeHe = f.shenshaList.some((s) => s.includes('月德合') || s.includes('天德合'));
    const hasGanHe = (f.chart?.gzRelations?.天干合 || []).length > 0;
    return hasYueDeDouble || (hasYueDe && (hasDeHe || hasGanHe));
  },
  'S-SS-068': (f) => {
    const fanZhan = (f.chart?.gzRelations?.天克地冲 || []).length > 0 || (f.chart?.gzRelations?.反吟 || []).length > 0;
    const noDirectSeal = !f.exposedTenGods.some((tg) => ['正印', '偏印'].includes(tg));
    return fanZhan && noDirectSeal;
  },
  'S-SS-069': (f) => {
    const mB = f.monthBranch;
    const tB = f.taiyuan?.branch;
    const isMuKu = ['辰', '戌', '丑', '未'].includes(mB) || (tB && ['辰', '戌', '丑', '未'].includes(tB));
    const hasKuChong = f.chongPairs.some(([, , b1, b2]) => ['辰', '戌', '丑', '未'].includes(b1) && ['辰', '戌', '丑', '未'].includes(b2));
    return isMuKu && hasKuChong;
  },
  'S-SS-070': (f) => {
    const woodCount = ['亥', '卯', '未'].filter((b) => f.branches.includes(b)).length;
    const hasYinMao = f.branches.includes('寅') && f.branches.includes('卯');
    const hasWaterWoodStem = f.stems.some((s) => ['甲', '乙', '壬', '癸'].includes(s));
    return (woodCount >= 2 || hasYinMao) && hasWaterWoodStem;
  },
  'S-SS-071': (f) => {
    const xinCount = f.stems.filter((s) => s === '辛').length;
    const hasEarthOrMetalBranch = f.branches.some((b) => ['酉', '申', '丑'].includes(b));
    return xinCount >= 2 && hasEarthOrMetalBranch;
  },
  'S-SS-072': (f) => {
    const isJia = f.dayStem === '甲';
    const waterStems = f.stems.filter((s) => ['壬', '癸'].includes(s)).length;
    const hasWaterBranch = f.branches.some((b) => ['亥', '子'].includes(b));
    const totalWater = waterStems + f.branches.filter((b) => ['亥', '子'].includes(b)).length;
    return isJia && waterStems >= 1 && hasWaterBranch && totalWater >= 3;
  },
  'S-SS-073': (f) => {
    const hasQian = f.branches.some((b) => ['戌', '亥'].includes(b));
    const qianDamaged = f.chongPairs.some(([, , b1, b2]) => (['戌', '亥'].includes(b1) && ['辰', '巳'].includes(b2)) || (['戌', '亥'].includes(b2) && ['辰', '巳'].includes(b1)));
    return hasQian && qianDamaged;
  },
  'S-SS-074': (f) => {
    const isEarthDay = ['戊', '己'].includes(f.dayStem);
    const inFourSeasons = ['辰', '戌', '丑', '未'].includes(f.monthBranch);
    const hasOfficerOrSeal = f.exposedTenGods.some((tg) => ['正官', '七杀', '正印', '偏印'].includes(tg));
    return isEarthDay && inFourSeasons && hasOfficerOrSeal;
  },
  'S-SS-075': (f) => {
    const isSittingMetal = ['甲申', '乙酉'].includes(f.dayGz);
    const metalCount = f.stems.filter((s) => ['庚', '辛'].includes(s)).length + f.branches.filter((b) => ['申', '酉'].includes(b)).length;
    const noRescue = !f.stems.some((s) => ['丙', '丁', '壬', '癸'].includes(s));
    return isSittingMetal && metalCount >= 2 && noRescue;
  },
  'S-SS-076': (f) => {
    const hasSpecialPillar = f.gzList.some((gz) => ['癸巳', '乙卯', '庚申'].includes(gz));
    const hasTianMen = f.branches.some((b) => ['戌', '亥'].includes(b));
    return hasSpecialPillar && hasTianMen;
  },
  'S-SS-077': (f) => {
    const fireStems = f.stems.filter((s) => ['丙', '丁'].includes(s)).length;
    const mountainBranches = f.branches.filter((b) => ['丑', '寅', '辰', '戌'].includes(b)).length;
    const noWater = !f.stems.some((s) => ['壬', '癸'].includes(s));
    return fireStems >= 2 && mountainBranches >= 2 && noWater;
  },
  'S-SS-078': (f) => {
    const hasYiGeng = f.stems.includes('乙') && f.stems.includes('庚');
    const hasProsperousBranch = f.branches.some((b) => ['申', '酉', '巳', '辰'].includes(b));
    return hasYiGeng && hasProsperousBranch;
  },
  'S-SS-079': (f) => {
    const hasDingPillar = f.gzList.some((gz) => ['丁巳', '丁卯'].includes(gz));
    const isWinter = ['亥', '子', '丑'].includes(f.monthBranch);
    return hasDingPillar && isWinter;
  },
  'S-SS-080': (f) => {
    const hasWuXin = f.stems.includes('戊') && f.stems.includes('辛');
    const conflictCount = f.chongPairs.length + f.chuanPairs.length;
    return hasWuXin && conflictCount >= 2;
  },
  'S-SS-081': (f) => {
    const hasHai = f.branches.includes('亥');
    const metalCount = f.stems.filter((s) => ['庚', '辛'].includes(s)).length + f.branches.filter((b) => ['申', '酉'].includes(b)).length;
    const noFireWarm = !f.stems.some((s) => ['丙', '丁'].includes(s));
    return hasHai && metalCount >= 3 && noFireWarm;
  },
  'S-SS-082': (f) => {
    const isWaterDay = ['壬', '癸'].includes(f.dayStem);
    const isAutumn = ['申', '酉'].includes(f.monthBranch);
    const noFire = !f.stems.some((s) => ['丙', '丁'].includes(s));
    return isWaterDay && isAutumn && noFire;
  },
  'S-SS-083': (f) => {
    return f.gzList.includes('辛亥') && f.branches.includes('卯');
  },
  'S-SS-084': (f) => {
    const hasDingYou = f.dayGz === '丁酉' || f.hourGz === '丁酉';
    const noWetEarth = !['辰', '丑'].includes(f.hourBranch);
    return hasDingYou && noWetEarth;
  },
  'S-SS-085': (f) => {
    const isEarthDay = ['戊', '己'].includes(f.dayStem);
    const isWeiShenMonth = ['未', '申'].includes(f.monthBranch);
    const earthMetalCount = f.stems.filter((s) => ['戊', '己', '庚', '辛'].includes(s)).length
      + f.branches.filter((b) => ['未', '申', '酉', '丑'].includes(b)).length;
    return isEarthDay && isWeiShenMonth && earthMetalCount >= 3;
  },
  'S-SS-086': (f) => {
    return ['辰', '午', '酉', '亥'].some((b) => f.branches.filter((x) => x === b).length >= 2);
  },
  'S-SS-087': (f) => {
    return f.branches.includes('子') && f.branches.includes('卯');
  },
  'S-SS-088': (f) => {
    const hasChouXu = f.branches.includes('丑') && f.branches.includes('戌');
    const hasChouWei = f.branches.includes('丑') && f.branches.includes('未');
    const hasSanXing = f.branches.includes('丑') && f.branches.includes('戌') && f.branches.includes('未');
    return hasSanXing || hasChouXu || hasChouWei;
  },
  'S-SS-089': (f) => {
    return f.chuanPairs.some(([, , b1, b2]) => (b1 === '辰' && b2 === '卯') || (b1 === '卯' && b2 === '辰'));
  },
  'S-SS-090': (f) => {
    return f.chuanPairs.some(([, , b1, b2]) => (b1 === '午' && b2 === '丑') || (b1 === '丑' && b2 === '午'));
  },
  'S-SS-091': (f) => {
    const metalCount = f.stems.filter((s) => ['庚', '辛'].includes(s)).length
      + f.branches.filter((b) => ['申', '酉'].includes(b)).length;
    const hasShenYou = f.branches.includes('申') && f.branches.includes('酉');
    const noFireWater = !f.stems.some((s) => ['丙', '丁', '壬', '癸'].includes(s));
    return (metalCount >= 4 || (hasShenYou && metalCount >= 3)) && noFireWater;
  },
  'S-SS-092': (f) => {
    const isWoodDay = ['甲', '乙'].includes(f.dayStem);
    const hasYinMao = f.branches.includes('寅') && f.branches.includes('卯');
    const woodCount = f.stems.filter((s) => ['甲', '乙'].includes(s)).length
      + f.branches.filter((b) => ['寅', '卯'].includes(b)).length;
    const noFireMetal = !f.stems.some((s) => ['丙', '丁', '庚', '辛'].includes(s));
    return isWoodDay && hasYinMao && woodCount >= 3 && noFireMetal;
  },
  'S-SS-093': (f) => {
    const isBingInNorth = f.dayStem === '丙' && ['亥', '子'].includes(f.monthBranch);
    const isRenInSouth = f.dayStem === '壬' && ['巳', '午'].includes(f.monthBranch);
    const waterFireConflict = f.stems.some((s) => (isBingInNorth ? ['壬', '癸'].includes(s) : ['丙', '丁'].includes(s)));
    return (isBingInNorth || isRenInSouth) && waterFireConflict;
  },
  'S-SS-094': (f) => {
    const hasYi = f.stems.includes('乙');
    const hasChen = f.branches.includes('辰');
    const isYiChen = f.gzList.includes('乙辰');
    return (hasYi && hasChen) || isYiChen;
  },
  'S-SS-095': (f) => {
    const renCount = f.stems.filter((s) => s === '壬').length;
    const hasGen = f.branches.some((b) => ['丑', '寅'].includes(b));
    const hasKan = f.branches.includes('子');
    return renCount >= 1 && hasGen && hasKan;
  },
  'S-SS-096': (f) => {
    const hasXuHai = f.branches.includes('戌') && f.branches.includes('亥');
    const allYinStems = f.stems.every((s) => ['乙', '丁', '己', '辛', '癸'].includes(s));
    const noYangFire = !f.stems.includes('丙');
    return hasXuHai && (allYinStems || noYangFire);
  },
  'S-SS-097': (f) => {
    const hasChou = f.branches.includes('丑');
    const hasGui = f.stems.includes('癸');
    const hasJia = f.stems.includes('甲');
    return hasChou && hasGui && hasJia;
  },
  'S-SS-098': (f) => {
    const hasYinSi = f.branches.includes('寅') && f.branches.includes('巳');
    const hasFire = f.stems.some((s) => ['丙', '丁'].includes(s)) || f.branches.includes('午');
    const noWetEarth = !f.branches.some((b) => ['辰', '丑'].includes(b));
    return hasYinSi && hasFire && noWetEarth;
  },
  'S-SS-099': (f) => {
    const gongCaoInYearMonth = ['寅'].includes(f.branches[0]) || ['寅'].includes(f.branches[1]);
    const siInDayHour = ['巳'].includes(f.branches[2]) || ['巳'].includes(f.branches[3]);
    return gongCaoInYearMonth && siInDayHour;
  },
  'S-SS-100': (f) => {
    const hasChou = f.branches.includes('丑');
    const southFireCount = f.branches.filter((b) => ['巳', '午', '未'].includes(b)).length;
    const fireStems = f.stems.filter((s) => ['丙', '丁'].includes(s)).length;
    return hasChou && (southFireCount >= 2 || (southFireCount >= 1 && fireStems >= 2));
  },
  'S-SS-101': (f) => {
    return f.chuanPairs.some(([, , b1, b2]) => (b1 === '子' && b2 === '未') || (b1 === '未' && b2 === '子'));
  },
  'S-SS-102': (f) => {
    const ziInYearMonth = ['子'].includes(f.branches[0]) || ['子'].includes(f.branches[1]);
    const weiInDayHour = ['未'].includes(f.branches[2]) || ['未'].includes(f.branches[3]);
    const hasChuan = f.chuanPairs.some(([, , b1, b2]) => (b1 === '子' && b2 === '未') || (b1 === '未' && b2 === '子'));
    return (ziInYearMonth && weiInDayHour) || hasChuan;
  },
  'S-SS-103': (f) => {
    return f.chuanPairs.some(([, , b1, b2]) => (b1 === '申' && b2 === '亥') || (b1 === '亥' && b2 === '申'));
  },
  'S-SS-104': (f) => {
    return (f.chart?.gzRelations?.地支六合 || []).some((r) => r.pair?.includes('辰') && r.pair?.includes('酉'))
      || (f.branches.includes('辰') && f.branches.includes('酉'));
  },
  'S-SS-105': (f) => {
    const hasSiShen = f.branches.includes('巳') && f.branches.includes('申');
    const hasFireMetalStems = f.stems.some((s) => ['丙', '丁'].includes(s)) && f.stems.some((s) => ['庚', '辛'].includes(s));
    const hasYiMa = f.shenshaList.some((s) => s.includes('驿马'));
    return hasSiShen && (hasFireMetalStems || hasYiMa);
  },
  'S-SS-106': (f) => {
    const hasSiShen = f.branches.includes('巳') && f.branches.includes('申');
    const hasChong = f.chongPairs.length > 0;
    return hasSiShen && !hasChong;
  },
  'S-SS-107': (f) => {
    const isYangStem = ['甲', '丙', '戊', '庚', '壬'].includes(f.dayStem);
    const isJianLu = f.branches[1] === f.luBranch;
    const hasOfficerOrSeal = f.exposedTenGods.some((tg) => ['正官', '正印'].includes(tg));
    return isYangStem && isJianLu && hasOfficerOrSeal;
  },
  'S-SS-108': (f) => {
    const isYinStem = ['乙', '丁', '己', '辛', '癸'].includes(f.dayStem);
    const hasKongWang = f.branches.some((b) => f.kongWang?.includes(b));
    const hasConflict = f.chongPairs.length > 0 || f.chuanPairs.length > 0;
    return isYinStem && hasKongWang && hasConflict;
  },
  'S-SS-109': (f) => {
    const isBingWu = ['丙', '戊'].includes(f.dayStem);
    const hasChenXuChong = f.chongPairs.some(([, , b1, b2]) => (b1 === '辰' && b2 === '戌') || (b1 === '戌' && b2 === '辰'));
    return isBingWu && hasChenXuChong;
  },
  'S-SS-110': (f) => {
    const hasKwBranch = f.branches.some((b) => f.kongWang?.includes(b));
    const hasHe = (f.chart?.gzRelations?.地支六合 || []).length > 0 || (f.chart?.gzRelations?.天干合 || []).length > 0;
    return hasKwBranch && hasHe;
  },
  'S-SS-111': (f) => {
    const hasYou = f.branches.includes('酉');
    const hasHaiWei = f.branches.some((b) => ['亥', '未'].includes(b));
    const hasXinDing = f.stems.some((s) => ['辛', '丁'].includes(s));
    return hasYou && hasHaiWei && hasXinDing;
  },
  'S-SS-112': (f) => {
    const hasMao = f.branches.includes('卯');
    const hasXinYi = f.stems.includes('辛') && f.stems.includes('乙');
    const isAutumnWinter = ['申', '酉', '戌', '亥', '子'].includes(f.monthBranch);
    return hasMao && hasXinYi && isAutumnWinter;
  },
  'S-SS-113': (f) => {
    const hasYou = f.branches.includes('酉');
    const hasXinYi = f.stems.includes('辛') && f.stems.includes('乙');
    return hasYou && hasXinYi;
  },
  'S-SS-114': (f) => {
    const isMetalDay = ['庚', '辛'].includes(f.dayStem);
    const inWinter = ['亥', '子', '丑'].includes(f.monthBranch);
    const noFire = !f.stems.some((s) => ['丙', '丁'].includes(s)) && !f.branches.some((b) => ['巳', '午'].includes(b));
    return isMetalDay && inWinter && noFire;
  },
  'S-SS-115': (f) => {
    const woodCount = f.stems.filter((s) => ['甲', '乙'].includes(s)).length
      + f.branches.filter((b) => ['寅', '卯'].includes(b)).length;
    const hasKongWang = f.branches.some((b) => f.kongWang?.includes(b));
    return woodCount >= 3 && hasKongWang;
  },
  'S-SS-116': (f) => {
    const isWaterDay = ['壬', '癸'].includes(f.dayStem);
    const waterCount = f.stems.filter((s) => ['壬', '癸'].includes(s)).length
      + f.branches.filter((b) => ['亥', '子'].includes(b)).length;
    const noEarthStem = !f.stems.some((s) => ['戊', '己'].includes(s));
    return isWaterDay && waterCount >= 3 && noEarthStem;
  },
  'S-SS-117': (f) => {
    const noConflict = f.chongPairs.length === 0 && f.chuanPairs.length === 0;
    const hasLuOrRen = f.hasLu || f.hasYangRen;
    const hasOfficerAndSeal = f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('正印');
    return noConflict && (hasLuOrRen || hasOfficerAndSeal);
  },
  'S-SS-118': (f) => {
    const woodStems = f.stems.filter((s) => ['甲', '乙'].includes(s)).length;
    const hasEarthBranch = f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b));
    const noFireStem = !f.stems.some((s) => ['丙', '丁'].includes(s));
    const hasChongOrChuan = f.chongPairs.length > 0 || f.chuanPairs.length > 0;
    return woodStems >= 2 && hasEarthBranch && noFireStem && hasChongOrChuan;
  },
  'S-SS-119': (f) => {
    const fireStems = f.stems.filter((s) => ['丙', '丁'].includes(s)).length;
    const isAutumn = ['申', '酉'].includes(f.monthBranch);
    const noWater = !f.stems.some((s) => ['壬', '癸'].includes(s));
    return fireStems >= 2 && isAutumn && noWater;
  },
  'S-SS-120': (f) => {
    const fireCount = f.stems.filter((s) => ['丙', '丁'].includes(s)).length
      + f.branches.filter((b) => ['巳', '午'].includes(b)).length;
    const isWinter = ['亥', '子'].includes(f.monthBranch);
    const noWood = !f.stems.some((s) => ['甲', '乙'].includes(s));
    return fireCount >= 2 && isWinter && noWood;
  },
};
