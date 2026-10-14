// 核心/matcher/wangshuai_shenfeng.mjs
// 丙层 · 旺衰扶抑派《神峰通考》动静盖头病药雕枯四病四药特征匹配谓词集 (S-WS-061～S-WS-090)
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const WANGSHUAI_SHENFENG_PREDICATES = {
  // S-WS-061: 天干透露为动动攻为亲切，天干之动只能攻天干之动，不能实攻地支之静
  'S-WS-061': (f) => {
    const stemElems = f.stems.map((s) => STEM_TO_ELEMENT[s]);
    let stemHasKe = false;
    for (let i = 0; i < stemElems.length; i++) {
      for (let j = 0; j < stemElems.length; j++) {
        if (i !== j && KE_ELEM[stemElems[i]] === stemElems[j]) {
          stemHasKe = true;
          break;
        }
      }
      if (stemHasKe) break;
    }
    return Boolean(stemHasKe && f.chongPairs.length === 0);
  },

  // S-WS-062: 地支隐藏为静静攻为亲切，地支之静只能攻地支之静，不能攻天干这动
  'S-WS-062': (f) => {
    if (f.chongPairs.length === 0) return false;
    const stemElems = f.stems.map((s) => STEM_TO_ELEMENT[s]);
    for (let i = 0; i < stemElems.length; i++) {
      for (let j = 0; j < stemElems.length; j++) {
        if (i !== j && KE_ELEM[stemElems[i]] === stemElems[j]) {
          return false;
        }
      }
    }
    return true;
  },

  // S-WS-063: 四库锁钥甚牢藏伏深固，真要辰戌丑未对冲方能开锁出物，它物莫能破
  'S-WS-063': (f) => {
    return f.chongPairs.some(([i, j]) => {
      const b1 = f.branches[i];
      const b2 = f.branches[j];
      return (b1 === '辰' && b2 === '戌') || (b1 === '戌' && b2 === '辰')
        || (b1 === '丑' && b2 === '未') || (b1 === '未' && b2 === '丑');
    });
  },

  // S-WS-064: 盖头为一身之端发见于外，害物露出头面便是动物作害，藏支尚不足畏
  'S-WS-064': (f) => {
    return f.exposedTenGods.some((t) => ['七杀', '伤官', '劫财'].includes(t));
  },

  // S-WS-065: 行运望见喜药盖头便好，地支虽逢忌神亦不能为害
  'S-WS-065': (f) => {
    for (let i = 0; i < 4; i++) {
      const s = f.stems[i];
      const b = f.branches[i];
      const se = STEM_TO_ELEMENT[s];
      const be = BRANCH_TO_ELEMENT[b];
      if (KE_ELEM[se] === be) {
        const tg = safeTenGod(f.dayStem, s);
        if (tg.includes('印') || tg.includes('食') || tg.includes('伤') || tg.includes('比')) {
          return true;
        }
      }
    }
    return false;
  },

  // S-WS-066: 行运逢忌神盖头覆压，坐支虽有吉神亦出头不得不能作福
  'S-WS-066': (f) => {
    for (let i = 0; i < 4; i++) {
      const s = f.stems[i];
      const b = f.branches[i];
      const se = STEM_TO_ELEMENT[s];
      const be = BRANCH_TO_ELEMENT[b];
      if (KE_ELEM[se] === be) {
        const tg = safeTenGod(f.dayStem, s);
        if (tg === '七杀' || tg === '偏印' || tg === '劫财') {
          return true;
        }
      }
    }
    return false;
  },

  // S-WS-067: 官杀司权排门损伤兄弟，月令官杀克身夺气兄寿夭弟难成行
  'S-WS-067': (f) => {
    const mElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const isGuanShaMonth = KE_ELEM[mElem] === f.dayElement;
    const hasExposedGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    return Boolean(isGuanShaMonth && hasExposedGuanSha);
  },

  // S-WS-068: 官杀太重克身救死不赡难生子，必须食神伤官制去官杀方能生子
  'S-WS-068': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官');
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const guanElem = KE_ELEM[f.dayElement] ? Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === f.dayElement) : '';
    const guanPct = pcts[guanElem] || 0;
    return Boolean(hasSha && hasShiShang && guanPct >= 25);
  },

  // S-WS-069: 辰戌丑未四字全犯天地四狱，子嗣难存，若止犯一二字则不畏
  'S-WS-069': (f) => {
    return ['辰', '戌', '丑', '未'].every((b) => f.branches.includes(b));
  },

  // S-WS-070: 有病方为贵无伤不是奇，格中如去病财禄两相随
  'S-WS-070': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    for (const [elem, pct] of Object.entries(pcts)) {
      if (pct >= 32 || f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === elem).length >= 3) {
        const cureElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === elem);
        const cureStems = STEMS.filter((s) => STEM_TO_ELEMENT[s] === cureElem);
        if (f.stems.some((s) => cureStems.includes(s))) {
          return true;
        }
      }
    }
    return false;
  },

  // S-WS-071: 看命下手法先看月令从重者论，偏重成病不可杂览它物
  'S-WS-071': (f) => {
    const mElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    return Boolean(mElem && (pcts[mElem] || 0) >= 36);
  },

  // S-WS-072: 本身病重而得药重，行运复取得其中和，大富大贵之人
  'S-WS-072': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    for (const [elem, pct] of Object.entries(pcts)) {
      if (pct >= 32 || f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === elem).length >= 3) {
        const cureElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === elem);
        if (cureElem && (pcts[cureElem] || 0) >= 20) {
          const cureStems = STEMS.filter((s) => STEM_TO_ELEMENT[s] === cureElem);
          if (f.stems.some((s) => cureStems.includes(s))) {
            return true;
          }
        }
      }
    }
    return false;
  },

  // S-WS-073: 八字纯然无病无起发，财官印身均不旺不弱者终为平常之人
  'S-WS-073': (f) => {
    const pcts = Object.values(f.elemStrength?.percent || f.elemStrength?.percentages || {});
    if (pcts.length < 4) return false;
    return pcts.every((p) => p < 33 && p >= 8);
  },

  // S-WS-074: 玉贵雕琢金贵锻炼，纯然无杂如未琢之玉，八字贵有雕琢去留
  'S-WS-074': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    return Boolean(selfPct >= 35 && (hasGuanSha || hasShiShang));
  },

  // S-WS-075: 贵具有根而枯不贵有苗而枯，弱有根基行官旺财旺地发福无限
  'S-WS-075': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    if (hasGuan && hasCai) return false;
    const hiddenCaiOrGuan = f.branches.some((b) => {
      const g = safeTenGod(f.dayStem, b);
      return g.includes('财') || g.includes('官') || g.includes('杀');
    });
    return Boolean(!hasGuan && hiddenCaiOrGuan);
  },

  // S-WS-076: 旺之病在太过，比劫旺宜官杀制或去财，印太旺宜行财破印
  'S-WS-076': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const yinElem = Object.keys(SHENG_ELEM).find((k) => SHENG_ELEM[k] === f.dayElement);
    const yinPct = pcts[yinElem] || 0;
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    return Boolean((selfPct >= 42 && hasGuanSha) || (yinPct >= 42 && hasCai));
  },

  // S-WS-077: 弱而有根弱不终弱，六阳六阴有临泰遁比之乘，行生旺运可致强
  'S-WS-077': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const hasRoot = f.roots?.dayMaster?.highestTier !== '虚浮无根';
    return Boolean(selfPct <= 20 && selfPct >= 5 && hasRoot);
  },

  // S-WS-078: 损之药损其有余，当权得位不必生扶，木多用金火多用水克制
  'S-WS-078': (f) => {
    const mElem = BRANCH_TO_ELEMENT[f.monthBranch];
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    if (!mElem || (pcts[mElem] || 0) < 35) return false;
    const keM = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === mElem);
    const keStems = STEMS.filter((s) => STEM_TO_ELEMENT[s] === keM);
    return f.stems.some((s) => keStems.includes(s));
  },

  // S-WS-079: 益之药益其不及，水衰木绝庚戊交侵，取印比生助浚源培根
  'S-WS-079': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const hasYinOrBi = f.exposedTenGods.some((t) => t.includes('印') || t.includes('比'));
    return Boolean(selfPct <= 18 && hasYinOrBi);
  },

  // S-WS-080: 六阳生处真为生，六阴死处反为生，生长初萌气弱未可以旺论
  'S-WS-080': (f) => {
    if (['甲', '丙', '戊', '庚', '壬'].includes(f.dayStem)) {
      return Boolean(CHANGSHENG_MAP[f.dayElement]?.includes(f.monthBranch));
    }
    if (f.dayStem === '乙') {
      return f.monthBranch === '亥';
    }
    return false;
  },

  // S-WS-081: 长者生之继长养帝旺方敷，旺地之神与生长不同贵行克抑
  'S-WS-081': (f) => {
    const isYang = ['甲', '丙', '庚', '壬'].includes(f.dayStem);
    if (!isYang) return false;
    const isRenMonth = f.monthBranch === REN_MAP[f.dayStem];
    const hasGuanSha = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return Boolean(isRenMonth && hasGuanSha);
  },

  // S-WS-082: 金旺得火方成器皿，身旺官杀入格纯粹不杂卿相之贵
  'S-WS-082': (f) => {
    if (f.dayElement !== '金') return false;
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const jinPct = pcts['金'] || 0;
    const hasFire = f.exposedTenGods.some((t) => t.includes('官') || t.includes('杀'));
    return Boolean(jinPct >= 30 && hasFire);
  },

  // S-WS-083: 金赖土生土多金埋，身弱印绶重叠反受其害，急须木疏水洗
  'S-WS-083': (f) => {
    if (f.dayElement !== '金') return false;
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    return (pcts['土'] || 0) >= 38;
  },

  // S-WS-084: 金能生水水多金沉，身弱食伤太旺盗泄元真，反受其害
  'S-WS-084': (f) => {
    if (f.dayElement !== '金') return false;
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    return (pcts['水'] || 0) >= 35;
  },

  // S-WS-085: 金能克木木坚金缺，身弱逢财重叠太旺反被相害，富屋贫人
  'S-WS-085': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const caiElem = KE_ELEM[f.dayElement];
    const caiPct = pcts[caiElem] || 0;
    return Boolean(selfPct <= 20 && caiPct >= 38);
  },

  // S-WS-086: 金弱遇火必见销熔，身弱遇官杀剥杂太旺，残疾贫夭之象
  'S-WS-086': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const selfPct = pcts[f.dayElement] || 0;
    const guanElem = Object.keys(KE_ELEM).find((k) => KE_ELEM[k] === f.dayElement);
    const guanPct = pcts[guanElem] || 0;
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    return Boolean(selfPct <= 16 && guanPct >= 38 && noYin);
  },

  // S-WS-087: 强金得水方挫其锋，身弱遇鬼克身得物以化泄其势反凶为吉
  'S-WS-087': (f) => {
    const hasSha = f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官');
    const hasYinOrWater = f.exposedTenGods.some((t) => t.includes('印'))
      || f.branches.some((b) => ['申', '子', '辰'].includes(b));
    return Boolean(hasSha && hasYinOrWater);
  },

  // S-WS-088: 土多火晦日干失明，丙丁火微遇重重厚土晦光，喜木疏土发荣
  'S-WS-088': (f) => {
    if (f.dayElement !== '火') return false;
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const tuPct = pcts['土'] || 0;
    const hasMu = f.exposedTenGods.some((t) => t.includes('印'));
    return Boolean(tuPct >= 32 && hasMu);
  },

  // S-WS-089: 水大木漂漂泊无依，甲乙生逢汪洋巨浪，急须戊戌燥土培根止水
  'S-WS-089': (f) => {
    if (f.dayElement !== '木') return false;
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    return (pcts['水'] || 0) >= 35;
  },

  // S-WS-090: 局中大病得药两两相停，格中去病财禄两相随，造就栋梁大器
  'S-WS-090': (f) => {
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const elems = Object.keys(pcts).filter((e) => pcts[e] >= 25);
    for (const e1 of elems) {
      for (const e2 of elems) {
        if (KE_ELEM[e1] === e2 || KE_ELEM[e2] === e1) {
          return true;
        }
      }
    }
    return false;
  },
};
