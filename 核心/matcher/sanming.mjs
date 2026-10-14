// 核心/matcher/sanming.mjs
// 丙层 · 古法三命学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';
import { SANMING_LANTAI_PREDICATES } from './sanming_lantai.mjs';
import { SANMING_JINGJI_PREDICATES } from './sanming_jingji.mjs';

export const SANMING_PREDICATES = {
  'S-SM-001': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearNayinEl = f.nayins[0]?.slice(-1);
    const dayNayinEl = f.nayins[2]?.slice(-1);
    return Boolean(yearNayinEl && dayNayinEl && yearNayinEl !== dayNayinEl);
  },
  'S-SM-002': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearEl = f.nayins[0]?.slice(-1);
    const dayEl = f.nayins[2]?.slice(-1);
    const sheng = SHENG_ELEM[yearEl] === dayEl || SHENG_ELEM[dayEl] === yearEl;
    return sheng && f.hasLu;
  },
  'S-SM-003': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    return (yEl === '水' && f.branches.some((b) => ['申', '子', '辰', '亥'].includes(b)))
      || (yEl === '火' && f.branches.some((b) => ['寅', '午', '戌', '巳'].includes(b)))
      || (yEl === '木' && f.branches.some((b) => ['亥', '卯', '未', '寅'].includes(b)))
      || (yEl === '金' && f.branches.some((b) => ['巳', '酉', '丑', '申'].includes(b)));
  },
  'S-SM-004': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const tyEl = f.taiyuan?.nayin?.slice(-1);
    const mgEl = f.minggong?.nayin?.slice(-1);
    const tySheng = tyEl && (SHENG_ELEM[tyEl] === yEl || tyEl === yEl);
    const mgSheng = mgEl && (SHENG_ELEM[mgEl] === yEl || mgEl === yEl);
    const others = f.nayins.slice(1).map((n) => n?.slice(-1));
    const pillarSheng = others.some((e) => SHENG_ELEM[e] === yEl);
    return Boolean(tySheng || mgSheng || pillarSheng);
  },
  'S-SM-005': (f) => {
    const hasXiao = f.exposedTenGods.includes('偏印');
    const hasShi = f.exposedTenGods.includes('食神');
    if (!hasXiao || !hasShi || !f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    return SHENG_ELEM[yEl] === dEl || SHENG_ELEM[dEl] === yEl;
  },
  'S-SM-006': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yN = f.nayins[0] || '';
    const dN = f.nayins[2] || '';
    return yN.slice(-1) === dN.slice(-1) || yN === dN;
  },
  'S-SM-007': (f) => f.hasTianYiHuHuan || f.shenshaList.includes('天乙贵人'),
  'S-SM-008': (f) => {
    if (!f.dayGz || !f.nayins) return false;
    const sIdx = STEMS.indexOf(f.dayGz[0]);
    const bIdx = BRANCHES.indexOf(f.dayGz[1]);
    if (sIdx < 0 || bIdx < 0) return false;
    const xunShouBranch = (bIdx - sIdx + 12) % 12;
    if (xunShouBranch === 0 || xunShouBranch === 6) {
      return f.nayins.some((n) => n?.endsWith('水'));
    }
    if (xunShouBranch === 2 || xunShouBranch === 8) {
      return f.nayins.some((n) => n?.endsWith('金'));
    }
    return false;
  },
  'S-SM-009': (f) => (f.branches.includes('辰') && f.branches.includes('巳')) || (f.branches.includes('戌') && f.branches.includes('亥')),
  'S-SM-010': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mEl = f.nayins[1]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const hEl = f.nayins[3]?.slice(-1);
    const monthKe = KE_ELEM[mEl] === yEl;
    const timeSheng = SHENG_ELEM[dEl] === yEl || SHENG_ELEM[hEl] === yEl;
    return monthKe && timeSheng;
  },
  'S-SM-011': (f) => (f.stems.includes('乙') && f.stems.includes('丙') && f.stems.includes('丁'))
    || (f.stems.includes('甲') && f.stems.includes('戊') && f.stems.includes('庚'))
    || (f.stems.includes('辛') && f.stems.includes('壬') && f.stems.includes('癸')),
  'S-SM-012': (f) => ['壬午', '癸巳'].includes(f.dayGz) || ['壬午', '癸巳'].includes(f.yearGz),
  'S-SM-013': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const WANG_BRANCHES = {
      水: ['申', '子', '亥'], 木: ['亥', '卯', '寅'],
      火: ['寅', '午', '巳'], 金: ['巳', '酉', '申'], 土: ['辰', '戌', '丑', '未', '巳', '午'],
    };
    const wb = WANG_BRANCHES[yEl] || [];
    return wb.includes(f.branches[1]) || wb.includes(f.branches[3]);
  },
  'S-SM-014': (f) => {
    if (f.gongJia?.hasGongLu || f.gongJia?.hasGongGui || (f.gongJia?.jiaPairs?.length || 0) > 0) return true;
    const GONG_PAIRS = [
      ['癸亥', '癸丑'], ['癸丑', '癸亥'],
      ['丁巳', '丁未'], ['丁未', '丁巳'],
      ['己巳', '己未'], ['己未', '己巳'],
      ['戊辰', '戊午'], ['戊午', '戊辰'],
    ];
    const hasGongLu = GONG_PAIRS.some(([d, h]) => f.dayGz === d && f.hourGz === h);
    const diff = Math.abs(BRANCHES.indexOf(f.branches[2]) - BRANCHES.indexOf(f.branches[3]));
    return hasGongLu || diff === 2;
  },
  'S-SM-015': (f) => {
    if (f.gongJia?.hasFeiTianDaoChong) return true;
    const noGuanSha = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const branchCounts = {};
    for (const b of f.branches) branchCounts[b] = (branchCounts[b] || 0) + 1;
    const hasMulti = Object.values(branchCounts).some((c) => c >= 2);
    return noGuanSha && hasMulti;
  },
  'S-SM-016': (f) => f.hasTianYiHuHuan,
  'S-SM-017': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yearEl = f.nayins[0]?.slice(-1);
    const dayEl = f.nayins[2]?.slice(-1);
    return KE_ELEM[yearEl] === dayEl || KE_ELEM[dayEl] === yearEl;
  },
  'S-SM-018': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const set = new Set(f.nayins.map((n) => n?.slice(-1)));
    return set.size >= 3;
  },
  'S-SM-019': (f) => f.nayins.some((n) => n.includes('水')) && f.nayins.some((n) => n.includes('火')),
  'S-SM-020': (f) => {
    const isShuiMing = f.nayins && f.nayins[0]?.endsWith('水');
    return Boolean(isShuiMing && (f.branches[2] === '亥' || f.branches[3] === '亥'));
  },
  'S-SM-021': (f) => f.chongPairs.some(([i, j]) => (i === 0 && j === 1) || (i === 2 && j === 3)),
  'S-SM-022': (f) => f.chongPairs.length > 0,
  'S-SM-023': (f) => f.chongPairs.some(([i, j]) => i === 0) || f.branches.slice(1).includes(f.branches[0]),
  'S-SM-024': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const [y, m, d, h] = f.nayins.map((n) => n?.slice(-1));
    return (SHENG_ELEM[y] === m && SHENG_ELEM[m] === d) || (SHENG_ELEM[m] === d && SHENG_ELEM[d] === h);
  },
  'S-SM-025': (f) => {
    const isQuanZhongShui = ['甲申', '乙酉'].includes(f.yearGz);
    const hasTu = f.stems.includes('戊') || f.stems.includes('己') || f.branches.includes('戌') || f.branches.includes('未');
    const hasJin = f.stems.some((s) => ['庚', '辛'].includes(s)) || f.branches.some((b) => ['申', '酉'].includes(b));
    return isQuanZhongShui && !hasTu && hasJin;
  },
  'S-SM-026': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const mEl = f.nayins[1]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const hEl = f.nayins[3]?.slice(-1);
    const isKe = KE_ELEM[mEl] === yEl;
    const isSheng = SHENG_ELEM[dEl] === yEl || SHENG_ELEM[hEl] === yEl;
    return isKe && (isSheng || f.hasTianYiHuHuan || f.shenshaList.includes('天乙贵人'));
  },
  'S-SM-027': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const hasGuan = f.exposedTenGods.includes('正官');
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    const nayinKe = KE_ELEM[dEl] === yEl;
    return hasGuan && nayinKe;
  },
  'S-SM-028': (f) => {
    const checkChongKe = (gzA, gzB) => {
      if (!gzA || !gzB || gzA.length < 2 || gzB.length < 2) return false;
      const bA = gzA[1], bB = gzB[1];
      const sA = gzA[0], sB = gzB[0];
      const isChong = CHONG_DEFS.some(([x, y]) => (bA === x && bB === y) || (bA === y && bB === x));
      const sAEl = STEM_TO_ELEMENT[sA], sBEl = STEM_TO_ELEMENT[sB];
      const isKe = KE_ELEM[sAEl] === sBEl || KE_ELEM[sBEl] === sAEl;
      return isChong && isKe;
    };
    const ty = f.taiyuan?.gz;
    const mg = f.minggong?.gz;
    const hasChongKeTaiMing = checkChongKe(f.dayGz, ty) || checkChongKe(f.hourGz, ty)
      || checkChongKe(f.dayGz, mg) || checkChongKe(f.hourGz, mg);
    return Boolean(hasChongKeTaiMing || f.chongPairs.some(([i, j]) => i === 2 || j === 2 || i === 3 || j === 3));
  },
  'S-SM-029': (f) => {
    if (!f.nayins || f.nayins.length < 3) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const dEl = f.nayins[2]?.slice(-1);
    return KE_ELEM[dEl] === yEl || KE_ELEM[yEl] === dEl;
  },
  'S-SM-030': (f) => f.shenshaList.includes('天乙贵人'),

  // 古法三命《兰台妙选》纳音名格群（批次 C：30 条全量落地 S-SM-031～S-SM-060）
  // S-SM-031: 苍龙驾海格，辰年命得壬戌癸亥大海水，水广龙腾威权万里
  'S-SM-031': (f) => f.yearBranch === '辰'
    && (['壬戌', '癸亥'].includes(f.dayGz) || ['壬戌', '癸亥'].includes(f.hourGz))
    && !f.chongPairs.some(([, , b1, b2]) => ['辰', '戌'].includes(b1) && ['辰', '戌'].includes(b2)),

  // S-SM-032: 朱雀腾空格，午年命或火命见天河水顺引虚空，旌旗翳目执掌兵权
  'S-SM-032': (f) => (f.yearBranch === '午' || f.nayins?.[0]?.endsWith('火'))
    && (['丙午', '丁未'].includes(f.dayGz) || ['丙午', '丁未'].includes(f.hourGz) || f.shenshaList.includes('亡神') || f.shenshaList.includes('劫煞'))
    && !f.branches.includes('子'),

  // S-SM-033: 马化龙驹奔凤阙，午年凡马逢辰支变化为龙驹，器业峥嵘
  'S-SM-033': (f) => f.yearBranch === '午' && (f.dayBranch === '辰' || f.hourBranch === '辰')
    && !f.branches.includes('子'),

  // S-SM-034: 蛇化青龙入天池，巳年生人日时见辰支，长虫化龙功名赫奕
  'S-SM-034': (f) => f.yearBranch === '巳' && (f.dayBranch === '辰' || f.hourBranch === '辰')
    && !f.branches.includes('亥'),

  // S-SM-035: 宝剑冲于牛斗，壬申癸酉剑锋金逢丑宫斗牛之位，锋芒冲霄
  'S-SM-035': (f) => [f.yearGz, f.monthGz, f.dayGz, f.hourGz].some((gz) => ['壬申', '癸酉'].includes(gz))
    && (f.dayBranch === '丑' || f.hourBranch === '丑')
    && !f.branches.includes('未'),

  // S-SM-036: 灵槎入于天河，纳音木命逢丙午丁未天河水，乘槎泛汉通天得贵
  'S-SM-036': (f) => Boolean(f.nayins?.some((n) => n?.endsWith('木')))
    && (['丙午', '丁未'].includes(f.dayGz) || ['丙午', '丁未'].includes(f.hourGz)),

  // S-SM-037: 兔入月宫，卯年生人日时亲见己未柱，玉兔归窟清光四射
  'S-SM-037': (f) => f.yearBranch === '卯' && (f.dayGz === '己未' || f.hourGz === '己未')
    && !f.branches.includes('酉'),

  // S-SM-038: 麟逢凤沼，辰年生人日时见酉宫，龙凤呈祥跨于金牛
  'S-SM-038': (f) => f.yearBranch === '辰' && (f.dayBranch === '酉' || f.hourBranch === '酉')
    && !f.branches.includes('戌'),

  // S-SM-039: 子归母腹，年纳音五行得日时生于长生母宫之位，根基深厚荣庆双亲
  'S-SM-039': (f) => {
    if (!f.nayins || f.nayins.length < 4) return false;
    const yEl = f.nayins[0]?.slice(-1);
    const MU_MAP = { 金: '巳', 水: '申', 木: '亥', 火: '寅', 土: '申' };
    const muBranch = MU_MAP[yEl];
    return Boolean(muBranch && (f.dayBranch === muBranch || f.hourBranch === muBranch));
  },

  // S-SM-040: 水绕花堤，纳音水命逢木局相生或木命生春见水回环，枝荣叶茂休垂后裔
  'S-SM-040': (f) => {
    const isWater = f.nayins?.[0]?.endsWith('水');
    const isWood = f.nayins?.[0]?.endsWith('木');
    if (isWater) {
      return f.nayins.slice(1).some((n) => n?.endsWith('木')) || f.branches.some((b) => ['寅', '卯'].includes(b));
    }
    if (isWood && ['寅', '卯', '辰'].includes(f.monthBranch)) {
      return f.nayins.slice(2).some((n) => n?.endsWith('水'));
    }
    return false;
  },

  // S-SM-041: 藏珠于渊海，癸亥大海水喜逢甲子海中金，深渊聚宝福寿绵长
  'S-SM-041': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return gzs.includes('癸亥') && gzs.includes('甲子');
  },

  // S-SM-042: 月生沧海，己未天上火日时遇酉宫或逢水乡沧海，清光普照
  'S-SM-042': (f) => [f.yearGz, f.dayGz].includes('己未')
    && (f.branches.includes('酉') || f.nayins?.some((n) => n?.endsWith('水'))),

  // S-SM-043: 蚌珠照月，甲子乙丑海中金见未支月宫照映，珠光月色烁众辉腾
  'S-SM-043': (f) => [f.yearGz, f.dayGz].some((gz) => ['甲子', '乙丑'].includes(gz))
    && f.branches.includes('未')
    && !f.chongPairs.some(([, , b1, b2]) => ['丑', '未'].includes(b1) && ['丑', '未'].includes(b2)),

  // S-SM-044: 金马嘶风，午年生人或金命遇巳支巽风顺引，超群卓尔声名远播
  'S-SM-044': (f) => (f.yearBranch === '午' || f.nayins?.[0]?.endsWith('金'))
    && (f.dayBranch === '巳' || f.hourBranch === '巳')
    && !f.branches.includes('亥'),

  // S-SM-045: 桑柳成林，局中同见桑柘木与杨柳木两相并列，干霄蔽日怀任重之才
  'S-SM-045': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasSang = gzs.some((gz) => ['壬子', '癸丑'].includes(gz));
    const hasLiu = gzs.some((gz) => ['壬午', '癸未'].includes(gz));
    return hasSang && hasLiu;
  },

  // S-SM-046: 驾海长虹，丙丁干入于戌亥乾户之乡，五彩腾空壮美非常
  'S-SM-046': (f) => f.stems.some((s) => ['丙', '丁'].includes(s))
    && f.branches.some((b) => ['戌', '亥'].includes(b)),

  // S-SM-047: 啸风猛虎，庚辛干值于辰巳巽宫之位，威震边关百兽慑服
  'S-SM-047': (f) => f.stems.some((s) => ['庚', '辛'].includes(s))
    && f.branches.some((b) => ['辰', '巳'].includes(b)),

  // S-SM-048: 月照寒潭，己未天上火生人日时逢申酉金水寒潭之位，冰壶秋月超凡入圣
  'S-SM-048': (f) => [f.yearGz, f.dayGz].includes('己未')
    && (['申', '酉'].includes(f.dayBranch) || ['申', '酉'].includes(f.hourBranch))
    && !f.stems.includes('戊'),

  // S-SM-049: 龙虎拱门，四柱地支见辰龙与寅虎，虚拱卯位端门得贵
  'S-SM-049': (f) => f.branches.includes('辰') && f.branches.includes('寅')
    && !f.branches.includes('卯')
    && !f.branches.includes('申') && !f.branches.includes('戌'),

  // S-SM-050: 贵人捧印，四柱天乙贵人带正印官星同宫，文占甲科才名早发
  'S-SM-050': (f) => {
    const tianYiBranches = TIANYI_MAP[f.dayStem] || [];
    return [0, 1, 2, 3].some((idx) => {
      const b = f.branches[idx];
      const isGui = tianYiBranches.includes(b);
      const isYin = safeTenGod(f.dayStem, f.stems[idx]) === '正印' || safeTenGod(f.dayStem, f.stems[idx]) === '偏印';
      return isGui && isYin;
    });
  },

  // S-SM-051: 月桂芬芳，己未天上火月华日时逢辛卯松柏木，蟾宫折桂蜚声寰宇
  'S-SM-051': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    return gzs.includes('己未') && gzs.includes('辛卯') && !f.branches.includes('酉');
  },

  // S-SM-052: 拔茅连茹，四柱地支顺次连珠相生相引，气脉不断愈坚愈固
  'S-SM-052': (f) => {
    const bIdxs = f.branches.map((b) => BRANCHES.indexOf(b));
    let isSeq = true;
    for (let i = 0; i < 3; i++) {
      if ((bIdxs[i] + 1) % 12 !== bIdxs[i + 1]) {
        isSeq = false;
        break;
      }
    }
    if (isSeq) return true;
    const bSet = new Set(bIdxs);
    for (let start = 0; start < 12; start++) {
      if (bSet.has(start) && bSet.has((start + 1) % 12) && bSet.has((start + 2) % 12)) return true;
    }
    return false;
  },

  // S-SM-053: 暗灯添油，甲辰乙巳覆灯火见清纯水星相涵相生，添油续焰弥久弥明
  'S-SM-053': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasDeng = gzs.some((gz) => ['甲辰', '乙巳'].includes(gz));
    const hasWater = f.nayins?.slice(2).some((n) => n?.endsWith('水')) || f.stems.some((s) => ['壬', '癸'].includes(s));
    return hasDeng && hasWater;
  },

  // S-SM-054: 金柜藏珠，四柱见辰戌丑未四库之支藏辛金海中金珠玉，深秘富华
  'S-SM-054': (f) => f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b))
    && (f.stems.includes('辛') || [f.yearGz, f.dayGz, f.hourGz].some((gz) => ['甲子', '乙丑'].includes(gz)))
    && f.chongPairs.length === 0,

  // S-SM-055: 灯花拂剑，甲辰乙巳覆灯火与壬申癸酉剑锋金并见，枫宸拂剑显耀勋劳
  'S-SM-055': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasDeng = gzs.some((gz) => ['甲辰', '乙巳'].includes(gz));
    const hasJian = gzs.some((gz) => ['壬申', '癸酉'].includes(gz));
    return hasDeng && hasJian;
  },

  // S-SM-056: 杨柳拖金，壬午癸未杨柳木得庚申辛酉或庚辛带金，柔木带金富贵多娇
  'S-SM-056': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasLiu = gzs.some((gz) => ['壬午', '癸未'].includes(gz));
    const hasJin = f.stems.some((s) => ['庚', '辛'].includes(s)) || gzs.some((gz) => ['庚申', '辛酉'].includes(gz));
    return hasLiu && hasJin;
  },

  // S-SM-057: 苍松冬秀，庚寅辛卯松柏木生于冬月水旺之令，傲雪凌霜贞白坚固
  'S-SM-057': (f) => {
    const gzs = [f.yearGz, f.monthGz, f.dayGz, f.hourGz];
    const hasSong = gzs.some((gz) => ['庚寅', '辛卯'].includes(gz));
    return hasSong && ['亥', '子', '丑'].includes(f.monthBranch);
  },

  // S-SM-058: 拱揖端门，四柱地支虚拱卯位端门或坎离子午朝拱正位，位至卿相
  'S-SM-058': (f) => (f.branches.includes('寅') && f.branches.includes('辰') && !f.branches.includes('卯'))
    || (f.branches.includes('子') && f.branches.includes('午') && f.chongPairs.length === 0),

  // S-SM-059: 扶桑出日，戊午天上火见巳午离明之乡，光被四表德照黎元
  'S-SM-059': (f) => [f.yearGz, f.monthGz, f.dayGz, f.hourGz].includes('戊午')
    && (f.monthBranch === '巳' || f.hourBranch === '午'),

  // S-SM-060: 一旬包裹，四柱年月日时干支俱在同单一旬之中，独操千里之权
  'S-SM-060': (f) => {
    const xunShous = [0, 1, 2, 3].map((idx) => {
      const s = STEMS.indexOf(f.stems[idx]);
      const b = BRANCHES.indexOf(f.branches[idx]);
      return (b - s + 12) % 12;
    });
    return xunShous.every((x) => x === xunShous[0]);
  },

  ...SANMING_LANTAI_PREDICATES,
  ...SANMING_JINGJI_PREDICATES,
};
