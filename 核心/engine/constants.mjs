/**
 * 排盘底座基础物理常量与纯函数（单向沉底）
 * 依据：《规矩/宪法.md》《规矩/体用路线法.md》
 * 零业务依赖，彻底打破 engine 与 tiyong 循环依赖
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const ELEMENTS = ['木', '火', '土', '金', '水'];

/** 天干五行 (index = 干序) */
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // 甲乙木 丙丁火 戊己土 庚辛金 壬癸水
/** 天干阴阳：阳=true */
export const STEM_YANG = [true, false, true, false, true, false, true, false, true, false];
/** 地支五行 */
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
//   子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水
/** 地支阴阳（体） */
const BRANCH_YANG = [true, false, true, false, true, false, true, false, true, false, true, false];
/** 地支生肖 */
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/**
 * 地支藏干（本气 / 中气 / 余气）。
 * 依据《三命通会·论支中人元》《渊海子平》通行说法：
 *   子：癸                          丑：己 癸 辛
 *   寅：甲 丙 戊                    卯：乙
 *   辰：戊 乙 癸                    巳：丙 庚 戊
 *   午：丁 己                       未：己 丁 乙
 *   申：庚 壬 戊                    酉：辛
 *   戌：戊 辛 丁                    亥：壬 甲
 * weight 为经验权重（本气 0.6 / 中气 0.3 / 余气 0.1 量级），仅供力量参考。
 */
export const HIDDEN_STEMS_SPEC = [
  /* 子 */ [['癸', '本', 0.60]],
  /* 丑 */ [['己', '本', 0.36], ['癸', '中', 0.14], ['辛', '余', 0.10]],
  /* 寅 */ [['甲', '本', 0.36], ['丙', '中', 0.14], ['戊', '余', 0.10]],
  /* 卯 */ [['乙', '本', 0.60]],
  /* 辰 */ [['戊', '本', 0.36], ['乙', '中', 0.14], ['癸', '余', 0.10]],
  /* 巳 */ [['丙', '本', 0.36], ['庚', '中', 0.14], ['戊', '余', 0.10]],
  /* 午 */ [['丁', '本', 0.42], ['己', '中', 0.18]],
  /* 未 */ [['己', '本', 0.36], ['丁', '中', 0.14], ['乙', '余', 0.10]],
  /* 申 */ [['庚', '本', 0.36], ['壬', '中', 0.14], ['戊', '余', 0.10]],
  /* 酉 */ [['辛', '本', 0.60]],
  /* 戌 */ [['戊', '本', 0.36], ['辛', '中', 0.14], ['丁', '余', 0.10]],
  /* 亥 */ [['壬', '本', 0.42], ['甲', '中', 0.18]],
];

/** 节气名（小寒起，与黄经 285° 对应） */
export const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];
/** 节气对应太阳黄经（度），index 同 SOLAR_TERMS */
const TERM_LONGITUDE = SOLAR_TERMS.map((_, i) => (285 + i * 15) % 360);

/* ------------------------------------------------------------------ *
 * 二、六十甲子 / 纳音
 * ------------------------------------------------------------------ */

/** 纳音五行名（30 项，每项管两个干支） */
const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
  '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
  '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木',
  '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];
/** 纳音所属五行 */
const NAYIN_ELEMENT = [
  '金', '火', '木', '土', '金', '火', '水', '土', '金', '木',
  '水', '土', '火', '木', '水', '金', '火', '木', '土', '金',
  '火', '水', '土', '金', '木', '水', '土', '火', '木', '水',
];

/** 干支序 (0-59) */
export function gzIndex(stemIndex, branchIndex) {
  // 解同余方程：x ≡ stemIndex (mod 10), x ≡ branchIndex (mod 12)
  for (let x = 0; x < 60; x++) if (x % 10 === stemIndex && x % 12 === branchIndex) return x;
  throw new Error(`非法干支组合：${STEMS[stemIndex]}${BRANCHES[branchIndex]}（阴阳不配）`);
}
/** 由干支序取干支名 */
export function gzName(index) {
  const i = ((index % 60) + 60) % 60;
  return STEMS[i % 10] + BRANCHES[i % 12];
}
/** 六十甲子干支全表 */
export const GANZHI = Array.from({ length: 60 }, (_, i) => gzName(i));
/** 校验是否为合法六十甲子干支（阴阳相配且长度为2） */
export function isValidGanzhi(gz) {
  if (typeof gz !== 'string' || gz.length !== 2) return false;
  return GANZHI.includes(gz);
}
/** 纳音 */
export function nayinOf(index) {
  const i = ((index % 60) + 60) % 60;
  const g = Math.floor(i / 2);
  return { name: NAYIN[g], element: NAYIN_ELEMENT[g] };
}
/** 旬首与旬空（空亡） */
export function xunOf(index) {
  const i = ((index % 60) + 60) % 60;
  const head = i - (i % 10);
  const voidBranches = [BRANCHES[(head + 10) % 12], BRANCHES[(head + 11) % 12]];
  return { xun: gzName(head), xunHead: head, voidBranches };
}

