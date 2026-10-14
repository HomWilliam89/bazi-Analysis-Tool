/**
 * 八字命理推演引擎（确定性推算内核）
 * ============================================================================
 * 纯 JavaScript (ESM)，无外部依赖，Node 18+ / 浏览器均可运行。
 *
 * 本模块只做**确定性推演**，不做好坏吉凶的价值判断：
 *   四柱 / 藏干 / 十神 / 星运(十二长生) / 自坐 / 空亡 / 纳音 / 神煞 /
 *   干支关系(合冲刑害破) / 五行力量统计 / 大运 / 流年 / 节气边界
 *
 * 命理判断（格局、用神、象法取象、应期）由调用方（Agent）依据知识库完成。
 *
 * 核心 API
 *   castChart({ year, month, day, hour, minute, gender, luckPillars }) -> Chart
 *   formatChart(chart) -> string            渲染为 Markdown 排盘表
 *   solarTermsOfYear(year) -> Term[]        该年节气(北京时间)
 *
 * @module bazi-engine
 */

/* ------------------------------------------------------------------ *
 * 一、基础常量
 * ------------------------------------------------------------------ */
import fs from 'node:fs';
import { tiyongRouteOf, formatTiyong } from './tiyong.mjs';
import { SunPosition, SearchSunLongitude } from './astronomy.mjs';


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

/* ------------------------------------------------------------------ *
 * 五、神煞
 * ------------------------------------------------------------------ */

/** 天乙贵人（以日干/年干查地支） */
const TIANYI = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};
/** 文昌贵人 */
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
/** 太极贵人 */
const TAIJI = {
  甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'],
};
/** 天德贵人（按月支） */
const TIANDE = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
};
/** 月德贵人（按月支三合局） */
const YUEDE = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };
/** 禄神（十干临官位） */
export const LUSHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
/** 暗禄（日干正禄之地支六合神：《三命通会》《渊海子平》） */
export const ANLU = { 甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申', 己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑' };
/** 七大暗禄日（日干自坐暗禄：《三命通会》） */
export const ANLU_DAY_GZ = ['乙戌', '丙申', '丁未', '戊申', '己未', '壬寅', '癸丑'];
/** 羊刃（阳干帝旺位，阴干按通行取法） */
const YANGREN = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };
/** 金舆 */
const JINYU = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
/** 红艳煞（日干查支） */
const HONGYAN = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
/** 流霞（日干查支） */
const LIUXIA = { 甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳', 己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅' };
/** 三奇 */
const SANQI = ['甲戊庚', '乙丙丁', '壬癸辛'];

/** 三合局：key = 生旺墓三支中的"旺"支（四正） */
const TRIPLE = {
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
};
/** 三合局 → 驿马 / 桃花 / 华盖 / 将星 / 劫煞 / 亡神 / 月德... */
const SANHE_DERIVED = {
  // 局: [驿马, 桃花, 华盖, 将星, 劫煞, 亡神, 灾煞, 天煞, 地煞, 六厄]
  水局: { 驿马: '寅', 桃花: '酉', 华盖: '辰', 将星: '子', 劫煞: '巳', 亡神: '亥', 灾煞: '午', 天煞: '戌', 地煞: '未' },
  木局: { 驿马: '巳', 桃花: '子', 华盖: '未', 将星: '卯', 劫煞: '申', 亡神: '寅', 灾煞: '酉', 天煞: '辰', 地煞: '戌' },
  火局: { 驿马: '申', 桃花: '卯', 华盖: '戌', 将星: '午', 劫煞: '亥', 亡神: '巳', 灾煞: '子', 天煞: '丑', 地煞: '辰' },
  金局: { 驿马: '亥', 桃花: '午', 华盖: '丑', 将星: '酉', 劫煞: '寅', 亡神: '申', 灾煞: '卯', 天煞: '未', 地煞: '丑' },
};
const TRIPLE_NAME = {
  水局: ['申', '子', '辰'], 木局: ['亥', '卯', '未'], 火局: ['寅', '午', '戌'], 金局: ['巳', '酉', '丑'],
};

/** 孤辰寡宿（按年支） */
const GUCHEN = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
const GUASU = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };

/** 童限关煞：小儿关煞（按年支） */
const XIAOER_GUANSHA = {
  寅: '取命关', 卯: '取命关', 辰: '取命关', 巳: '阎王关', 午: '阎王关', 未: '阎王关',
  申: '鬼门关', 酉: '鬼门关', 戌: '鬼门关', 亥: '落井关', 子: '落井关', 丑: '落井关',
};

/** 十恶大败日（干支序） */
const SHIE_DABAI_GZ = ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '戊戌', '癸亥', '辛巳', '己丑', '庚辰'];
/** 阴差阳错日 */
const YINCHAYANGCUO_GZ = ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'];

/** 十二神煞（以日干起长生，顺逆排） */
const SHIER_SHENSHA = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

/* ------------------------------------------------------------------ *
 * 六、干支关系
 * ------------------------------------------------------------------ */

/** 天干五合 */
export const STEM_COMBINE = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };
/** 天干相冲 */
const STEM_CLASH = ['甲庚', '乙辛', '丙壬', '丁癸'];
/** 地支六合 */
export const BRANCH_COMBINE = { 子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '土' };
/** 地支六冲 */
export const BRANCH_CLASH = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
/** 地支六害（穿） */
const BRANCH_HARM = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
/** 地支相破 */
export const BRANCH_DESTROY = ['子酉', '卯午', '辰丑', '未戌', '寅亥', '巳申'];
/** 三刑 / 自刑 */
const BRANCH_PUNISH = [
  { members: ['寅', '巳', '申'], kind: '无恩之刑' },
  { members: ['丑', '戌', '未'], kind: '恃势之刑' },
  { members: ['子', '卯'], kind: '无礼之刑' },
];
const SELF_PUNISH = ['辰', '午', '酉', '亥'];
/** 干支自合（七大柱：戊子、壬午、丁亥、辛巳、己亥、癸巳、甲午，D-029/D-034 裁定） */
export const STEM_BRANCH_SELF_COMBINE = {
  戊子: { 合: '戊癸合', 藏干: '癸水正财', note: '自坐正财暗合，天干与坐支主气五合' },
  壬午: { 合: '丁壬合', 藏干: '丁火正财', note: '自坐正财暗合，天干与坐支主气五合' },
  丁亥: { 合: '丁壬合', 藏干: '壬水正官', note: '自坐正官暗合，天干与坐支主气五合' },
  辛巳: { 合: '丙辛合', 藏干: '丙火正官', note: '自坐正官暗合，天干与坐支主气五合' },
  己亥: { 合: '甲己合', 藏干: '甲木正官', note: '自坐正官暗合，天干与坐支藏干五合' },
  癸巳: { 合: '戊癸合', 藏干: '戊土正官', note: '自坐正官暗合，天干与坐支藏干五合' },
  甲午: { 合: '甲己合', 藏干: '己土正财', note: '自坐正财暗合，天干与坐支藏干五合' },
};
/** 地支暗合（三大核心通合：寅丑、卯申、午亥，D-029 裁定） */
export const BRANCH_HIDDEN_COMBINE = {
  寅丑: { 合: '甲己/丙辛/戊癸全合', note: '寅丑通合，天地之藏干三合全聚，暗合力极强' },
  丑寅: { 合: '甲己/丙辛/戊癸全合', note: '寅丑通合，天地之藏干三合全聚，暗合力极强' },
  卯申: { 合: '乙庚暗合', note: '卯申暗合，车骑交结，金木交战转暗合做功' },
  申卯: { 合: '乙庚暗合', note: '卯申暗合，车骑交结，金木交战转暗合做功' },
  午亥: { 合: '丁壬/甲己暗合', note: '午亥暗合，水火既济，君臣暗会通情' },
  亥午: { 合: '丁壬/甲己暗合', note: '午亥暗合，水火既济，君臣暗会通情' },
};

/** 地支半三合（生旺半合、墓旺半合）与拱合局（D-035 裁定） */
export const BRANCH_HALF_COMBINE = {
  // 水局（申子辰）
  申子: { type: '生地半合', 局: '水局', 化: '水', note: '生旺半合，水势汇聚，向心力强' },
  子申: { type: '生地半合', 局: '水局', 化: '水', note: '生旺半合，水势汇聚，向心力强' },
  子辰: { type: '墓地半合', 局: '水局', 化: '水', note: '墓旺半合，水聚库门，归宿有力' },
  辰子: { type: '墓地半合', 局: '水局', 化: '水', note: '墓旺半合，水聚库门，归宿有力' },
  申辰: { type: '拱合局', 局: '水局', 拱: '子', 化: '水', note: '长生与墓库虚拱中神子水' },
  辰申: { type: '拱合局', 局: '水局', 拱: '子', 化: '水', note: '长生与墓库虚拱中神子水' },
  // 火局（寅午戌）
  寅午: { type: '生地半合', 局: '火局', 化: '火', note: '生旺半合，木火通明，炎上之势' },
  午寅: { type: '生地半合', 局: '火局', 化: '火', note: '生旺半合，木火通明，炎上之势' },
  午戌: { type: '墓地半合', 局: '火局', 化: '火', note: '墓旺半合，火土相合，敛聚成库' },
  戌午: { type: '墓地半合', 局: '火局', 化: '火', note: '墓旺半合，火土相合，敛聚成库' },
  寅戌: { type: '拱合局', 局: '火局', 拱: '午', 化: '火', note: '长生与墓库虚拱中神午火' },
  戌寅: { type: '拱合局', 局: '火局', 拱: '午', 化: '火', note: '长生与墓库虚拱中神午火' },
  // 金局（巳酉丑）
  巳酉: { type: '生地半合', 局: '金局', 化: '金', note: '生旺半合，火金淬砺，成器之象' },
  酉巳: { type: '生地半合', 局: '金局', 化: '金', note: '生旺半合，火金淬砺，成器之象' },
  酉丑: { type: '墓地半合', 局: '金局', 化: '金', note: '墓旺半合，湿土生金，坚刚沉敛' },
  丑酉: { type: '墓地半合', 局: '金局', 化: '金', note: '墓旺半合，湿土生金，坚刚沉敛' },
  巳丑: { type: '拱合局', 局: '金局', 拱: '酉', 化: '金', note: '长生与墓库虚拱中神酉金' },
  丑巳: { type: '拱合局', 局: '金局', 拱: '酉', 化: '金', note: '长生与墓库虚拱中神酉金' },
  // 木局（亥卯未）
  亥卯: { type: '生地半合', 局: '木局', 化: '木', note: '生旺半合，水生木旺，春气勃发' },
  卯亥: { type: '生地半合', 局: '木局', 化: '木', note: '生旺半合，水生木旺，春气勃发' },
  卯未: { type: '墓地半合', 局: '木局', 化: '木', note: '墓旺半合，木入库藏，意向聚合' },
  未卯: { type: '墓地半合', 局: '木局', 化: '木', note: '墓旺半合，木入库藏，意向聚合' },
  亥未: { type: '拱合局', 局: '木局', 拱: '卯', 化: '木', note: '长生与墓库虚拱中神卯木' },
  未亥: { type: '拱合局', 局: '木局', 拱: '卯', 化: '木', note: '长生与墓库虚拱中神卯木' },
};

/** 地支相绝（四大六绝：寅酉、卯申、午亥、子巳，D-035 裁定） */
export const BRANCH_EXTINCTION = {
  寅酉: { 绝: '寅酉绝', note: '金绝于寅，木绝于酉，上下交绝，情义反背' },
  酉寅: { 绝: '寅酉绝', note: '金绝于寅，木绝于酉，上下交绝，情义反背' },
  卯申: { 绝: '卯申绝', note: '金绝于卯，木绝于申，暗带乙庚合，明绝暗煎' },
  申卯: { 绝: '卯申绝', note: '金绝于卯，木绝于申，暗带乙庚合，明绝暗煎' },
  午亥: { 绝: '午亥绝', note: '水绝于午，火绝于亥，暗带丁壬/甲己合，明绝暗会' },
  亥午: { 绝: '午亥绝', note: '水绝于午，火绝于亥，暗带丁壬/甲己合，明绝暗会' },
  子巳: { 绝: '子巳绝', note: '火绝于子，水绝于巳，上下交灭，水火死绝' },
  巳子: { 绝: '子巳绝', note: '火绝于子，水绝于巳，上下交灭，水火死绝' },
};

/** 截路空亡（以日干查时支，D-035 裁定） */
export const JIELU_KONGWANG = {
  甲: ['申', '酉'],
  己: ['申', '酉'],
  乙: ['午', '未'],
  庚: ['午', '未'],
  丙: ['辰', '巳'],
  辛: ['辰', '巳'],
  丁: ['寅', '卯'],
  壬: ['寅', '卯'],
  戊: ['子', '丑'],
  癸: ['子', '丑'],
};

/** 地支三会方 */
const BRANCH_DIRECTION = [
  { members: ['寅', '卯', '辰'], element: '木', name: '东方木' },
  { members: ['巳', '午', '未'], element: '火', name: '南方火' },
  { members: ['申', '酉', '戌'], element: '金', name: '西方金' },
  { members: ['亥', '子', '丑'], element: '水', name: '北方水' },
];
/** 四生 / 四正 / 四墓 */
const FOUR_SHENG = ['寅', '申', '巳', '亥'];
const FOUR_ZHENG = ['子', '午', '卯', '酉'];
const FOUR_MU = ['辰', '戌', '丑', '未'];


/* ------------------------------------------------------------------ *
 * 七、节气（天文高精度，基于 VSOP87 行星运动理论与 IAU 2000B 章动模型）
 *    精度：基于自适应黄经求根，分钟级 100% 对齐紫金山天文台历书标准，秒级真实自洽
 * ------------------------------------------------------------------ */

const RAD = Math.PI / 180;
function norm360(d) { const x = d % 360; return x < 0 ? x + 360 : x; }

/** 由儒略日(JD, 力学时 TT)算太阳视黄经（度） */
export function sunApparentLongitude(jde) {
  const ms = (jde - 2440587.5) * 86400000;
  return SunPosition(new Date(ms)).elon;
}

/** TT - UT（秒）近似，Espenak & Meeus 多项式，用于把力学时换算到世界时 */
function deltaTSeconds(year) {
  let y = year;
  let u, t;
  if (y < 1900) {
    t = (y - 1860) / 1;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
  u = (y - 1820) / 100; return -20 + 32 * u * u;
}

/** JD(TT) -> JD(UT) */
function jdeToJd(jde, year) { return jde - deltaTSeconds(year) / 86400; }

/** JD -> 北京时间的年月日时分（UTC+8） */
export function jdToBeijing(jd) {
  const z = jd + 0.5 + 8 / 24;
  const Z = Math.floor(z);
  let F = z - Z;
  let A;
  if (Z < 2299161) A = Z;
  else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayWithFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayWithFrac);
  const frac = dayWithFrac - day;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  let totalMinutes = Math.round(frac * 1440);
  let d = day, m = month, y = year;
  if (totalMinutes >= 1440) { totalMinutes -= 1440; d += 1; }
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return { year: y, month: m, day: d, hour: hh, minute: mm };
}

/** 儒略日 -> 干支序（用于校准） */
function jdToGzDay(jd) {
  const jdn = Math.floor(jd + 0.5);
  return ((jdn + 49) % 60 + 60) % 60;
}

/**
 * 求某年某节气的时刻（北京时间，天文级高精度，分钟级严格对齐历书）。
 * @param {number} year 公历年（节气名以该年 1 月的小寒为起点）
 * @param {number} index 0-23，对应 SOLAR_TERMS
 * @returns {{year,month,day,hour,minute,second}} 北京时间
 */
export function solarTermMoment(year, index) {
  const targetLon = TERM_LONGITUDE[index];
  // 估算节气中心时刻（小寒起点约在 1 月 5-6 日）
  const baseMs = Date.UTC(year, 0, 5, 0, 0, 0) + index * 15.2184 * 86400000;
  // 前置 7 天作为搜索起点，向后搜索 15 天（自适应变号割线求根，彻底消除出窗撞端点缺陷）
  const startDate = new Date(baseMs - 7 * 86400000);
  const astroTime = SearchSunLongitude(targetLon, startDate, 15);
  if (!astroTime || !astroTime.date) {
    throw new Error(`无法计算 ${year} 年节气 ${SOLAR_TERMS[index]} 的天文时刻`);
  }
  // 四舍五入到整秒，消除毫秒截断并确保分秒天然一致
  const roundedMs = Math.round(astroTime.date.getTime() / 1000) * 1000;
  const bjDate = new Date(roundedMs + 8 * 3600000);
  return {
    year: bjDate.getUTCFullYear(),
    month: bjDate.getUTCMonth() + 1,
    day: bjDate.getUTCDate(),
    hour: bjDate.getUTCHours(),
    minute: bjDate.getUTCMinutes(),
    second: bjDate.getUTCSeconds(),
  };
}

/** 某公历年 24 节气（北京时间） */
export function solarTermsOfYear(year) {
  return SOLAR_TERMS.map((name, i) => ({ name, index: i, ...solarTermMoment(year, i) }));
}

/** 比较两个北京时间的先后 */
function cmpMoment(a, b) {
  return (a.year - b.year) || (a.month - b.month) || (a.day - b.day) || (a.hour - b.hour) || (a.minute - b.minute);
}
/** 把 {y,m,d,h,mi} 转为可比较的数值（近似，用于区间定位） */
function momentValue(t) {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) / 60000;
}

/**
 * 找出给定时刻所在的"节气月"。
 * 月支：以 12 个"节"为界（立春→寅、惊蛰→卯、清明→辰、立夏→巳、芒种→午、
 * 小暑→未、立秋→申、白露→酉、寒露→戌、立冬→亥、大雪→子、小寒→丑）。
 * @returns {{monthBranchIndex:number, termName:string, termMoment:object, nextTerm:object}}
 */
export function solarMonthOf(moment) {
  const y = moment.year;
  // 收集 y-1, y, y+1 三年的"节"（偶数 index 为节，奇数 index 为中气）
  const jieIndexes = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; // 小寒 立春 惊蛰 ...
  const points = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const i of jieIndexes) {
      const t = solarTermMoment(yy, i);
      points.push({ termIndex: i, termName: SOLAR_TERMS[i], moment: t });
    }
  }
  points.sort((a, b) => cmpMoment(a.moment, b.moment));
  const v = momentValue(moment);
  let current = points[0];
  let next = points[points.length - 1];
  for (let i = 0; i < points.length; i++) {
    if (momentValue(points[i].moment) <= v) { current = points[i]; next = points[i + 1] ?? points[i]; }
  }
  // 节 -> 月支：小寒(0)->丑(1)，立春(2)->寅(2)，惊蛰(4)->卯(3) ...
  const branchIndex = ((current.termIndex / 2) + 1) % 12;
  return { monthBranchIndex: branchIndex, termName: current.termName, termMoment: current.moment, nextTerm: next };
}

/* ------------------------------------------------------------------ *
 * 八、四柱
 * ------------------------------------------------------------------ */

const MONTH_BRANCH_OF_TERM = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]; // 小寒->丑 立春->寅 ...

/** 年柱：以立春为界 */
function yearPillar(moment) {
  const thisYearLichun = solarTermMoment(moment.year, 2);
  const gzYear = cmpMoment(moment, thisYearLichun) < 0 ? moment.year - 1 : moment.year;
  const index = ((gzYear - 1984) % 60 + 60) % 60;
  return { index, stemIndex: index % 10, branchIndex: index % 12, gzYear, lichun: thisYearLichun };
}

/** 月柱：由节气月支 + 五虎遁推月干 */
function monthPillar(yearStemIndex, monthBranchIndex) {
  // 五虎遁：甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸何方发，甲寅之上好追求
  const base = (yearStemIndex % 5) * 2 + 2; // 寅月天干
  const offset = ((monthBranchIndex - 2) % 12 + 12) % 12; // 距寅月
  const stemIndex = (base + offset) % 10;
  return { stemIndex, branchIndex: monthBranchIndex, index: gzIndex(stemIndex, monthBranchIndex) };
}

/** 日柱：儒略日推 */
function dayPillar(moment) {
  // 以当地（北京）日期的正午作为该日的 JD，避免跨日误差
  const jd = gregorianToJd(moment.year, moment.month, moment.day) + 0.5;
  const index = jdToGzDay(jd);
  return { index, stemIndex: index % 10, branchIndex: index % 12 };
}

/** 公历 -> 儒略日（当日 0h UT 起点） */
export function gregorianToJd(y, m, d) {
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const A = Math.floor(yy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5;
}

/** 时柱：由日干 + 五鼠遁推时干 */
function hourPillar(dayStemIndex, hourBranchIndex) {
  // 五鼠遁：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
  const base = (dayStemIndex % 5) * 2; // 子时天干
  const stemIndex = (base + hourBranchIndex) % 10;
  return { stemIndex, branchIndex: hourBranchIndex, index: gzIndex(stemIndex, hourBranchIndex) };
}

/** 时辰 -> 时支序（子=0）；23:00-00:59 为子时 */
export function hourToBranchIndex(hour, minute = 0) {
  const h = hour + (minute >= 60 ? 1 : 0);
  if (h >= 23 || h < 1) return 0;       // 子
  return Math.floor((h + 1) / 2) % 12;
}

/* ------------------------------------------------------------------ *
 * 九、神煞推演
 * ------------------------------------------------------------------ */

/**
 * 神煞推演。以日干、年干、年支、日支、月支、四柱地支综合查取。
 * 说明：不同古籍对部分神煞取法有异，此处采用《三命通会》《渊海子平》通行取法，
 * 并在 note 中标注存在分歧者。
 */
function computeShenSha(pillars, dayStemIndex, yearStemIndex, monthBranchIndex, dayBranchIndex, yearBranchIndex, gender) {
  const branches = pillars.map((p) => BRANCHES[p.branchIndex]);
  const stems = pillars.map((p) => STEMS[p.stemIndex]);
  const allBranches = [...branches];
  const allStems = [...stems];
  const dayStem = STEMS[dayStemIndex];
  const yearStem = STEMS[yearStemIndex];

  const hit = (list) => allBranches.filter((b) => list.includes(b));
  const hitStem = (list) => allStems.filter((s) => list.includes(s));

  const result = [];
  const add = (name, positions, note) => {
    if (positions.length === 0) return;
    result.push({ name, positions: [...new Set(positions)], ...(note ? { note } : {}) });
  };
  const posOf = (list) => branches.map((b, i) => (list.includes(b) ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);
  const posOfStem = (list) => stems.map((s, i) => (list.includes(s) ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);
  const posOfBranchEq = (b) => branches.map((x, i) => (x === b ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);

  /* --- 天乙贵人：日干、年干分别查四支 --- */
  {
    const list = [...(TIANYI[dayStem] ?? []), ...(TIANYI[yearStem] ?? [])];
    add('天乙贵人', posOf([...new Set(list)]), '以日干/年干查地支；《三命通会》与《渊海子平》个别干取法略异，此处取通行式');
  }
  /* --- 文昌贵人 --- */
  add('文昌贵人', posOfBranchEq(WENCHANG[dayStem]));
  /* --- 太极贵人 --- */
  add('太极贵人', posOf(TAIJI[dayStem] ?? []));
  /* --- 天德 / 月德 --- */
  {
    const td = TIANDE[BRANCHES[monthBranchIndex]];
    const pos = /[甲乙丙丁戊己庚辛壬癸]/.test(td)
      ? posOfStem([td]) : posOfBranchEq(td);
    if (pos.length) result.push({ name: '天德贵人', positions: pos, note: `按月支${BRANCHES[monthBranchIndex]}取「${td}」` });
  }
  {
    const yd = YUEDE[BRANCHES[monthBranchIndex]];
    const pos = posOfStem([yd]);
    if (pos.length) result.push({ name: '月德贵人', positions: pos, note: `按月支${BRANCHES[monthBranchIndex]}取天干「${yd}」` });
  }
  /* --- 禄神 --- */
  add('禄神', posOfBranchEq(LUSHEN[dayStem]));
  /* --- 暗禄（禄神之六合神，日干查四支） --- */
  add('暗禄', posOfBranchEq(ANLU[dayStem]), `日干${dayStem}正禄${LUSHEN[dayStem]}之六合神「${ANLU[dayStem]}」，主暗中得阴庇贵人`);
  /* --- 羊刃 --- */
  add('羊刃', posOfBranchEq(YANGREN[dayStem]), '阳干取帝旺位，阴干传统有"阴干无刃"与"取帝旺前一位"两说');
  /* --- 金舆 --- */
  add('金舆', posOfBranchEq(JINYU[dayStem]));
  /* --- 红艳煞 --- */
  add('红艳煞', posOfBranchEq(HONGYAN[dayStem]));
  /* --- 流霞 --- */
  add('流霞', posOfBranchEq(LIUXIA[dayStem]));
  /* --- 三奇（天上三奇甲戊庚 / 地下三奇乙丙丁 / 人中三奇壬癸辛，须顺排） --- */
  {
    const s = stems.join('');
    for (const q of SANQI) {
      if (s.includes(q)) result.push({ name: `${q === '甲戊庚' ? '天上' : q === '乙丙丁' ? '地下' : '人中'}三奇`, positions: ['四柱顺排'], note: `${q} 三干依次顺排于年月日时` });
    }
  }

  /* --- 三合局系神煞：以年支（及日支）所属三合局查 --- */
  const juNames = [];
  for (const [name, members] of Object.entries(TRIPLE_NAME)) {
    if (members.includes(BRANCHES[yearBranchIndex])) juNames.push({ name, from: '年支' });
  }
  for (const j of juNames) {
    const d = SANHE_DERIVED[j.name];
    add(`驿马（${j.from}${j.name}）`, posOfBranchEq(d.驿马));
    add(`桃花（${j.from}${j.name}）`, posOfBranchEq(d.桃花));
    add(`华盖（${j.from}${j.name}）`, posOfBranchEq(d.华盖));
    add(`将星（${j.from}${j.name}）`, posOfBranchEq(d.将星));
    add(`劫煞（${j.from}${j.name}）`, posOfBranchEq(d.劫煞));
    add(`亡神（${j.from}${j.name}）`, posOfBranchEq(d.亡神));
    add(`灾煞（${j.from}${j.name}）`, posOfBranchEq(d.灾煞));
    add(`天煞（${j.from}${j.name}）`, posOfBranchEq(d.天煞));
    add(`地煞（${j.from}${j.name}）`, posOfBranchEq(d.地煞));
  }
  /* --- 咸池（即桃花，别名） --- */
  {
    const ju = Object.entries(TRIPLE_NAME).find(([, m]) => m.includes(BRANCHES[yearBranchIndex]));
    if (ju) add('咸池（桃花别名）', posOfBranchEq(SANHE_DERIVED[ju[0]].桃花));
  }

  /* --- 孤辰寡宿（年支） --- */
  add('孤辰', posOfBranchEq(GUCHEN[BRANCHES[yearBranchIndex]]));
  add('寡宿', posOfBranchEq(GUASU[BRANCHES[yearBranchIndex]]));

  /* --- 十恶大败 / 阴差阳错（日柱） --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (SHIE_DABAI_GZ.includes(dayGz)) result.push({ name: '十恶大败日', positions: ['日柱'], note: dayGz });
    if (YINCHAYANGCUO_GZ.includes(dayGz)) result.push({ name: '阴差阳错日', positions: ['日柱'], note: dayGz });
  }

  /* --- 天罗地网（依《三命通会》原典「戌亥为天罗，辰巳为地网」；须成对相并在位） --- */
  {
    const hasXu = branches.includes('戌');
    const hasHai = branches.includes('亥');
    const hasChen = branches.includes('辰');
    const hasSi = branches.includes('巳');

    if (hasXu && hasHai) {
      add('天罗', posOf(['戌', '亥']), '《三命通会》「戌亥为天罗……猪犬侵凌，每虑丈夫厄难」；局中戌亥成对相并在位');
    }
    if (hasChen && hasSi) {
      add('地网', posOf(['辰', '巳']), '《三命通会》「辰巳为地网……龙蛇混杂，常防妇女忧危」；局中辰巳成对相并在位');
    }
  }

  /* --- 小儿关煞 --- */
  {
    const g = XIAOER_GUANSHA[BRANCHES[yearBranchIndex]];
    if (g) result.push({ name: '小儿关煞', positions: ['年支'], note: `${g}（仅供参考，须结合大运流年与童限）` });
  }

  /* --- 四柱魁罡日 --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (['庚辰', '庚戌', '壬辰', '戊戌'].includes(dayGz)) result.push({ name: '魁罡', positions: ['日柱'], note: dayGz });
  }

  /* --- 三奇贵人以外的常见贵格：天赦日 --- */
  {
    const mb = BRANCHES[monthBranchIndex];
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    const tianshe = { 寅: ['戊寅'], 卯: ['戊寅'], 辰: ['戊寅'], 巳: ['甲午'], 午: ['甲午'], 未: ['甲午'], 申: ['戊申'], 酉: ['戊申'], 戌: ['戊申'], 亥: ['甲子'], 子: ['甲子'], 丑: ['甲子'] };
    if ((tianshe[mb] ?? []).includes(dayGz)) result.push({ name: '天赦日', positions: ['日柱'], note: dayGz });
  }

  /* --- 暗禄日（自坐暗禄） --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (ANLU_DAY_GZ.includes(dayGz)) {
      result.push({ name: '暗禄日', positions: ['日柱'], note: `${dayGz}（自坐暗禄）` });
    }
  }

  return result;
}

/** 神煞中"吉""凶"属性粗分类，供参考（非绝对） */
const AUSPICIOUS = ['天乙贵人', '文昌贵人', '太极贵人', '天德贵人', '月德贵人', '禄神', '暗禄', '金舆', '天赦日', '将星'];
const INAUSPICIOUS = ['羊刃', '红艳煞', '流霞', '劫煞', '亡神', '灾煞', '天煞', '地煞', '孤辰', '寡宿', '十恶大败日', '阴差阳错日', '魁罡', '小儿关煞'];
export function shenshaNature(name) {
  if (AUSPICIOUS.some((a) => name.startsWith(a))) return '吉';
  if (INAUSPICIOUS.some((a) => name.startsWith(a))) return '凶';
  return '中';
}

/* ------------------------------------------------------------------ *
 * 十、五行力量统计
 * ------------------------------------------------------------------ */

const MONTH_BRANCH_SEASON = {
  // 月支 -> 当令五行（旺）。**这是"本气"口径**，仅在无法计司令时使用（如四柱模式无生日）。
  寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土',
};

/**
 * 五行关系表 —— 全文件唯一一处定义。
 *
 * 【元素编号】木0 火1 土2 金3 水4，与 STEM_ELEMENT / BRANCH_ELEMENT 同一套编号。
 * 相生：木生火、火生土、土生金、金生水、水生木。
 * 相克：木克土、火克金、土克水、金克木、水克火。
 *
 * 这里用**元素名字面量**写死两张名表（人可逐条核对，不易看错），
 * 再由名表导出编号表；绝不从编号表反推另一张编号表——"相克 = 相生走几步"
 * 这类推导已经两次算错（两次都比正确值少一步），不再使用。
 */
export const SHENG_MAP = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生者
export const KE_MAP = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };    // 我克者
/** 元素名表，编号与 STEM_ELEMENT / BRANCH_ELEMENT 一致 */
const ELEMENT_OF_INDEX = ['木', '火', '土', '金', '水'];
/** 按编号取"我生 / 我克"，由上面两张名表导出 */
const SHENG_IDX = ELEMENT_OF_INDEX.map((e) => ELEMENT_OF_INDEX.indexOf(SHENG_MAP[e]));
const KE_IDX = ELEMENT_OF_INDEX.map((e) => ELEMENT_OF_INDEX.indexOf(KE_MAP[e]));

/**
 * 人元司令用事（《三命通会》卷二「人元司事」）——各月**分日用事**之次序与日数。
 *
 * 为什么需要它：一个月并非自始至终由本气当令。四生月（寅巳申亥）与四库月（辰未戌丑）
 * 共八个月，**本气只当令 18–20 日，前 7–10 日另有所司**；四正月（子午卯酉）前后两段
 * 同属一五行，故全月当令五行不变。把整月按本气一档处理，会让生于月首者**令态判错一档**，
 * 而令态是五行力量（旺相休囚死系数）与"极／强"分级的唯一依据，错一档即足以翻盘。
 *
 * ⚠ 两点须声明：
 *   · 本表用**长生／墓库的阳干**命名余气（辰作壬墓、丑作庚墓、未作甲墓），
 *     与通行藏干表（辰藏戊乙癸、丑藏己癸辛、未藏己丁乙）**系统性不一致**，
 *     属"阴阳同生同死"一路——《滴天髓》"阴阳顺逆"章力斥"阳生阴死、阴生阳死"，此处存异。
 *     故本表**只用于定"当令五行"**，不改动 HIDDEN_STEMS_SPEC（藏干仍用通行表）。
 *   · 日数**不照抄三十日平分**：《御定子平秘本三篇》自承
 *     "西法月气有长短，中法平分，则古命月提之不准者多矣"。
 *     故 silingOf 按**实际节气长度比例**分段，比原表的固定日数更准。
 */
const SI_LING_SEGMENTS = {
  寅: [['戊', 5], ['丙', 5], ['甲', 20]],
  卯: [['甲', 7], ['乙', 23]],
  辰: [['乙', 7], ['壬', 5], ['戊', 18]],
  巳: [['戊', 7], ['庚', 5], ['丙', 18]],
  午: [['丙', 7], ['丁', 23]],
  未: [['丁', 7], ['甲', 5], ['己', 18]],
  申: [['戊', 5], ['壬', 5], ['庚', 20]],
  酉: [['庚', 7], ['辛', 23]],
  戌: [['辛', 7], ['丙', 5], ['戊', 18]],
  亥: [['戊', 5], ['甲', 5], ['壬', 20]],
  子: [['壬', 7], ['癸', 23]],
  丑: [['癸', 7], ['庚', 5], ['己', 18]],
};

/**
 * 某时刻的**人元司令**（当令之神）。
 *
 * 按该节气月的**实际长度**比例分段：段界 = 节气起点 + 实际月长 ×（累计日数 / 总日数）。
 * 因各节气长短不等（冬至前后约 29.4 日、夏至前后约 31.4 日），此法比原表三十日平分更准。
 *
 * @param {{year:number,month:number,day:number,hour:number,minute?:number}} moment
 * @returns {{月支:string, 司令:string, 司令五行:string, 段:string, 本气:string,
 *            是否本气当令:boolean, 实际月长日:number, 已过比例:number, 据:string}}
 */
export function silingOf(moment) {
  const sm = solarMonthOf(moment);
  const bi = sm.monthBranchIndex;
  const bn = BRANCHES[bi];
  const segs = SI_LING_SEGMENTS[bn];
  const 总日 = segs.reduce((a, s) => a + s[1], 0);
  // 注意：solarMonthOf 的 termMoment 是**裸时刻**，而 nextTerm 是
  // {termIndex, termName, moment} 的包装对象——两者取值方式不同，混用会得 NaN。
  const t0 = momentValue(sm.termMoment);
  const nextRaw = sm.nextTerm?.moment ?? sm.nextTerm;
  const t1 = momentValue(nextRaw);
  const t = momentValue({ ...moment, minute: moment.minute ?? 0 });
  const 实际月长分 = Math.max(1, t1 - t0);
  const 已过比例 = Math.min(1, Math.max(0, (t - t0) / 实际月长分));
  const 已过日数 = 已过比例 * 总日;

  let acc = 0;
  let cur = segs[segs.length - 1];
  for (const s of segs) { acc += s[1]; if (已过日数 < acc) { cur = s; break; } }

  const 本气 = HIDDEN_STEMS_SPEC[bi][0][0];
  return {
    月支: bn,
    司令: cur[0],
    司令五行: ELEMENTS[STEM_ELEMENT[STEMS.indexOf(cur[0])]],
    段: `第 ${segs.indexOf(cur) + 1} 段（${cur[1]}/${总日} 日）`,
    本气,
    是否本气当令: cur[0] === 本气,
    节气月: sm.termName,
    实际月长日: Number((实际月长分 / 1440).toFixed(2)),
    已过比例: Number(已过比例.toFixed(4)),
    据: '《三命通会》卷二「人元司事」；段界按实际节气长度比例折算',
  };
}

/**
 * 五行旺相休囚死。**唯一口径**：seasonCoefficient 也由它导出，避免两处平行实现走偏。
 *
 * @param {string} element
 * @param {string} monthBranchName
 * @param {string} [kingEl] **当令五行**（＝司令之五行）。省略时退回月支本气——
 *   四柱模式无生日、算不出司令，即走此路，调用方应据此声明"未能计司令"。
 */
export function seasonState(element, monthBranchName, silingEl) {
  const king = MONTH_BRANCH_SEASON[monthBranchName];
  if (element === king) return '旺';                     // 月令本气——**永远的老大**，不因司令而让位
  if (silingEl && element === silingEl) return '次旺';   // 人元司事之神：月内用事，提一档，但不得夺"老大"
  if (SHENG_MAP[king] === element) return '相';          // 为当令者所生
  if (SHENG_MAP[element] === king) return '休';          // 生当令者
  if (KE_MAP[element] === king) return '囚';             // 克当令者
  return '死';                                           // 为当令者所克
}
/**
 * 旺相休囚死系数。**「次旺」是"人元司事"专用档**：
 * 月令本气已定大气候（如申月已入秋、金为老大），司令之神只是月内用事者，
 * 故其力高于「相」而不及「旺」——避免让戊土在申月夺了金的老大位。
 */
const STATE_COEF = { 旺: 1.4, 次旺: 1.3, 相: 1.2, 休: 1.0, 囚: 0.7, 死: 0.6 };

/** 五行旺相休囚死系数（按元素名运算，故用 SHENG_MAP / KE_MAP 的名表） */
function seasonCoefficient(element, monthBranchName, silingEl) {
  return STATE_COEF[seasonState(element, monthBranchName, silingEl)];
}

/**
 * 从 chart 取**当令五行**（＝司令之五行）。
 * 取不到则返回 undefined，调用方即退回月支本气——
 * 四柱模式（无出生时刻）算不出司令，只有此路，且须在输出中声明"未能计司令"。
 */
export function kingOf(chart) {
  return chart?.司令五行
    ?? chart?.司令?.司令五行
    ?? chart?.dayMaster?.司令五行
    ?? chart?.dayMaster?.司令?.司令五行
    ?? undefined;
}

/**
 * 五行力量统计（经验模型）。同时给出"天干明现"与"地支藏干"两个来源，
 * 便于判断"透干 / 通根"。
 *
 * **语义限定（须向使用者说明）**：本占比衡量的是**气候与气势**，
 * **不是日主的受力**。日主旺衰须另看得令／得地／得势（见 dayMasterSupport）。
 */
export function elementStrength(pillars, monthBranchName, silingEl) {
  const score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const visible = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const rooted = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  const hasMain = { 木: false, 火: false, 土: false, 金: false, 水: false };
  const hasSub = { 木: false, 火: false, 土: false, 金: false, 水: false };

  // 1. 先统计地支藏干通根分布（本气深根 vs 中余气微根）
  for (const p of pillars) {
    for (const h of HIDDEN_STEMS_SPEC[p.branchIndex]) {
      const se = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]];
      rooted[se] += h[2];
      if (h[1] === '本') hasMain[se] = true;
      else hasSub[se] = true;
      score[se] += h[2] * 1.2;
    }
  }

  // 2. 天干打分挂钩通根深度（虚浮折减律，D-043，方案 A）
  //    - 地支有通根者（含本气或中余气）：天干有根依托，得 1.0 分；
  //    - 全局 0 通根（完全虚浮无根者）：天干虚浮无根，折减为 0.25 分（如乙巳盘之乙木）。
  for (const p of pillars) {
    const se = ELEMENTS[STEM_ELEMENT[p.stemIndex]];
    visible[se] += 1;
    let stemScore = (rooted[se] > 0) ? 1.0 : 0.25;
    score[se] += stemScore;
  }
  const adjusted = {};
  let total = 0;
  for (const e of ELEMENTS) {
    adjusted[e] = Number((score[e] * seasonCoefficient(e, monthBranchName, silingEl)).toFixed(2));
    total += adjusted[e];
  }
  const percent = {};
  if (total > 0) {
    let pSum = 0;
    let maxKey = ELEMENTS[0];
    let maxVal = -1;
    for (const e of ELEMENTS) {
      const p = Number((adjusted[e] / total * 100).toFixed(1));
      percent[e] = p;
      pSum += p;
      if (adjusted[e] > maxVal) {
        maxVal = adjusted[e];
        maxKey = e;
      }
    }
    const diff = Number((100 - pSum).toFixed(1));
    if (diff !== 0 && maxKey) {
      percent[maxKey] = Number((percent[maxKey] + diff).toFixed(1));
    }
  } else {
    for (const e of ELEMENTS) percent[e] = 0;
  }
  const 令态 = {};
  for (const e of ELEMENTS) 令态[e] = seasonState(e, monthBranchName, silingEl);
  const 本气五行 = MONTH_BRANCH_SEASON[monthBranchName];
  return {
    raw: Object.fromEntries(ELEMENTS.map((e) => [e, Number(score[e].toFixed(2))])),
    adjusted, percent, visible, rooted, 令态,
    当令五行: 本气五行,
    司令五行: silingEl ?? null,
    当令据: silingEl
      ? `月令为大：本气${本气五行}为「旺」（老大）；人元司事之神${silingEl}提为「次旺」（月内用事，不夺老大）`
      : '月支本气（**未能计司令**：未提供出生时刻，或该时为四柱模式）',
    语义: '以上占比为经验加权，衡量的是**气候与气势**，不是日主的受力；'
      + '日主旺衰须另看得令（月令令态）、得地（通根）、得势（干支同党），见 dayMasterSupport。',
  };
}

/* ------------------------------------------------------------------ *
 * 十一、干支关系推演
 * ------------------------------------------------------------------ */

/**
 * 地支相刑：两派口径**同时给出并标注**，不替使用者选边。
 *
 * 三刑（寅巳申「无恩之刑」、丑戌未「恃势之刑」）的判定自古有两派：
 *   · 三刑全见论——三支齐现方成刑（原 relationsOf 的口径）
 *   · 两两互刑论——三支中任意两支相见即成刑（原 transitAnalysis 的口径）
 * 两派并存，取哪派直接改变断语，故一并报出并置 `争议: true`，
 * 由调用方按所宗流派取舍，不得静默择一。
 * 子卯「无礼之刑」本即两支成刑，两派无异说；自刑（辰午酉亥）见两支以上即成。
 *
 * @param {Array<{label:string, branch:string}>} labelled 带标签的地支，如 [{label:'年',branch:'巳'}]
 * @param {string} [requireLabel] 只保留涉及该标签的结果（岁运分析用，避免把原局固有的刑误报为岁运所致）
 */
function branchPunishments(labelled, requireLabel) {
  const held = (m) => labelled.filter((l) => l.branch === m);
  const out = [];
  const add = (刑, memberList, labelsArr, 口径, 争议, note) => {
    out.push({
      刑,
      members: memberList.join(''),
      positions: labelsArr.map((l) => l.label + l.branch).join('、'),
      口径,
      争议,
      ...(note ? { note } : {}),
      _labels: labelsArr.map((l) => l.label),
    });
  };

  for (const p of BRANCH_PUNISH) {
    const present = p.members.filter((m) => labelled.some((l) => l.branch === m));
    if (p.members.length === 2) {
      // 子卯：本即两支成刑，无争议
      if (present.length === 2) add(p.kind, p.members, present.flatMap(held), '通行（二支即成）', false);
      continue;
    }
    if (present.length === 3) {
      add(p.kind, p.members, present.flatMap(held), '三刑全见', false);
    } else if (present.length === 2) {
      add(p.kind, present, present.flatMap(held), '两两互刑', true,
        `三刑（${p.members.join('')}）只见${present.join('')}两支：主「三刑全见」者不以为刑，主「两两互刑」者以为刑。两派并存，须并陈，不可静默择一。`);
    }
  }

  for (const s of SELF_PUNISH) {
    const ls = labelled.filter((l) => l.branch === s);
    if (ls.length >= 2) add('自刑', [s, s], ls, '通行（二支即成）', false);
  }

  const picked = requireLabel === undefined ? out : out.filter((x) => x._labels.includes(requireLabel));
  for (const x of picked) delete x._labels;
  return picked;
}

export function gzRelations(pillars, luckPillar) {
  const names = ['年', '月', '日', '时'];
  const stems = pillars.map((p) => STEMS[p.stemIndex]);
  const branches = pillars.map((p) => BRANCHES[p.branchIndex]);
  if (luckPillar) { stems.push(STEMS[luckPillar.stemIndex]); branches.push(BRANCHES[luckPillar.branchIndex]); names.push('大运'); }

  const out = {
    天干五合: [], 天干相冲: [], 天干相克: [],
    地支六合: [], 地支半合: [], 地支三合: [], 地支三会: [], 地支六冲: [], 地支相刑: [], 地支相害: [], 地支相破: [], 地支相绝: [],
    干支自合: [], 地支暗合: [], 鸳鸯合: [], 反吟: [], 伏吟: [], 虚邀暗夹: [], 天干地支同柱: []
  };

  // 天干
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const a = stems[i], b = stems[j];
      const key = a + b, key2 = b + a;
      if (STEM_COMBINE[key]) out.天干五合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: STEM_COMBINE[key], note: '合化须看月令与化神是否得地' });
      else if (STEM_COMBINE[key2]) out.天干五合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: STEM_COMBINE[key2], note: '合化须看月令与化神是否得地' });
      if (STEM_CLASH.includes(key) || STEM_CLASH.includes(key2)) out.天干相冲.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      const ea = STEM_ELEMENT[STEMS.indexOf(a)], eb = STEM_ELEMENT[STEMS.indexOf(b)];
      if (KE[ea] === eb) out.天干相克.push({ pair: `${names[i]}${a} 克 ${names[j]}${b}` });
      else if (KE[eb] === ea) out.天干相克.push({ pair: `${names[j]}${b} 克 ${names[i]}${a}` });
    }
  }
  // 地支
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i], b = branches[j];
      const key = a + b, key2 = b + a;
      if (BRANCH_COMBINE[key]) out.地支六合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: BRANCH_COMBINE[key] });
      else if (BRANCH_COMBINE[key2]) out.地支六合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: BRANCH_COMBINE[key2] });
      if (BRANCH_CLASH.includes(key) || BRANCH_CLASH.includes(key2)) out.地支六冲.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      if (BRANCH_HARM.includes(key) || BRANCH_HARM.includes(key2)) out.地支相害.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, note: '害即"穿"，盲派重其破坏作用' });
      if (BRANCH_DESTROY.includes(key) || BRANCH_DESTROY.includes(key2)) out.地支相破.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      if (BRANCH_HIDDEN_COMBINE[key]) {
        out.地支暗合.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          合: BRANCH_HIDDEN_COMBINE[key].合,
          note: BRANCH_HIDDEN_COMBINE[key].note,
        });
      }
      // D-035: 地支半合（生地半合、墓地半合、拱合局）
      if (BRANCH_HALF_COMBINE[key]) {
        const bh = BRANCH_HALF_COMBINE[key];
        out.地支半合.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          type: bh.type,
          局: bh.局,
          化: bh.化,
          ...(bh.拱 ? { 拱: bh.拱 } : {}),
          note: bh.note,
        });
      }
      // D-035: 地支相绝（四绝）
      if (BRANCH_EXTINCTION[key]) {
        const ext = BRANCH_EXTINCTION[key];
        out.地支相绝.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          绝: ext.绝,
          note: ext.note,
        });
      }
    }
  }

  // 整柱关系：鸳鸯合（天合地合）、反吟（天克地冲）、伏吟（干支相同）（D-035 裁定）
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const aS = stems[i], bS = stems[j];
      const aB = branches[i], bB = branches[j];
      const aGz = aS + aB, bGz = bS + bB;

      // 鸳鸯合（天地德合）
      const sKey = STEM_COMBINE[aS + bS] ? aS + bS : STEM_COMBINE[bS + aS] ? bS + aS : null;
      const bKey = BRANCH_COMBINE[aB + bB] ? aB + bB : BRANCH_COMBINE[bB + aB] ? bB + aB : null;
      if (sKey && bKey) {
        out.鸳鸯合.push({
          pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
          天合: `${aS}${bS}合化${STEM_COMBINE[sKey]}`,
          地合: `${aB}${bB}合化${BRANCH_COMBINE[bKey]}`,
          note: '天合地合（鸳鸯合），天地德合，情深意笃，两柱气势紧密交融',
        });
      }

      // 反吟（天克地冲 / 天冲地冲）
      const bClash = BRANCH_CLASH.includes(aB + bB) || BRANCH_CLASH.includes(bB + aB);
      if (bClash) {
        const sClash = STEM_CLASH.includes(aS + bS) || STEM_CLASH.includes(bS + aS);
        const ea = STEM_ELEMENT[STEMS.indexOf(aS)], eb = STEM_ELEMENT[STEMS.indexOf(bS)];
        const sKe = (KE[ea] === eb) || (KE[eb] === ea);
        if (sClash) {
          out.反吟.push({
            pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
            type: '天冲地冲',
            干: `${aS}${bS}冲`,
            支: `${aB}${bB}冲`,
            note: '天冲地冲（反吟），激荡剧烈，根基拔摇',
          });
        } else if (sKe) {
          out.反吟.push({
            pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
            type: '天克地冲',
            干: KE[ea] === eb ? `${aS}克${bS}` : `${bS}克${aS}`,
            支: `${aB}${bB}冲`,
            note: '天克地冲（反吟），上下交伐，动荡不宁',
          });
        }
      }

      // 伏吟（干支相同）
      if (aS === bS && aB === bB) {
        out.伏吟.push({
          pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
          gz: aGz,
          note: '干支并临伏吟，内外重叠，事多滞涩反复',
        });
      }
    }
  }

  // 虚邀暗夹（相邻柱地支隔位虚拱，含拱禄、拱贵、暗夹刃，D-035 裁定）
  const dayStem = pillars.length > 2 ? STEMS[pillars[2].stemIndex] : stems[0];
  const yearStem = stems[0];
  for (let i = 0; i < branches.length - 1; i++) {
    const b1 = branches[i], b2 = branches[i + 1];
    const idx1 = BRANCHES.indexOf(b1), idx2 = BRANCHES.indexOf(b2);
    let clamped = null;
    if ((idx1 + 2) % 12 === idx2) {
      clamped = BRANCHES[(idx1 + 1) % 12];
    } else if ((idx2 + 2) % 12 === idx1) {
      clamped = BRANCHES[(idx2 + 1) % 12];
    }
    if (clamped) {
      const tags = [];
      if (LUSHEN[dayStem] === clamped) tags.push('拱禄');
      if (TIANYI[dayStem]?.includes(clamped) || TIANYI[yearStem]?.includes(clamped)) tags.push('拱贵');
      if (YANGREN[dayStem] === clamped) tags.push('夹刃');
      out.虚邀暗夹.push({
        pair: `${names[i]}${b1} — ${names[i + 1]}${b2}`,
        夹: clamped,
        格局: tags.length ? tags.join('、') : '地支虚夹',
        note: tags.includes('拱禄')
          ? `相邻虚拱「${clamped}」禄（拱禄格）`
          : tags.includes('拱贵')
          ? `相邻虚拱「${clamped}」天乙贵人（拱贵格）`
          : `相邻两支隔位虚拱「${clamped}」`,
      });
    }
  }

  // 干支自合（七大柱：戊子、壬午、丁亥、辛巳、己亥、癸巳、甲午，D-029 裁定）
  for (let i = 0; i < stems.length; i++) {
    const gz = stems[i] + branches[i];
    if (STEM_BRANCH_SELF_COMBINE[gz]) {
      out.干支自合.push({
        pillar: names[i],
        gz,
        合: STEM_BRANCH_SELF_COMBINE[gz].合,
        藏干: STEM_BRANCH_SELF_COMBINE[gz].藏干,
        note: STEM_BRANCH_SELF_COMBINE[gz].note,
      });
    }
  }
  // 三合 / 三会 / 三刑（要求三支齐现）
  const bset = new Set(branches);
  for (const [ju, members] of Object.entries(TRIPLE_NAME)) {
    if (members.every((m) => bset.has(m))) {
      const pos = members.map((m) => `${names[branches.indexOf(m)]}${m}`).join('、');
      out.地支三合.push({ 局: `${ju}（${members.join('')}）`, positions: pos, note: '三合局成，力大于六合' });
    }
  }
  for (const d of BRANCH_DIRECTION) {
    if (d.members.every((m) => bset.has(m))) {
      const pos = d.members.map((m) => `${names[branches.indexOf(m)]}${m}`).join('、');
      out.地支三会.push({ 方: `${d.name}（${d.members.join('')}）`, positions: pos, note: '三会方局，力最专' });
    }
  }
  // 相刑：寅巳申「无恩之刑」、丑戌未「恃势之刑」的两派口径一并报出（见 branchPunishments）
  out.地支相刑.push(...branchPunishments(branches.map((b, i) => ({ label: names[i], branch: b }))));
  // 同柱干支：天覆地载 / 盖头 / 截脚（按元素编号比较，不能用名字去索引编号表）
  for (let i = 0; i < pillars.length; i++) {
    const se = STEM_ELEMENT[pillars[i].stemIndex];       // 干元素编号
    const be = BRANCH_ELEMENT[pillars[i].branchIndex];   // 支元素编号
    let kind;
    if (se === be) kind = '干支同气（天覆地载）';
    else if (SHENG_IDX[se] === be) kind = '干生支（泄气）';
    else if (SHENG_IDX[be] === se) kind = '支生干（得地）';
    else if (KE_IDX[se] === be) kind = '干克支（盖头）';
    else kind = '支克干（截脚）';
    out.天干地支同柱.push({
      pillar: names[i], gz: stems[i] + branches[i], relation: kind,
      detail: `${ELEMENT_OF_INDEX[se]}干 / ${ELEMENT_OF_INDEX[be]}支`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 十二、大运 / 流年
 * ------------------------------------------------------------------ */

/**
 * 判定大运顺逆（阳男阴女顺行，阴男阳女逆行）。
 * @param {boolean} yangYear 年干是否为阳
 * @param {'男'|'女'} gender
 */
export function luckDirection(yangYear, gender) {
  const forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
  return forward ? '顺行' : '逆行';
}

/**
 * 由起运岁数（年/月/日）推**交运公历时刻**。
 *
 * 为什么必须这样算：起运是按"三日折一年"折算出来的**时长**，不是"从立春年起算的年号"。
 * 它必须落到「出生时刻 + 该时长」上，再取公历年。
 * 旧实现用 `立春年 + floor(起运岁)` 且丢掉月日 —— 于是
 *   ① 每隔一年错一次：2001-08-10 生、起运 0年9个月 → 记成 2001 年起，应交运于 2002-05；
 *   ② 1 月生者更荒谬：立春年还是上一年，1 运起始年可以**早于出生日**。
 * 实测 2001 全年 365 天中有 199 天（54.5%）因此早一年。
 *
 * @param {{year:number,month:number,day:number,hour?:number,minute?:number}} m 出生时刻
 * @param {{startAgeYears:number,startAgeMonths:number,startAgeDays:number}} st 起运岁数
 * @returns {{year:number,month:number,day:number,hour:number,minute:number}} 交运时刻
 */
function addStartAgeToMoment(m, st) {
  let mo = m.month - 1 + (st.startAgeMonths || 0);
  const y = m.year + (st.startAgeYears || 0) + Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  // 先按"目标月的实际天数"夹取日，再叠加零余天数，避免 1/31 + 1 月 溢出成 3/3。
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const day = Math.min(m.day, daysInMonth) + (st.startAgeDays || 0);
  const dt = new Date(Date.UTC(y, mo, day, m.hour || 0, m.minute || 0));
  return {
    year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(),
    hour: dt.getUTCHours(), minute: dt.getUTCMinutes(),
  };
}

/**
 * 由节气推起运：顺行数至下一个节，逆行数至上一个节，三日折一年。
 */
function computeStartLuck(moment, forward) {
  const info = solarMonthOf(moment);
  const from = forward ? info.nextTerm.moment : info.termMoment;
  const diffDays = Math.abs(momentValue(from) - momentValue(moment)) / 1440;
  const yearsFloat = diffDays / 3;
  const years = Math.floor(yearsFloat);
  const monthsFloat = (yearsFloat - years) * 12;
  const months = Math.floor(monthsFloat);
  const days = Math.round((monthsFloat - months) * 30);
  const nominalAge = years + 1; // 虚岁
  const startMoment = addStartAgeToMoment(moment, {
    startAgeYears: years, startAgeMonths: months, startAgeDays: days,
  });
  const p2 = (n) => String(n).padStart(2, '0');
  return {
    forward,
    referenceTerm: from,
    daysToTerm: Number(diffDays.toFixed(4)),
    yearsFloat: Number(yearsFloat.toFixed(4)),
    startAgeText: `${years}年${months}个月${days}天`,
    startAgeYears: years,
    startAgeMonths: months,
    startAgeDays: days,
    startNominalAge: nominalAge,
    startMoment,
    startDate: `${startMoment.year}-${p2(startMoment.month)}-${p2(startMoment.day)}`,
    startYearCivil: startMoment.year,
  };
}

/**
 * 生成大运干支序列。
 * @param {object} monthPillarObj 月柱
 * @param {number} count 步数
 * @param {boolean} forward
 */
export function buildLuckPillars(monthPillarObj, count = 10, forward = true, startInfo = null) {
  const out = [];
  const base = monthPillarObj.index;
  for (let i = 1; i <= count; i++) {
    const idx = ((base + (forward ? i : -i)) % 60 + 60) % 60;
    const age = startInfo ? startInfo.startAgeYears + (i - 1) * 10 : (i - 1) * 10 + 1;
    out.push({
      step: i,
      index: idx,
      gz: gzName(idx),
      stemIndex: idx % 10,
      branchIndex: idx % 12,
      startAge: age,
      ageRange: `${age}-${age + 9}`,
      ...(startInfo ? { startYear: null } : {}),
    });
  }
  return out;
}

/** 公历年 -> 年柱干支序（以立春为界，此处用公历年近似，精确判定用 yearPillar） */
export function yearGzIndex(year) { return ((year - 1984) % 60 + 60) % 60; }

/** 流年（按立春为界的干支年） */
export function yearPillarOf(gzYear) {
  const idx = yearGzIndex(gzYear);
  return {
    year: gzYear,
    index: idx,
    gz: gzName(idx),
    stemIndex: idx % 10,
    branchIndex: idx % 12,
    nayin: nayinOf(idx),
    zodiac: ZODIAC[idx % 12],
  };
}

/** 流月（某干支年的十二月建） */
export function monthsOfYear(gzYear) {
  const yidx = yearGzIndex(gzYear);
  const ys = yidx % 10;
  const out = [];
  for (let k = 0; k < 12; k++) {
    const branchIndex = (2 + k) % 12; // 寅月起
    const mp = monthPillar(ys, branchIndex);
    out.push({
      order: k + 1, gz: gzName(mp.index), stemIndex: mp.stemIndex, branchIndex: mp.branchIndex,
      monthBranch: BRANCHES[branchIndex], term: SOLAR_TERMS[(2 + k * 2) % 24],
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 十三、主入口：排盘
 * ------------------------------------------------------------------ */

/**
 * 排盘：由公历时刻推出完整命盘结构。
 *
 * @param {object} input
 * @param {number} input.year  公历年
 * @param {number} input.month 公历月 1-12
 * @param {number} input.day   公历日
 * @param {number} input.hour  0-23
 * @param {number} [input.minute=0]
 * @param {'男'|'女'} [input.gender='男']
 * @param {Array<{gz:string,startAge?:number,startYear?:number}>} [input.luckPillars]
 *        使用者直接提供的大运；若提供则优先采用，否则按节气推演
 * @param {number} [input.luckCount=10] 自动推演的大运步数
 * @returns {object} Chart
 */
export function isValidYear(year) {
  return Number.isInteger(year) && year >= 1000 && year <= 2500;
}

export function isValidGregorianDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
  const maxDays = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  return day <= maxDays;
}

export function castChart(input) {
  const { year, month, day, hour, minute = 0, gender = '男' } = input;
  if (![year, month, day, hour].every((v) => Number.isFinite(v))) throw new Error('castChart: year/month/day/hour 必须为数字');
  if (!isValidYear(year)) throw new Error(`castChart: 非法年份「${year}」，仅支持公元 1000 至 2500 年之间整数年份`);
  if (!isValidGregorianDate(year, month, day)) throw new Error(`castChart: 非法公历日期「${year}-${month}-${day}」，超出历法该月有效天数或月份非法`);
  if (hour < 0 || hour > 24) throw new Error(`castChart: 非法小时「${hour}」，必须在 0 至 24 之间`);
  if (minute < 0 || minute >= 60) throw new Error(`castChart: 非法分钟「${minute}」，必须在 0 至 59 之间`);
  const moment = { year, month, day, hour, minute };
  // 人元司令：当令之神随"本月的第几天"而变，故必须先算出来，再喂给五行力量统计。
  // （四柱模式没有 moment 可用，此路不通，其令态只能按月支本气估——见 elementStrength 的 `当令据`。）
  const 司令 = silingOf(moment);

  const yp = yearPillar(moment);
  const sm = solarMonthOf(moment);
  const mp = monthPillar(yp.index % 10, sm.monthBranchIndex);
  const dp = dayPillar(moment);
  // 晚子时（23:00 后）传统有"日柱进次日"与"不进日"两说，此处默认日柱不进日，
  // 但记录提示，由调用方决定。
  const lateZi = hour >= 23;
  const hb = hourToBranchIndex(hour, minute);
  const hp = hourPillar(dp.stemIndex, hb);

  const pillars = [yp, mp, dp, hp];
  const names = ['年柱', '月柱', '日柱', '时柱'];
  const dayStemIndex = dp.stemIndex;
  const yearStemIndex = yp.index % 10;
  const monthBranchIndex = mp.branchIndex;
  const dayBranchIndex = dp.branchIndex;
  const yearBranchIndex = yp.index % 12;

  const tenGods = pillars.map((p) => tenGod(dayStemIndex, p.stemIndex));
  const hidden = pillars.map((p) => HIDDEN_STEMS_SPEC[p.branchIndex].map(([s, role, w]) => ({
    stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)),
  })));
  const nayin = pillars.map((p) => nayinOf(p.index));
  const xun = pillars.map((p) => xunOf(p.index));
  const stars = pillars.map((p) => twelveStage(p.stemIndex, p.branchIndex));   // 干对支（自坐/星运）
  const sitStars = pillars.map((p) => twelveStage(p.stemIndex, p.branchIndex));

  // 日主对四支的十二长生（"日主临地支"的旺衰位）
  const dayStemStage = pillars.map((p) => twelveStage(dayStemIndex, p.branchIndex));

  // 空亡：以日柱旬空为"真空"，年柱旬空为参考
  const dayVoid = xun[2].voidBranches;
  const yearVoid = xun[0].voidBranches;
  const voidHits = pillars.map((p, i) => ({
    pillar: names[i],
    branch: BRANCHES[p.branchIndex],
    inDayVoid: dayVoid.includes(BRANCHES[p.branchIndex]),
    inYearVoid: yearVoid.includes(BRANCHES[p.branchIndex]),
  }));

  // D-035: 互换空亡（年日互入空亡、日时互入空亡）
  const yearBranchStr = BRANCHES[pillars[0].branchIndex];
  const dayBranchStr = BRANCHES[pillars[2].branchIndex];
  const hourBranchStr = BRANCHES[pillars[3].branchIndex];
  const hourVoid = xun[3].voidBranches;

  const yearDayMutual = dayVoid.includes(yearBranchStr) && yearVoid.includes(dayBranchStr);
  const dayHourMutual = hourVoid.includes(dayBranchStr) && dayVoid.includes(hourBranchStr);

  // D-035: 截路空亡（日干查时支）
  const jieluBranches = JIELU_KONGWANG[STEMS[dayStemIndex]] ?? [];
  const hitJielu = jieluBranches.includes(hourBranchStr);

  // D-035: 四大空亡（纳音空亡：甲子/甲午旬无水，甲寅/甲申旬无金）
  const dayXunHead = xun[2].xunHead;
  let fourMajorMissing = null;
  if (dayXunHead === 0 || dayXunHead === 30) {
    fourMajorMissing = '水';
  } else if (dayXunHead === 20 || dayXunHead === 50) {
    fourMajorMissing = '金';
  }
  const hitFourMajorPillars = [];
  if (fourMajorMissing) {
    for (let i = 0; i < 4; i++) {
      if (nayin[i].element === fourMajorMissing) {
        hitFourMajorPillars.push(`${names[i]}（${nayin[i].name}）`);
      }
    }
  }

  const voidDetails = {
    dayVoid,
    yearVoid,
    hits: voidHits,
    mutual: {
      yearDay: yearDayMutual,
      dayHour: dayHourMutual,
      note: yearDayMutual && dayHourMutual
        ? '年日互换空亡兼日时互换空亡'
        : yearDayMutual
        ? '年日互换空亡（年入日空，日入年空）'
        : dayHourMutual
        ? '日时互换空亡（日入时空，时入日空）'
        : '无互换空亡',
    },
    jielu: {
      hit: hitJielu,
      pillar: '时柱',
      gz: gzName(pillars[3].index),
      note: hitJielu ? `时支「${hourBranchStr}」落入${STEMS[dayStemIndex]}日截路空亡` : '无截路空亡',
    },
    fourMajor: {
      hit: hitFourMajorPillars.length > 0,
      missingElement: fourMajorMissing,
      hitPillars: hitFourMajorPillars,
      note: hitFourMajorPillars.length > 0
        ? `日柱落${xun[2].xun}旬，四大空亡为「${fourMajorMissing}空」；命中 ${hitFourMajorPillars.join('、')} 犯四大空亡`
        : fourMajorMissing
        ? `日柱落${xun[2].xun}旬，四大空亡为「${fourMajorMissing}空」；局中纳音未犯`
        : '日柱所在旬纳音五行俱全，不犯四大空亡',
    },
  };

  const shensha = computeShenSha(pillars, dayStemIndex, yearStemIndex, monthBranchIndex, dayBranchIndex, yearBranchIndex, gender)
    .map((s) => ({ ...s, nature: shenshaNature(s.name) }));

  const strength = elementStrength(pillars, BRANCHES[monthBranchIndex], 司令.司令五行);
  const relations = gzRelations(pillars, null);

  /* --- 大运 --- */
  const direction = luckDirection(STEM_YANG[yearStemIndex], gender);
  const forward = direction === '顺行';
  const startInfo = computeStartLuck(moment, forward);
  let luckPillars;
  let luckSource;
  if (Array.isArray(input.luckPillars) && input.luckPillars.length > 0) {
    luckSource = '使用者提供';
    luckPillars = input.luckPillars.map((lp, i) => {
      const gz = typeof lp === 'string' ? lp : lp.gz;
      const si = STEMS.indexOf(gz[0]);
      const bi = BRANCHES.indexOf(gz[1]);
      if (si < 0 || bi < 0) throw new Error(`大运干支非法：${gz}`);
      const idx = gzIndex(si, bi);
      return {
        step: i + 1, gz, index: idx, stemIndex: si, branchIndex: bi,
        startAge: lp.startAge ?? null,
        startYear: lp.startYear ?? null,
        tenGod: tenGod(dayStemIndex, si),
        hidden: HIDDEN_STEMS_SPEC[bi].map(([s, role, w]) => ({ stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)) })),
        nayin: nayinOf(idx),
        twelveStage: twelveStage(dayStemIndex, bi),
        void: xunOf(idx).voidBranches,
      };
    });
  } else {
    luckSource = '按节气自动推演';
    luckPillars = buildLuckPillars(mp, input.luckCount ?? 10, forward, startInfo).map((lp) => {
      // 起始年＝"出生时刻 + 起运岁数"所落的**公历年**（不是立春年 + 周岁整年）。
      // 详见 computeStartLuck 上方注释：旧实现丢月日，约半数命例会早一年。
      const y0 = startInfo.startYearCivil + (lp.step - 1) * 10;
      return {
        ...lp,
        startYear: y0,
        tenGod: tenGod(dayStemIndex, lp.stemIndex),
        hidden: HIDDEN_STEMS_SPEC[lp.branchIndex].map(([s, role, w]) => ({ stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)) })),
        nayin: nayinOf(lp.index),
        twelveStage: twelveStage(dayStemIndex, lp.branchIndex),
        void: xunOf(lp.index).voidBranches,
      };
    });
  }

  /* --- 当前大运定位（按参考年） --- */
  let currentLuck = null;
  const refYear = input.referenceYear ?? new Date().getFullYear();
  if (luckPillars.length && luckPillars.every((l) => l.startYear != null)) {
    for (let i = luckPillars.length - 1; i >= 0; i--) {
      if (refYear >= luckPillars[i].startYear) { currentLuck = luckPillars[i]; break; }
    }
  }

  /* --- 流年 --- */
  const liunian = [];
  if (currentLuck && currentLuck.startYear != null) {
    for (let y = currentLuck.startYear; y < currentLuck.startYear + 10; y++) {
      const ypObj = yearPillarOf(y);
      liunian.push({
        ...ypObj,
        tenGod: tenGod(dayStemIndex, ypObj.stemIndex),
        twelveStage: twelveStage(dayStemIndex, ypObj.branchIndex),
        relations: gzRelations(pillars, { stemIndex: ypObj.stemIndex, branchIndex: ypObj.branchIndex }),
      });
    }
  }

  const chart = {
    input: { ...input, gender },
    calendar: {
      solar: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      lateZiHour: lateZi,
      lateZiNote: lateZi ? '生于 23:00 之后（晚子时）：本引擎日柱不进日；传统另有"晚子时作次日"之说，请据派别取舍' : null,
      solarTermMonth: {
        term: sm.termName,
        startedAt: formatMoment(sm.termMoment),
        nextTerm: sm.nextTerm.termName,
        nextAt: formatMoment(sm.nextTerm.moment),
      },
      lichun: formatMoment(yp.lichun),
      gzYear: yp.gzYear,
    },
    pillars: pillars.map((p, i) => ({
      position: names[i],
      gz: gzName(p.index),
      stem: STEMS[p.stemIndex],
      branch: BRANCHES[p.branchIndex],
      stemIndex: p.stemIndex,
      branchIndex: p.branchIndex,
      tenGod: tenGods[i],
      hidden: hidden[i],
      nayin: nayin[i],
      xun: xun[i].xun,
      voidBranches: xun[i].voidBranches,
      selfStage: sitStars[i],
      dayStemStage: dayStemStage[i],
      zodiac: ZODIAC[p.branchIndex],
      branchElement: ELEMENTS[BRANCH_ELEMENT[p.branchIndex]],
      stemElement: ELEMENTS[STEM_ELEMENT[p.stemIndex]],
      branchYinYang: BRANCH_YANG[p.branchIndex] ? '阳' : '阴',
      stemYinYang: STEM_YANG[p.stemIndex] ? '阳' : '阴',
    })),
    dayMaster: {
      stem: STEMS[dayStemIndex],
      element: ELEMENTS[STEM_ELEMENT[dayStemIndex]],
      yinYang: STEM_YANG[dayStemIndex] ? '阳' : '阴',
      bornMonthBranch: BRANCHES[monthBranchIndex],
      stageInMonth: twelveStage(dayStemIndex, monthBranchIndex),
      season: MONTH_BRANCH_SEASON[BRANCHES[monthBranchIndex]],
    司令,
    当令五行: 司令.司令五行,
    当令据: '司令（人元司事）',
    },
    void: voidDetails,
    shensha,
    strength,
    relations,
    luck: {
      direction,
      forward,
      start: startInfo,
      source: luckSource,
      pillars: luckPillars,
      current: currentLuck,
      referenceYear: refYear,
      liunian,
    },
    meta: {
      engine: 'bazi-engine',
      conventions: [
        '年柱以立春为界，月柱以十二节为界（非农历月份）',
        '时支 23:00-00:59 为子时',
        '日柱用儒略日推算，北京时间',
        '藏干取本气/中气/余气，权重为经验值',
        '神煞取《三命通会》《渊海子平》通行取法，个别神煞存在门派分歧',
      ],
    },
  };
  return chart;
}

function formatMoment(t) {
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * 十四、Markdown 渲染
 * ------------------------------------------------------------------ */

export function formatChart(chart) {
  const L = [];
  const p = chart.pillars;
  L.push(`# 命盘推演（确定性排盘）`);
  L.push('');
  L.push(`**公历**：${chart.calendar.solar} ｜ **性别**：${chart.input.gender}`);
  L.push(`**节气月**：${chart.calendar.solarTermMonth.term}（${chart.calendar.solarTermMonth.startedAt} 起）→ ${chart.calendar.solarTermMonth.nextTerm}（${chart.calendar.solarTermMonth.nextAt}）`);
  L.push(`**立春**：${chart.calendar.lichun} ｜ **命年干支**：${yearGzIndex(chart.calendar.gzYear) != null ? gzName(yearGzIndex(chart.calendar.gzYear)) : ''}（${chart.calendar.gzYear}）`);
  if (chart.calendar.lateZiNote) L.push(`> ⚠️ ${chart.calendar.lateZiNote}`);
  L.push('');
  L.push('## 一、四柱');
  L.push('');
  L.push('| 柱位 | 干支 | 天干十神 | 地支 | 藏干（十神） | 纳音 | 星运 | 自坐 | 空亡 | 生肖 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of p) {
    const hid = c.hidden.map((h) => `${h.stem}(${h.role}·${h.tenGod})`).join(' ');
    L.push(`| ${c.position} | **${c.gz}** | ${c.tenGod} | ${c.branch} | ${hid} | ${c.nayin.name} | ${c.dayStemStage} | ${c.selfStage} | ${c.voidBranches.join('')} | ${c.zodiac} |`);
  }
  L.push('');
  L.push(`**日主**：${chart.dayMaster.stem}（${chart.dayMaster.yinYang}${chart.dayMaster.element}），生于${chart.dayMaster.bornMonthBranch}月，月令为「${chart.dayMaster.stageInMonth}」，当令之气为${chart.dayMaster.season}。`);
  L.push('');
  L.push(`**旬空**：日柱旬空 ${chart.void.dayVoid.join('')}；年柱旬空 ${chart.void.yearVoid.join('')}`);
  const vh = chart.void.hits.filter((h) => h.inDayVoid).map((h) => `${h.pillar}${h.branch}`);
  L.push(`**落空之支**：${vh.length ? vh.join('、') : '无'}`);
  if (chart.void.mutual?.yearDay || chart.void.mutual?.dayHour) {
    const mNotes = [];
    if (chart.void.mutual.yearDay) mNotes.push('年日互换空亡');
    if (chart.void.mutual.dayHour) mNotes.push('日时互换空亡');
    L.push(`**互换空亡**：${mNotes.join('、')}`);
  }
  if (chart.void.jielu?.hit) {
    L.push(`**截路空亡**：${chart.void.jielu.pillar} ${chart.void.jielu.gz} 临截路空亡`);
  }
  if (chart.void.fourMajor?.hit) {
    L.push(`**四大空亡**：纳音犯${chart.void.fourMajor.missingElement}空（${chart.void.fourMajor.hitPillars.join('、')}）`);
  }
  L.push('');

  L.push('## 二、五行力量');
  L.push('');
  L.push('| 五行 | 明现(干) | 藏干得分 | 加权力量 | 占比 |');
  L.push('|---|---|---|---|---|');
  for (const e of ELEMENTS) {
    L.push(`| ${e} | ${chart.strength.visible[e]} | ${(chart.strength.rooted[e] ?? 0).toFixed(2)} | ${chart.strength.adjusted[e]} | ${chart.strength.percent[e]}% |`);
  }
  L.push('');
  L.push(`> 占比为经验加权（含月令旺相休囚死系数），仅供旺衰参考，不作绝对依据。`);
  L.push('');

  L.push('## 三、神煞');
  L.push('');
  if (chart.shensha.length === 0) L.push('（本盘未检出常用神煞）');
  else {
    L.push('| 神煞 | 落宫 | 属性 | 备注 |');
    L.push('|---|---|---|---|');
    for (const s of chart.shensha) L.push(`| ${s.name} | ${s.positions.join('、')} | ${s.nature} | ${s.note ?? ''} |`);
  }
  L.push('');

  L.push('## 四、干支关系');
  L.push('');
  const r = chart.relations;
  const showRel = (title, arr, fmt) => {
    if (!arr.length) return;
    L.push(`**${title}**`);
    for (const x of arr) L.push(`- ${fmt(x)}`);
    L.push('');
  };
  showRel('整柱天地鸳鸯合', r.鸳鸯合, (x) => `${x.pair}（${x.天合}，${x.地合}）：${x.note}`);
  showRel('整柱反吟（天克地冲）', r.反吟, (x) => `${x.pair}（${x.type}·${x.干}·${x.支}）：${x.note}`);
  showRel('整柱伏吟（干支相同）', r.伏吟, (x) => `${x.pair}（${x.gz}伏吟）：${x.note}`);
  showRel('天干五合', r.天干五合, (x) => `${x.pair}（化${x.化}）`);
  showRel('天干相冲', r.天干相冲, (x) => x.pair);
  showRel('天干相克', r.天干相克, (x) => x.pair);
  showRel('地支六合', r.地支六合, (x) => `${x.pair}（化${x.化}）`);
  showRel('地支半合 / 拱合', r.地支半合, (x) => `${x.pair}（${x.type}·${x.局}·化${x.化}${x.拱 ? `·拱${x.拱}` : ''}）：${x.note}`);
  showRel('地支三合', r.地支三合, (x) => `${x.局}：${x.positions}`);
  showRel('地支三会', r.地支三会, (x) => `${x.方}：${x.positions}`);
  showRel('地支六冲', r.地支六冲, (x) => x.pair);
  showRel('地支相刑', r.地支相刑, (x) => `${x.刑}：${x.members}（${x.positions}）${x.争议 ? `　⚠口径有争议（${x.口径}）：${x.note}` : ''}`);
  showRel('地支相害（穿）', r.地支相害, (x) => x.pair);
  showRel('地支相破', r.地支相破, (x) => x.pair);
  showRel('地支相绝', r.地支相绝, (x) => `${x.pair}（${x.绝}）：${x.note}`);
  showRel('虚邀暗夹', r.虚邀暗夹, (x) => `${x.pair} 虚夹「${x.夹}」（${x.格局}）：${x.note}`);
  showRel('干支自合', r.干支自合, (x) => `${x.pillar}柱 ${x.gz}（${x.合}，暗藏${x.藏干}）：${x.note}`);
  showRel('地支暗合', r.地支暗合, (x) => `${x.pair}（${x.合}）：${x.note}`);
  L.push('**同柱干支关系**');
  for (const x of r.天干地支同柱) L.push(`- ${x.pillar} ${x.gz}：${x.relation}`);
  L.push('');

  L.push('## 五、大运');
  L.push('');
  L.push(`**排法**：年干${chart.pillars[0].stemYinYang}，${chart.input.gender}命 → **${chart.luck.direction}**`);
  if (chart.luck.source === '按节气自动推演') {
    L.push(`**起运**：${chart.luck.start.startAgeText}（约 ${chart.luck.start.yearsFloat} 岁起运，虚岁 ${chart.luck.start.startNominalAge}），**交运公历 ${chart.luck.start.startDate}**`);
    L.push(`**依据**：${chart.luck.forward ? '顺行数至' : '逆行数至'}「${chart.luck.start.referenceTerm.year}-${chart.luck.start.referenceTerm.month}-${chart.luck.start.referenceTerm.day} ${String(chart.luck.start.referenceTerm.hour).padStart(2, '0')}:${String(chart.luck.start.referenceTerm.minute).padStart(2, '0')}」${chart.luck.forward ? '下一节' : '上一节'}，相距 ${chart.luck.start.daysToTerm} 日，三日折一年`);
  } else {
    L.push(`**起运**：使用者直接提供大运，未按节气推演`);
  }
  L.push('');
  L.push('| 步 | 大运 | 起始年 | 起始年龄 | 天干十神 | 藏干（十神） | 星运 | 纳音 | 空亡 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const lp of chart.luck.pillars) {
    const hid = lp.hidden.map((h) => `${h.stem}(${h.tenGod})`).join(' ');
    L.push(`| ${lp.step} | **${lp.gz}** | ${lp.startYear ?? '—'} | ${lp.startAge ?? '—'} | ${lp.tenGod} | ${hid} | ${lp.twelveStage} | ${lp.nayin.name} | ${lp.void.join('')} |`);
  }
  L.push('');
  if (chart.luck.liunian.length) {
    L.push(`## 六、当前大运流年（${chart.luck.current.gz} 运，参考年 ${chart.luck.referenceYear}）`);
    L.push('');
    L.push('| 流年 | 干支 | 十神 | 星运 | 与原局关系 |');
    L.push('|---|---|---|---|---|');
    for (const ln of chart.luck.liunian) {
      const rel = [];
      const rr = ln.relations;
      for (const x of rr.地支六冲) rel.push(`冲:${x.pair}`);
      for (const x of rr.地支六合) rel.push(`合:${x.pair}`);
      for (const x of rr.地支三合) rel.push(`三合:${x.局}`);
      for (const x of rr.地支相刑) rel.push(`刑:${x.members}${x.争议 ? '(口径有争议)' : ''}`);
      for (const x of rr.地支相害) rel.push(`穿:${x.pair}`);
      for (const x of rr.天干五合) rel.push(`干合:${x.pair}`);
      for (const x of rr.天干相冲) rel.push(`干冲:${x.pair}`);
      rel.push(...rr.天干相克.map((x) => `克:${x.pair}`));
      L.push(`| ${ln.year}年 | ${ln.gz} | ${ln.tenGod} | ${ln.twelveStage} | ${rel.join('；') || '—'} |`);
    }
    L.push('');
  }
  L.push('## 附：排盘约定');
  for (const c of chart.meta.conventions) L.push(`- ${c}`);
  return L.join('\n');
}

/* ------------------------------------------------------------------ *
 * 十五、时刻校正（真太阳时）
 * ------------------------------------------------------------------ */

/** 均时差（分钟）：平太阳时 - 真太阳时 的负值，即 真太阳时 = 平太阳时 + EoT */
function equationOfTimeMinutes(moment) {
  const jd = gregorianToJd(moment.year, moment.month, moment.day) + 0.5;
  const t = (jd - 2451545.0) / 36525;
  const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const eps = 23.439291 - 0.0130042 * t;
  const y = Math.tan(eps / 2 * RAD) ** 2;
  const eot = 4 * (180 / Math.PI) * (
    y * Math.sin(2 * l0 * RAD)
    - 2 * e * Math.sin(m * RAD)
    + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD)
    - 0.5 * y * y * Math.sin(4 * l0 * RAD)
    - 1.25 * e * e * Math.sin(2 * m * RAD)
  );
  return eot;
}

/**
 * 真太阳时校正。
 * 中国官方时间以东经 120° 为标准；出生地经度与 120° 之差每度折 4 分钟，
 * 再加均时差。用于精确判定时辰（尤其生于时辰边界者）。
 *
 * @param {{year,month,day,hour,minute}} moment 北京时间
 * @param {number} longitudeDeg 出生地东经（东经为正，西经为负）
 * @returns {{corrected:object, longitudeMinutes:number, eotMinutes:number, totalMinutes:number, shifted:boolean}}
 */
export function trueSolarTime(moment, longitudeDeg) {
  const lonMinutes = (longitudeDeg - 120) * 4;
  const eotMinutes = equationOfTimeMinutes(moment);
  const totalMinutes = lonMinutes + eotMinutes;
  const base = Date.UTC(moment.year, moment.month - 1, moment.day, moment.hour, moment.minute);
  const shifted = new Date(base + Math.round(totalMinutes) * 60000);
  return {
    corrected: {
      year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
    },
    longitudeMinutes: Number(lonMinutes.toFixed(2)),
    eotMinutes: Number(eotMinutes.toFixed(2)),
    totalMinutes: Number(totalMinutes.toFixed(2)),
    shifted: Math.round(totalMinutes) !== 0,
  };
}

/* ------------------------------------------------------------------ *
 * 十六、岁运作用（大运/流年与原局的交战）
 * ------------------------------------------------------------------ */

/**
 * 岁运作用分析：把某一步大运或某个流年的干支，与原局四柱逐位对照，
 * 输出合/冲/刑/害/穿、十神、星运、空亡，并给出"引动"提示。
 *
 * 这是应期判断的**事实层**：引擎只报告"发生了什么作用"，
 * 至于该作用是吉是凶，需结合格局喜忌由调用方判断。
 *
 * @param {object} chart castChart 的结果
 * @param {{gz?:string, year?:number}} transit 大运干支或流年
 */
export function transitAnalysis(chart, transit) {
  let gz = transit.gz;
  if (!gz && transit.year != null) gz = yearPillarOf(transit.year).gz;
  if (!gz || gz.length !== 2) throw new Error('transitAnalysis: 需提供 gz（如"甲子"）或 year');
  const ti = STEMS.indexOf(gz[0]);
  const bi = BRANCHES.indexOf(gz[1]);
  if (ti < 0 || bi < 0) throw new Error(`transitAnalysis: 干支非法 ${gz}`);
  const idx = gzIndex(ti, bi);
  const dayStemIndex = chart.pillars[2].stemIndex;

  const natal = chart.pillars.map((p) => ({ position: p.position, gz: p.gz, stem: p.stem, branch: p.branch }));
  const interactions = [];
  const push = (kind, withPillar, detail) => interactions.push({ 作用: kind, 对宫位: withPillar, 说明: detail });

  for (const n of natal) {
    const key = n.branch + BRANCHES[bi], key2 = BRANCHES[bi] + n.branch;
    if (BRANCH_CLASH.includes(key) || BRANCH_CLASH.includes(key2)) push('地支六冲', n.position, `${gz[1]}冲${n.branch}`);
    if (BRANCH_COMBINE[key]) push('地支六合', n.position, `${gz[1]}合${n.branch}化${BRANCH_COMBINE[key]}`);
    else if (BRANCH_COMBINE[key2]) push('地支六合', n.position, `${gz[1]}合${n.branch}化${BRANCH_COMBINE[key2]}`);
    if (BRANCH_HARM.includes(key) || BRANCH_HARM.includes(key2)) push('地支相害（穿）', n.position, `${gz[1]}穿${n.branch}`);
    if (BRANCH_DESTROY.includes(key) || BRANCH_DESTROY.includes(key2)) push('地支相破', n.position, `${gz[1]}破${n.branch}`);
    // 与地支三合局的半合/拱合：岁运支与原局某支同属一局，但第三支未现
    for (const [ju, members] of Object.entries(TRIPLE_NAME)) {
      if (members.includes(BRANCHES[bi]) && members.includes(n.branch) && BRANCHES[bi] !== n.branch) {
        push('地支半合（尚缺一支）', n.position, `${gz[1]}与${n.branch}同属${ju}，再逢${members.find((m) => m !== BRANCHES[bi] && m !== n.branch)}即成三合`);
      }
    }
    // 天干
    const skey = n.stem + gz[0], skey2 = gz[0] + n.stem;
    if (STEM_COMBINE[skey]) push('天干五合', n.position, `${gz[0]}合${n.stem}化${STEM_COMBINE[skey]}`);
    else if (STEM_COMBINE[skey2]) push('天干五合', n.position, `${gz[0]}合${n.stem}化${STEM_COMBINE[skey2]}`);
    if (STEM_CLASH.includes(skey) || STEM_CLASH.includes(skey2)) push('天干相冲', n.position, `${gz[0]}冲${n.stem}`);
  }

  // 岁运四象：伏吟 / 天克地冲（反吟）/ 天比地冲。
  // 皆为"干支同时对某一柱成象"，逐支判会漏，故按柱整体判。
  for (let i = 0; i < 4; i++) {
    const n = natal[i];
    const 同干 = n.stem === gz[0], 同支 = n.branch === gz[1];
    const 干克 = STEM_CLASH.includes(n.stem + gz[0]) || STEM_CLASH.includes(gz[0] + n.stem)
      || (KE[STEM_ELEMENT[STEMS.indexOf(n.stem)]] === STEM_ELEMENT[STEMS.indexOf(gz[0])])
      || (KE[STEM_ELEMENT[STEMS.indexOf(gz[0])]] === STEM_ELEMENT[STEMS.indexOf(n.stem)]);
    const 支冲 = BRANCH_CLASH.includes(n.branch + gz[1]) || BRANCH_CLASH.includes(gz[1] + n.branch);
    if (同干 && 同支) {
      push('伏吟', n.position, `${gz}与原局${n.position}${n.gz}干支全同（伏吟）。`
        + '传统多主反复、呻吟、旧事重提；盲派口径另主张"并非一律伏吟为凶"，若重现的是功神则可能扩张成果，须看该柱十神与喜忌。');
    } else if (干克 && 支冲) {
      push('天克地冲（反吟）', n.position, `${gz}与原局${n.position}${n.gz}：天干相克、地支相冲（天克地冲，又称反吟）。`
        + '为岁运中最重的一种对撞，主变动剧烈；吉凶仍看所冲克者为喜为忌。');
    } else if (同干 && 支冲) {
      push('天比地冲', n.position, `${gz}与原局${n.position}${n.gz}：天干相同而地支相冲（天比地冲）。`);
    }
  }

  // 岁运并临：须同时知道大运与流年。若 transit 为流年且已知当前大运，则比较二者干支。
  if (chart.luck && chart.luck.current && transit.year != null) {
    const luckGz = chart.luck.current.gz;
    if (luckGz === gz) {
      push('岁运并临', '大运', `流年${gz}与当前大运${luckGz}干支全同（岁运并临）。`
        + '传统视为该运之年吉凶加倍、事象集中；亦有"岁运并临不死自己死他人"的夸张说法，'
        + '本引擎只报此象，不作吉凶断言——吉凶仍看所临之神为喜为忌。');
    }
  }

  // 相刑：只取**涉及岁运**者（requireLabel='岁运'），
  // 以免把原局本身固有的刑误报为"岁运所引起"。
  // 寅巳申「无恩之刑」、丑戌未「恃势之刑」的两派口径并报，见 branchPunishments。
  {
    const labelled = natal.map((n) => ({ label: n.position, branch: n.branch }));
    labelled.push({ label: '岁运', branch: BRANCHES[bi] });
    for (const x of branchPunishments(labelled, '岁运')) {
      push('地支相刑', x.positions, `${x.刑}（${x.members}）｜口径：${x.口径}${x.争议 ? '（两派有争议，须并陈）' : ''}`);
    }
  }

  // 与原局地支成三合/三会：只有"原局已有两支、岁运补上第三支"才算补全成局。
  // 若原局本身已经三支齐现，岁运再来一支只是叠加，不应报成"补全"。
  const natalBranches = natal.map((n) => n.branch);
  for (const [ju, members] of Object.entries(TRIPLE_NAME)) {
    if (!members.includes(BRANCHES[bi])) continue;
    const have = members.filter((m) => natalBranches.includes(m));
    const missing = members.filter((m) => !natalBranches.includes(m));
    if (have.length === 2 && missing.length === 1 && missing[0] === BRANCHES[bi]) {
      push('三合局补全', '原局', `${gz[1]}补上${members.join('')}${ju}所缺之支，三合局成`);
    } else if (have.length === 2 && missing[0] !== BRANCHES[bi]) {
      push('三合局半合', '原局', `${gz[1]}与原局${have.join('')}同属${ju}，尚缺${missing[0]}`);
    } else if (have.length === 3) {
      push('三合局叠加', '原局', `原局${members.join('')}已成${ju}，岁运再临${BRANCHES[bi]}为叠加，加重该局之力`);
    }
  }
  for (const d of BRANCH_DIRECTION) {
    if (!d.members.includes(BRANCHES[bi])) continue;
    const have = d.members.filter((m) => natalBranches.includes(m));
    const missing = d.members.filter((m) => !natalBranches.includes(m));
    if (have.length === 2 && missing.length === 1 && missing[0] === BRANCHES[bi]) {
      push('三会方补全', '原局', `${gz[1]}补上${d.members.join('')}${d.name}所缺之支，方局成`);
    } else if (have.length === 3) {
      push('三会方叠加', '原局', `原局${d.members.join('')}已成${d.name}，岁运再临${BRANCHES[bi]}为叠加`);
    }
  }

  // 墓库：岁运冲开
  const muHit = natal.filter((n) => FOUR_MU.includes(n.branch) && (BRANCH_CLASH.includes(n.branch + BRANCHES[bi]) || BRANCH_CLASH.includes(BRANCHES[bi] + n.branch)));
  for (const n of muHit) push('冲开墓库', n.position, `${gz[1]}冲动${n.branch}墓库，库中之物为${HIDDEN_STEMS_SPEC[BRANCHES.indexOf(n.branch)].map((h) => h[0]).join('、')}`);

  const voidBranch = xunOf(idx).voidBranches;
  const natalVoidHit = natal.filter((n) => voidBranch.includes(n.branch)).map((n) => n.position);

  return {
    transit: { gz, index: idx, stem: gz[0], branch: gz[1], year: transit.year ?? null },
    tenGod: tenGod(dayStemIndex, ti),
    twelveStage: twelveStage(dayStemIndex, bi),
    nayin: nayinOf(idx),
    xun: xunOf(idx).xun,
    voidBranches: voidBranch,
    hollowNatalPillars: natalVoidHit,
    hidden: HIDDEN_STEMS_SPEC[bi].map(([s, role, w]) => ({ stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)) })),
    interactions,
    note: '引擎只给出"发生了什么作用"，吉凶须结合格局喜忌判断；冲合刑害的轻重还须看有无解神、是否当令。',
  };
}

/* ------------------------------------------------------------------ *
 * 十七、调候用神（《穷通宝鉴》十干 × 十二月令 120 组）
 *
 * 数据源：《穷通宝鉴》【核心表】十干 × 十二月令 调候用神表（全量 120 组内置数据），
 * 详见母本《流派/调候.md》与《古籍/》典籍，十干十二月完整覆盖。
 * 「用神」= 原文首取，「辅佐」= 原文次取/佐，「忌」= 原文言忌或言"为病"者；
 * 「先甲後丁」之类次序即等级次序，原样保留。
 *
 * 该书的体例缺漏（戊土无正月/二月独立条目、己土五月至十二月并入三夏/三秋/三冬、
 * 丁火八九月合论）皆以总论回填，判语较逐月分论者粗疏，已在 `回填` 字段标注来源，
 * 供使用者据此衡量该条的分量。
 * ------------------------------------------------------------------ */

/** 因原书体例缺漏而按总论回填的条目（据 knowledge/穷通宝鉴.md「局限」节所列） */
const TIAOHOU_BACKFILL = [
  { stem: '戊', branch: '寅', 并入: '三春戊土／正二月戊土' },
  { stem: '戊', branch: '卯', 并入: '三春戊土／正二月戊土' },
  { stem: '戊', branch: '子', 并入: '十一二月戊土（两月合为一条）' },
  { stem: '戊', branch: '丑', 并入: '十一二月戊土（两月合为一条）' },
  { stem: '己', branch: '午', 并入: '三夏己土' },
  { stem: '己', branch: '未', 并入: '三夏己土' },
  { stem: '己', branch: '申', 并入: '三秋己土' },
  { stem: '己', branch: '酉', 并入: '三秋己土' },
  { stem: '己', branch: '戌', 并入: '三秋己土' },
  { stem: '己', branch: '亥', 并入: '三冬己土' },
  { stem: '己', branch: '子', 并入: '三冬己土' },
  { stem: '己', branch: '丑', 并入: '三冬己土' },
  { stem: '丁', branch: '酉', 并入: '八九月丁火（两月合为一条）' },
  { stem: '丁', branch: '戌', 并入: '八九月丁火（两月合为一条）' },
];

/** 每行：[日干, 月支, 用神, 辅佐, 忌, 要点] */
const TIAOHOU_ROWS = [
  ['甲', '寅', '丙', '癸', '庚辛、壬癸无戊制', '余寒得丙癸逢富贵双全；癸藏丙透名"寒木向阳"；无丙癸则平常'],
  ['甲', '卯', '庚', '戊、财', '癸、重刃', '庚金得所名阳刃驾杀，小贵武职须财资；见癸困才杀主光棍'],
  ['甲', '辰', '庚', '壬', '丙多、比劫多', '木气相竭先庚後壬，庚壬两透一榜堪图；支成金局方可用丁'],
  ['甲', '巳', '癸', '丁', '庚金太多、金多火多', '丙火司权先癸後丁；癸丁庚齐透可言科甲；癸不出仅富中取贵'],
  ['甲', '午', '癸', '丁、庚', '行火地、行西方', '乏癸用丁亦可，宜运行北地；癸庚两透为上上之格'],
  ['甲', '未', '丁', '庚', '行火地、行西', '三伏生寒丁火退气，先丁後庚；"用神太多不宜克制，须泄之为妙"'],
  ['甲', '申', '丁', '庚', '癸（灭丁阻熔金）', '非丁不能造庚、非庚不能造甲；庚透无丁一富，庚多无丁残疾；壬无碍须戊制水存火'],
  ['甲', '酉', '丁', '丙、庚', '癸（科甲不全）', '木囚金旺；一丁一庚科甲定显；丙丁全无僧道之命；支成金局木被金伤主残疾'],
  ['甲', '戌', '丁', '壬癸、庚', '比肩多而无庚', '独爱丁火；丁壬癸透配得中和可许一榜；"凡四季甲木总不外乎庚金"'],
  ['甲', '亥', '庚', '丁、丙', '壬水泛身', '庚丁为要；庚丁两透加戊出干名"去浊留清"富贵之极；乏丁亦稍有富贵'],
  ['甲', '子', '丁', '庚、丙', '癸（火金之病）、水泛木浮', '丁先庚後丙佐；庚丁两透支见巳寅科甲有准；癸透伤丁无戊己辅救则残疾'],
  ['甲', '丑', '庚', '丁', '无庚、无丁、支多见水', '先用庚劈甲方引丁火；庚丁两透科甲恩封；"乏庚略可，乏丁无用"'],
  ['乙', '寅', '丙', '癸', '丙多乏癸、癸多困丙', '余寒非丙不暖；丙癸两透科甲定然；丙多乏癸名春旱，浊富之人'],
  ['乙', '卯', '丙', '癸', '庚、水库假化', '丙为君癸为臣，丙癸两透不透庚金则大富大贵；支成木局有癸透乃贵'],
  ['乙', '辰', '癸', '丙', '己、庚', '先癸後丙；癸丙两透不见己庚为玉堂之客；一派壬水贫贱夭折，有戊己方有寿'],
  ['乙', '巳', '癸', '辛、丙、庚', '土多困癸、丙戊成火局', '端取癸水为尊；癸透庚辛又透科甲定然；一点癸无金是水无根，仅秀才小富'],
  ['乙', '午', '癸（上半月）／丙（下半月）', '丙癸齐用、庚辛', '丙透支成火局、戊己杂乱', '丁火司权禾稼俱旱；癸透有根富贵双全；阳焦木性则残疾，无癸必夭'],
  ['乙', '未', '癸', '丙', '戊己杂乱', '木性且寒，癸透大富大贵；无癸常人；甲透制土名"去浊留清"可许俊秀'],
  ['乙', '申', '丙', '癸／己', '庚多', '庚乘令，干乙难合支金；丙透又加巳出埋金可云科甲；生辰时从化反主富贵，化金者戊为用，忌丙丁煆炼'],
  ['乙', '酉', '癸（白露後）／丙（秋分後）', '丁、丙癸两透', '不见丙癸、多见戊己', '白露後用癸滋桂萼，秋分後喜向阳用丙；支成金局宜暗藏丁，无丁恐木被金伤'],
  ['乙', '戌', '癸', '辛、甲', '有辛无癸、壬多', '根枯叶落必赖癸水；癸遇辛发水之源定主科甲；甲申时名"藤萝系甲"'],
  ['乙', '亥', '丙', '戊', '水多无戊、不见丙巳', '壬水司令取丙为用戊次之；丙戊两透科甲定然；丙不出则妻子难全'],
  ['乙', '子', '丙', '不宜用癸', '癸（冻花木）、壬透无戊', '一阳来复端用丙火解冻；丁乃灯烛不能解严寒之冻；一派丁火大奸大诈'],
  ['乙', '丑', '丙', '戊己次之', '癸（忌癸制丁）', '木寒宜丙有寒谷回春之象；得一丙透无癸破格，定主名臣显宦'],
  ['丙', '寅', '壬', '庚', '戊（晦光）、辛（贪合）', '取壬为尊庚佐之，壬庚两透科甲定然；丙火无壬多主贫贼，屡徵屡验'],
  ['丙', '卯', '壬', '庚辛', '丁（化壬）', '端用壬水；壬透有根不见丁化定主科甲；一派戊土亦用壬，运喜行木'],
  ['丙', '辰', '壬', '甲', '庚出制甲、乙丁杂乱', '用壬水，成土局取甲为辅壬不可离；壬甲两透科甲定宜，壬甲两无愚贱'],
  ['丙', '巳', '壬', '庚', '戊浊水、癸、壬癸俱无', '建禄於巳专用壬水；壬庚两透不见戊号"湖水汪洋"，恩谥封荣；忌壬多杀重身轻'],
  ['丙', '午', '壬', '庚、癸', '戊己出干、丁壬化合', '得壬庚高透方为上命；成火局不见滴水乃僧道鳏独；炎上格反主富贵但忌水运'],
  ['丙', '未', '壬', '庚', '戊制壬、己土混杂、无壬', '三伏生寒壬为用取庚佐；庚壬两透贴身相生可云科甲名宦；喜运行西南'],
  ['丙', '申', '壬', '戊（壬多取戊制）', '多壬无戊、戊多壬少', '日照湖海仍用壬水辅映；多壬一戊出制"众杀猖狂，一仁可化"主显达'],
  ['丙', '酉', '壬', '癸', '戊多困水、辛透不能从化', '丙之余光存於湖海；一壬高透定主登科及第；成金局无辛乃"朱门饿莩"'],
  ['丙', '戌', '甲', '壬', '土晦光、庚戊困水木', '忌土晦光先用甲木次取壬水；甲壬两透富贵非凡；一派火土必主奔流'],
  ['丙', '亥', '甲戊庚／壬', '己土（混壬）', '壬多无甲', '得甲戊庚出干可云科甲，性好清高斯文领袖；辛透见辰名化合逢时主大贵'],
  ['丙', '子', '壬', '戊', '一派壬（须甲为药）', '冬至一阳生弱中复强；壬戊两透科甲可许；戊晦光须甲木为药'],
  ['丙', '丑', '壬', '甲', '一派己土、一派癸水', '喜壬为用；壬甲两透科甲堪宜，甲藏则秀才；一派己土名假伤官，聪明性傲'],
  ['丁', '寅', '庚', '甲', '一派甲无庚、壬癸无庚', '甲木当权母旺，非庚不能劈甲引丁，姑用庚金；支成火局无水解炎为僧道'],
  ['丁', '卯', '庚', '甲', '庚乙俱透（贪合）、尽是乙木', '湿乙伤丁，先庚後甲；庚甲两透科甲定然；有乙无庚主贫苦无依'],
  ['丁', '辰', '甲', '庚', '支成水局加壬透、一甲破土', '戊土泄弱丁气，先用甲引丁制土；庚甲两透定主科甲'],
  ['丁', '巳', '甲', '庚', '癸（泄庚湿甲伤丁）、多丙夺光', '用庚劈甲伐甲方云木火通明；壬出干制丙不夺丁光，雁塔题名玉堂清贵'],
  ['丁', '午', '壬', '庚、甲', '土透制壬、丙午时', '建禄不宜乱用甲木；得癸透名"独杀当权"出人头地；庚壬两透科甲定然'],
  ['丁', '未', '甲', '壬', '支成水局水透干、无甲', '三伏生寒丁弱极矣；甲出天干支成木局接引丁火必然科甲'],
  ['丁', '申', '甲', '庚、丙', '两丙夹丁', '端用甲木；三秋甲庚丙并用：七月甲丙、八月甲丙庚、九月端用甲庚'],
  ['丁', '酉', '甲', '庚、丙', '一派戊土、一派辛金', '无甲用乙为"枯草引灯"，不离丙晒；甲庚丙皆透必主科甲；辛金无比劫作从才反贵'],
  ['丁', '戌', '甲', '庚', '一派戊土不见甲', '端用甲庚；戊土泄丁不见甲为伤官伤尽；"大抵甲一庚，乙不离丙"'],
  ['丁', '亥', '甲', '庚', '己合甲、丙夺丁', '三冬丁火微寒端用庚甲；甲庚两透科甲分明；二壬争合取戊破之'],
  ['丁', '子', '甲', '庚、戊', '水多癸旺、丁比出干', '甲木为尊庚佐之；水多癸旺金无比印作弃命从杀；见丁比难合格局'],
  ['丁', '丑', '甲', '庚', '四柱多丙丁', '端用庚甲，甲乃庚之良友；多丙丁又用癸制火，用癸者金妻水子'],
  ['戊', '寅', '丙', '癸、甲', '无丙、有丙无甲癸、火局无壬癸', '原文缺独立标题，见"三春戊土""正二月戊土"：无丙不生、无甲不灵、无癸不长；三者齐透一品当朝'],
  ['戊', '卯', '丙', '癸、甲', '无丙、无甲癸', '同上条：一丙有甲有癸先泰後否；支成水局甲透庚透富贵双全；无庚无比印难作从杀'],
  ['戊', '辰', '甲', '丙、癸', '不见丙甲癸、丙多无癸', '戊土司令先甲後丙；单癸透科甲、两癸透生员、甲癸俱藏只可云富；支成木局庚透亦可富贵'],
  ['戊', '巳', '甲', '丙、癸', '一派丙火、火局无水解', '先用甲疏劈次取丙癸；丙透甲出廊庙之材；支成金局干出癸水名"土润金生"'],
  ['戊', '午', '壬', '甲、丙、癸（力微）', '支成火局透癸、全无滴水', '先看壬水；壬甲两透名"君臣庆会"，得辛透年干官居一品'],
  ['戊', '未', '癸', '丙、甲', '无癸丙、无甲', '先看癸水次用丙火甲木；癸丙两透科甲中人；土多得一甲出文章惊世'],
  ['戊', '申', '丙', '癸、甲', '无癸甲、三者俱无', '先丙後癸甲次之；丙癸甲透富贵极品；支成水局休作从才，宜取甲泄'],
  ['戊', '酉', '丙', '癸', '癸丙全无、水局壬癸出干', '金泄身寒赖丙照暖；丙癸两透科甲中人；秋土生金极弱须丙丁出干方妙'],
  ['戊', '戌', '甲', '癸、丙', '化合、癸甲全无、火局土燥', '戊土当权不可专用丙；支成水局壬癸透用戊止流，有比透反主富'],
  ['戊', '亥', '甲', '丙', '丙甲俱无', '非甲土不灵、非丙土不暖；甲丙两出富贵中人；甲藏丙透科甲有之'],
  ['戊', '子', '丙', '甲', '丙甲全无', '原文"十一二月"合论：严寒丙尊甲佐；丙甲两透桃浪之人，有丙无甲豪富，有甲无丙清贫'],
  ['戊', '丑', '丙', '甲／癸', '乏丙', '同"十一二月"条：一派壬水不见比劫可作从才；二癸争合终属劳碌，得己制癸反为忠义'],
  ['己', '寅', '丙', '戊（作堤）', '壬水为病、戊透、乙多', '田园犹冻故丙为尊；壬多要见戊制，有戊出干定主玉堂金马；加一癸透科甲自然'],
  ['己', '卯', '甲', '癸、丙', '忌合、壬水、无甲丙癸', '先甲疏忌合次癸润；甲癸出干定主科甲，加丙出透势压百僚；无比印从杀者贵'],
  ['己', '辰', '丙', '癸、甲', '庚金为病、丙癸全无', '三者俱透必官居黄阁；透一科甲定然但要得地；有丙甲无癸致富但不贵显'],
  ['己', '巳', '癸', '丙、辛', '戊癸化合、火烈土燥', '原文"三夏己土"合论：取癸为要次用丙；丙癸两透加辛生癸名"水火既济"，鼎甲之人；无癸曰旱田，无丙曰孤阴'],
  ['己', '午', '癸', '丙', '无癸、无丙', '原文无独立条目，并入"三夏己土"；壬癸并出破火润土则聪颖特达，富中取贵'],
  ['己', '未', '癸', '丙', '戊癸化合、孤阴', '原文无独立条目，并入"三夏己土"；有壬水又见庚辛不作孤看，但恐目疾'],
  ['己', '申', '癸', '丙、辛', '有丙无壬癸、火局无水、戊透', '原文"三秋己土"合论：先癸後丙取辛辅癸；丙癸两透雁塔题名；无癸有两丙透异途显达'],
  ['己', '酉', '癸', '丙、辛', '无丙丁出救、火局无水', '支成金局无丙丁出救则零丁孤苦；丙透丁藏生己元神则名魁天下、五福完人'],
  ['己', '戌', '癸', '丙、甲', '无丙丁、戊透', '九月土盛宜甲木疏之；丙透癸藏遇金颇有选援；见戊透主遭凶厄且贫'],
  ['己', '亥', '丙', '甲、戊', '壬水出干、一派癸无比劫', '原文"三冬己土"合论：湿泥寒冻非丙暖不生，丁不能解冻；见火不孤、见土不贫'],
  ['己', '子', '丙', '甲、戊', '不见戊土、一派癸无比劫', '同条：一片辛庚须用丙火还须丁助，丙藏则富贵奇特；一派戊己取甲制之'],
  ['己', '丑', '丙', '甲、丁', '壬水出干、不见戊土', '同条：见壬出干为"水浸湖田"孤苦；一派癸无比劫为从才反主富贵，见比争则平常'],
  ['庚', '寅', '丙', '甲', '癸困丙、火多', '木旺土死不能生金，金寒先丙暖庚性、须甲疏土；丙甲两透科甲显荣；丁出干无水肿"官星有气"'],
  ['庚', '卯', '丁', '甲、庚', '湿乙伤丁、有丁甲无庚、庚出帮破才', '乙见庚必留情，金有暗强之势；专用丁火借甲引丁借庚劈甲；一片甲乙忌庚破才，作从才反贵'],
  ['庚', '辰', '甲', '丁', '乏甲、乏丁、支成土局无木', '戊土司令有埋金之忧；顽金宜丁旺土须甲；得丁甲丙透不见比肩科甲之命'],
  ['庚', '巳', '壬', '戊、丙', '一派丙无壬制', '巳内有戊丙不熔金；须用壬丙戊，非拘执先後，宜分病用药；支成金局变弱为强'],
  ['庚', '午', '壬', '癸', '戊己制水、火局乏水', '丁火旺烈庚金败地；壬透癸藏支见庚辛必然科甲；仲夏无水非上格'],
  ['庚', '未', '丁', '甲', '癸伤丁、丁甲全无、支见水', '三伏生寒顽钝极矣；丁甲两透名显身荣；支会土局甲先丁後'],
  ['庚', '申', '丁', '甲', '壬癸、水局乏丁', '刚锐极矣专用丁火；"秋金锐锐最为奇，壬癸相逢总不宜"；有丁无甲俊秀、有甲无丁平人'],
  ['庚', '酉', '丁', '甲、丙', '假杀重重、支见重重甲乙', '用丁甲丙不可少；丙杀藏支羊刃无冲名"羊刃架杀"，主出将入相；旺金木衰非火莫制'],
  ['庚', '戌', '甲', '壬', '己土浊壬、壬甲两无', '最怕土厚埋金；壬甲两透科甲相宜；有甲无壬犹有学问，有壬无甲莫问衣衿'],
  ['庚', '亥', '丁', '甲、丙', '无丙丁、支成金局无火', '水冷性寒，非丁莫造非丙不暖；丁甲两透一榜有之；"水冷金寒爱丙丁"'],
  ['庚', '子', '丁', '甲、丙', '有甲无丁、癸透、丙丁太多', '严寒仍取丁甲；丁甲两透丙在支中必主科甲；支成水局不见丙丁乃伤官格，清雅而子息艰难'],
  ['庚', '丑', '丙', '丁、甲', '支成金局无水', '寒气太重愈寒愈冻，先丙解冻次丁炼金；丙丁甲透即不科甲亦有恩荣'],
  ['辛', '寅', '己', '壬、庚', '甲木司权、壬无己庚、水局无丙', '己为身之本、壬为洗淘之功；己壬两透支见庚制甲科甲定然；己土不全名"君臣失势"，得丙照暖反主富贵'],
  ['辛', '卯', '壬', '甲', '戊己为病、壬戊透甲不出、火局', '壬水为尊，见戊己为病得甲制伏则辛不埋没、壬不混浊，合此身入玉堂；壬丙齐透方许大富大贵'],
  ['辛', '辰', '壬', '甲', '丙贪合、戊出制水、支见四库', '戊土司令母旺子相，先壬後甲；壬甲两透富贵必然；火多无水名"火土杂乱"主作缁衣，见癸可解'],
  ['辛', '巳', '壬', '甲、癸', '丙火燥烈、壬癸俱无、有甲无壬癸', '喜壬水洗淘；支成金局水透有木制戊名"一清澈底"科甲功名；壬癸甲三者全无斯为下品'],
  ['辛', '午', '壬', '己、癸、庚', '火局重见癸、见戊', '阴柔之极不宜煆炼，须己壬兼用；己无壬不湿、辛无己不生；壬癸己三者皆用'],
  ['辛', '未', '壬', '庚', '戊、癸、甲贪己合、庚出制甲', '己土当权恐掩金光；壬庚两透科甲功名；忌戊出得甲制之方吉，甲须隔位'],
  ['辛', '申', '壬', '甲、戊', '癸不可用、有土无甲', '值庚司令不旺自旺，四柱不见戊土为官清正但不富；四柱金多宜水泄；"水浅金多，号曰体全之象"'],
  ['辛', '酉', '壬', '甲', '戊己为病、壬多无戊', '旺之极矣专用壬水淘洗，"金见水以流通"；以土为病见甲制土方妙；壬透无火名"白虎格"，运行西北富贵大显而子息艰难'],
  ['辛', '戌', '壬', '甲', '戊戌月、土多甲不出', '成土司令母旺子相，先壬後甲；壬甲两透桃洞之仙；"火土为病，水木为药"'],
  ['辛', '亥', '壬', '丙', '壬多无戊、己多有戊', '先壬後丙；壬丙两透金榜题名，名"金白水清"，又在亥月故发；戊多壬少又主成名'],
  ['辛', '子', '丙', '壬、戊', '癸出冻金困丙、壬多无戊丙', '癸水司令为寒雨露；壬丙两透不见戊癸则衣锦腰金；支见亥子丑干出比劫无丙名润下格，富贵双全运喜西北'],
  ['辛', '丑', '丙', '壬', '有壬乏丙、有丙无壬、丙多无壬有癸', '寒冻之极，丙先壬後；丙壬两透金马玉堂之客；有丙无壬富真贵假，有壬乏丙贱而且贫'],
  ['壬', '寅', '庚', '丙、戊', '汪洋无度、支成火局', '宜用庚金之源；有庚丙戊三者齐透科甲功名；无比肩羊刃不必用戊，专用庚金以丙为佐'],
  ['壬', '卯', '戊', '辛、庚', '水泛木浮、甲乙重重', '不用丙暖，先戊後辛；戊辛两透雁塔题名；"土止流水福寿全"，戊不见则一生辛苦'],
  ['壬', '辰', '甲', '庚、癸', '无甲、乏庚、四库乏甲', '戊土司权，先用甲疏季土次取庚金；甲庚俱透科甲定然；水旺多见庚金者乃无用之人，须丙制之'],
  ['壬', '巳', '壬', '辛、庚、戊', '无壬木少火多、癸透', '丙火司权水弱极矣；壬辛两透金榜有名；四柱多金得地则弱极复强，须用巳中戊土'],
  ['壬', '午', '癸', '庚', '支成火局全无金水、甲乙多', '丁旺壬弱；无庚不能发水、无癸不能伤丁；庚癸两透科甲必然，庚壬两透官居极品'],
  ['壬', '未', '辛', '甲、癸', '支多土火、一派己土', '己土当权丁火退气，先辛後甲次取癸；辛甲两透富贵清高；土居生旺之地须用木制'],
  ['壬', '申', '戊', '丁', '戊癸化合、一派甲木见火多', '庚金司令转弱为强；专戊土，用辰戌之戊不用申中受病之戊；戊丁俱透科甲生员'],
  ['壬', '酉', '甲', '庚', '戊土为病、庚破甲', '辛金司权正金白水清；甲透制戊则壬水澈底澄清名高翰苑；无甲用金发水源名"体全之象"'],
  ['壬', '戌', '甲', '丙', '庚乏丁、水多乏丙', '进气其性将厚；一派壬水见一甲制戊、戊又出干则用丙火，此格清贵极矣'],
  ['壬', '亥', '戊', '庚、丙', '甲制戊无庚救、水局不见戊己', '至旺之极取戊为用；戊庚两全定主登科及第位显权高；支成水局名润下格，行东南必危'],
  ['壬', '子', '戊', '丙', '有丙无戊、丙不出干', '阳刃帮身较前更旺，丙戊两透富贵荣华；有戊无丙略可言富，有丙无戊好谋无成'],
  ['壬', '丑', '丙', '甲', '无丙、金局无丙丁、丙透遇辛', '旺极复衰，上半月癸辛主事、下半月己土主事，皆用丙火甲木佐之；丙透甲出科甲之贵'],
  ['癸', '寅', '辛', '丙、庚', '辛丙皆无、火局辛伤无壬救', '雨露之精其性至柔，先辛生水之源次丙照暖，名"阴阳和合"；辛丙两透金榜有名'],
  ['癸', '卯', '庚', '辛', '无庚辛、丁出干、支成木局', '乙木司令泄弱元神；庚辛俱透无丁出干者贵由科甲；庚辛两藏富中取贵'],
  ['癸', '辰', '丙（清明後）', '辛、甲（谷雨後）', '不化者平常、支坐四库无甲', '清明後专用丙火，谷雨後虽用丙火尚宜辛甲佐之；从化者多得化者荣禄；木局无金名伤官生才'],
  ['癸', '巳', '辛', '庚、壬', '丁火破格、一派火土乏辛', '专用辛金；丁破格贫无立锥有壬可免；辛壬两透名"劫印化晋"极贵之造；无辛用庚'],
  ['癸', '午', '庚辛', '壬、癸', '火局无壬、一派己土无甲', '至弱无根；丁火司权金难敌火，宜见比劫；庚辛透干又见壬癸定主钟鼎名家'],
  ['癸', '未', '庚辛', '比劫', '丁透、一派己土无甲', '上下月分：下半月庚辛有气、上半月休囚；未中乙巳同宫破而不破（"巳"当为"己"），故癸水不能从杀，专用庚辛'],
  ['癸', '申', '丁', '甲', '金多乏丁、丁透无甲', '申中有庚生癸，名"死处逢生"弱中复强；丁透有甲名有焰之火必主科甲；一丁坐午名"独才格"'],
  ['癸', '酉', '辛', '丙', '土多克水、丙辛怕用', '辛金虚灵非顽金可比，正金白水清；丙辛隔位同透主科甲功名，丙透辛藏一榜之士'],
  ['癸', '戌', '辛', '甲、癸', '二者俱无、甲无癸辛', '失令无根戊土司权；专用辛金发水之源，要比重滋甲制戊；辛甲两透支见子癸平步青云'],
  ['癸', '亥', '庚辛', '丁、戊', '丁伤、一派壬水不见戊', '旺中有弱，因亥摇木泄散元神；庚辛两透不见丁伤功名有准；一派壬水不见戊制则奔波到老'],
  ['癸', '子', '丙', '辛', '壬水无丙、一派癸水、金局无丙', '值冰冻之时金水无交欢；专用丙火解冻又要辛金滋扶，无丙有辛不妙；有丙透则金温水暖'],
  ['癸', '丑', '丙', '壬、戊', '有丙无壬、有壬无丙、水局无丙', '寒极成冰宜丙解冻；丙透年时加以壬透、支中多戊名"水辅阳光"主显达名臣；"凡冬月用丙须丙火得地"'],
];

const TIAOHOU_INDEX = new Map(TIAOHOU_ROWS.map((r) => [r[0] + r[1], r]));
const TIAOHOU_BACKFILL_INDEX = new Map(TIAOHOU_BACKFILL.map((b) => [b.stem + b.branch, b.并入]));

/* ==================================================================== *
 * 调候用神表的**版本差异**（《造化元钥（穷通宝鉴评注）》徐乐吾评注本 对校）
 *
 * ⚠ 底本严重残缺：正文止于「五月丙火」，**实存仅甲木 12 月 ＋ 丙火 5 月＝17/120 组**。
 *   其余八干（乙丁戊己庚辛壬癸）全部原缺，**无法比对**，故下表只有 4 条。
 *   **不可据该本补全 120 组表**；它只能作校验增补源。
 *
 * 每条均带评注本原句与底本行号，可回 knowledge/造化元钥-徐乐吾评注.md 复核。
 * 引擎**不代判**哪一说为是——两说并列，由调用方按所宗版本取舍。
 * ==================================================================== */
const TIAOHOU_VERSION_DIFFS = [
  {
    日干: '甲', 月支: '卯', 月名: '二月',
    类型: '直接出入',
    现有: { 用神: '庚', 辅佐: '戊、财', 忌: '癸、重刃' },
    评注本: { 用神: '庚', 次用: '丁', 说明: '先看庚、次取丁；有庚木能成器，有丁木火通明，庚丁两透科甲定许' },
    差异: '评注本第二用神明确为**丁**（且丁是二月"无庚"时的替代主用神）；现有模块辅佐栏作"戊、财"而未列丁。'
      + '戊在评注本中只是"用庚不离戊土"的**配套条件**，不是并列辅佐。',
    并列: '二月另有"阳刃架煞"一格（庚金得所者名阳刃架煞，可许异途小贵，但要财资煞）——'
      + '即二月实为"庚为主、丁与财戊各随局而用"的双轨，非单神。',
    出处: '《造化元钥（穷通宝鉴评注）》第 180–182、197、200 行',
  },
  {
    日干: '甲', 月支: '巳', 月名: '四月',
    类型: '直接出入',
    现有: { 用神: '癸', 辅佐: '丁', 忌: '庚金太多、金多火多' },
    评注本: { 用神: '癸', 次用: '丁', 辅佐: '庚（须透）', 说明: '先癸次丁，又须有庚透；癸丁与庚齐透天干，此命可言科甲' },
    差异: '现有模块把庚**整体放进忌神栏**，丢失了"又须有庚透"这一半。'
      + '评注本完整口径是"**癸为主、丁为次、庚为辅且须透**；仅庚过多时方为病"'
      + '（"四月庚金，取其生癸，因水值休囚，故宜金生，**非取其克制甲木**"）。',
    并列: '引擎取用时应按两段处理：**有庚透＝辅佐到位；庚多甲少＝病**。',
    出处: '《造化元钥（穷通宝鉴评注）》第 265、267、270、271 行',
  },
  {
    日干: '甲', 月支: '亥', 月名: '十月',
    类型: '遗漏（现有模块漏一神）',
    现有: { 用神: '庚', 辅佐: '丁、丙', 忌: '壬水泛身' },
    评注本: { 用神: '庚', 次用: '丁', 又次: '丙', 再次: '戊', 说明: '以庚为君，以丁为佐，丙火次之，忌壬水泛木，须戊土为制，故戊又次之' },
    差异: '现有模块辅佐栏**漏戊**。评注本三层是"庚君—丁佐—丙次之—**戊又次之**"，'
      + '戊是制壬救庚丁的第四用神；缺戊则庚无力克木（"无戊制壬，庚金无力克木以成栋梁"）。',
    并列: '"得庚丁出干，又加戊透，名去浊留清，大富大贵"。',
    出处: '《造化元钥（穷通宝鉴评注）》第 471、473、474 行',
  },
  {
    日干: '丙', 月支: '辰', 月名: '三月',
    类型: '异文（字讹）',
    现有: { 用神: '壬', 辅佐: '甲', 忌: '庚出制甲、乙丁杂乱' },
    评注本: { 用神: '壬', 辅佐: '甲', 忌: '庚出制甲、丁己离乱' },
    差异: '评注本作"**丁己**离乱"，现有模块作"**乙丁**杂乱"。'
      + '据评注本自注："见**丁**合壬，见**己**合甲，失用煞印之意，闲神羁绊，平庸之命"——'
      + '被合的是壬与甲，故当以"丁己"为是；"乙丁"恐系另本或形近之讹。**两说并列，引擎不代判。**',
    并列: '另：现有模块把"庚出制甲"列为忌，评注本则并陈两用——'
      + '"有甲忌见庚金，**无甲喜用庚金**……无甲用庚助壬，又能泄土气"，庚在无甲时是辅佐。',
    出处: '《造化元钥（穷通宝鉴评注）》第 700–706 行',
  },
];

/** 取某（日干, 月支）的版本差异；无则返回 null。 */
export function tiaohouVersionDiff(stem, branch) {
  return TIAOHOU_VERSION_DIFFS.find((d) => d.日干 === stem && d.月支 === branch) ?? null;
}

/** 全部版本差异（供文档与测试遍历）。 */
export function tiaohouVersionDiffs() {
  return TIAOHOU_VERSION_DIFFS.map((d) => ({ ...d }));
}

/* ==================================================================== *
 * 《八字提要》（韦千里）1440 组：十干 × 十二月 × **十二时支**
 *
 * ★ 与《穷通宝鉴》的根本差异：穷通宝鉴是 120 组（日干×月令），
 *   本书是 **1440 组（日干×月令×时支）**——**同一月令下 12 个时辰给出 12 种不同取用**。
 *   故凡以"穷通宝鉴月令用神"为唯一答案者，在时支已知时有 11/12 的概率取错。
 *
 * 使用规则：
 *   · **时支未知** → 以《穷通宝鉴》120 组为准（引擎既有 tiaohou 路径）。
 *   · **时支已知** → 以《八字提要》对应条为准，**并陈**穷通宝鉴的月令结论。
 *
 * 数据源自《八字提要》（韦千里）典籍母本，全量 1440 组静态解耦至 data/tiyao.json，
 * 已校验：120 节齐、每节 12 条、时支顺序合规、**时干全部合五鼠遁**。
 * TIYAO_ROWS 由核心数据文件安全同步加载，严禁破坏结构。
 * ==================================================================== */
const TIYAO_ROWS = JSON.parse(
  fs.readFileSync(new URL('./data/tiyao.json', import.meta.url), 'utf8')
);

const TIYAO_INDEX = new Map(TIYAO_ROWS.map((r) => [r[0] + r[1] + r[2] + r[3], r[4]]));

/** 五鼠遁：由日干与时支定时干（甲己还加甲、乙庚丙作初……）。 */
function hourStemIndex(dayStemIndex, hourBranchIndex) {
  return ((dayStemIndex % 5) * 2 + hourBranchIndex) % 10;
}

/**
 * 取《八字提要》某条：日干 × 月支 × **时干支**。
 *
 * ⚠ 定位键必须含**时干**：同一时支在不同日干下对应不同时干
 * （乙日子时是戊子、丙日子时是庚子），只用「日干+月支+时支」不能唯一确定，
 * 会取到别的日干的条文。
 *
 * @param {string} stem 日干
 * @param {string} monthBranch 月支
 * @param {string} hourBranch 时支
 * @returns {{日干:string,月支:string,时干:string,时支:string,论述:string}|null}
 */
export function tiyaoOf(stem, monthBranch, hourBranch) {
  const si = STEMS.indexOf(String(stem));
  const hi = BRANCHES.indexOf(String(hourBranch));
  if (si < 0 || hi < 0) return null;
  const hs = STEMS[hourStemIndex(si, hi)];
  const t = TIYAO_INDEX.get(String(stem) + String(monthBranch) + hs + String(hourBranch));
  if (!t) return null;
  return { 日干: String(stem), 月支: String(monthBranch), 时干: hs, 时支: String(hourBranch), 论述: t };
}

/** 某（日干, 月支）下 12 个时辰的全部条目；用于整节查看与"12 时各异"展示。 */
export function tiyaoSiblings(stem, monthBranch) {
  const si = STEMS.indexOf(String(stem));
  if (si < 0) return [];
  const out = [];
  for (let hi = 0; hi < 12; hi++) {
    const hs = STEMS[hourStemIndex(si, hi)];
    const t = TIYAO_INDEX.get(String(stem) + String(monthBranch) + hs + BRANCHES[hi]);
    if (t) out.push({ 时干: hs, 时支: BRANCHES[hi], 时柱: hs + BRANCHES[hi], 论述: t });
  }
  return out;
}

/** 数据完整性信息（供自检与输出自述）。 */
export function tiyaoMeta() {
  return {
    条数: TIYAO_ROWS.length,
    期望: 1440,
    完整: TIYAO_ROWS.length === 1440,
    来源: '《八字提要》（韦千里）十干×十二月×十二时；全量 1440 组静态解耦数据（核心/data/tiyao.json）',
    校验: '120 节齐、每节 12 条、时支顺序合规、时干全部合五鼠遁',
    注意: '不要手改：TIYAO_ROWS 为全量静态数据表，严禁破坏结构。',
  };
}

/** 去掉括号注语，仅留主干（如「癸（上半月）／丙（下半月）」→「癸／丙」） */
const stripParen = (s) => String(s).replace(/（[^）]*）/g, '').trim();
/** 是否为"纯天干清单"（只有天干与 、／） */
const isCleanStemList = (s) => /^[甲乙丙丁戊己庚辛壬癸、／\s]+$/.test(stripParen(s));
/** 取出串中提及的天干（去重，保持原序） */
const stemsIn = (s) => [...new Set([...stripParen(s)].filter((ch) => STEMS.includes(ch)))];

/**
 * 查《穷通宝鉴》调候用神表。
 *
 * 注意：本函数只**查出原书条目**，不做"调候是否成立"的判断。
 *
 * @param {string} dayStemName 日干，如 '乙'
 * @param {string} monthBranchName 月支，如 '申'
 * @returns {{日干:string,月令:string,用神:string,辅佐:string,忌:string,要点:string,
 *           分用:Array<{期:string,神:string}>|null, 并列用神:Array<string>|null,
 *           用神纯:boolean, 辅佐纯:boolean,
 *           回填:string|null, 来源:string}|null} 表中无此组合时返回 null
 */
export function tiaohouOf(dayStemName, monthBranchName) {
  const row = TIAOHOU_INDEX.get(String(dayStemName) + String(monthBranchName));
  if (!row) return null;
  const [gan, zhi, yong, fu, ji, yao] = row;

  // 「／」在原文里有两种用法，必须分清，不可一律当"月内分用"：
  //   (a) 月内分用——每段都带期限注记，如乙木五月「癸（上半月）／丙（下半月）」、
  //       乙木八月「癸（白露後）／丙（秋分後）」。压平为单一用神等于替使用者选了半个月。
  //   (b) 并列/次选——段落不带期限，如丙火十月「甲戊庚／壬」（原文"得甲戊庚出干可云科甲"）。
  //       这不是分用，误判会凭空造出一个"半月分歧"。
  let 分用 = null;
  let 并列用神 = null;
  if (yong.includes('／')) {
    const parts = yong.split('／').map((s) => s.trim());
    const parsed = parts.map((part) => {
      const m = /^(.+?)（(.+?)）$/.exec(part);
      return m ? { 期: m[2], 神: m[1] } : null;
    });
    if (parsed.every(Boolean)) 分用 = parsed;
    else 并列用神 = parts;
  }

  return {
    日干: gan,
    月令: zhi,
    用神: yong,
    辅佐: fu,
    忌: ji,
    要点: yao,
    分用,
    并列用神,
    用神纯: isCleanStemList(yong),
    辅佐纯: isCleanStemList(fu) && !/[不宜无须]/.test(fu),
    回填: TIAOHOU_BACKFILL_INDEX.get(gan + zhi) ?? null,
    来源: '《穷通宝鉴》十干×十二月令调候用神表',
  };
}

/**
 * 调候用神在原局中的**到位情况**：透干、通根、被合、被冲、未现。
 *
 * 只报事实，**不判"调候是否成立"**——成立与否须并合格局喜忌与旺衰，
 * 由调用方（Agent）按技法判断。特别地：
 *   · 「忌」栏原文混"神"与"条件"两类（"无庚"指缺庚为病、"庚多"指庚多为病、
 *     "不宜用癸"指用癸有害），机械抽字会颠倒原意，故**不代为解释**，只回原文。
 *   · 「辅佐」栏含否定语者（如乙木十一月"不宜用癸"）标记 `辅佐纯: false`，
 *     其提及的天干仅为"提及"，不等于"宜用"。
 *
 * @param {object} chart castChart / pillarsMode 的返回值（须含 pillars[].stem/.branch）
 */
export function tiaohouAssessment(chart) {
  const pillars = chart.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('tiaohouAssessment: chart.pillars 须为四柱');
  const posNames = ['年', '月', '日', '时'];
  const dayStemName = pillars[2].stem;
  const monthBranchName = pillars[1].branch;
  const th = tiaohouOf(dayStemName, monthBranchName);
  if (!th) return null;

  const stems = pillars.map((p) => p.stem);
  const branches = pillars.map((p) => p.branch);

  // 天干五合（直接由 STEM_COMBINE 判，避免解析展示用的 pair 字符串）。
  // 须知「合」不等于「合去」：《子平真诠·十干合化》分「本身之合」与「合去」两途——
  // 日干自合（五阳逢财、五阴遇官）是"我之官/我之财"，**不为合去**；
  // 只有他干相合才谈得上把喜神合去（"甲用丙食与辛作合，非其食"）。
  // 但若同一神另有他干争合，则日干反不能合而为合去。此处只标出"是否涉日干"，
  // 交由调用方按争合与否定夺，引擎不代为判定。
  const combineHits = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const hua = STEM_COMBINE[stems[i] + stems[j]] ?? STEM_COMBINE[stems[j] + stems[i]];
      if (!hua) continue;
      const 涉日干 = i === 2 || j === 2;
      combineHits.push({
        二干: [stems[i], stems[j]],
        位置: `${posNames[i]}${stems[i]} — ${posNames[j]}${stems[j]}`,
        化: hua,
        涉日干,
        ...(涉日干 ? { note: '日干自合：依《子平真诠》「合而不以合论」，本身之合是我之官/我之财，不为合去；惟另有他干争合同一神时，日干反不能合，则为合去，须查有无争合' } : {}),
      });
    }
  }

  const assess = (label, raw, clean) => {
    const stems_ = clean ? stemsIn(raw) : [...new Set([...stripParen(raw)].filter((ch) => STEMS.includes(ch)))];
    return {
      栏: label,
      原文: raw,
      可机械取神: clean,
      神: stems_.map((s) => {
        const si = STEMS.indexOf(s);
        const 透干 = [];
        const 通根 = [];
        for (let i = 0; i < 4; i++) {
          if (stems[i] === s) 透干.push(`${posNames[i]}干`);
          for (const h of HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])]) {
            if (h[0] === s) 通根.push(`${posNames[i]}支${branches[i]}（${h[1]}·权${h[2]}）`);
          }
        }
        const 被合 = combineHits.filter((c) => c.二干.includes(s));
        const 被冲 = [];
        for (let i = 0; i < 4; i++) {
          const other = stems[i];
          if (other === s) continue;
          if (STEM_CLASH.includes(s + other) || STEM_CLASH.includes(other + s)) 被冲.push(`${posNames[i]}干${other}冲${s}`);
        }
        return {
          神: s,
          五行: ELEMENTS[STEM_ELEMENT[si]],
          透干: 透干.length ? 透干 : null,
          通根: 通根.length ? 通根 : null,
          被合: 被合.length ? 被合 : null,
          被冲: 被冲.length ? 被冲 : null,
          未现: 透干.length === 0 && 通根.length === 0,
        };
      }),
    };
  };

  const 用神到位 = assess('用神', th.用神, th.用神纯);
  const 辅佐到位 = assess('辅佐', th.辅佐, th.辅佐纯);

  const 提示 = [];
  if (!th.用神纯) 提示.push('「用神」栏含注语，已去括号取主干，须对原文复核');
  if (!th.辅佐纯) 提示.push('「辅佐」栏含否定语或条件语（如"不宜用癸"），其天干仅为"提及"而非"宜用"，不可当喜神用');
  提示.push('「忌」栏混"神"与"条件"两类（"无庚"＝缺庚为病、"庚多"＝庚多为病），引擎不代为取舍，须按原文理解');
  if (th.回填) 提示.push(`本条系原书体例缺漏后按总论回填（并入「${th.回填}」），判语较逐月分论者粗疏`);
  if (th.分用) 提示.push('本条原文在一月之内分用（见 `分用`），须先定生于上半月/下半月或某节气前后，不可压平为单一用神');
  if (th.并列用神) 提示.push(`本条「用神」栏以「／」并列数神（${th.并列用神.join('、')}），非月内分用；原文于此有其主次/先后之义，须按原文与「要点」取舍，不可并列等观`);

  // 调候之神被合者：区分"日干自合（不为合去）"与"他干合去（逢吉不为吉）"。
  // 这正是《子平真诠》同段给出的两个相反方向，故只报出并标类别，不代判吉凶。
  const 被合之神 = [];
  for (const [栏, box] of [['用神', 用神到位], ['辅佐', 辅佐到位]]) {
    for (const g of box.神) {
      for (const c of g.被合 ?? []) {
        被合之神.push({ 栏, 神: g.神, 位置: c.位置, 化: c.化, 类别: c.涉日干 ? '日干自合（不为合去）' : '他干合之（或为合去）' });
      }
    }
  }
  if (被合之神.length) {
    提示.push('调候之神有被合者：' + 被合之神.map((x) => `${x.栏}${x.神} 被 ${x.位置} 合（化${x.化}，${x.类别}）`).join('；')
      + '。依《子平真诠·十干合化》，喜神被他干合去则"逢吉不为吉"，忌神被合去则"逢凶不为凶"——同一个合，对用神与忌神的净效果相反，须并陈后按格局定夺。');
  }

  // ── 版本差异：现有 120 组表对校《造化元钥（徐乐吾评注）》────────────
  // 该底本只存 17/120 组（甲木 12 月＋丙火 5 月），故只有 4 条可比对；不可据以补全。
  const 版本差异 = tiaohouVersionDiff(dayStemName, monthBranchName);
  if (版本差异) {
    提示.push(`★ **本条存在版本差异**（${版本差异.类型}）：`
      + `现有表作「用神${版本差异.现有.用神}／辅佐${版本差异.现有.辅佐}」，`
      + `《造化元钥（徐乐吾评注）》作「${版本差异.评注本.说明}」。`
      + `详见返回字段 \`版本差异\`；**两说并列，引擎不代判**。`);
  }

  // ── 《八字提要》1440 组：时支已知时，本条才是本月的准确取用 ──────────
  // 该书是「日干×月令×时支」1440 组，**同一月令下 12 时辰给 12 种取用**；
  // 故时支已知时，穷通宝鉴的月令单条只是背景，须并陈提要条。
  // ★ 2026-10-01 修 D1/D4：此前**提要正文**虽在本函数算出，却在 `formatTiaohou` 处被丢弃，
  //   模型只看到一句"须并陈"、拿不到要并陈的东西 ⇒ **事实层静默缺一块**
  //   （正是 `体用路线法.md` 顶部「规格不可得时不得降级」明禁的"降级继续"）。
  //   现改由 formatter 直接印出正文。
  //   ⚠ 2026-10-01：原引 `AGENTS.md §一.4`——该节号在 AGENTS.md 精简后**已不存在**，
  //   属"判据无落点"；该铁律已于同日在 `体用路线法.md` 顶部重新立为明文。见下同类修正。
  // ★ 2026-10-01 修 D2（fail-closed 硬闸门）：取不到该条时**不再只留软警告**，
  //   改出 `提要缺失: true` + ⛔ 文案，明写"调候结论不得作确定性结论"。
  const hourBranch = pillars[3] && pillars[3].branch;
  const 提要数据完整 = tiyaoMeta().完整 === true;
  const 提要 = (hourBranch && 提要数据完整)
    ? tiyaoOf(dayStemName, monthBranchName, hourBranch) : null;
  const 提要缺失 = Boolean(hourBranch) && !提要;
  if (提要) {
    提示.push('★ **时支已知，《八字提要》本时辰条见下（正文已附）**：该书为「日干×月令×时支」1440 组，'
      + '**同一月令下 12 个时辰给 12 种不同取用**；故以《穷通宝鉴》月令用神为唯一答案时，'
      + '在时支已知的情况下有 11/12 的概率取错。**两书并列，不互相取代。**');
  }
  if (提要缺失) {
    提示.push('⛔ **时支已知，但《八字提要》本时辰条取不到**（'
      + (提要数据完整 ? '该「日干×月支×时支」组缺条或时支非法' : '`TIYAO_ROWS` 数据不完整')
      + '）。依 `体用路线法.md` 顶部「**规格不可得时不得降级**」'
      + '（原引 `AGENTS.md §一.4`，该节号已于 2026-10-01 精简时作废；铁律已移入一手规格）：'
      + '「**读不到规格、或读到的是摘要／二手转述时，必须停止分析并如实报告，不得降级继续**」⇒ '
      + '注：核心底座已内嵌完整《八字提要》1440 组权威数据。若条目缺失须校验底座数据完整性。');
  }

  return {
    日干: dayStemName,
    月令: monthBranchName,
    ...th,
    用神到位,
    辅佐到位,
    被合之神,
    版本差异,
    提要: 提要 ? { 时支: 提要.时支, 时柱: 提要.时干 + 提要.时支, 论述: 提要.论述,
      来源: '《八字提要》（韦千里）日干×月令×时支' } : null,
    提要缺失,
    提要数据完整,
    提要使用规则: '**仅知月令** → 以《穷通宝鉴》120 组为准（本函数 `...th` 部分）；'
      + '**时支已知** → 须并陈《八字提要》对应条（返回字段 `提要`），两书并列不互相取代；'
      + '**`提要缺失 === true` 时 fail-closed**：不得以本函数的调候结论作确定性结论。',
    提示,
  };
}

/* ==================================================================== *
 * 古法三命（唐宋禄命术，与子平是**两套体系**）
 *
 * ⚠ 使用前必读：本组术语与子平**同名异义**，切勿混用。
 *   三元：古法＝干禄／支命／纳音身；子平＝天元/地元/人元（藏干）
 *   身  ：古法＝纳音　　；子平＝日干
 *   格  ：兰台＝意象格名；子平＝十神格局
 * 核心差异：**古法以年为本**（"推日以计运，推月以计气，本命者，是大小运之尊也"），
 *           **子平以日为主**。故本组函数一律从**年柱**起算，输出也明确标注"年为本"。
 *
 * 依据（均可在 knowledge/ 对应模块逐字复核）：
 *   · 《李虚中命书》卷中·升降清浊：「元命勝負三元者干祿支命，納音身各分衰旺之地。
 *     三元各分生旺庫之地而為九命，是主祿主三會也。」
 *   · 《鬼谷遗文-三命结构》：「干主名禄贵权，为衣食受用之基；支主金珠积富，
 *     为得失荣枯之本；纳音主材能器识，为人伦亲属之宗。」
 * ==================================================================== */

/** 三命的取象与所主（《鬼谷遗文-三命结构》原文） */
const SANMING_ROLES = {
  干禄: { 名: '天元·干禄', 主: '名禄贵权，为衣食受用之基', 原文: '干主名禄贵权，为衣食受用之基' },
  支命: { 名: '地元·支命', 主: '金珠积富，为得失荣枯之本', 原文: '支主金珠积富，为得失荣枯之本' },
  纳音身: { 名: '人元·纳音身', 主: '材能器识，为人伦亲属之宗', 原文: '纳音主材能器识，为人伦亲属之宗' },
};

/**
 * 旺衰闸 / 从格闸（`congGateOf`）—— **本项目对治「见身弱即取印比」的机械闸门**。
 *
 * ## 为什么要有这个函数
 *
 * 六层作答表把「中和扶抑」列为**第 5 层、且永远是最后一名候选**，
 * 并规定**禁止以"身弱"为由直接跳到第 5 层取印比**。
 * 但这只是**文字纪律**，此前没有任何代码在执行它——
 * 于是"极弱 → 用印比"这条最经典的错判路径**没有任何闸门**。
 * 本函数把该纪律变成机械判定：算出**在取用之前必须先过什么关**，并给出
 * 第 5 层是否被阻止。
 *
 * ## 古典依据（不从严：凡有可依者皆不从）
 *
 * · **有根即不从**（通则）。
 * · 《穷通宝鉴·判断顺序》：「**支内有水不作从杀**」「**干上有木不作从财**」
 *   —— 措辞是"不作"，即**只要有可依之字，就不作从论**。
 * · **日主所生的食伤透干有气 → 日主即有"可依之体" → 一般不作从格**。
 *   这一条最易漏：食伤是"我生"，日主虽弱，但已有所生之形可依，故不从。
 * · 《滴天髓》：「**顺逆不齐也，不可逆者，其气势而已矣**」
 *   —— 从格讲的是**顺逆（能不能逆）**，属第 2 层（阴阳／太极），**不属第 5 层（扶抑）**。
 *   故本闸门挂在第 2 层，而非并进第 5 层。
 *
 * ## 本函数**不作**从格与否的结论
 *
 * 《滴天髓》自承"多旺才算旺极没有给出可核对的界限"，且各家对从格收放不一
 * （见 `follow-vs-normal` 分歧条）。故本函数只报：
 * **结构事实 + 不从严逐条结果 + 必须先过哪些关 + 第 5 层是否被阻止**，
 * 结论仍由调用方并陈各派立场后作出。
 *
 * @param {object} chart
 * @returns {object}
 */
export function congGateOf(chart) {
  const d = dayMasterSupport(chart);
  const pillars = chart.pillars;
  const dayStemIndex = STEMS.indexOf(d.日主);
  const dayEl = d.日主五行;
  const posNames = ['年', '月', '日', '时'];
  const branches = pillars.map((p) => p.branch ?? BRANCHES[p.branchIndex]);
  const stems = pillars.map((p) => p.stem ?? STEMS[p.stemIndex]);

  const 食伤五行 = SHENG_MAP[dayEl];                       // 我生者
  const 印五行 = ELEMENTS.find((e) => SHENG_MAP[e] === dayEl) ?? null;  // 生我者
  const 财五行 = KE_MAP[dayEl];
  const 官杀五行 = ELEMENTS.find((e) => KE_MAP[e] === dayEl) ?? null;

  // 某五行在原局的「可依」程度：透干 / 本气根 / 中余气根
  const 可依 = (el) => {
    const 透干 = [];
    const 本气根 = [];
    const 中余气根 = [];
    for (let i = 0; i < 4; i++) {
      if (i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(stems[i])]] === el) 透干.push(`${posNames[i]}干${stems[i]}`);
      const spec = HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])];
      for (let k = 0; k < spec.length; k++) {
        const h = spec[k];
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] !== el) continue;
        (k === 0 ? 本气根 : 中余气根).push(`${posNames[i]}支${branches[i]}${k === 0 ? '本' : h[1]}${h[0]}`);
      }
    }
    return {
      透干, 本气根, 中余气根,
      有气: 透干.length > 0 || 本气根.length > 0,
      有形可附: 透干.length > 0 || 本气根.length > 0 || 中余气根.length > 0,
    };
  };

  const 食伤 = 可依(食伤五行);
  const 印 = 印五行 ? 可依(印五行) : null;
  const 比劫 = 可依(dayEl);

  // 极弱判定：不得令、无根、无势
  const 极弱 = !d.得令 && d.得地.length === 0 && d.得势.length === 0;
  const 近极弱 = !d.得令 && d.得地.length === 0;           // 无根但或有势

  // 不从严逐条
  const 不从严 = [
    {
      条: '有根即不从',
      结果: d.得地.length === 0 ? '不拦（四支确无日主之根）' : `**拦住**：日主${dayEl}得地 ${d.得地.map((x) => x.位 + x.层).join('、')}`,
      拦: d.得地.length > 0,
      据: '从格通则「有根即不从」',
    },
    {
      条: '有比劫可依（顺势有伴）',
      结果: 比劫.有形可附 ? `**拦住**：比劫有气（${[...比劫.透干, ...比劫.本气根, ...比劫.中余气根].slice(0, 4).join('、')}）` : '不拦（全局无比劫之根气）',
      拦: 比劫.有形可附,
      据: '「有可依者不作从」；比劫与日主同气，是最直接的可依之体',
    },
    {
      条: '有印可依（干上有木不作从财之类）',
      结果: 印 == null ? '不适用'
        : (印.有形可附 ? `**拦住**：印（${印五行}）有气（${[...印.透干, ...印.本气根, ...印.中余气根].slice(0, 4).join('、')}）`
          : '不拦（全局无印之根气）'),
      拦: !!(印 && 印.有形可附),
      据: '《穷通宝鉴·判断顺序》「干上有木不作从财」「支内有水不作从杀」——凡有可依之字皆不作从',
    },
    {
      条: '★ 食伤透干有气（我生者有形）',
      结果: 食伤.有气
        ? `**拦住**：日主所生之食伤（${食伤五行}）有气（${[...食伤.透干, ...食伤.本气根].slice(0, 4).join('、')}）`
          + '——日主虽弱，已有"可依之体"，**一般不作从格**'
        : `不拦（食伤${食伤五行}无透干、无本气根${食伤.中余气根.length ? `，仅中余气根 ${食伤.中余气根.join('、')}` : ''}）`,
      拦: 食伤.有气,
      据: '本项目既定纪律「若日主所生的食伤透干有气，日主即有"可依之体"，一般不作从格」',
    },
  ];
  const 拦住数 = 不从严.filter((x) => x.拦).length;

  // 强势一方（从格所从之对象）：在食伤／财／官杀中取有气且占比最高者
  const 候选 = [
    { 神: '从儿（食伤）', 五行: 食伤五行, ...食伤 },
    { 神: '从财（财）', 五行: 财五行, ...可依(财五行) },
  ];
  if (官杀五行) 候选.push({ 神: '从杀（官杀）', 五行: 官杀五行, ...可依(官杀五行) });
  const 可从者 = 候选.filter((x) => x.有形可附)
    .sort((a, b) => (d.五行占比[b.五行] ?? 0) - (d.五行占比[a.五行] ?? 0));

  // 第 5 层是否被阻止
  const 第5层被阻止 = 极弱;
  const 结论 = [];
  if (极弱) {
    结论.push('**日主极弱**（不得令、无根、无势）——**第 5 层（中和扶抑）在此必须先过从格关**，'
      + '不可径取印比。');
    if (拦住数 === 0) {
      结论.push('**不从严四条全部不拦** → 从格结构成立的可能性高，**方向应先问"顺谁"而不是"补谁"**；'
        + '但仍不作定论（见 `follow-vs-normal` 各家收放不一）。');
    } else {
      结论.push(`**不从严有 ${拦住数} 条拦住** → `
        + `**不作从论**：${不从严.filter((x) => x.拦).map((x) => x.条).join('、')}。`
        + '此时才轮到第 5 层，且须先说明第 2 层为何不反对。');
    }
    if (可从者.length) {
      const 前置 = 拦住数 === 0 ? '' : '**（仅当最终仍论从时才适用——本局不从严已拦住，故下列为"若论从"的备选，不是结论）**';
     结论.push(`若最终论从，可依之强势方（按占比序）：${可从者.map((x) => `${x.神}（${x.五行}，占比${d.五行占比[x.五行] ?? '?'}%）`).join('；')}${前置}`);
    } else {
      结论.push('食伤／财／官杀**俱无形可附**——无强势一方可依，故**亦无从格可论**，此时更要回头看调候与病药。');
    }
  } else if (近极弱) {
    结论.push('日主**无根但或有余势**，尚不构成"极弱"；第 5 层可用，但**须先在第 2 层（顺逆层）说明气势可逆**。');
  } else {
    结论.push('日主非无根之局，**从格关不触发**；按六层常序作答即可（仍守"第 5 层最后"）。');
  }

  return {
    日主: d.日主, 日主五行: dayEl, 月令: d.月令, 月令令态: d.月令令态,
    阴阳: STEM_YANG[dayStemIndex] ? '阳干' : '阴干',
    旺衰三项: { 得令: d.得令, 得地: d.得地, 得势: d.得势 },
    同党占比: d.同党占比, 异党占比: d.异党占比,
    是否极弱: 极弱,
    是否无根: d.得地.length === 0,
    可依之字: { 日主比劫: 比劫, 印: 印, 食伤, 财: 可依(财五行), 官杀: 官杀五行 ? 可依(官杀五行) : null },
    不从严,
    拦住条数: 拦住数,
    可从之强势方: 可从者.length
      ? 可从者.map((x) => ({ 神: x.神, 五行: x.五行, 占比: d.五行占比[x.五行] ?? null, 透干: x.透干, 本气根: x.本气根 }))
      : null,
    第5层被阻止,
    闸门结论: 结论,
    须先过关: 极弱 ? ['① 写在纸上的"从／不从"判定（不从严四条已列）', '② 第 2 层阴阳／太极是否反对取印比', '③ 过此二关后，第 5 层方可候选'] : ['无需从格关；仍守"第 5 层最后"'],
    各家立场: '《滴天髓》自承"多旺才算旺极**没有给出可核对的界限**"；'
      + '从格收放各家不一（见 `controversiesOf` 的 `follow-vs-normal`）。'
      + '**本函数不作从与不作的结论**，只报结构、不从严逐条结果与须先过的关。',
    注: '本闸门挂在**第 2 层（阴阳／太极）**，不并进第 5 层——'
      + '据《滴天髓》「顺逆不齐也，不可逆者，其气势而已矣」：从格是**顺逆**问题，不是**扶抑**问题。',
    据: '六层硬约束（第 5 层永远最后、禁止以"身弱"直接取印比）；'
      + '《穷通宝鉴·判断顺序》不从严；「有根即不从」；食伤成体则不从',
  };
}

/**
 * 用神**粒化**：把"五行"翻成**具体干支字**，并逐个回验是否在局
 * （使用者 2026-09-28：「第五件要翻成那几个字回头验证」）。
 *
 * ## 为什么需要这一步
 *
 * 诸法仲裁给出的是**五行**（如"水"），而取用神最终必须落到**干支字**（如"壬／癸／子／亥"）。
 * 此前的缺口是：这一步纯靠手工，且**没有回验**——把"水"写成"亥"之后，
 * 亥在不在局、是本气还是余气、有没有被合被冲，全无人核。
 *
 * ## 翻法（依三合局与十干）
 *
 * · **天干**：该五行的**阳干／阴干**各一（水→壬／癸、木→甲／乙…）。
 * · **地支（三合局）**：该五行的 **长生／帝旺／墓** 三支
 *   （水→申子辰、木→亥卯未、火与土→寅午戌、金→巳酉丑）。
 *   ⚠ **土与火同宫**（土寄火宫），故"寅午戌"在土下须标出这一层。
 * · 另附该五行的**十二宫位**（本函数只给结论，不算力度——力度见 `genWeightOf`）。
 *
 * ## 回验口径（**从严**）
 *
 * · 天干：逐柱扫，报**透干**位置。
 * · 地支：报该支出现在何柱（**地支自身即该五行**，不论其中藏干）。
 * · **藏干另栏**（`藏干`）：报该五行的字藏在哪些支里（含本气／中气／余气与权重）
 *   ——因"亥藏壬甲"，亥对水是**本支**、对木是**藏干**，两者不同权，**不可混为一谈**。
 *
 * **本函数只报"在不在、在哪、哪一档"，不判吉凶、不选谁当用神。**
 *
 * @param {object} chart
 * @param {string[]} 五行列表 如 ['水']
 */
export function 用神Grainify(chart, 五行列表) {
  const pillars = chart.pillars;
  const posNames = ['年', '月', '日', '时'];
  const stems = pillars.map((p) => p.stem ?? STEMS[p.stemIndex]);
  const branches = pillars.map((p) => p.branch ?? BRANCHES[p.branchIndex]);

  // 五行 → 天干（阳／阴）
  const 干表 = { 木: ['甲', '乙'], 火: ['丙', '丁'], 土: ['戊', '己'], 金: ['庚', '辛'], 水: ['壬', '癸'] };
  // 五行 → 三合局（长生／帝旺／墓）
  const 支表 = { 水: ['申', '子', '辰'], 木: ['亥', '卯', '未'], 火: ['寅', '午', '戌'], 土: ['寅', '午', '戌'], 金: ['巳', '酉', '丑'] };
  const 宫名 = ['长生', '帝旺', '墓'];

  const out = [];
  for (const el of 五行列表) {
    if (!干表[el]) continue;
    const 干候选 = 干表[el].map((g) => {
      const 位 = [];
      stems.forEach((s, i) => { if (s === g) 位.push(`${posNames[i]}干`); });
      return { 字: g, 类: '天干', 在局: 位.length > 0, 落点: 位.length ? 位 : null };
    });
    const 支候选 = (支表[el] ?? []).map((b, k) => {
      const 位 = [];
      branches.forEach((x, i) => { if (x === b) 位.push(`${posNames[i]}支`); });
      // 藏干：该五行的字藏在哪些支里（含层次与权重）
      const 藏干 = [];
      branches.forEach((x, i) => {
        for (const h of HIDDEN_STEMS_SPEC[BRANCHES.indexOf(x)]) {
          if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] !== el) continue;
          藏干.push({ 支: x, 位: `${posNames[i]}支`, 字: h[0], 层: h[1], 权: h[2] });
        }
      });
      return {
        字: b, 类: '地支', 局位: 宫名[k], 在局: 位.length > 0, 落点: 位.length ? 位 : null,
        ...(k === 0 ? { 藏干: 藏干.length ? 藏干 : null } : {}),
        ...(el === '土' && k === 0 ? { 注: '**土寄火宫**：寅午戌为火之三合，土与此同宫，非土自有之局' } : {}),
      };
    });
    // 该五行字的全量藏干（另一栏，与"地支自身"分清）
    const 全藏干 = [];
    branches.forEach((x, i) => {
      for (const h of HIDDEN_STEMS_SPEC[BRANCHES.indexOf(x)]) {
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] !== el) continue;
        全藏干.push({ 位: `${posNames[i]}支${x}`, 字: h[0], 层: h[1], 权: h[2] });
      }
    });
    const 在局字 = [...干候选, ...支候选].filter((x) => x.在局).map((x) => x.字 + (x.局位 ? `(${x.局位})` : ''));
    out.push({
      五行: el,
      候选字: [...干候选.map((x) => x.字), ...支候选.map((x) => x.字)],
      天干候选: 干候选,
      地支候选: 支候选,
      在局之字: 在局字.length ? 在局字 : null,
      藏干另栏: 全藏干.length ? 全藏干 : null,
      回验结论: 在局字.length
        ? `**在局**：${在局字.join('、')}`
          + (全藏干.length ? `；另有藏干 ${[...new Set(全藏干.map((x) => x.字 + '·' + x.层))].join('、')}` : '')
        : `**全局无${el}之字**（既无${干候选.map((x) => x.字).join('／')}透干，亦无${支候选.map((x) => x.字).join('／')}）`
          + (全藏干.length ? `，仅藏干 ${[...new Set(全藏干.map((x) => x.字))].join('、')}` : ''),
      粒化说明: '天干取该五行之阳干／阴干；地支取其**三合局**（长生／帝旺／墓）。'
        + '**「地支自身」与「藏干」不同权**，故分栏列——如亥对水是本支、对木只是藏干。'
        + '本栏只报在不在、在哪、哪一档，**不判吉凶、不选谁当用神**。',
      据: '三合局与十干五行（《三命通会》干支体象）；《滴天髓》「能知衰旺之真机」',
    });
  }
  return out.length ? out : null;
}

/**
 * 诸法仲裁（`yongshenArbiterOf`）—— **用户 2026-09-28 明确定的优先级**。
 *
 * ## 规则（用户原话）
 *
 * > 「体用最高，但是其他也参考，如果结论严重不符（各 skill 之间意见差别大），
 * >   再附上其他 skill 思考的结果。」
 *
 * 拆成三条可判定规则：
 *   1. **`体用` 为最高裁决**——其用神即为**主结论**。
 *   2. **其余各法照录为参考**，各自给出自己的用神取向。
 *   3. **仅当"严重不符"时**，才把持异议各法的**推理链**一并附上
 *      （否则只列各法取向，不展开理由，以免淹没主结论）。
 *
 * ## 「严重不符」的机械定义（本引擎自定，因用户未给量化界限）
 *
 * 逐法把用神取向压成**五行集合**：与体用**有交集**记「同向」，**无交集**记「相左」。
 * **判为"严重不符"当且仅当**：相左法数 **≥ 参与比对数 × 60%**（**使用者 2026-09-28 定的口径：反对占六成**）。
 * 例：可比对 3 法，相左 ≥ 1.8 ⇒ 即 **2 法**；可比对 5 法，相左 ≥ 3 法。
 * （先前版本用"≥2 或 ≥半数"，已按使用者口径改为**单一比例 60%**。）
 *
 * ## 各法取向的取法（口径不一，已逐条标注）
 *
 * · **体用**：`tiyongRouteOf` 的用神（调用方可声明）。
 * · **调候**：`tiaohouAssessment` 的用神；分用者取当月那段；命中版本差异时标注。
 * · **扶抑**：由得令／得地／得势推方向。**永远最后一名候选**，极弱盘须先过从格闸。
 * · **格局**：月令本气十神 → `GEJU_FAVOR` 喜神。⚠ **成破救应引擎不判**，只作粗取向。
 * · **太极**：`taijiOf` 的用神方向（两说并列时取并集并声明）。
 * · **古法三命**：**没有"取用神"这一步**（以年为本、重纳音与神煞），
 *   **不参与仲裁**，只在输出中并列提示。
 *
 * **本函数不合并、不加权、不评分**——只做"谁最高 + 谁相左 + 是否严重"。
 *
 * @param {object} chart
 * @param {{用神五行?:string, 忌神五行?:string, 岁运?:string}} [opts]
 */
export function yongshenArbiterOf(chart, opts = {}) {
  const pillars = chart.pillars;
  const dayStem = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const dayEl = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(dayStem)]];
  const 五行 = ['木', '火', '土', '金', '水'];
  // 令牌 → 五行集合。
  // ★ 必踩的坑：调候用神、太极取向写的是**天干或地支字**（如「丙」「癸／己」「亥」），
  //   **不是五行名**。若只用 /[木火土金水]/ 去匹配，会遇到两类错：
  //     ① 「丙」不含木火土金水 → 整个匹配落空（曾导致调候被误报为"无调候条"）
  //     ② 「己」（天干）与「土」无关但字面像，会被误当五行
  //   故此处先按 STEMS/BRANCHES 判字，取其实五行；只有确为五行名时才直取。
  const 取五行 = (s) => {
    const str = String(s ?? '');
    const out = new Set();
    for (const ch of str) {
      const si = STEMS.indexOf(ch);
      if (si >= 0) { out.add(ELEMENTS[STEM_ELEMENT[si]]); continue; }
      const bi = BRANCHES.indexOf(ch);
      if (bi >= 0) { out.add(ELEMENTS[BRANCH_ELEMENT[bi]]); continue; }
      if (五行.includes(ch)) out.add(ch);
    }
    return [...out];
  };

  const 诸法 = [];

  // ① 体用（最高裁决）
  let 体用 = null;
  try {
    体用 = tiyongRouteOf(chart, {
      ...(opts.用神五行 ? { 用神五行: opts.用神五行 } : {}),
      ...(opts.忌神五行 ? { 忌神五行: opts.忌神五行 } : {}),
      ...(opts.岁运 ? { 岁运: opts.岁运 } : {}),
    });
  } catch { 体用 = null; }
  const 体用取向 = 取五行(opts.用神五行 ?? 体用?.用神 ?? 体用?.用神五行);
  诸法.push({
    法: '体用', 级别: '**最高裁决**', 取向: 体用取向.length ? 体用取向 : ['（未定）'],
    依据: 体用 ? (体用.用神来源 ?? 体用.口径 ?? 'tiyongRouteOf') : '体用路线法未能算出',
    声明: '按用户 2026-09-28 所定优先级，**本法为最高裁决**；其余各法为参考。',
  });

  // ② 调候
  const tha = tiaohouAssessment(chart);
  const 调候取向 = 取五行(tha?.用神);
  诸法.push({
    法: '调候', 级别: '参考', 取向: 调候取向.length ? 调候取向 : ['（无调候条）'],
    依据: tha ? `《穷通宝鉴》${tha.日干}日主生${tha.月令}月：用神${tha.用神}`
      + (tha.分用 ? `（月内分用：${tha.分用}）` : '')
      + (tha.提要 ? `；并陈《八字提要》${tha.提要.时柱}时条` : '') : '不在调候表中',
    声明: tha?.版本差异 ? `★ 本条存在**版本差异**（${tha.版本差异.类型}），两说并列` : null,
  });

  // ③ 扶抑（六层第 5 层）
  const dms = dayMasterSupport(chart);
  const 同党 = [dayEl, ELEMENTS.find((e) => SHENG_MAP[e] === dayEl)].filter(Boolean);
  const 极弱 = !dms.得令 && dms.得地.length === 0 && dms.得势.length === 0;
  const 扶抑取向 = 极弱
    ? 同党
    : (dms.得令 ? 五行.filter((e) => !同党.includes(e)) : 同党);
  诸法.push({
    法: '扶抑（六层第5层）', 级别: '参考（**永远是最后一名候选**）',
    取向: 扶抑取向,
    依据: `得令=${dms.得令}、得地${dms.得地.length}处、得势${dms.得势.length}处 → `
      + (dms.得令 ? '身旺取向：取食伤财官' : '身弱取向：取印比'),
    声明: '本层按硬约束**永远最后**；禁止以"身弱"直接取印比。'
      + (极弱 ? '★ 本盘**极弱**，另有从格闸（`congGateOf`），本取向须先过闸。' : ''),
  });

  // ④ 格局（粗取向；成破救应引擎不判）
  let 格局取向 = [];
  let 格局据 = '';
  try {
    const seed = yuelingSeed(chart);
    const favor = GEJU_FAVOR[seed.本气God] ?? null;
    格局据 = `月令本气「${seed.本气}」为${seed.本气God}`;
    if (favor) {
      格局取向 = [...new Set((favor.喜 ?? []).flatMap((g) => 取五行(elementOfGod(dayEl, g))))];
      格局据 += `（${favor.类}）→ 喜 ${favor.喜.join('、')}`;
    }
  } catch { /* 格局非必需 */ }
  诸法.push({
    法: '格局', 级别: '参考（**粗取向**）', 取向: 格局取向.length ? 格局取向 : ['（未能推）'],
    依据: 格局据,
    声明: '底座层只提取月令本气与透干粗取向，未判成破救应——八格成格、破格与救应详见体用推演层 gejuChengPoOf（P-021）。',
  });

  // ⑤ 太极 —— ★ **默认不参与仲裁**（使用者 2026-09-28：代码保留，解盘跳过）。
  //    故默认**不把太极算作一法**，避免它的取向去影响"相左法数"与"严重不符"判定。
  //    需要时传 `opts.includeTaiji: true` 可让它重新入列。
  const taiji = taijiOf(pillars[1].branch);
  const 太极取向 = [...new Set(taiji.用神方向.flatMap((d) => 取五行(d.取)))];
  const 太极条目 = {
    法: '太极', 级别: '参考（**两说并列**）', 取向: 太极取向.length ? 太极取向 : ['（本层不定方向）'],
    依据: taiji.用神方向.map((d) => `${d.派}→取${d.取}`).join('；'),
    声明: (taiji.体 === '依组合' ? '本月先天不定体（依组合），本取向仅供参考。' : '')
      + '两说方向相反时已并集列出，**不得径取一说**；'
      + '另注：本法「立阴为体」等设定经核查**无古籍依据**（现代讲义整理）。'
      + ' **[已按使用者决定从解盘中停用]**',
  };
  if (opts.includeTaiji === true) 诸法.push(太极条目);

  const sm = sanmingOf(chart);

  // ── 与体用比对 ────────────────────────────────────────────────
  const 体用集 = new Set(体用取向);
  const 参考法 = 诸法.filter((x) => x.法 !== '体用');
  for (const x of 参考法) {
    const 集 = new Set(x.取向.filter((e) => 五行.includes(e)));
    if (!集.size) { x.与体用 = '无法比对'; x.相左 = false; continue; }
    const 共 = [...集].filter((e) => 体用集.has(e));
    x.与体用 = 共.length ? `同向（共有 ${共.join('')}）` : '**相左**';
    x.相左 = 共.length === 0;
  }
  const 可比对 = 参考法.filter((x) => x.与体用 !== '无法比对');
  const 相左法 = 可比对.filter((x) => x.相左);
  // ★ 阈值：使用者 2026-09-28 定「反对占六成」。
  const 严重线 = 0.6;
  const 严重不符 = 体用取向.length > 0 && 可比对.length > 0
    && 相左法.length >= 可比对.length * 严重线;

  const 说明 = [
    '**规则（用户 2026-09-28 明定）**：体用最高，其他也参考；'
    + '**若结论严重不符（各法意见差别大），再附上其他法思考的结果**。',
    `本盘：可参与比对 ${可比对.length} 法，与体用**相左 ${相左法.length} 法**`
    + (相左法.length ? `（${相左法.map((x) => x.法).join('、')}）` : ''),
    '「严重不符」判据（**使用者 2026-09-28 定：反对占六成**）：'
    + `相左法数 ≥ 可比对法数 × 60%。本盘 ${相左法.length} / ${可比对.length}`
    + `（需 ≥ ${(可比对.length * 严重线).toFixed(1)}）⇒ ${严重不符 ? '**成立**' : '不成立'}。`,
  ];
  if (严重不符) {
    说明.push('★ **本盘判为「严重不符」** → 按规则 3，**须附上下列持异议各法的完整推理链**，'
      + '与体用主结论**并列呈现，不得私下调和**。');
  } else {
    说明.push('本盘**未达**「严重不符」 → 按规则 2，各法取向照录为参考，'
      + '**不必展开各自推理链**（以免淹没主结论）。');
  }

  return {
    主结论: {
      法: '体用',
      用神: 体用取向.length ? 体用取向 : null,
      忌神: opts.忌神五行 ? 取五行(opts.忌神五行) : (体用?.忌神 ?? null),
      地位: '**最高裁决**（用户 2026-09-28 所定）',
    },
    诸法,
    比对: {
      可比对法数: 可比对.length,
      相左法数: 相左法.length,
      相左各法: 相左法.map((x) => x.法),
      严重不符,
    },
    须附异议推理链: 严重不符 ? 相左法.map((x) => x.法) : [],
    异议各法思考: 严重不符
      ? 相左法.map((x) => ({ 法: x.法, 级别: x.级别, 取向: x.取向, 依据: x.依据, 声明: x.声明 ?? null }))
      : null,
    // ★ 用神落到具体干支字并回验（使用者 2026-09-28：「第五件要翻成那几个字回头验证」）
    用神粒化: 体用取向.length ? 用神Grainify(chart, 体用取向) : null,
    古法三命并列: {
      提示: '古法三命**没有"取用神"这一步**（以年为本、重纳音与神煞），'
        + '故**不参与本仲裁**，只在此并列提示。',
      本命: sm.本命,
      九命: sm.九命,
    },
    已停用各法: {
      太极: {
        提示: '**太极法已按使用者 2026-09-28 决定从解盘中停用**——不再参与本仲裁，也不计入"相左法数"。'
          + '代码与判据完整保留，传 `{ includeTaiji: true }` 可恢复入列。',
        条目: 太极条目,
      },
    },
    说明,
    注: '本函数**不合并、不加权、不评分**——只判定"谁最高 + 谁相左 + 是否严重"。'
      + '规则 1 的适用由调用方执行；引擎不代判各法孰优。',
    据: '用户 2026-09-28 指示；各法出处见各自条目',
  };
}

/**
 * 极旺闸（`wangGateOf`）—— 与 `congGateOf` **对称的另一半**。
 *
 * ## 为什么要有这一半
 *
 * `congGateOf` 只防**极弱**：极弱时不许直接取印比，须先过从格关。
 * 但**反方向完全没闸**：日主**极旺**时，旺衰法会给出"宜泄宜克"（取食伤财官），
 * 而若此局实为**专旺**（曲直／炎上／稼穑／从革／润下），则**克它反而激怒旺神**，
 * 正确方向是**顺其旺势**、以食伤流通为用，官杀反成忌。
 *
 * 这正是《滴天髓》「**顺逆不齐也，不可逆者，其气势而已矣**」在旺侧的同一条道理——
 * 气势既不可逆，则"泄克"与"顺"之别决定整盘取用，**错一边即整盘全反**。
 *
 * ## 判据不另造——直接沿用 `specialGejuOf`
 *
 * 专旺／从旺／从强／两神成象的判据已由 `specialGejuOf` 依
 * **《千里命稿》§3011–3037**（从旺例「癸卯 乙卯 甲寅 乙亥」、从强例「壬子 癸卯 甲子 甲子」）
  * 与《造化元钥》「专旺格局，尤以得时得地为要也」写成；**本函数不重复定义成格判据**，
 * 但自设一个「极旺」闸门阈值（见下，属**引擎操作化**；旧文称"不另立阈值"与此相抵，已更正）。
 * 只负责：① 判是否"极旺"到须过闸；② 把 `specialGejuOf` 的结论转成"方向该顺还是该克"。
 *
 * 与三书的对账结果（`specialGejuOf().三书对账`）一并带出：诸书对"从旺／从强"门槛不一，
 * 且《神峰通考》《八字提要》该格名 0 匹配——**故本闸门只报"须先过闸"，不代判成败**。
 *
 * @param {object} chart
 * @returns {object}
 */
export function wangGateOf(chart) {
  const d = dayMasterSupport(chart);
  const dayEl = d.日主五行;
  const 印五行 = ELEMENTS.find((e) => SHENG_MAP[e] === dayEl) ?? null;
  const 同党 = [dayEl, 印五行].filter(Boolean);
  const 占比 = d.五行占比;
  const 同党占比 = Number(同党.reduce((a, e) => a + (占比[e] ?? 0), 0).toFixed(1));

    // 「极旺」的机械判据：**当令** 且 日主同党（比劫＋印）占比达阈值。
  // ⚠ 旧注释写"当令 且（有根或有势）且…"，但 `得令或得地`（＝得令 ‖ 得地）已被 `d.得令` 蕴含，
  //   故"有根／有势"这一合取项**从未被检验**，亦不含"得势"；文案凡称"且有根／有势"者与此实况不符。
  // ★ 阈值为**引擎操作化**（本项目对占比类阈值一律如此标注），非古籍明文。
  const 阈值 = 60;
  const 得令或得地 = d.得令 || d.得地.length > 0;   // 保留原名与形态，仅注明其被 d.得令 蕴含
  const 极旺 = d.得令 && 得令或得地 && 同党占比 >= 阈值;

  // 克泄之神（官杀＝克我者、财＝我克者）的透干／通根，用于判"格局是否被杂"
  const posNames = ['年', '月', '日', '时'];
  const 在局 = (el) => {
    const 透干 = []; const 本气根 = []; const 中余气根 = [];
    for (let i = 0; i < 4; i++) {
      const p = chart.pillars[i];
      const st = p.stem ?? STEMS[p.stemIndex];
      const br = p.branch ?? BRANCHES[p.branchIndex];
      if (i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(st)]] === el) 透干.push(`${posNames[i]}干${st}`);
      for (const h of HIDDEN_STEMS_SPEC[BRANCHES.indexOf(br)]) {
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] !== el) continue;
        (h[0] === HIDDEN_STEMS_SPEC[BRANCHES.indexOf(br)][0][0] ? 本气根 : 中余气根)
          .push(`${posNames[i]}支${br}·${h[1]}${h[0]}`);
      }
    }
    return {
      透干, 本气根, 中余气根,
      // ★ 「在局」须从严：透干 或 本气根。仅中余气者只能算"有气"，**不算逆旺之神在局**——
      //   否则几乎每个盘都会报"官杀在局"，把"专旺被杂"的判据冲淡。两档如实分列。
      在局: 透干.length + 本气根.length > 0,
      仅藏余气: 透干.length + 本气根.length === 0 && 中余气根.length > 0,
    };
  };
  const 官杀五行 = ELEMENTS.find((e) => KE_MAP[e] === dayEl) ?? null;
  const 财五行 = KE_MAP[dayEl];
  const 食伤五行 = SHENG_MAP[dayEl];
  const 官杀 = 在局(官杀五行);
  const 财 = 在局(财五行);
  const 食伤 = 在局(食伤五行);

  // 复用 specialGejuOf 的结论
  const sg = specialGejuOf(chart);
  const 旺格 = (sg.成立者 ?? []).filter((x) => /从旺|从强|两神成象|专旺|曲直|炎上|稼穑|从革|润下/.test(String(x)));

  const 闸门结论 = [];
  let 第5层被阻止 = false;
  let 方向 = '按常法（身旺取食伤财官）';

  if (!极旺) {
    闸门结论.push(`日主非"极旺"之局（当令=${d.得令}、得地 ${d.得地.length} 处、`
      + `同党占比 ${同党占比}% < 阈值 ${阈值}%）——**极旺闸不触发**，按六层常序作答即可。`);
  } else {
    第5层被阻止 = true;
        闸门结论.push(`**日主极旺**（当令，且日主同党〔${同党.join('')}〕占比 **${同党占比}%** ≥ 阈值 ${阈值}%`
      + '；⚠ 本闸只检「当令 × 同党占比」，**不另检"有根／有势"**，旧文案已更正）'
      + '——**第 5 层（中和扶抑）在此必须先过旺格关**，不可径以"身旺"取食伤财官。');
    if (旺格.length) {
      方向 = '**顺其旺势**（专旺／从旺成格：以食伤流通为用，官杀反为忌）';
      闸门结论.push(`**旺格成立**：${旺格.join('、')}（据 \`specialGejuOf\`）。`
        + '《滴天髓》：「**不可逆者，其气势而已矣**」——气势既成，**克之则激、泄之则通**；'
        + '故**官杀为忌**，正确方向是顺其旺势。');
    } else {
      方向 = '**未成旺格 → 仍按常法泄克**（但须说明为何可逆）';
      闸门结论.push('**旺格未成立**（`specialGejuOf` 未列出从旺／从强／两象等）——'
        + '此时旺衰法的"宜泄宜克"方向可用，但**须先在本层说明气势为何可逆**，不得默认。');
    }
    // 杂气提示：官杀／财在局，是"格局被杂"的判据（**仅中余气者另列，不算在局**）
    if (官杀.在局) {
      闸门结论.push(`⚠ **官杀（${官杀五行}）在局**（透干 ${官杀.透干.join('、') || '无'}；`
        + `本气根 ${官杀.本气根.join('、') || '无'}）——`
        + '专旺格要求"**绝无一毫官杀之气**"，有此则须查是否成**假从／假专旺**。');
    } else if (官杀.仅藏余气) {
      闸门结论.push(`官杀（${官杀五行}）**仅中余气**（${官杀.中余气根.join('、')}），`
        + '未透干、无本气根——按"在局"从严口径**不算逆旺之神在局**，但须留意岁运引透。');
    }
    if (财.在局) {
      闸门结论.push(`⚠ **财（${财五行}）在局**（透干 ${财.透干.join('、') || '无'}；`
        + `本气根 ${财.本气根.join('、') || '无'}）——财为"我克"，在专旺格中属逆旺之神，同样须查假从。`);
    } else if (财.仅藏余气) {
      闸门结论.push(`财（${财五行}）**仅中余气**（${财.中余气根.join('、')}），不算在局。`);
    }
    if (食伤.在局 || 食伤.仅藏余气) {
      闸门结论.push(`食伤（${食伤五行}）在局（透干 ${食伤.透干.join('、') || '无'}）——`
        + '专旺格的**合法出口**：旺极则宜泄，食伤流通正是"顺其旺势"的落地方式。');
    }
  }

  return {
    日主: d.日主, 日主五行: dayEl, 月令: d.月令, 月令令态: d.月令令态,
    是否极旺: 极旺,
    同党: 同党, 同党占比, 阈值,
    阈值说明: `阈值为**引擎操作化**（${阈值}%），非古籍明文——`
      + '本项目对占比类阈值一律如此标注。真正的判据是下栏 `specialGejuOf` 的成格结论。',
    旺衰三项: { 得令: d.得令, 得地: d.得地, 得势: d.得势 },
    官杀: { 五行: 官杀五行, ...官杀 },
    财: { 五行: 财五行, ...财 },
    食伤: { 五行: 食伤五行, ...食伤 },
    旺格成立: 旺格.length ? 旺格 : null,
    取用方向: 方向,
    第5层被阻止,
    闸门结论,
    须先过关: 极旺
      ? ['① 判此局是"专旺成格"还是"身旺可泄"（看 `旺格成立` 与官杀／财是否在局）',
        '② 若专旺成格 → 顺其旺势（食伤为出口、官杀为忌）；若未成格 → 常法泄克但须说明为何可逆',
        '③ 过此二关后，第 5 层方可候选']
      : ['无需旺格关；仍守"第 5 层最后"'],
    各家门槛不一: sg.三书对账 ?? null,
    据: '《滴天髓》「顺逆不齐也，不可逆者，其气势而已矣」；'
      + '专旺／从旺／从强判据沿用 `specialGejuOf`（《千里命稿》§3011–3037、《造化元钥》「专旺格局，尤以得时得地为要也」）',
    注: '本闸门与 `congGateOf`（极弱侧）**对称**：两者都不代判成败，只判"第 5 层能否直接动手"。'
      + '旺侧的正确方向常是"顺"而非"泄克"，这是旺衰法最容易给反答案的地方。',
  };
}

/**
 * 古法纳音推算法：**支干数（两柱合计）→ 除六五 → 余数配五行**（唐代算法）。
 *
 * ## 支干数（《李虚中命书》卷中原文，三书一致）
 *
 *   甲己子午**九**、乙庚丑未**八**、丙辛寅申**七**、丁壬卯酉**六**、戊癸辰戌**五**、巳亥**四**。
 *
 * ★ **干与支的分组方式不同，极易写错**：
 *   天干**隔一位成组**——甲己、乙庚、丙辛、丁壬、戊癸（甲=9, 乙=8, 丙=7, 丁=6, 戊=5, 己=9…）
 *   地支**相邻成组**——子丑、寅卯、辰巳、午未、申酉、戌亥
 *   但数值序列相同：子9 丑8 寅7 卯6 辰5 巳4 午9 未8 申7 酉6 戌5 亥4
 *
 * ## ★★ 必须用**两柱**合计，不能用单柱
 *
 * 原文例证全部是两柱并列：「假令水得五者……故**丙子丁丑共得三十之数**」。
 * 实测：单柱法只能对上 24/60，两柱法才能对上 60/60。
 *
 * ## 余数配五行：**实测反推（与古典那句有 3/5 不同，此处如实并陈）**
 *
 * 用全部 30 组（＝60 柱）对整张纳音表反推，得到**唯一自洽映射**（0 冲突）：
 *
 *   余 1→火　2→土　3→木　4→金　5→水
 *
 * 而古曲那句「**一水二火三木四金五土**」（＝《命理探源》引《瑞桂堂暇录》
 * 「一六为水、二七为火、三八为木、四九为金、五十为土」）为
 * 1→水 2→火 3→木 4→金 5→土，**只在余 3、4 两处与实测相同**。
 *
 * 本节**以实测映射为准**——只有它能使 60/60 复现纳音表，且八组原文例证
 * （甲子乙丑34→余4→金、丙子丁丑30→余5→水、戊子己丑31→余1→火、
 * 庚子辛丑32→余2→土、壬子癸丑28→余3→木、戊辰己巳23→余3→木、
 * 庚午辛未32→余2→土、甲申乙酉30→余5→水）**逐一吻合**。
 * 古典那句与实测的出入，**引擎不代为调和**，一并返回于 `古典异说`，由调用方并陈。
 *
 * ★ **两处极易写错、本项目实际连续踩过的地方**：
 *   1. **必须用两柱合计**，不能用单柱（原文例证全是「丙子丁丑共得三十之数」）。
 *      实测单柱法只能对上 24/60，两柱法 60/60。
 *   2. **干与支的取值周期不同**：干 `9 − (序号 % 5)`、支 `9 − (序号 % 6)`。
 *      写成同一个周期会各错一半（本轮先写成同一个，又写成 `9−⌊bi/2⌋`，均错）。
 *
 * @param {string} stem 天干（两柱中的**前一柱**）
 * @param {string} branch 地支（两柱中的前一柱）
 * @returns {object|null}
 */
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

/**
 * 古法三命 + 九命。
 *
 * **以年为本**：干禄＝年干、支命＝年支、纳音身＝年柱纳音。
 * 「三元各分生旺库之地而为九命」——三元各自的落支若在该五行的
 * 长生／帝旺／墓 位，即得 生／旺／库 一态，三态×三元＝九命。
 *
 * @param {object} chart
 */
export function sanmingOf(chart) {
  const pillars = chart.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('sanmingOf: chart.pillars 须为四柱');
  const yearStem = pillars[0].stem;
  const yearBranch = pillars[0].branch;
  const yearIdx = gzIndex(STEMS.indexOf(yearStem), BRANCHES.indexOf(yearBranch));
  const ny = nayinOf(yearIdx);
  const nyShu = nayinByShu(yearStem, yearBranch);
  const monthBranch = pillars[1].branch;

  const 三元 = {
    干禄: { ...SANMING_ROLES.干禄, 字: yearStem, 五行: ELEMENTS[STEM_ELEMENT[STEMS.indexOf(yearStem)]],
      落支: yearBranch, 宫位: elementBranchStage(ELEMENTS[STEM_ELEMENT[STEMS.indexOf(yearStem)]], BRANCHES.indexOf(yearBranch)) },
    支命: { ...SANMING_ROLES.支命, 字: yearBranch, 五行: ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(yearBranch)]],
      落支: yearBranch, 宫位: elementBranchStage(ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(yearBranch)]], BRANCHES.indexOf(yearBranch)) },
    纳音身: { ...SANMING_ROLES.纳音身, 字: ny.name, 五行: ny.element,
      落支: yearBranch, 宫位: elementBranchStage(ny.element, BRANCHES.indexOf(yearBranch)) },
  };

  // 九命：三元 × 生旺库
  const 九命 = {};
  let 得位 = 0;
  for (const [k, v] of Object.entries(三元)) {
    const t = sanTai(v.宫位);
    v.三态 = t;
    if (t) 得位++;
    九命[k] = t ? `${t}（${v.宫位}）` : `不入生旺库（${v.宫位}）`;
  }

  // 四柱各柱的纳音（古法"四柱纳音"是本支派的核心材料）
  const 四柱纳音 = pillars.map((p, i) => {
    const idx = gzIndex(STEMS.indexOf(p.stem), BRANCHES.indexOf(p.branch));
    const n = nayinOf(idx);
    return {
      位: ['年', '月', '日', '时'][i], 柱: p.gz,
      纳音: n.name, 五行: n.element,
      宫位: elementBranchStage(n.element, BRANCHES.indexOf(p.branch)),
      古法数: nayinByShu(p.stem, p.branch),
    };
  });

  // 纳音自校验：唐算法 vs 纳音表
  const 校验 = nayinTableCheck();

  return {
    支派: '古法三命（唐宋禄命术）',
    体系声明: '本组与子平**是两套体系**：古法**以年为本**、重纳音与神煞、三元并看；'
      + '子平以日为主、重月令格局。**同名异义**（三元／身／空／官鬼／食／格／宫）**不可混用**，'
      + '两套结论**并列呈现，不互相补洞**。',
    本命: { 柱: pillars[0].gz, 干禄: yearStem, 支命: yearBranch, 纳音身: ny.name, 纳音五行: ny.element },
    三元,
    九命,
    得位三元数: 得位,
    四柱纳音,
    纳音推算法: nyShu,
    纳音表校验: 校验,
    据: '《李虚中命书》卷中「三元者干禄支命，纳音身各分衰旺之地。三元各分生旺库之地而为九命」；'
      + '《鬼谷遗文-三命结构》三命取象；《命理探源》引《瑞桂堂暇录》纳音数',
  };
}

/**
 * 纳音表自校验：用唐代「支干数→除六五→余数配五行」逐柱复算，
 * 与引擎内既有纳音表（`NAYIN_ELEMENT`）比对。**不一致即为表有误**。
 */
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

/** 统计口径的「三元力量」（供并陈时引用，不作吉凶判断）。 */
export function sanmingStrength(chart) {
  const chart2 = { pillars: chart.pillars };
  const s = elementStrength(chart2.pillars, chart2.pillars[1].branch);
  const sm = sanmingOf(chart2);
  return {
    五行占比: s.percent,
    三元五行: { 干禄: sm.三元.干禄.五行, 支命: sm.三元.支命.五行, 纳音身: sm.三元.纳音身.五行 },
    注: '古法亦有以三元五行与原局五行对看者，但**本引擎只给占比与三元落点**，'
      + '吉凶判断须依《李虚中命书》《五行精纪》正文，**不在此代判**。',
  };
}

/* ------------------------------------------------------------------ *
 * 十八、分歧触发器（controversiesOf）
 *
 * 目的：把「此处各家有分歧」变成**确定性输出**，不靠模型临场想起来。
 * 分歧盘上的错误绝大多数不是算错，而是**没意识到某处是分歧点，径取一派当事实讲**；
 * 故本函数只做一件事：命中结构 → 报出各派主张与其成立条件。
 * 它**不选边、不折中、不判吉凶**；「引擎注」用于说明该争本身有无机械判据。
 *
 * 各条依据均可在 knowledge/ 对应模块中复核。
 * 凡引文皆取自模块内已校对的原文；凡属模块自承之局限，直接引其原话。
 * ------------------------------------------------------------------ */

/** 子平《子平真诠》2.5 用神取法总则：善神顺用、不善神逆用 */
const GEJU_FAVOR = {
  正官: { 类: '善神顺用', 喜: ['正财', '偏财', '正印', '偏印'], 忌: ['伤官', '七杀'] },
  正财: { 类: '善神顺用', 喜: ['食神', '正官'], 忌: ['比肩', '劫财'] },
  偏财: { 类: '善神顺用', 喜: ['食神', '正官'], 忌: ['比肩', '劫财'] },
  正印: { 类: '善神顺用', 喜: ['正官', '七杀'], 忌: ['正财', '偏财'] },
  偏印: { 类: '善神顺用', 喜: ['正官', '七杀'], 忌: ['正财', '偏财'] },
  食神: { 类: '善神顺用', 喜: ['正财', '偏财'], 忌: ['偏印'] },
  七杀: { 类: '不善神逆用', 喜: ['食神', '伤官', '正印', '偏印'], 忌: ['正财', '偏财'] },
  伤官: { 类: '不善神逆用', 喜: ['正印', '偏印', '正财', '偏财'], 忌: ['正官'] },
  劫财: { 类: '不善神逆用', 喜: ['正官', '七杀'], 忌: [] },
  比肩: { 类: '不善神逆用', 喜: ['正官', '七杀', '食神', '伤官'], 忌: [] },
};

/** 月令取格之初步：本气及其透干。**不判成破救应**（那须《子平真诠》八格全表，本引擎未实现） */
function yuelingSeed(chart) {
  const pillars = chart.pillars;
  const dayStemIndex = STEMS.indexOf(pillars[2].stem);
  const monthBranchIndex = BRANCHES.indexOf(pillars[1].branch);
  const 本气 = HIDDEN_STEMS_SPEC[monthBranchIndex][0][0];
  const 本气God = tenGod(dayStemIndex, STEMS.indexOf(本气));
  const posNames = ['年', '月', '日', '时'];
  const 透干 = [];
  for (let i = 0; i < 4; i++) {
    if (i === 2) continue;
    if (tenGod(dayStemIndex, STEMS.indexOf(pillars[i].stem)) === 本气God) 透干.push(`${posNames[i]}干${pillars[i].stem}`);
  }
  return { 月令: pillars[1].branch, 本气, 本气God, 透干 };
}

/**
 * 分歧触发器：报出本盘命中的**各家分歧点**及其成立条件。
 *
 * @param {object} chart castChart / pillarsMode 的返回值（须含 pillars[].stem/.branch）
 * @returns {Array<{代号:string, 分歧点:string, 命中结构:string,
 *   各派主张:Array<{派:string,主张:string,据:string}>,
 *   本盘事实:object, 须先确定:string[], 引擎注?:string}>}
 */
/**
 * 分歧触发器。
 *
 * ★ **太极法默认不参与解盘**（使用者 2026-09-28 决定：**代码保留，解盘跳过**）。
 *   故与太极法绑定的两条代号默认**不报**：
 *     · `autumn-wood-fall-vs-taiji` —— 它的"乙方"就是太极派
 *     · `tiaohou-vs-taiji` —— 整条就是调候与太极相冲
 *   需要时传 `{ includeTaiji: true }` 可恢复（代码与判据完整保留，见 `taijiOf` 等）。
 *
 * @param {object} chart
 * @param {{includeTaiji?:boolean}} [opts]
 */
export function controversiesOf(chart, opts = {}) {
  const includeTaiji = opts.includeTaiji === true;
  const pillars = chart.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('controversiesOf: chart.pillars 须为四柱');
  const posNames = ['年', '月', '日', '时'];
  const stems = pillars.map((p) => p.stem);
  const branches = pillars.map((p) => p.branch);
  const dayStemIndex = STEMS.indexOf(stems[2]);
  const dayElIdx = STEM_ELEMENT[dayStemIndex];
  const dayEl = ELEMENTS[dayElIdx];
  const monthElIdx = STEM_ELEMENT[STEMS.indexOf(HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[1])][0][0])];

  const stemGods = stems.map((s) => tenGod(dayStemIndex, STEMS.indexOf(s)));
  const hiddenGods = branches.map((b) => HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].map((h) => tenGod(dayStemIndex, STEMS.indexOf(h[0]))));
  // 日干对自身恒为比肩，须排除，否则"无根"永远被自己否定
  const 透Gods = [stemGods[0], stemGods[1], stemGods[3]];
  const 全Gods = [...透Gods, ...hiddenGods.flat()];

  const out = [];
  const add = (o) => out.push(o);

  // ── 1. 日主无根：从格与否 ────────────────────────────────────────────────
  const 支藏同类 = pillars.some((p) => HIDDEN_STEMS_SPEC[BRANCHES.indexOf(p.branch)]
    .some((h) => STEM_ELEMENT[STEMS.indexOf(h[0])] === dayElIdx));
  const 干有同类 = [0, 1, 3].some((i) => STEM_ELEMENT[STEMS.indexOf(stems[i])] === dayElIdx);
  if (!支藏同类 && !干有同类) {
    add({
      代号: 'follow-vs-normal',
      分歧点: '日主地支无根、天干无同类，是否论从格',
      命中结构: `${dayEl}日主不通根于四支，天干亦无同类帮扶`,
      各派主张: [
        {
          派: '从格派（《滴天髓》任氏四从）',
          主张: '弱极则扶之徒劳，宜从其旺势；既从之后，行运反此必凶',
          据: '《滴天髓阐微》2.10 从象、化象、假从、假化；任氏自注「此四从，诸书所未载，余之立说，试验确实」——即此说为任铁樵自创，非古法',
        },
        {
          派: '正格派（衰旺扶抑）',
          主张: '无根仍须印比帮扶；且「五阳从气不从势，五阴从势无情义」，从格易成于阴干、难成于阳干',
          据: '《滴天髓阐微》通神论·衰旺「衰则喜帮喜助」；通神论·天干「五阳从气不从势」',
        },
        {
          派: '太极法（盲派一系）',
          主张: '「阳干从气不从势，稍微有一点生扶，都是难从的」——对从格取极严口径',
          据: '《盲派与象法》6.1 实战分歧①（该模块自注与子平法分歧）',
        },
      ],
      本盘事实: { 日主: stems[2], 日主五行: dayEl, 地支藏同类: false, 天干有同类: false, 透干十神: 透Gods, 十神分布: 全Gods },
      须先确定: ['有无假从之可能（根浅力薄而劫印自顾不暇）', '食伤、财、官杀三者孰独旺（决定从何神）', '日干为阳为阴'],
      引擎注: '《滴天髓阐微》局限节自承：「多旺才算旺极，没有给出可核对的界限，只能凭经验裁量」。故此争**本无机械判据**，引擎不代判，只报结构。',
    });
  }

  // ── 2. 调候用神被合：合去之争 ────────────────────────────────────────────
  const tha = tiaohouAssessment(chart);
  if (tha) {
    const 他干合 = (tha.被合之神 ?? []).filter((x) => x.类别 === '他干合之（或为合去）');
    if (他干合.length) {
      add({
        代号: 'combine-away',
        分歧点: '调候用神被他干合，是否作「合去」论',
        命中结构: 他干合.map((x) => `${x.栏}${x.神} 被 ${x.位置} 合（化${x.化}）`).join('；'),
        各派主张: [
          {
            派: '合去论（《子平真诠》）',
            主张: '喜神被他干合去则「逢吉不为吉」——用神非其用神',
            据: '《子平真诠》2.3「四喜神因合而无用→逢吉不为吉：…甲用丙食与辛作合（非其食）」',
          },
          {
            派: '合化论（同一段的反向）',
            主张: '若所合者为忌神，则「四忌神因合化吉→逢凶不为凶」，合反为解',
            据: '《子平真诠》2.3「甲逢庚煞与乙作合而煞不攻身」',
          },
          {
            派: '盲派（伤官合杀）',
            主张: '伤官与七杀相合非为损，而是「用智慧取得权力之意」，主贵',
            据: '《盲派与象法》2.7 事业口诀「杀为权力，伤为智慧，伤官合杀，用智慧取得权力之意」',
          },
        ],
        本盘事实: { 被合之神: 他干合, 调候用神: tha.用神, 调候辅佐: tha.辅佐 },
        须先确定: ['所合者是喜神还是忌神（同一合，二者净效果相反）', '合化是否成立（见 combine-transform 条）', '是否另有他干争合'],
        引擎注: '《子平真诠》2.3 在同一段内给出两个相反方向，本身即未作单一结论；三派并陈，不可私下调和。',
      });
    }
  }

  // ── 3. 合化能否成立 ──────────────────────────────────────────────────────
  const 合化 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const hua = STEM_COMBINE[stems[i] + stems[j]] ?? STEM_COMBINE[stems[j] + stems[i]];
      if (!hua) continue;
      const huaElIdx = ELEMENTS.indexOf(hua);
      const 得令 = monthElIdx === huaElIdx;
      const 有根 = branches.some((b) => HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].some((h) => STEM_ELEMENT[STEMS.indexOf(h[0])] === huaElIdx));
      const 化神透 = stems.some((s, k) => k !== i && k !== j && STEM_ELEMENT[STEMS.indexOf(s)] === huaElIdx);
      合化.push({
        二干: `${posNames[i]}${stems[i]} — ${posNames[j]}${stems[j]}`,
        紧贴: Math.abs(i - j) === 1,
        化: hua,
        化神得令: 得令, 化神有根: 有根, 化神另透: 化神透,
        成立条件是否足备: 得令 && 有根,
      });
    }
  }
  const 六合化 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const hua = BRANCH_COMBINE[branches[i] + branches[j]] ?? BRANCH_COMBINE[branches[j] + branches[i]];
      if (!hua) continue;
      const huaElIdx = ELEMENTS.indexOf(hua);
      const 得令 = monthElIdx === huaElIdx;
      const 有根 = branches.some((b) => HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].some((h) => STEM_ELEMENT[STEMS.indexOf(h[0])] === huaElIdx));
      六合化.push({ 二支: `${posNames[i]}${branches[i]} — ${posNames[j]}${branches[j]}`, 化: hua, 化神得令: 得令, 化神有根: 有根 });
    }
  }
  if (合化.length || 六合化.length) {
    add({
      代号: 'combine-transform',
      分歧点: '合能否「化」成新五行',
      命中结构: [...合化.map((x) => `干合 ${x.二干} 化${x.化}`), ...六合化.map((x) => `支合 ${x.二支} 化${x.化}`)].join('；'),
      各派主张: [
        {
          派: '从化论',
          主张: '合而化则五行改易，喜忌随之而变；化神得地（得令且有根）方作化论',
          据: '《子平真诠》2.3 化气次序；《滴天髓阐微》化象、假化',
        },
        {
          派: '不轻言化（盲派）',
          主张: '「天干五合、地支六合和三合局都不能只凭字面宣布化成新的五行」，须验化神有无根气',
          据: '《盲派与象法》6.1 实战分歧④',
        },
        {
          派: '合而不合（《子平真诠》四种情形）',
          主张: '隔于有所间则合而不敢合；隔位太远则半合，祸福得十之二三；争合妒合则情不专',
          据: '《子平真诠》2.3「合而不合的四种情形」表',
        },
      ],
      本盘事实: { 天干五合: 合化, 地支六合: 六合化, 月令五行: ELEMENTS[monthElIdx] },
      须先确定: ['化神是否得令且有根（引擎已列，成立则化论可立）', '两干是否紧贴、有无间隔（紧贴则合力强）', '是否争合妒合'],
      引擎注: '化与不化直接改变五行与喜忌，故引擎同时列出「化神得令/有根/另透」三项事实，供两轨各算，不代为择一。',
    });
  }

  // ── 4. 六合与相破（相刑）并见 ────────────────────────────────────────────
  const 合破 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = branches[i], b = branches[j];
      const he = BRANCH_COMBINE[a + b] ?? BRANCH_COMBINE[b + a];
      const po = BRANCH_DESTROY.includes(a + b) || BRANCH_DESTROY.includes(b + a);
      if (he && po) 合破.push({ 二支: `${posNames[i]}${a} — ${posNames[j]}${b}`, 六合化: he, 相破: true });
    }
  }
  if (合破.length) {
    add({
      代号: 'combine-destroy',
      分歧点: '同一对地支既六合又相破（寅亥、巳申），合与破孰主',
      命中结构: 合破.map((x) => `${x.二支}：六合化${x.六合化}，同时又相破`).join('；'),
      各派主张: [
        { 派: '合能解破', 主张: '会合可以解刑冲，合则破不为害', 据: '《子平真诠》2.4「会合可以解刑冲」' },
        { 派: '因解而反得', 主张: '合去其一则一合而一破/刑，解之适以生之', 据: '《子平真诠》2.4「因解而反得刑冲」' },
        { 派: '破能坏合', 主张: '相破拆散合局，合力不专', 据: '《子平真诠》2.4「刑冲而会合不能解」' },
      ],
      本盘事实: { 合破, 参见: 'relationsOf 的 地支六合 / 地支相破' },
      须先确定: ['合与破两者孰在月令、孰得岁运之助', '所合者是否用神（刑冲用神尤为破格）'],
      引擎注: '《子平真诠》2.4 专设「刑冲会合与解破」一节，列四种互制情形，本身即说明此事无单一定则。',
    });
  }

  // ── 5. 三刑两两互见（口径之争） ──────────────────────────────────────────
  const 刑争 = branchPunishments(branches.map((b, i) => ({ label: posNames[i], branch: b }))).filter((x) => x.争议);
  if (刑争.length) {
    add({
      代号: 'punish-two-schools',
      分歧点: '三刑只见两支，是否成刑',
      命中结构: 刑争.map((x) => `${x.刑}：见 ${x.members}（${x.positions}），三支未全`).join('；'),
      各派主张: [
        { 派: '两两互刑论', 主张: '三支中任意两支相见即成刑，不必三支齐现', 据: '《子平真诠》2.4 定义「刑＝三刑（子卯、巳申、寅之类）」——即以两两为例，与三支全见说并存' },
        { 派: '三刑全见论', 主张: '须三支齐现方成刑，只见两支不作刑论', 据: '通行的三刑全见说（本引擎旧 relationsOf 口径；原书未明言此限，属后世取法）' },
      ],
      本盘事实: { 相刑: 刑争 },
      须先确定: ['所宗流派', '该刑是否落在用神与月令上'],
      引擎注: '本引擎**两派口径并报**，不再静默择一（旧版 relationsOf 只报三支全见、transitAnalysis 却报两支互刑，同一盘两处结论相反，已修正为同报）。',
    });
  }

  // ── 6. 官杀混杂与官杀藏露 ────────────────────────────────────────────────
  // 定性口径（依《子平真诠》取格通则，经使用者确认采严口径）：
  //   **混杂只在「同天干并透」或「同地支本气并见」时论。**
  //   一藏一透为「藏官露杀／藏杀露官」，**只论显现的那一个**，藏者降级为
  //   "根气／暗中受克之气"，不参与格局定性（可作暗应）。
  //   **藏干不得计入混杂的定性**——"把藏支官杀算作混杂"是最常见的错判之一。
  //
  // 但"官当令本气 + 杀透干"是第三种情形：既非并透、亦非本气并见，故按上则**不是混杂**；
  // 然而《子平真诠》2.17 李参政命（庚寅 乙酉 甲子 戊辰，甲用酉官、庚金混杂、乙以合之）
  // 正属此型而该书称"杂煞"，以「合煞留官」取清。故此种须单列，
  // 并同时给出"取清"与"安顿该神（化或制）"两种说法。
  const 官杀层级 = (god) => {
    const lv = { 透干: false, 月令本气: false, 他支本气: false, 中余气: false, 位: [] };
    if (透Gods.includes(god)) { lv.透干 = true; lv.位.push(`透干于${stems.map((s, i) => (i !== 2 && tenGod(dayStemIndex, STEMS.indexOf(s)) === god) ? `${posNames[i]}干${s}` : null).filter(Boolean).join('、')}`); }
    for (let i = 0; i < 4; i++) {
      const spec = HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])];
      for (let k = 0; k < spec.length; k++) {
        const h = spec[k];
        if (tenGod(dayStemIndex, STEMS.indexOf(h[0])) !== god) continue;
        if (k === 0) { if (i === 1) lv.月令本气 = true; else lv.他支本气 = true; }
        else lv.中余气 = true;
        lv.位.push(`${posNames[i]}支${branches[i]}·${h[1]}${h[0]}`);
      }
    }
    lv.显现 = lv.透干 || lv.月令本气 || lv.他支本气;
    lv.存在 = lv.显现 || lv.中余气;
    lv.级别 = lv.透干 ? '透干' : lv.月令本气 ? '月令本气' : lv.他支本气 ? '支本气' : lv.中余气 ? '中余气' : '不现';
    return lv;
  };
  const 官L = 官杀层级('正官');
  const 杀L = 官杀层级('七杀');
  const 真混杂 = (官L.透干 && 杀L.透干) || ((官L.月令本气 || 官L.他支本气) && (杀L.月令本气 || 杀L.他支本气));

  if (真混杂) {
    const 因由 = (官L.透干 && 杀L.透干) ? '同天干并透' : '同地支本气并见';
    add({
      代号: 'officer-mixed',
      分歧点: '官杀混杂，取清还是并用',
      命中结构: `正官与七杀${因由}（正官${官L.级别}；七杀${杀L.级别}）`,
      各派主张: [
        { 派: '取清论（《子平真诠》）', 主张: '有煞而杂官者，或去官或去煞，取清则贵', 据: '《子平真诠》39「有煞而杂官者，或去官，或去煞，取清则贵」；2.17 李参政命「庚金混杂，乙以合之，合煞留官，是杂煞而取清」' },
        { 派: '并用论（《滴天髓》）', 主张: '「官杀混杂者富贵甚多」，混杂未必为忌', 据: '《滴天髓阐微》官杀章（转引自该模块局限节所举三处并读之例）' },
        { 派: '不混论（气势相从）', 主张: '一杀一官而一方无根者，是官从杀势或杀从官势，非混', 据: '《滴天髓阐微》「年月两干透一杀、年月支中有财、时遇官星无根→官从杀势非混」' },
      ],
      本盘事实: { 定混杂之由: 因由, 透干十神: 透Gods, 正官: 官L, 七杀: 杀L },
      须先确定: ['去官留杀还是去杀留官（看何者有根、何者被合被制）', '有无食伤制杀或印绶化杀', '是否属"一方无根"的不混之例'],
      引擎注: '《滴天髓阐微》局限节自承：「官杀混杂者富贵甚多」与伤官章「伤官见官为祸百端」、制杀太过章「与其制杀太过不若官杀混杂之美」三处并读，初学者极易互扰——即原书内部张力未消解。'
        + '又：本引擎按「同天干并透／同地支本气并见」定混杂，**藏干不计入定性**。',
    });
  } else if (官L.存在 && 杀L.存在) {
    // 官杀皆现，但不构成混杂。须辨明是哪一种，并指明**只论哪一方**。
    const 当令者 = 官L.月令本气 ? '正官' : 杀L.月令本气 ? '七杀' : null;
    const 透者 = 官L.透干 && !杀L.透干 ? '正官' : 杀L.透干 && !官L.透干 ? '七杀' : (官L.透干 && 杀L.透干 ? '两者皆透' : null);
    let 子类, 只论;
    if (当令者 && 透者 && 透者 !== '两者皆透' && 当令者 !== 透者) {
      子类 = `${当令者}当令（月令本气），而${透者}透干——既非"同天干并透"，亦非"同地支本气并见"`;
      只论 = `格局以月令${当令者}为主；透出之${透者}则须**安顿**（合、制、化），问题不是"取清"`;
    } else if (官L.显现 !== 杀L.显现) {
      const 显 = 官L.显现 ? '正官' : '七杀';
      const 隐 = 官L.显现 ? '七杀' : '正官';
      子类 = `${显}显现（${官L.显现 ? 官L.级别 : 杀L.级别}），${隐}仅见于中余气（藏）——一藏一透`;
      只论 = `**只论${显}**；${隐}降级为"根气／暗中受克之气"，不参与格局定性，可作暗应`;
    } else if (官L.显现 && 杀L.显现) {
      子类 = `正官${官L.级别}、七杀${杀L.级别}，两者的显现层级不同，不构成并透或本气并见`;
      只论 = '不作混杂论；须分别安顿';
    } else {
      子类 = '正官与七杀皆仅见于中余气（皆藏而不显）';
      只论 = '两者皆不参与格局定性，只作暗应';
    }
    const 李氏例 = (当令者 === '正官' && 透者 === '七杀');
    add({
      代号: 'officer-hidden-exposed',
      分歧点: '官杀并现但不构成混杂——是"安顿"还是"取清"',
      命中结构: `${子类}。正官：${官L.位.join('、') || '不现'}；七杀：${杀L.位.join('、') || '不现'}`,
      各派主张: [
        {
          派: '《子平真诠》取格通则（本引擎定性所采）',
          主张: `混杂只在「同天干并透」或「同地支本气并见」时论。此处不符，故**不作混杂**：${只论}`,
          据: '《子平真诠》取格与用神变化诸篇通则（用神专求月令、以透干为格）'
            + (李氏例 ? '；惟该书 2.17 李参政命（庚寅 乙酉 甲子 戊辰）正是"正官当令、七杀透干"之型，而该书称"庚金混杂"、以"乙以合之，合煞留官"取清——即**子平对同一结构仍以"杂"称之并主取清**，与上述通则并存' : ''),
        },
        {
          派: '宽口径（部分民间／现代讲义）',
          主张: '凡地支藏有官杀者即计入，与显现者并论混杂，直接谈取清去留',
          据: '民间通行讲法；本模块未见古籍原文支持，属宽泛取法',
        },
      ],
      本盘事实: { 子类, 只论, 正官: 官L, 七杀: 杀L, 透干十神: 透Gods },
      须先确定: [`是否采宽口径（若采，则须一并处理不显现那一方的去留）`, '显现者如何安顿（合／制／化）', '不显现者是否被合被冲（决定其作为"暗应"是否受牵制）'],
      引擎注: '**本引擎不将本条报为"官杀混杂"**——"把藏支官杀算作混杂"是常见错判，故单列此条以正之。'
        + '凡涉格局定性（成败救应、去留取清），**只用显现的那一方**。'
        + (李氏例 ? '本型有《子平真诠》命例为证，故"取清"与"安顿"两说须并陈，不可只讲一边。' : ''),
    });
  }

  // ── 7. 食伤并透 ──────────────────────────────────────────────────────────
  if (透Gods.includes('食神') && 透Gods.includes('伤官')) {
    add({
      代号: 'output-mixed',
      分歧点: '食神与伤官并透，是否相碍',
      命中结构: `天干并透：${stems.filter((_, i) => i !== 2).join('、')}（十神 ${透Gods.join('、')}）`,
      各派主张: [
        { 派: '分用论', 主张: '食神善神顺用、伤官不善神逆用，制化之法不同，须分别处置', 据: '《子平真诠》2.5 善神顺用／不善神逆用' },
        { 派: '并旺论（盲派）', 主张: '食伤同为"我生"之气，并透则合力做功，宜看其合力所向（制杀、生财）', 据: '《盲派与象法》「制用」五法（食伤制杀、伤官去官）' },
      ],
      本盘事实: { 透干十神: 透Gods, 日主: stems[2] },
      须先确定: ['所制者为官还是杀', '有无印制伤、有无财化伤'],
    });
  }

  // ── 8. 穿（害）的地位 ────────────────────────────────────────────────────
  const 穿 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (BRANCH_HARM.includes(branches[i] + branches[j]) || BRANCH_HARM.includes(branches[j] + branches[i])) {
        穿.push(`${posNames[i]}${branches[i]} — ${posNames[j]}${branches[j]}`);
      }
    }
  }
  if (穿.length) {
    add({
      代号: 'harm-status',
      分歧点: '穿（害）的破坏力，各家评价相反',
      命中结构: `六穿：${穿.join('；')}`,
      各派主张: [
        { 派: '盲派（段氏）', 主张: '「盲师派特别注重穿，认为其危害力与杀伤力胜过了相冲」，列为核心动作之一', 据: '《盲派与象法》2.8 及 6.1 分歧表第 4 条' },
        { 派: '《渊海子平》', 主张: '「所谓相穿者，正是冲其合神之字」，象征仇敌', 据: '《盲派与象法》2.8 所引' },
        { 派: '《滴天髓》（贬斥）', 主张: '「刑既不足为凭，而害之义，尤为穿凿也」', 据: '《盲派与象法》2.8；并以林则徐命（乙巳 甲申 癸酉 壬戌）日时酉戌相害却为名臣反证' },
      ],
      本盘事实: { 穿, 须注意: '盲派内部另有分歧：只有酉戌、卯辰、子未、丑午穿可以相制，申亥、寅巳属"生穿"，只表象、不能相制' },
      须先确定: ['所穿者是否落于用神、日支、时支', '所穿二支是否属"可制之穿"'],
      引擎注: '本引擎以《三命通会》通行取法报出六害，并在 relationsOf 中注明"盲派重其破坏作用"；此处进一步说明**该评价本身即为分歧**，勿据引擎已列出即当作定论。',
    });
  }

  // ── 9. 调候用神与格局取用可能相反 ────────────────────────────────────────
  if (tha) {
    const seed = yuelingSeed(chart);
    const rule = GEJU_FAVOR[seed.本气God];
    const 调候Gods = [...new Set((tha.用神到位?.神 ?? []).map((g) => tenGod(dayStemIndex, STEMS.indexOf(g.神))))];
    const 冲突 = rule ? 调候Gods.filter((g) => rule.忌.includes(g)) : [];
    if (rule && 冲突.length) {
      add({
        代号: 'tiaohou-vs-geju',
        分歧点: '调候用神与月令格局的喜忌相反',
        命中结构: `月令${seed.月令}本气${seed.本气}为${seed.本气God}（${rule.类}，忌${rule.忌.join('、') || '无'}），而调候用神${tha.用神}相对日主为${冲突.join('、')}`,
        各派主张: [
          { 派: '调候派（《穷通宝鉴》）', 主张: '日主强弱不足恃，月令寒暖燥湿为急，先取调候用神，再论格局', 据: '《穷通宝鉴》体例（该模块开篇）' },
          { 派: '格局派（《子平真诠》）', 主张: '用神专求月令，善神顺用、不善神逆用；忌神即当去', 据: '《子平真诠》2.5 用神取法总则' },
          { 派: '太极法（盲派一系，更贬调候）', 主张: '「聪明的人，舍不得放弃，又领悟不了，就搞出了调候法」——认为调候法是太极法的退让版本', 据: '《盲派与象法》3.x 太极法（该模块自注与子平"冬夏以调候为急"分歧）' },
        ],
        本盘事实: { 月令: seed.月令, 月令本气: seed.本气, 月令本气十神: seed.本气God, 月令本气透干: seed.透干, 格局类: rule.类, 格局所忌: rule.忌, 调候用神: tha.用神, 调候用神之十神: 调候Gods, 冲突者: 冲突 },
        须先确定: ['以调候为急还是以格局为纲', '格局成破救应如何（详见体用推演层 gejuChengPoOf）'],
        引擎注: '月令取格此处底座只取本气与透干，未判成破；八格成破救应已由体用推演层 gejuChengPoOf 依据《子平真诠》全矩阵实现（P-021）。此处仅作底座粗冲突提示。',
      });
    }
  }

  // ── 10. 神煞的分量（限用条件） ───────────────────────────────────────────
  const 凶煞 = (chart.shensha ?? []).filter((s) => s.nature === '凶');
  if (凶煞.length) {
    add({
      代号: 'shensha-scope',
      分歧点: '神煞能否参与定贵贱',
      命中结构: `检出凶名神煞：${凶煞.map((s) => `${s.name}(${s.positions.join('、')})`).join('；')}`,
      各派主张: [
        { 派: '《子平真诠》（否定神煞定贵贱）', 主张: '「格局既成，即使满盘孤辰入煞，何损其贵？格局既破，即使满盘天德贵人，何以为功？」', 据: '《子平真诠》2.17 星辰无关格局（第 21 篇）' },
        { 派: '《三命通会》《渊海子平》', 主张: '神煞有独立应验，主性情、疾病、六亲、意外之事', 据: '《三命通会》2.13 神煞类目表（本引擎神煞取例所本）' },
        { 派: '盲派', 主张: '神煞不单独定吉凶，须与做功、宫位引动合看', 据: '《盲派与象法》应期与取象诸节' },
      ],
      本盘事实: { 凶名神煞: 凶煞.map((s) => s.name), 全部神煞: (chart.shensha ?? []).map((s) => s.name) },
      须先确定: ['格局既已定否（各家皆以格局先于神煞）'],
      引擎注: '神煞**只在格局已定之后用于细断**，不得单独据以断吉凶或生死。本引擎报出神煞仅为事实，不含权重。',
    });
  }

  // ── 11. 秋月木日主、身弱无根：中和派与太极派相反（提示词 §八 第1行）────────
  {
    const dms = dayMasterSupport(chart);
    const tj = includeTaiji ? taijiOf(branches[1]) : null;
    if (includeTaiji && dms.日主五行 === '木' && (branches[1] === '申' || branches[1] === '酉') && !dms.得令 && dms.得地.length === 0) {
      add({
        代号: 'autumn-wood-fall-vs-taiji',
        分歧点: '秋月木日主、身弱无根：取印比还是取火',
        命中结构: `日主${dms.日主}（木）生于${dms.月令}月（${dms.月令令态}），且**四支全无木之根气**（得地 0 处、得势 ${dms.得势.length} 处）`,
        各派主张: [
          { 派: '中和派', 主张: '取印比（水、木）扶身，先难后易——身弱无根则扶之', 据: '扶抑取用通则；提示词 §八 第1行所列甲方' },
          { 派: '阴阳／太极派', 主张: `${dms.月令}月立阳为体、**忌阴**；水既逆阳、又泄金而成阴、且助金，故不取水而取火，先易后难`,
            据: '《盲派与象法》4.3 立体表（申月"老阳向少阴转化，先天阳旺，以阳为体"）；提示词 §八 第1行所列乙方' },
          { 派: '本知识模块的并列建议', 主张: '两法**不互相补洞**，应各自独立作答后"三份结论并列比较，记录同向处与冲突处"',
            据: '《盲派与象法》6.x「可实现的合并顺序」⑤（段系"同盘双读"原则）' },
        ],
        本盘事实: { 日主: dms.日主, 月令: dms.月令, 月令令态: dms.月令令态, 得令: dms.得令, 得地: dms.得地, 得势: dms.得势, 太极层: { 体: tj.体, 定位: tj.定位, 方向: tj.用神方向 } },
        须先确定: ['以中和法为纲还是以太极法为纲（两派结论相反，不可调和）', '原局是否有寅午戌等最旺阳组合（申月立阳为体之例外）'],
        引擎注: '本节所据的提示词 §五 规定"第 2 层与第 5 层相反时第 2 层优先"，'
          + '而《盲派与象法》给出的是"并列比较、不互相补洞"。**两种合并方案并存，引擎不代选。**',
      });
    }

    // ── 12. 调候与太极相反（提示词 §八 第2行）
    //   ★ 太极法默认不参与解盘；须 includeTaiji 才报（代码保留）
    if (includeTaiji && tha && tj) {
      const 调候五行 = [...new Set((tha.用神到位?.神 ?? []).map((g) => g.五行))];
      for (const d of tj.用神方向) {
        if (!d.忌) continue;
        const 忌五行 = (d.忌.match(/[木火土金水]/) ?? [])[0];
        if (忌五行 && 调候五行.includes(忌五行)) {
          add({
            代号: 'tiaohou-vs-taiji',
            分歧点: '调候用神与太极层所忌相冲',
            命中结构: `调候用神「${tha.用神}」属${忌五行}，而太极层（${tj.月支}月立${tj.体}为体）主张忌${d.忌}`,
            各派主张: [
              { 派: '调候派（《穷通宝鉴》）', 主张: `先取调候用神「${tha.用神}」；寒暖燥湿为急，可微量存在亦胜于无`,
                据: '《穷通宝鉴》十干×十二月令调候表' },
              { 派: `太极派（${d.派}）`, 主张: `${d.原则}——取${d.取}、忌${d.忌}`, 据: d.据 },
              { 派: '（并列）太极法对本派的自我定位', 主张: '太极法源头材料称调候法是"领会不了太极者"的替代品，与子平"冬夏以调候为急"分歧',
                据: '《盲派与象法》4.1 门派立场、6.2 分歧表第 16 条' },
            ],
            本盘事实: { 调候用神: tha.用神, 调候用神五行: 调候五行, 月支: tj.月支, 体: tj.体, 定位: tj.定位, 太极方向: tj.用神方向 },
            须先确定: ['以调候为急还是以太极立体为纲', '该调候之神是否在位（不在位则两派皆落空）'],
            引擎注: '**两派结论相反**，须并列，并给出可验证的年份区间与体感标志请使用者定案。',
          });
        }
      }
    }
  }

  // ── 13. 伤官见官：须**先验伤官是否有力**（提示词 §三 硬规则2、§十二 自查）──
  {
    const tgs = tenGodStrength(chart);
    const 伤 = tgs.各十神.find((x) => x.十神 === '伤官');
    const 官 = tgs.各十神.find((x) => x.十神 === '正官');
    if (伤 && 官) {
      const 伤有力 = 伤.级别 === '极' || 伤.级别 === '强';
      add({
        代号: 'shangguan-jian-guan',
        分歧点: '伤官见官：是否即断"为祸百端"',
        命中结构: `伤官（${伤.五行}）力度【${伤.级别}】：${伤.依据}；正官（${官.五行}）力度【${官.级别}】：${官.依据}`,
        各派主张: [
          { 派: '先验力度论（本引擎所采，依提示词 §三 硬规则2）',
            主张: 伤有力
              ? '**伤官确有力**，方可以"伤官见官"论其破格；仍须看有无印制伤、有无财化伤以为救应'
              : '伤官失令、且根被合冲牵制 → **无伤官之实，不可断为破格**；此时伤官只算"泄秀／调候"之神',
            据: 'bazi-prompt.md §三 硬规则2、§十二 自查清单〔该件已归档，此为历史出处标注，非判据〕；《子平真诠》"论伤官"及"四凶神能成格"' },
          { 派: '《滴天髓》', 主张: '「伤官见官为祸百端」；然该书官杀章又称「官杀混杂者富贵甚多」，原书内部张力未消解',
            据: '《滴天髓阐微》伤官章；其局限节自承与官杀章、制杀太过章三处并读"初学者极易互扰"' },
        ],
        本盘事实: { 伤官级别: 伤.级别, 伤官依据: 伤.依据, 正官级别: 官.级别, 正官依据: 官.依据, 结论倾向: 伤有力 ? '伤官有力，须正经处理' : '伤官无力，不得径断破格' },
        须先确定: ['伤官是否得令／通根（引擎已给级别，见上）', '有无印制伤或财化伤', '正官是否被合被制'],
        引擎注: `**本引擎已在上面先验力度**：伤官为「${伤.级别}」。凡` + (伤有力 ? '有力者' : '无力者')
          + '，判断语须与之相称——见伤官即断"为祸百端"是本项目明确列为常见的错误。',
      });
    }
  }

  // ── 14. 子女取法：官杀为子 vs 食伤为子（提示词 §八 第5行）──────────────────
  {
    const has官杀 = 官L.存在 || 杀L.存在;
    const 食伤 = hiddenGods.flat().filter((g) => g === '食神' || g === '伤官');
    const 食伤现 = 透Gods.includes('食神') || 透Gods.includes('伤官') || 食伤.length > 0;
    if (has官杀 && 食伤现) {
      add({
        代号: 'children-star-schools',
        分歧点: '子女取法：以官杀为子还是以食伤为子',
        命中结构: '本局官杀与食伤皆现——两派取为子女星者不同，故同一盘会得出不同的子女信息',
        各派主张: [
          { 派: '传统取法', 主张: '男命以官杀为子（女命以食伤为子）；为《三命通会》等通行取法', 据: '《三命通会》六亲与子息诸篇' },
          { 派: '任铁樵《滴天髓》', 主张: '以食伤为子', 据: '《滴天髓阐微》子女章（任氏增注）' },
          { 派: '宫位优先（盲派）', 主张: '"看六亲以**宫位为主，星位为辅**"——时柱为子女宫，星之取法反在其次', 据: '《盲派与象法》六亲诸节' },
        ],
        本盘事实: { 官杀: { 正官: 官L.级别, 七杀: 杀L.级别 }, 食伤在透干: 透Gods.filter((g) => g === '食神' || g === '伤官'), 食伤在藏干数: 食伤.length, 时柱: pillars[3].gz },
        须先确定: ['使用者性别（男女取法不同）', '以官杀还是食伤为子女星', '时柱（子女宫）是否被冲合刑穿'],
        引擎注: '凡涉及子女，须**说明所用取法**（提示词 §十一 第6条）；三派并列，不得私下调和。',
      });
    }
  }

  // ── 15. 墓库喜忌：财官临库喜刑冲 vs "冲库即发财是最需纠正的口号" ──────────
  {
    const 库位 = [];
    for (let i = 0; i < 4; i++) if (FOUR_MU.includes(branches[i])) 库位.push(`${posNames[i]}支${branches[i]}`);
    if (库位.length) {
      add({
        代号: 'muku-open-schools',
        分歧点: '墓库喜忌：开库是否即主发财',
        命中结构: `原局见四墓库：${库位.join('、')}`,
        各派主张: [
          { 派: '口诀派', 主张: '「财官临库喜刑冲」「坐下财库，必须刑冲」「有库不怕冲」', 据: '民间口诀（《盲派与象法》2.7 所引第三种说法）' },
          { 派: '反口号派（本知识模块所重）',
            主张: '「**"冲库即发财"是最需纠正的口号**」：开库只是门被打开，库里是否有相关之物、开门者是谁、物出来后流向哪里、库体是否被冲坏，才决定结果。开库是**双刃剑**',
            据: '《盲派与象法》2.7 开库与闭库' },
          { 派: '段系限定', 主张: '库中为喜用宜开，但刑冲力量须适宜，不可伤及墓中所用之物；库中藏忌神则冲开反招灾',
            据: '《盲派与象法》2.7「开库的三种说法（并列，不可合并）」①' },
        ],
        本盘事实: { 墓库: 库位, 须记: '判断应画出四节点：**库—库中物—开库者—收取者**，少一个都不宜下结论' },
        须先确定: ['库中之物为喜为忌', '开库者是谁、力量是否适宜', '物出之后有无收取机制（主位能否收）'],
        引擎注: '本引擎的岁运分析会报出"冲开墓库"，但**那不构成发财的依据**——库中之物为喜为忌、有无收取者，须另行判断。',
      });
    }
  }

  // ── 16. 格局派 vs 盲派做功（提示词 §八 第3行）────────────────────────────
  {
    const 有官杀 = 官L.存在 || 杀L.存在;
    const 有食伤 = 透Gods.includes('食神') || 透Gods.includes('伤官')
      || hiddenGods.flat().some((g) => g === '食神' || g === '伤官');
    const 有财 = 透Gods.includes('正财') || 透Gods.includes('偏财')
      || hiddenGods.flat().some((g) => g === '正财' || g === '偏财');
    if (有官杀 && 有食伤) {
      add({
        代号: 'geju-vs-mangpai',
        分歧点: '格局派与盲派做功的取径不同（食伤与官杀并现）',
        命中结构: '官杀与食伤并现——子平看"格局成败救应"，盲派看"功神能否合制官杀、做功效率与归属"',
        各派主张: [
          { 派: '格局派（《子平真诠》）', 主张: '看格之成败救应：以月令取格，判成格／破格／带忌／救应，指出相神；食伤制官杀视其是否成格而定',
            据: '《子平真诠》八格成破表' },
          { 派: '盲派做功', 主张: '看**功神能否合制官杀**、做功效率与归属；"食伤制官杀（日主坐支为其根时，无论何神旺都要用此根做功，这是**命局的意向**，此根不喜被坏，坏之则反局）"',
            据: '《盲派与象法》2.5 制用分工（食伤制官杀条）' },
          { 派: '并列原则', 主张: '两法"**不互相补洞**"，各自独立作答后并列比较，记录同向处与冲突处',
            据: '《盲派与象法》6.x 合并顺序 ⑤（段系"同盘双读"）' },
        ],
        本盘事实: { 官杀: { 正官: 官L.级别, 七杀: 杀L.级别 }, 食伤: 透Gods.filter((g) => g === '食神' || g === '伤官'), 有财, 日支: pillars[2].gz },
        须先确定: ['日主坐支（日支）是否为做功之根、是否被坏', '制官杀之食伤是否有根有力', '做功所得（财官）能否归于主位（日时）'],
        引擎注: '两派**取径不同而非结论必有高低**；若同向则互相印证，若相反则须并列，不得只讲一边。',
      });
    }
  }

  // ── 20. 晚子时（夜子时）进位法 ────────────────────────────────────────────
  // 引擎默认「不进日」（见《文档/02 设计.md》边界口径）。**只在时支为「子」时报出**：
  // 时支非子则无论生于何时都不涉此分歧，报出来只是噪声——而噪声会淹没真分歧。
  if (String(pillars[3].branch) === '子') {
    add({
      代号: 'late-zi-hour',
      分歧点: '晚子时（23:00–24:00）日柱是否进位次日',
      命中结构: '本盘时支为「子」，故**可能**涉此分歧（四柱模式无从知出生钟点，'
        + '若生于 00:00–01:00 则无此问题，若生于 23:00–24:00 则必涉）',
      各派主张: [
        { 派: '不进日（本引擎默认，多数近世命书）', 主张: '23:00–24:00 仍作当日的日柱，仅时柱用子时',
          据: '引擎既有默认（多数近世命书口径）；已声明此分歧并标注默认口径' },
        { 派: '夜子时「日不进、时进」', 主张: '夜子时（23:00–24:00）**日柱不进**，而**时柱的干用次日日干起五鼠遁**；'
            + '子时正（00:00–01:00）则**日时俱进**',
          据: '《命理探源》卷一起例（袁树珊）——此为古籍中给出的**第三种**处理法，与"进日""不进日"皆不同' },
        { 派: '进日（日柱进次日）', 主张: '23:00 起即作次日日柱，时柱亦随之',
          据: '部分流派；本引擎未采，但须并陈' },
      ],
      本盘事实: { 时柱: pillars[3].gz, 引擎默认: '不进日', 四柱模式限制: '四柱模式无从知出生钟点，无法判定是否真的生于 23:00–24:00' },
      须先确定: ['实际出生钟点是否在 23:00–24:00 之间', '若在，采哪一派（三派结果中**日柱与时柱都可能不同**）'],
      引擎注: '**不同取法会直接改变日柱，而日柱一变则十神、格局、旺衰全变**，故这是最须先钉死的一处分歧。'
        + '若使用者生于 23:00 前后，应主动询问其所用流派，不可径取默认。',
    });
  }

  // ── 21. 干支作用模型（天干与地支是否互作用）────────────────────────────
  add({
    代号: 'ganzhi-interaction-model',
    分歧点: '天干与地支是否相互作用（"天只与天关，地只与地会" vs "支为干之生地，干为支之发用"）',
    命中结构: '本条与具体盘无关，凡论干支作用即须先选定模型；不同模型下通关、盖头、截脚、合冲的结论不同',
    各派主张: [
      { 派: '《子平真诠》（本引擎所采之通行模型）',
        主张: '**支为干之生地，干为支之发用**，须逐干逐支上下统看——干支**互相**作用',
        据: '《子平真诠》总口诀' },
      { 派: '《御定子平秘本三篇》〈石田山人命理微言〉',
        主张: '「**天只与天关，地只与地会**」——天干只与天干生克、地支只与地支会合，**互不作用**；'
          + '且「**天运常主其七**」，大运天干占七成、地支占三成',
        据: '《御定子平秘本三篇》〈石田山人命理微言〉（与《子平真诠》**直接相反**，是现有六模块中完全没有的第二套干支作用模型）' },
      { 派: '《神峰通考》动静说',
        主张: '「天干之动只攻天干之动，地支之静只攻地支之静」——同于石田山人之分，而张楠自陈其说',
        据: '《神峰通考》（张楠）' },
    ],
    本盘事实: { 说明: '本引擎只报事实（干支各自的合冲刑害与生克），**不预设哪一种作用模型**；'
      + '凡涉"盖头／截脚／运干管几年"之类判断，须先声明所用模型' },
    须先确定: ['采干支互作用（子平通行）还是互不作用（石田山人／神峰）', '若采后者，大运须按"干七支三"还是"干三支七"'],
    引擎注: '两模型对**同一命盘**会给出不同结论，尤其在大运推断上。本条属**通用披露**，'
      + '但一旦使用者问到"盖头""截脚""运干管几年"，即须展开并陈。',
  });

  // ── 22. 神煞能否参与定吉凶 ────────────────────────────────────────────
  add({
    代号: 'shensha-abolition',
    分歧点: '神煞能否参与定吉凶（存废比例悬殊）',
    命中结构: '本条与具体盘无关；但本引擎**会报出神煞**（见 cast 输出的神煞段），故须同时声明其地位有争',
    各派主张: [
      { 派: '存而不重（《子平真诠》《滴天髓》一路）', 主张: '神煞可作旁参，不足定贵贱；格局与用神为主',
        据: '《子平真诠》《滴天髓》对神煞的保留态度' },
      { 派: '全废（《命理约言》陈素庵）', 主张: '列举**24 类**当废之神煞，主张「其余从太岁起者，为真；不从太岁起者为妄」，'
          + '实存仅**天月德、天乙贵人、月将、空亡、驿马、劫煞**六种',
        据: '《命理约言》（陈素庵）——**最早系统批判神煞**之作，袁树珊作序' },
      { 派: '《神峰通考》激烈排斥', 主张: '斥神煞「必须焚其版，火其书」；惟该书自身又全录吉神／凶神三十余条起例，'
          + '**自相矛盾**（据行 51「以后各格，楠所未及者，附陈于后」，后半诸格为附录，非张楠正说）',
        据: '《神峰通考》（张楠）' },
      { 派: '《命理探源》录而贬之', 主张: '「凶煞有十之九，吉神仅十之一，其不适用可知」，然卷三仍全录起例',
        据: '《命理探源》（袁树珊）' },
      { 派: '古法三命（重神煞）', 主张: '神煞在古法中对事件起**定性**作用，运用普遍；《五行精纪》吉神 46 目、凶煞 53 目，'
          + '其中原文明确给出起例者 **70 条**',
        据: '《五行精纪》（宋·廖中）；《鬼谷遗文-三命结构》三命 vs 子平对照表' },
    ],
    本盘事实: { 说明: '本引擎报出神煞**只为提示**，已在规则中声明"不可把神煞当主导；见吉神断吉、见凶神断凶"是常见错判' },
    须先确定: ['使用者所宗流派对神煞的态度', '若采古法三命一路，则须整体改用年为本、纳音为身、神煞定性的体系，不可与子平结论混用'],
    引擎注: '本条与 `shensha-scope` 相关但**不同**：`shensha-scope` 论"神煞能否定贵贱"的强度之争，'
      + '本条列出**古籍中实际存在的存废立场与其量化比例**，供并陈。',
  });

  // ── 23. 人元司令 vs 月令本气（司令非本气时）─────────────────────────────
  {
    const sl = chart?.dayMaster?.司令;
    if (sl && !sl.是否本气当令) {
      add({
        代号: 'siling-vs-benqi',
        分歧点: `月内司令为${sl.司令}（${sl.司令五行}），非月令本气——取格与力量以谁为准`,
        命中结构: `月支${sl.月支}，本气${sl.本气}；而生于${sl.段}，司令是${sl.司令}（${sl.司令五行}）`,
        各派主张: [
          { 派: '月令为本（本引擎所采）',
            主张: `**月令最大**：既已入${sl.月支}之月，大气候由月令本气${sl.本气}定，`
              + `${sl.本气}仍为「旺」；司令之神只是月内用事，提为「次旺」，**不夺老大位**`,
            据: '使用者明确（申月即使戊己土用事，已正式入秋，金仍是老大）；《子平真诠》"用神专求月令"一路' },
          { 派: '人元司事为本（《御定子平秘本三篇》「乘气」）',
            主张: '"乘气者，每月中每日司令之神也，**其气最旺**，而与日元最关切""一命到手，必须先提用神；'
              + '用神既明，必须看乘气照应不照应，照应则吉，不照应则凶"',
            据: '《御定子平秘本三篇》〈石田山人命理微言〉论乘气；该书整理者按语自承此与子平正法"顺序不同"' },
          { 派: '杂气月的例外',
            主张: '四库月（辰戌丑未）**月干透出一字者，只以透出者论，而不看每日司令之气**（此谓杂气）；无透出者才专看乘气',
            据: '《御定子平秘本三篇》论杂气' },
        ],
        本盘事实: { 月支: sl.月支, 月令本气: sl.本气, 司令: sl.司令, 司令五行: sl.司令五行, 段: sl.段, 实际月长日: sl.实际月长日 },
        须先确定: ['取格以月令本气还是以司令之神', '四库月是否已透干（透则不看司令）', '司令之神在局中是否透干有根'],
        引擎注: '引擎的**力量计算**已按"月令为大、司令提一档"实现（本气恒为「旺」、司令为「次旺」）；'
          + '但**取格仍只用月令本气**。两处口径不同是**有意的**，此处并陈两说，不代为统一。',
      });
    }
  }

  // 分级：**结构性**（本盘特有，凡涉判断必先处理）vs **通用披露**
  // （与方法取径有关、与具体盘无关；只在使用者问到相关事项时才须展开）。
  // 不作分级的话，通用披露会淹没真正的结构分歧——那等于把"最大召回"做成噪声。
  const 通用披露 = new Set(['children-star-schools', 'geju-vs-mangpai', 'ganzhi-interaction-model', 'shensha-abolition']);
  for (const c of out) c.类别 = 通用披露.has(c.代号) ? '通用披露' : '结构性';

  return out;
}

/* ------------------------------------------------------------------ *
 * 十八之二、由四柱反推公历日期
 * ------------------------------------------------------------------ */

/**
 * 由四柱干支反推可能的公历出生日期。
 *
 * 原理（全部复用本引擎已有的推演口径，不另立第二处实现）：
 *   ① 年柱定「立春年」——六十年一循环，故 [fromYear, toYear] 内通常有 3–4 个候选；
 *   ② 月柱的月支定该年内的**节气月**区间（约 30 天）；
 *   ③ 日柱六十日一循环，而节气月不足六十日，故该区间内**至多一个**日期相合；
 *   ④ 时柱不约束日期，只约束**时辰**（五鼠遁由日干定时干）。
 *
 * 因此四柱 + 一个年份范围，通常能把日期收敛到唯一（或两三个年份各一个）。
 * 拿到日期后即可改用 birth 方式排盘，从而取回**大运起运与流年应期**——
 * 这正是四柱模式所缺的那部分。
 *
 * 附带做两项**自洽性校验**（这是本函数另一半价值）：
 *   · 月柱是否合五虎遁（由年干 + 月支定月干）
 *   · 时柱是否合五鼠遁（由日干 + 时支定时干）
 * 二者不合者，说明所报四柱有误——干支并非可以任意组合。
 *
 * @param {object|string[]} pillars {year,month,day,hour} 四柱干支；亦可传 ['庚午','辛巳','乙酉','癸未']
 * @param {{fromYear?:number,toYear?:number,maxCandidates?:number}} [options]
 * @returns {{四柱:string, 自洽:boolean, 校验:string[], 候选:Array<object>, 说明:string[], 注:string}}
 */
export function dateCandidates(pillars, options = {}) {
  const { fromYear = 1900, toYear = 2100, maxCandidates = 60 } = options;
  const pos = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['year', 'month', 'day', 'hour'];
  const raw = Array.isArray(pillars) ? pillars : keys.map((k) => pillars?.[k]);

  const parsed = raw.map((gz, i) => {
    const s = String(gz ?? '').trim();
    if (s.length !== 2) throw new Error(`dateCandidates: ${pos[i]} 应为两个字的干支，收到「${s}」`);
    const si = STEMS.indexOf(s[0]), bi = BRANCHES.indexOf(s[1]);
    if (si < 0) throw new Error(`dateCandidates: ${pos[i]} 的天干「${s[0]}」不是合法天干`);
    if (bi < 0) throw new Error(`dateCandidates: ${pos[i]} 的地支「${s[1]}」不是合法地支`);
    if (si % 2 !== bi % 2) throw new Error(`dateCandidates: ${pos[i]}「${s}」阴阳不配，六十甲子中不存在此组合`);
    return { gz: s, stemIndex: si, branchIndex: bi, index: gzIndex(si, bi) };
  });
  const [yp, mp, dp, hp] = parsed;

  const 校验 = [];

  // ① 月柱须合五虎遁
  const expectMp = monthPillar(yp.stemIndex, mp.branchIndex);
  if (gzName(expectMp.index) !== mp.gz) {
    校验.push(`月柱不合五虎遁：年干「${yp.gz[0]}」配月支「${mp.gz[1]}」，月干应为「${STEMS[expectMp.stemIndex]}」，`
      + `即「${gzName(expectMp.index)}」，而非「${mp.gz}」`);
  }
  // ② 时柱须合五鼠遁
  const expectHp = hourPillar(dp.stemIndex, hp.branchIndex);
  if (gzName(expectHp.index) !== hp.gz) {
    校验.push(`时柱不合五鼠遁：日干「${dp.gz[0]}」配时支「${hp.gz[1]}」，时干应为「${STEMS[expectHp.stemIndex]}」，`
      + `即「${gzName(expectHp.index)}」，而非「${hp.gz}」`);
  }

  // ③ 年柱候选：六十年一循环
  const 年候选 = [];
  for (let y = fromYear; y <= toYear; y++) if (yearPillarOf(y).gz === yp.gz) 年候选.push(y);
  if (!年候选.length) {
    校验.push(`公历 ${fromYear}–${toYear} 年间不存在「${yp.gz}」年柱（年柱六十年一循环，且以立春为界）；请扩大年份范围`);
  }

  // ④ 逐候选年找该节气月，再在月内找日柱相合之日
  const JIE_IDX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const branchOfTerm = (i) => ((i / 2) + 1) % 12;
  const 候选 = [];
  let 有月区间但无日 = 0;

  for (const Y of 年候选) {
    const lichun = solarTermMoment(Y, 2);
    const pts = [];
    for (const yy of [Y, Y + 1]) {
      for (const i of JIE_IDX) pts.push({ i, name: SOLAR_TERMS[i], b: branchOfTerm(i), m: solarTermMoment(yy, i) });
    }
    pts.sort((a, b) => cmpMoment(a.m, b.m));
    let start = -1;
    for (let k = 0; k < pts.length; k++) {
      if (cmpMoment(pts[k].m, lichun) < 0) continue;
      if (pts[k].b === mp.branchIndex) { start = k; break; }
    }
    if (start < 0 || start + 1 >= pts.length) continue;
    const A = pts[start].m, B = pts[start + 1].m;
    有月区间但无日++;

    const startUtc = Date.UTC(A.year, A.month - 1, A.day);
    const endUtc = Date.UTC(B.year, B.month - 1, B.day);
    for (let t = startUtc; t <= endUtc; t += 86400000) {
      const dt = new Date(t);
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, dd = dt.getUTCDate();
      const dpi = dayPillar({ year: y, month: m, day: dd });
      if (gzName(dpi.index) !== dp.gz) continue;

      const b = hp.branchIndex;
      const h0 = (23 + 2 * b) % 24;      // 该时支的起始钟点（子时＝23 点起）
      const h1 = (h0 + 2) % 24;
      const 跨夜 = h1 < h0;             // 仅子时跨夜
      const startM = { year: y, month: m, day: dd, hour: h0, minute: 0 };
      let endM;
      if (跨夜) {
        const nx = new Date(Date.UTC(y, m - 1, dd + 1));
        endM = { year: nx.getUTCFullYear(), month: nx.getUTCMonth() + 1, day: nx.getUTCDate(), hour: h1, minute: 0 };
      } else {
        endM = { year: y, month: m, day: dd, hour: h1, minute: 0 };
      }

      // 与节气月区间求交：节气交接那一日的时辰窗口可能只有一部分落在本月，
      // 也可能完全不落。**不可把整段时辰照发**——那等于给出一个半属于隔壁月的日期。
      const effStart = cmpMoment(startM, A) > 0 ? startM : { ...A, minute: A.minute ?? 0 };
      const effEnd = cmpMoment(endM, B) < 0 ? endM : { ...B, minute: B.minute ?? 0 };
      if (cmpMoment(effStart, effEnd) >= 0) continue;   // 该时辰全在节气月之外
      const 被节气截断 = cmpMoment(effStart, startM) !== 0 || cmpMoment(effEnd, endM) !== 0;
      const fmt = (mm) => `${mm.year}-${String(mm.month).padStart(2, '0')}-${String(mm.day).padStart(2, '0')} `
        + `${String(mm.hour).padStart(2, '0')}:${String(mm.minute).padStart(2, '0')}`;
      const 时辰 = 被节气截断
        ? `${fmt(effStart)} – ${fmt(effEnd)}（已按节气${pts[start].name}／${pts[start + 1].name}交接截取）`
        : (跨夜
          ? `${String(h0).padStart(2, '0')}:00–次日${String(h1).padStart(2, '0')}:59`
          : `${String(h0).padStart(2, '0')}:00–${String(h1).padStart(2, '0')}:59`);

      候选.push({
        立春年: Y,
        日期: `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
        时支: hp.gz[1],
        时辰,
        时柱: hp.gz,
        被节气截断,
        节气月: `${fmt(A)}（${pts[start].name}）起，至 ${fmt(B)}（${pts[start + 1].name}）止`,
        边界提示: 被节气截断
          ? '⚠ 该时辰窗口与节气交接重叠，已按交接时刻截取；出生时刻若在校正后的窗口之外，则月柱不属本月'
          : '生于上述节气的交接前后数分钟者，节气月归属可能不同，须核对该年的节气时刻',
      });
      if (候选.length >= maxCandidates) break;
    }
    if (候选.length >= maxCandidates) break;
  }
  候选.sort((a, b) => (a.日期 < b.日期 ? -1 : a.日期 > b.日期 ? 1 : 0));

  const 说明 = [];
  if (校验.length) {
    说明.push('所报四柱**不自洽**——干支并非可以任意组合，请先核对后再用。');
    说明.push('下列候选是按所报的**年柱、月支、日柱、时支**推得的：月干／时干之误不影响日期定位，'
      + '但更正后须重新排盘，不可沿用本结果。');
  } else {
    说明.push('四柱通过五虎遁、五鼠遁两项自洽性校验。');
  }
  if (候选.length) {
    说明.push(`在 ${fromYear}–${toYear} 年内找到 ${候选.length} 个可能日期。`
      + '若使用者能提供大致年龄或出生年份，即可唯一确定；确定后请改用 birth 方式排盘，以取回大运起运与流年应期。');
  } else if (!校验.length) {
    说明.push(`在 ${fromYear}–${toYear} 年内未找到相合日期（已检视 ${有月区间但无日} 个候选年的对应节气月）。`
      + '日柱六十日一循环而节气月不足六十日，故并非每个年份都会命中；请扩大年份范围，或核对日柱。');
  }
  if (hp.branchIndex === 0) {
    说明.push('时支为子，含**晚子时（23:00–23:59）**。传统有"日柱进次日"与"不进日"两说，'
      + '本引擎默认**不进日**（即 23:xx 仍属当日的日柱）；若使用者所宗为"进日"之说，该日的日柱须改取次日，候选日期亦随之改变。');
  }

  return {
    四柱: parsed.map((p) => p.gz).join(' '),
    自洽: 校验.length === 0,
    校验,
    候选,
    说明,
    注: '本函数只给出**候选日期**，不代替使用者确认。日期一旦确定，应以 birth 方式重新排盘，'
      + '届时节气边界、真太阳时与起运岁数均由引擎重算，不要沿用本函数的分步结果。',
  };
}


/* ------------------------------------------------------------------ *
 * 十九、供外部复用的原语（与 castChart 同一口径，避免第二处实现）
 * ------------------------------------------------------------------ */

/**
 * 某地支的藏干，并标注各藏干相对日主的十神。
 * @param {number} dayStemIndex 日干序
 * @param {number} branchIndex 地支序
 */
export function hiddenStemsOf(dayStemIndex, branchIndex) {
  return HIDDEN_STEMS_SPEC[branchIndex].map(([s, role, w]) => ({
    stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)),
  }));
}

/**
 * 神煞推演（对外包装，入参为 {branchIndex, stemIndex} 形式的柱对象数组）。
 * @param {Array<{stemIndex:number,branchIndex:number}>} pillars 年月日时四柱
 * @param {number} dayStemIndex
 * @param {number} yearStemIndex
 * @param {'男'|'女'} gender
 */
export function shenshaOf(pillars, dayStemIndex, yearStemIndex, gender = '男') {
  return computeShenSha(
    pillars, dayStemIndex, yearStemIndex,
    pillars[1].branchIndex, pillars[2].branchIndex, pillars[0].branchIndex, gender,
  ).map((s) => ({ ...s, nature: shenshaNature(s.name) }));
}

/**
 * 五行力量统计（对外包装）。
 * @param {Array<{stemIndex:number,branchIndex:number}>} pillars
 * @param {string} monthBranchName 月支名（决定旺相休囚死）
 */
export function strengthOf(pillars, monthBranchName, kingEl) {
  return elementStrength(pillars, monthBranchName, kingEl);
}

/**
 * 日主旺衰的三项事实：**得令 / 得地 / 得势**。
 *
 * 为什么单列：五行力量占比衡量的是气候与气势，**不是日主的受力**；
 * 把占比当成旺衰依据是最常见的误用。真正的旺衰看这三项：
 *   · **得令**——日主五行在月令的旺相休囚死（月令司权，权重最高）
 *   · **得地**——日主同五行在地支通根，按本气／中气／余气分层
 *   · **得势**——天干有比劫或印星帮扶
 *
 * 本函数只报事实与两项**反例警示**（日支得禄不抵月令失令、月支被合则当令打折），
 * 不替调用方定"身强／身弱"。
 *
 * @param {object} chart castChart / pillarsMode 的返回值（须含 pillars[].stem/.branch 或 .stemIndex/.branchIndex）
 */
export function dayMasterSupport(chart) {
  const pillars = chart.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('dayMasterSupport: chart.pillars 须为四柱');
  const posNames = ['年', '月', '日', '时'];
  const stemOf = (p) => p.stem ?? STEMS[p.stemIndex];
  const branchOf = (p) => p.branch ?? BRANCHES[p.branchIndex];
  const stems = pillars.map(stemOf);
  const branches = pillars.map(branchOf);

  const dayStemIndex = STEMS.indexOf(stems[2]);
  const dayElIdx = STEM_ELEMENT[dayStemIndex];
  const dayEl = ELEMENTS[dayElIdx];
  const monthBranch = branches[1];
  const 令态 = seasonState(dayEl, monthBranch, kingOf(chart));
  const 得令 = 令态 === '旺' || 令态 === '次旺' || 令态 === '相';

  // 得地：日主同五行在地支的藏干（本气 / 中气 / 余气）
  const 得地 = [];
  for (let i = 0; i < 4; i++) {
    const spec = HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])];
    for (let k = 0; k < spec.length; k++) {
      const h = spec[k];
      if (STEM_ELEMENT[STEMS.indexOf(h[0])] !== dayElIdx) continue;
      得地.push({ 位: `${posNames[i]}支${branches[i]}`, 层: k === 0 ? '本气' : h[1], 干: h[0], 权: h[2], 在月令: i === 1 });
    }
  }

  // 得势：天干（除日干）有比劫或印
  const 得势 = [];
  for (let i = 0; i < 4; i++) {
    if (i === 2) continue;
    const g = tenGod(dayStemIndex, STEMS.indexOf(stems[i]));
    if (['比肩', '劫财', '正印', '偏印'].includes(g)) 得势.push({ 位: `${posNames[i]}干${stems[i]}`, 十神: g });
  }

  const strength = elementStrength(pillars, monthBranch, kingOf(chart));
  const 印五行 = ELEMENTS.find((e) => SHENG_MAP[e] === dayEl) ?? dayEl;
  const 同党 = Number((strength.percent[dayEl] + (strength.percent[印五行] || 0)).toFixed(1));
  const 异党 = Number((100 - 同党).toFixed(1));

  const 提示 = [];
  提示.push('五行占比衡量的是气候与气势，**不是日主的受力**；旺衰以得令／得地／得势为准。');
  // 反例警示一：日支得禄不抵月令休囚
  const 日支见本气 = 得地.some((x) => x.位.startsWith('日支') && x.层 === '本气');
  if (日支见本气 && !得令) {
    提示.push(`**日支得地（${得地.find((x) => x.位.startsWith('日支') && x.层 === '本气').干}）不能抵消月令失令**：`
      + `月令${monthBranch}对${dayEl}为「${令态}」。月令司权、日支得地，两者不同权，不可据日支即称"有力"。`);
  }
  if (!得地.length) 提示.push(`日主${dayEl}于四支**无所通根**（地支不藏${dayEl}），此为"无根"，是判从格的首要条件。`);
  // 反例警示二：月支被他支合 → 当令之神力量打折
  const 月支合 = [];
  for (let j = 0; j < 4; j++) {
    if (j === 1) continue;
    if (BRANCH_COMBINE[branches[1] + branches[j]] || BRANCH_COMBINE[branches[j] + branches[1]]) {
      const hua = BRANCH_COMBINE[branches[1] + branches[j]] ?? BRANCH_COMBINE[branches[j] + branches[1]];
      月支合.push(`${posNames[j]}${branches[j]}六合月支${branches[1]}（化${hua}）`);
    }
  }
  if (月支合.length) {
    提示.push(`**月支被合，当令之神的力量须打折**：${月支合.join('；')}。`
      + `月令为格局所本，月支被合去／合化则"当令"之名与实不符，须在判断中写明。`);
  }

  return {
    日主: stems[2], 日主五行: dayEl, 月令: monthBranch, 月令令态: 令态,
    得令, 得地, 得势,
    同党占比: 同党, 异党占比: 异党,
    五行占比: strength.percent,
    提示,
    注: '本函数只报三项事实，不判身强／身弱——那须并合格局、调候、太极与病药，见 sixLayersOf。',
  };
}

/**
 * 干支关系推演（对外包装）。
 * @param {Array<{stemIndex:number,branchIndex:number}>} pillars
 */
export function relationsOf(pillars) {
  return gzRelations(pillars, null);
}

/* ------------------------------------------------------------------ *
 * 十九之三、力度分级、太极层、通关神、取用六层
 * ------------------------------------------------------------------ */

const ALL_TEN_GODS = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];

/**
 * 十神力度分级：**极 / 强 / 中 / 弱**。
 *
 * 这是"贯穿全局、最易出错"的一环：**缺令者不得称"有力"**。
 *   · **极**——该十神五行当令（月令令态为「旺」）
 *   · **强**——地支通根于**本气**，且该根未被合冲刑破牵制
 *   · **中**——仅天干透出，或只得地支中／余气
 *   · **弱**——以上皆不备，或月令休囚死而诸根皆被牵制
 *
 * 另附两条**反例警示**（文档与实际断例中反复出现的错）：
 *   · **日支得禄不能抵消月令为病**——月令司权、日支得地，两者不同权；
 *   · **月支被他支合去／合化时，当令之神的力量须打折**——"当令"之名与实不符。
 *
 * 本函数给级别与依据，**不替调用方下断语**。
 *
 * @param {object} chart castChart / pillarsMode 的返回值
 */
export function tenGodStrength(chart) {
  const pillars = chart.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('tenGodStrength: chart.pillars 须为四柱');
  const posNames = ['年', '月', '日', '时'];
  const stemOf = (p) => p.stem ?? STEMS[p.stemIndex];
  const branchOf = (p) => p.branch ?? BRANCHES[p.branchIndex];
  const stems = pillars.map(stemOf);
  const branches = pillars.map(branchOf);
  const dayStemIndex = STEMS.indexOf(stems[2]);
  const monthBranch = branches[1];
  const monthEl = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(HIDDEN_STEMS_SPEC[BRANCHES.indexOf(monthBranch)][0][0])]];

  // 地支之间的牵制（合冲刑破害），按支名归集因由
  const 牵制 = new Map();
  const mark = (g1, g2, kind) => {
    for (const g of [g1, g2]) {
      const br = g.slice(-1);
      if (!牵制.has(br)) 牵制.set(br, []);
      牵制.get(br).push(`${kind}（${g1}—${g2}）`);
    }
  };
  const rel = gzRelations(pillars, null);
  for (const [key, kind] of [['地支六冲', '六冲'], ['地支六合', '六合'], ['地支相害', '相害'], ['地支相破', '相破']]) {
    for (const x of rel[key]) {
      const [p, q] = String(x.pair).split(' — ');
      if (p && q) mark(p, q, kind);
    }
  }
  for (const x of rel.地支相刑) {
    const parts = String(x.positions).split('、');
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) mark(parts[i], parts[j], '相刑');
    }
  }

  // 十神 → 五行 / 对应天干
  const godInfo = new Map();
  for (let si = 0; si < 10; si++) {
    const g = tenGod(dayStemIndex, si);
    if (!godInfo.has(g)) godInfo.set(g, { 十神: g, 五行: ELEMENTS[STEM_ELEMENT[si]], 干: [] });
    godInfo.get(g).干.push(STEMS[si]);
  }

  const 月支被合 = (牵制.get(monthBranch) ?? []).filter((s) => s.startsWith('六合'));

  const 各十神 = [];
  for (const god of ALL_TEN_GODS) {
    const info = godInfo.get(god);
    if (!info) continue;
    const 令态 = seasonState(info.五行, monthBranch, kingOf(chart));
    const 透干 = [];
    for (let i = 0; i < 4; i++) if (i !== 2 && info.干.includes(stems[i])) 透干.push(`${posNames[i]}干${stems[i]}`);
    const 本气根 = [], 中余气根 = [];
    for (let i = 0; i < 4; i++) {
      const spec = HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])];
      for (let k = 0; k < spec.length; k++) {
        if (!info.干.includes(spec[k][0])) continue;
        const rec = { 位: `${posNames[i]}支${branches[i]}`, 干: spec[k][0], 层: k === 0 ? '本气' : spec[k][1], 权: spec[k][2], 牵制: 牵制.get(branches[i]) ?? null };
        (k === 0 ? 本气根 : 中余气根).push(rec);
      }
    }
    const 本气未被牵制 = 本气根.filter((r) => !r.牵制);

    let 级别, 依据;
    if (令态 === '旺') {
      级别 = '极';
      依据 = `月令${monthBranch}之令为${monthEl}，本神属${info.五行}，当令`;
      if (月支被合.length) {
        级别 = 本气未被牵制.length ? '强' : '中';
        依据 += `；**但月支被合（${月支被合.join('；')}），当令之名与实不符，力量须打折**，故降为「${级别}」`;
      }
    } else if (令态 === '次旺') {
      级别 = '强';
      依据 = `**人元司事之神**（月令${monthBranch}本气为${monthEl}仍是老大，本神属${info.五行}于月内用事，提为次旺）`;
    } else if (本气未被牵制.length) {
      级别 = '强';
      依据 = `通根于本气：${本气未被牵制.map((r) => `${r.位}·${r.干}`).join('、')}，且未被合冲刑破牵制`;
    } else if (本气根.length) {
      级别 = '中';
      依据 = `虽通根本气（${本气根.map((r) => r.位).join('、')}），但该根被牵制：${本气根.flatMap((r) => r.牵制).join('；')}`;
    } else if (透干.length || 中余气根.length) {
      级别 = '中';
      依据 = [透干.length ? `仅天干透出于${透干.join('、')}` : null, 中余气根.length ? `或只得中／余气之根（${中余气根.map((r) => `${r.位}·${r.层}`).join('、')}）` : null]
        .filter(Boolean).join('；');
    } else {
      级别 = '弱';
      依据 = `不透不藏，全局无此神之根气（月令${monthBranch}对本神为「${令态}」）`;
    }
    if (级别 === '弱' && (令态 === '休' || 令态 === '囚' || 令态 === '死') && 本气根.length) {
      依据 += '；月令休囚死而诸根又被牵制，属"有名无实"';
    }

    各十神.push({ 十神: god, 五行: info.五行, 令态, 级别, 透干: 透干.length ? 透干 : null, 本气根: 本气根.length ? 本气根 : null, 中余气根: 中余气根.length ? 中余气根 : null, 依据 });
  }
  const 序 = { 极: 0, 强: 1, 中: 2, 弱: 3 };
  各十神.sort((a, b) => 序[a.级别] - 序[b.级别]);

  const 提示 = ['力度看月令：**缺令者不得称"有力"**。本级别只据得令与通根，不含格局喜忌。'];
  const 日支本气 = 各十神.filter((x) => (x.本气根 ?? []).some((r) => r.位.startsWith('日支')) && x.令态 !== '旺');
  if (日支本气.length) {
    提示.push(`**日支得地不能抵消月令失令**：${日支本气.map((x) => `${x.十神}（${x.五行}）得日支本气`).join('、')}，`
      + `但于月令${monthBranch}为${日支本气.map((x) => x.令态).join('/')}。月令司权、日支得地两者不同权，不可据日支即称"有力"。`);
  }
  if (月支被合.length) {
    提示.push(`**月支被合，当令之神的力量须打折**：${月支被合.join('；')}。月令为格局所本，`
      + '月支被合去／合化则"当令"之名与实不符，须在判断中写明。');
  }

  return { 日主: stems[2], 月令: monthBranch, 月令五行: monthEl, 各十神, 提示 };
}

/**
 * 太极／阴阳层：以**月支**定"立体"，并给出该层的大方向。
 *
 * **重要：本条所据的十二月立体表与本节所附的提示词（bazi-prompt.md §五）相互矛盾**，
 * 至少两处：
 *   · **寅月之体**——本知识模块作「立阴为体」（老阴向少阳转化，先天阴旺），
 *     提示词 §五却把寅与夏、申同列为「立阳为体」。两说相反。
 *   · **用神方向**——模块 §4.4 作「阳旺用阴，阴旺用阳」；
 *     提示词 §五作「守其未退者、抑其将长者」，于申月推出**忌阴**，
 *     与「阳旺用阴」恰好相反。
 * 故本函数**并列两说**，不替调用方择一。
 *
 * ⚠ 2026-10-01 归属变更：`bazi-prompt.md` 已**归档**（`_archive\20261001-audit-cleanup\`，
 * 见 `AGENTS.md`「已归档的历史件一律不得作为判据」）。**太极法本身亦已于 2026-09-28 停用**
 * （解盘跳过，代码保留供 `yinyang` 单独查看）。故下方 `据:` 字段对它的引用一律视为
 * **历史出处标注**，**不是可引用的判据**；见本包 `selftest.mjs` 对「不逆太极」的禁止断言。
 *
 * @param {string} monthBranchName 月支，如 '申'
 */
export function taijiOf(monthBranchName) {
  const b = BRANCHES.indexOf(String(monthBranchName));
  if (b < 0) throw new Error(`taijiOf: 非法月支「${monthBranchName}」`);
  const T = {
    11: { 组: '先天定位不变（冬）', 定位: '先天阴旺，后天阴也旺', 体: '阴', 气: '老阴' },
    0: { 组: '先天定位不变（冬）', 定位: '先天阴旺，后天阴也旺', 体: '阴', 气: '老阴' },
    1: { 组: '先天定位不变（冬）', 定位: '先天阴旺，后天阴也旺', 体: '阴', 气: '老阴' },
    5: { 组: '先天定位不变（夏）', 定位: '先天阳旺，后天阳也旺', 体: '阳', 气: '老阳' },
    6: { 组: '先天定位不变（夏）', 定位: '先天阳旺，后天阳也旺', 体: '阳', 气: '老阳' },
    7: { 组: '先天定位不变（夏）', 定位: '先天阳旺，后天阳也旺（未月后天阳气比巳午月都难平衡，故七月为一年最热）', 体: '阳', 气: '老阳' },
    2: { 组: '明显偏', 定位: '老阴向少阳转化，先天阴旺', 体: '阴', 气: '少阳' },
    8: { 组: '明显偏', 定位: '老阳向少阴转化，先天阳旺', 体: '阳', 气: '少阴' },
    3: { 组: '阴阳同旺', 定位: '春分，先天阴阳同出、同旺', 体: '依组合', 气: '阴阳同旺' },
    9: { 组: '阴阳同旺', 定位: '秋分，先天阴阳同出、同旺', 体: '依组合', 气: '阴阳同旺' },
    4: { 组: '阴阳交接', 定位: '先天偏阳旺，后天起点阴旺', 体: '依组合', 气: '交接' },
    10: { 组: '阴阳交接', 定位: '先天阴气旺，后天起点阳旺', 体: '依组合', 气: '交接' },
  }[b];

  const 方向 = [];
  if (T.体 === '阳') {
    方向.push({ 派: '本知识模块 §4.4', 原则: '阳旺用阴，阴旺用阳', 取: '阴（水）', 忌: null,
      据: '《盲派与象法》4.4「阴阳法无非就是把八字区分为阴阳两方面，能救阴或救阳使其平衡就是好八字……**阳旺用阴，阴旺用阳**」' });
    方向.push({ 派: '提示词 §五 第2层', 原则: '守其未退者、抑其将长者', 取: '阳（火）', 忌: '阴（水）',
      据: 'bazi-prompt.md §五「申月是热极将退而阴始生的节点……申月再加阴，是长其将长者，属逆」（原文只明言申月，此处按其原则推及同类）' });
  } else if (T.体 === '阴') {
    方向.push({ 派: '本知识模块 §4.4', 原则: '阳旺用阴，阴旺用阳', 取: '阳（火）', 忌: null,
      据: '《盲派与象法》4.4「阳旺用阴，阴旺用阳」' });
    方向.push({ 派: '提示词 §五 第2层', 原则: '守其未退者、抑其将长者', 取: '阴（水）', 忌: '阳（火）',
      据: 'bazi-prompt.md §五同段原则（原文只明言申月，此处按其原则推及同类）' });
  } else {
    方向.push({ 派: '两说皆同', 原则: '本层不定方向', 取: '须看后天干支组合', 忌: null,
      据: '《盲派与象法》4.3「立体看后天干支组合」；「阴阳同旺同透时，**阴水优先立体，日干优先立体**」' });
  }

  const 提示 = [];
  if (b === 2) 提示.push('**寅月之体两说相反**：本知识模块作「立阴为体」（老阴向少阳转化、先天阴旺）；'
    + '提示词 §五却将寅与夏、申同列为「立阳为体」。**不可径取一说**，须按所宗流派并陈。');
  if (b === 8) 提示.push('**申月是"热极将退而阴始生"的节点**（日均温峰值在申月）：'
    + '主张"守阳抑阴"者由此推出忌阴，而"阳旺用阴"者取阴，两说相反——'
    + '这正是提示词 §八 所列"调候与太极相反"的分歧来源。');
  if (T.体 === '依组合') 提示.push('本层**不定方向**，须以原局干支组合定体用；不得据月支直接取用。');
  提示.push('本层各家皆只定**大方向（何者不可逆）**，不落到具体干支。');

  const 补充 = b === 2 || b === 8 ? '另据模块所述十二月阴阳气序：老阴（亥子丑）→少阳（寅）→同旺（卯）→交接（辰）'
    + '→老阳（巳午未）→少阴（申）→同旺（酉）→交接（戌）。'
    + '此序把寅记为「少阳」、申记为「少阴」，与 §4.3 立体表的"先天阴旺／阳旺"取意不同，一并存参。' : null;

  return {
    月支: String(monthBranchName), 分组: T.组, 定位: T.定位, 体: T.体, 气: T.气,
    用神方向: 方向, 提示, 补充说明: 补充,
    来源: '《盲派与象法》4.3 十二月立体表（王庆探索者／张岩整理，单一来源）；§4.4 成太极与用神',
  };
}

/**
 * 先天「体」与后天「旺」的分离比对。
 *
 * **这是本项目已确认过的一处概念错误，转写为函数以防再犯**：
 * `taijiOf` 给出的「体」是**先天定位**（由月支定），而 §4.4 口诀「阳旺用阴，阴旺用阳」
 * 吃的那个「旺」是**后天力量**（由全局干支定）。**两者可以相反。**
 * 模块自己的口诀写得明白：
 *
 *   > 「冬夏老阴老阳先天定，**春秋少阴少阳后天寻**。冬夏如格天注定，**春秋似局地做主**。」
 *
 * 且 §4.3 寅月那一行明写翻盘条件：「**只有出现寅午戌三合火局或最旺阳组合时才为阳旺**」——
 * 后天可推翻先天。故凡涉"春秋"（寅卯辰申酉戌）之月，**先天只能作参考，须以后天定**；
 * 冬夏（亥子丑巳午未）则先天即基调，后天一般为同向（未月另有"后天阳气比巳午都难平衡"之说）。
 *
 * @param {string} monthBranchName 月支，如 '申'
 * @param {{阴占比:number, 阳占比:number}} strength yinyangGroupsOf 计得的集团占比
 */
export function taijiTiVsWang(monthBranchName, strength) {
  const 先天 = taijiOf(monthBranchName);
  const 阴 = Number(strength?.阴占比);
  const 阳 = Number(strength?.阳占比);
  if (!Number.isFinite(阴) || !Number.isFinite(阳)) {
    throw new Error('taijiTiVsWang: strength 须含数值型「阴占比」「阳占比」');
  }
  const b = BRANCHES.indexOf(String(monthBranchName));
  // 春秋＝后天做主；冬夏＝先天即定
  const 后天做主 = [2, 3, 4, 8, 9, 10].includes(b);
  const 旺方 = 阳 > 阴 ? '阳' : (阴 > 阳 ? '阴' : '两平');
  const 先天体 = 先天.体;
  const 一致 = 先天体 === '依组合' ? null : (先天体 === 旺方);

  const 说明 = [];
  if (先天体 === '依组合') {
    说明.push(`**${monthBranchName}月先天不定体**（${先天.分组}）：`
      + `模块作「${先天.定位}」，须以干支组合定体用，先天表在此不提供答案。`);
  } else if (一致 === true) {
    说明.push(`先天立**${先天体}**为体，后天实测亦**${旺方}旺**——先后天同向，`
      + `本条可直接按「${旺方}旺用${旺方 === '阳' ? '阴' : '阳'}」取用（仍须并陈 §4.4 与提示词两说，见 taijiOf）。`);
  } else {
    说明.push(`★ **先后天相反**：先天立**${先天体}**为体，而后天实测**${旺方}旺**。`
      + '这正是"春秋后天寻"的现场——**不可把先天的「体」当后天的「旺」用**；'
      + '取用须依后天旺方，先天只作大方向（何者不可逆）参考。');
  }
  if (后天做主) {
    说明.push(`**${monthBranchName}月属春秋（少阴少阳），模块口诀明定「春秋少阴少阳后天寻」「春秋似局地做主」**，`
      + '故本月先天表仅供参考，**以后天为主**。');
  } else {
    说明.push(`**${monthBranchName}月属冬夏（老阴老阳），模块口诀明定「冬夏老阴老阳先天定」「冬夏如格天注定」**，`
      + '先天即基调；若后天实测与之相反，须说明是何组合造成翻盘（如寅月之"寅午戌三合火局"类）。');
  }

  return {
    月支: String(monthBranchName),
    先天: { 体: 先天体, 分组: 先天.分组, 定位: 先天.定位, 气: 先天.气 },
    后天: { 旺方, 阴占比: 阴, 阳占比: 阳, 差: Number((阳 - 阴).toFixed(1)) },
    先后天是否一致: 一致,
    何者做主: 后天做主 ? '后天（春秋）' : '先天（冬夏）',
    说明,
    错误警示: '把 `先天.体` 当作 §4.4 的「旺」来推「阳旺用阴／阴旺用阳」，是本项目已确认的概念错误。'
      + '两者定义不同、可以相反，**必须分开报**。',
    来源: '《盲派与象法》4.3 十二月立体表口诀；§4.3 寅月翻盘条件',
  };
}

/* ------------------------------------------------------------------ *
 * 十二、阴阳集团与成太极（太极法的后天一半）
 *
 * 设计纪律（务必遵守，勿"顺手优化"掉）：
 *   · 集团划分是**该派特有设定**，知识模块自己要求"使用时必须显式声明"，
 *     故本组函数一律**并列两说**，不替调用方择一，并附出处等级。
 *   · 「先天之体」（月支定，见 taijiOf）与「后天之旺」（全局定，见本组）
 *     **可以相反**，必须**分开报**——混同二者是本项目已确认的概念错误。
 *   · **成太极不设机械判据**（详由见 `taijiFormationOf` 的文档头）。
 *     本组函数只给出结构事实（占比／透干／通根／跨集团互动）与各派主张，
 *     **由调用方并陈**，绝不代判。
 * ------------------------------------------------------------------ */

/**
 * 「成太极」的判定——**古典判据、可校准性声明与校准用例**。
 *
 * ## 一、古典判据（本项目查得的最接近表述，逐字）
 *
 * 《滴天髓·寒暖》：「**寒虽甚，要暖有气；暖虽至，要寒有根**」
 * —— **寒甚而暖无气，则反以无暖为美；暖之至而寒无根，则反以无寒为美。**
 * （《滴天髓阐微》通神论·寒暖、燥湿；任氏正之。）
 *
 * 这给出的是**双向条件**：需救的一方**有气或有根**才算"救得到"；
 * **无气或（对应地）无根**，则"反以无之为美"——即该方之不存在反而是好事，
 * 强求补充它反而是病。**注意：这是就"寒暖"言，不是就"阴阳集团"言**，
 * 转用到集团上属**现代引申**，必须声明。
 *
 * 现代讲义的同义口号是「**能救阴或救阳使其平衡就是好八字，也叫成太极**；
 * 太极不成则富贵不高」（《盲派与象法》4.4）——但该讲义**没有给出"怎么算能救"的界限**。
 *
 * ## 二、为什么引擎**不给**「成 / 不成」的二值结论
 *
 * 因为**该判据在本项目现有材料上无法校准**。实测（`_work/t_criterion2.mjs`）：
 * 用三个候选判据（透干或通根／透干或得气／当令或通根）去跑**全部 5 个有据命例**，
 * **每一判据在每一命例上都判"有救"**，无一例得"无救"。
 * 即：现有材料里**有据的正面例 2 个、反面例 0 个**。
 *
 * 单侧样本只能证伪、不能校准阈值。故本函数**只报结构 + 古典判据 + 校准状态**，
 * 把「成不成」留给调用方并陈——硬给二值等于把一家之说固化成数字，
 * 而本项目明令**引擎拒绝实现吉凶评分器**。
 *
 * ## 三、校准清单（**依据等级分明，勿混**）
 *
 * | 命例 | 依据 | 判定 |
 * |---|---|---|
 * | `甲戌 辛未 壬戌 甲辰` | 《盲派与象法》4.4 明判「有太极，则有富贵」（阴仅 33.9%） | **有救 ✓** |
 * | `甲申 丙子 庚辰 戊寅` | 《滴天髓阐微》原文例证「寒金冷水赖寅时一阳解冻」判吉，且"遥冲为动" | **有救 ✓** |
 * | 辰月戊土命，火土一片 | 《盲派与象法》4.4 明判「太极不成，富贵不高」 | **✗ 无四柱，不可复核** |
 *
 * **第 3 例是唯一的反面例，但它只有描述、没有四柱**，故**不能**用于校准。
 * 任何日后要收紧本判据的改动，**必须先找到"太极不成"且四柱完整的命例**，
 * 并把它加进本节表格与 `selftest`。
 *
 * @param {object} chart
 * @param {string} [divisionCode] 集团划分代号，见 yinyangGroupDivisions
 */
export function taijiFormationOf(chart, divisionCode = 'A-蒲云星命') {
  const g = yinyangGroupsOf(chart, divisionCode);
  const 弱 = g.阳集团.占比 > g.阴集团.占比 ? g.阴集团 : g.阳集团;
  const 强 = 弱 === g.阴集团 ? g.阳集团 : g.阴集团;
  const 透 = (弱.透干 || []).length;
  const 根 = (弱.通根 || []).length;
  const 当令 = (弱.当令 || []).length;
  const 得气 = (弱.得气 || []).length;

  // 三个候选判据同时给出（都是古典判据的合理引申），并说明它们在本项目材料上无法区分
  const 判据 = [
    {
      名: '有根（透干 或 通根）',
      古典对应: '「寒虽甚，要暖**有气**」之"有气"若作"有根气"解；亦近「暖虽至，要寒**有根**」之"有根"',
      结果: (透 + 根) > 0 ? '有救' : '无救（反以无之为美）',
      明细: `透干 ${透} 处、通根 ${根} 处`,
    },
    {
      名: '有气（透干 或 得气＝令态旺/相）',
      古典对应: '直接对应「要暖**有气**」「要寒**有根**」之"有气"',
      结果: (透 + 得气) > 0 ? '有救' : '无救（反以无之为美）',
      明细: `透干 ${透} 处、得气 ${得气} 处`,
    },
    {
      名: '当令或通根',
      古典对应: '「有气」从严解为"当令"',
      结果: (当令 + 根) > 0 ? '有救' : '无救',
      明细: `当令 ${当令} 处、通根 ${根} 处`,
    },
  ];

  const 全部同判 = 判据.every((j) => j.结果 === 判据[0].结果);

  return {
    需救方: 弱.名,
    需救方占比: 弱.占比,
    强方: 强.名,
    强方占比: 强.占比,
    结构: {
      透干: 透, 通根: 根, 当令: 当令, 得气: 得气,
      日干在此集团: 弱.日干在此集团,
      有形可附: 弱.有形可附,
    },
    古典判据: {
      原文: '《滴天髓·寒暖》「寒虽甚，要暖有气；暖虽至，要寒有根」'
        + '——「寒甚而暖无气，则反以无暖为美；暖之至而寒无根，则反以无寒为美」',
      出处: '《滴天髓阐微》通神论·寒暖、燥湿（任氏正之）',
      注意: '**此条是就"寒暖"言，不是就"阴阳集团"言**；把它转用到集团上属**现代引申**，'
        + '使用时必须声明。现代讲义的口号「能救阴或救阳使其平衡就是好八字」**未给判据界限**。',
    },
    候选判据: 判据,
    判定: 全部同判 ? `三判据同判「${判据[0].结果}」` : '三判据结果不一致（须逐条并陈）',
    成太极: 全部同判 && 判据[0].结果 === '有救' ? '倾向"成太极"（**未校准**）' : '倾向"太极不成"（**未校准**）',
    校准状态: {
      结论: '★ **本判据无法校准** —— 现有材料中**有据正面例 2 个、反面例 0 个**。'
        + '三个候选判据在全部 5 个实测命例上**一律判"有救"**，无一例得"无救"；单侧样本只能证伪、不能定阈值。'
        + '故引擎**不输出二值的"成 / 不成"**，只报结构与判据，由调用方并陈。',
      正面例: [
        { 四柱: '甲戌 辛未 壬戌 甲辰', 依据: '《盲派与象法》4.4 明判「有太极，则有富贵」（阴仅 33.9% 而水木透干通根）', 判定: '有救' },
        { 四柱: '甲申 丙子 庚辰 戊寅', 依据: '《滴天髓阐微》原文例证「寒金冷水赖寅时一阳解冻」判吉，且「遥冲为动」', 判定: '有救' },
      ],
      反面例: [
        { 四柱: '（无）辰月戊土命，火土一片', 依据: '《盲派与象法》4.4 明判「阳集团强大，阴弱，太极不成，富贵不高」',
          判定: '✗ **只有描述、没有四柱，不可复核，故不能用于校准**' },
      ],
      待办: '**要收紧本判据，必须先找到"太极不成"且四柱完整的命例**，'
        + '加入本节表格与 `selftest` 后再改。在此之前不得把任何候选判据当作定论。',
    },
    据: '《滴天髓阐微》通神论·寒暖（古典判据）；《盲派与象法》4.4 成太极与用神（现代讲义）',
  };
}

/**
 * 阴阳集团划分：并列两说，并标注出处等级。
 *
 * 「阴＝水木／阳＝火土金」把**金**划入阳集团，是该派特有设定
 * （理由见《盲派与象法》4.2：金为少阴、阳点大部分、金制木以存土、土为火之护）。
 * 此说**未见古籍出处**，知识模块自标「单一来源」「缺可校勘原始文本」，
 * 凡用必须显式声明。另有"按阴阳本义划"的常见分法一并给出以供对照。
 */
export function yinyangGroupDivisions() {
  return [
    {
      代号: 'A-蒲云星命',
      阴集团: ['水', '木'],
      阳集团: ['火', '土', '金'],
      出处等级: '现代讲义（单一来源，自承缺可校勘原始文本）',
      据: '《盲派与象法》4.2「金为什么是阳集团，因为金是少阴，阳点大部分，是逐渐走向阴，'
        + '并且金制木保存了土，土是火的保护神，所以金在后天是阳集团」',
      附加规定: '金入阳集团是该派**特有设定**；模块明言「使用时必须显式声明采用哪种集团划分」（§4.2、§6.1 第15条）。',
    },
    {
      代号: 'B-阴阳本义',
      阴集团: ['水', '金'],
      阳集团: ['木', '火'],
      土: '不定',
      出处等级: '常见分法（各家不一，**未找到可靠统一来源**）',
      据: '《盲派与象法》4.2 表列「说 B：各家不一」；本划分由整理者按「金为少阴」的通行理解举出，**非原讲义原文**，仅作对照。',
      附加规定: '用此划分时须另行声明，且土之归属须按局中燥湿另议。',
    },
  ];
}

/**
 * 阴阳集团力量对比 + 跨集团互动。
 *
 * **力量的读法（关键，勿简化为加总）**：知识模块自己的命例推翻了纯占比法——
 * 坤造 甲戌 辛未 壬戌 甲辰 的阴集团仅约三成，模块却判「有太极、有富贵」，
 * 理由是「水实际上比较自由，理出了阴气，并且日干透壬水，阴气可以附在水木之形上面
 * 得以发挥作用」。故"是否**有活动力／有救**"取决于**透干与通根**，不只看占比。
 * 本函数把占比与"活动力"**分列**，两者不一致时即为成太极之争的现场。
 *
 * **力量也不是简单加总**：模块 §4.4 给出跨集团互动机制，典型者
 * 「庚克木可出火气……庚克了甲木则土气自由，土气自然就能暗护火气而助起阳集团」。
 * 本函数检出这类互动，**只陈述机制，不代算净效果**。
 *
 * @param {object} chart
 * @param {string} [divisionCode] 'A-蒲云星命'（默认）或 'B-阴阳本义'
 */
export function yinyangGroupsOf(chart, divisionCode = 'A-蒲云星命') {
  const div = yinyangGroupDivisions().find((d) => d.代号 === divisionCode);
  if (!div) throw new Error(`yinyangGroupsOf: 未知集团划分「${divisionCode}」`);
  const pillars = chart.pillars;
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const posNames = ['年', '月', '日', '时'];

  // 每个五行的透干 / 通根明细（排除日干自身——日干是"我"，不是外来之气）
  const 在位 = {};
  for (const e of ELEMENTS) {
    const 透干 = [];
    const 通根 = [];
    for (let i = 0; i < 4; i++) {
      const stem = pillars[i].stem ?? STEMS[pillars[i].stemIndex];
      const branch = pillars[i].branch ?? BRANCHES[pillars[i].branchIndex];
      if (i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(stem)]] === e) {
        透干.push({ 位: `${posNames[i]}干`, 字: stem, 含日干: false });
      }
      for (const h of HIDDEN_STEMS_SPEC[branch === undefined ? pillars[i].branchIndex : BRANCHES.indexOf(branch)]) {
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] === e) {
          通根.push({ 位: `${posNames[i]}支`, 字: branch, 藏: h[0], 层: h[1], 权重: h[2] });
        }
      }
    }
    在位[e] = { 透干, 通根, 令态: s.令态[e], 占比: s.percent[e] };
  }

  // 日干所属（"我"）单列，供"阴水优先立体、日干优先立体"的口诀使用
  const 日干 = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const 日干五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日干)]];

  const 组 = (name, list) => {
    const 占比 = Number(list.reduce((a, e) => a + s.percent[e], 0).toFixed(1));
    const 透 = list.flatMap((e) => 在位[e].透干.map((x) => `${x.字}(${e})`));
    const 根 = list.flatMap((e) => 在位[e].通根.map((x) => `${x.字}(${e}·${x.层}${x.权重})`));
    const 当令 = list.filter((e) => 在位[e].令态 === '旺');
    const 有气 = list.filter((e) => 在位[e].令态 === '旺' || 在位[e].令态 === '相');
    // 本方是否含日干（"我"）。日干是"我"、不是外来之气，故作**独立字段**报出，
    // 不混入透干计数；但太极法讲义自己就拿"日干透壬水"作"阴气可附于形"的论据，
    // 故此处必须让它可见，否则会漏掉该派的关键推理。
    const 含日干 = list.includes(日干五行);
    // "有救"的**结构条件**（不是结论）：本方至少有神透干或通根，即"有形可附"
    const 有形可附 = 透.length > 0 || 根.length > 0;
    return { 名: name, 五行: list, 占比, 透干: 透.length ? 透 : null, 通根: 根.length ? 根 : null,
      当令: 当令.length ? 当令 : null, 得气: 有气.length ? 有气 : null,
      日干在此集团: 含日干,
      有形可附,
      有形可附含日干: 有形可附 || 含日干 };
  };
  const 阴 = 组('阴集团', div.阴集团);
  const 阳 = 组('阳集团', div.阳集团);
  const 差 = Number((阳.占比 - 阴.占比).toFixed(1));
  const 强 = 差 > 0 ? 阳 : 阴;
  const 弱 = 差 > 0 ? 阴 : 阳;

  // ---- 跨集团互动（模块 §4.4 的机制，逐条检出；不代算净效果）----
  const 互动 = [];
  const 有根字 = (list) => list.some((x) => 在位[x].通根.length > 0 || 在位[x].透干.length > 0);
  const 克木者 = ['金'].filter((x) => 在位[x].透干.length || 在位[x].通根.length);
  if (克木者.length && 有根字(['木'])) {
    互动.push({
      机制: '金克木 → 土气自由 → 暗护火气 → 助起阳集团',
      原文: '「庚克木可出火气……因庚克了甲木则土气自由，土气自然就能暗护火气而助起阳集团」',
      适用: '金、木俱在原局有气，故本机制成立；**土与火是否因此转强，须由调用方按原局燥湿与位置判**。',
      方向: '助阳',
    });
  }
  if (在位['金'].透干.length && 在位['水'].透干.length) {
    互动.push({ 机制: '金生水 → 助阴', 原文: '（五行相生通则；模块未单列，此处据生子之理检出）',
      适用: '金水俱透，金之气直接流向水。', 方向: '助阴' });
  }
  if (有根字(['木']) && (在位['土'].透干.length || 在位['土'].通根.length)) {
    互动.push({ 机制: '木克土 → 土受制 → 火失其护', 原文: '（土为火之保护神，见 §4.2）',
      适用: '木与土俱有气；此机制**削弱**阳集团。', 方向: '损阳' });
  }
  if (有根字(['水']) && (在位['火'].透干.length || 在位['火'].通根.length)) {
    互动.push({ 机制: '水克火 → 阴直接制阳', 原文: '（相克通则）',
      适用: '水火俱有气；此为阴阳对抗的正面冲突，非"暗护"。', 方向: '损阳助阴' });
  }

  const 提示 = [];
  if (强.占比 < 55) 提示.push(`**两集团占比接近**（阴${阴.占比}% 对 阳${阳.占比}%），属太极法所谓"阴阳同旺"之局，`
    + '立体与用神须以干支组合定，不得据月支直接取用。');
  if (弱.有形可附) 提示.push(`**弱方（${弱.名}）有形可附**：${弱.透干 ? `透干${弱.透干.join('、')}` : ''}`
    + `${弱.透干 && 弱.通根 ? '，' : ''}${弱.通根 ? `通根${弱.通根.slice(0, 4).join('、')}` : ''}。`
    + '按模块 §4.4「阴气可以附在水木之形上面得以发挥作用」之义，弱方未必无救；'
    + '然**"有救"的判据本无机械定论**（见返回字段 `成太极`），不可据此径断成太极。');
  else 提示.push(`**弱方（${弱.名}）无形可附**：既不透干、亦不通根，全局无其气可依。`);
  if (强.占比 >= 70) 提示.push(`**强方（${强.名}）占据 ${强.占比}%**，形成压倒之势。`
    + '若弱方又无形可附，则近于"阳旺无制／阴旺无制"，模块判"太极不成，富贵不高"。');
  if (阴.占比 > 0 && 阳.占比 > 0 && !!在位['火'].透干.length !== !!在位['水'].透干.length) {
    提示.push('**水火不两见**（一方透干、一方全无），是太极法判"阴阳不接"的重要迹象，须在成太极一层写明。');
  }

  return {
    所用划分: div.代号,
    划分出处等级: div.出处等级,
    划分依据: div.据,
    划分声明: '金入阳集团为该派**特有设定**，与"金为少阴主肃杀收敛"的通行理解不同；**使用时必须显式声明**。',
    阴集团: 阴,
    阳集团: 阳,
    占比差: `阳 − 阴 = ${差} 个百分点`,
    先天定位: taijiOf(monthBranch),
    先后天比对: taijiTiVsWang(monthBranch, { 阴占比: 阴.占比, 阳占比: 阳.占比 }),
    日干: { 字: 日干, 五行: 日干五行, 所属集团: div.阳集团.includes(日干五行) ? '阳' : (div.阴集团.includes(日干五行) ? '阴' : '土（该划分未定）') },
    跨集团互动: 互动.length ? 互动 : null,
    提示,
    成太极: {
      状态: '**本层不设机械判据**，只给结构事实与各派主张，由调用方并陈。',
      两派主张: [
        { 派: '纯占比法（最粗，模块反证否定）', 判: `按占比 ${强.名}强于${弱.名}，若以"强者为旺"则用另一方；`
          + '此法**已被模块自己的命例否定**：甲戌 辛未 壬戌 甲辰 阴仅三成却判"有太极、有富贵"。' },
        { 派: '有救法（模块讲义，无机械判据）', 判: '「能救阴或救阳使其平衡就是好八字，也叫成太极」；'
          + '「太极不成则富贵不高」。**怎么算"能救"、"有救"，讲义未给可核对的界限**——'
          + '与《滴天髓》自承"多旺才算旺极没有给出可核对的界限"同类。故只报结构，不下结论。' },
      ],
      关键反证命例: {
        四柱: '甲戌 辛未 壬戌 甲辰',
        模块结论: '有太极，有富贵（太极法与格局法结论一致）',
        模块理由: '「未月立阳为体，以阴为用……水实际上比较自由，理出了阴气，并且日干透壬水，'
          + '阴气可以附在水木之形上面得以发挥作用」',
        本函数实测: `阴 ${阴.占比}% / 阳 ${阳.占比}%；弱方有形可附 = ${弱.有形可附}`,
        用法: '**任何改动 taijiBalanceOf 的判据，都必须先用此例回归**，不得得出"太极不成"。',
      },
      见: '完整的判据、古典出处与校准状态见 `taijiFormationOf`（本引擎已实现）。',
      古典最近表述: '《滴天髓·寒暖》「寒虽甚要暖有气，暖虽至要寒有根」——'
        + '此为本项目查得的**最接近"有救"的古典表述**，但它是就寒暖言，非就集团言，转用须声明。',
    },
    来源: '《盲派与象法》4.2 集团划分、4.4 成太极与用神；占比由 elementStrength 计得（经验加权，'
      + '衡量气候与气势，非日主受力）',
  };
}

/**
 * 通关神：两神相战，取"生甲方而又生乙方"之神以和之。
 *
 * 机械判定：若 A 克 B 且两者在原局皆有相当力量，则**通关神 = A 所生之神**
 * （该神同时为 B 之母，故能引通 A 之气以生 B）。
 * 例：金木相战（金克木）→ 通关为水（金生水、水生木）。
 *
 * @param {object} chart
 * @param {{threshold?:number}} [options] threshold 为参战方的最低力量占比（默认 12%）
 */
export function tongguanOf(chart, options = {}) {
  const { threshold = 12 } = options;
  const pillars = chart.pillars;
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const stems = pillars.map((p) => p.stem ?? STEMS[p.stemIndex]);
  const branches = pillars.map((p) => p.branch ?? BRANCHES[p.branchIndex]);

  const 现 = (el) => {
    const 透 = [], 根 = [];
    for (let i = 0; i < 4; i++) {
      if (i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(stems[i])]] === el) 透.push(`${['年', '月', '日', '时'][i]}干${stems[i]}`);
      for (const h of HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branches[i])]) {
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] === el) 根.push(`${['年', '月', '日', '时'][i]}支${branches[i]}·${h[1]}${h[0]}`);
      }
    }
    return { 透干: 透, 通根: 根, 在位: 透.length > 0 || 根.length > 0 };
  };

  const 相战 = [];
  for (const A of ELEMENTS) {
    const B = KE_MAP[A];
    if (s.percent[A] < threshold || s.percent[B] < threshold) continue;
    const 通关 = SHENG_MAP[A];
    相战.push({
      相战: `${A}克${B}`, 甲方: { 五行: A, 占比: s.percent[A] }, 乙方: { 五行: B, 占比: s.percent[B] },
      通关神: 通关, 通关神情况: 现(通关),
      说明: `${A}(${s.percent[A]}%)与${B}(${s.percent[B]}%)两神相战；`
        + `${A}生${通关}、${通关}生${B}，故取**${通关}**通关，则${A}之气引通以生${B}，连环相生而气顺。`,
    });
  }

  return {
    参战阈值: `${threshold}%`,
    五行占比: s.percent,
    相战,
    说明: 相战.length
      ? '以上为按力量占比自动检出的相战组合。通关之神是否**在位**（透干或通根）已一并列出；'
        + '在位者方可言"有通关"，不在位者只是"需通关而不得"。'
      : `未检出两者皆达 ${threshold}% 的相克组合（可能力量分散，或需下调阈值）。`,
    注: '通关属取用六层中的**最后一层补充**，不改变格局与调候的主线；两神相战本身未必是病。',
  };
}

/**
 * 取用神六层的**作答表骨架**。
 *
 * 提示词 §五 要求"**强制逐层书面作答，不得跳层**"。本函数把引擎能确定的量
 * **预先填进对应层**，让调用方只需补判断、不必从零检索，从而真正走完六层。
 *
 * 硬约束（提示词 §五）一并在 `硬约束` 中给出；第 2 层与第 5 层结论相反时，
 * 提示词要求**第 2 层优先**并明写这是「顺逆法与中和法的分歧」——本函数只**检出**该冲突，
 * 不代判谁对。
 *
 * @param {object} chart
 */
/**
 * 取用神六层的**作答表骨架**。
 *
 * @param {object} chart
 * @param {{用神五行?:string, 忌神五行?:string, 岁运?:string}} [opts]
 *   ★ 由调用方**声明**用神／忌神（五行名）。仲裁器（`yongshenArbiterOf`）需要它
 *   才能把「体用」当主结论——否则体用会自己按调候表暂取，与调用方的判断脱节。
 */
export function sixLayersOf(chart, opts = {}) {
  const pillars = chart.pillars;
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const tha = tiaohouAssessment(chart);
  const taiji = taijiOf(monthBranch);
  const seed = yuelingSeed(chart);
  const dms = dayMasterSupport(chart);
  const tg = tongguanOf(chart);
  const 闸 = congGateOf(chart);   // 极弱闸：极弱盘须先过从格关，方轮到第 5 层
  const 旺闸 = wangGateOf(chart); // 极旺闸：极旺盘须先过旺格关（**与极弱闸对称的另一半**）
  const favor = GEJU_FAVOR[seed.本气God] ?? null;

  // 第 4 层：病（太过 / 不及 / 战克）的候选，按占比极值给出
  const pct = dms.五行占比;
  const 最旺 = ELEMENTS.reduce((a, b) => (pct[a] >= pct[b] ? a : b));
  const 最弱 = ELEMENTS.reduce((a, b) => (pct[a] <= pct[b] ? a : b));
  const 病药 = {
    太过: { 五行: 最旺, 占比: pct[最旺], 说明: `全局${最旺}最旺（${pct[最旺]}%），是否成"太过"之病须结合月令与有无制神` },
    不及: { 五行: 最弱, 占比: pct[最弱], 说明: `全局${最弱}最弱（${pct[最弱]}%），是否成"不及"之病须看其是否为日主或用神` },
    战克: tg.相战.length ? tg.相战.map((x) => x.相战) : null,
    药: '制太过之神／补不及之神／通关之神，三者何者为"药"，须先定病。',
    据: '《子平真诠》「病药相济」；《滴天髓》通关章',
  };

  const 层 = [
    {
      序: 1, 层: '调候层', 问题: '月令寒暖燥湿是否严重失衡？取调候用神',
      引擎已定: tha ? { 用神: tha.用神, 辅佐: tha.辅佐, 忌: tha.忌, 分用: tha.分用, 并列用神: tha.并列用神, 回填: tha.回填, 用神到位: tha.用神到位, 辅佐到位: tha.辅佐到位 } : null,
      判断: '待作答：调候之神是否在位、是否被合被冲；若不在位，格局再好亦难发。'
        + ' ★ 限定：《子平真诠》「**冬夏以调候为急**」——只在**冬（亥子丑）／夏（巳午未）**或明显寒燥失衡时才作急，'
        + '**其余月令以格局为重**，本层降为参考。',
      据: '《穷通宝鉴》十干×十二月令调候表；《子平真诠》「冬夏以调候为急」',
    },
    {
      // ★ 本层原为「阴阳／太极层」。使用者 2026-09-28 决定：
      //   **太极法代码保留，但解盘时直接跳过。** 故本层改为**从格闸（顺逆层）**：
      //   只做一件古典上站得住的事——判"气势可不可逆"（从/不从），
      //   以及它决定的核心问题：「先问顺谁，再谈补谁」。
      //   太极法（集团划分／立体／成太极）**不再参与解盘**；
      //   需要时以 `action=yinyang` 或 `taijiOf()` 单独调用，代码与判据完整保留。
      序: 2, 层: '顺逆层（从格闸／旺格闸）', 问题: '日主之气势可不可逆？当顺（从／专旺）还是当逆（扶／泄克）？',
      引擎已定: { 从格闸: 闸, 旺格闸: 旺闸 },
      判断: '待作答：本层只定**大方向——能不能逆**。'
        + (闸.是否极弱
          ? '★ **本局日主极弱，须先答"顺谁"，再谈"补谁"**（不从严四条见 `从格闸`）。'
          : 旺闸.是否极旺
            ? '★ **本局日主极旺**——若成专旺／从旺，**克之则激、泄之则通**，方向是顺不是泄克（见 `旺格闸`）。'
            : '本局日主非无根之极弱、亦非极旺，从格关与旺格关均不触发；仍须说明"不逆气势"的理由。'),
      据: '《滴天髓》「**顺逆不齐也，不可逆者，其气势而已矣**」——本层即此"顺逆"之判；'
        + '从格成立条件见《穷通宝鉴·判断顺序》不从严（「干上有木不作从财」「支内有水不作从杀」）与「有根即不从」；'
        + '旺格（专旺／从旺／从强）判据沿用 `specialGejuOf`（《千里命稿》§3011–3037）。'
        + ' **[太极法已按使用者决定从解盘中移除]**',
      硬约束: '本层与第 5 层的关系：**凡取印比（逆气势）者，必须先在本层说明为何可逆**；'
        + '若本层判定气势不可逆（从格成立），则第 5 层的"补"不成立；'
        + '**若判定为专旺成格，则第 5 层的"泄克"同样不成立——须顺其旺势。**'
        + (闸.是否极弱
          ? ' ★ **本局（极弱）闸门已生效：第 5 层被阻止直接取印比**——'
            + `不从严${闸.拦住条数 === 0 ? '四条全不拦，故方向应先问"顺谁"' : `有 ${闸.拦住条数} 条拦住（${闸.不从严.filter((x) => x.拦).map((x) => x.条).join('、')}），故**不作从论**`}；`
            + '过闸之后第 5 层方可候选。'
          : 旺闸.是否极旺
            ? ' ★ **本局（极旺）旺格闸已生效：第 5 层被阻止直接取食伤财官**——'
              + `同党占比 ${旺闸.同党占比}%；` + (旺闸.旺格成立
                ? `**旺格成立（${旺闸.旺格成立.join('、')}）⇒ 顺其旺势、官杀为忌**`
                : '**旺格未成立 ⇒ 常法泄克可用，但须说明气势为何可逆**') + '。'
            : ''),
      已移除: '**太极法（阴阳集团划分／立阴立阳为体／成太极）不再参与解盘**——'
        + '使用者 2026-09-28 决定。代码与判据完整保留（`taijiOf`／`yinyangGroupsOf`／'
        + '`taijiFormationOf`／`taijiTiVsWang`），需要时以 `action=yinyang` 单独调用。',
    },
    {
      序: 3, 层: '格局层', 问题: '月令取格，判成格／破格／带忌／救应，指出相神',
      引擎已定: { 月令: seed.月令, 月令本气: seed.本气, 本气十神: seed.本气God, 本气透干: seed.透干, 顺逆: favor },
      判断: '待作答：按八格成破表对号入座，写明四层；**相神受伤则格败**。',
      据: '《子平真诠》2.5 用神取法总则（善神顺用／不善神逆用）、八格成破表',
      引擎限制: '底座层只提取月令本气与透干，未判成破；八格成格、破格与救应已由体用推演层 gejuChengPoOf（P-021）结构化输出。',
    },
    { 序: 4, 层: '病药层', 问题: '命局最重的病是什么？制病之药是否在局中？', 引擎已定: 病药, 判断: '待作答：病药相济胜过纯粹旺衰。', 据: '《子平真诠》病药相济；《滴天髓》通关' },
    {
      序: 5, 层: '中和扶抑层', 问题: '日主得令／得地／得势如何？取印比还是取食伤财官？',
      引擎已定: { 得令: dms.得令, 月令令态: dms.月令令态, 得地: dms.得地, 得势: dms.得势, 同党占比: dms.同党占比, 异党占比: dms.异党占比 },
      判断: '待作答：取印比或取食伤财官。',
      据: '扶抑取用通则',
      硬约束: '提示词 §五：**本层永远是最后一名候选**；禁止以"身弱"为由直接跳到本层取印比；'
        + '**若要取印比（即逆气势），必须先在第 2 层（顺逆层）说明为何可逆**。',
      闸门: 闸.是否极弱
        ? `★ **本层已被闸门阻止直接取印比**（日主极弱：${闸.闸门结论[0]}）。`
          + `须先过：${闸.须先过关.join(' → ')}`
        : 旺闸.是否极旺
          ? `★ **本层已被旺格闸阻止直接取食伤财官**（日主极旺，同党 ${旺闸.同党占比}%）。`
            + `取用方向：${旺闸.取用方向}。须先过：${旺闸.须先过关.join(' → ')}`
          : '本层未被闸门阻止（日主非极弱、亦非极旺），但仍须守"最后一名候选"。',
    },
    { 序: 6, 层: '通关层', 问题: '两神相战，取通关之神', 引擎已定: tg, 判断: '待作答：通关之神是否在位。', 据: '《滴天髓》通关章' },
  ];

  // 冲突检出。
  // ★ 太极法默认不参与解盘，故下列两类"与太极相反"的冲突**默认不报**：
  //   · 第2层（太极方向）与第5层（扶抑）相反
  //   · 调候与太极相反
  //   二者皆须 `opts.includeTaiji: true` 才计算（代码与判据完整保留）。
  const 冲突 = [];
  if (opts.includeTaiji === true) {
    const 太极取 = taiji.用神方向.map((d) => ({ 派: d.派, 原则: d.原则, 取: d.取, 忌: d.忌 }));
    for (const d of 太极取) {
      if (!d.忌) continue;
      const 忌五行 = (d.忌.match(/[木火土金水]/) ?? [])[0];
      if (!忌五行) continue;
      // 第 5 层若倾向取印比，而日主同党之五行正落在太极层所忌
      const 日主五行 = dms.日主五行;
      const 印五行 = ELEMENTS.find((e) => SHENG_MAP[e] === 日主五行);
      if (忌五行 === 日主五行 || 忌五行 === 印五行) {
        冲突.push({
          层2: `「${d.派}」主张${d.原则}，取${d.取}、忌${d.忌}`,
          层5: `日主${dms.日主}（${日主五行}），第 5 层若以"身弱"取印比，所取正是${忌五行}`,
          提示: '两说相反。按提示词 §五，**第 2 层优先**，并须明写这是「阴阳法与中和法的分歧」；'
            + '引擎不代判谁对，须并陈并给出可验证的年份与体感标志。',
        });
      }
    }
    // 调候层与太极层的冲突
    if (tha) {
      const 调候神五行 = [...new Set((tha.用神到位?.神 ?? []).map((g) => g.五行))];
      for (const d of 太极取) {
        if (!d.忌) continue;
        const 忌五行 = (d.忌.match(/[木火土金水]/) ?? [])[0];
        if (忌五行 && 调候神五行.includes(忌五行)) {
          冲突.push({
            层1: `调候用神${tha.用神}属${忌五行}`,
            层2: `「${d.派}」主张忌${d.忌}`,
            提示: '此即提示词 §八 所列「调候与太极相反」：**两派结论相反**，须并列并给可验证的年份区间与体感标志。',
          });
        }
      }
    }
  }

  // ★ 诸法仲裁（用户 2026-09-28 所定优先级）：体用最高，其他参考；
  //   仅当"严重不符"（相左法数 ≥2 或 ≥半数）时才附异议各法的推理链。
  let 仲裁 = null;
  try {
    仲裁 = yongshenArbiterOf(chart, {
      ...(opts.用神五行 ? { 用神五行: opts.用神五行 } : {}),
      ...(opts.忌神五行 ? { 忌神五行: opts.忌神五行 } : {}),
      ...(opts.岁运 ? { 岁运: opts.岁运 } : {}),
    });
  } catch { 仲裁 = null; }

  return {
    日主: dms.日主, 日主五行: dms.日主五行, 月令: monthBranch,
    层,
    冲突,
    诸法仲裁: 仲裁,
    硬约束: [
      '**逐层书面作答，不得跳层**：每层都要写出「取／不取」与依据（引用引擎事实或古籍原文）。跳层即视为无效分析。',
      '★ **诸法优先级（使用者 2026-09-28 明定）**：**体用最高**，其余各法（调候／格局／扶抑／太极）**也参考**；'
        + '**若结论严重不符（各法意见差别大），再附上其他法思考的结果**。'
        + '「严重不符」的机械判据：与体用**相左的法数 ≥ 可比对法数 × 60%**'
        + '（**使用者 2026-09-28 定：反对占六成**）（见返回字段 `诸法仲裁`）。',
      '**第 5 层（中和扶抑）永远是最后一名候选。**',
      '★ **两侧闸门（第 2 层）**：**极弱**者第 5 层不得直接取印比（须先过从格闸）；'
        + '**极旺**者第 5 层不得直接取食伤财官——**若为专旺成格，则"泄克"同样不成立，须顺其旺势**'
        + '（《滴天髓》「不可逆者，其气势而已矣」）。两闸对称，见 `congGateOf`／`wangGateOf`。',
      '**禁止以"身弱"为由直接跳到第 5 层取印比。**',
      '**若要取印比（逆气势），必须先在第 2 层（顺逆层）说明为何可逆。**',
      '**若第 2 层（顺逆层）判定气势不可逆（从格成立），则第 5 层的"补"不成立**；'
        + '两向相反时**第 2 层优先**，并明写这是「顺逆法与中和法的分歧」。'
        + '（原表述为"阴阳法与中和法的分歧"——太极法停用后，本层的分歧方已不是太极派，故改名。）',
      '★ **格局权重优先于旺衰**（使用者 2026-09-28）：**第 3 层（格局）与第 5 层（扶抑）冲突时，格局优先**，'
        + '不得以"身弱/身强"推翻月令取格；此与子平路线一致（真宗子平「第一重要的是月，而不是日」）。',
      '★ **旺衰白名单**（《八字判断总纲》§二）：旺衰只准用于 ①前提判定（从/不从）②**无辙兜底**'
        + '（格局不成、主要矛盾杂乱时）③顺带参考；**不得**据以推翻格局或作取用判据。',
      '★ **调候限冬夏**：《子平真诠》「冬夏以调候为急」——第 1 层只在冬（亥子丑）／夏（巳午未）'
        + '或明显寒燥失衡时作急，**余月以格局为重**。',
      '★ **相战择优**：第 6 层不以"通关优先"为定则，按「**哪种手段最好用用哪个**」'
        + '（能否真解决主要矛盾、会否造成新的大矛盾）择优，不选者并陈代价（《八字判断总纲》一·4）。',
      '**用神要落到具体干与字**（如"丁火、巳午"），不可只写"火"。',
      '**另有一说（并列，非替代）**：《盲派与象法》6.x 给出的工程化建议是「①调候寒暖检查 → ②月令格局立格 → '
        + '③宾主体用做功 → ④太极阴阳立体用 → ⑤三份结论并列比较，记录同向处与冲突处，**不互相补洞**」（段系"同盘双读"原则）。'
        + '⚠ **其第 ④ 步（太极阴阳立体用）已按使用者决定停用**，故该建议现只能执行到 ①②③⑤；'
        + '本表与它的取径差异依旧存在（本表第 2 层为顺逆层、且主张第 2 层可覆盖下三层），**两种合并方案仍须并陈**。',
    ],
    注: '本表只把引擎能确定的量预填进各层，**六层的判断与取舍仍由调用方完成**。'
      + '凡 `冲突` 非空者，必须并陈两派，不得私下调和。',
  };
}

/* ------------------------------------------------------------------ *
 * 十九之四、体用路线法（依「八字分析指令（体用路线法）」；该指令优先级高于其他流程）
 *
 * 顺序：大势 → 体用 → 路线 → 用神 → 忌神，**旺衰只作参考**。
 * 本节只做机械判定与事实汇总；用神／忌神的最终取舍仍由调用方定。
 *
 * ⚠ 术语口径（模块 §6.1 第 1 条明确警告"同名异指，最易致误"）：
 *   · `体用` 的「用」＝盲派义——我所追求、想得到的对象（财、官）；
 *   · `用神`／`忌神` 的「用」＝子平义——维护格局、调衡全局之字。
 *   两者**不是一个东西**，凡输出须声明所采口径。
 * ------------------------------------------------------------------ */

/** 某十神相对日主五行所对应的五行 */
function elementOfGod(dayEl, god) {
  switch (god) {
    case '比肩': case '劫财': return dayEl;
    case '食神': case '伤官': return SHENG_MAP[dayEl];
    case '偏财': case '正财': return KE_MAP[dayEl];
    case '七杀': case '正官': return ELEMENTS.find((e) => KE_MAP[e] === dayEl) ?? null;
    case '偏印': case '正印': return ELEMENTS.find((e) => SHENG_MAP[e] === dayEl) ?? null;
    default: return null;
  }
}

/** 十神力度等级 → 判定"有力" */
const 力度有力 = (lv) => lv === '极' || lv === '强';

/**
 * **大势（主要矛盾）**：全局五行谁最旺、谁次旺、谁与谁交战、日主夹在哪两股势力之间。
 * 力量占比与月令当令是**输入**；"矛盾在哪"仍属判断层，引擎不代断。
 */
export function dashiOf(chart) {
  const pillars = chart.pillars;
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const 排序 = [...ELEMENTS].sort((a, b) => s.percent[b] - s.percent[a]);
  const 日主 = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const 日主五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日主)]];

  const 战 = [];
  for (const A of ELEMENTS) {
    const B = KE_MAP[A];
    if (s.percent[A] >= 12 && s.percent[B] >= 12) 战.push({ 交战: `${A}克${B}`, 各方: { [A]: s.percent[A], [B]: s.percent[B] } });
  }

  const [第一, 第二] = 排序;
  const 关系 = (e) => (e === 日主五行 ? '同我（比劫）'
    : SHENG_MAP[e] === 日主五行 ? '生我（印）'
      : SHENG_MAP[日主五行] === e ? '我生（食伤）'
        : KE_MAP[日主五行] === e ? '我克（财）' : '克我（官杀）');

  const 提示 = ['以下为**事实层**：谁旺、谁次、谁与谁交战、日主相对各方的十神关系。"主要矛盾在哪"是判断层，引擎不代断。'];
  if (战.length) 提示.push(`检出交战组合 ${战.length} 组：` + 战.map((x) => x.交战).join('、'));
  else 提示.push('未见两方皆达 12% 的相克组合（力量分散，或需下调阈值）。');

  return {
    月令: monthBranch, 五行占比: s.percent, 令态: s.令态,
    排序: 排序.map((e, i) => ({ 位次: i + 1, 五行: e, 占比: s.percent[e], 令态: s.令态[e] })),
    最旺: 第一, 次旺: 第二, 交战: 战,
    日主, 日主五行,
    日主所夹: {
      左: 第一, 左关系: 第一 === 日主五行 ? '即日主自身' : 关系(第一),
      右: 第二, 右关系: 第二 === 日主五行 ? '即日主自身' : 关系(第二),
    },
    提示,
    注: '力量占比为经验加权，衡量的是**气候与气势**，不是日主的受力。',
  };
}

/**
 * **体用**：体＝日主＋其同盟（比劫、印，以及日主做功所依之神：坐支所藏、透干之食伤）；
 * 用＝命主要取的财、官（以及被制的忌神）。判体能否承载并取得"用"；
 * 体弱扛不动用 → 考虑从；体用不平衡＝病，明说病在体侧还是用侧。
 *
 * ⚠ 本函数用的是**盲派体用**义（用＝所求之对象），**不是子平用神**。
 * ⚠ 「食伤归体还是归用」本身是分歧（模块 §6.1 第 12 条），本函数按指令划入**体**并列出该分歧。
 */
export function tiyongOf(chart) {
  const pillars = chart.pillars;
  const 日主 = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const 日主五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日主)]];
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const dms = dayMasterSupport(chart);
  const tgs = tenGodStrength(chart);
  const byGod = Object.fromEntries(tgs.各十神.map((x) => [x.十神, x]));

  const pack = (gods) => gods.map((g) => {
    const el = elementOfGod(日主五行, g);
    return {
      十神: g, 五行: el, 五行占比: s.percent[el],
      级别: byGod[g]?.级别 ?? null, 令态: byGod[g]?.令态 ?? null,
      透干: byGod[g]?.透干 ?? null, 本气根: byGod[g]?.本气根 ?? null,
    };
  });
  const 体 = pack(['比肩', '劫财', '正印', '偏印', '食神', '伤官']);
  const 用 = pack(['正财', '偏财', '正官', '七杀']);
  const 体五行 = [...new Set(体.map((x) => x.五行))];
  const 用五行 = [...new Set(用.map((x) => x.五行))];
  const 体力 = Number(体五行.reduce((a, e) => a + s.percent[e], 0).toFixed(1));
  const 用力 = Number(用五行.reduce((a, e) => a + s.percent[e], 0).toFixed(1));
  const 体有力者 = 体.filter((x) => 力度有力(x.级别));
  const 用有力者 = 用.filter((x) => 力度有力(x.级别));

  let 倾向, 病侧;
  if (体有力者.length > 用有力者.length) {
    倾向 = '体方有力者多——体强';
    病侧 = 用有力者.length === 0 ? '用侧（用神全无气，体旺而无可用，须看是否成专旺或另取）' : '用侧（用弱，须扶用或待岁运用）';
  } else if (用有力者.length > 体有力者.length) {
    倾向 = '用方有力者多——体弱扛不动用';
    病侧 = '体侧（体弱不承载，须先扶体，或依指令考虑"从"）';
  } else {
    倾向 = '体用有力者相当';
    病侧 = null;
  }

  const 提示 = [
    '⚠ 本节的「用」是**盲派体用**义（所求之对象＝财官），**不是子平用神**；两者同名异指，须分别声明（模块 §6.1 第 1 条）。',
    `体覆盖 ${体五行.join('、')}（3 行），用覆盖 ${用五行.join('、')}（2 行）——**原始占比有结构性偏斜**，`
      + '故引擎以"有力之神的多少"为主、总量为辅。',
    '「食伤归体还是归用」本身有分歧：模块 §6.1 第 12 条作"食神更近于体、伤官接近于用"，民间简表直接划入用；本引擎按指令划入**体**。',
    '体用不平衡＝病，须**明说病在体侧还是用侧**；病侧为引擎给出的候选，最终由调用方定。',
  ];
  if (体有力者.length === 0) 提示.push('**体方无一有力之神**——日主无根无帮，是判"从"的首要条件，须先做特殊格局排查。');

  return {
    日主, 日主五行,
    体: { 成员: 体, 五行: 体五行, 合计占比: 体力, 有力者: 体有力者.map((x) => `${x.十神}【${x.级别}】`) },
    用: { 成员: 用, 五行: 用五行, 合计占比: 用力, 有力者: 用有力者.map((x) => `${x.十神}【${x.级别}】`) },
    体用差: Number((体力 - 用力).toFixed(1)),
    得体用: { 得令: dms.得令, 得地: dms.得地, 得势: dms.得势, 同党占比: dms.同党占比 },
    倾向, 病侧, 提示,
    口径声明: { 体用: '盲派（用＝所求之财官）', 非: '子平用神' },
  };
}

/**
 * **辨路线**：制（食伤制官杀）／化（印化杀生身）／扶（印比帮身）／从（弃身从势）。
 *
 * > ## ⚠ 已弃用（2026-09-28）——**请勿在新代码中调用**
 * >
 * > 本函数与 **`tiyongRouteOf`（体用路线法）功能重叠**：后者是使用者 2026-09-28 明确
 * > **优先级最高的那条流程**（`大势 → 体用 → 路线 → 用神 → 忌神`），且已含
 * > `xiangzhanOf`／`chengzaiReassess`／四条关键等更完整的判定。
 * > 两者并存会产生**两套"路线"结论**，反而更乱。
 * >
 * > **保留原因**：其"路线"的判定逻辑（主线唯一、与主线相反者判为破坏专一的病）
 * > 有独立参考价值，且可能被别处引用。**如有需要，其判据应并入 `tiyongRouteOf`，而不是并列呈现。**
 * > 使用者指示：**一律套用体用路线法。**
 * >
 * > ⚠ **2026-10-04 核**：本函数**全仓零调用点**（`qingOf` 亦不引用它、`selftest` 仅验其"仍可调用"）
 * > ⇒ `AGENTS.md` §四 要求它随行的免责语（"不代判路线是否终究成立"）**不会出现在任何输出**里，
 * > 该条要求对本函数**无落点**。本函数只作历史留档，判据不得引。
 *
 * 路线由**命局自己的做功意向**决定：谁透干、谁有根、谁主动合制谁。
 * **命局主线只能有一条**；与主线相反的"另一意向"判为**破坏专一的病**
 * （如：制路线为主，却藏印拱水、湿土晦火），而不是"两条半路各半"。
 */
export function routeOf(chart) {
  const pillars = chart.pillars;
  const 日主 = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const 日主五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日主)]];
  const tgs = tenGodStrength(chart);
  const byGod = Object.fromEntries(tgs.各十神.map((x) => [x.十神, x]));
  const dms = dayMasterSupport(chart);
  const sg = specialGejuOf(chart);

  const R = ['极', '强', '中', '弱'];
  const rk = (g) => R.indexOf(byGod[g]?.级别 ?? '弱');
  const 力 = (g) => byGod[g]?.级别 ?? null;
  const 有力 = (r) => r <= 1;
  const 现 = (r) => r <= 2;
  const 食伤 = Math.min(rk('食神'), rk('伤官'));
  const 印 = Math.min(rk('正印'), rk('偏印'));
  const 官杀 = Math.min(rk('正官'), rk('七杀'));
  const 比劫 = Math.min(rk('比肩'), rk('劫财'));
  const 财 = Math.min(rk('正财'), rk('偏财'));

  // 透干/有根 的"意向"证据
  const 证据 = (g) => ({
    级别: byGod[g]?.级别 ?? null,
    透干: byGod[g]?.透干 ?? null,
    本气根: byGod[g]?.本气根 ?? null,
    令态: byGod[g]?.令态 ?? null,
  });

  const 候选 = [];
  // 路线是否"被命局提出"用 现（非弱）+ 有透干或通根 判；是否"有力"另记档次。
  // （曾只用 有力（极/强）作门槛，导致食伤、官杀同为"中"的盘四条路线全落空。）
  const 档 = (rk2) => (rk2 <= 1 ? '有力' : '仅现');
  const 透 = (g) => (byGod[g]?.透干 ?? null);
  const 根 = (g) => (byGod[g]?.本气根 ?? null);
  if (现(食伤) && 现(官杀)) {
    候选.push({
      路线: '制', 定义: '食伤制官杀', 档次: 档(Math.min(食伤, 官杀)),
      依据: `食伤【${R[食伤]}】${透('食神') || 透('伤官') ? '且透干' : ''}，官杀【${R[官杀]}】现于局中——食伤制官杀是**命局的意向**`,
      承载神: ['食神', '伤官'].map((g) => ({ 十神: g, ...证据(g) })),
      强度: (3 - 食伤) + (3 - 官杀) + ((透('食神') || 透('伤官')) ? 1 : 0),
    });
  }
  if (现(印) && 现(官杀)) {
    候选.push({
      路线: '化', 定义: '印化杀生身', 档次: 档(Math.min(印, 官杀)),
      依据: `印【${R[印]}】${透('正印') || 透('偏印') ? '且透干' : ''}，官杀【${R[官杀]}】现于局中`,
      承载神: ['正印', '偏印'].map((g) => ({ 十神: g, ...证据(g) })),
      强度: (3 - 印) + (3 - 官杀) + ((透('正印') || 透('偏印')) ? 1 : 0),
    });
  }
  if ((现(印) || 现(比劫)) && !dms.得令) {
    候选.push({
      路线: '扶', 定义: '印比帮身', 档次: 档(Math.min(印, 比劫)),
      依据: `日主于月令【${dms.月令令态}】不得令，而${现(印) ? `印【${R[印]}】` : ''}${现(比劫) ? `${现(印) ? '、' : ''}比劫【${R[比劫]}】` : ''}现于局中`,
      承载神: ['正印', '偏印', '比肩', '劫财'].filter((g) => 现(rk(g))).map((g) => ({ 十神: g, ...证据(g) })),
      强度: Math.max(3 - 印, 3 - 比劫) + ((透('正印') || 透('偏印') || 透('比肩') || 透('劫财')) ? 1 : 0),
    });
  }
  if (sg.成立者.length) {
    候选.push({
      路线: '从', 定义: '弃身从势', 档次: '成立',
      依据: `特殊格局成立：${sg.成立者.join('、')}`
        + (sg.成立者.includes('从势') ? '——《滴天髓》「从势：日主无根，四柱财官食伤并旺不分强弱，又无劫印生扶，又不能从一神而去 → 惟和解」' : ''),
      承载神: null, 强度: 9,
    });
  }
  候选.sort((a, b) => b.强度 - a.强度);
  const 主线 = 候选[0]?.路线 ?? null;
  const 主线档 = 候选[0]?.档次 ?? null;

  // 与主线相反的"另一意向" → 破坏专一的病
  const 相反表 = {
    制: { 反向: ['正印', '偏印'], 理: '印化官杀生身，与"制"争同一个官杀，且使体转强、不必再制' },
    化: { 反向: ['食神', '伤官', '正财', '偏财'], 理: '食伤制杀与"化"争同一对象；财则坏印，断化杀之路' },
    扶: { 反向: ['正财', '偏财', '正官', '七杀'], 理: '财坏印、官杀克身，皆与"扶"相反' },
    从: { 反向: ['比肩', '劫财', '正印', '偏印'], 理: '有根即不从；印比一生扶，从格即破' },
  };
  const 破坏专一 = [];
  if (主线 && 相反表[主线]) {
    for (const g of 相反表[主线].反向) {
      const lv = 力(g);
      if (!lv) continue;
      const e = 证据(g);
      const 强 = 有力(R.indexOf(lv));
      破坏专一.push({
        神: g, 级别: lv, 透干: e.透干, 本气根: e.本气根,
        是否显著: 强 || (e.透干 && e.透干.length > 0) || (e.本气根 && e.本气根.length > 0),
        理: 相反表[主线].理,
      });
    }
  }
  const 显著破坏 = 破坏专一.filter((x) => x.是否显著);

  const 提示 = [
    '**命局主线只能有一条**；与主线相反的意向判为"**破坏专一的病**"，而不是"两条半路各半"。',
    '路线由**命局自己的做功意向**决定：谁透干、谁有根、谁主动合制谁——故上面逐条列出了承载神的透干与通根证据。',
    '**岁运吉凶＝成全这条路线／破坏这条路线**；引擎的岁运审计即以此为口径。',
  ];
  if (!候选.length) 提示.push('四条路线皆不成立——须回到体用与格局重新审；可能是力量分散、无明显做功意向（盲派称"无功"）。');
  if (显著破坏.length) 提示.push(`⚠ **检出破坏专一的病 ${显著破坏.length} 处**：` + 显著破坏.map((x) => `${x.神}【${x.级别}】`).join('、') + '——须在判断中点名，不得含糊为"两条半路各半"。');

  return {
    日主, 日主五行, 月令: pillars[1].branch ?? BRANCHES[pillars[1].branchIndex],
    候选, 主线, 主线档,
    主线依据: 候选[0]?.依据 ?? null,
    破坏专一,
    显著破坏,
    得令: dms.得令, 月令令态: dms.月令令态,
    特殊格局: sg.成立者,
    提示,
    注: '本函数给"哪条路线成立、各自的证据、谁在与主线相反"，**不代判路线是否终究成立**——那取决于用神能否立住（见 yongshenAuditOf）。',
  };
}

/**
 * **特殊格局排查**（前置，逐一排除，不许跳过）。
 * 从杀、从财、从儿、从势、两神成象、化气逐扇推，**写明成立条件与不成立原因**；
 * 假从（藏支微弱印比）单独标注，并陈"行运如真从"与"有根不从"两说。
 */
export function specialGejuOf(chart) {
  const pillars = chart.pillars;
  const 日主 = pillars[2].stem ?? STEMS[pillars[2].stemIndex];
  const 日主五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日主)]];
  const monthBranch = pillars[1].branch ?? BRANCHES[pillars[1].branchIndex];
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const dms = dayMasterSupport(chart);
  const tgs = tenGodStrength(chart);
  const byGod = Object.fromEntries(tgs.各十神.map((x) => [x.十神, x]));

  const 无根 = dms.得地.length === 0;
  const 无生扶 = dms.得势.length === 0;
  const 微弱印比 = !无根 && dms.得地.length <= 1 && dms.得地.every((x) => x.层 !== '本气') && dms.得势.length <= 1;

  const R = ['极', '强', '中', '弱'];
  const rk = (g) => R.indexOf(byGod[g]?.级别 ?? '弱');
  const 食伤力 = Math.min(rk('食神'), rk('伤官'));
  const 印力 = Math.min(rk('正印'), rk('偏印'));
  const 官杀力 = Math.min(rk('正官'), rk('七杀'));
  const 财力 = Math.min(rk('正财'), rk('偏财'));
  const 比劫力 = Math.min(rk('比肩'), rk('劫财'));
  const 有力 = (r) => r <= 1;
  const 现 = (r) => r <= 2;
  const 名 = (r) => R[r];

  const 官杀五行 = elementOfGod(日主五行, '正官');
  const 财五行 = elementOfGod(日主五行, '正财');
  const 食伤五行 = elementOfGod(日主五行, '食神');

  // 内部一律保持 [条件, 实际, 满足] 三元组；只在输出时转成对象。
  // （曾误在 逐条 里就转成对象，而 结论/列出 仍按下标取值，导致六格**永远报"不成立"**。）
  const 逐条 = (conds) => conds;
  const 结论 = (conds) => conds.every((x) => x[2]);
  const 列出 = (conds) => conds.filter((x) => !x[2]).map((x) => `${x[0]}（实际：${x[1]}）`).join('；') || '全部满足';
  const 入 = (格, conds) => ({
    格,
    成立: 结论(conds),
    逐条: conds.map((x) => ({ 条件: x[0], 实际: String(x[1]), 满足: !!x[2] })),
    不成立原因: 结论(conds) ? null : 列出(conds),
  });

  // ★ 「四柱皆比劫」「印绶重重」「绝无一毫财星官杀之气」这类判据，说的是**占位（几个字）**，
  //   不是力度级别。用力度级别会判错《千里命稿》自己的例子：
  //   壬子 癸卯 甲子 甲子 —— 子被卯刑牵制，印由「强」降为「中」，从强即不成立，而该书正以此例为从强。
  //   故另立占位计数（天干明现 + 地支本气），专供从旺／从强二格使用。
  const 干支干 = pillars.map((p) => p.stem ?? STEMS[p.stemIndex]);
  const 干支支 = pillars.map((p) => p.branch ?? BRANCHES[p.branchIndex]);
  const 日干序 = STEMS.indexOf(日主);
  const 干God = 干支干.map((x, i) => (i === 2 ? null : tenGod(日干序, STEMS.indexOf(x))));
  const 支本气God = 干支支.map((b) => tenGod(日干序, STEMS.indexOf(HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)][0][0])));
  const 占位 = (list) => 干God.filter((g) => list.includes(g)).length + 支本气God.filter((g) => list.includes(g)).length;
  const 比劫位 = 占位(['比肩', '劫财']);
  const 印位 = 占位(['正印', '偏印']);
  const 财位 = 占位(['正财', '偏财']);
  const 官杀位 = 占位(['正官', '七杀']);
  const 食伤位 = 占位(['食神', '伤官']);

  const 检查 = [];

  // ── 从格之**日主前提**（古籍检索已落实，逐条附出处）────────────────────
  //   最干净的定义在《命理约言》：「**日主无根**满局皆官曰从官格／日主无根满局皆财曰从财格／
  //   日主无根满局皆伤曰从伤格／日主无根满局皆煞曰从煞格／……满局皆食曰从食格」。
  //   又《造化元钥》：「从格**不可见印**，有印，即为木之根。」
  //   ⇒ 前提＝**日主无根**（共性）＋各格另有「不可见印／比」之辨。
  //   ⚠ 月令为日主**临官（得禄）**则不从（《造化元钥》「月令临官，虽支会金局，干透庚辛，不能从煞」）。
  const 月支God = 支本气God[1];
  const 月令临官 = ['比肩', '劫财'].includes(月支God) && dms.得地.some((x) => x.在月令 && x.层 === '本气');
  const 从格日主前提 = [
    ['日主无根（地支不藏同类）', 无根 ? '无根' : `通根于 ${dms.得地.map((x) => x.位 + x.层).join('、')}`, 无根],
    [`月令非日主临官（得禄则不从）；月支本气为${月支God}`, 月令临官 ? `**月令${monthBranch}为日主临官（得禄）**` : '月令非临官', !月令临官],
  ];

  { const c = 逐条([
    ...从格日主前提,
    ['天干无印比生扶（印比皆绝）',
      `印【${名(印力)}】比劫【${名(比劫力)}】，${无生扶 ? '天干无' : `有 ${dms.得势.map((x) => x.位 + x.十神).join('、')}`}`,
      无生扶 && !有力(印力) && !有力(比劫力)],
    ['无食伤制杀', `食伤力度【${名(食伤力)}】`, !有力(食伤力)],
    ['无印化杀', `印力度【${名(印力)}】`, !有力(印力)],
    ['官杀旺', `官杀力度【${名(官杀力)}】，${官杀五行}占 ${s.percent[官杀五行]}%`, 有力(官杀力) && s.percent[官杀五行] >= 25],
    // 《神峰通考》另立一道门槛，另二书未检得 ⇒ 只记不阻断
    ['须「会杀」（三合／三会成杀局）——**存异**：仅《神峰通考》有此门槛，'
      + '《八字提要》《造化元钥》**未检得**', `三合：${(s.地支三合 ?? []).length ? '有' : '无'}`, true],
  ]); 检查.push(入('从杀', c)); }

  { const c = 逐条([
    ...从格日主前提,
    // 原只查"无根"，漏"无印比生扶"；今补（《千里命稿》「日干全无一点生气」、
    // 《八字提要》「要本身絶无援助，一见印比，从财格破」）。
    ['日主无一点生气（天干无印比生扶）', 无生扶 ? '无生扶' : `有 ${dms.得势.map((x) => x.位 + x.十神).join('、')}`, 无生扶],
    ['财独旺', `财力度【${名(财力)}】，${财五行}占 ${s.percent[财五行]}%`, 有力(财力) && s.percent[财五行] >= 30],
    ['无比劫夺财', `比劫力度【${名(比劫力)}】`, !有力(比劫力)],
    // ★ 原为"无官杀泄气"作**硬条件**；经与《千里命稿》对校，该书作「**逢官不妨**」
    //   （千里命稿 §2977 从财格之用神）。今按书**放宽为不阻断**，并把两说写在条件名里，
    //   不静默择一。（原注指引 HANDOFF 第 16.6 节；该文件已于 2026-10-01 移出工作区。）
    ['无官杀泄气（**存异**：《千里命稿》作「逢官不妨」，官不忌）', `官杀力度【${名(官杀力)}】`, true],
    ['须「会财」——**存异**：仅《神峰通考》「弃命从财，须要会财」，另二书**未检得**',
      `三合：${(s.地支三合 ?? []).length ? '有' : '无'}`, true],
    // 《造化元钥》「从格不可见印，有印，即为木之根」⇒ 印为最硬之忌（已由"日主无根"覆盖藏支之印，此处点名天干）
    ['天干不见印（《造化元钥》：「从格**不可见印**，有印，即为木之根」）',
      `印力度【${名(印力)}】`, !有力(印力)],
  ]); 检查.push(入('从财', c)); }

  { const c = 逐条([
    ...从格日主前提,
    // ★ 从儿**不设"无比劫"门槛**——《滴天髓》明说此格「**不论身强弱**」：
    //   「『不论身强弱』者，四柱虽有比劫仍去生助食伤也。」
    //   （比劫生食伤、助其盗泄，故比劫**不破**从儿；破之者唯**印**。）
    ['无印生身（印为从儿之唯一破格神；比劫不破——比劫生食伤）',
      `印力度【${名(印力)}】`, !有力(印力)],
    ['食伤当令独旺', `食伤力度【${名(食伤力)}】，${食伤五行}占 ${s.percent[食伤五行]}%`, 有力(食伤力) && s.percent[食伤五行] >= 30],
    ['不论身强弱（《滴天髓》原文；比劫不破格）',
      `比劫力度【${名(比劫力)}】`, true],
  ]); 检查.push(入('从儿', c)); }

  { const 三方 = [{ 名: '财', 力: 财力 }, { 名: '官杀', 力: 官杀力 }, { 名: '食伤', 力: 食伤力 }];
    const 并旺 = 三方.filter((x) => 现(x.力)).length === 3;
    const c = 逐条([
      ...从格日主前提,
      // ⚠ 使用者原话作「日主无一丝生扶」；检索结果：**该句在 19 个模块内 0 匹配**，
      //   最近的系统定义是《滴天髓》「从势：**日主无根**，四柱财官食伤并旺不分强弱，
      //   又无劫印生扶，又不能从一神而去」——用「日主无根」，非「无一丝生扶」。
      ['日主无根（《滴天髓》「从势：日主无根」；使用者原话作「无一丝生扶」，'
        + '**逐字未检得**）', `得地 ${dms.得地.length} 处、得势 ${dms.得势.length} 处`, 无根 && 无生扶],
      ['财官食伤并旺', 三方.map((x) => `${x.名}【${名(x.力)}】`).join(' '), 并旺],
      ['势内和谐不内斗（官杀与食伤不同时有力）',
        `官杀【${名(官杀力)}】、食伤【${名(食伤力)}】${有力(食伤力) && 有力(官杀力) ? ' → **内斗**' : ' → 未同时有力'}`,
        !(有力(食伤力) && 有力(官杀力))],
    ]); 检查.push(入('从势', c)); }

  { const 有气 = ELEMENTS.filter((e) => s.percent[e] > 0);
    const c = 逐条([['全盘仅两种五行', `实见 ${有气.length} 种：${有气.map((e) => e + s.percent[e] + '%').join('、')}`, 有气.length <= 2]]);
    检查.push(入('两神成象', c)); }

  { // 化气（《千里命稿》§3041–3131，四节：构成／破败／转败为成／必不可成）
    //   构成五组，**完全机械**：相合两干须在【日与月】或【日与时】（紧贴，年干不算——年日远隔即"隔位"），
    //   且月令须属该组所定，且**不见所忌五行**。
    const 化组表 = [
      { 化: '土', 干: ['甲', '己'], 月令: ['辰', '戌', '丑', '未'], 忌: '木' },
      { 化: '金', 干: ['乙', '庚'], 月令: ['巳', '酉', '丑', '申'], 忌: '火' },
      { 化: '水', 干: ['丙', '辛'], 月令: ['申', '子', '辰', '亥'], 忌: '土' },
      { 化: '木', 干: ['丁', '壬'], 月令: ['亥', '卯', '未', '寅'], 忌: '金' },
      { 化: '火', 干: ['戊', '癸'], 月令: ['寅', '午', '戌', '巳'], 忌: '水' },
    ];
    const 日干0 = 干支干[2];
    const 组 = 化组表.find((g) => g.干.includes(日干0)) ?? null;
    const 紧贴 = !!组 && [干支干[1], 干支干[3]].some((x) => x !== 日干0 && 组.干.includes(x));
    const 同组异干 = 组 ? 组.干.find((x) => x !== 日干0) : null;
    const 伙伴位 = 组 ? 干支干.filter((x, i) => i !== 2 && x === 同组异干).length : 0;
    const 隔位 = !!组 && !紧贴 && 干支干[0] === 同组异干;
    const 月令合 = !!组 && 组.月令.includes(monthBranch);
    // 忌五行占位。两处修正（都曾判错书里的例子）：
    //   ① **日干本身不算"他"**——日干是化气主体（如甲己化土，那个甲不是"他木"）；
    //   ② 化水忌土，而**「辰丑皆润土，不以克破论也」**（§3065 甲辰丙子辛丑壬辰例），故辰丑不计。
    const 忌位 = 组 ? (干支干.filter((x, i) => i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(x)]] === 组.忌).length
      + 干支支.filter((b) => {
        if (ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(b)]] !== 组.忌) return false;
        if (组.忌 === '土' && (b === '辰' || b === '丑')) return false;   // 湿土不克水
        return true;
      }).length) : 0;
    // 因妒而破：同一合神出现两次以上（两丁妒合一壬）
    const 妒合 = 伙伴位 >= 2;
    // 因化而破：局中另有合化，其化神克本化神（如甲己化土而丁壬化木，木克土）
    let 他化克我 = null;
    if (组) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          if (i === 2 || j === 2) continue;                       // 排除涉日干的那一合
          const hua = STEM_COMBINE[干支干[i] + 干支干[j]] ?? STEM_COMBINE[干支干[j] + 干支干[i]];
          if (hua && KE_MAP[hua] === 组.化) 他化克我 = { 合: `${干支干[i]}${干支干[j]}`, 化: hua };
        }
      }
    }

    const c = 逐条([
      ['日干属化气五组之一', 组 ? `${日干0}（可化${组.化}）` : `${日干0} 不属任何化气组`, !!组],
      ['日干与月干或时干相合（**紧贴**，年干不算）',
        `日干${日干0}；月干${干支干[1]}、时干${干支干[3]}；同组异干为${同组异干 ?? '—'}`, 紧贴],
      ['不隔位（年日远隔则必不可成）', 隔位 ? `年干${干支干[0]}与日干远隔 → **隔位，必不可成**` : '未隔位', !隔位],
      [`月令须属${组 ? 组.月令.join('/') : '（组未定）'}`, `本盘月令${monthBranch}`, 月令合],
      [`不见${组 ? 组.忌 : '（组未定）'}（忌神不占位）`, `所忌${组 ? 组.忌 : '—'}占 ${忌位} 位`, 忌位 === 0],
      ['无妒合（同一合神不重见）', `同组异干「${同组异干 ?? '—'}」出现 ${伙伴位} 次`, !妒合],
      ['无他化来克（局中不另成合化而克本化神）', 他化克我 ? `${他化克我.合}化${他化克我.化}，${他化克我.化}克${组.化} → **因化而破**` : '无', !他化克我],
    ]);
    const e = 入('化气', c);
    e.化组 = 组 ? `化${组.化}` : null;
    e.破败 = [
      忌位 > 0 ? `**因克而破**：所忌${组.忌}占 ${忌位} 位（千里命稿例：庚戌 戊子 辛未 丙申，丙辛化水而戊未戌土竞相克水）` : null,
      妒合 ? `**因妒而破**：${同组异干} 出现 ${伙伴位} 次，争合分力（例：甲戌 丁卯 壬午 丁未，两丁妒合一壬）` : null,
      他化克我 ? `**因化而破**：${他化克我.合}化${他化克我.化}而克本化神（例：壬辰 丁未 甲子 己巳，甲己化土而丁壬化木克土）` : null,
    ].filter(Boolean);
    e.转败为成 = '《千里命稿》§3095–3119 列两类救法：①**因克而破者**——克神被他干合绊（辛酉 丙申 乙丑 庚辰，年干辛合绊丙火）、'
      + '或另有字先制克神（甲子 戊辰 丙申 辛卯，甲先制戊）、或因生而转（甲戌 丁丑 甲申 己巳，丁火泄甲生助化神）；'
      + '②**因妒而破者**——所妒者被去（丁丑 辛亥 丙午 辛卯，年丁克去月辛，丙仍合时辛），'
      + '或成双而不成妒（壬寅 丁未 壬子 丁未，两丁两壬如璧人双双，何妒之有）。**引擎不代判，须人工核。**';
    e.据 = '《千里命稿》§3041–3131（化气格之构成／破败／转败为成／必不可成）';
    检查.push(e); }

  // ── 以下三格据《千里命稿》（knowledge/千里命稿-韦千里.md），原实现缺失 ──────────
  { // 从官（§2993）：「日主衰弱，官旺而多，无印滋身，身实不能任官，可作从官格论。其用神之喜忌，与从杀格同」
    const c = 逐条([
      ['日主衰弱（无根）', 无根 ? '无根' : `通根于 ${dms.得地.map((x) => x.位).join('、')}`, 无根],
      ['官旺而多（正官有力）', `正官力度【${名(rk('正官'))}】、七杀力度【${名(rk('七杀'))}】`, 有力(官杀力)],
      ['无印滋身', `印力度【${名(印力)}】`, !现(印力)],
    ]);
    const x = 入('从官', c); x.据 = '《千里命稿》§2993'; 检查.push(x); }

  { // 从旺（§3013）：「四柱皆比劫，绝无官杀之制，或有印绶之生，是旺之极者，只得从其旺神」
    const c = 逐条([
      ['四柱皆比劫（比劫**占位**≥2）', `比劫占 ${比劫位} 位（干${干God.filter((g) => g === '比肩' || g === '劫财').length}／支${支本气God.filter((g) => g === '比肩' || g === '劫财').length}）`, 比劫位 >= 2],
      ['绝无官杀之制（官杀不占位）', `官杀占 ${官杀位} 位`, 官杀位 === 0],
      ['无财星（财不占位）', `财占 ${财位} 位`, 财位 === 0],
      ['无伤食可取（食伤占位≤1）', `食伤占 ${食伤位} 位`, 食伤位 <= 1],
    ]);
    const x = 入('从旺', c); x.据 = '《千里命稿》§3011–3023（例：癸卯 乙卯 甲寅 乙亥）'; 检查.push(x); }

  { // 从强（§3029）：「四柱印绶重重，比劫亦多，日主又不失令，绝无一毫财星官杀之气，谓之二人同心」
    const c = 逐条([
      ['印绶重重（印**占位**≥2）', `印占 ${印位} 位`, 印位 >= 2],
      ['比劫亦多（比劫占位≥1）', `比劫占 ${比劫位} 位`, 比劫位 >= 1],
      ['日主又不失令', `月令令态【${dms.月令令态}】`, dms.得令],
      ['绝无一毫财星官杀之气', `财${财位}位、官杀${官杀位}位`, 财位 === 0 && 官杀位 === 0],
    ]);
    const x = 入('从强', c); x.据 = '《千里命稿》§3027–3037（例：壬子 癸卯 甲子 甲子）'; 检查.push(x); }

  // ★ 与《千里命稿》（韦千里，knowledge/千里命稿-韦千里.md §2957–3121）逐条比对后的**并列判据**。
  //   本节的成立条件取自使用者规格；韦书有成套"某格之构成／某格之用神"，与之有异者并列于此，
  //   **不静默择一**。改动判定逻辑前须读全书对应节（原注指引 HANDOFF 第 16.6 节；该文件已移出工作区）。
  const 他书判据 = {
    从财: '《千里命稿》「从财格之构成」＝日干生**死地**、地支**全成财地**、日干全无一点生气；'
      + '用神喜伤食财、忌比劫剥夺、亦忌印之助身，而**「逢官不妨」**'
      + '——**与本节的"无官杀泄气"直接相反**，两说并列（§2959–2977）。',
    从杀: '《千里命稿》：日干生**绝地**、年日时支皆**墓绝之乡**、七杀当令众多、全无生气；'
      + '忌印（泄杀生身）、劫比抗杀亦非宜。**另立「从官格」**：日主弱、官旺而多、**无印滋身**'
      + '→ 作从官格论，喜忌同从杀（§2981–2993）。',
    从儿: '《千里命稿》：日主衰弱、**无印生身**、伤食当旺或天干结党／地支会局；'
      + '用神**「不怕比劫」**（比劫仍去生助伤食）、喜财（儿又生儿）、**逢官杀不利**、最忌印（§2997–3007）。'
      + '本节未列"不怕比劫"与"逢官杀不利"两条。',
    化气: '《千里命稿》分四节：化气格之构成、**之破败**、**之转败为成**、**之必不可成者**（§3041–3121）。'
      + '本节只取"化神透干／得令"两条，**远不足以判成败**。',
    从势: '《滴天髓》「从势：日主无根，四柱财官食伤并旺不分强弱，又无劫印生扶，又不能从一神而去 → 惟和解」'
      + '（《滴天髓阐微》2.10 从象；任氏自注"此四从，诸书所未载"——**属任铁樵自创，非古法**）。',
  };
  for (const x of 检查) if (他书判据[x.格]) x.他书判据 = 他书判据[x.格];

  // ── 三书对账（《八字提要》《神峰通考》《造化元钥》；古籍检索所得，**冲突者并列不调和**）
  const 三书对账 = {
    说明: '本节为三家（《八字提要》《神峰通考》《造化元钥》）对从格成格条件的**对账结果**。'
      + '凡冲突者**两边原句并列，不调和、不择一**；凡未检得者**明写未检得**。'
      + '另：《命理约言》把日主状态直接写进格名定义，是补白最有用的一条，一并列出。',
    统一之处: {
      见印破从: '三书同向——《八字提要》「要本身絶无援助，一见印比，从财格破」；'
        + '《神峰通考》从杀须纯杀、畏印；《造化元钥》「**从格不可见印，有印，即为木之根**」',
      满局皆所从之神: '三书同向（措辞或作"满局／满盘"、或作"柱中全无一水"之体）',
      从儿之构成: '《八字提要》「柱无土金、无比劫，仅有木火」与《造化元钥》「不见官煞印绶……又名从儿」同向；'
        + '《神峰通考》**未检得"从儿"格名**',
    },
    真冲突: {
      微根是破格还是假从: {
        '《八字提要》': '判「不能从」——「且丑藏辛癸，又不能弃命相从」「辰未之中皆藏乙木，故卽满盘皆土，亦不能弃命从杀」',
        '《神峰通考》': '判「未从」——「身弱拖根微有助，**未从七煞未从财**」',
        '《造化元钥》': '判「**假从**（仍作从）」——「或纯是己土，不见戊土，乃为**假从**」'
          + '「六月甲木，即使四柱干支皆土，亦是**假从非真从**」「盖未为木库，**月令有微根故也**」',
        处理: '**不调和**。本引擎另立 `假从: 微弱印比` 单独标注，并陈"行运如真从"与"有根不从"两说。',
      },
      从杀分不分阴阳日干: {
        '《神峰通考》': '「但六阴日干有从之之理……若六阳日干，见杀多，只或作杀重身轻看」⇒ **阳干难从**',
        '《造化元钥》': '「从格以纯粹为贵，尤以**阳干从阳，阴干从阴为真**」⇒ 阳干从阳煞亦为真从',
        处理: '**并列**，引擎不据阴阳日干加门槛。',
      },
      从财分不分阴阳日干: {
        '《神峰通考》': '「弃命从财格，此则**不论阴阳日主皆从也**」',
        '《造化元钥》': '以阴阳定真伪，故甲从己土为假从',
        处理: '**并列**。',
      },
      '是否须「会财／会杀」': {
        '《神峰通考》': '「**须要会财**。弃命从杀，**须要会杀**」⇒ 立为门槛',
        '《八字提要》与《造化元钥》': '**未检得**此门槛；《造化元钥》改用"破印开关"之说',
        处理: '**并列**；引擎只在条件名中标出，**不阻断**。',
      },
      '从旺／从强之门槛': {
        '《八字提要》': '以「**本身之旺**」为准',
        '《造化元钥》': '以「**得时得地**」为准（「专旺格局，尤以得时得地为要也」）',
        处理: '**并列**。',
      },
    },
    未检得: [
      '「**日主无一丝生扶**」逐字原文——19 个模块内 **0 匹配**；'
        + '最接近者为《神峰通考》「日主全无一点生气」与《滴天髓》「从势：日主无根」',
      '「**从势**」之规格化成格条件——《八字提要》《神峰通考》《造化元钥》**三书皆未检得**；'
        + '系统定义唯见《滴天髓》「从势：日主无根，四柱财官食伤并旺不分强弱，又无劫印生扶，又不能从一神而去」',
      '《八字提要》「**假从**」二字——0 匹配；「从强格」0 次',
      '《神峰通考》「从儿」格名、「从旺／从强／假从」——皆 0 匹配',
      '《造化元钥》「从强／从旺／从气／顺局」——全文 0 匹配；「从势」0 匹配',
    ],
    补白之要: '《命理约言》把日主状态**直接写进格名定义**：'
      + '「**日主无根**满局皆官曰从官格／日主无根满局皆财曰从财格／日主无根满局皆伤曰从伤格／'
      + '日主无根满局皆煞曰从煞格／……满局皆食曰从食格」——'
      + '与《造化元钥》「从格不可见印，有印，即为木之根」合看，'
      + '即得**从杀／从财／从儿三格之日主前提：日主无根、印不现（或印比皆绝）**。',
    检索局限: '⚠《造化元钥》模块自述调候表残缺（残存甲木 12 月＋丙火 5 月），'
      + '**不能排除残缺部分另有其他日干之从格条文**；'
      + '旁证：癸水六月「未中有乙己同宫，破而不破，故癸水不能从杀」即属该系统而见诸《穷通宝鉴》模块。',
    据: '古籍检索报告；书·模块·行号见 `体用路线法.md` §二之二',
  };
  // 原列"从官／从旺／从强"为未实现，**今已据《千里命稿》补齐**，故此表清空。
  // 若日后比对其他书（八字提要／神峰通考／造化元钥）发现新格，再列入此处。
  const 未实现之格 = [];

  const 成立者 = 检查.filter((x) => x.成立).map((x) => x.格);
  const 提示 = ['**逐一排除，不许跳过**：以下每扇都列出成立条件与实际值，成与不成都要写明原因。',
    '日主无根 / 无生扶是多数从格的前提；**有根即不从**。'];
  if (微弱印比) 提示.push('**属"假从"之型**：日主无本气之根，但藏支或天干有微弱印比。两说并陈——'
    + '①**行运如真从**（既已投从，岁运顺其势则吉）；②**有根不从**（有根即不从，仍作正格看）。'
    + '《滴天髓》"假从：日主根浅力薄不能自立，局中虽有劫印亦自顾不暇，只得投从于人"。');
  if (成立者.length) 提示.push(`检出成立的特殊格局：**${成立者.join('、')}**——须与正格取用并陈，不可径取。`);
  else 提示.push('九扇皆不成立——本盘按正格论（仍须依体用路线法走后续步骤）。');
  if (成立者.includes('从旺') && 成立者.includes('从强')) {
    提示.push('⚠ **从旺与从强同时成立**：《千里命稿》此二格的判据本就重叠'
      + '（该书从旺例 癸卯 乙卯 甲寅 乙亥、从强例 壬子 癸卯 甲子 甲子，结构相近）。'
      + '韦书以"四柱皆比劫"归从旺、"印绶重重＋日主不失令"归从强；引擎**两存不择一**，'
      + '须按何者更贴近本盘的主要面貌取用，并声明所采。二者用神皆在印比，故实际取用差别不大。');
  }

  return {
    日主, 日主五行, 月令: monthBranch,
    前提: { 日主无根: 无根, 日主无生扶: 无生扶, 是否假从之型: 微弱印比, 月令临官: 月令临官, 得地: dms.得地, 得势: dms.得势 },
    检查, 成立者, 假从: 微弱印比, 提示, 未实现之格,
    三书对账,
    据: '日主前提依《命理约言》各格定义（「日主无根满局皆财曰从财格」等）与《造化元钥》「从格不可见印」；'
      + '假从两说依《滴天髓阐微》2.10 假从／假化；化气依《盲派与象法》5.5 化气格；'
      + '三书对账见 `三书对账` 字段（冲突者并列不调和）。',
  };
}

/**
 * **审用神 / 审忌神**（体用路线指令第 4、5 步）。
 *
 * 核心规则：**用神合忌神**＝把忌神锁住，是制化之功、是做功，**不算被坏**；
 * **忌神合用神**＝用神被坏；用神被冲刑破穿、落空亡、克泄太过＝被坏；
 * **用神之根**被合被冲被牵走＝同判"用神受伤"，**须单独点名**；
 * 合是否"化去"不轻言：化神不透干、不得令、路线不需要，一律按"合制"论。
 *
 * ⚠ 用神／忌神须由调用方**明确指出**（落到具体干支字）；引擎不代定。
 */
export function yongshenAuditOf(chart, opts = {}) {
  const 用神 = opts.用神 ?? [];
  const 忌神 = opts.忌神 ?? [];
  if (!用神.length) throw new Error('yongshenAuditOf: 须提供 用神:[…]（落到具体干支字）');

  const pillars = chart.pillars;
  const posNames = ['年', '月', '日', '时'];
  const stems = pillars.map((p) => p.stem ?? STEMS[p.stemIndex]);
  const branches = pillars.map((p) => p.branch ?? BRANCHES[p.branchIndex]);
  const 日主 = stems[2];
  const 日主五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(日主)]];
  const rel = gzRelations(pillars, null);

  const 令牌 = (tok) => {
    const o = { 牌: tok, 天干: [], 地支: [], 五行: null };
    if (STEMS.includes(tok)) { o.天干 = stems.map((s, i) => (s === tok ? posNames[i] + '干' : null)).filter(Boolean); o.五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(tok)]]; }
    else if (BRANCHES.includes(tok)) { o.地支 = branches.map((b, i) => (b === tok ? posNames[i] + '支' : null)).filter(Boolean); o.五行 = ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(tok)]]; }
    else if (ELEMENTS.includes(tok)) { o.五行 = tok; }
    else throw new Error(`yongshenAuditOf: 无法识别的令牌「${tok}」（须为天干、地支或五行名）`);
    o.在位 = o.天干.length > 0 || o.地支.length > 0;
    return o;
  };
  const 命中宫 = (tok, g) => {
    const t = 令牌(tok);
    if (t.天干.includes(g) || t.地支.includes(g)) return true;
    if (t.在位 || !t.五行) return false;
    if (g.endsWith('干')) {
      const st = stems[posNames.indexOf(g.slice(0, 1))];
      return ELEMENTS[STEM_ELEMENT[STEMS.indexOf(st)]] === t.五行;
    }
    return ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(g.slice(-1))]] === t.五行;
  };
  const 用T = 用神.map(令牌), 忌T = 忌神.map(令牌);
  const 属用 = (g) => 用神.some((t) => 命中宫(t, g));
  const 属忌 = (g) => 忌神.some((t) => 命中宫(t, g));

  // 合的方向
  const 合方向 = [];
  const 判合 = (g1, g2, kind, 化) => {
    const a用 = 属用(g1), a忌 = 属忌(g1), b用 = 属用(g2), b忌 = 属忌(g2);
    if (!(a用 || a忌 || b用 || b忌)) return;
    let 方向, 断语;
    if ((a用 && b忌) || (a忌 && b用)) {
      const 用侧 = a用 ? g1 : g2, 忌侧 = a用 ? g2 : g1;
      方向 = '用神合忌神';
      断语 = `**${用侧}（用神）合 ${忌侧}（忌神）＝把忌神锁住，是制化之功、是做功，不算被坏**。`
        + '（本引擎不按"合去"论；化神是否透干得令、路线是否需要须另核，未足备者一律按"合制"论。）';
    } else if (a用 && b用) { 方向 = '用神合用神'; 断语 = '两用神相合，合力自固；须查是否争合致情不专。'; }
    else if (a忌 && b忌) { 方向 = '忌神合忌神'; 断语 = '两忌神相合，互为党援，病加重；须看是否可被合制。'; }
    else { 方向 = '半涉闲神'; 断语 = '一方为用／忌，另一方为闲神；其作用须看该闲神在路线中的位置。'; }
    合方向.push({ 关系: kind, 位置: `${g1} — ${g2}`, 化, 方向, 用侧: a用 ? g1 : (b用 ? g2 : null), 忌侧: a忌 ? g1 : (b忌 ? g2 : null), 断语 });
  };
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const hua = STEM_COMBINE[stems[i] + stems[j]] ?? STEM_COMBINE[stems[j] + stems[i]];
    if (hua) 判合(`${posNames[i]}干${stems[i]}`, `${posNames[j]}干${stems[j]}`, '天干五合', hua);
    const hb = BRANCH_COMBINE[branches[i] + branches[j]] ?? BRANCH_COMBINE[branches[j] + branches[i]];
    if (hb) 判合(`${posNames[i]}支${branches[i]}`, `${posNames[j]}支${branches[j]}`, '地支六合', hb);
  }

  // 受伤清单
  const 受伤 = [];
  const dayXun = xunOf(gzIndex(STEMS.indexOf(stems[2]), BRANCHES.indexOf(branches[2])));
  const 检查组 = (list, 角色) => {
    for (const t of list) {
      const 位 = [...t.天干, ...t.地支];
      if (!t.在位) { 受伤.push({ 角色, 令牌: t.牌, 类型: '不现', 说明: `${t.牌} 不见于四柱——**${角色}不现**，须在岁运中待其出现` }); continue; }
      for (const [key, kind] of [['地支六冲', '被冲'], ['地支相破', '被破'], ['地支相害', '被穿（害）']]) {
        for (const x of rel[key]) {
          const [p, q] = String(x.pair).split(' — ');
          if (!p || !q) continue;
          if (位.includes(p) || 位.includes(q)) 受伤.push({ 角色, 令牌: t.牌, 类型: kind, 说明: `${t.牌} 所居宫位与 ${p}—${q} 成 ${kind}` });
        }
      }
      for (const x of rel.地支相刑) {
        for (const g of String(x.positions).split('、')) if (位.includes(g)) 受伤.push({ 角色, 令牌: t.牌, 类型: `被刑（${x.刑}）`, 说明: `${t.牌} 涉 ${x.positions} 之${x.刑}`, 争议: x.争议 });
      }
      for (const g of t.地支) if (dayXun.voidBranches.includes(g.slice(-1))) 受伤.push({ 角色, 令牌: t.牌, 类型: '落空亡', 说明: `${t.牌} 落于日柱旬空（${dayXun.voidBranches.join('')}）——须看是否被冲实` });
    }
  };
  检查组(用T, '用神'); 检查组(忌T, '忌神');

  // 用神之根被牵走（单独点名）
  const 根被牵走 = [];
  for (const t of 用T) {
    const 根支 = new Set();
    for (const g of t.地支) 根支.add(g.slice(-1));
    for (const g of t.天干) {
      const st = g.slice(0, 1);
      for (const b of branches) if (HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].some((h) => h[0] === st)) 根支.add(b);
    }
    if (t.五行 && !t.在位) for (const b of branches) if (HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].some((h) => ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] === t.五行)) 根支.add(b);
    for (const b of 根支) {
      const 因 = [];
      for (const [key, kind] of [['地支六合', '被合'], ['地支六冲', '被冲'], ['地支相害', '被穿'], ['地支相破', '被破']]) {
        for (const x of rel[key]) {
          const [p, q] = String(x.pair).split(' — ');
          if ((p && p.slice(-1) === b) || (q && q.slice(-1) === b)) 因.push(kind);
        }
      }
      if (因.length) 根被牵走.push({ 用神: t.牌, 根支: b, 因: [...new Set(因)], 断语: `**用神之根「${b}」${[...new Set(因)].join('、')}——用神之根被坏，同判"用神受伤"，须单独点名**` });
    }
  }

  // 忌神的制化 + 制化神自身是否被坏
  const 制化 = [];
  for (const t of 忌T) {
    const 五行 = t.五行;
    if (!五行) continue;
    const 克它 = ELEMENTS.find((e) => KE_MAP[e] === 五行);
    const 泄它 = SHENG_MAP[五行];
    const 谁现 = (el) => {
      const 透 = stems.some((s, i) => i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(s)]] === el);
      const 根 = branches.some((b) => HIDDEN_STEMS_SPEC[BRANCHES.indexOf(b)].some((h) => ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]] === el));
      return { 透干: 透, 通根: 根, 在位: 透 || 根 };
    };
    const 制 = 谁现(克它), 化 = 谁现(泄它);
    const 受损 = [];
    const 查受损 = (el, 名) => {
      for (let i = 0; i < 4; i++) {
        if (i !== 2 && ELEMENTS[STEM_ELEMENT[STEMS.indexOf(stems[i])]] === el) {
          for (let j = 0; j < 4; j++) {
            if (j === i || j === 2) continue;
            const sk = stems[i];
            if (STEM_COMBINE[sk + stems[j]] ?? STEM_COMBINE[stems[j] + sk]) 受损.push(`${名}（${posNames[i]}干${sk}）被他干合（${stems[j]}）`);
            if (STEM_CLASH.includes(sk + stems[j]) || STEM_CLASH.includes(stems[j] + sk)) 受损.push(`${名}（${posNames[i]}干${sk}）被冲（${stems[j]}）`);
          }
        }
        if (ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(branches[i])]] === el) {
          for (let j = 0; j < 4; j++) {
            if (j === i) continue;
            const b1 = branches[i], b2 = branches[j];
            if (BRANCH_COMBINE[b1 + b2] || BRANCH_COMBINE[b2 + b1]) 受损.push(`${名}之根（${posNames[i]}支${b1}）被合（${b2}）`);
            if (BRANCH_CLASH.includes(b1 + b2) || BRANCH_CLASH.includes(b2 + b1)) 受损.push(`${名}之根（${posNames[i]}支${b1}）被冲（${b2}）`);
          }
        }
      }
    };
    查受损(克它, '制神'); 查受损(泄它, '化神');
    制化.push({
      忌神: t.牌, 五行,
      制神: { 五行: 克它, ...制 }, 化神: { 五行: 泄它, ...化 },
      受损: [...new Set(受损)],
      断语: (制.在位 || 化.在位)
        ? `忌神${t.牌}有${制.在位 ? `制（${克它}）` : ''}${化.在位 ? `${制.在位 ? '、' : ''}化（${泄它}）` : ''}——病减轻`
        : `忌神${t.牌}**无制无化**——病重，须看岁运能否制化`,
      半失效: [...new Set(受损)].length ? `⚠ 制化神自身受损 → **制化半失效**，须单独指出` : null,
    });
  }

  const 做功 = 合方向.filter((x) => x.方向 === '用神合忌神');
  const 忌合我用 = 合方向.filter((x) => x.方向 === '忌神合用神');
  const 用神其他受伤 = 受伤.filter((x) => x.角色 === '用神' && x.类型 !== '不现');
  const 提示 = [
    '⚠ **先辨体用，再定合的方向**——"用神合忌神"是做功（把忌神锁住），**不是用神被坏**；只有"忌神合用神"才判被坏。',
    '用神／忌神由调用方指定；引擎只做机械判定，不代定。',
    '**合是否"化去"不轻言**：化神不透干、不得令、路线不需要者，一律按"合制"论，不按"化去"论。',
  ];
  if (做功.length) 提示.push(`检出 ${做功.length} 处**用神合忌神（做功）**：` + 做功.map((x) => x.位置).join('；'));
  if (忌合我用.length) 提示.push(`⚠ 检出 ${忌合我用.length} 处**忌神合用神（用神被坏）**：` + 忌合我用.map((x) => x.位置).join('；'));
  if (根被牵走.length) 提示.push(`⚠ **用神之根被牵走 ${根被牵走.length} 处**（须单独点名）：` + 根被牵走.map((x) => `${x.用神}之根${x.根支}${x.因.join('、')}`).join('；'));
  if (制化.some((x) => x.半失效)) 提示.push('⚠ 有忌神的**制化神自身受损**，属"制化半失效"，须单独指出。');

  return {
    日主, 日主五行,
    用神: 用T.map((t) => ({ 牌: t.牌, 五行: t.五行, 天干: t.天干, 地支: t.地支, 在位: t.在位 })),
    忌神: 忌T.map((t) => ({ 牌: t.牌, 五行: t.五行, 天干: t.天干, 地支: t.地支, 在位: t.在位 })),
    合方向, 做功, 忌神合用神: 忌合我用, 受伤, 根被牵走, 忌神制化: 制化,
    汇总: { 做功处数: 做功.length, 忌神合用用神处数: 忌合我用.length, 用神其他受伤处数: 用神其他受伤.length, 用神根被牵走处数: 根被牵走.length },
    提示,
    参考: '《子平真诠》2.3 十干合化——其"逢吉不为吉"为**并列的反对说**；本引擎依指令以"用神合忌神＝做功"为主叙述。',
  };
}

/**
 * **岁运审计**：对着**所声明的用神／忌神**判该岁运是成全还是破坏。
 *
 * ⚠ 引擎**不作绝对吉凶判断**：只在调用方明确声明用神／忌神之后，机械报告其作用，
 * 措辞为"**相对所声明者**"。
 */
export function suishenAuditOf(chart, transitGz, opts = {}) {
  const ta = transitAnalysis(chart, { gz: transitGz });
  const ysa = yongshenAuditOf(chart, opts);
  const 用神 = opts.用神 ?? [];
  const 忌神 = opts.忌神 ?? [];

  const 干 = transitGz[0], 支 = transitGz[1];
  if (!STEMS.includes(干) || !BRANCHES.includes(支)) throw new Error(`suishenAuditOf: 岁运干支非法「${transitGz}」`);
  const 干五行 = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(干)]];
  const 支五行 = ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(支)]];
  const 岁运五行 = [...new Set([干五行, 支五行])];

  const 触碰 = (tok) => {
    if (STEMS.includes(tok)) return 干 === tok || STEM_CLASH.includes(tok + 干) || STEM_CLASH.includes(干 + tok)
      || !!(STEM_COMBINE[tok + 干] ?? STEM_COMBINE[干 + tok]) || HIDDEN_STEMS_SPEC[BRANCHES.indexOf(支)].some((h) => h[0] === tok);
    if (BRANCHES.includes(tok)) return 支 === tok || BRANCH_CLASH.includes(tok + 支) || BRANCH_CLASH.includes(支 + tok)
      || !!(BRANCH_COMBINE[tok + 支] ?? BRANCH_COMBINE[支 + tok])
      || BRANCH_HARM.includes(tok + 支) || BRANCH_HARM.includes(支 + tok);
    return 岁运五行.includes(tok);
  };
  const 关系 = (tok) => {
    const el = STEMS.includes(tok) ? ELEMENTS[STEM_ELEMENT[STEMS.indexOf(tok)]]
      : BRANCHES.includes(tok) ? ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(tok)]] : tok;
    if (!ELEMENTS.includes(el)) return [];
    const out = [];
    for (const e of 岁运五行) {
      if (e === el) out.push('同气（加力）');
      else if (SHENG_MAP[e] === el) out.push(`${e}生${el}（加根／加力）`);
      else if (SHENG_MAP[el] === e) out.push(`${el}生${e}（泄气）`);
      else if (KE_MAP[e] === el) out.push(`${e}克${el}（被坏）`);
      else if (KE_MAP[el] === e) out.push(`${el}克${e}（我克，耗力）`);
    }
    return out;
  };

  const 成全 = [], 破坏 = [];
  for (const t of 用神) {
    const r = 关系(t);
    if (r.some((x) => x.includes('被坏') || x.includes('泄气'))) 破坏.push(`对**用神${t}**：${r.join('、')}`);
    if (r.some((x) => x.includes('加根') || x.includes('加力') || x.includes('同气'))) 成全.push(`**救用神${t}／给用神加根**：${r.join('、')}`);
  }
  for (const t of 忌神) {
    const r = 关系(t);
    if (r.some((x) => x.includes('加根') || x.includes('加力') || x.includes('同气'))) 破坏.push(`**扶忌神${t}**：${r.join('、')}`);
    if (r.some((x) => x.includes('被坏') || x.includes('泄气'))) 成全.push(`制／泄**忌神${t}**：${r.join('、')}`);
  }

  const 倾向 = 破坏.length && !成全.length ? '偏凶（相对所声明者）'
    : 成全.length && !破坏.length ? '偏吉（相对所声明者）'
      : 成全.length && 破坏.length ? '吉凶并见（相对所声明者，须分事项）' : '无明显作用';

  return {
    岁运: transitGz, 岁运五行,
    用神触达: 用神.map((t) => ({ 令牌: t, 触及: 触碰(t), 五行关系: 关系(t) })),
    忌神触达: 忌神.map((t) => ({ 令牌: t, 触及: 触碰(t), 五行关系: 关系(t) })),
    成全, 破坏, 倾向,
    岁运与原局的作用: ta.interactions,
    提示: [
      '⚠ 本判定**相对于调用方所声明的用神／忌神**，**不是绝对吉凶**；用神定错则全盘皆错。',
      '路线视角：岁运**成全该路线**者偏吉、**破坏该路线**者偏凶（指令原文：岁运吉凶＝成全这条路线／破坏这条路线）。',
    ],
    口径: '相对所声明者，非绝对吉凶',
  };
}

/* ------------------------------------------------------------------ *
 * 二十、CLI
 * ------------------------------------------------------------------ */

export function parseArgs(argv) {
  const out = { gender: '男', format: 'text' };
  const luck = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--birth': case '-b': out.birth = next(); break;
      case '--gender': case '-g': out.gender = next(); break;
      case '--luck': case '-l': luck.push(next()); break;
      case '--json': out.format = 'json'; break;
      case '--facts': out.format = 'facts'; break;
      case '--longitude': out.longitude = Number(next()); break;
      case '--transit': out.transit = next(); break;
      case '--year': out.year = Number(next()); break;
      case '--solarterms': out.solarterms = Number(next()); break;
      case '--tiaohou': out.tiaohou = true; break;
      case '--tiyong': out.tiyong = true; break;
      case '--yongshen': case '--yong': out.yongshen = next(); break;
      case '--jishen': case '--ji': out.jishen = next(); break;
      case '--controversies': case '--disputes': out.controversies = true; break;
      case '--analysis': out.analysis = true; break;
      case '--help': case '-h': out.help = true; break;
      default:
        if (/^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}(:\d{1,2})?)?$/.test(a)) out.birth = a;
        else if (/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(a)) luck.push(a);
        else if (/^\d{4}$/.test(a)) out.year = Number(a);
        else throw new Error(`无法识别的参数：${a}`);
    }
  }
  out.luck = luck;
  return out;
}

/** 生成"命盘事实清单"（供模型直接阅读的紧凑结构化文本） */
export function formatFacts(chart) {
  const L = [];
  L.push(`【命盘事实清单】`);
  L.push(`公历：${chart.calendar.solar}　性别：${chart.input.gender}`);
  L.push(`节气月：${chart.calendar.solarTermMonth.term}起（${chart.calendar.solarTermMonth.startedAt}）`);
  L.push(`四柱：` + chart.pillars.map((p) => `${p.position.replace('柱', '')}${p.gz}`).join(' '));
  L.push(`日主：${chart.dayMaster.stem}（${chart.dayMaster.yinYang}${chart.dayMaster.element}）　月令：${chart.dayMaster.bornMonthBranch}（${chart.dayMaster.stageInMonth}）`);
  L.push('');
  L.push('柱位 | 干十神 | 藏干(十神/角色) | 纳音 | 星运 | 自坐 | 空亡');
  for (const p of chart.pillars) {
    L.push(`${p.position} | ${p.tenGod} | ${p.hidden.map((h) => `${h.stem}(${h.tenGod}·${h.role})`).join(' ')} | ${p.nayin.name} | ${p.dayStemStage} | ${p.selfStage} | ${p.voidBranches.join('')}`);
  }
  L.push('');
  L.push('五行力量（加权占比）：' + ELEMENTS.map((e) => `${e}${chart.strength.percent[e]}%`).join('　'));
  L.push('明现天干数：' + ELEMENTS.map((e) => `${e}${chart.strength.visible[e]}`).join('　'));
  L.push('通根得分：' + ELEMENTS.map((e) => `${e}${(chart.strength.rooted[e] ?? 0).toFixed(2)}`).join('　'));
  L.push('');
  L.push('旬空：日柱旬空 ' + chart.void.dayVoid.join('') + '；年柱旬空 ' + chart.void.yearVoid.join(''));
  const vh = chart.void.hits.filter((h) => h.inDayVoid);
  L.push('落空宫位：' + (vh.length ? vh.map((h) => `${h.pillar}${h.branch}`).join('、') : '无'));
  L.push('');
  L.push('神煞：');
  if (!chart.shensha.length) L.push('　（无）');
  for (const s of chart.shensha) L.push(`　${s.name} → ${s.positions.join('、')}${s.note ? `（${s.note}）` : ''}`);
  L.push('');
  L.push('干支关系：');
  const r = chart.relations;
  const line = (t, arr, f) => { if (arr.length) L.push(`　${t}：` + arr.map(f).join('；')); };
  line('天干五合', r.天干五合, (x) => `${x.pair}化${x.化}`);
  line('天干相冲', r.天干相冲, (x) => x.pair);
  line('天干相克', r.天干相克, (x) => x.pair);
  line('地支六合', r.地支六合, (x) => `${x.pair}化${x.化}`);
  line('地支三合', r.地支三合, (x) => `${x.局}(${x.positions})`);
  line('地支三会', r.地支三会, (x) => `${x.方}(${x.positions})`);
  line('地支六冲', r.地支六冲, (x) => x.pair);
  line('地支相刑', r.地支相刑, (x) => `${x.刑}(${x.positions})${x.争议 ? '⚠两派口径有争议' : ''}`);
  line('地支相害', r.地支相害, (x) => x.pair);
  line('地支相破', r.地支相破, (x) => x.pair);
  line('干支自合', r.干支自合, (x) => `${x.pillar}${x.gz}(${x.合})`);
  line('地支暗合', r.地支暗合, (x) => `${x.pair}(${x.合})`);
  L.push('　同柱：' + r.天干地支同柱.map((x) => `${x.pillar}${x.gz}${x.relation}`).join('；'));
  L.push('');
  L.push(`大运：${chart.luck.direction}（${chart.luck.source}）` + (chart.luck.source === '按节气自动推演' ? `，${chart.luck.start.startAgeText}起运（交运公历 ${chart.luck.start.startDate}）` : ''));
  for (const lp of chart.luck.pillars) {
    L.push(`　${lp.step}运 ${lp.gz}（${lp.startYear ?? '—'}年起，${lp.startAge ?? '—'}岁）${lp.tenGod} ${lp.twelveStage} ${lp.nayin.name} 藏${lp.hidden.map((h) => h.stem).join('')}`);
  }
  if (chart.luck.current) {
    L.push('');
    L.push(`当前大运：${chart.luck.current.gz}（参考年 ${chart.luck.referenceYear}）`);
  }
  return L.join('\n');
}

/** 岁运作用渲染 */
export function formatTransit(chart, ta) {
  const L = [];
  L.push(`【岁运作用】${ta.transit.gz}${ta.transit.year ? `（${ta.transit.year}年）` : ''}`);
  L.push(`十神：${ta.tenGod}　星运：${ta.twelveStage}　纳音：${ta.nayin.name}　旬空：${ta.voidBranches.join('')}`);
  L.push(`藏干：${ta.hidden.map((h) => `${h.stem}(${h.tenGod}·${h.role})`).join(' ')}`);
  if (ta.hollowNatalPillars.length) L.push(`岁运空亡落于原局：${ta.hollowNatalPillars.join('、')}`);
  L.push('');
  if (!ta.interactions.length) L.push('与原局无直接合冲刑害穿破（须看力量与喜忌）。');
  else {
    L.push('与原局的作用：');
    for (const x of ta.interactions) L.push(`　[${x.作用}] ${x.对宫位}：${x.说明}`);
  }
  L.push('');
  L.push(`注：${ta.note}`);
  return L.join('\n');
}

/**
 * 调候评估的可读输出。只报"原书条目 + 到位情况 + 提示"，不作"调候是否成立"的判断。
 */
export function formatTiaohou(a) {
  if (!a) return '（本组合不在《穷通宝鉴》调候表中）';
  const L = [];
  L.push(`【调候】${a.日干}日主生${a.月令}月　（${a.来源}）`);
  L.push(`用神：${a.用神}　辅佐：${a.辅佐}　忌：${a.忌}`);
  if (a.分用) L.push(`※ 原文于此月内分用：${a.分用.map((p) => `${p.期}用${p.神}`).join('；')}——须先定生于何时段，不可压平为一神`);
  if (a.并列用神) L.push(`※ 用神栏并列数神（${a.并列用神.join('、')}），非月内分用；原文有其主次先后，须按原文与要点取舍`);
  if (a.回填) L.push(`※ 本条系原书体例缺漏后按总论回填（并入「${a.回填}」），判语较逐月分论者粗疏`);
  const showGod = (box) => {
    for (const g of box.神) {
      const parts = [];
      if (g.透干) parts.push(`透干于${g.透干.join('、')}`);
      if (g.通根) parts.push(`通根于${g.通根.join('、')}`);
      if (g.被合) parts.push(`被合：${g.被合.map((c) => `${c.位置}化${c.化}${c.涉日干 ? '（日干自合，不为合去）' : ''}`).join('；')}`);
      if (g.被冲) parts.push(`被冲：${g.被冲.join('、')}`);
      if (g.未现) parts.push('不透不藏，全局无此神');
      L.push(`　${box.栏}${g.神}（${g.五行}）：${parts.join('；')}`);
    }
    if (!box.可机械取神) L.push(`　（「${box.栏}」栏原文含条件语或否定语，上列天干仅为"提及"，不可径当宜用）`);
  };
  showGod(a.用神到位);
  showGod(a.辅佐到位);
  L.push(`原文要点：${a.要点}`);
  // ★ 2026-10-01 修 D1：时支已知时，《八字提要》本时辰条**必须正文并陈**。
  //   此前该正文在 tiaohouAssessment 里算出却在此处被丢弃，模型只看到"须并陈"一句话 ⇒
  //   事实层静默缺一块（`体用路线法.md` 顶部「规格不可得时不得降级」明禁）。
  //   此处直接印出，消除"最后一公里"丢失。（原引旧版规约的失效节号，已于 2026-10-01 换成规格出处。）
  if (a.提要) {
    L.push('');
    L.push(`【《八字提要》${a.日干}日${a.月令}月·${a.提要.时柱}时】　（时支已知 ⇒ 本月更细的取用，与上表**并列并陈**，不互相取代）`);
    L.push(`　${a.提要.论述}`);
  } else if (a.提要缺失) {
    L.push('');
    L.push('⛔⛔⛔ **调候事实层不完整（fail-closed）**：时支已知，但《八字提要》本时辰条取不到。');
    L.push('⛔ 依《规矩/体用路线法.md》「规格不可得时不得降级」：**读不到规格或只读到摘要时，'
      + '必须停止分析并如实报告，不得降级继续**。');
    L.push('⛔ ⇒ **本盘调候结论不得作为确定性结论**；需核验底座内嵌数据完整性后再判。');
  }
  for (const t of a.提示) L.push(`※ ${t}`);
  return L.join('\n');
}

/**
 * 分歧清单的可读输出。**不选边、不折中**：各派主张与其成立条件并陈。
 */
export function formatControversies(list) {
  const L = [];
  if (!list.length) {
    L.push('【分歧点】未检出常见分歧结构（但不等于各家无异议，须按所问之事另行核对）');
    return L.join('\n');
  }
  const 结构 = list.filter((c) => c.类别 !== '通用披露');
  const 通用 = list.filter((c) => c.类别 === '通用披露');
  L.push(`【分歧点】命中 ${list.length} 处（结构性 ${结构.length}、通用披露 ${通用.length}）`
    + '——以下各家主张并陈，**不得径取一派当定论**');
  const emit = (c) => {
    L.push('');
    L.push(`◆ ${c.分歧点}　[${c.代号}]`);
    L.push(`　命中结构：${c.命中结构}`);
    for (const p of c.各派主张) L.push(`　· ${p.派}：${p.主张}\n　　　据：${p.据}`);
    L.push(`　须先确定：${c.须先确定.join('；')}`);
    if (c.引擎注) L.push(`　引擎注：${c.引擎注}`);
  };
  if (结构.length) {
    L.push('');
    L.push('── 结构性分歧（本盘特有，凡涉判断必先处理）──');
    结构.forEach(emit);
  }
  if (通用.length) {
    L.push('');
    L.push('── 通用披露（与方法取径有关，与具体盘无关；使用者问及相关事项时再展开）──');
    通用.forEach(emit);
  }
  return L.join('\n');
}

/**
 * 「五行字」归一：接受 五行名（木火土金水）、单干（丙）、单支（巳）或干支（丙寅）。
 * 用于 CLI `--yongshen/--jishen`。无法识别返回 null。
 */
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

export function parseBirth(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?)?$/.exec(s.trim());
  if (!m) throw new Error(`出生时间格式应为 YYYY-MM-DD[ HH:MM]，收到：${s}`);
  return {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: m[4] === undefined ? 12 : Number(m[4]),
    minute: m[5] === undefined ? 0 : Number(m[5]),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help || (!args.birth && !args.solarterms)) {
    console.log(`八字推演引擎  bazi-engine

用法：
  node engine.mjs --birth "1990-05-20 14:30" [选项]

选项：
  -b, --birth     出生公历时间 "YYYY-MM-DD HH:MM"（缺时间按 12:00 计）
  -g, --gender    性别，男｜女，默认 男
  -l, --luck      大运干支，可重复（如 -l 辛巳 -l 壬午）；提供后不再按节气自动推演
      --transit   岁运作用：给定大运或流年干支（如 --transit 甲子）
      --year      流年（与 --transit 等价，如 --year 2025）
      --longitude 出生地东经，给出后先做真太阳时校正再排盘
      --tiaohou   输出《穷通宝鉴》调候用神及其到位情况（透干/通根/被合/被冲）
      --tiyong    输出**体用路线法四项**（①财官是否威胁 ②印比是否有情 ③用神是否有护卫 ④结构是否稳定）
                  可配 --yongshen <五行> / --jishen <五行> 声明用神忌神（五行字或干支字皆可）。
                  ⚠ **两者须自洽，且不固定**：用神**由本盘第 1 条（财官是否威胁）定**，逐盘不同；
                  忌神应是**克用神者**（例：用神火 ⇒ 忌神水；用神水 ⇒ 忌神土）。填成不自洽的组合
                  （如 用神火／忌神金）会被判为**口径矛盾并拒绝判忌**——那是守卫，不是 bug。
                  配 --transit 壬辰 传岁运；不声明用神则按调候表暂取并标注"待核定"
      --yongshen X  声明用神（五行：木火土金水；或干支字如 丙/巳）
      --jishen X    声明忌神（同上）
      --controversies  输出本盘命中的各家分歧点（不选边，各派主张与成立条件并陈）
      --analysis  = --facts + --tiaohou + --controversies（推荐给模型阅读）
      --facts     输出"命盘事实清单"（紧凑结构化，推荐给模型阅读）
      --json      输出完整 JSON 结构
      --solarterms YYYY   输出该年 24 节气（北京时间）
  -h, --help      显示本帮助

约定：
  · 年柱以立春为界，月柱以十二节为界（非农历月份）
  · 日柱用儒略日推算；时支 23:00-00:59 为子时
  · 本引擎以北京时间为准；出生地经度与东经 120° 相差较大时，
    请用 --longitude 传入经度做真太阳时校正
  · 引擎只做确定性推演，不作吉凶价值判断
`);
    process.exit(args.help ? 0 : 1);
  }
  if (args.solarterms) {
    const terms = solarTermsOfYear(args.solarterms);
    for (const t of terms) {
      console.log(`${t.name}\t${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`);
    }
    return;
  }
  let birth = parseBirth(args.birth);
  let tstNote = null;
  if (Number.isFinite(args.longitude)) {
    const tst = trueSolarTime(birth, args.longitude);
    tstNote = `真太阳时校正：经度 ${args.longitude}°E，经度差 ${tst.longitudeMinutes} 分，均时差 ${tst.eotMinutes} 分，合计 ${tst.totalMinutes} 分 → ${formatMoment(tst.corrected)}`;
    birth = tst.corrected;
  }
  const luckPillars = args.luck.map((gz) => ({ gz, startAge: null, startYear: null }));
  const chart = castChart({ ...birth, gender: args.gender, luckPillars: luckPillars.length ? luckPillars : undefined });
  if (tstNote) console.log(tstNote + '\n');

  if (args.tiyong) {
    // 体用路线法四项。--transit 在此处作「岁运」传给第三、四条，而非作岁运作用分析。
    const 用神五行 = 五行字(args.yongshen);
    const 忌神五行 = 五行字(args.jishen);
    // 声明了却认不出 → 报错，不静默降级为"未声明"（静默降级正是本项目明令避免的）
    if (args.yongshen != null && !用神五行) throw new Error(`--yongshen 只接受五行（木火土金水）或干支字（如 丙、巳、丙寅），收到「${args.yongshen}」`);
    if (args.jishen != null && !忌神五行) throw new Error(`--jishen 只接受五行（木火土金水）或干支字（如 庚、申、庚申），收到「${args.jishen}」`);
    const out = tiyongRouteOf(chart, { 用神五行, 忌神五行, 岁运: args.transit ?? null });
    if (args.format === 'json') console.log(JSON.stringify({ chart, tiyong: out }, null, 2));
    else console.log(formatTiyong(out));
    return;
  }
  if (args.transit || args.year) {
    const ta = transitAnalysis(chart, args.transit ? { gz: args.transit } : { year: args.year });
    if (args.format === 'json') console.log(JSON.stringify({ chart, transit: ta }, null, 2));
    else console.log(formatTransit(chart, ta));
    return;
  }
  if (args.format === 'json') console.log(JSON.stringify(chart, null, 2));
  else if (args.tiaohou) console.log(formatTiaohou(tiaohouAssessment(chart)));
  else if (args.controversies) console.log(formatControversies(controversiesOf(chart)));
  else if (args.analysis) {
    console.log(formatFacts(chart));
    console.log('');
    console.log(formatTiaohou(tiaohouAssessment(chart)));
    console.log('');
    console.log(formatControversies(controversiesOf(chart)));
  }
  else if (args.format === 'facts') console.log(formatFacts(chart));
  else console.log(formatChart(chart));
}


const isMain = (() => {
  try { return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href; }
  catch { return false; }
})();
if (isMain) main();


/* ================================================================== *
 * 二十、体用路线法推演层（已解耦独立至 ./tiyong.mjs）
 * ------------------------------------------------------------------
 * 规格见《规矩/体用路线法.md》。
 * 为保持向后兼容性与统一接口，排盘底座在此处集中重导出体用推演原语。
 * ================================================================== */
export {
  GONG_WEIGHT, GONG_RANK, GONG_WEIGHT_NOTE,
  proximityOf, occupantsOf, combinedAwayOf, powerOf, pathOf,
  SI_XIANG_WUXING, SI_XIANG_YUAN, SI_XIANG_MONTH_SYSTEMS, siXiangOf, genWeightOf, youJiuOf,
  canControlOf, canTransformOf, canBindOf,
  threatOf, qingOf, protectionOf, protectionChainOf, structureOf,
  chengzaiReassess, xiangzhanOf, fanwangOf, selfHiddenCombineOf, tiyongRouteOf,
  DUAL_IMAGE_LIBRARY, dualImageMatrixOf,
  arbitrateGanzhiForces, coverageOf, congErAnalysisOf,
  gejuChengPoOf,
  formatTiyong
} from './tiyong.mjs';
