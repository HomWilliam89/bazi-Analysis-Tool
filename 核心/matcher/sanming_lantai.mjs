// 核心/matcher/sanming_lantai.mjs
// 丙层 · 古法三命《兰台妙选》《五行精纪》纳音神机与名格定式（S-SM-061～S-SM-090）
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const SANMING_LANTAI_PREDICATES = {
  // S-SM-061: 宝剑化青龙格，剑锋金逢辰位水库青龙顺引化龙入云汉
  'S-SM-061': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasJian = gzs.some((gz) => ['壬申', '癸酉'].includes(gz));
    const hasLong = f.branches.includes('辰');
    return hasJian && hasLong;
  },

  // S-SM-062: 云龙风虎格，辰龙与寅虎两全带顺，云从龙风从虎早擢甲科
  'S-SM-062': (f) => {
    const hasLong = f.branches.includes('辰');
    const hasHu = f.branches.includes('寅');
    const noBreak = !f.branches.includes('申') && !f.branches.includes('戌');
    return hasLong && hasHu && noBreak;
  },

  // S-SM-063: 日月分秀格，柱中见戊午太阳与己未太阴各占秀气阴阳和合
  'S-SM-063': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return gzs.includes('戊午') && gzs.includes('己未');
  },

  // S-SM-064: 昆山片玉格，纳音石榴木或白蜡金生于土山之中得精纯片玉
  'S-SM-064': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasYu = gzs.some((gz) => ['庚申', '辛酉', '庚辰', '辛巳'].includes(gz));
    const hasKunShan = f.branches.some((b) => ['未', '戌', '辰', '丑'].includes(b));
    return hasYu && hasKunShan;
  },

  // S-SM-065: 桂林一枝格，柱逢己未月窟见辛卯松柏月桂，一枝独秀科名早登
  'S-SM-065': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasYue = gzs.includes('己未');
    const hasGui = gzs.includes('辛卯');
    const isAutumn = ['申', '酉', '戌'].includes(f.monthBranch) && gzs.some((gz) => gz.endsWith('卯'));
    return (hasYue && hasGui) || isAutumn;
  },

  // S-SM-066: 源远流清格，泉中涧下清纯之水生逢金水之乡无重土浑浊
  'S-SM-066': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasQingShui = gzs.some((gz) => ['甲申', '乙酉', '丙子', '丁丑'].includes(gz));
    const jinShuiCount = f.branches.filter((b) => ['申', '酉', '亥', '子'].includes(b)).length;
    const heavyTu = f.stems.filter((s) => ['戊', '己'].includes(s)).length >= 3;
    return hasQingShui && jinShuiCount >= 2 && !heavyTu;
  },

  // S-SM-067: 烈风雷雨格，见戊子己丑霹雳火或见辰泽风雷相济成霖利民济物
  'S-SM-067': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasPiLi = gzs.some((gz) => ['戊子', '己丑'].includes(gz));
    const hasFengLei = f.branches.includes('辰') && f.branches.includes('巳');
    return hasPiLi || hasFengLei;
  },

  // S-SM-068: 云凝薄露格，涧下水或天河水逢寅卯东方阳和滋润荣盛
  'S-SM-068': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasLu = gzs.some((gz) => ['丙子', '丁丑', '丙午', '丁未'].includes(gz));
    const hasSpring = f.branches.some((b) => ['寅', '卯'].includes(b));
    return hasLu && hasSpring;
  },

  // S-SM-069: 凤舞顺风格，酉年生人或见辛酉柱遇巳支巽风顺行威震千里
  'S-SM-069': (f) => {
    const isYouYear = f.yearBranch === '酉' || [f.yearGz, f.monthGz, f.dayGz, f.hourGz].includes('辛酉');
    const hasFeng = f.branches.includes('巳') && !f.branches.includes('亥');
    return Boolean(isYouYear && hasFeng);
  },

  // S-SM-070: 马骤天廷格，午马生人日时见亥天门天廷奔向金阙封万钟
  'S-SM-070': (f) => {
    const isMa = f.yearBranch === '午' || f.dayBranch === '午';
    const hasTianTing = (f.dayBranch === '亥' || f.hourBranch === '亥') && !f.branches.includes('子');
    return isMa && hasTianTing;
  },

  // S-SM-071: 风雨作霖格，纳音水命四柱见辰泽与巳风交感作霖润泽苍生
  'S-SM-071': (f) => {
    if (!f.nayins || f.nayins.length < 2) return false;
    const isShui = f.nayins.some((n) => n?.endsWith('水'));
    const hasChenSi = f.branches.includes('辰') && f.branches.includes('巳');
    return Boolean(isShui && hasChenSi);
  },

  // S-SM-072: 地天交泰格，坤宫厚土与乾宫真金水气上下相生天地交感
  'S-SM-072': (f) => {
    const hasKun = f.branches.some((b) => ['未', '申'].includes(b));
    const hasQian = f.branches.some((b) => ['戌', '亥'].includes(b));
    const tuShengJin = f.stems.some((s) => ['戊', '己'].includes(s)) && f.stems.some((s) => ['庚', '辛'].includes(s));
    return (hasKun && hasQian) || tuShengJin;
  },

  // S-SM-073: 五行入垣格，金木水火土五行各自乘其临官帝旺正位气局纯整
  'S-SM-073': (f) => {
    const yuanCount = (f.branches.some((b) => ['申', '酉'].includes(b)) ? 1 : 0)
      + (f.branches.some((b) => ['寅', '卯'].includes(b)) ? 1 : 0)
      + (f.branches.some((b) => ['亥', '子'].includes(b)) ? 1 : 0)
      + (f.branches.some((b) => ['巳', '午'].includes(b)) ? 1 : 0)
      + (f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b)) ? 1 : 0);
    return yuanCount >= 4;
  },

  // S-SM-074: 十干官星见贵格，正官透干且自坐天乙贵人或见贵人引临位极金阙
  'S-SM-074': (f) => {
    const hasZhengGuan = f.exposedTenGods.includes('正官');
    const hasGui = f.shenshaList.includes('天乙贵人') || f.hasTianYiHuHuan;
    return hasZhengGuan && hasGui;
  },

  // S-SM-075: 龙居沧海格，辰年生人见子水正位或大海水气潜伏青云早达
  'S-SM-075': (f) => {
    const isChenYear = f.yearBranch === '辰';
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasSea = f.branches.includes('子') || gzs.some((gz) => ['壬戌', '癸亥'].includes(gz));
    return isChenYear && hasSea;
  },

  // S-SM-076: 虎卧荒丘格，寅年生人日时见辰戌丑未四丘伏伺而动脱身白屋
  'S-SM-076': (f) => {
    const isYinYear = f.yearBranch === '寅';
    const hasQiu = [f.dayBranch, f.hourBranch].some((b) => ['辰', '戌', '丑', '未'].includes(b));
    return isYinYear && hasQiu;
  },

  // S-SM-077: 官贵引从格，正官或贵人之支在局中前后地支相邻簇拥鸳行班列
  'S-SM-077': (f) => {
    const bIndices = f.branches.map((b) => BRANCHES.indexOf(b)).filter((i) => i >= 0);
    const hasConsecutive = bIndices.some((idx) => bIndices.includes((idx + 1) % 12));
    const hasGuiOrGuan = f.exposedTenGods.includes('正官') || f.shenshaList.includes('天乙贵人');
    return hasConsecutive && hasGuiOrGuan;
  },

  // S-SM-078: 一气为根格，天干纯一或地支同气三字以上连属主清贵方面之任
  'S-SM-078': (f) => {
    const stemCounts = {};
    f.stems.forEach((s) => { stemCounts[s] = (stemCounts[s] || 0) + 1; });
    const maxStem = Math.max(...Object.values(stemCounts));
    const branchCounts = {};
    f.branches.forEach((b) => { branchCounts[b] = (branchCounts[b] || 0) + 1; });
    const maxBranch = Math.max(...Object.values(branchCounts));
    return maxStem >= 3 || maxBranch >= 3;
  },

  // S-SM-079: 月白风清格，生于申酉秋月见己未太阴与巳风金白水清乘风而化
  'S-SM-079': (f) => {
    const isAutumn = ['申', '酉'].includes(f.monthBranch);
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasYue = gzs.includes('己未');
    const hasFeng = f.branches.includes('巳');
    return isAutumn && (hasYue || hasFeng);
  },

  // S-SM-080: 魁星指南格，见甲辰或庚戌戊戌魁罡日时指南见巳午南离之乡
  'S-SM-080': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasKui = gzs.some((gz) => ['甲辰', '庚戌', '戊戌', '壬辰', '庚辰'].includes(gz));
    const hasNan = ['巳', '午'].includes(f.hourBranch);
    return hasKui && hasNan;
  },

  // S-SM-081: 玉兔东生格，己未太阴逢日时卯木东方日升之位文章秀发登堂
  'S-SM-081': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasYue = gzs.includes('己未');
    const hasMao = [f.dayBranch, f.hourBranch].includes('卯');
    return hasYue && hasMao;
  },

  // S-SM-082: 棣萼芬芳格，四柱见同类连枝或骨肉同气同蒂蝉联富贵
  'S-SM-082': (f) => {
    const sameStemCount = f.stems.filter((s) => s === f.dayStem).length;
    const sameBranchCount = f.branches.filter((b) => b === f.dayBranch).length;
    return sameStemCount >= 2 || sameBranchCount >= 2;
  },

  // S-SM-083: 透顶连荣格，四柱天干顺次相生贯通无逆挺生贤辅
  'S-SM-083': (f) => {
    const sEl = f.stems.map((s) => STEM_ELEMENT[s]);
    const sheng1 = SHENG_ELEM[sEl[0]] === sEl[1] && SHENG_ELEM[sEl[1]] === sEl[2];
    const sheng2 = SHENG_ELEM[sEl[1]] === sEl[2] && SHENG_ELEM[sEl[2]] === sEl[3];
    return Boolean(sheng1 || sheng2);
  },

  // S-SM-084: 石榴喷火格，石榴木逢夏生午未或柱见丙丁火灼灼喷焰极丽之贵
  'S-SM-084': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasShiLiu = gzs.some((gz) => ['庚申', '辛酉'].includes(gz));
    const hasHuo = ['巳', '午', '未'].includes(f.monthBranch) || f.stems.some((s) => ['丙', '丁'].includes(s));
    return hasShiLiu && hasHuo;
  },

  // S-SM-085: 丹桂秋香格，辛卯松柏木生于秋月申酉戌金令肃杀芬芳显达
  'S-SM-085': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasGui = gzs.includes('辛卯');
    const isAutumn = ['申', '酉', '戌'].includes(f.monthBranch);
    return hasGui && isAutumn;
  },

  // S-SM-086: 寒谷回春格，冬月严寒生人柱逢寅卯木生发或丙丁火照暖回春
  'S-SM-086': (f) => {
    const isWinter = ['亥', '子', '丑'].includes(f.monthBranch);
    const hasSpring = f.branches.some((b) => ['寅', '卯'].includes(b)) || f.stems.some((s) => ['丙', '丁'].includes(s));
    return isWinter && hasSpring;
  },

  // S-SM-087: 真武当权格，壬癸水命生于亥子北极正位水聚天河持兵符之任
  'S-SM-087': (f) => {
    const isShuiMaster = ['壬', '癸'].includes(f.dayStem);
    const isNorth = ['亥', '子'].includes(f.monthBranch) || ['亥', '子'].includes(f.dayBranch);
    const waterBranches = f.branches.filter((b) => ['亥', '子', '申', '辰'].includes(b)).length;
    return isShuiMaster && isNorth && waterBranches >= 2;
  },

  // S-SM-088: 勾陈得位格，戊己土命生于辰戌丑未四季正位土厚抚四方
  'S-SM-088': (f) => {
    const isTuMaster = ['戊', '己'].includes(f.dayStem);
    const isSeasonTu = ['辰', '戌', '丑', '未'].includes(f.monthBranch);
    const tuBranches = f.branches.filter((b) => ['辰', '戌', '丑', '未'].includes(b)).length;
    return isTuMaster && isSeasonTu && tuBranches >= 2;
  },

  // S-SM-089: 主本乘旺格，年主得月乘临官帝旺日主得时乘临官帝旺主本两胜
  'S-SM-089': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const mWang = CHANGSHENG_MAP[yEl]?.includes(f.monthBranch);
    const hWang = CHANGSHENG_MAP[dEl]?.includes(f.hourBranch);
    return Boolean(mWang && hWang);
  },

  // S-SM-090: 主本持印格，年主得月柱纳音印生日本得时柱纳音印生主本持印
  'S-SM-090': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mEl = f.nayins[1]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const hEl = f.nayins[3]?.slice(-1);
    const mYin = SHENG_ELEM[mEl] === yEl;
    const hYin = SHENG_ELEM[hEl] === dEl;
    return Boolean(mYin && hYin);
  },
};