/* ------------------------------------------------------------------ *
 * 三、十神
 * ------------------------------------------------------------------ */

const TEN_GOD_NAMES = {
  same: ['比肩', '劫财'],
  output: ['食神', '伤官'],
  wealth: ['偏财', '正财'],
  power: ['七杀', '正官'],
  resource: ['偏印', '正印'],
};
// 五行相生环：木(0) → 火(1) → 土(2) → 金(3) → 水(4) → 木，供十神推算使用。
// 相克在环上隔一位（走两步），但此处不据此推导——十神用的是下面的 KE 常量。
const ELEMENT_CYCLE = [1, 2, 3, 4, 0];
const SHENG = ELEMENT_CYCLE;                                        // 我生者
const KE = [2, 3, 4, 0, 1];                                         // 我克者：木克土 火克金 土克水 金克木 水克火

/**
 * 十神：以日主为我，判断某干的十神。
 * @param {number} dayStemIndex 日干序
 * @param {number} otherStemIndex 他干序
 * @returns {string} 十神名
 */
export function tenGod(dayStemIndex, otherStemIndex) {
  const me = STEM_ELEMENT[dayStemIndex];
  const other = STEM_ELEMENT[otherStemIndex];
  const samePolarity = STEM_YANG[dayStemIndex] === STEM_YANG[otherStemIndex];
  let rel;
  // 顺序要紧：生我(印)必须先于克我(官杀)判断——凡生我者必非克我者，
  // 但若先判克我，则"生我"与"同我/我生/我克"之外的一切都会落进最后一个分支。
  if (me === other) rel = 'same';
  else if (SHENG[me] === other) rel = 'output';   // 我生者：食伤
  else if (KE[me] === other) rel = 'wealth';      // 我克者：财
  else if (SHENG[other] === me) rel = 'resource'; // 生我者：印
  else rel = 'power';                             // 克我者：官杀
  return TEN_GOD_NAMES[rel][samePolarity ? 0 : 1];
}

/* ------------------------------------------------------------------ *
 * 四、十二长生（星运 / 自坐）
 * ------------------------------------------------------------------ */

const TWELVE_STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

/**
 * 十二长生：某天干在某地支的"星运"。
 * 阳干顺行、阴干逆行；长生位（地支序，子=0）：
 *   甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
 * 戊从丙、己从丁。
 */
const CHANGSHENG_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
export function twelveStage(stemIndex, branchIndex) {
  const start = CHANGSHENG_START[stemIndex];
  const forward = STEM_YANG[stemIndex];
  const offset = forward
    ? ((branchIndex - start) % 12 + 12) % 12
    : ((start - branchIndex) % 12 + 12) % 12;
  return TWELVE_STAGES[offset];
}

export const LUSHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
/** 暗禄（日干正禄之地支六合神：《三命通会》《渊海子平》） */
export const ANLU = { 甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申', 己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑' };
/** 七大暗禄日（日干自坐暗禄：《三命通会》） */
export const ANLU_DAY_GZ = ['乙戌', '丙申', '丁未', '戊申', '己未', '壬寅', '癸丑'];

const SHIE_DABAI_GZ = ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '戊戌', '癸亥', '辛巳', '己丑', '庚辰'];
/** 阴差阳错日 */
const YINCHAYANGCUO_GZ = ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'];

/** 十二神煞（以日干起长生，顺逆排） */
const SHIER_SHENSHA = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

