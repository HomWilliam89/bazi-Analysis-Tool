// 核心/matcher/sanming_jingji.mjs
// 丙层 · 古法三命《兰台妙选》《五行精纪》纳音神机与名格收官定式（S-SM-091～S-SM-120）
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const SANMING_JINGJI_PREDICATES = {
  // S-SM-091: 水居湖海格，水命人生于亥子北方江湖大海之地，无重土填塞汪洋之量
  'S-SM-091': (f) => {
    const isWater = f.nayins[0]?.endsWith('水') || f.nayins[2]?.endsWith('水');
    const inNorthWater = ['亥', '子'].includes(f.monthBranch);
    const tuCount = f.branches.filter((b) => ['辰', '戌', '丑', '未'].includes(b)).length;
    return Boolean(isWater && inNorthWater && tuCount <= 1);
  },

  // S-SM-092: 火震雷霆格，纳音火命人逢卯辰东方雷霆震地，火烈雷惊显烜赫之威
  'S-SM-092': (f) => {
    const isFire = f.nayins[0]?.endsWith('火') || f.nayins[2]?.endsWith('火');
    const hasThunder = f.branches.some((b) => ['卯', '辰'].includes(b));
    const waterBranchCount = f.branches.filter((b) => ['亥', '子'].includes(b)).length;
    return Boolean(isFire && hasThunder && waterBranchCount <= 1);
  },

  // S-SM-093: 德合双鸳格，四柱见双重天干合或两对干支鸳鸯六合，坐槐庭而布政
  'S-SM-093': (f) => {
    let heCount = 0;
    for (let i = 0; i < f.stems.length; i++) {
      for (let j = i + 1; j < f.stems.length; j++) {
        const s1 = f.stems[i];
        const s2 = f.stems[j];
        if (STEM_HE.some(([a, b]) => (a === s1 && b === s2) || (a === s2 && b === s1))) {
          heCount++;
        }
      }
    }
    let zhiHeCount = 0;
    for (let i = 0; i < f.branches.length; i++) {
      for (let j = i + 1; j < f.branches.length; j++) {
        const b1 = f.branches[i];
        const b2 = f.branches[j];
        if (BRANCH_HE.some(([a, b]) => (a === b1 && b === b2) || (a === b2 && b === b1))) {
          zhiHeCount++;
        }
      }
    }
    return heCount >= 2 || zhiHeCount >= 2;
  },

  // S-SM-094: 官星四干格，四柱天干四字皆带正官偏官或官印流通，棘寺输忠执秉法度
  'S-SM-094': (f) => {
    const guanCount = f.exposedTenGods.filter((tg) => ['正官', '七杀'].includes(tg)).length;
    return guanCount >= 2 && !f.exposedTenGods.includes('伤官');
  },

  // S-SM-095: 天关地轴格，戌亥乾天门为天关未申坤地户为地轴，天地并全诗书大显
  'S-SM-095': (f) => {
    const hasTianGuan = f.branches.includes('戌') || f.branches.includes('亥');
    const hasDiZhou = f.branches.includes('未') || f.branches.includes('申');
    return hasTianGuan && hasDiZhou;
  },

  // S-SM-096: 日精月华格，四柱兼备戊午日精太阳与己未月华太阴，动地三台宰辅
  'S-SM-096': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return gzs.includes('戊午') && gzs.includes('己未');
  },

  // S-SM-097: 活禄活马格，日禄与驿马自坐长生帝旺且不逢刑冲死绝，名标麟阁
  'S-SM-097': (f) => Boolean(f.hasLu && f.shenshaList.includes('驿马') && f.chongPairs.length === 0),

  // S-SM-098: 大煞并喜神格，年命亡神劫煞大煞与天乙贵人等吉神同宫，显贵凤池
  'S-SM-098': (f) => Boolean(
    f.shenshaList.includes('天乙贵人')
    && (f.shenshaList.includes('亡神') || f.shenshaList.includes('劫煞')),
  ),

  // S-SM-099: 三元集旺格，干禄支命纳音身三才皆乘临官帝旺生旺正垣，英才出类
  'S-SM-099': (f) => {
    const isStemStrong = f.hasLu || f.hasYangRen || f.branches.some((b) => BRANCH_ELEMENT[b] === f.dayElement);
    if (!isStemStrong) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mB = f.monthBranch;
    return (yEl === '水' && ['亥', '子'].includes(mB))
      || (yEl === '木' && ['寅', '卯'].includes(mB))
      || (yEl === '火' && ['巳', '午'].includes(mB))
      || (yEl === '金' && ['申', '酉'].includes(mB))
      || (yEl === '土' && ['辰', '戌', '丑', '未'].includes(mB));
  },

  // S-SM-100: 四字俱生格，年月日时四柱地支皆乘长生之乡生机盎然，抱出群大器
  'S-SM-100': (f) => f.branches.filter((b) => ['寅', '申', '巳', '亥'].includes(b)).length >= 3,

  // S-SM-101: 桂林凤隐格，辛卯松柏木月桂与酉宫金凤相遇潜藏蓄锐，佩印乘轩
  'S-SM-101': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return gzs.includes('辛卯') && f.branches.includes('酉');
  },

  // S-SM-102: 海藏龙潜格，辰龙遇癸亥北方大海水深居渊潜，蓄德奋飞位至卿相
  'S-SM-102': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return f.branches.includes('辰') && gzs.some((gz) => ['壬戌', '癸亥'].includes(gz));
  },

  // S-SM-103: 三奇会龙虎格，柱带乙丙丁或甲戊庚三奇且地支兼备辰龙与寅虎，叶赞扶持
  'S-SM-103': (f) => {
    const hasSanQi = (f.stems.includes('乙') && f.stems.includes('丙') && f.stems.includes('丁'))
      || (f.stems.includes('甲') && f.stems.includes('戊') && f.stems.includes('庚'))
      || (f.stems.includes('辛') && f.stems.includes('壬') && f.stems.includes('癸'));
    return Boolean(hasSanQi && f.branches.includes('辰') && f.branches.includes('寅'));
  },

  // S-SM-104: 四德见旌旗格，四柱天月德贵人加临于亡神劫煞旌旗之位，藩宣屏翰
  'S-SM-104': (f) => Boolean(
    (f.shenshaList.includes('天德贵人') || f.shenshaList.includes('月德贵人'))
    && (f.shenshaList.includes('亡神') || f.shenshaList.includes('劫煞')),
  ),

  // S-SM-105: 一路连珠格，年月日时地支顺连相承无断缺，早擅四方令誉
  'S-SM-105': (f) => {
    const idxs = f.branches.map((b) => BRANCHES.indexOf(b));
    return idxs.every((val, i, arr) => i === 0 || (val - arr[i - 1] + 12) % 12 === 1);
  },

  // S-SM-106: 蚌珠吸月华格，甲子乙丑海中金逢己未月华太阴见清纯水滋涵，位亟公卿
  'S-SM-106': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasBang = gzs.some((gz) => ['甲子', '乙丑'].includes(gz));
    const hasMoon = gzs.includes('己未');
    const hasWater = f.nayins.some((n) => n?.endsWith('水'));
    return hasBang && hasMoon && hasWater;
  },

  // S-SM-107: 萤火照水滨格，丁卯炉中火或霹雳火照临水滨生于秋季金白水清，贵为卿监
  'S-SM-107': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasFire = gzs.some((gz) => ['丁卯', '戊子', '己丑'].includes(gz));
    const inAutumn = ['申', '酉', '戌'].includes(f.monthBranch);
    const hasWater = f.nayins.some((n) => n?.endsWith('水'));
    return hasFire && inAutumn && hasWater;
  },

  // S-SM-108: 虎卧凤阙格，寅年生人猛虎日时见酉宫凤阙金鸡，附凤攀麟立功廊庙
  'S-SM-108': (f) => f.yearBranch === '寅' && (f.dayBranch === '酉' || f.hourBranch === '酉'),

  // S-SM-109: 鱼跃龙池格，亥年生人日时见辰水库龙池，化龙升天青云稳步
  'S-SM-109': (f) => f.yearBranch === '亥' && (f.dayBranch === '辰' || f.hourBranch === '辰'),

  // S-SM-110: 三奇三合格，柱带乙丙丁或甲戊庚三奇且地支具全三合吉局，邦家柱石
  'S-SM-110': (f) => {
    const hasSanQi = (f.stems.includes('乙') && f.stems.includes('丙') && f.stems.includes('丁'))
      || (f.stems.includes('甲') && f.stems.includes('戊') && f.stems.includes('庚'))
      || (f.stems.includes('辛') && f.stems.includes('壬') && f.stems.includes('癸'));
    const hasSanHe = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']]
      .some((arr) => arr.every((b) => f.branches.includes(b)));
    return Boolean(hasSanQi && hasSanHe);
  },

  // S-SM-111: 五星朝北格，四柱金木水火土五星聚首朝拱北方亥子丑虚斗牛宿，名动缙绅
  'S-SM-111': (f) => {
    const types = new Set(f.nayins.map((n) => n?.slice(-1)).filter(Boolean));
    const hasNorth = f.branches.includes('亥') || f.branches.includes('子');
    const noDou = !f.branches.includes('丑');
    return types.size >= 4 && hasNorth && noDou;
  },

  // S-SM-112: 万派流东格，纳音水命四柱水气奔腾顺行东注卯位雷门，声振天地
  'S-SM-112': (f) => {
    const isWater = f.nayins[0]?.endsWith('水') || f.nayins[2]?.endsWith('水');
    const toEast = f.dayBranch === '卯' || f.hourBranch === '卯';
    const tuCount = f.branches.filter((b) => ['辰', '戌', '丑', '未'].includes(b)).length;
    return Boolean(isWater && toEast && tuCount <= 1);
  },

  // S-SM-113: 墨池泉涌格，甲申乙酉泉中水生于子位墨池之地，文思渊源器识宏深
  'S-SM-113': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasQuan = gzs.some((gz) => ['甲申', '乙酉'].includes(gz));
    const hasChi = f.dayBranch === '子' || f.hourBranch === '子';
    return hasQuan && hasChi;
  },

  // S-SM-114: 学海波深格，纳音水命生于亥子旺水之地且文星学堂相会，才华超卓
  'S-SM-114': (f) => {
    const isWater = f.nayins[0]?.endsWith('水') || f.nayins[2]?.endsWith('水');
    const inWaterMonth = ['亥', '子'].includes(f.monthBranch);
    const hasWen = f.shenshaList.includes('文昌贵人') || f.shenshaList.includes('天乙贵人');
    return Boolean(isWater && inWaterMonth && hasWen);
  },

  // S-SM-115: 乾清坤夷格，天元纯粹清明地支厚重宁静，阳刚阴柔各得其正
  'S-SM-115': (f) => {
    let keCount = 0;
    for (let i = 0; i < f.stems.length; i++) {
      for (let j = i + 1; j < f.stems.length; j++) {
        if (KE_ELEM[STEM_ELEMENT[f.stems[i]]] === STEM_ELEMENT[f.stems[j]]
          || KE_ELEM[STEM_ELEMENT[f.stems[j]]] === STEM_ELEMENT[f.stems[i]]) {
          keCount++;
        }
      }
    }
    return f.chongPairs.length === 0
      && f.chuanPairs.length === 0
      && keCount <= 1;
  },

  // S-SM-116: 天清地实格，四柱天干清朗高秀地支皆有坚固主气本根不浮露，抱负非凡
  'S-SM-116': (f) => f.stems.every((s) => f.branches.some((b) => BRANCH_ELEMENT[b] === STEM_ELEMENT[s])),

  // S-SM-117: 双门夹禄格，日主之禄神得前后两位地支紧密夹卫拱护，位登凤阁鸾台
  'S-SM-117': (f) => {
    const luB = LU_MAP[f.dayStem];
    if (!luB) return false;
    const luIdx = BRANCHES.indexOf(luB);
    const qian = BRANCHES[(luIdx - 1 + 12) % 12];
    const hou = BRANCHES[(luIdx + 1) % 12];
    return f.branches.includes(qian) && f.branches.includes(hou);
  },

  // S-SM-118: 三秀盈门格，天干三透财官印三奇秀气或吉神相会日时，步入玉堂金阙
  'S-SM-118': (f) => {
    const hasCai = f.exposedTenGods.some((t) => ['正财', '偏财'].includes(t));
    const hasGuan = f.exposedTenGods.some((t) => ['正官', '七杀'].includes(t));
    const hasYin = f.exposedTenGods.some((t) => ['正印', '偏印'].includes(t));
    return hasCai && hasGuan && hasYin;
  },

  // S-SM-119: 雷雨迎春格，生于卯辰东方阳春之地柱见水火风雷相迎，草木沾濡生荣
  'S-SM-119': (f) => {
    const inSpring = ['卯', '辰'].includes(f.monthBranch);
    const hasWater = f.nayins.some((n) => n?.endsWith('水'));
    const hasFire = f.nayins.some((n) => n?.endsWith('火'));
    return inSpring && hasWater && hasFire;
  },

  // S-SM-120: 毕乌登日宫格，酉金白乌日时登临午火离明太阳之正位，光彩夺目贵邻五府
  'S-SM-120': (f) => f.yearBranch === '酉' && (f.dayBranch === '午' || f.hourBranch === '午'),
};