export const SHENG_MAP = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生者
export const KE_MAP = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };    // 我克者
/** 元素名表，编号与 STEM_ELEMENT / BRANCH_ELEMENT 一致 */
const ELEMENT_OF_INDEX = ['木', '火', '土', '金', '水'];
/** 按编号取"我生 / 我克"，由上面两张名表导出 */
const SHENG_IDX = ELEMENT_OF_INDEX.map((e) => ELEMENT_OF_INDEX.indexOf(SHENG_MAP[e]));
const KE_IDX = ELEMENT_OF_INDEX.map((e) => ELEMENT_OF_INDEX.indexOf(KE_MAP[e]));

export function nayinByShu(stem, branch) {
  const si = STEMS.indexOf(String(stem));
  const bi = BRANCHES.indexOf(String(branch));
  if (si < 0 || bi < 0) return null;
  if (si % 2 !== bi % 2) return null;                       // 阴阳不配者非六十甲子
  const idx = gzIndex(si, bi);
  if (idx < 0) return null;
  const pairStart = idx - (idx % 2);                        // 同纳音对的前一柱（六十甲子序号）
  const i2 = pairStart + 1;
  // ★ 柱 i 的天干序号是 i%10、地支序号是 i%12（不是 floor 关系）
  const s1 = pairStart % 10, b1 = pairStart % 12;
  const s2 = i2 % 10, b2 = i2 % 12;
  // ★ 干与支的分组方式不同：干**隔一位**成组（甲己同9），支**相邻**成组（子丑为9、8）
  const STEM_VAL = (si) => 9 - (si % 5);             // 甲9 乙8 丙7 丁6 戊5 ／ 己9 庚8 辛7 壬6 癸5
  const BRANCH_VAL = (bi) => 9 - (bi % 6);           // 子9 丑8 寅7 卯6 辰5 巳4 ／ 午9 未8 申7 酉6 戌5 亥4
  const sv = STEM_VAL(s1);
  const bv = BRANCH_VAL(b1);
  const sv2 = STEM_VAL(s2);
  const bv2 = BRANCH_VAL(b2);
  const 数 = sv + bv + sv2 + bv2;                           // 两柱合计
  const 余数 = ((数 - 1) % 5) + 1;                          // 1..5（余 0 归一为 5）
  const 实测映射 = { 1: '火', 2: '土', 3: '木', 4: '金', 5: '水' };
  const 古典序列 = { 1: '水', 2: '火', 3: '木', 4: '金', 5: '土' };   // 「一水二火三木四金五土」
  const 五行 = 实测映射[余数];
  const 表值 = nayinOf(idx).element;
  return {
    五行,
    数,
    余数,
    两柱: STEMS[s1] + BRANCHES[b1] + STEMS[s2] + BRANCHES[b2],
    支干数: {
      [STEMS[s1]]: sv, [BRANCHES[b1]]: bv, [STEMS[s2]]: sv2, [BRANCHES[b2]]: bv2,
    },
    算法: `${STEMS[s1]}${BRANCHES[b1]}${STEMS[s2]}${BRANCHES[b2]}　支干数 `
      + `${sv}+${bv}+${sv2}+${bv2}＝${数}；除六五（五的倍数）余 ${余数}`
      + `；余数配五行（**实测反推**，非古典那句）→ **${五行}**`,
    与纳音表一致: 五行 === 表值,
    表值,
    校验: `唐代算法与纳音表${五行 === 表值 ? '一致 ✓' : '不一致 ✗'}`
      + '（全表 30 组／60 柱已由 nayinTableCheck() 逐一复核，0 不一致）',
    古典异说: {
      余数配五行_古典: 古典序列[余数],
      与实测是否相同: 古典序列[余数] === 五行,
      注: '古典「一水二火三木四金五土」（＝《命理探源》引《瑞桂堂暇录》'
        + '「一六为水、二七为火、三八为木、四九为金、五十为土」）与实测反推'
        + '**只在余 3、4 两处相同**。引擎**以实测为准**（只有它能使 60/60 复现纳音表'
        + '且八组原文例证逐一吻合），但**不代为调和**，两说并列。',
    },
    生成元: {
      两柱合计: `必须两柱（原文例证皆作「${STEMS[s1]}${BRANCHES[b1]}${STEMS[s2]}${BRANCHES[b2]}共得${数}之数」）；单柱法只能对上 24/60`,
      取值周期: '干 9−(序号%5)、支 9−(序号%6)；两处周期不同，写成同一个会各错一半',
    },
  };
}

/** 五行的「五行寄生十二宫」代表天干（阳干）。生旺库与天干阴阳无关。 */
const ELEMENT_REP_STEM = { 木: '甲', 火: '丙', 土: '戊', 金: '庚', 水: '壬' };

/** 某五行在某地支的十二宫位（五行层面，用阳干查，故甲与乙的生旺库相同）。 */
export function elementBranchStage(element, branchIndex) {
  const rep = ELEMENT_REP_STEM[element];
  if (!rep) return null;
  return twelveStage(STEMS.indexOf(rep), branchIndex);
}

/** 生／旺／库三态：三合局的 长生→生、帝旺→旺、墓→库；其余不入三态。 */
function sanTai(stage) {
  if (stage === '长生') return '生';
  if (stage === '帝旺') return '旺';
  if (stage === '墓') return '库';
  return null;
}

export function nayinTableCheck() {
  const bad = [];
  let 组数 = 0;
  // ★ 逐**组**（两柱）校验，不是逐柱：唐算法以两柱合计数定音，
  //   同组两柱共享一个纳音，故每组只取前一柱调用 nayinByShu。
  for (let g = 0; g < 30; g++) {
    const i1 = g * 2;
    const 组 = STEMS[i1 % 10] + BRANCHES[i1 % 12] + STEMS[(i1 + 1) % 10] + BRANCHES[(i1 + 1) % 12];
    const byShu = nayinByShu(STEMS[i1 % 10], BRANCHES[i1 % 12]);
    const 表1 = nayinOf(i1).element;
    const 表2 = nayinOf(i1 + 1).element;
    组数++;
    if (!byShu || byShu.五行 !== 表1 || 表1 !== 表2) {
      bad.push({ 组, 表: 表1 === 表2 ? 表1 : `${表1}/${表2}`, 唐算法: byShu ? byShu.五行 : null, 数: byShu ? byShu.数 : null });
    }
  }
  return {
    通过: bad.length === 0,
    检验组数: 组数,
    检验柱数: 60,
    不一致: bad,
    说明: bad.length === 0
      ? '**唐代「支干数（两柱）→ 除六五 → 余数配五行」算法'
        + '与引擎纳音表逐组一致（30 组／60 柱，0 不一致）**，故纳音表可信、算法亦可独立使用。'
        + '八组原文例证（甲子乙丑34→金、丙子丁丑30→水、戊子己丑31→火、庚子辛丑32→土、'
        + '壬子癸丑28→木、戊辰己巳23→木、庚午辛未32→土、甲申乙酉30→水）**逐一吻合**。'
      : '★ 发现不一致，须逐条核对：表可能错，或算法理解有误。',
    余数配五行: '余1→火　2→土　3→木　4→金　5→水（**实测反推，唯一自洽，0 冲突**；'
      + '与古典「一水二火三木四金五土」只在余 3、4 相同，两说并列见 nayinByShu().古典异说）',
    生成元提醒: '两柱合计；干 9−(序号%5)、支 9−(序号%6)。两处周期不同，且必须两柱——'
      + '单柱法只能对上 24/60。',
    据: '《李虚中命书》卷中原文八组例证；《命理探源》引《瑞桂堂暇录》；均见 knowledge/',
  };
}

export function 五行字(x) {
  if (x == null) return null;
  const s = String(x).trim();
  if (!s) return null;
  if (ELEMENTS.includes(s)) return s;
  const c0 = s[0];
  const si = STEMS.indexOf(c0);
  if (si >= 0) return ELEMENTS[STEM_ELEMENT[si]];
  const bi = BRANCHES.indexOf(s.length > 1 ? s[1] : c0);
  if (bi >= 0) return ELEMENTS[BRANCH_ELEMENT[bi]];
  return null;
}

export {
  BRANCH_YANG, ZODIAC, TERM_LONGITUDE, NAYIN, NAYIN_ELEMENT,
  TEN_GOD_NAMES, ELEMENT_CYCLE, SHENG, KE, TWELVE_STAGES, CHANGSHENG_START,
  SHIE_DABAI_GZ, YINCHAYANGCUO_GZ, SHIER_SHENSHA,
  ELEMENT_OF_INDEX, SHENG_IDX, KE_IDX, ELEMENT_REP_STEM, sanTai,
};
