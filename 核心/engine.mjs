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
import { tiyongRouteOf, formatTiyong } from './tiyong.mjs';


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
 * 七、节气（天文近似，Jean Meeus《Astronomical Algorithms》）
 *    精度：1900-2100 年间通常 < 1 分钟，足以判定月柱与起运
 * ------------------------------------------------------------------ */

const RAD = Math.PI / 180;
function norm360(d) { const x = d % 360; return x < 0 ? x + 360 : x; }

/** 由儒略日(JD, 力学时 TT)算太阳视黄经（度） */
function sunApparentLongitude(jde) {
  const t = (jde - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * RAD)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * m * RAD)
    + 0.000289 * Math.sin(3 * m * RAD);
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  return norm360(trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD));
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
 * 求某年某节气的时刻（北京时间）。
 * @param {number} year 公历年（节气名以该年 1 月的小寒为起点）
 * @param {number} index 0-23，对应 SOLAR_TERMS
 * @returns {{year,month,day,hour,minute}} 北京时间
 */
export function solarTermMoment(year, index) {
  const targetLon = TERM_LONGITUDE[index];
  // 初值：该节气大约在 year 年的第 index*15.2 天之后（以 1 月 5 日为小寒基准）
  let jde = 2451545.0 + 365.2422 * (year - 2000) + (index * 15.2 + 4.5);
  for (let iter = 0; iter < 12; iter++) {
    const lon = sunApparentLongitude(jde);
    let diff = norm360(targetLon - lon);
    if (diff > 180) diff -= 360;
    if (Math.abs(diff) < 1e-7) break;
    jde += diff * 365.2422 / 360;
  }
  const jd = jdeToJd(jde, year);
  return jdToBeijing(jd);
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

  /* --- 天罗地网（按年支） --- */
  {
    const yb = BRANCHES[yearBranchIndex];
    if (['辰', '巳'].includes(yb)) add('天罗', posOf(['辰', '巳']));
    if (['戌', '亥'].includes(yb)) add('地网', posOf(['戌', '亥']));
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

  for (const p of pillars) {
    const se = ELEMENTS[STEM_ELEMENT[p.stemIndex]];
    visible[se] += 1;
    score[se] += 1.0;
  }
  for (const p of pillars) {
    for (const h of HIDDEN_STEMS_SPEC[p.branchIndex]) {
      const se = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(h[0])]];
      rooted[se] += h[2];
      score[se] += h[2] * 1.2;
    }
  }
  const adjusted = {};
  let total = 0;
  for (const e of ELEMENTS) {
    adjusted[e] = Number((score[e] * seasonCoefficient(e, monthBranchName, silingEl)).toFixed(2));
    total += adjusted[e];
  }
  const percent = {};
  for (const e of ELEMENTS) percent[e] = total > 0 ? Number((adjusted[e] / total * 100).toFixed(1)) : 0;
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
export function castChart(input) {
  const { year, month, day, hour, minute = 0, gender = '男' } = input;
  if (![year, month, day, hour].every((v) => Number.isFinite(v))) throw new Error('castChart: year/month/day/hour 必须为数字');
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
    L.push(`| ${c.position} | **${c.gz}** | ${c.tenGod} | ${c.branch} | ${hid} | ${c.nayin.name} | ${c.selfStage} | ${c.dayStemStage} | ${c.voidBranches.join('')} | ${c.zodiac} |`);
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
 * 数据源自《八字提要》（韦千里）典籍母本，全量 1440 组完整内嵌，
 * 已校验：120 节齐、每节 12 条、时支顺序合规、**时干全部合五鼠遁**。
 * TIYAO_ROWS 为全量内置常量表，严禁破坏结构。
 * ==================================================================== */
const TIYAO_ROWS = [
  ['甲', '寅', '甲', '子', '甲木得禄于寅月，又有时上甲比子印之生扶，强旺可知，惟初春余寒犹盛，木甫萌蘖，得火暖之则繁荣，木旺见金自可贵，柱中有土斯有财。'],
  ['甲', '寅', '乙', '丑', '甲生寅月，时落乙丑，建禄而加以劫财，身旺无疑，自喜丑土之财，为养命之源，然无火之生土暖木，则少生机，大木逢金，乃成栋梁，？见微水，可以养木，独忌木多，盖比劫猖狂矣。'],
  ['甲', '寅', '丙', '寅', '月时皆寅，甲木？得其禄，妙乎丙火投出，秀气发越，寒气尽除，喜金斲伐，尤宜土之转辗泄秀，得显精神，最忌水来伤丙，不啻当头棒击。'],
  ['甲', '寅', '丁', '卯', '甲生寅月卯时，得禄得旺，喜丁火之泄秀，但丁力微弱。端赖他火相济，木太旺，微金反激，不如多金可以砍伐成材，木再多则母旺子衰，丁火危矣，无水最佳，有水破火，要有土救。'],
  ['甲', '寅', '戊', '辰', '寅月甲木，生戊辰时，身财？美之造，贵有火之构通，则木火土生生不息矣，水多木多偏重于身而轻于财，岂是佳象，见金所以卫财，自属可喜。'],
  ['甲', '寅', '己', '巳', '甲木寅月，时落己巳，木火土打成一片，身财？旺，？重心全在巳火，得以秀气？通，再多火土，何殊花添锦上，加之以金，相得而益彰矣。'],
  ['甲', '寅', '庚', '午', '甲生寅月，为当令之木，诞庚午时，庚金克木，午火泄木，所谓制化之功全矣，见土财，见水印，皆无不可，惟水不宜太盛，盛则湿木而助寒，木若多，庚金受抗而折，乃身重杀轻为患。'],
  ['甲', '寅', '辛', '未', '寅月甲日，见辛之官，未之财，小名小利之造，盖财官皆轻于日主，要多见土金则发矣，未土得见刑冲则尤妙，微水养木不妨，火能暖木驱寒，不论多寡皆宜。'],
  ['甲', '寅', '壬', '申', '甲日寅月，落申时，月时逢冲，又透壬，颇多水意，而木之滋长？繁，贵乎火以温暄，土以壅培，金太多，则患助水，杀为印化而无威，木太多，则愁比劫猖狂，财被夺而身穷。'],
  ['甲', '寅', '癸', '酉', '寅月甲木，秉时令之旺，得时上癸水之涵养，酉金之翦裁，固无所谓不利，但水不可再盛，盛则木泛矣，金不过多，因寒木不胜其重克，总喜火土之暖培耳。'],
  ['甲', '寅', '甲', '戌', '甲生寅月，逢甲戌时，寅戌中皆藏火土，辅以干头比肩，身似较重于财星，故喜多见土，使身财？停，多金奚益，盖身受克，财被泄矣，凡水凡木，？皆不宜再多。'],
  ['甲', '寅', '乙', '亥', '甲木得禄于寅堤，得长生于亥时，乙再辅甲，显而？见为身强之造，无论金克火泄土培皆宜，所谓强则喜抑，岂可再逢水木幇身，所谓强则忌扶也。'],
  ['甲', '卯', '甲', '子', '甲木卯月，阳刃之位，时干透甲，助身益旺，一点子水値时，润木有功，宜有火土以暖培，则木性自然舒畅，春木见金，尤为眞神，水则宜藏，切忌多见。'],
  ['甲', '卯', '乙', '丑', '甲见卯阳刃，乙见卯为禄，蒂固根深，时支丑财，以时干乙木，月提卯木，上下交制，被耗殆尽，喜有火以生财，如见土金齐来，亦是上格。'],
  ['甲', '卯', '丙', '寅', '甲木见刃于卯，得禄于寅，身主强旺，丙火高透时干，藉以泄木之秀，惟春木阳气燥渴，还宜水之滋润，见金乃栋梁材成，土金皆缺，病重药轻矣。'],
  ['甲', '卯', '丁', '卯', '月时？卯。双刃并见，时干透丁，火明木秀，命书载刃旺最喜见杀，杀者金也，有土生金，格尤上乘，否则一派甲木，或气聚东方，当以从旺格或曲直格论命。'],
  ['甲', '卯', '戊', '辰', '甲遇卯而身旺，戊坐辰而财足，惟喜火之食伤，介于木土之间，藉以转刃生财，水印为春木喜用之神，金杀又为制木所必要，但用水喜见金发水源，用金则不宜多水，以泄官杀。'],
  ['甲', '卯', '己', '巳', '己土合甲，财来就我之谓，惟主中木火太炽，燥渴有加，喜见壬癸以调和，则生气蓬勃，巳中有丙戊，可作食神生财取用，若丙戊透干，益见淸纯矣。'],
  ['甲', '卯', '庚', '午', '甲生卯月，乘权秉令，刃旺原喜七杀相制，无如时上庚金？于午地，火乘木旺而制金，以是虚露失垣之庚，不能制裁旺盛之木，故须地有土财，泄火生金，金遂为我所用。'],
  ['甲', '卯', '辛', '未', '日元甲木，坐库于时支，卯未半会，气势充沛，辛透无力，最喜土金协助，否则柱中迭迭逢木，大宜火之泄秀，所谓制之不如化之也。'],
  ['甲', '卯', '壬', '申', '时逢壬申，金水同声相应，惟仲春之木，最喜雨露之癸水相滋，壬水属阳，有失灌漑之力，反泄七杀之气，故喜有土得地，制水扶金，有土而又有火，则？妙矣。'],
  ['甲', '卯', '癸', '酉', '卯木阳刃，被时支酉金相冲，幸有时干一癸相生，木气转弱为旺，再有带水之木，或火土并见，而与癸无犯者，富显无疑。'],
  ['甲', '卯', '甲', '戌', '日元甲火遇春发荣，月提有卯木之刃，时干有甲比之助，旺盛可知，时支戌土，见月提之卯，戌为？合，虽无合土之象，要亦因合而失财之大用，贵乎水以润之，火以暖之，金以裁之，'],
  ['甲', '卯', '乙', '亥', '二月甲木，位居刃地，时支亥水，位？长生，亥中藏壬，可以润木之燥，天干甲乙并？，地支亥卯得垣，独喜金来制木，藉成栋梁之用，兼有一二点土以生之，益觉有情。'],
  ['甲', '辰', '甲', '子', '甲木生于三月，气势渐衰，火气渐进，値兹春深木？，喜有金以削伐，忌见火旺损金，所谓斧斤以时入山林，材木不可胜用，壬癸之水亦喜，得以润木之燥也，子辰半会，财化为印，时干一甲，助身为旺，庚辛诚为必要之神，无论透干藏支，均宜见之，土少可以培木，土旺又防折木。'],
  ['甲', '辰', '乙', '丑', '三月甲木，得辰中藏乙暗助，时乙又透干，日元弱而不弱，辰丑？财坐库，财藏不露，又中藏癸水，木性得润，惟干木支土，劫比有争财之象，最喜金杀透干，自可全其木土之性。'],
  ['甲', '辰', '丙', '寅', '三月甲木退气，幸时根逢禄，亦可转弱为强，丙火食神，透自寅宫，火旺泄木菁英，时维三月，火气将进，已非为甲火所需要，故太旺有损金之嫌，见金而遇火制者，则尤喜水而去火之病，否则名为钝斧无钢，'],
  ['甲', '辰', '丁', '卯', '季春甲木，旺转为衰，时支一卯坐刃，日元气转生旺，时干丁火，有泄木之气势，木火土辗转相生，而无阻节，金之官杀，水之印绶，柱中不可或少，有金见土，格成财滋弱杀，有水见金，格取官印相生，'],
  ['甲', '辰', '戊', '辰', '甲木？见辰土余气，兼有辰中？癸之相生，木气得地有根，惟柱中土尙多过于木，财略重，身较轻，仍喜用木以去财之病，乃一神一用之妙法，有金透干，自以金泄旺土之气为最可取。'],
  ['甲', '辰', '己', '巳', '甲生三月，木气已老，用神不？庚壬，用庚者，使其斲成栋梁之器也，用壬者，使其调济斯旺土之燥也，时逢己巳，火土同旺，财有食神之生，名为财星有根，但日元衰弱，不能任斯食财，惟喜水印制火，生扶甲木，调济于平矣。'],
  ['甲', '辰', '庚', '午', '三月甲木退气，本身不见比劫之助，当以身弱论之，时干庚杀，？于午火之上，似乎金被火制，庚金无能为力，喜其月提辰土，足以泄火，转来生扶庚金，是午火有辰土之泄，虽旺不旺，庚金有土财之生，虽弱不弱，不过日元仅恃辰中乙癸相助，根气太浅，要有甲乙寅卯等字，分居干支或有一二点水以助之，则五行归中和矣。'],
  ['甲', '辰', '辛', '未', '甲木余气于辰，坐库于未，辰未虽皆为财，木因辰未而得根，时干辛金，有谓见土卽生，？知时支之未，中藏木火，不但不能生金，抑且有燥金之患，是土之生金，必以辰丑为范也，辛金伐木之力极微，有时虽可借用，究不逮用庚金之为美也。'],
  ['甲', '辰', '壬', '申', '时値暮春，甲木气转衰弱，时支申金，与辰拱水，而时干又透壬水，水势不免太旺，盖水能生木，水多亦能漂木，辰申所藏之土，以其性湿，不能制水之流，惟喜戊土透干，方可引为用，此卽印旺而用财破印也。'],
  ['甲', '辰', '癸', '酉', '日元甲木，仅恃辰中一点乙木劫财，时逢癸酉，官泄于印，转以生身，惟酉金有辰土之生，官星转旺而淸，总以日元欠强，不能任此财官，故喜有木比相助，方能全其大用。'],
  ['甲', '辰', '甲', '戌', '三月甲木，其性至弱，非有水木印比之生，不能巩固其根，月时辰戌一冲，土财之势益旺，天干？甲，自难任此之旺财，幸月提辰土，暗藏癸乙，身虽弱而尙？至于太衰也，身财最喜？停，财旺最喜木来助身，舍此有喜水印生扶。'],
  ['甲', '辰', '乙', '亥', '甲生辰提，木气退缩，日元坐亥，时逢长生，透干乙木，劫又幇身，亥中所藏壬印，又得生扶木神，水木打成一片，不旺自旺，要有金气得地，制之为良，所谓重见木旺，必赖以金斲削，方成栋梁，劫印再多，总非宜矣。'],
  ['甲', '巳', '甲', '子', '巳月甲木，火旺为病，叶燥根枯，生机窒碍，喜有水之润泽，金来发源，盖木气尽泄于火，巳中庚杀戊财，又来克制，时干甲木，虽可幇身，以虚露？实，无能为力，所喜时支一点子水，足以润木之根，惟巳月水？絶地，须有多金助长水势，格局始可转淸，火土？神，总为少见为妙。'],
  ['甲', '巳', '乙', '丑', '甲木日元，诞于巳月，火旺木泄，气散南离，时干乙木劫财，露而虚浮，妙得时下一丑，丑为湿土，可以戢旺火之气，矧丑中辛癸同宫，木燥有赖润泽，喜再水透干头，？有一二点金生之，遂归中和矣'],
  ['甲', '巳', '丙', '寅', '四月甲木，以金水为不离之眞神，而独以丙丁为忌神，月提巳火，时坐寅禄，时干一丙高透，又逢生逢禄，木火之势旺矣，身旺木喜泄秀，特夏令甲木，反以火泄为非宜，必须有得地归垣之水以济之，庚辛之金以生之，始可免于枯燥。'],
  ['甲', '巳', '丁', '卯', '木至四月，位？衰地，火旺木渴，枝叶枯憔，时支卯木为刃，时干丁火为伤，大有火旺木焚之槪，欲去旺火之病，疗木之燥，非水而何，然则水印洵去病之药，抑亦旋乾转坤之神，再见金以助之者，益见淸润可喜，添花锦上矣。'],
  ['甲', '巳', '戊', '辰', '甲木日元，诞于巳月火旺之候，阳气渐壮，木不华秀，时支坐下辰土，乃为木之余气，喜其藏一点癸水，藉以润木之燥，而戊土透于时干，转成财旺印轻，土重自然水？，兼之巳火又来生土，则土愈旺而身愈弱矣，然则，水印木比，实为当务之急，舍此莫属也。'],
  ['甲', '巳', '己', '巳', '巳月熏风已至，甲木之气转衰，月时？巳，火势炎炽，火炎则木气？弱，巳中？庚，虽有？戊之生，不致被火所镕，然亦患乎燥亢而不能生水，欲救苟延残喘之甲木，非见重水不为功'],
  ['甲', '巳', '庚', '午', '甲日巳提，木气尽泄，时落于午，益添火焰，庚金七杀，虽坐生于巳，火旺则金气被镕，书云，木行南离，名为散气之文，火金交战，祗要有带水之土以构通之，再有水木相助，五行有情而不悖矣。'],
  ['甲', '巳', '辛', '未', '甲木日元，坐库于时支之未，孟夏火势极旺，兼之燥土不能培木之根，时干辛金？无湿土以生之，壬癸以浇之，木之生气殆尽，如再重见火土之神，则为木火土三神成象，卽顺局中之从儿格是也，柱有壬癸之水，又当弃从儿而以印受为用。'],
  ['甲', '巳', '壬', '申', '甲木？于巳位，病地也，时支申金，絶地也，莫不曰身因克泄而太弱，殊？知申中所藏壬水印绶，可以制食化杀，壬水坐于地，金水义结同心，甲木弱于何有，水印不能再来，太过，反成母旺子虚之象矣。'],
  ['甲', '巳', '癸', '酉', '巳月甲木，人恒以火旺木衰为病，然此造火病转为不病，盖柱中巳酉会金，食化为官，时干癸水，全赖金以转旺，以此得气之水印，自可助我，惟水印旣有巳酉之相助，无须重见，重见而又无戊己之财，反成母慈灭子之象。'],
  ['甲', '巳', '甲', '戌', '甲木被泄于巳，时支戌财，土燥不能培木之根，时干甲木比肩，不载于地，身财之气未能融洽，虽巳戌有相生之意，究属枯燥，故须有壬癸之水调和，庚辛之金以发水，始克有济，所以夏令之木金水实调候之眞神，须臾不可或？也。'],
  ['甲', '巳', '乙', '亥', '甲木长生于亥，水助木比而转旺，时干乙木坐亥，湿润而得生，乃以亥巳互激，气势有损，滴天髓云，生方怕动，？非虚语，惟巳亥虽冲，乃水来制火，非火来制水也，去火之病，适足以益我日元，所喜有金相助，全其水之精神，自然？长源远矣。'],
  ['甲', '午', '甲', '子', '甲木比肩幇身，可以一点子水，原可收湿润燥木之功，惟子午一冲，水火？败俱伤，自应加强水势，得见庚辛相助，格取杀印相生，如火土迭见，除去金水，偏枯之象也。'],
  ['甲', '午', '乙', '丑', '甲木日元，有乙劫幇身，时支坐下丑土，暗藏辛癸得以润斯燥木，且丑为湿土，亦可以收旺火之气，若金水未透干头，？量仍嫌微弱，如戊己杂出，格局浊而不淸矣。'],
  ['甲', '午', '丙', '寅', '甲诞五月，木之精神尽泄，日元虽坐禄于寅，似乎木气有根，？知寅午一会，比化为伤，而丙火又透于时干，增火之势，忌神可谓深重矣，然则去病之法，惟有藉辰丑湿土以泄之，壬癸以制止，有病得药，格自佳矣。'],
  ['甲', '午', '丁', '卯', '日元甲木，时卯为刃，透丁泄秀，木火通明之象，四柱须有一二点财，透干得地，絶官印之神，格成木火从儿，若一见水印，转成木火伤官佩印，旣用印，不喜见财，见之格？。'],
  ['甲', '午', '戊', '辰', '甲诞五月，身？病地，时逢戊辰，财旺于身，幸而辰中乙癸相生，？以补助日元之？足，所喜木来比助，水来资身，则成身财？停之命矣。'],
  ['甲', '午', '己', '巳', '己土合甲，巳午火旺，木因火泄而愈弱，火赖木生而愈旺，支有辰丑带水之土以泄之，方能保存木之生机，？见金水同来，弥觉可贵，否则，任其亢阳肆逞，甲木安得不虚焦乎。'],
  ['甲', '午', '庚', '午', '日元甲木，地？？午，火势熊熊，不可向迩，身弱伤旺，独喜水来润湿，金发其源，金水？全，则旺火之气自慑，若再见甲乙巳午等字，格局陷于偏枯矣。'],
  ['甲', '午', '辛', '未', '日元甲木，得库于未，未中乙木，以有丁火而被泄，虽曰木坐库地，而助木之力极微，况午未？合，气又转变，时辛为旺火所煏，金其脆矣，际兹火旺木泄之情势下，总不外乎见水为需要。'],
  ['甲', '午', '壬', '申', '五月甲木，位居死地，身主之弱，较之他月尤甚，若无印比之助，实难全其生机，时逢壬申，金得禄而水逢生，大有水火旣济之象，乃忌戊己杂出，浊水而成大病，如金水迭见，熄灭午火，剌激太过，亦非中庸之道也。'],
  ['甲', '午', '癸', '酉', '甲日午提，火旺木弱，时支酉金，被午制去，因是时干癸水，转成孤虚，夏木以水为眞神，故最喜金水得地逢生，否则，无源之水，？于干涸，是庚申等者，尤宜先见也。'],
  ['甲', '午', '甲', '戌', '甲比幇身，午戌半会，木虚火旺，见象自明，木虚喜有刦印以助之，火旺喜见湿土以收之，命书云，太过宜剥削，不及喜生扶，亦堪以此？言之，故金水二神之所以为喜，盖取其生抹与润泽之意也。'],
  ['甲', '午', '乙', '亥', '甲木见亥为长生，壬水见亥为禄位，身印？旺，木润不枯，月提午火，切忌干透燥木，虽有亥中壬水之印以制火，要知火旺亦可以制水，此系反克原理，土在夏火炎？之时，絶对不宜多见。'],
  ['甲', '未', '甲', '子', '甲墓于未，透比幇身，子印藏支，木性自然不火，？月火渐退气，非以五月甲木之必欲见水，若木旺而又金透，斲轮之象，金多而有火制，格取食神制杀，水如太多，三伏生寒矣。'],
  ['甲', '未', '乙', '丑', '甲木坐贵于丑未，土因明冲而益旺，时乙盘根于未，祗可言日元不弱，非可以言旺也，如透一水印，身可任此当令之财，否则，天干甲乙，他支丑未，总有争财之嫌，苟有一火从中构通其气，则以三神成象论矣。'],
  ['甲', '未', '丙', '寅', '日元得禄于时支之寅，干头丙火得生，木火之势皆旺，时屈夏末，金水进气，火势消沉，非若仲夏甲木之必欲水来调候也，但亦不可无一二点水，？以润木，水而多透，须防枭食交战。'],
  ['甲', '未', '丁', '卯', '卯未会木，日元蔕固根深，一丁透出，病在太燥，须有一二点水以润之，格局始臻中和，身旺透火，最喜土财，再见比劫，或有庚辛泄财之气，用财？眞矣。'],
  ['甲', '未', '戊', '辰', '日元得库于未，余气于辰，可谓通根得地，？知辰未皆土，戊又透于时干，身虽通根而不能任此旺财，其为财旺身轻，明矣，然则如何使其身财？停，惟喜木比以助之，水印以生之，自然身财得均，不偏倚矣。'],
  ['甲', '未', '己', '巳', '日元甲木。月提得库，时干己财合甲，己甲有贪合之情，名谓财来就我，巳火为食神之地，木因火泄而愈弱，火有木生而愈旺，但甲己合，巳未拱火，颇有化土之象，喜再透火，土作化格论，忌有甲木元，则破格矣。'],
  ['甲', '未', '庚', '午', '甲木诞于？月，墓库之地，月未时午，成为？合，财随伤意，时干独杀高透，克泄交加，日元益见孱弱，非支有寅亥等字，不能转弱为强，如见水印制伤化杀，兼有劫比以助身，则得之矣，'],
  ['甲', '未', '辛', '未', '甲木？见未土财星，未有为日元甲木之本库，未中暗藏？乙，足以助身之旺，但未中丁火泄木，故远不如坐下有寅亥之为气壮也，甲以庚为？友，时辛力弱，喜有水印相滋，申酉助官，大用遂成。'],
  ['甲', '未', '壬', '申', '甲木见申，坐于絶地，壬印高透，絶处逢生，此时水已进气，似无须再见金助，金来则水势添旺，反寒木性，故？月甲木，身旺则喜庚，身弱独喜劫比相助也。'],
  ['甲', '未', '癸', '酉', '日元甲木，？为库，时逢癸酉，金水同心，大暑前火气犹存，宜以润木为先，大暑后水已进气，多水生寒，虽同一水，而喜忌逈异，总之，？月甲木，身弱喜多见木助，自不宜多见水印也，如本身已得中和之气，尤喜庚金制木为？。'],
  ['甲', '未', '甲', '戌', '天干？甲，地支？土，日元虚露，财星得根，比财有争夺之象，时屈季夏，土正当旺，独喜木气得根，方能任此旺财，如有一二点水接济之，尤佳，不过财比相峙之局，勿论身之强弱，首要火来通关也。'],
  ['甲', '未', '乙', '亥', '甲木得库于未，长生于亥，亥未拱木，兼有壬印之生，时劫之助，日元之旺，不言而喩，喜金之官杀得地透干，身旺用杀，最为相宜，用杀则忌水泄火制，苟有少许土来助杀，益见可贵矣。'],
  ['甲', '申', '甲', '子', '甲木生于七月，絶地也，月提申金与时支子水，会成半水之局，木得水生，自然身旺，惟时値金气秉令之候，生水之力极大，水可生木，亦防寒木，故最喜庚丁？透，格取伤官驾杀。'],
  ['甲', '申', '乙', '丑', '甲日申提，日元絶处逢生，时支丑土，财星得贵，乙劫在干，木亦得助，需要庚金高透，用杀无疑，金重又防损木，则喜火来制之也。'],
  ['甲', '申', '丙', '寅', '甲日申提，木之气势？絶，时支寅木？官，似可助身为旺，乃以寅申互冲，木根尽拔，而壬印又被寅中戊土所制，比印？伤，木气衰矣，时干一丙，又来泄木菁英，救之之法，惟先坚强木之阵容，然后用金用土，财官皆属于我矣。'],
  ['甲', '申', '丁', '卯', '甲日申提，时卯坐刃，其身不旺而旺，时透丁火，木助火旺，有泄秋木之气，所喜木比相助，庚金透干，使其身杀？停，自然相辅有情。'],
  ['甲', '申', '戊', '辰', '戊辰财星得地，生助月提申金，格成财滋七杀，杀旺必须火来相制，方可假杀为权，机构虽佳，惟嫌本身太弱，须有印比相助，格局始臻完备。'],
  ['甲', '申', '己', '巳', '时支巳落文昌，干头己财就我，火土金相辅有情，惟日元仅赖申中一点壬印相生，木之气势，究欠充沛，须有木比生助，固其身根，虽曰秋木以杀为生，秋木得金而造，然过于金重木轻，亦非所宜也。'],
  ['甲', '申', '庚', '午', '申中壬水印绶，可助日元甲木，木赖水生，气转生旺，时干庚金，透自月提，杀旺槪可想见，妙有时支午火制杀，格局尽善尽美，此造重心在于丁火，独忌水来困午，设或过之，首须寻其去病之神。'],
  ['甲', '申', '辛', '未', '甲木得库于未，兼有申中壬印之相生，日元不以弱言，时干辛金，有时支未财之生，此卽时上一位贵也，四柱见庚则官杀相混，用丙丁之火，去一？一，未始非激浊扬淸之妙法，如杀从官势者，不以此论。'],
  ['甲', '申', '壬', '申', '时干壬水，坐下？申长生，金气尽泄于水，水印太旺，木浮面寒，喜有土财去印，如柱中土付阙如，或虽有而虚露无根，不能破此旺印，则当顺其水木之性，谓金水木三神成象，反以财官为忌也。'],
  ['甲', '申', '癸', '酉', '金水三见，其重心在水而？在金，甲木得水相生，日元自旺，惟时屈秋令，水多木寒，有损木之精神，故火之食伤，柱中最喜重要，兼有土财以制去旺水，气象自归中和矣。'],
  ['甲', '申', '甲', '戌', '时干比肩虚露，时支坐财，日元甲木，仅恃申中壬水相生，气势不甚朗健，殊难敌此旺财，惟时戌有生申之意，祗要重见庚辛申酉等字，自应以用印化杀为眞，间有土来除去申中水印，则成当令之从杀格。'],
  ['甲', '申', '乙', '亥', '甲日而时支亥水长生，并有申亥中所藏？壬相生，时干又有乙劫之助，日元旺相可知，本身旣旺，自可任用金杀土财，尤须财先去印，金可兀？无伤，否则杀？于印，反增寒水之势，金杀失眞矣，是柱中之土，诚去印卫杀之一絶大关键也。'],
  ['甲', '酉', '甲', '子', '甲诞酉月，居于胎位，金气秉令，则木势愈弱，喜其月提酉金，转生时支子水，水由金生，木赖水生，日元转弱为旺，惟仲秋气候渐寒，喜有丙丁之火以暖木，方有蓬勃气象。'],
  ['甲', '酉', '乙', '丑', '日元甲木，时干乙劫幇身，时丑财星？贵，酉丑半会，财化为官，不无木衰金强之象，须地支见有寅亥，先固本根，再有一二点火以温之，格局自臻上乘矣。'],
  ['甲', '酉', '丙', '寅', '甲诞酉提，金旺木衰，时落于寅，强转为旺，一丙高透时干，秋木藉以阳和，喜其火金各？门户，不相妨碍，应以月提酉金官星为重心，一见庚申另？干支，当取伤官制杀。'],
  ['甲', '酉', '丁', '卯', '甲日见卯为刃，酉卯互冲，名为阳刃出鞘，因之甲木势成孤立，补救之法，喜劫比之助，水印之生，方可弱转为强，如比印？缺，迭来土金，可作从杀格论。'],
  ['甲', '酉', '戊', '辰', '甲木坐时支辰土余气，本身微弱，月提酉金遇辰而合，财随官意，加以戊财透时，金赖土生而益旺，八字官淸，自属可喜，惟日元过弱，又为可虑，然则补救此弊，以比印为尙焉。'],
  ['甲', '酉', '己', '巳', '甲生酉提，人尽知其为秋木凋？，巳酉会金，食随官意，时干己土，金再得助，土金结党，秋木不胜其克矣，急须比印同来，尽量加强其身，然后再见火来制金，格局入于中和。'],
  ['甲', '酉', '庚', '午', '八月金气乘旺，木最衰弱，而时干庚杀透露，通根于酉，妙得时支午火制金，遂成秋木火金之大用，惟以日元甲木休囚，不免克泄交加，？宜再见亥寅以充实之。'],
  ['甲', '酉', '辛', '未', '甲木坐库于未，辛金得禄于酉，身官淸润，意畅情舒，官星最喜土财相生，不若旺杀之喜丙丁食伤相制也，惟秋金肃杀，须有一二点水以土金之燥，柱中火多乏水，金其脆矣，为格所不取。'],
  ['甲', '酉', '壬', '申', '甲？酉提，木衰金旺，时落壬申，虽云秋水通源，可以生助衰木，？知申酉皆金生水？强，转使日元甲木，顿呈虚湿之象，须有火以暖之，土以培之，木之生机始畅。'],
  ['甲', '酉', '癸', '酉', '甲木？坐金地，时干之一癸生身，金水义结同心，母旺子衰之象，秋月寒气渐增，须有火以暖木，土以制水，在另一方面，尤喜甲乙寅卯以助身，然后气势和而不悖。'],
  ['甲', '酉', '甲', '戌', '甲比幇身，戌遇酉而成西方之气，见水藏支，润木则生，见火透干，煊木则暖，此八月甲木不可或缺之神也，如天干再遇庚金，地支再来申酉，而水印又纯被土制，作从杀论。'],
  ['甲', '酉', '乙', '亥', '木至秋令，其性已凋，时干乙劫幇身，亥又坐下长生，虽曰秋木休囚无气，党多亦可为旺，如干支再见卯未等字，惟喜金以制裁之，金弱切忌火制，金多制反为？。'],
  ['甲', '戌', '甲', '子', '木诞九月，其性枯槁，戌中丁戊太燥，故须有水润泽，时屈深秋，又喜火以暖木，时干甲比，时支子水，燥木已得润泽之功，喜有庚金透干以制木，金多又喜火之食伤，土旺则须甲木来疏也。'],
  ['甲', '戌', '乙', '丑', '甲生九月，杂气财官，时干乙劫幇身，时支坐丑财贵，财星之势旺，而日元之木弱，如干透火土，地支？见四库，作从财论，否则，喜有水木同来，制土扶身为要。'],
  ['甲', '戌', '丙', '寅', '日元甲木，得禄于寅，时干丙火，又坐生于寅，寅戌又有拱火之情，柱中厚土旺火，木其燥矣，喜有水来润泽，秋木原以庚杀为贵，透干防火制，须有湿土为范，格取财滋七杀。'],
  ['甲', '戌', '丁', '卯', '九秋甲木，时支卯刃，日元不弱，丁火透干泄秀，木火有通明之象，惟以气势太燥，喜有壬癸，木得以润，用金最喜辰丑之土相生，见水泄金，非所宜也。'],
  ['甲', '戌', '戊', '辰', '一木三土，财旺身轻可知，辰中一点乙木余气，竟被戌冲而根拔，如柱中再见火土，当作弃命从财，一见木比水印，从财之格破，反以水木为用矣。'],
  ['甲', '戌', '己', '巳', '己巳并戌，火土得势得地，日元甲木，性转枯槁，须有一水透干，兼得金之官杀相助，然后身财？旺，总之身轻财旺，印比不可或缺也，如柱中絶无印比之神，而见一派火土者，从财乃眞。'],
  ['甲', '戌', '庚', '午', '午戌会成半火之局，一庚高透时干，日元甲木，旣被旺火之泄，又被金杀之克，克泄交加，木其虚弱甚矣，际此情形，独喜水来制火，润金，滋木，气势乃归中和。'],
  ['甲', '戌', '辛', '未', '月时未戌相刑，而土财愈实，日元坐库时未，力量极微，一辛透干，以坐下戌未，燥而不能生金，最喜水印透干，润金生木，则官星淸润，身主健旺，是水实调候之眞神，柱中见之，多多益善。'],
  ['甲', '戌', '壬', '申', '木气絶于申，时干透壬，日元絶处逢生，妙在戌中丁火，暗助木气，吉神深藏，至为可贵，柱中木气微弱水印已足，再见金水相生，则有浮木之患，？宜有木比泄水，日元之根乃固。'],
  ['甲', '戌', '癸', '酉', '时支酉金，日元甲木之胎位，酉戌气秉西方，金气益旺，妙有癸印透干，藉以泄金生木，气势转偏为和，切忌干透庚而支再见申，丙丁之火不可少，此卽假杀为权之说也。'],
  ['甲', '戌', '甲', '戌', '？甲？戌，木土有交战之象，火虽可以解木土之争，但因甲木虚露无根，见火木气益泄，土重？有折木之患，水得金助，润土生木，最要寅卯坐支，方能任此旺财，身财？停，格乃完备。'],
  ['甲', '戌', '乙', '亥', '甲木长生于亥，乙劫幇身，日元根深蔕固，惟九秋气寒，宜以火暖为先，木赖阳和而发荣矣，金气纯淸而？杂，用杀方佳，兼有土以生之，尤佳，木已旺而再见木神，其犹饱而进餐，则必病矣。'],
  ['甲', '亥', '甲', '子', '甲木日元，诞于十月，金休囚而水已进气，时维冬初，寒气益增，用神不离丙丁之火，甲？亥提长生，天干比肩幇身，时支又坐子水，寒水助木，非但不能生扶，抑且有冻木之虞，故冻木以水为病，喜丙戊得地，木方萌芽怒发，并有庚丁得气，益觉美不胜收矣。'],
  ['甲', '亥', '乙', '丑', '日元甲木，月提见亥长生，时乙劫财幇身，丑藏辛癸，气寒愈厉甲木几成忘形，诚能火土同来，并有一丙高透，名为寒木向阳，夏木以火为泄，冬木反泄为生，此五行？外之理，不可？知也。'],
  ['甲', '亥', '丙', '寅', '亥生寅禄，印泄于身，时落丙寅，可谓配合有情，兼之寅亥？合，木之根基愈固，独忌金水迭见，损伤时干丙火，有戊制水以存火，仍？失为上格也。'],
  ['甲', '亥', '丁', '卯', '甲日亥提，木因水而根损，时于卯木阳刃，可以增木之强，培木之气，？妙亥卯半会，去水之病，时丁高透，暖木有情，喜再有金制甲，则丁又暖金，气协情和之造，诚难能而可贵者矣。'],
  ['甲', '亥', '戊', '辰', '甲木得亥中印比相生，日元之根不弱，时値戊辰，财星旺而有余，土财虽可培木，究嫌土湿木寒，丙丁乃调候之眞神，有去寒温木之暖，苟能得地通根，不见水来克制者，格最佳妙。'],
  ['甲', '亥', '己', '巳', '亥可以湿木，时巳可以暖木，惜乎巳亥一冲，暖水去其衰火，时干一点己土，去病之力？足，因之土木皆寒，木之生机不发，故喜有丙丁重见，兼获木以生助，则火自旺而木自暖矣。'],
  ['甲', '亥', '庚', '午', '庚金透干，本是甲木？友，惟冬木见之，独恐生水为病，金生水旺，木必病矣，妙有时支午火，木暖得以发荣，藏支不透，力嫌微弱，喜再丙丁透干，火力乃充，金多固喜火制，木寒又何尝不喜火暖耶。'],
  ['甲', '亥', '辛', '未', '甲日亥提，木得长生，水印转生，时支未土，亥未有会拱之情，身印两旺，未中一点丁火，所谓吉神深藏，暖木有气，时干辛金官星淸澄，喜有土财相生，格取财旺生官。'],
  ['甲', '亥', '壬', '申', '日元长生于亥，时透壬申，杀印相生，八字金水皆旺，木寒有飘荡之象，决不宜再见金水，以促木之生机，所喜土来制水，火来暖木，始臻完美。'],
  ['甲', '亥', '癸', '酉', '时上干支，金水齐来，日元甲木又坐亥提，金水沆瀣一气，殊觉淸澈，惟时屈冬令，木之气势愈寒，有如许金水，不无冻木之虞，喜有火之食伤，土之财星，药投自然病除。'],
  ['甲', '亥', '甲', '戌', '寒木忌水喜土，？命者言之祥矣，时逢甲戌，妙在戌为燥土，去水兼乎培木，而戌中一点丁火，煊木自？可爱，惟忌金水迭出，湿土制火，则有情变为无情矣。'],
  ['甲', '亥', '乙', '亥', '三甲一乙，劫比同来，且有亥中？壬之增寒，木虽旺而嫌湿，救之之法，高有高亢之戊土，驱除其寒湿之气，透干之丙火，暖木精神，格成食伤生财，否则徒见一派水印，木虽多奚益哉。'],
  ['甲', '子', '甲', '子', '天干？甲，地支？子，母旺子相之象，严冬寒气逼人，木性虚湿，若非阳和之气以煦之，安忘其木之发荣乎，所以喜有厚土以制之，木火土三者俱备，自然可贵。'],
  ['甲', '子', '乙', '丑', '甲日子提，时？丑贵，一点湿土，可以助长子水之势，明为培木之根，实则寒木之旺，所以支要寅巳等字，日元之根始固，如再见一丙高透，名为寒谷回春，总之，生旺之地多见为妙，死絶之方不宜再逢。'],
  ['甲', '子', '丙', '寅', '日元甲木，妙得时逢丙寅，火土同生，一点子水藏支，庸又何伤，惟忌金水透干，有伤木之精神，水如太多，须有土来制之，藉收堤防之功，是火土？神，实冬木最切要之眞神也。'],
  ['甲', '子', '丁', '卯', '甲日子提，位？沐浴，冬水生木，生而不生，喜其时支卯木得刃，日元通根而旺，时干旺丁，固不逮丙火之力强，乃以坐下卯木，气旺不亚于丙，水来则丁火受制，金旺有助水之情，多见非所宜也。'],
  ['甲', '子', '戊', '辰', '甲日子提，寒木也，子辰半会，寒水也，以寒水而欲生木，反促成其冻木之势，妙在时干有厚重之戊土，藉以寒木之流，并收培木之功，但以气势欠纯，喜有得地之寅，透干之丙，则木之根基自实，水旣生旺，当以火土食伤生财为中心。'],
  ['甲', '子', '己', '巳', '冬月甲木，归根？命，最喜生旺，独忌死絶，时逢己巳，巳中丙火，得禄，寒木藉以照暖，干透己土，培植木之根基，冬金不能制木，因有寒水泄金故耳，土金非不能为用，有火制之乃佳。'],
  ['甲', '子', '庚', '午', '木？子月，旣寒此湿，时干庚金高透，地支子午相冲，旺者冲衰，午火尽拔，以是本身之弱，槪可想见，故喜支有寅卯，木根乃固，水来，生变为克，火来，泄转为生。'],
  ['甲', '子', '辛', '未', '甲木坐库于未，寒木得以培根，月提子水固寒，有未制之可解，时透辛官，淸纯而正，惟以丁火藏于未库，火之气势？足，最妙一丙透干，木暖而益见生旺矣。'],
  ['甲', '子', '壬', '申', '壬申金水气旺，申子又来会水，寒枝生机尽灭，非有厚土制水，乌能培此木根，水旺切忌再见金助，有金则水必冲奔，而木根尽浮矣，除土以外，丙丁之土，尤不可少也。'],
  ['甲', '子', '癸', '酉', '癸酉为阴金阴水，不如壬申气势之澎湃，惟十一月甲木，无论阴水阳水，胥以少见或不见为妙，戊土固为所喜，丙丁尤为可贵，如单见食伤，则水火必争，故须有火相制，方可全其火之大用。'],
  ['甲', '子', '甲', '戌', '戌乃带火之土，可以培木之气，兼收止水之功，时干甲木，不载于地，似觉天元赢弱，喜支见寅卯，干透甲乙，始克有济，身旺金乃可用，万无喜水之理也。'],
  ['甲', '子', '乙', '亥', '时亥为甲木长生，冬木坐水生寒，乙劫透干，本身不弱，乏土木根不固，乏火则木性不暖，土火？全，木遂蓬勃，尤以子亥为病，而以火土为药。'],
  ['甲', '丑', '甲', '子', '甲诞丑提，冠带之位，斯时天寒地冻，木之生机受阻，丑乃湿土，见子则荡，甲木覆而不载，根虚则木必受倾，急欲有丙丁之火，驱水之寒，固重之土，培木之根，如再来辰丑亥子等字，虽有一二点火土之神，亦觉其病重药轻也。'],
  ['甲', '丑', '乙', '丑', '甲木诞于十二月，天寒地冻，木性盘屈，月时之支，？丑并？，以丑中辛癸深藏沉郁之气未除，时干乙劫望之似可助身，实则木不能助，必须有丙寅戌未等字，万象乃转淸新，火土？缺，病重药轻矣。'],
  ['甲', '丑', '丙', '寅', '丙寅为木禄火生之地，寒木有火透干，配合可谓有情，十二月甲木，以取食伤生财为上格，食神制杀亦可喜，命书云，冬月甲木，火重不厌，水泛非祥，二语意义安在，盖首重调候二字耳。'],
  ['甲', '丑', '丁', '卯', '卯为日元甲木之刃地，时干透丁，暖木？足，须有甲木多助，亦可发丁之焰，甲多日丁，用等于丙，冬木以重见金水为忌，水多乏土，则木？寒湿。'],
  ['甲', '丑', '戊', '辰', '甲木得余气于时支之辰，时干戊土？财，通根于丑，一木三土，显系身弱财多，喜有木以助身，制去土财之病，？妙火之食伤，用之温暖土木之性，如柱中印比不见，再来一派火土者，可作当令之从财格。'],
  ['甲', '丑', '己', '巳', '暮冬万卉阑栅，为甲木休囚之地，月提丑土，因丑藏癸辛而增寒，妙乎时逢己巳，丙火坐禄，有寒谷回春之象，时干一己合甲，名为财来就我，适为我用，富丽堂皇，苟有一二点木以助之，益觉情协气和矣。'],
  ['甲', '丑', '庚', '午', '时逢庚金，得库于月提丑土，七杀可谓有气，日元甲木无根，身杀难见？停，所喜时落午火，杀化威权，兼以暖木之寒，如有木比通根相助，格取伤官制杀。'],
  ['甲', '丑', '辛', '未', '甲木得库于未，尤为日元贵人，冬木赖以盘根，惜乎丑未一冲，未中乙丁皆伤，时干辛官，坐库于丑，淸纯不浊，纵以辛官为用，尤应先见木助，至于水之印绶，柱中切忌见之。'],
  ['甲', '丑', '壬', '申', '壬申金水？旺，冬木受害匪浅，木弱不胜土财之制水，祗有用木比以泄水，较为相宜，惟不问其水旺木弱，与夫木旺水弱，寒则一也，独有火之食伤，身弱得之，则成反生，身旺得之亦足见珍。'],
  ['甲', '丑', '癸', '酉', '癸酉？神，性皆属阴，木寒岂喜见之，日元甲木？酉，较坐申金尤弱，且酉丑半会金局，木根尽枯，欲去其病，须有木以助之，火以暖之，土以培之，三者咸备，格自佳矣。'],
  ['甲', '丑', '甲', '戌', '天干双甲，地支双土，木土交战，财星被夺，按之比财相峙，妙有火来通关，则成木火土三神成象，卽或不以通关论，在兹寒冬？月之木，又非火暖不可，但因身弱旺财，木神？不可或缺也。'],
  ['甲', '丑', '乙', '亥', '甲木在亥为长生，时干劫财，又来助身，日元得地通根，可谓旺矣，惟丑亥中金水归旺，有损木之精神，喜丙丁之火，以全木之生机，金可生助旺水，土来何妨见金，总之，木寒不发，见火乃荣。'],
  ['乙', '寅', '丙', '子', '初春乙木，余寒未制，须有阳和照暖，万卉乃荣，书云，乙性至柔，最喜怀丁抱丙，时干丙火，通根寅题，时支子水，润木有功，一暖一润，格局美备，所忌者，有壬癸损丙，木之生机殆尽矣。'],
  ['乙', '寅', '丁', '丑', '乙木见寅，藤萝系甲，木之根基极固，时逢丁丑，财星之力亦强，身财？旺，自可以财为用，水印乃春所不可少，然多水亦防困火，若有土以制水卫火，仍不失为格之佳者。'],
  ['乙', '寅', '戊', '寅', '初春木渐转旺，月时？寅坐支，日元气势充沛，兼有寅中？丙照暖，身旺得泄，自诚可贵，一戊透时，财为我用，柱中少水，不免春旱。'],
  ['乙', '寅', '己', '卯', '乙日坐寅禄于卯，木气生旺可知，时干一点己土，？于木旺之上，名为截脚，身强财轻，自喜火以扶财，如柱中重见木神，则当以曲直格论之。'],
  ['乙', '寅', '庚', '辰', '乙日寅月，时逢庚辰，身旺足可任官，初春乙木，最要木气暖润，但旣以庚金为用，则独喜土以生之，水多反来泄金，火多反来制金，书云，用神不可损伤，诚哉是言。'],
  ['乙', '寅', '辛', '巳', '木火？旺，身旺泄秀，时干辛金，以火旺于金，制杀不免太过，火旺金弱，独喜土来泄火生金，有柱中木气太燥，又喜一二点水以润之。'],
  ['乙', '寅', '壬', '午', '乙日寅提，劫财幇身，时落午火，与月支寅木会成半局之火，劫化为伤，日元旺转为弱，时干一壬高透，旣济成功，虽然寒暖得中，身主究属旺气？足，不可不见劫比相助也。'],
  ['乙', '寅', '癸', '未', '日元乙木，时支未土，寅未中丙丁？见，寒木赖以阳和，时透癸水，坐下未位水印弱而无根，格局不免太燥，所喜支有带水之金相济，自不陷于偏枯矣。'],
  ['乙', '寅', '甲', '申', '乙恃月提寅木而得根，名为藤萝系甲，寅申互冲，木火之根尽拔，而申中所藏壬印，转辗又被寅中戊土所伤，单见时干甲比，幇身力量微矣，祗要地支有子辰等字，则申金贪会忘冲，寅中木火生矣。'],
  ['乙', '寅', '乙', '酉', '时乙幇身，月提坐寅，本身弱转为旺，时支一点酉金，七杀藏而不露，初春金寒，无裨木之大用，正喜其藏而不露也，祗要透丙暖木，自然敷荣畅茂矣。'],
  ['乙', '寅', '丙', '戌', '寅戌拱火，丙又透时，木轻火重，似以过泄为病，且有燥渴之虞，必须水以润之，木以实之，？见丑辰湿土以泄气旺火，五行气和，乙木自然条达矣。'],
  ['乙', '寅', '丁', '亥', '日元乙木，旺于寅，生于亥，寅亥？合，木根愈固，亥中所藏壬印，木燥赖以得润，暖润？全，气归中和，柱中喜再有一二点土，名谓食神生财。'],
  ['乙', '卯', '丙', '子', '二月乙木，月令建禄，木旺而？有比禄助之，木之根气益固，时逢丙子，旣暖且润，配合佳妙，庚辛之官，壬癸之印，祗要淸而不杂，略见抑有何妨，金少水多，有损木之情神，唯喜火土为用矣。'],
  ['乙', '卯', '丁', '丑', '月提得禄，时干透丁，木乃可谓生旺，时丑财星得库，身旺足任斯财，金水？神，为春乙不甚适宜，但少见亦有润木之功，如木火重见，反喜水印以调候。'],
  ['乙', '卯', '戊', '寅', '乙木迭逢禄旺，丙戊？见长生，木生火泄，气足神充，时透戊土，明虽坐下寅木，财被劫夺，实则寅亦财之生地也，然则身与伤财三者同旺，格取伤官生财，自然无疑，得有一二点水以润燥？妙。'],
  ['乙', '卯', '己', '卯', '支见？卯，日元精强力壮，时干己土，？于卯木比地，虚而？实，非有通根得地之土以助之，财终不为我用，际兹阳壮木渴之情势下，尤喜见有辰丑湿土为范。'],
  ['乙', '卯', '庚', '辰', '柱中木土？停，其身堪以任财，时透庚官，赖辰生金，而官星益淸，可以时上一位贵论，若见丙丁透干，官星被伤，壬癸透干，官气被泄，用官最喜生财，见克见泄，均为官星之病。'],
  ['乙', '卯', '辛', '巳', '乙木得禄于卯，时逢巳位为之泄，一辛透干为之克，禄，克，泄，三者相较，衡其孰轻孰重，自然休囚之财杀，难敌旺木，当以时干辛杀为用，所喜辰丑之土同来，则？气旺而根亦得润矣。'],
  ['乙', '卯', '壬', '午', '卯午同来，比？于食，乙木之英华之泄尽，妙得时干透壬，可以制火之炎，润木之燥，兼以生扶孱弱之身，柱中火气已足，再来丙丁则忌，若水印多见，木之元气可？。'],
  ['乙', '卯', '癸', '未', '天干癸乙相生，地支禄库根足，木气弥见生旺，如干支再见水木相助，象成方局，当顺其旺势，作曲直仁寿格论，旣成此格，克木泄木最忌，否则仍以火土食财为喜神。'],
  ['乙', '卯', '甲', '申', '月提建禄，甲木透干，木之气势极旺，时支申金，官印相随有情，柱中有土生金，当以财官为用，如支中再见子辰等字，申化为水，则必以土财为贵也。'],
  ['乙', '卯', '乙', '酉', '以失时之酉，冲当令之卯，岂可得乎，又乙比透干，仍以身强论，喜火土吐秀，若多金克木，有水不妨，水能润木，除非过多，总属喜见也。'],
  ['乙', '卯', '丙', '戌', '卯戌？合，木火同情，一丙透干，木气尽泄，伤旺身弱彰彰明矣，书云，身轻泄重，佩印为宜，印者水也，有水生木，日元自然转旺，此木火炎燥，？喜水以调和其气也，身弱而有木以助之，亦佳。'],
  ['乙', '卯', '丁', '亥', '一亥一卯，木得润，势犹蓬勃，时透一丁，气怯而微，须有他火以助长气势，方成木火通明之象，如见金之官杀，自应舍火以用金，？喜土再生之，金如太旺，用火制杀为权。'],
  ['乙', '辰', '丙', '子', '乙生暮春之月，阳气愈炽，木气犹？，癸丙为不离之眞神，乙日辰提，木有余气，而辰土财星当旺，时逢丙子，辰子半会水局，财化为印，乙木赖以润泽，时干丙火高透，泄秀有情，如再有一二点戊己之土，可作伤官生财格。'],
  ['乙', '辰', '丁', '丑', '三月乙木，春深木？，时干透丁，木以照暖，辰丑土财得地，财星可云得气，妙在丑中辛癸相生，木得调济，八字暖润？备，惟日元稍弱，有寅卯等扶助之，尤为可喜。'],
  ['乙', '辰', '戊', '寅', '时落戊寅，乙木根深，月提辰土之财，透于时干，以我身之旺，足以敌之，柱中寅辰乙戊，木土有交战之象，气有未协，所喜丙丁透干，构通比财之情，则木火土息息相生矣。'],
  ['乙', '辰', '己', '卯', '乙木日元，卯辰气转东方，身旺可知，时干一己，坐于卯木之上，虽时値土令，究不免被木所损，身旺财弱，须有火以弥缝其厥，使其财身？停，兼有一二点水以润之，则财星自然归眞，而其气势，亦可？通门户矣。'],
  ['乙', '辰', '庚', '辰', '乙木二辰，木弱而土气较旺，但，辰中有？乙余气，生扶日元，其身足任土财，身旺自喜财旺，用财尤喜火之食伤，有时干庚金高透，支土尽泄于金，春乙不宜金旺，故？得不藉火而去其病也。'],
  ['乙', '辰', '辛', '巳', '时干辛杀攻身，时支巳火生辰，火金土气势？通，独于日元乙木，汒不相关，未能？系，身弱慨可想见，唯喜水印多见，自然金泄火制，而本身加强矣。'],
  ['乙', '辰', '壬', '午', '月値辰土当旺，时支午火转来生土，财星得气极矣，乙木仅恃壬印所生，力犹？足，喜有寅卯等字通根生助，则堪以食神生财论矣。'],
  ['乙', '辰', '癸', '未', '乙木日元，余气于辰，木虽得根，土财？旺，时干一点癸水，阳盛转为湿润，如再来戊己之土，则成财旺身弱，寡？适中，须见金泄，转来生水，或另有木比，身财始，？停。'],
  ['乙', '辰', '甲', '申', '申辰拱水，官星泄之于印，时干甲木劫财，助乙而旺，水木旣足，自不宜再见印比之神，庚辛之金，阴木不宜多见，盖性柔而不胜其斧斤之削伐也，土金迭见，又安得不藉火以制之乎。'],
  ['乙', '辰', '乙', '酉', '天干？乙并？，地支辰酉会金，木坐金地，木气皆损，其身之弱，槪可想见，喜有印比水木相助，木之根气始固，金如透之干头，？非火制不可也。'],
  ['乙', '辰', '丙', '戌', '乙日辰提，时坐戌土而冲辰，辰中癸印乙比，去之殆尽，时透丙火，泄身生土，财气旺矣，非有木以助之，从属身弱，且八字涉于枯燥，？非水印相润不可。'],
  ['乙', '辰', '丁', '亥', '乙木余气于辰，长生于亥，木赖水滋，生气？动，时干丁火，气虽？足，生财有余，气亦和协，所喜再来火土，支配益见适当。'],
  ['乙', '巳', '丙', '子', '巳月乙木，位居病地，斯时火势炎炎，木性枯憔，专以癸水为至尊之神，月提値巳，时透丙火，日元乙木，泄之殆尽，时支一点子水，妙收湿润之功，惟滴水？涸，非有庚辛申酉，不能发水之源，盖金为生水之神，夏木不可或缺也。'],
  ['乙', '巳', '丁', '丑', '乙日巳提，火旺木泄，气势之弱，危乎殆哉，时干一丁透干，火势益？，妙在时支丑土，中藏癸辛，不惟可以纳火之气，且可收润木之功，巳中一点庚金，火旺不能为用，乃喜辛癸或庚壬同透，扶助木之精神，五行不致偏枯矣。'],
  ['乙', '巳', '戊', '寅', '巳月乙木，最忌火炎土燥，巳月时寅，木火？旺，一戊透时，土？非？，日元乙木被困，生机损伤，火旺喜有水以济之，土燥喜有金以泄之，金水？全，木气自然蓊郁矣。'],
  ['乙', '巳', '己', '卯', '木气毙于泄方，长于生方，巳月乙木，乃泄而非生也，时支卯木，见火必生，火旺？有木之相生，气势？甚炎炽，有谓乙木得禄于卯，身旺之征，岂知夏月之木，不以劫比幇身为旺，乃以水印调候为贵，金来助水为喜也。'],
  ['乙', '巳', '庚', '辰', '夏木以旺火为病，金水为药，除外格不以正五行取之者，可以一理同推，时逢庚辰，辰中一点癸水，润此夏金，辰乃湿土，又可纳火之气，木得水则木之气生，巳见辰则火泄于土，气势纯粹可观，但喜壬癸再透干，益见活泼矣。'],
  ['乙', '巳', '辛', '巳', '月时？巳，火旺木焦，时干一辛，坐巳成燥，因之日元乙木，旣被伤官之泄，又以庚辛之制，克泄同来，乙木安望其生，救之之法，壬癸乃当务之要神，急宜重重相见，方能挽回木病。'],
  ['乙', '巳', '壬', '午', '巳午气秉南方，火旺木成灰飞，时干壬水，坐于旺火之地，其力微矣，以此一点无根之水，而欲调济弱木乌乎可耶，然则，能有申亥等字以补苴之，则自木生而有救矣。'],
  ['乙', '巳', '癸', '未', '乙木日元，时坐于未，月提巳火，遇未而土火皆旺，殊有燥木之嫌，干透一癸原可收其雨露湿润之功，乃以？于未位，不通根气，虽有若无，故喜局中再有金水，方能成其大用。'],
  ['乙', '巳', '甲', '申', '乙木坐巳为病，见申为絶，巳申？？支位，木气可谓虚脱，？知申巳气转？合，病火因以牵绊，书云，喜神忌合，忌神喜合，？非虚语，且也，申中壬水得生，扶助日元，喜再壬癸透干，官印相生。'],
  ['乙', '巳', '乙', '酉', '乙木劫财幇身，巳酉半会金局，状成金见木缺，杀旺身轻，夏乙木不喜劫比，但于木无根气之时，亦喜有一二点木以助之，而水印又不可无，身以健朗为美，杀有印化为贵。'],
  ['乙', '巳', '丙', '戌', '时干丙火，坐禄于巳，得库于戌，火势炎热，乙木自焚，兼之戌为燥土，非比辰之土可以培木，是则病神在火，固无疑矣，欲去其病，舍水莫属，有水则火气自怯，再有一二点金以助水，木性自然华秀矣。'],
  ['乙', '巳', '丁', '亥', '巳亥一冲，水火？败俱伤，夏木以火为病，反以冲之为美，惟时干一丁，火势仍未减退，喜有庚辛同来，生助？足之水，则木自得生，而火气自怯矣。'],
  ['乙', '午', '丙', '子', '五月火旺土燥，禾稼皆枯，用神亦不？癸水，地支子午一冲，以斯时火旺水弱，大有水不胜火之槪，时干一丙高透，乙木气散南离，故喜有通根得地之水，遂收坎离旣济之功，土财非不可见，特亦喜湿而忌燥也。'],
  ['乙', '午', '丁', '丑', '时维仲夏，木弱火旺，时支丑土，泄火有功，丑中所藏辛癸，？量极弱，生木？足，喜有水以润之，金以生之，方可全夏木生机，再见旺火燥土，格局陷于偏枯矣。'],
  ['乙', '午', '戊', '寅', '日元乙木，地支寅午半会，劫化为伤，炎炎之势，灸手可畏，此时乙木几乎化为灰烬，干支再见木火，格取从儿，否则惟以水来调候，金来发水之源为贵，一见戊己杂出，木之精神尽失矣。'],
  ['乙', '午', '己', '卯', '乙木得禄于时支之卯，似乎日元有根，卯午相遇，木从火势，时干己土，坐下卯位，虽？制尽，从属土燥难培，所喜金水生旺，润木为先，夏木专取杀印相生，舍此可谓莫属矣。'],
  ['乙', '午', '庚', '辰', '五月辰时，旺午为辰土所泄，日元得余气于辰，虽是身弱，乃辰为湿土，培木之力极大，时干庚金，又喜有辰土生扶，官星淸而得净，配合完备，若有一癸透干，正合木火伤官佩印之妙。'],
  ['乙', '午', '辛', '巳', '乙木无根，徒见巳午旺火之威胁，几无存在之可能，辛坐巳地，巳虽金之长生，又安能敌此火制，惟水可制火润金，以养全局，关键在此一神之有无耳。'],
  ['乙', '午', '壬', '午', '五行配合，原有规定，如金水伤官，喜火而憎水，木火伤官，恶火而喜水，用神适得其反，究其理，亦无非重在调候？字，乙木？？午火，木气尽泄，妙得壬水盖头，坎？得济，惟以印绶无根，水之气势？足，喜有申亥等字金生水发，源流自然悠长矣。'],
  ['乙', '午', '癸', '未', '乙木盘根于未，午未？合，木燥根枯，生机尽灭，时干一癸以坐下未土，不能引以为用，所喜水来通根，兼有金发其源，用神自然生动，土财为夏乙所忌，多见？有涸水之忧也，'],
  ['乙', '午', '甲', '申', '日时甲乙？？，坐下午申泄克之位，视之若无根，？知申中壬水，得以化官润木，日元弱而不弱，是壬印乃旋乾转坤之神，与夫乙木之旺衰，关系殊非浅鲜，喜再干透水木，生机益形奋发矣。'],
  ['乙', '午', '乙', '酉', '乙？午火为泄气，乙坐酉金为截脚，？乙并坐克泄，本身衰弱可知，仲夏火正司权，大忌丙丁再透，？忌戊己杂乱，祗要金水得地而有气，八字淸润可观矣。'],
  ['乙', '午', '丙', '戌', '午戌会火而透丙，日元菁华泄尽，夏木以火为忌，此造偏全南方之气，格局转成木火从儿，惟以夏火旺不可遏，亦喜土财泄火之秀，所谓儿又生儿是也，如柱中金水得地，则当弃从儿而以木火伤官佩印为用也。'],
  ['乙', '午', '丁', '亥', '月提午火得禄，时支坐下亥水，水火旣济有情，惟五月乙木，独喜癸水润泽，兼有金来相助，格局始臻完备，至于戊己杂乱而伤水，？喜劫比制之为？。'],
  ['乙', '未', '丙', '子', '？月乙木，其性转寒，除柱中金水势成方局，而用火暖木性以外，总不？壬癸庚辛，乙木得库于未，一丙透于时上，有木明火秀之象，时支一点子水，可以润土养木，四柱不宜再见食伤之神，以防涉于偏枯，金水同来而得用，气势自可双淸。'],
  ['乙', '未', '丁', '丑', '日元乙木，时坐于未，时支丑来冲未，土势转旺，财重身轻可知，？见一丁透干，火又？生于土，全局皆属于财，财旺防木折，故喜有金泄土而去病，一方面又须有水印生身而转强，以成中和纯粹之局。'],
  ['乙', '未', '戊', '寅', '乙木得根于寅未，戊土透于时干，上下左右，势成木土交战，夏月火土同旺，格局涉于枯燥，必须有水印及金，互相调济，如再多见土木，比财尤形争夺矣。'],
  ['乙', '未', '己', '卯', '卯未半会，日元栽根甚固，时透一己，坐下卯木而被去，？月火渐退气，身旺亦可稍见火以泄之，藉以？通，水印乃调候之神，勿论身之强弱，总须有一二点也。'],
  ['乙', '未', '庚', '辰', '日元得根于未，余气于辰，乙木之根已固，时値土旺，辰未财星亦旺，可谓身财？停矣，时干庚金高透，以坐辰位，官星极淸，惟尙须一二点水以济之，则身财官印，气协而情和矣。'],
  ['乙', '未', '辛', '巳', '巳未气成南方，日元泄之太过，时干辛金，因火势太旺，金气有损，因是旺火燥金，？失其全，所喜水印频来，则火不炎，金不燥，木得润而生全矣。'],
  ['乙', '未', '壬', '午', '午为旺火，未乃燥土，火土同来，木其焦矣，时干一壬高透，得以调济木之情神，惟此时水气休囚，要支有亥子，通根得地，否则水不敌火，喜有金以生之，寒暖湿燥，乃得均衡。'],
  ['乙', '未', '癸', '未', '日元？坐未土库地，乙木根深蒂固，未中？见丁火，木气暗泄为病，时干一癸？于未土之上，力弱不能生木，须有水来协助，金来发源，去其浊而？其淸，则得之矣。'],
  ['乙', '未', '甲', '申', '时逢申位，官印暗化有情，甲木透干，日元赖以生扶，？月乙木，土正当旺，时申得以相生，喜有庚透干，官星独发而淸，再见水印同来，官印得以相随，如见丙丁透一，则官格有破矣。'],
  ['乙', '未', '乙', '酉', '？乙通根于未，日元气势充足，时支藏杀而淸，身旺假杀为权，最喜土财来生，此系财滋七杀，如柱中庚辛申酉齐来，方喜火以制之，若制之不能，用印化之可也。'],
  ['乙', '未', '丙', '戌', '丙火坐库于戌，伤财之势极旺，日元乙木，偏枯已极，须有水来调济，金来发源，方可收旣济之功，旣以火旺为病，金润为药，柱中有水无金，或有金无水，均非完美之象。'],
  ['乙', '未', '丁', '亥', '日元长生于亥，余气于未，亥未半会木局，财化为比，以言身主，可谓旺相极矣，妙在时透一丁，秀气？行，？有一二点土，可作食神生财取用，身旺当为比劫为病，克泄为药，惟此时火气未除，勿论身强身弱，水印终喜见之。'],
  ['乙', '申', '丙', '子', '乙诞申提，火退而金正秉令，夏乙忌火，防其木焚，秋乙忌金，防其根损，同是一乙，喜忌则随时令而变迁也，地支申子会水，官化为印，日元有印相生，乃是弱而不弱，时干一丙？于子水之位，殊未能助木之暖，气势未纯，应有寅卯巳午等字以充实之。'],
  ['乙', '申', '丁', '丑', '申丑中庚辛？见，乙木无气，丑土虽可培木，究嫌力微，时干一丁，气又泄之于土，所忌再来庚辛，摧残木之精神，总以水火为切要之神，故喜其？见为美也。'],
  ['乙', '申', '戊', '寅', '寅申之冲，旺存衰拔，日元之气衰弱极矣，一戊透于时干，财星亦失其眞，际此情形，喜有比劫相助，强身为先，？有火以暖之，气势遂归中和矣。'],
  ['乙', '申', '己', '卯', '乙木生于七月，絶地也，时支卯木，归禄成格，喜其乙庚暗合，官星淸纯为美，时干己财，？于卯禄之上，土财自难受载，财弱喜有火以助之，格取食神生财。'],
  ['乙', '申', '庚', '辰', '乙木余气于辰，庚金通根于申，时支辰土又来生申，书云，乙木忌埋根之铁，盖所以防秋乙之损伤也，幸申中一点壬水，足以化此顽金，官淸本不宜制，但于秋乙逢金之情势下，有火制之为美。'],
  ['乙', '申', '辛', '巳', '申中庚金得禄，巳中庚金逢生，加之时又透辛，以迭迭当旺之金，制裁此枝叶凋败之死木，正如摧枯拉朽，还赖巳火制杀之逞，不过日元究嫌微弱，总须有印比相助为美也。'],
  ['乙', '申', '壬', '午', '乙日申提，木之气势极弱，时干壬水通于申，望之似可生木，？知秋乙气弱，水旺木浮，所谓水能生木，水旺亦能病木，此所以滴天髓有木不受水之说也，惟其母旺子虚，故独喜土以制之，火以暖之，木以成之，三者配合适宜，格局自臻上乘矣。'],
  ['乙', '申', '癸', '未', '未时中藏乙木，时干一癸，土润木生，月提申金官星，又为壬印所化，金泄于水，水来生身，日元赖印以固，时支未藏食财，身旺适为我用，喜再有火土，益见暄炽。'],
  ['乙', '申', '甲', '申', '乙木坐下？申，明为絶地，实则申中有印，格成杀印相生，一甲値时，究以坐下申金，助身之力极微，若柱有寅亥等字，身主自？旺相，再见金透，用火制之可也。'],
  ['乙', '申', '乙', '酉', '天干？乙，地支申酉，埋根之铁，？损休囚之木，妙在月提申金，中藏壬水，杀旺有印得化，但申酉究属当令之金，仍喜有火制之，有水化之。'],
  ['乙', '申', '丙', '戌', '丙火得库于戌，火土？旺，日元乙木之气，藉以温暖而舒适，惟柱中旺气微弱，似难任此伤财，故喜支有寅卯亥未等字，先固其本，否则徒多克泄，奚有益于我哉。'],
  ['乙', '申', '丁', '亥', '乙木长生于亥，身主弱而不弱，申亥？见壬水，印旺自可生木，？知时値秋令，木气渐凋，水旺有寒木之嫌，妙得一丁透于时干，略以驱水之寒，暖木之寒，大忌金来生水，土财为去病之神，何妨得地透干。'],
  ['乙', '酉', '丙', '子', '八月金正秉令，乙木衰弱已极，时支子水，赖酉金以生，时干一丙，可以除寒增暖，惟木根虚脱，火亦微弱，尙欠精神，秋木以得根为最要，其次火亦不可小。'],
  ['乙', '酉', '丁', '丑', '乙木日元，？于酉提，时支一丑，财星藏而有根，乃以酉丑半会，财星化为七杀，日元之乙，势成有克无生之象，须重见此印，始可转苏。'],
  ['乙', '酉', '戊', '寅', '乙木日元，全赖时支寅劫幇身，月酉为杀，时干为财，杀有财助，杀势愈旺，妙在寅中丙火得生，可以暗制杀之肆逞，金杀不能再见，木火重逢方喜。'],
  ['乙', '酉', '己', '卯', '时卯归禄入格，月提酉冲格破，时干己土财星虚露，不能培木，因之日元乙木，势成孤立，要木比之助，水印之生，故先寻寅亥以补之，如水木？付厥如，？有土金频来，则当顺其势而从杀矣。'],
  ['乙', '酉', '庚', '辰', '乙木余气于辰，日元根气极微，月提酉金，遇辰而合，时逢庚金，又乙则化，时维八月，化金正値当令，苟有土金再来助其化身，格取化金无疑，如化金不成，仍以制金泄金之水火？神为贵。'],
  ['乙', '酉', '辛', '巳', '巳酉半会金局，时干辛金又来助杀之旺，日元乙木，孤立势成，杀重身轻，救之之法，喜有水印以化之，谓杀印相生，如印伤？缺，再见一波金气者，格成从杀。'],
  ['乙', '酉', '壬', '午', '乙木？酉为克地，见午为泄地，地支克泄？见，日元之根枯矣，所喜时干壬水，可以藉印生身，？须有寅卯等字以助之，如徒见水印迭来，又不免母旺子虚矣。'],
  ['乙', '酉', '癸', '未', '时干癸印生身，日元不以弱言，月提酉杀虽旺，有癸水化之，未丁暗藏制之，自然不来伤身，妙在土金水木一气呵成，惟以木在秋令，火之食神，愈多见为愈美。'],
  ['乙', '酉', '甲', '申', '天干甲乙，？于酉申之地，金坚木缺之状，秋木气値凋？，焉能受旺金之摧残，喜见丙丁，去此旺金之病，但火金总系克泄之神，身弱尤须木比水印为先也。'],
  ['乙', '酉', '乙', '酉', '日月时乙酉？见，木坐金地，金坚木缺，须寅亥得根，加强本身之气，惟金木气势未惬，火又不可或缺，有火则？意情通，乏火则怨起恩中，所以木比与火之食伤，诚秋乙唯一之眞神也。'],
  ['乙', '酉', '丙', '戌', '乙木日元，诞于八月，其气休囚已极，时逢丙戌，财赖伤生而气足，木赖火暖而气充，月提酉杀虽旺，见火无能为力，喜干支再见甲乙寅亥以助之，木根旣具，丙伤遂可得用矣。'],
  ['乙', '酉', '丁', '亥', '乙木日，亥水时，亥中壬印生身，秋木虽弱，印劫得地而转强，月提酉金七杀，遇亥则金泄于水，杀又化印，时干丁火，坐下水地，水力嫌微，喜他火以助之，取其身旺泄秀。'],
  ['乙', '戌', '丙', '子', '九月木性枯燥，不能无水以滋养，月提戌土当旺，藏丁而土势转燥，时丙坐于戌，盗泄乙木太过，而时子又被提戌所制，精神全缺，病在于燥，须水来为之润湿。'],
  ['乙', '戌', '丁', '丑', '日元乙木，坐下戌丑之财，木衰土旺，颇有折之之象，所喜丑中辛癸同来，一个元机，暗中有生木之情，惟辛癸藏而不露，生木之力尙微，苟另有劫比以实之，印透以生之，则我不困于旺财，而旺财被我？用矣。'],
  ['乙', '戌', '戊', '寅', '乙木得根于寅，斯名藤萝系甲，时干戊土正财，以通根月令而愈旺，谓其身财？停可矣，惟木土上下交战，不无相峙之象，而有争财之势，丙丁乃调和之神，兼可暖木之气，柱中急应见之，此外尤喜有一二点水以润之。'],
  ['乙', '戌', '己', '卯', '乙木得禄于卯，己土种根于戌，身虽旺而财星？旺，时値深秋，木土皆燥，必须有水润泽，金来发水，方免偏枯况秋木原以水为眞神，见之自？可贵。'],
  ['乙', '戌', '庚', '辰', '乙木余气于辰，辰戌一冲，木根尽拔，而土气转旺，时干庚官独透，坐辰而官星益淸，财官虽淸，无如身不能任，急须有劫比为助，印绶来生。'],
  ['乙', '戌', '辛', '巳', '月戌时巳，火土得地，时干辛金得生，火土金三神均旺，独日元乙木孤立，急宜水木同来，生扶日元之弱，抑其太过而补其？足，象成中和，斯为美矣。'],
  ['乙', '戌', '壬', '午', '午戌会火，乙木之气尽泄，一点壬水透干，燥木转为湿润，火势太旺，水木皆弱，旺弱不均，允宜扶弱抑旺，如再见火土杂出，身印絶无根气，则当从其火土之势，而以从财论命矣。'],
  ['乙', '戌', '癸', '未', '乙木秋生，枝叶枯萎，无力任当旺之财，时逢癸未，未又燥土，愈觉财多身弱，癸虽生气，因坐于未，生木之力极微，必须柱中再有金水，则旺土得金而盛气泄，弱木得水而生意足矣。'],
  ['乙', '戌', '甲', '申', '甲乙？见天干，地支坐下戌申，财官旺而身弱，妙在申中一壬，乙木絶处逢生，喜再木比相助，扶持精壮，否则虽有迭迭之土金财官，从恐难为我用耳。'],
  ['乙', '戌', '乙', '酉', '九秋土旺金相，乙日再遇酉时，酉戌同位西方，财杀甚旺，乙木太柔，时上比肩，似可幇身，无如自絶于酉，欲助无能为力，须有阴水暗滋，或寅卯以通？乙之根，土与金皆大忌也。'],
  ['乙', '戌', '丙', '戌', '乙木支？？戌，时干一丙高透，木性枯燥已极，喜有水透制火润木，方全旣济之象，木弱本可赖印相生，木太弱，？不可乏比为助，如比印？无，再见旺火结党者，可作从儿格论。'],
  ['乙', '戌', '丁', '亥', '乙木根种于亥，亥被戌制，然亥中甲木回克而护印，因之乙木虽弱印生转旺，时丁坐于亥地火气欠足，喜有丙透，加取伤官生财。'],
  ['乙', '亥', '丙', '子', '十月乙木，生气渐展，斯时水势正旺，气又严寒，重在丙戊？神，乙日亥提，木？长生之位，惟亥子气属北方，木有寒冻之虞，时干一丙，坐下水地，火力似觉微弱，故喜火土得地，寒木遂得向阳。'],
  ['乙', '亥', '丁', '丑', '日元乙木，月提亥中壬甲？旺，木气得根，惟气势太寒，时落丁丑，火又泄之于土，食衰财旺之象，且亥丑金水根深，不无冻木之忧，喜支见戌未燥土以鎭水，干透丙火以暖木，于是木之生机蓬勃，可无窒碍矣。'],
  ['乙', '亥', '戊', '寅', '乙木日元，月亥为木之生地，时寅乃木之禄地，身主根深，旺不待言，十月乙木独以见水为病，亥水藏而不露，且有亥中甲木之泄水，虽旺而无碍于木，妙在寅中丙戊之气生旺，诚药重病轻之造也。'],
  ['乙', '亥', '己', '卯', '日元乙木，得生于亥，坐禄于卯，亥未半会木局，木之根气固矣，时干己财，坐下比地，是谓不载，其财等于虚设，喜有火透，兼有得垣之土，名食伤生财。'],
  ['乙', '亥', '庚', '辰', '乙日亥提，木气得生转旺，时逢庚辰，官星气足，庚金情然于乙，名为官来就我，身旺官纯，亥辰？藏壬癸，木之气势增寒，喜见火来驱寒，向阳之木发荣矣。'],
  ['乙', '亥', '辛', '巳', '乙木日元，亥提藏壬，水木相生，又巳火暖木，？知巳亥一冲，水金木火皆受伤，书云，库地喜冲，生地忌冲，因冲而日元由旺转弱，喜支见寅卯合亥，当可忘冲于巳，然后巳乃可用。'],
  ['乙', '亥', '壬', '午', '乙木日元，月提坐亥，时干透壬，身印可谓？旺，冬木独怨水印透干，盖寒冬木气收敛，水旺唯恐木浮，喜其时支午火，足以除水之寒，暖木之气，惟水盛火弱，还宜他火以补之，或有土以制水。'],
  ['乙', '亥', '癸', '未', '乙木日元，亥未有拱木之情，木之气势转旺，未中一点丁火，温木有功，所谓吉神深藏是也，时干透出癸水印绶，喜其坐下未土，忌神力弱，不致冻木，若有火土食财重来，益见美妙矣。'],
  ['乙', '亥', '甲', '申', '甲乙？透干头，归根于月提之亥，日元通根气壮，时申藏壬，亥中又藏壬，？有申金之生，水势之旺，与透干无异，冬木见此旺水，必须有土之制，火以暖之，则木之生机，方可转见生动。'],
  ['乙', '亥', '乙', '酉', '乙日亥提，劫印？全，日元气禀中和，时支酉金七杀，虽属通根，而其情则归之于亥，旺水有金相助，自然气势益充，惟时屈冬令，水寒木冻，须有带火之土，则忌神去而木自繁荣矣。'],
  ['乙', '亥', '丙', '戌', '乙日亥提，木气根重，斯时水正乘时得势，有增木寒，喜其时逢丙戌，戌乃燥土，可以制水之病，丙乃阳火，足以暖木之气，书云，冬木以生为泄，而以泄为生，今于此造可见一班。'],
  ['乙', '亥', '丁', '亥', '乙木日元，月时？逢亥生，身主得地通根，亥中？壬得禄，水旺成冲奔之势，时干一丁，坐下亥水之地，火力微弱可知，急须支有干燥之土，去水之病，干透重迭之火，暖木之气，如再见壬癸透干，水泛木浮矣。'],
  ['乙', '子', '丙', '子', '仲冬严寒凛冽，乙木枝叶皆悴，非有阳火解冻，木无生气，乙日子提，坐下水印，时支又见子水，生而反克之象，时干丙火，阳气虚脱，？足以除寒，身弱独喜寅卯等字，火土亦为喜见之神。'],
  ['乙', '子', '丁', '丑', '乙诞子月，木根尽湿，时丁坐丑，火气尽泄，子丑气秉北方，旺水有冻木之忧，以时上一丁之焰，而欲解严寒之冻，力有未逮，最喜甲透天干引丁，其用等于丙火，？有亢燥之土以制水，则去病殆尽矣。'],
  ['乙', '子', '戊', '寅', '日元乙木，通根于时支之寅，盖寅中丙戊得生，气势极旺，时干戊财，足以收提防之功，所喜月提子水，藏而不透，无损木之精神，如能可以木比火伤，木？向荣欣欣矣。'],
  ['乙', '子', '己', '卯', '日元乙木，得禄于时支之卯，格成归禄，子卯虽刑，动而？动，仍可全其水木之气，时干一己，以坐下卯地而力薄，喜有火之食伤，虽重重不厌其多，冬乙以丙为眞神，正如赤子慈母之不可或？也。'],
  ['乙', '子', '庚', '辰', '仲冬乙木，月子时辰，会成半水之局，时干庚金，虽有辰土之生，终亦助水之旺，水印独多，母旺子衰，过于淸寒，喜有土以制水，火以暖木。'],
  ['乙', '子', '辛', '巳', '乙诞子月，木性寒而且湿，时支坐下巳火，可以驱寒转暖，时干辛杀，以？巳火之位，不能伤我日元，冬水反生为克，故不欲水盛，非仅漂木，抑且去火之焰，则木不能赖火以发荣矣。'],
  ['乙', '子', '壬', '午', '冬月乙木，气寒而冽，月提子水，时支午火，子午一冲，则水愈旺而火愈弱，书云，衰者冲旺旺者发，旺者冲衰衰者拔，今子旺午衰，午火被拔，时透一壬，水势益增，乙木？形飘荡矣，大喜厚土旺火，精神方可发越。'],
  ['乙', '子', '癸', '未', '乙日子提，癸水透于时干，似有寒木之意，？知癸水坐下未土，适得制水之功，未中暗藏丁火，木气得以温暖，惟以丁藏力弱，须有甲木引丁之焰方妙，金乃助水之神，固无裨于冬木也。'],
  ['乙', '子', '甲', '申', '日时甲乙并？，虚露不着根底，月子时申，会成半水之局，印绶结合，似有益于木，？知仲冬木气畏寒，水旺足以损木，再见透干之水，自不能无厚土制之。木寒喜神在火，有一丙透，木性遂臻阳和矣。'],
  ['乙', '子', '乙', '酉', '？乙并露干头，月子时酉相生，水旺而？有金生，有根之木，尙患寒冻，况木虚而不载于地乎，然则须有土以培木去水，？喜有火温暄，多火则木自向荣。'],
  ['乙', '子', '丙', '戌', '日元乙木，诞于仲冬时节，木气盘屈于地，其象颇不舒展，时干丙火高透，通根于戌，伤财？全其眞，惟日元孤虚，必须有劫比之扶助，始臻完备，如畵？虽好，尙有赖于点睛也。'],
  ['乙', '子', '丁', '亥', '日元乙木，时支坐下长生，本身得地有根，亥子皆属北方，经此旺水浸淫，寒木反生为克，时干一丁坐于水地，星星之火，力嫌太微，所以重火以暄之，厚土以实之，则无情转为有情矣。'],
  ['乙', '丑', '丙', '子', '季冬乙木，水寒而土湿，木之生气愈慑，火土？神，一如仲冬乙木之不可或少，月提之丑，湿土也，时支子，寒水也，皆足以病木精神，时干丙火无气，焉能暖木，身弱病重可知，须有戊丙得地，寅卯坐支，斯病斯药，乃为贵矣。'],
  ['乙', '丑', '丁', '丑', '乙木日元，月时？坐丑位，丑中辛癸相生，有金寒水冷之象，冬木气息奄奄，生机窒碍，时干丁火，见丑则泄，须有甲寅等字，方可恢？火之光辉，如土财重重，水病虽去，折木又岂能免也。'],
  ['乙', '丑', '戊', '寅', '乙木日元，时下坐寅，藤萝系甲，木气根深，妙在寅中藏丙，斯名寒谷回春，？见戊财透干，减少木寒，旣喜神生旺，病神自然尽去，再多见火土，奚啻花添锦上。'],
  ['乙', '丑', '己', '卯', '乙木得禄于卯，名曰归禄逢时，己土通根于丑，财星得地有气，诚身财？停之造也，但木土气势未惬，颇有争财之意，要有火之食伤透干得地，岂仅构通比财之气，木亦得暖而荣矣。'],
  ['乙', '丑', '庚', '辰', '乙木日元，坐下辰丑湿土，财旺身弱可知，时透庚金，财旺自可生官，惟乙木虚露无气，乙妹又聚于庚，遂成金坚木缺之象，？宜劫比得地，先固木根，次有火来调候，兼以制杀，大用于是乎成。'],
  ['乙', '丑', '辛', '巳', '乙木日元，时干辛金，月丑生辛，杀重身轻，幸有时支巳火制杀为美，书云，杀有伤制，杀化为权，惟总以身弱为病，喜再劫比为助，若余柱有火，自属喜见，但忌水来伤火。'],
  ['乙', '丑', '壬', '午', '乙木丑提，旺水之气犹未衰，冬水以生为克非似夏木佩印为贵，壬印透干，有损木之虞，时午被丑土泄气，灯火照暖力微，最喜甲丙同来，或火土重逢。'],
  ['乙', '丑', '癸', '未', '月时丑未互冲，未中乙丁皆伤，癸水通根于丑，冬木以印为忌，盖水多则木必受冻，木冻则生机尽灭，故喜厚土以制水，本身太弱，？不可无带火之木为助。'],
  ['乙', '丑', '甲', '申', '甲乙？排，其根不载于地，月时丑申，金水得气归垣，以休囚之木，见此寒金？水，得母成为忘形，所喜干有丙戊，支有寅巳等字，挽狂澜于旣到，则木之元气充实矣，枝叶向荣矣。'],
  ['乙', '丑', '乙', '酉', '酉丑半会金局，促成？乙之截脚，金刚木缺，由此可见，冬月之金，本非当令，为其转辗生水，故有金多不能克木之说也，此造日元太衰，原不堪金之摧残，火乃调候之眞神，制金护身之宝筏，允宜重重见之，至于木之劫比，亦以多助为美。'],
  ['乙', '丑', '丙', '戌', '乙日丑月，木之根气虚脱，时落丙戌，财赖伤助？旺，冬月乙木，原不以劫比幇身为重，尤以旺火调候为先，身弱有火，？可转弱为强，但此造总喜寅卯坐支，方见精彩。'],
  ['乙', '丑', '丁', '亥', '亥为木之长生，日元弱而不弱，亥丑均含水气，时干一点丁火，力微无补于暖，是乙木寒湿有余，喜厚土以去水之病，带火之木以固身之本，再见一派水木，虽多奚益哉。'],
  ['丙', '寅', '戊', '子', '丙日诞于正月，火挟木气以俱来，月提寅木长生，火赖寅生，其气益旺，时干戊土高透，通根寅提，明克实系暗生，时子深藏，润木有功，身印与，食无一不旺，壬透当去食而取杀，乏壬则当以土食为用。'],
  ['丙', '寅', '己', '丑', '丙日寅题，木火？旺，时逢己丑，伤官亦旺，己丑皆属湿土，有损丙火之光，有亏阳威之德，乃以土为病，宜有木以去土，以火扶身，略见金不妨。'],
  ['丙', '寅', '庚', '寅', '丙火？坐寅木长生，日元之根犹固，一点庚金？絶，财星虚露无根，身旺财弱可知，财弱喜有土金生助，均停则财为我用，若有壬水高透，是名水辅阳光，？同凡响。'],
  ['丙', '寅', '辛', '卯', '寅卯气全东方，丙赖木生而犹旺，时透一辛，牵丙绊火，喜有丁火制辛，以全其身，木火稍旺，究嫌于燥，急宜金水相济，财杀为用，一见土来？水，？须甲木去土为贵。'],
  ['丙', '寅', '壬', '辰', '丙火长生于寅，壬水坐库于辰，而辰寅有拱木之情，身？旺于壬杀，我身正可任之，惟水气休收，独忌土之食伤，有土则壬水失淸，丙火失威，如见金相助，化其病而辅其用，洵天和地润之佳造也。'],
  ['丙', '寅', '癸', '巳', '丙火日元，长生于寅，得禄于时支之巳，身印？皆健朗，寅巳中戊土食神，亦颇有气，可以稍泄旺火，惟时干癸水，坐下巳地，弱水几被熬干，喜有金水和润之。'],
  ['丙', '寅', '甲', '午', '初春丙火，母旺子相，月时寅午半火，时干甲印相生，身旺可知，气势嫌燥，必须有金财水杀调和乃可，否则坎？失济，而孤阳失辅矣。'],
  ['丙', '寅', '乙', '未', '丙日寅提，木火？旺，时逢乙未，身旺？有印生，日元阳壮极矣，値兹三阳开泰，气回大地，木火太旺，喜有水以润泽为美，惟此时水正枯渴，少见难为我用，故又须庚辛相生，源远？长。'],
  ['丙', '寅', '丙', '申', '丙乃纯阳之火，气势孟？，月提寅木为印旺，时干丙火为比壮，印比通气得之，生气蓬勃，乃以时逢申金，寅申相冲，不但寅中甲丙皆伤，以申中庚壬亦损，木火金水皆失其用，喜有亥卯等字，合去寅木，以全申金，庶乎水火？得其用，并行不悖。'],
  ['丙', '寅', '丁', '酉', '初春丙火，其象之威，月提寅木，扶身之力至大，时干丁火又幇身，身主可谓强矣，酉金财星，以被旺火所制，难为我用，喜天干壬癸高透，收旣济之功，？有金来辅佐水源，水火之气犹淸矣。'],
  ['丙', '寅', '戊', '戌', '丙日寅提，身主气势冲沛，时落戊戌，厚土有晦丙光，丙乃纯阳之性，秉象至威，一见食伤，其性失之于威，喜有甲来疏土之病，壬来显丙之节，格局方转淸丽。'],
  ['丙', '寅', '己', '亥', '丙火诞于寅月，寅中木火皆旺，日元刚健可知，时逢己亥，亥木气得润，火之气势转淸，有时上一点己土晦病，喜有木来疏之，用神仍以亥中壬水取贵。'],
  ['丙', '卯', '戊', '子', '二月丙火，阳气舒升，火力犹充，月提卯印幇身，时支一点子水，原可润气，乃以干？戊土，水为克制，兼以晦丙之光，急宜尽力以去戊，有喜木来疏之，身印？旺，又喜壬杀庚财，见于干支。'],
  ['丙', '卯', '己', '丑', '丙日卯提，火赖木生？气壮，丙乃纯阳之火，其性独腾上而无所止，非似丁火之旺而不？，时逢己丑，有晦丙火之光，而丑中辛癸属阴，又不能尽丙之用，病在伤官太旺，？喜金以泄土，又见水而全丙之性。'],
  ['丙', '卯', '庚', '寅', '寅中丙火，助身之旺，月时寅卯，气全东方，印比沆瀣一气，木火之情深矣，时干庚金，坐下寅卯节地，财星之力？足，身旺财弱，？宜见财以实之，？喜水杀以敌之，财杀？全，格自美妙。'],
  ['丙', '卯', '辛', '卯', '日元丙火，月时坐下？卯，木？于火，仲春丙火，阳透渐升，最喜水之官杀，调济木火精神，时干一辛虚露，不得根气，且辛丙有见合之情，丙从辛而反怯，喜有水透，则辛从水势而不合于丙矣，是水乃救丙之神也。'],
  ['丙', '卯', '壬', '辰', '丙日卯提，木从火势，时逢壬辰，七杀归库，丙火以壬为？友，其情最眞挚，壬丙？旺，身杀势均，自当以壬制身为用，一见戊己之土，便损水之淸丽。'],
  ['丙', '卯', '癸', '巳', '丙日巳时，格取归禄，月提卯印，生身益旺，时干癸水，坐下巳火之位，水气熬干，阳气壮盛，未得坎离旣济，急须有地之金水以和之，则木不燥而火亦可以显扬矣。'],
  ['丙', '卯', '甲', '午', '丙火坐刃于午，甲木坐旺于卯，印比相互交辉，其气旺相已极，有木火结党，气势有嫌偏枯，若非从旺格局，最喜水来调济，书云，木火印绶，独喜见水，盖亦为调候而言也，如主中水力微弱，？喜有金，以发水之源。'],
  ['丙', '卯', '乙', '未', '月卯时未，卯未会局而成印，时干乙木又？坐下未库，有木多火？，母旺子虚之象，自喜金财以去印，水之官杀，为春丙调候之眞神，亦以先覩为快。'],
  ['丙', '卯', '丙', '申', '天干？丙，月提一卯，木火之气壮矣，妙在申金时支，庚壬得地而淸，足以调和木火之气势，惟申有丙火盖头，不免大醇小疵，最喜壬水透干，格乃淸润。'],
  ['丙', '卯', '丁', '酉', '日元丙火，时干丁火，同类相助，声气相应，月提乙木正印，原亦火之嫡母，自有爱子之情，乃时支酉金，见卯则冲，似有去印之可能，殊不知时丁制酉，财不足以破印，身主仍有根，喜金财透干，以财为用。'],
  ['丙', '卯', '戊', '戌', '丙日卯月，木火？旺，时落戊戌，土气？强，虽曰木火土一气相生，干支之情不背，但嫌火旺土燥，柱有金水之神，始臻调济之功，水尤春火要神，须臾不可或离也'],
  ['丙', '卯', '己', '亥', '日元丙火月时亥卯半会，杀化为印，春丙有会局之木，火势益见炎炎，时干己土，虽有晦丙火，而坐下木地，土伤难存，全要支水之润，五行始归中和，如再有金，以财旺生杀取贵。'],
  ['丙', '辰', '戊', '子', '三月丙火，土正秉令，有晦火泄身之咎，月时子辰一会，化食为官，时干戊又透出，？使日主失神，以土为病，喜甲透干制之，见木则病去矣，取印制食为用。'],
  ['丙', '辰', '己', '丑', '一丙三土，火之菁英泄尽，书云，春火为相，土众生慈，所谓生慈者，是失其阳刚之性也，此旣土势结党，如再见戊己或四库之地，而絶无印比生扶，当顺气旺土，作从儿格论命，否则仍喜木火扶身。'],
  ['丙', '辰', '庚', '寅', '丙火坐生于时支之寅，兼有寅中甲印相生，日元可谓生旺矣，月令辰土当旺，时干庚财，得土之生而亦健，祗辰中一点癸水，坎离之气未和，喜有水透干，益臻美满。'],
  ['丙', '辰', '辛', '卯', '丙辛若化水，则为辛为喜神，丙辛化之不成，则以辛合丙火为病，时屈暮春，土气秉令，原不能化水，卯辰有拱印之情，故火力并非？足，乃以金水较弱，急须加强财杀之力，则无情转为有情矣。'],
  ['丙', '辰', '壬', '辰', '时壬？见辰库。乃水之得地而旺也，土水皆旺于身，病在克泄交加，土旺固喜木印以制之，水旺？木印以化之，木乃旋乾转坤之神，得之岂不为美乎。'],
  ['丙', '辰', '癸', '巳', '丙火坐禄于巳，日元通根为旺，月提辰土司令，巳中戊土得禄，身旺有泄，格成火土假伤官，时干癸水无根，且又坐巳火之地，被旺火熬干，书云，火土伤官宜伤尽，今于此造得之，祗喜金财同来，格取伤官生财。'],
  ['丙', '辰', '甲', '午', '丙火坐刃于午，时干甲木生身，月支辰藏癸水，土湿而泄火之气，格取食神吐秀，惟三月丙火，尤喜壬水之克，盖丙壬气皆属阳，丙以壬水为尊，见癸固不如见壬为淸纯，逢金发水亦佳。'],
  ['丙', '辰', '乙', '未', '丙火日元诞于暮春，时落乙未，为木印之库，火之余气，本身不以弱言，妙在辰未兼泄丙火之气，辰中一点癸水，润泽之力？足，喜有金水同来，五行调济？宜。'],
  ['丙', '辰', '丙', '申', '日时丙火？见，月提时支申辰拱水，以土金相生，财亦不弱，身主气势未充，须有木印火比而辅身，再用金水财杀，五行乃得中和。'],
  ['丙', '辰', '丁', '酉', '丙丁日时？？，辰酉？合为金，上下火金战克争财，凡在？神相峙之情态下，必须有所以构通之者，幸辰酉虽合，辰土暗中泄火，比较金旺火轻，印比幇身之神不可少。'],
  ['丙', '辰', '戊', '戌', '一火三土，火弱土旺，寡？适中，三月丙火，因土晦火光，必须有木印以去之土之病，但或火炎土燥，？非金水湿润，不为功也。'],
  ['丙', '辰', '己', '亥', '日元丙火，见辰为泄，见亥为克，时干一己，伤官之力克旺，或谓亥中甲印，可以生丙，？知亥中甲为湿木，焉能生火，仍以干支木火生扶，为当务之急，火多嫌燥，则木？较为需要也。'],
  ['丙', '巳', '戊', '子', '丙火日元，诞于巳月，为建禄之格，时上戊土高透，身旺而食神亦旺，时支一点子水，介于火土之间，亦云微意，喜有壬透干，有金相助，则不致孤阳失辅，淸光透而自贵矣。'],
  ['丙', '巳', '己', '丑', '丙日巳提，时逢己丑，火土夹杂，气势未淸，以土为病，以木为药，有木去土，火乃有威，水杀为夏火调候之眞神，尤宜见于干支，如火土迭迭，而无水以济，终非上乘之格也。'],
  ['丙', '巳', '庚', '寅', '丙火得禄于巳，长生于寅，有印而日元愈旺，时干一庚，？于寅木絶地，见火则金性自镕，所以过于燥热，独喜水来润泽，书云，身旺最要杀旺，如杀势？足，尤须赖金财以助之。'],
  ['丙', '巳', '辛', '卯', '丙？巳提，建禄成格，时支卯印，见火必生，夏火本旺，见印则气势愈强，时干辛金？弱，难为我用，木火气盛，总以金水为前提，否则性？正而情不和矣。'],
  ['丙', '巳', '壬', '辰', '巳月丙火甫炎，气势由衰转旺，月提巳，乃为建禄之格，妙在时落壬辰，水星归库，五行遂得调济，身旺用杀为贵，夏火见壬为？贵，惟此时水値休囚，有金生水，益觉添花锦上矣。'],
  ['丙', '巳', '癸', '巳', '丙火？坐巳禄，不惟本身？强，而巳中所藏庚戊，亦皆得势，时干一点癸水坐下絶地，大有？薪杯水之感，仍患炎燥，喜土金泄火，或大量水济。'],
  ['丙', '巳', '甲', '午', '巳午气全南方，时甲又来生身，炎炎之势，灸手可畏，必须有通干得地之水以济之，盖夏丙以金水为眞神，火旺得水，自可免于枯燥，如水力？足，支见辰丑等字，亦可补救于万一。'],
  ['丙', '巳', '乙', '未', '日元得禄于巳，乙木盘根于未，巳未中食伤？见，泄火光辉，幸木火土生之不已，气势尙淸，惟近枯燥，急宜有透干得地之水以济之，金财为助用之神，见之尤妙。'],
  ['丙', '巳', '丙', '申', '丙火？见天干，聚气于月提之巳，身主之强可知，时支坐申，金水同藏，？火得以稍戢，惟时干丙火盖头，金气不免受伤，如他干不透壬，须支见子，大用于是乎彰。'],
  ['丙', '巳', '丁', '酉', '三火一金，身强财衰，月巳时酉，半会金局，财乃转旺，夏火独取水之官杀为生，盖重在调候耳，故喜见水以润之，金以生之，身杀？停，始臻完美。'],
  ['丙', '巳', '戊', '戌', '丙诞巳月，火势克旺，时逢戊戌，有晦火之光辉，燥土？火，生机受障，夏火最忌干燥，惟此造水虽需要，见水又防土克，与其以水为喜，不如以金为先，于是土生金，而金生水，五行息息相通，方可免于阻节。'],
  ['丙', '巳', '己', '亥', '丙火坐禄于巳，日元旺而不弱，时逢亥水，巳亥虽冲，总不能去尽日元之根，时干己土，患在？壬，所喜金水相涵，同透天干，藉收旣济之功，日元稍弱，尙不引为大咎也。'],
  ['丙', '午', '戊', '子', '丙至午月，羊刃秉令，其气最旺，时支子水冲午，水弱终被火激，时干戊土，有晦火之嫌，喜有金来泄土之气，有水赖金之生，金水相涵，始归情和。'],
  ['丙', '午', '己', '丑', '丙火？午为刃，时逢己丑，火气尽泄于土，他神身旺喜泄，独丙火忌土所晦，故命书以火土夹杂为忌也，然则，丙之所喜者，水之官杀也，火性至刚，水性至淸，宛如日照江湖，有相映生辉之象，水弱而见金以助之，？觉淸纯可贵矣，'],
  ['丙', '午', '庚', '寅', '日元丙火，逢刃于午，时支坐寅，化印为劫夏月火气秉令，炎威莫当，况再寅午结局乎，时干庚金，虚露无根，喜有支金，亦如火之结党，金力加强，乃可以财为用，如见一二点湿土以和之，？佳。'],
  ['丙', '午', '辛', '卯', '丙火见刃于午，时卯情又归火，日元之气极旺，时干辛金无根，火金不容，木火相生，如再见木火结党，则当顺其火性，作炎上格论命，反以金水为忌矣。'],
  ['丙', '午', '壬', '辰', '丙日午月，时逢壬辰，水火？见，旣济功成，身杀？停，杀刃势均，独忌戊己杂乱，盖用杀而最畏食伤之制，果尔，须有木来去土存水，仍可全杀刃之用。'],
  ['丙', '午', '癸', '巳', '丙火日元，以月午为刃，时巳为禄，本身之旺，无与？比，时干癸水之官，坐于旺火之地，水已熬干殆尽，仲夏火势炎？，若无水来润泽，再加木来助火，深恐不戢自焚，所以要金水？全以调候之。'],
  ['丙', '午', '甲', '午', '丙日午月，羊刃之地，时逢甲午，又来木火，气势之旺，大有燥石？金之槪，一派木火，在此三夏时节，未免偏枯，如再见木火党众，势成专旺，书云，暖之至者，反以无寒为贵，故忌见水。'],
  ['丙', '午', '乙', '未', '乙木盘根于未，印绶得地而旺，午未亦合，化伤为劫，虽系木火土三神，实则势皆成火，印比？旺，以枯燥为病，故喜有旺水以济之，此时水？絶地，最？被火熬干，苟有金来发水之源，则水之精神健朗，可以容制火矣。'],
  ['丙', '午', '丙', '申', '天干二丙，集旺于月提午火，时値一申，申为水之长生，火旺得水，旣济功成，格以阳刃驾杀为贵，如再有一壬透出，气势益见淸润矣。'],
  ['丙', '午', '丁', '酉', '丙火得刃于午，时再透丁，名为阳刃倒伐，所谓倒伐者，乃言其势过旺之意也，时支酉金，几被火镕，须有湿土泄火，方可保全金之生气，如地支金全方局，格成火金迭迭，亦贵格也。'],
  ['丙', '午', '戊', '戌', '月午时戌，半会火局，一戊透出，有晦火之光明，形成？火燥土夏火不畏水多，独怕土泄，虽曰火土伤食以伤尽为喜，此系旧书之误解，？知火土伤食，须有水以调和其气，盖见水有土回制，不与丙火相激，而反收润土之功也，'],
  ['丙', '午', '己', '亥', '丙火得刃于午，日元气贯神充，妙在时支一亥，加收湿润之功，亥中壬水，乃以甲木之泄，固不逮支有申金，中藏壬水之为美，兼之一己透干，水淸转浊矣，杀弱唯宜金水相资也。'],
  ['丙', '未', '戊', '子', '丙？？月，气势逐渐销沉，盖未土当旺，嫌其有晦火光，时干戊食高透，时支子水，上下被土所困，官星等于虚设，际此情形，喜有木印制土生身，以？丙火之性，救子水之官。'],
  ['丙', '未', '己', '丑', '己丑皆属阴土，而丑中又有辛癸之相生，其性质逈异于高亢之戊，月未性虽干燥，究亦有晦丙光，以土重为病，身旺喜有金以泄土，格取伤官生财，身弱喜有木印之生，格取伤官佩印，'],
  ['丙', '未', '庚', '寅', '丙火日元，余气于未，长生于寅，气势转强，一点庚金透时，虚露无根，身旺未能用财，须有申酉丑辰等字坐支，方可以财为用，土气太燥，尤须有水润泽。'],
  ['丙', '未', '辛', '卯', '卯未会木，化伤为印，火有木生，身旺可知，时干一辛高透，与丙牵绊，以时値土令，决无化水之理，戊己为夏火所忌，少见无伤体用，多则有浊水之咎，所谓假神乱眞是也 。'],
  ['丙', '未', '壬', '辰', '丙火见辰未，食伤泄重身轻，但未中乙丁同宫，？可助火，须天干透甲生丙，方为有力，时壬为调候之神，是诚可喜，惟以火正退气，若再多见金水，亦防三伏生寒也。'],
  ['丙', '未', '癸', '巳', '丙火赖巳以生旺，未巳中？土皆燥，不无泄火之嫌，时癸露而无根，兼有土之觊觎，其水不免枯渴，病在食伤，喜有木印以去土之病，次须有水润土之燥，用木用水，不可执一，活看为是。'],
  ['丙', '未', '甲', '午', '丙火通根于未，甲木？下午火，午未？合，木火成气，细按之，则木火土三神，生生不息也，气势虽纯，总以燥渴为病，须有壬杀制刃，书云，杀无刃而不显，刃无杀而不威，盖卽调候之宜也。'],
  ['丙', '未', '乙', '未', '丙火？得余气于未，乙木又？见库地于未，日元虽患土泄，然有乙木丁火生扶，依然旺相，柱中喜有壬癸之水，润斯枯燥之木，则木火有相生之情，兼有金来泄土生水，？不偏不倚矣。'],
  ['丙', '未', '丙', '申', '日时？丙，以未中乙木为根，时支申金，申中金水相涵，重心在于水杀，以壬为用，遂成旣济，如有透干之水，？有庚辛之财，转成杀重身轻，非有木印化杀不可。'],
  ['丙', '未', '丁', '酉', '丁劫通根于未，丙火有未中乙印之生，旣有印劫，当以有气论，时支？酉，以干丁制止，比重财经，应有申酉辰丑等字，加强财力，使身财？停，其财乃为我用矣，或财与身强弱悬殊，是名财星？眞，一见水之官杀，当舍金而从水。'],
  ['丙', '未', '戊', '戌', '三土三火，望之似属相均，？知时値土旺，火力远逊，以土为病，急欲透甲医之，此乃伤官佩印，如不见木印，重来土金之神，又当以火土从儿格论命，'],
  ['丙', '未', '己', '亥', '亥未半会木局，七杀化为印绶，以亥藏壬，湿木未能生丙，仅以未中乙丁为根，时于己土通根于未，有泄衰丙之气，？月丙火退气，除水旺生寒，喜土驱水外，总以重土透干为病，救之之法，身旺以金泄之，身弱用印制之。'],
  ['丙', '申', '戊', '子', '丙火生于七月，病地也，气势逐渐消散，地支申子会水，时戊露干而虚，支水干火未济之象，喜有寅巳等字，丙火之根始固，金水虽系秋火眞神，亦须视得用与否，如身主未固，见杀焉得不病，此命书所以有丙？申位，忌见阳水之说也。'],
  ['丙', '申', '己', '丑', '月申金水同宫，时丑辛金得库，时己通根于丑，土湿成泥，身主受克泄太过，以日近西山之丙火，急须有得地之木印，与夫通根之火比，相互辅助，方许健朗，乃有精神，'],
  ['丙', '申', '庚', '寅', '月申见寅则冲，斯时金旺木衰，有冲木拔，时庚坐禄于申，财重身轻之象，须有得地巳火，合去申金，印根乃可保留，财旺独喜比劫为助，是名一神一用。'],
  ['丙', '申', '辛', '卯', '卯申暗合，情势趋财，丙辛亦合，不免过于有情，如申酉亥子同来，天干又透壬癸，应以化水格论之，否则大喜木火生扶，以金水为病。'],
  ['丙', '申', '壬', '辰', '申辰拱水，时干又透壬水，杀重身轻之象，丙火本忌食伤之泄，在此水旺火熄之际，惟恐其土之不来，然则，以杀为病，以食伤为药也，但如本身太弱，木火印比，尤重于食伤之土也。'],
  ['丙', '申', '癸', '巳', '丙火得禄于巳，申提透癸，则官亦旺，身旺官透自可用官，巳禄合之于申，丙火之气？专，巳申虽不化水，火力不无所损，滴天髓云，何事裙钗姿宜？，此语卽指巳申之无情相合，尙须有木火辅助我身为是。'],
  ['丙', '申', '甲', '午', '丙火坐刃于午，时干甲印为助，秋火虽属失令，党众亦以旺言，月提申金，如有壬透财化为杀，自当用杀而舍财，诚杀刃双辉之造也。'],
  ['丙', '申', '乙', '未', '乙未印绶，坐库于未，日元之气转旺，月提申金藏壬，见未而气势转浊，最喜干透金水，身旺当先用杀，如庚辛多见，或食伤同来，则可弃水而用土金之神。'],
  ['丙', '申', '丙', '申', '七月丙火，太阳转西，？丙？？申位，财旺而日元气浅，申中金水同旺，财杀方兴，衰火陨灭之咎何辞，惟有藉劫比之助，印绶之资，否则势成一发千钧矣。'],
  ['丙', '申', '丁', '酉', '天干丙丁？排，地支申酉皆金，财？比劫，不无争夺之意，殊？知时値秋令，金旺火衰，得地秉令之金，反制休囚虚浮之火，此卽火能制金，金旺亦能制火，五行顚倒之原理，自仍倚重木印火比也。'],
  ['丙', '申', '戊', '戌', '丙火坐库于戌，有暮光返照之象，月提申金，财星秉令，时逢戊戌，食神得气，土来生金，重心全在于金，以一点衰弱之丙火，安能任此食财，必须木印火比，相互助身，书云，火见火以光辉，纵迭见而必利。'],
  ['丙', '申', '己', '亥', '亥中壬水得禄，申中壬水得生，？壬藏于月时，兼有申中庚金之生，诚可谓秋水通源，亥中甲木印绶，以湿甲而不能生丙，身主太弱，总喜有劫印为助也。'],
  ['丙', '酉', '戊', '子', '丙火至酉，死地也，日近黄昏，余光存于江湖，酉子金旺生水，官星之力极强，时干一戊高透，虚露无根，旣不能制水之旺，亦以晦火为病，须要通根寅巳午支，本身旣健，乃用官可也。'],
  ['丙', '酉', '己', '丑', '酉丑半会金局，己土透干得地，月时土金集中，财旺身弱可知，柱中再见金财透干，而支成方局，可作当令之从财格论，所谓从财者，要本身絶无援助，一见印比，从财格破而仍喜木火幇身。'],
  ['丙', '酉', '庚', '寅', '日元丙火，长生于时支之寅，书云，得三比肩，不如坐一长生，然寅中印比同旺耳，时干庚金，得旺于月提，财星气通门户，身若较弱，则以财旺为病，身旺仍不妨用财，旣以财星为用，无比劫，无须水之官杀，盖官杀泄财也。'],
  ['丙', '酉', '辛', '卯', '月时卯酉一冲，财印？伤，日元丙火，顿成孤立，且也辛丙一合，明为财来就我，实则牵绊身主，滴天髓云，局中显奋发之机者，神舒意畅，象内多沈埋之气者，心郁志灰，欲救卯木，非水而何，欲其身之转旺，？非火助不可。'],
  ['丙', '酉', '壬', '辰', '丙火日元孤立，辰酉？合，壬丙虽属双淸，身主气势究轻，秋丙性息体休，木生方有？明之象，火来始得辉煌之光，旣以壬杀势重，木印化之？佳。'],
  ['丙', '酉', '癸', '巳', '日元归禄于巳，而巳酉半会，比化为财，此系无情之会，转使身不任财，时干癸水，通根酉提，气力亦强，唯喜比劫扶身，印绶生身，财官方为我用。'],
  ['丙', '酉', '甲', '午', '丙火坐刃于时，干透甲印生身，日元健朗可知，月提酉金，被午所制，是金不敌火也，柱中喜有壬水高透，杀刃自然双淸，如以壬杀为用，戊己大忌杂乱，有一于此，格转浊矣。'],
  ['丙', '酉', '乙', '未', '乙木归库于未，生身有功，未中一点丁火，赖印而势转为旺，月提酉财秉令，兼有未土之生，我身可以任财，如柱中金财多见，反来损伤木印，所谓贪财坏印是也，总要身财？停方佳。'],
  ['丙', '酉', '丙', '申', '申酉皆金，？丙成为截脚，金旺火弱明矣，书云，金旺则有伤火势，又曰，丙？申位，最喜月干透印，是以秋火先要生旺，方可任用财杀，否则金水虽淸，抑有何益于我哉。'],
  ['丙', '酉', '丁', '酉', '天干丁火同来，地支？酉分？，有火金相峙，金坚火熄之象，柱中财旺身弱，当先劫比为助，木印须防金制，宜各？门户，？不相碍为佳，如再来迭迭之金，可以舍身而从财矣。'],
  ['丙', '酉', '戊', '戌', '时逢戊戌，食神之气极旺，酉戌气归西方，金财之力亦强，日元丙火，虽逢时支戌库，土重晦火，抑而难伸，惟有用木疏之，印来助身，光辉自？，或火比相助亦为功。'],
  ['丙', '酉', '己', '亥', '月提酉金为财，亥中壬水为杀，旺金生水，财泄杀旺，亥甲以有壬水之浸湿，断难生身主之丙，须有透干之甲丙，？见得地之寅巳，是可转弱为强。'],
  ['丙', '戌', '戊', '子', '丙诞九月，墓库之地，虽有余晖，气极微弱，月戊透于时干，不无晦火之光，时支一点子水，被土上下交争，制之殆尽，甲木为疏土之神，助身唯印是？，得之自然病制矣。'],
  ['丙', '戌', '己', '丑', '丙火坐库于戌，时上干支，己丑根深，一火三土，身主泄弱，丑中辛癸同宫，又寒丙火之气，救济之道，当以甲木为先决问题，庚辛为次焉者也，因身弱见印，则土去而身强，身弱见金，土虽泄而身仍不能任财也。'],
  ['丙', '戌', '庚', '寅', '时落一寅，丙火身印？旺，寅戌又会拱有情，时干庚金，坐下寅地，而月令之戌，燥土又难生金，是庚金实无根之虚财耳，柱中宜有得地之金以助之，且干支似乎太燥，喜有水来润泽。'],
  ['丙', '戌', '辛', '卯', '卯戌？合，木从火势，日元丙火，赖以身旺，时干辛金不得根气，且因迹近干燥，此财等于无用，身旺土藏，无须木印再来，所喜者，金水再见，用在财官。'],
  ['丙', '戌', '壬', '辰', '辰戌互冲，秉令之土益旺，戌中丁火，与夫辰中癸水，因相制而损伤，戌丁为日元之根，冲则根拔，辰为时干壬水之库，冲则水亦虚脱，身弱宜木火以实之，方可用水，否则用神无所适德矣。'],
  ['丙', '戌', '癸', '巳', '日元归禄于巳，兼之月提火库于戌，身主极旺，时干癸水坐下火土，弱水安得存在，柱中火土燥？，失之于枯，所喜金水财官，结伴同来，则以中和取贵矣。'],
  ['丙', '戌', '甲', '午', '丙火坐刃于午，午戌半会火局，加以时干甲印生身，木火气结，身旺极矣，火木之气嫌燥，先喜水调济，有水还须有金，水乃源远？长。'],
  ['丙', '戌', '乙', '未', '日元得库于戌，乙印坐库于未，身印均得地，戌未土星，泄丙火之气，柱中木火土生生不已，惟以丙火皆燥，须有水金调和为美，故深秋丙火，身弱用印，身旺用杀，虽非定论，大略如是。'],
  ['丙', '戌', '丙', '申', '丙诞戌月为库地，时逢一丙，日元弱而不弱，妙在时支坐下申金，明似丙来制申，实则申内庚金生壬，转辅丙火之光，书云，吉神喜其深藏，可免争夺之风，洵非虚语，故以壬水为用。'],
  ['丙', '戌', '丁', '酉', '丙丁气聚于戌，日元不弱，时支酉金，有火旺金衰之象，非有湿土之生，庚辛之助，终难全财之用，如柱见土金同来，格取食神生财，有水透干，取财生官，视其配合，定其取用。'],
  ['丙', '戌', '戊', '戌', '丙火？坐戌库，日元有根，时干透戊，丙被土晦，柱中厚土迭迭，丙转弱矣，书云，混杀贵乎取淸，遇伤在于佩印，此语甚是，故宜以甲印先覩为快，甲来而有水相助，喜用？全矣。'],
  ['丙', '戌', '己', '亥', '丙火聚气于月支之戌，兼有亥中甲印之生，弱转为旺，亥中壬水得禄，可以润土之燥，淸丙之气，惟月提戌土制水，须支见申酉等字，打通土水之气，格乃淸纯无疵。'],
  ['丙', '亥', '戊', '子', '十月丙火，太阳失令，月为亥水，火之絶地也，亥中甲印被壬所湿，絶难生丙，而亥子气全北方，水旺自然火弱，时干一戊旣成湿土，且虚露无根，？足以去水之病，喜甲乙高透，或支有寅卯，化杀生身，则得之矣。'],
  ['丙', '亥', '己', '丑', '丙火气衰而弱，亥中藏甲难生，日元可谓虚矣，时逢己丑，伤官极旺，丑中辛癸相生，益添亥力，水旺土湿，克泄交加，非有寅巳卯午等字，见于地支，殊？足以化干戈为玉帛也。'],
  ['丙', '亥', '庚', '寅', '丙火长生于寅，印比？皆生扶，月提亥水，遇寅而合，印绶益见生旺，时干庚金，虚露无印，须有得地之金，方可用财，如不见支金，须藉土以生之，亦为财星有根。'],
  ['丙', '亥', '辛', '卯', '亥卯半会木局，印绶生身而旺，书云，火有木生，则有？明之庆，惟初冬水势当旺，须支有戌未之土，水去木自不湿，以之生火则火力倍增矣，时上辛财浮露，亦喜有土生之，或庚辛助之，其财乃得归眞。'],
  ['丙', '亥', '壬', '辰', '壬水坐库于辰，又？得禄于亥，冬水势成冲奔，沛然莫之能御，日元一丙孤立，自难免于陨灭之患，然则杀重身轻明矣，去病之法，独喜木来印化，书云，众杀猖狂，一仁可化，一仁，卽指印而言也。'],
  ['丙', '亥', '癸', '巳', '丙火坐禄于巳，似乎有根，？知月时巳亥一冲，水火？伤，书云，旺者冲衰衰者拔，时巳火冲而去之也，时干癸水，官星虽淸，无如身弱何，所喜火比生助，木印齐来，首要固日元之本。'],
  ['丙', '亥', '甲', '午', '冬月丙火，气势转衰，木火生助，最为重要，日元通刃于午，甲印生火有情，月令亥杀当旺，制刃恰到好处，惟亥被甲泄，杀势欠淸，须有一壬透干，刃杀双辉，而？美妙。'],
  ['丙', '亥', '乙', '未', '乙印盘根于未，亥未半会木局，母旺子衰之象，惟十月丙火，如乏比劫多助，全赖印绶之生，印乃眞神，固无所谓母旺与否也，总之，身旺喜水杀之制，印旺喜金财之裁，财官之取用，以身旺印旺为区别。'],
  ['丙', '亥', '丙', '申', '？丙露干，月提藏甲不生，亥申金水同情，财旺不逮杀旺，初冬水令，丙火根浅，须有带火之印绶化杀，如寅卯等字，则杀生印而印生身，全局气势一 贯矣。'],
  ['丙', '亥', '丁', '酉', '时支酉金，旣被丁火之克，又来亥水之泄，财星？眞，丙丁全恃亥中甲印之生，甲被亥中壬水所湿，生火之力极微，旣水旺火衰，木印诚不可缺，否则重见丙丁得地，亦可。'],
  ['丙', '亥', '戊', '戌', '时逢戊戌，土力极旺，日元虽得库于戌，冬火之气？足，月提亥水，虽属秉令，见此戊戌重土，亦将不胜，故以土晦丙光为病，去病之神，惟木印耳。'],
  ['丙', '亥', '己', '亥', '丙壬？甲，藏于月时？亥之中，水有木泄，杀印相生，日元丙火？于亥水絶地，可谓弱矣，时干己土，旣成湿泥，又不能制去旺水，须有透干之甲，通根之火，扶之，乃得其宜。'],
  ['丙', '子', '戊', '子', '仲冬丙火，一阳潜生，火力势甚微弱，月时？坐子位，有蹑丙火之气，时干戊土，有晦丙火之光，身主孤立无助，宜以木印泄水生火，兼有巳午等字为佳。'],
  ['丙', '子', '己', '丑', '子丑气归北方，兼有丑中辛癸之助，时干己土，几以水旺而成为湿泥，日主丙火，孱弱极矣，一点阳威，泄之殆尽，书云，冬火欲生不欲杀，杀则歇灭，然则，欲其恢？通明之象，非木印重见，或火比得地，不可。'],
  ['丙', '子', '庚', '寅', '丙火长生于寅，寅中印比？生，冬月火势絶灭，有一寅助，气转生旺，月提子水，虽寒，藏支原无大碍，时庚虽能生水，幸坐下寅木絶地，生而不生，如干透壬癸等字，用土制之，格成食伤制杀。'],
  ['丙', '子', '辛', '卯', '丙火日元，诞于寒冬，体絶忘形，月时子卯一刑，似乎卯印不能生身，但适天随云，柱神祗以冲为重，刑与穿兮动？动，尙无大碍，可以明矣，时干辛金成冻，且？其无情合丙，除非化水，否则须多火来比助。'],
  ['丙', '子', '壬', '辰', '子辰半会水局，时干再透壬水，其势已成泛滥，日元丙火，孤立无依，冬火不见印比生扶，如频见水金同来者，可作从杀论，一见木火得地，从格破矣，仍喜生扶。'],
  ['丙', '子', '癸', '巳', '丙火得禄于巳，癸水坐禄于子，身与官，交互得禄，惟此时水当令而火退气，苟有木印以助身之旺，构通水火坎离之气，再见金财生官，则成点睛之畵龙矣。'],
  ['丙', '子', '甲', '午', '丙火见午为刃，冬火见刃为美，时干一甲，又来幇身，身主得气，惟月令子水乘旺，见午则冲，旺者冲衰，衰者难存，书云，败地逢冲仔细推，败地，指子午卯酉也，着重仔细？字，今以羊刃被损，日元旺又转弱，仍喜有得地木火以补救之，否则，须有戌未制水，以解子午之冲。'],
  ['丙', '子', '乙', '未', '时逢乙未，印绶归库，未中一点丁火，又来生助丙火，仲冬一阳？生，丙乃弱转为强，祗要印比得地，？不为弱，月提子水，遇未而被伤，未可引以为用，须有金水透干，方取财生官杀。'],
  ['丙', '子', '丙', '申', '天干？丙并列，地支子申会水，天干不载于地，而地支反来克丙，上下无情，大凡水火交战，最喜有通关之神，而弱火？不可少木印以助之，由是水火之气和，而弱极之身得生矣。'],
  ['丙', '子', '丁', '酉', '丙丁并？，劫比本属同气，酉子坐支，金水情谊相投，火虚水实，乃是官旺身轻，値兹严冬之际，水势正旺，故忌水再透干肆逞，须要丙火得地，兼有木印为助，然后再用官杀，凡论一造衰旺之眞机，总不可？顾及也。'],
  ['丙', '子', '戊', '戌', '丙火坐库于戌，身主尙云有根，时上戊戌，食重可作伤看，且其病在晦火，月令子水，官星已被土之包围，无存在可能，土重泄身，喜有劫比补充之，重木以去重土，方收有病得药之效。'],
  ['丙', '子', '己', '亥', '亥子气全北方，秉令之水，成方而愈旺，日元丙火，全恃亥中甲印，乃以带水之木，究未能发丙之焰，是水火未济之象也，身弱以幇身为先，故支见寅巳卯午等为宜，如重见金水同来，则当顺其昆仑之势而从杀。'],
  ['丙', '丑', '戊', '子', '季冬丙火。进气二阳，较初冬仲冬为有力，月时子丑？合，时干戊土高透，食伤并见，火气尽泄于土，若无通根巳午之火，断难其生旺，旣以土为病，木印乃疗病之神，毫无疑矣。'],
  ['丙', '丑', '己', '丑', '时逢己丑，伤官并见，丑中癸辛同宫，气亦生旺，土金水相生有情，独弃日元丙火于孤立，是不应旺者而旺，失之于偏，应旺不旺，失之于昌，救其弊，惟有木印火比？神以调和。'],
  ['丙', '丑', '庚', '寅', '丙火长生于寅，月丑土来金生，身旺而财星亦旺，书云，身旺见财，其财得为我用，身弱逢财，其财反来克身，？妙时上庚金，赖寅中丙火以暖之，如天干有水透出，则当舍财而从官杀，'],
  ['丙', '丑', '辛', '卯', '丙日丑提，火泄于土，时逢辛卯，金来克木，比印皆损，日元赢弱，如能支见印，火比，则以食伤生财为用，否则总以幇身为宜也。'],
  ['丙', '丑', '壬', '辰', '月提丑土，时支辰土，望之似土旺，？知辰系水之库地，丑中辛癸相生，水有金生，加之一壬透于时干，日元丙火，几被水制殆尽，如干支再来金水，助其旺势，惟有作从杀论。'],
  ['丙', '丑', '癸', '巳', '丙火归禄于巳，日元通根有气，巳中庚金，以有丙火之制，其财？全，丑中癸水透干，官星独发而淸，身旺用官宜矣，用在官星，忌有壬杀来混，独喜庚辛之生，一见戊己杂出，谓之破格。'],
  ['丙', '丑', '甲', '午', '丙见午火，羊刃之位，一甲透时，幇身为旺，月提丑土伤官，身旺泄之有情，书云，身旺者宜克宜泄，惟用在泄神，不应再见水之克神，用在克神，自不应再见泄神，克泄不能并用，择一可耳。'],
  ['丙', '丑', '乙', '未', '月丑时未，杂气丑冲，未中乙丁，因冲而丙火根去，徒？时干乙印生身，力量微弱，而丑未？土，得时当令，？损丙火之气，宜有木印佩之，劫比助之，身主始得健朗。'],
  ['丙', '丑', '丙', '申', '？丙虚透干头，申财有丑之生，金旺火弱，日元根浅，急宜注意者，要先固其本，旣病身弱，当进参燕补之，参燕者，木火也。'],
  ['丙', '丑', '丁', '酉', '丙丁虚露无根，丑酉会金而得地，身弱财旺，显而？见，深冬土旺，金亦随土而张，非似仲冬水旺泄金可比，日元过弱，无须土之通关，祗要有通根之劫比为助。木印为生，斯可矣，水乃去火之神，身弱尤忌见之。'],
  ['丙', '丑', '戊', '戌', '一火三土，日元之英华泄尽，伤食迭见，身弱不言而喩，戌中一点丁火，又被丑中癸水暗伤，丙已孤立，土已成象，非有木印为助，安能解围，如再见戊己丑辰等字，格局变成从儿。'],
  ['丙', '丑', '己', '亥', '月提丑土，透于时干，伤官极旺，亥丑中壬癸同？，官杀相混，土水夹杂，气势浊而不淸，日元丙火，经此克泄，又安望其地位巩固耶，妙在亥中藏甲，印绶逢生，聊可补身弱于万一，所喜重见火比，？透木印，我得从容而胜任克泄矣。'],
  ['丁', '寅', '庚', '子', '丁火柔中，内性昭融，诞于春初，木旺火相，丁火不旺自旺，时庚虽可劈甲，乃以坐下子水，庚金之气被泄，须有申酉藏支，方可财以破印。'],
  ['丁', '寅', '辛', '丑', '丁诞寅月，木旺火相，日元生旺，时逢辛丑，财星得库，辛财虽亦可用，不如庚金为佳，缘劈甲必以阳金为宜，辛较不逮，但时丑为生财之神，得力亦深。'],
  ['丁', '寅', '壬', '寅', '月时？逢寅木长生，木火之气极旺，印比通根，丁力自强，时干一点壬水，见丁适成化木，惟须天干透木，？有水以生之，化木乃眞，旣成化气，庚辛金万不可见，见之格破，仍用食财为上。'],
  ['丁', '寅', '癸', '卯', '寅卯气成东方，印星得地，丁火之力自强，时干一癸透出，坐下卯位水气尽泄于木，七杀虚露，要有金水相济。方为上格。'],
  ['丁', '寅', '甲', '辰', '时干甲木，余气于辰，月提寅木，见辰又会东方，木多有？火之患，则以印多为病，须有金财以去其病，用神在金，忌水来泄，一见旺水，则为官杀为用，徒贵而不富。'],
  ['丁', '寅', '乙', '巳', '日元丁火，得禄于巳，长生于寅，时干又见木印，木火气壮，身旺太过，春丁以金财为贵神，见之为宜，有金而又有土，斯？可贵。'],
  ['丁', '寅', '丙', '午', '寅午半会火局，时干丙劫幇身，木火同来，？无须再见甲木，甲来生气反成死机。水为唯一需要之神，况火旺以水为眞神，此则身旺用杀之谓也，水如？足，金财尤不可少。'],
  ['丁', '寅', '丁', '未', '？丁并？天干，未中印比深藏，而月提又来寅木，木火迭迭，身旺槪可想见，幸时支之未，亦可以泄旺火之气，喜有金水相助，则土不燥，火不 炎，木获滋润矣。'],
  ['丁', '寅', '戊', '申', '月时寅申冲，所藏之神尽伤，印劫根损，日元丁火自弱，时干一戊，又泄丁之气，独喜甲印之生扶，劫比之为助，如重来土金之神，一派伤财肆逞，吾身不将消灭耶。'],
  ['丁', '寅', '己', '酉', '丁日寅提，寅中印劫？助，时逢己酉，财星借食而强，身财？停，如食伤？见，虽可生金，却又病于泄丁矣，故喜金透天干，土祗少数，此而用财，其财乃眞。'],
  ['丁', '寅', '庚', '戌', '日元丁火，得库于戌，坐生于寅，寅戌有拱火之情，木火得地通根，妙在时透庚财，可以破寅木之印，惟庚金坐下戌土，不如辰丑生金之有情，忌木火之气。偏于阳壮，尤喜见水以润泽。'],
  ['丁', '寅', '辛', '亥', '丁火通根于寅，寅亥合而气转于寅，火有木助，益是昭融，亥中一点壬水，因被甲泄而转弱，得时干辛金而又转旺，自当以壬官为用，土为伤水之神，宜少见之。'],
  ['丁', '卯', '庚', '子', '二月卯乙司令，木旺有？火之象，丁日卯提，印绶幇身，时支坐下子水，名为子卯相刑，实系水来生木，杀化为印，妙在水木火一气相生，淸得纯粹，时干庚金财星，？见独发而淸，衡之轻重，自当以庚财为用。'],
  ['丁', '卯', '辛', '丑', '丁日卯提，身印？旺，时逢辛丑，金财赖土而有力，丑土有一点癸水，可以润木之燥，如有甲丙再来，独防去土合辛，是名牵绊用神，故若用在辛财，岂独冲之为凶，合亦忌见。'],
  ['丁', '卯', '壬', '寅', '丁火见寅卯，印劫得地有根，时干一点壬水，泄之于木，不能成立，全局气势偏于木寅，宜有金财破印，格取君赖臣生，如重逢木火之神，而不见金财者，则成母慈灭子之象矣，'],
  ['丁', '卯', '癸', '卯', '日元丁火，得？卯印助而生旺，时干一癸，水到卯宫必伤，身旺原喜水之官杀，乃以木印之泄，似未能贸然用之，所喜金水同来，生助官杀，大用于是乎成。'],
  ['丁', '卯', '甲', '辰', '丁见卯辰东方，印又透于时干，时支坐下辰土，旺火赖以泄之，柱中金不可少，盖木旺必赖金杀，方成栋梁之用，一见水透天干，金泄于水，当弃金而用水矣。'],
  ['丁', '卯', '乙', '巳', '时干月提，乙印得禄，日元丁火，又？得助于巳，印劫？旺，身强不言而喩，二月丁火，气势旣壮，病于太燥，必须有水润泽，则阳气降为湿润，寒喧得以适中，见水为印格用杀，见金为印格用财。'],
  ['丁', '卯', '丙', '午', '日元丁火，得禄于午，时干丙火，坐印于卯，三火一木，木必从火之势，论格局已成转旺，再来木火亦佳，如见庚辛之金，透水方可用财，见土取食伤生财。'],
  ['丁', '卯', '丁', '未', '卯未半会木局，？丁余气于未，火赖木助，气势益壮，时支一点未土，原可泄火，以卯未会而土性失眞，滴天髓云，出门要向天涯游，何事裙钗姿意？，是卯木乃裙钗之类也，最喜金财透干，卽是眞神发露，用之大贵。'],
  ['丁', '卯', '戊', '申', '月卯时申，名谓乙妹取庚，缘乙庚有暗合之情也，时干戊土，又来生金，是金重而火弱也，须有木印生身，一方面又可去土，一举而？得，用之最为上策。'],
  ['丁', '卯', '己', '酉', '日元丁火，悉赖月提卯印以存，而时支酉金，见己生而益壮，全力冲卯，卯？动而自动，因之身主失辅助之神矣，必须支见寅午巳未等神，以补救之，弱火始可？明，然后再议用官用财。'],
  ['丁', '卯', '庚', '戌', '丁火日元，坐印于卯，得库于戌，蔕固根深，时庚有戌中戊辛之助，财亦有气，身已健朗，用庚财喜再有土生。'],
  ['丁', '卯', '辛', '亥', '时干辛金，泄于亥水，亥中壬水，泄于卯木，卯木又归生日元，由是金水木火生生不已，中无隔阂之神，可谓淸净，亥卯会木而印旺，乃以亥藏湿壬，难发丁火之焰，须有丙丁巳午之火以实之，水遂得为我用矣。'],
  ['丁', '辰', '庚', '子', '三月戊土司令，丁火之气受泄，月辰时子半会，化伤为杀，丁火居于水地，衰弱可知，而时干庚金，又来生水，？宜支坐寅卯巳午等字，先强其身，水病再以土来除之。'],
  ['丁', '辰', '辛', '丑', '丁火坐下辰丑，伤食皆旺，辰中乙印，助身力微，丑中辛癸同藏，时干辛金归库，身不敌财远矣，喜甲印透干以引丁，火比去财而益身。'],
  ['丁', '辰', '壬', '寅', '日元丁火，时支寅木，印比根深而有情，时干壬水，见辰库于月提，官星之势亦旺，丁壬一合，而身主健朗，合之反佳，是名官来取我，春末丁火，原以土重为病，甲木为药，今以土藏不透，兼得水木相辅，格局淸纯。'],
  ['丁', '辰', '癸', '卯', '丁火日元，坐下卯辰东方之气，时干癸水，通根辰库，其身足以任杀，主中再见庚辛之财，而生偏官，尤觉天衣无缝矣。'],
  ['丁', '辰', '甲', '辰', '丁日辰提，泄火之气，时支逢辰，伤官暗旺，三月丁火，最忌土气众多，时干一甲高透，坐下？辰余气足以疏此旺土，时干印不惟疏土之功，抑且可以助丁之焰，妙哉妙哉。'],
  ['丁', '辰', '乙', '巳', '丁火日元，得旺于巳，较得三比之力尤强，时干乙印又来生丁，以言身主，可谓气充神足，月提辰土伤官，秀气？行，所喜金财来于干支，格取伤官生财，季春丁火，总以财为眞神。'],
  ['丁', '辰', '丙', '午', '天干丙丁？见，是午为丙之刃地，丁之禄地，衰火转旺，妙在月提辰土，暗藏一点癸水，湿土可以纳火，是谓秀气？行，惟火土伤官之格，总喜金水和润，如柱中金水齐露，方可用金用水，否则惟有用土为愈。'],
  ['丁', '辰', '丁', '未', '时干一比幇身，未中木火？藏，日元不孤，但辰未食伤泄火，气力非尠，喜有甲印去土，然后再来金水财官，得为我用矣。'],
  ['丁', '辰', '戊', '申', '丁日辰提，土旺火衰，时逢戊申，又来土金，财多身弱，槪可想见，柱中如无木火相助，？见厚土重来，可作从儿格论命，从儿喜金财，是为儿又生儿。'],
  ['丁', '辰', '己', '酉', '辰酉？合，时己又来生金，日元丁火孤立，非有火比为助，焉能去此旺财，大凡财多身弱，独喜比劫之神，须要我身康健，其财听我指挥，否则终被他人觊觎也，如见木印去土，亦保身之一法。'],
  ['丁', '辰', '庚', '戌', '辰戌皆土，遇之必冲，他神冲之则伤，独土冲之愈旺，时干庚金，因支土旺而金亦转旺，日元之丁，仅一戌库为根，诚星星无焰之火，？宜地中有带火之木，有透干之劫比，而助之，否则终被土金扑灭也。'],
  ['丁', '辰', '辛', '亥', '辰中藏乙，亥中藏甲，枭印助丁，丁根深矣，孰知辰亥均带水，其性至湿，印绶不足以生此丁火，必须有带火之木，如寅卯同来，方能全其火之生气，时辛气泄于水，最喜有土伤以制官。'],
  ['丁', '巳', '庚', '子', '巳月丁火，气势转炎，时逢庚子，庚虽长生于巳，以巳坐火位，金未能用，且庚又泄之于子水，是壮杀星之气，喜有壬水透干，以解火炎，或土露生金，救全财星。'],
  ['丁', '巳', '辛', '丑', '地支巳丑，时干辛金高透，拱金之局，转成会金之局，日元丁火，虽坐下月提之巳，因会而失火之大用，顿成身轻财强之象，？宜有甲木透出干头，助长火之气势，然后再见壬水，泄金之气，自然五行均停矣。'],
  ['丁', '巳', '壬', '寅', '丁火得禄于巳，长生于寅，印劫同来，火势转炎，时干壬水无根，见寅则泄，身印太旺，如丙火再透，名为丙夺丁光，喜有水以助官，或金以生官。'],
  ['丁', '巳', '癸', '卯', '丁火有月提巳火之助，时支卯印之生，生旺可知，时干一癸气又泄之于木，水木火生生不已，气势极淸，乃因火力太壮，湿润？足，喜金水得地通根，以为调剂。'],
  ['丁', '巳', '甲', '辰', '丁日巳提，夏火通根，时干一甲，引火之力尤强，幸喜时支辰土，收旺火之气，书云，太旺宜泄，此之谓也，？喜再见金来，格取食伤生财，如柱中乏金，单用土泄亦可。'],
  ['丁', '巳', '乙', '巳', '月时？巳，助丁之力极强，时干乙印，又来助火，木火通明之象已成，所喜有金透干，用之为财，但木火乘旺，如无金财，又无水济，可作炎上格论命。'],
  ['丁', '巳', '丙', '午', '丁火得禄于午，丙火又坐禄于巳，丙丁上下交禄，其势炎炎难遏，自当顺其旺火之气，喜土泄之，土金同来尤妙，独不宜再见壬癸之水以激之，滴天髓云，暖之至者，反以无寒为美，其言深有味也。'],
  ['丁', '巳', '丁', '未', '巳未拱，而时透丁火，已成南方一气，若论其象，竟与夏丙无异，一神独旺，自当顺其情，不畏木印之再生，如干支再来甲乙寅卯，格取炎上为宜，土泄有晦，水克有激，金来无伤其体用也。'],
  ['丁', '巳', '戊', '申', '巳申？合，？同三会成局之？变其性，故月巳仍？失助丁之火，时申仍能全其财用，惟申中藏壬，财有泄于官，时干戊土，通根于巳，重而晦火，所喜甲印高透，引生丁焰。'],
  ['丁', '巳', '己', '酉', '巳酉会金，己土生金，金党而旺，日元丁火弱矣，柱中以金旺为病，？知夏火见金，祗身稍弱，而金成方局时，反可作火金迭迭格论命，惟须有一二点水以济，方称佳格。'],
  ['丁', '巳', '庚', '戌', '丁火得巳助戌库，庚金长生于巳，余气于戌，身财？均，火金气势相峙，得有戌土以和之，并不以此为病，所病者，土金太燥，所谓火炎土燥，须有水来润之。'],
  ['丁', '巳', '辛', '亥', '巳亥一冲，藏神皆伤，欲以巳中丙火为助，则丙失其力，欲以亥中甲木印绶来生，则印失其功，因之日元丁火，遽尔强转为弱，时干一辛财亦？眞，际此情形，宜有火比木印，方显精神。'],
  ['丁', '午', '庚', '子', '午月丁火，气势愈旺，建禄成格，丁以甲为？友，独于午月丁火，以其炎威莫当，不宜？用甲木，喜以壬癸解炎为需要，时逢庚子，涸水见金而有源，足以全夏丁之生，土来有晦火之光明，兼有？水障碍，故以少见为妙。'],
  ['丁', '午', '辛', '丑', '夏火以仲夏为最旺，此由于天时使然也，时逢辛丑，财星得库，兼有丑中一点癸水，旺火赖以调济，惟以库中之水，总觉气浊力微，不如透干之为淸，喜有一壬高透，用之自？可喜，如水太多，则甲印为贵，格取官印相生。'],
  ['丁', '午', '壬', '寅', '丁火得禄于午，受生于寅，寅午半会，印化为劫，时干一点壬水，气泄于木，木旺再来生火，柱以身主坚强，时壬又嫌无根，成为虚官之象，故须有金生水，以畅其源，或地支亥子同来，方可以官为用，土系去水之神，不见为是。'],
  ['丁', '午', '癸', '卯', '午为丁禄，卯为丁印，禄印？见月时，身主健朗极矣，时干一点癸水七杀，独发而淸，惟以水不通根，又无财之相生，虚露之象，补救之法，自宜有申亥等字，以全其财官之气，水火功成旣济矣。'],
  ['丁', '午', '甲', '辰', '午火之气，泄于辰时，甲又来生身，泄而？生，身主犹旺，辰中癸水七杀，以藏库而未能尽杀之用，书云，财星喜藏，官杀喜露，故须透之干头为贵，斯时火炎水涸，独杀嫌？足，如有金来相助，方可源远流长。'],
  ['丁', '午', '乙', '巳', '巳午气成南方，时乙泄之于火，木燥火炎，宜以润泽为先，仲夏丁火，用神不离壬癸之水，今柱中以火？为病，故见水最宜，如有辰丑湿土之泄火尤妙。'],
  ['丁', '午', '丙', '午', '月令建禄，时支又逢归禄，加以一劫透干，若是余柱无金水，作从旺论，否则大忌木火，大宜金水及湿土，而未戌不如丑辰，酉不如申，子不如亥。'],
  ['丁', '午', '丁', '未', '丁火？配，午未？合，干支阳火迭见，气势偏而不和，时支未土，有泄丁火之光，柱中气势多阴，须有甲印为辅，始收阴阳承霭之功，壬癸之水？宜多，如官杀无气，又宜庚辛生之。'],
  ['丁', '午', '戊', '申', '丁火见午则身旺，申金有戊则财旺，柱中身财？停，财为我用，申中壬水，原可泄财之气，乃以戊？干头，暗中有制壬之功，所望水勿透干，我得全其财以用之也。'],
  ['丁', '午', '己', '酉', '日元丁火，？官于月提之午，其健旺可知，时逢己酉，食财相生有情，以得禄之丁，与夫土生之金，身财适得？停，如柱中加以木火，当以财为用，如偏旺于财，当以木火为用，喜忌不可执一，须视配合以定之。'],
  ['丁', '午', '庚', '戌', '丁日午提，建禄之格，时支一戌会午，身旺极矣，时干一庚，以坐下火位，金性转脆，喜有湿土之生，遂全财之大用，柱中火土金顺而不悖，可作伤官生财，一见水来，遂弃财用杀。'],
  ['丁', '午', '辛', '亥', '丁日午提，建禄之格，时逢辛亥，月午以有亥水之隔，不能损时干之金，但欲以辛财为用，势又未能，盖用辛而有亥泄也，故用财须有食伤之土，用官须有申酉等字。'],
  ['丁', '未', '庚', '子', '未月丁火，阴柔气弱，已成强弩之末，时逢庚子，状似七杀根伏，实则杀为未制，庚财虽泄于子，有土气又转生，时屈夏末，丁力旣弱，固不可无甲以引助，或劫比以幇之。'],
  ['丁', '未', '辛', '丑', '丁日坐下未丑，食重等作伤官，？月火衰土旺，丁火独患其泄，时干辛金，得库于丑，财星不弱，惟不能为我所用，柱中火力？足，自喜甲印生之，？有一庚以佐之，此庚金劈甲引丁之说也，丁火无甲，则无所附丽，甲木无庚，无所发挥，此系？外之？，？月丁火，应作如是观也，'],
  ['丁', '未', '壬', '寅', '丁火？于未提，火之余气也，时支一寅，劫印禄生之地也，日元因之转旺，时干壬水，官星本淸，乃以坐下寅木病地，徒然见木而泄，其为无辅之孤官明矣，须有得地之金水为助，使其身官？旺，始美。'],
  ['丁', '未', '癸', '卯', '卯未会木，食化为印，去忌存喜，日元赖印为旺，时干一癸泄于卯，亦是杀印相生之象，惟身旺之造，自不宜以印化杀，独喜财来滋杀，故水弱得水助固佳，如有金财滋杀尤妙。'],
  ['丁', '未', '甲', '辰', '丁未甲辰，印比？得余气，而未辰皆土，泄丁而丁怯，喜其时干透甲，旺土得制，弱火得生，有病有药，不偏不倚，最喜有庚再透，遂成劈甲引丁之大用，所以？月丁火，不忌财印交错也。'],
  ['丁', '未', '乙', '巳', '时干乙木印绶，泄之于巳，而巳火劫财，又？泄之于未，身印似旺非旺，且不问其身旺伤旺，仅以火炎土燥论之，柱中须有壬癸之水润泽，方能恢？全局之病，此亦调候之神，论命当先顾及之。'],
  ['丁', '未', '丙', '午', '丁火日元，时逢午，归禄成格，时干丙火，又来生身，而月提未土，余时午？合，满盘炎上，惜在夏末，见水须防火激，见金须防金镕，欲使其体用不碍，惟喜有土以泄之耳。'],
  ['丁', '未', '丁', '未', '天干？丁，地支？未，日元之气势极旺，惟月时坐下？土，有晦火之光辉，又以土燥为病，自应有水以润之，且乙丁气皆属阴，甲木岂可无之，丁以甲木来引，见之乃是上格。'],
  ['丁', '未', '戊', '申', '丁火日元，提未伏藏乙丁，衰火赖此库中印比以生，但月未时戊，伤官之气究旺，时支申金，藉土生而？强，仍以身弱财旺，实难负荷，自喜甲丙同来助身，俾身财得以？均。'],
  ['丁', '未', '己', '酉', '丁日未提，生力弱而泄力强，盖土正当令，丁火怯矣，时干己土，坐下时支酉金，食神旺而生财，柱中一点比印之根，自难任此食财，如再见迭迭之土，兼获透干之金，火土金三神成象，当顺其土金之气，以从儿格论，否则仍喜木火幇身。'],
  ['丁', '未', '庚', '戌', '时戌为丁火之库，提未为丁火之余气，丁有衰而不穷之象，季夏土正乘权，戌未相刑，其土愈实，时干庚金，因土旺而金亦加强，身财并美，惟以气势枯燥，须有水以润泽，则全局呈中和之象矣。'],
  ['丁', '未', '辛', '亥', '日元丁火，以月未时亥之会木，弱而不弱，亥中官印双淸，兼有时干辛财之生，可谓气协情和矣，如用官，以透干为眞，戊己之神不可见，见则弃官而用财。'],
  ['丁', '申', '庚', '子', '三秋丁火，退气柔弱，喜有甲木为生身之本，庚透时干，旺财得禄，时支一点子水，遇申而会，财化为官，而时干之庚，见水亦情？于水矣，金水？旺，日元孤虚，如再见金水，当弃其歇灭之身，而从官杀，否则喜见印比。'],
  ['丁', '申', '辛', '丑', '日元丁火孤立，月时丑申，时干又辛，食财之势，一致团结，如有木火之神，则不患其伤财之猖狂，旣无印助，又无比劫之幇身，乃而从财为断。'],
  ['丁', '申', '壬', '寅', '丁火日元，时支寅木转衰为旺，书云，如有甲木，可秋可冬，足征秋火唯甲印是赖，乃以月提申金，见寅必冲，旺者冲衰，衰者自拔，所喜一壬透干，财化官，而官仍生印，印又接引日元，时壬调解？仇，自可取用。'],
  ['丁', '申', '癸', '卯', '丁日卯时，卯印力不如甲，幸峙干一癸。与卯有情，足以助木精神，月提申金，见水则泄，金水气壮，日元较弱，喜有木火助身，方得任用财杀。'],
  ['丁', '申', '甲', '辰', '丁日申提，财星秉令而旺，时支辰土，泄火生金，时甲虽可幇身，乃虚露无力，大凡所喜之神，必欲通根得地方佳，否则效力几等于？，伤财？旺，自不宜再见干头，地支有巳午寅卯等字，则我身不强自强矣。'],
  ['丁', '申', '乙', '巳', '丁火，时下巳劫，时干乙木再生，木火气贯，我身旺矣，月提申金秉令，财星适为我用，书云，官宜露而财宜藏，？有以也，此乃中和为贵之造，不论逢生逢克，终是危险不涉。'],
  ['丁', '申', '丙', '午', '丁火归禄于时支之午，见劫于干之丙，阴火气转生旺，火气衰絶之时，全恃比劫多助，月提申金秉令，财星极眞，而申藏一壬，亦可调济火之精神，喜一金再透，用财愈见淸纯。'],
  ['丁', '申', '丁', '未', '时未为丁火余气，再一比透干，火力乃强，月提申金，以有未土而财星？眞，书云，秋丁最喜引甲，又喜庚劈，乏甲庚而见乙木者，以枯草引灯喩之，故此造身虽不弱，有庚甲？字，则？佳矣。'],
  ['丁', '申', '戊', '申', '月时？申，财星禄旺，时干一戊伤官，又来生金，而日元丁火，旣少劫比之助，又乏印绶之生，其势孤立，如再见金财得局，成方，应以从财论矣。'],
  ['丁', '申', '己', '酉', '日元孤立，衰弱极矣，酉申皆金，时维七月金旺，以如许旺财之肆逞，我身其能任之乎，如柱中不见比印之神，从财乃眞，否则，终为身弱财多之象。'],
  ['丁', '申', '庚', '戌', '丁火坐库于戌，庚财得禄于申，以旺金而与衰火较，其轻重相去远甚，秋丁以甲木为唯一需要之神，又为助身不可或缺之物，急宜通根透干，丙火劫财，亦应柱中频见，书有借丙暖金曜甲之句，盖专以秋丁而言也。'],
  ['丁', '申', '辛', '亥', '柱中金水并见，财泄而杀旺，一丁虚露，全恃亥甲相助，其火力亦云微矣，况亥中之甲，乃系带水之木，性湿而难以引丁，八字以水旺为病，自以土来为宜，而身弱则喜有火为助，甲透引丁？佳。'],
  ['丁', '酉', '庚', '子', '丁日酉月，衰絶之火，不？乎甲丙为助，时逢庚子，庚金财星得旺，子水见金则？而致之，而金亦情？于水，金水威胁日元太过，财旺须有劫以收之，官旺宜见印以化之，故欲去其病，非木火重见不为功。'],
  ['丁', '酉', '辛', '丑', '酉丑半会金局，辛金又透时干，锐锐秋金，生旺极矣，日元丁火孤立，被旺金包围，其为财多身弱明矣，须有重重丙丁之神，得地通根，遂成剑戟之功，此系一神一用之法，财旺固别无他用也。'],
  ['丁', '酉', '壬', '寅', '丁日而时支寅位，印劫同宫，月提酉财，藏而气眞，时干壬水正官，旣来就我，又来生印，不问其就我乎，生印乎，要皆官淸印正之命，用神在时支之寅，金财忌见，土能生金，亦弗喜。'],
  ['丁', '酉', '癸', '卯', '月时卯酉一冲，印根被伤，日元丁火，以印伤而少援助之神，时干癸水七杀，木不受水之气，反得月酉之生，转成杀重身轻，自喜有甲寅丙午等字，以充实身主。'],
  ['丁', '酉', '甲', '辰', '辰酉？合之说，则土来生金之谓，时干甲印，以坐下辰土余气，足以助身之旺，惟身根浅微，须有劫比为助，其身自强，水宜少见，多则有损丁光，金来 劈甲之功，格局？为美矣，'],
  ['丁', '酉', '乙', '巳', '日元丁火，？官于巳，时干乙木，又得生身之功，印劫？见，身主可谓朗健矣，？知巳酉半会，化劫为财，此系无情之会，而日元则旺转为衰，再见金水，则木印火比，万不可少。'],
  ['丁', '酉', '丙', '午', '丁日午时，归禄成格，时丙高透，火力乃强，月提酉金，虽在司令之候，以干支皆火，金财镕化，财弱须有土以生之，不惟生助金财，抑可通火金之气。'],
  ['丁', '酉', '丁', '未', '天干？比，悉聚于时支未土，未中乙印，又来生助日元，月提酉金为财，以有迭火所制。金气不免有损，柱中火旺金衰，喜有透干之金财为助，？喜辰丑之土以补苴其财，如见壬癸杂出，当弃财而用官杀。'],
  ['丁', '酉', '戊', '申', '申酉气秉西方，财星党众而旺，时干戊土，转辗又来生金，而日元丁火虚立，何能任此旺财，金旺独喜劫比，戊透又喜甲疏，如本身无印劫为助，顺其金土之气，格成从财可也。'],
  ['丁', '酉', '己', '酉', '月时？酉，财星得时秉令，时干一己，食神气？于财，而日元丁火，旣无幇身之比劫，又无生火之木印，身主衰弱极矣，秋丁其弱无烟，故喜甲丙？神，祗须得地通根，不必定要透干，祗要衰而不穷，不必旺同于丙，此阴火独具之性质也，今旣丁火全无根气，如再来庚申酉等字，可以从财。'],
  ['丁', '酉', '庚', '戌', '日元丁火，生于金旺之酉月，秋丁气势熄灭，纵劫印重来，本身亦难望健旺，今以金财独旺，有甲高透，借庚劈甲引丁，方成印之妙用，而有起死回生之造。'],
  ['丁', '酉', '辛', '亥', '辛金通根于酉，见亥转生于水，可谓金水双淸，财官？旺，日元丁火少见比劫之助，全恃亥中甲印之生，总以带水湿木，兼之未透天干，印力至为微弱，宜再见甲以补之，？不可无重火以扶之。'],
  ['丁', '戌', '庚', '子', '九月土旺秉令，丁火之气尽泄于土，戌中一点丁火，微乎其微，时逢庚子，再泄于杀，而戌土制杀，水亦受伤，柱中喜甲印透干，则土病去，多木火幇身，则我身健而可任财杀。'],
  ['丁', '戌', '辛', '丑', '月戌时丑，戌丑刑出辛金，辛又有湿土之生，印气充沛，而日元丁火断难任是旺财，以本身孱弱，非甲引丙劫之得地相助，便为下命。'],
  ['丁', '戌', '壬', '寅', '寅戌拱火，日元根深，戌虽当令之土，见寅土气受怯，而寅中甲印丙劫，大有推之不移之势，时干一壬，气泄于寅，水泄则木愈旺，所喜金财高透，身强用财，明矣。'],
  ['丁', '戌', '癸', '卯', '丁火坐库于戌座印于卯，秋丁本衰，党众亦旺，时干一点癸杀，见卯则泄，所谓水到卯宫伤也，土金为可用之神，柱中见之乃佳，此系食伤生财格。'],
  ['丁', '戌', '甲', '辰', '月戌时辰，杂气逢冲则愈旺，而戌中一点丁火，不免为辰中癸水所伤，丁比有损，日元自弱，妙有甲印透干，坐下辰土余气，印绶得根，卽可引生衰丁，滴天髓云，如有嫡母，可秋可冬，如地之？见寅巳等字，尤属蔕固根深矣。'],
  ['丁', '戌', '乙', '巳', '日元丁火，时逢乙巳，木火同来，丁火旣有劫印之助，其身自旺，喜巳戌中土金透干，时屈深秋，固不欲水多制火，但一二藏支湿润，亦不可或缺也。'],
  ['丁', '戌', '丙', '午', '丁火归禄于午，午戌半会，丙又透干，柱中火势迭迭，九月丁火，虽多劫比之助，不作炎上格论，乃以火势旺则？燥，必要水来解炎，金来发水，用之财官为贵。'],
  ['丁', '戌', '丁', '未', '戌未相刑，火土之势愈？，日元？丁，气泄于土，局中伤官伤尽，命书传为美格，？知火土过于燥？，生机不无窒碍，总须有水来调济，金来生水，去其偏燥为宜。'],
  ['丁', '戌', '戊', '申', '日元丁火，生于戌月，时干戊土高透，伤旺身衰之象，时支申金，戊又生之，土金环泄，火光晦矣，际此情形，非有甲木来疏，终未能添火之焰，一见木印，再见庚财，财印？全，可以用庚劈甲，而引丁火，斯为美矣。'],
  ['丁', '戌', '己', '酉', '酉戌气秉西方，时己又来生金，财星党众，而日元丁火，仅恃戌库以存不无身弱财多之病，印绶生身，固最为亲切，还须木火同？，日主方苏。'],
  ['丁', '戌', '庚', '戌', '月时？戌，燥土也，日坐？库，微火也，时干庚金，财星也，丁微，土燥，金脆，为病，喜有木来生火，金来泄土，水来洗金，为妙，有木可以时庚为用，乏木必须火比为助。'],
  ['丁', '戌', '辛', '亥', '时逢辛亥，金水之气？通，亥藏一甲，丁火之气归旺，但月令坐下戌土，见亥则官星受伤，地支须有木来制土以护官，或金来泄土以生官，然后官星乃淸，而木印亦藉之得根矣。'],
  ['丁', '亥', '庚', '子', '三冬火气已絶，阴柔之丁，欲其火势融融，非甲无所附丽，丁日亥提，官印两旺，时逢庚子，财官之气益强，以时屈冬令，丁火畏水之盛，须有甲引透干，化杀为先，否则不将有杀重克身之咎乎。'],
  ['丁', '亥', '辛', '丑', '亥丑气类北方，时辛又来生水，寒金湿泥，丁火生机受困，亥中甲印，以带水之木，未能引火之焰，须有土以制之，去水方全火生，如柱中仅土无木，反成克泄交加之象矣，'],
  ['丁', '亥', '壬', '寅', '丁日亥提，水旺火衰，时値寅位，火气转强，寅中丙生甲禄，丁火如子得母，爱护有人矣，时干一壬高透，通根于亥，官星极淸，惟以气势太寒，殊难引以为用，如再见金透土来，方为可贵，否则，仍以甲木化水为尊。'],
  ['丁', '亥', '癸', '卯', '亥卯半会木局，时癸杀化为印，日元丁火，见印自强，惟卯有癸水之生，甲有亥水之养，木湿焉能助丁之气，故木印未必皆能生火，须视其得用与否，冬丁喜有带火之木，方能发丁之光，如甲寅等字，书云，如有嫡母，可秋可冬，此指寅而非指亥也。'],
  ['丁', '亥', '甲', '辰', '丁日亥提，火畏寒气之缚束，时干一甲，长生于亥，余气于辰，正可引丁之焰，初冬丁火，得甲引则固美，但火之劫比，万万不可或缺，须有火比同来，其气方充，否则单见木印为助，气势仍欠充沛。'],
  ['丁', '亥', '乙', '巳', '丁旺于巳，乙印又来生身，望之身主健全，？知月提坐亥，遇巳则冲，竟使巳火根拔，日元旺转为衰，所喜有亥中甲木，接引水火之气，？可补救于万一，所喜有甲透干，劫比重？地支，丁力自然发煌矣。'],
  ['丁', '亥', '丙', '午', '丁禄于午，丙劫再幇身，日元之气极旺，月提亥水，所藏壬甲，官淸印正，惟官星泄于寅，水势有欠精神，喜金来透干，用在财旺生官，如金水多见，用土制之，杀化为权。'],
  ['丁', '亥', '丁', '未', '亥未有拱木之情，印星气结为旺，时日丁火，又？通根于未，可谓印比得根，月提亥水，官藏不露，且又泄于印，难亦可用，不如壬水透出为淸，如见迭迭戊己，制住水官，当作火土伤官论。'],
  ['丁', '亥', '戊', '申', '日元丁火，全赖亥中一点甲印以存，申亥中藏壬水庚金，亦可泛滥，幸时干戊土，去水之病，惟日元患克泄，喜木印化杀，火劫助身，以全身主之气。'],
  ['丁', '亥', '己', '酉', '己酉在时，亥水在提，土金水层层相生，？到水方为止，故以水杀独旺为忌，日元丁火，仅恃藏支甲印为助，内患衰旺难均，故喜寅午等印比通根，身健而用杀方眞。'],
  ['丁', '亥', '庚', '戌', '地支官伤并见，土水之气未协，妙有庚财转生，损之又？益之，官星尙不为病，日元丁火，仅得时支戌库，身主欠强，卽官淸亦难为用，须先印劫幇身，印尤可尊。'],
  ['丁', '亥', '辛', '亥', '丁日亥提，官泄于印，时逢辛亥，水泄于木，地支？亥，木印？生，似可为丁火之根，？知木湿而寒，难发丁火之焰，以旺水为病，须有带火之土，去其寒湿，或透干甲丙助之，自然药到病除矣。'],
  ['丁', '子', '庚', '子', '丁诞子月，严寒凛冽，水归冬旺，有困丁火，月时？子，七杀势专，一庚透时，徒增寒水之冻，日元丁火，几被旺水熄灭，是其病则在水矣，莫如用木泄水之气，用带火之土以？水之源，我身遂得生成。'],
  ['丁', '子', '辛', '丑', '丁日子提，水旺火衰，时逢辛丑，金寒水冷之象，仲冬丁火微弱，最怕归旺得垣之水，为之浸淫，际此水旺火熄之时，非有得地之厚土，不能挽狂澜于旣到，尤喜印比双透，方可转达情和。'],
  ['丁', '子', '壬', '寅', '丁日子提，水旺火弱，时干一壬，坐下月提子刃，官星之气愈纯，惟以火不胜水，官淸未能为用，喜其时支寅木，寅中甲禄丙生，不惟有全日元之生，抑可以泄旺水之气，冬丁以寅为嫡母，见之最为亲切，苟有巳戌等字再来，壬官又何害于我乎。'],
  ['丁', '子', '癸', '卯', '丁火见印于时卯，时癸得禄于提子，杀以透干为旺，遇卯则泄之于印，惟以卯木见水则湿，？足以引生衰丁，须有得地之寅，透干之丙，则寒水之气渐消，而木火自得巩固矣。'],
  ['丁', '子', '甲', '辰', '子辰半会，湿辰转化为杀，冬丁困于旺水，虽时透甲印，以火根浅薄，生火之力？足，故喜劫比多见，培养火之元气，再来庚财相济，则成用庚劈甲引丁之局矣，如有壬癸透干，土之食伤不可少。'],
  ['丁', '子', '乙', '巳', '丁生子提，寒火见水不发，时元印劫同来，丁力弱转为强，月提之子，遇火而暖，冬丁以水旺为病，病其寒也，柱固有火，卽用之水杀，亦未始不可，如壬癸频透天干，则非有土制，不能化权。'],
  ['丁', '子', '丙', '午', '子午一冲，旺起而衰拔，日元丁火，赖午火为根，冲则根倾，时干丙火劫财，助丁有莫大之功，乃以午支不隐，仍作身弱看，须有寅巳等字见于地支方实，然后再见庚壬财官，亦非所忌矣。'],
  ['丁', '子', '丁', '未', '丁火通根于未，时干丁比幇身，身主弱而不弱，月提子水，余时支未土，不无食杀交战之象，仲冬丁火，每以水神为病，有土为药，？知水透宜有土制，水藏何须土制，得有丙甲庚壬相济尤妙。'],
  ['丁', '子', '戊', '申', '申子气归北方，日元丁火，？于克地也，时干戊土，虽有制水之功，而坐下申位，反来增财之势，财旺转来生官，是制之未能也，柱以克泄？见为病，印比重见方佳。'],
  ['丁', '子', '己', '酉', '月提子水，克制丁火，时下酉金，有？水之情，而时干己土，不惟不能制水，抑且助金而生水，土金水顺序相生，其重心固在于水，以孤立之丁，不将有损灭之虞乎，如干支印比皆絶，我当顺其金水之情，而以从杀格论之。'],
  ['丁', '子', '庚', '戌', '丁火时戌，日元仅可言得根，火气仍弱，月提子水，惮时戌之制，是戌土诚护火之神也，无如天干透庚，未能尽财之用，反有损丁之咎，甲系丁之嫡母，巳寅为护身之宝，柱中岂可无之耶。'],
  ['丁', '子', '辛', '亥', '亥子气全北方，时干辛财生杀，水势偏于一方，寒火气怯而弱，大喜劫比迭见，？有甲印透干，以全日元精神，书云，冬丁有甲，不怕水多，为其印能化杀也，不怕金多，庚金劈甲，为其功成反生也。'],
  ['丁', '丑', '庚', '子', '十二月丁火，位居养地，其气酝酿，有乘时待旺之象，月提丑土，丑中辛癸同宫，金水之气旺于土，时逢庚子，子丑成北方一气，丁火为水所困，微弱极矣，甲印为救丁之正用，且为泄水之眞神，允宜多见为佳，巳午劫比，亦喜齐来。'],
  ['丁', '丑', '辛', '丑', '日元丁火孤立，时辛？归丑土，是名财星得库，丑中辛癸同宫，金水之气偏旺，但以丑土？见，水浊不淸，徒成湿泥之象，旣以土金水为病，又不能从财杀，惟以火比木印，多多益善。'],
  ['丁', '丑', '壬', '寅', '丁火气泄于月提丑土，而时壬透干，丁壬化木未成，妙在时支寅木，丁火遂以通根，书云，支有寅木，冬生不惧水，如见土而又？见金，应以食神生财为用。'],
  ['丁', '丑', '癸', '卯', '癸水七杀之气泄于卯，而丑被卯木所制，卯中乙木虽柔，可以刲羊解牛，日元丁火，赖时支一印，有衰而不穷之象，惟乙为阴木，还不如甲木引丁之有力，再见庚财高透，格局臻于全美矣。'],
  ['丁', '丑', '甲', '辰', '时甲引丁为喜，辰丑泄火为忌，去病莫如得寅，则可去其寒湿之土，而生垂絶之火，如柱中迭逢木印，祗要金财得所，反成有用之材，土多可作食伤生财格论。'],
  ['丁', '丑', '乙', '巳', '巳丑拱金，并非似巳酉或酉丑之可会，所以时支巳火，仍？失其火之眞气，而时干一木，被火邀而近之，身旺可知，月提丑土，妙在辛癸？藏，财杀有气，如水木？透，我得舍印而用杀矣。'],
  ['丁', '丑', '丙', '午', '丁火日元，得禄于午，时干丙火，又？见刃于午，身主可谓旺矣，月令丑土，妙在金水润湿，可泄旺火之气，如有金透干头，用在土金，格取食神生财，如壬水得见，水火之情通矣，当以用官为贵。'],
  ['丁', '丑', '丁', '未', '丑未一冲，土以冲而愈旺，？丁通根于未，本身亦云有根，如四柱多见辰戌丑未等字，是名聚库，祗要我儿又生儿，如从儿不成，徒见一派土者，用甲疏之可也。'],
  ['丁', '丑', '戊', '申', '月令丑土，时値戊申，乃身弱伤旺之象，日元丁火，几如一灯之已成余烬，非添以膏油，焉望？明，木印为丁之嫡母，柱中岂可无之，有木则土病自去，身主自旺，如乏印而有水杂出，土水混浊难淸，其为下命必矣。'],
  ['丁', '丑', '己', '酉', '酉丑会局，时己生金，财有食助，气通门户，日元丁火孤立，终为土金所困，财旺之造，原喜劫比为助，是名一神一用，乃以冬丁气弱，兼有己丑？土之泄，甲木尤要于火比，况丁火独喜甲引，火其次焉者也。'],
  ['丁', '丑', '庚', '戌', '丑戌皆土，一庚独透时干，土来生金，惟财独旺，丁火力弱，不能任财，急宜有甲木透干遂成庚甲劈引之用，旣以比肩太少，扶阳未成，巳午重来最妙。'],
  ['丁', '丑', '辛', '亥', '时逢辛亥，金水同来，月提丑土，水旺则荡，日元丁火，几被金水包围，如再见财杀之神，则成水旺火灭之象，仍以木印火劫为最要之神。'],
  ['戊', '寅', '壬', '子', '五行之土，散在于辰戌丑未四维之月，非似金水木火有专旺之时，正月戊土位？长生之地，寅中藏丙暖土，甲木生火，寒土气旺而实，时逢壬子财星，藉余气而转旺，初春戊土畏寒，故不喜？之伤官，增水财之势，如金水同来，土以制之乃佳。'],
  ['戊', '寅', '癸', '丑', '戊日寅提，甲丙？旺，时逢癸丑，水财得库而有根，初春戊土，用固？离水润，惟喜藏而不露，多见防土溃之虞，丙透则气暖而和，土重赖木以疏。'],
  ['戊', '寅', '甲', '寅', '戊土日元，月时寅木长生，土气尙旺，时干甲木，又？？坐寅木，七杀之气旺甚，有木重土倾之象，喜寅中藏丙火，化杀生身，书云重杀猖狂，一仁可化，仁者，丙火之印也，柱中木火土三神，气势偏燥，支有一二点水而润之，方全暖润疏辟之功。'],
  ['戊', '寅', '乙', '卯', '寅卯气归东方，时干乙官坐禄，春木原属当令，日元戊土，虽长生于寅，亦难敌其旺杀，喜火印透干，木从火化，否则须有金以制木，取伤官驾杀。'],
  ['戊', '寅', '丙', '辰', '戊土得比于时支之辰，兼有月提寅藏印比之生，土气虚转为旺，时干丙火，透自寅提，？是兴旺之象，辰中癸水居库，财印不相冲突，而反全润土之功，气秉纯和，五行中任何不忌。'],
  ['戊', '寅', '丁', '巳', '寅巳？丙藏支，时干丁又高透，印绶偏旺，初春戊土，本以和暖为先决问题，但过暖又嫌亢燥，有失滋生万物之功，故喜水来润泽，如柱水气微，则喜金来助水，遂成食伤生财之格。'],
  ['戊', '寅', '戊', '午', '日元戊土，生坐于寅，见刃于午，寅午会半局之火，七杀化印以生身，时干戊土高透，又来助身，书云，土散则轻，土聚则滞，此以滞者为病，喜金有以泄之，水以润之，木以疏之。'],
  ['戊', '寅', '己', '未', '日元戊土，坐寅木长生，时干时支，有己未？劫，土气健旺，月提寅木，以中藏火，疏土之力？足，天干须有甲以助之，旣有木为救星，絶忌见金，无木则喜有金以化土。'],
  ['戊', '寅', '庚', '申', '月提时支，寅申互冲，冲则金木之气涣散，食杀？失其用，时干庚金坐禄，亦以冲而无根，喜有午戌合寅全申，则以庚金食神为用，否则仍喜比印为助。'],
  ['戊', '寅', '辛', '酉', '戊土长生于寅提，时逢辛酉，伤官坐禄，秀气发越，春土固以暖润疏辟为贵，不？丙甲癸三神，如三者未全。必使有以全之，三者已全，？当视其孰为亲切，择一以用之，身弱独喜火印，身旺财杀为宜，如无财杀，泄之可也。'],
  ['戊', '寅', '壬', '戌', '时支戌土，为日元助旺之神，月提寅木，又属土之长生，时干一壬为财，以坐下戌土，大有去财之嫌，喜支见子亥等字，以全水之精神，自当取财为用，如见金以？通比财之气者，尤为加贵。'],
  ['戊', '寅', '癸', '亥', '寅亥？合，助长七杀之势，时逢癸亥，财来杀势愈旺，日元戊土，虽有寅中丙戊印比之助，究不敌于财杀，是杀重身轻，明矣，去杀之肆逞，原以食伤为美，但此造见金，旣不能制杀，抑此生财以助杀，故非用火印化杀生身不可。'],
  ['戊', '卯', '壬', '子', '二月戊土，受克之乡，不逮寅月为旺相，戊诞卯提，官星秉令，时逢壬子，财星之力强，财官皆淸，惟日元过弱，喜有火土比印为助，身健方可任官。'],
  ['戊', '卯', '癸', '丑', '时支丑土劫财，被提卯制之殆尽，所谓乙木虽柔，刲羊解牛，丑中辛癸相生，暗助时干癸财，则财透而且淸，日元戊土衰弱，难任其财，喜有辰戌之土，聚以扶之，丙丁之印，焕以暖之，身主未臻坚固，而独见食财并来，能不为身弱财多者几希。'],
  ['戊', '卯', '甲', '寅', '寅卯官杀相混，时杀又透干头，此系杀从官势，非为混也，日元戊土，仅恃寅中丙印戊比。身不敌杀，须有干透之印，化杀生身为美，木土皆燥，还需一二点水以润泽。'],
  ['戊', '卯', '乙', '卯', '乙木官星，月时？逢禄地，日元戊土虚弱，岂堪旺木之克，而有倾陷之虞矣，喜有土比火印生扶，方得官身？停，否则，一派水木之神，可作成象之从杀论。'],
  ['戊', '卯', '丙', '辰', '戊日辰时，比肩幇身而有根，时干丙印，得卯生而官印相随，极尽官淸印正之妙，木火土气势纯粹，一淸到底，喜有水藏支，而官之原神透出，格成财星生官，如土金杂出，则浊而不淸矣。'],
  ['戊', '卯', '丁', '巳', '时逢丁巳，印星得土而旺，日元戊土，见巳为归禄，月令一点卯木，官星淸净，身旺者可以官为用，惟卯木见印则泄气，喜水财生官，方全财官之用，否则是名孤官无辅。'],
  ['戊', '卯', '戊', '午', '日时？戊并？，气聚午刃，身主之健可知，月令卯木官星，其情？于午，转添印绶之旺，官印比转辗相生，一气呵成，亦是淸净，惟时値木火气壮，调候尤为重要，须有水财通根，则木不燥，火不？，土可发生万物矣。'],
  ['戊', '卯', '己', '未', '戊土日元，诞于卯月，土气休囚，时逢己未，有？劫助身，弱转为旺，？知卯未半会木局，比肩化官，遂成土木交战之象，喜年月有丙丁通官比之气，而成官印身一顺相生，土少湿润，？喜水来调候。'],
  ['戊', '卯', '庚', '申', '戊生卯月，其气正衰，时为庚申，食神有气，卯木见申暗合，官星有所牵绊，此以身轻食重为病，须有得地透干之土，再见印以去旺金，书云，身弱伤旺，佩印为先，换言之，则用印去伤以护身也。'],
  ['戊', '卯', '辛', '酉', '卯酉逢冲，有谓金克木，而非木克金，？知金旺则木受伤，木旺则金受怯，此条辛酉金气得禄，卯木当令乘权，？相冲动，无所轩轾，则金木之本气皆伤，日元戊土，旣有旺木之克，？见金伤之泄，可谓弱矣，唯喜火印化木制金生身，一字可有三用。'],
  ['戊', '卯', '壬', '戌', '戊日戌时，身主通根，戌中一点丁印，又来助身，皆所谓吉神深藏是也，月题卯木，又戌？合，暗来助印，而时干壬水偏财，以坐下戌土比肩，水不得根，身旺本喜见财，故须有水金，财赖食生为美。'],
  ['戊', '卯', '癸', '亥', '亥卯会木，时干癸来滋木，日元戊土孱弱，杀旺自喜食伤，今杀重而身轻，惟有印以化之，如比印？缺，再见木成方局，作从杀格论。'],
  ['戊', '辰', '壬', '子', '三月戊土，秉令乘权，戊日辰提，比肩幇身，时逢壬子，财星极淸，子辰半会水局，有比化为财之意，惟以时値土旺，仍是身财？停，喜有金来引通土水之气，此则食伤生财格，见木火官印亦不忌，惟总以财为中心。'],
  ['戊', '辰', '癸', '丑', '戊得辰丑，土有旺实，时惟三月，土重有聚滞之虞，时干癸财，因辰丑中藏辛癸，虽値休囚，党众亦强，春末戊土阳壮，原喜水？润土之燥，重土为病，甲木尤喜见之。'],
  ['戊', '辰', '甲', '寅', '日元通根于辰，时甲得禄于寅，杀身相均，自以七杀为用，书云，身强杀浅宜生杀，身轻杀重宜化杀，故喜有水财为贵，旣可润土之燥，又得滋木之气，一举？得，不亦美哉。'],
  ['戊', '辰', '乙', '卯', '戊日辰提，日元得以幇身，时逢乙卯，官星独发而淸，卯辰气聚东方，官多可作杀看，杀较重于身，喜有火印以化之，支中藏有微水润之？可。'],
  ['戊', '辰', '丙', '辰', '戊土日元，月时？坐辰土，迭比生扶，身主朗健，辰中乙癸？藏，财官虽不透干，势亦不弱，以时上丙火，气泄于土，比印益觉有情，喜金水木再露，？见精神。'],
  ['戊', '辰', '丁', '巳', '戊土归禄于巳，得比于辰，日元生旺极矣，三月火已进气，火多有防燥土，故须有水财以济之，书云，忌旺火煅炼焦折，得盛水滋润成功，信非虚语，如柱中？有金之相助，？觉淸纯，'],
  ['戊', '辰', '戊', '午', '天干？比并？，通根于月提之辰，聚气于时刃之午，三土一火，身主旺矣，辰中一点癸水，藏支有情，其功用足以润土之燥，身旺刃旺，独喜甲木透干制之，所谓逢刃看杀，杀刃最喜双全。'],
  ['戊', '辰', '己', '未', '戊辰己未，分？月时，迭迭党众，土聚则滞，喜木疏水润，金泄，如四主中见火土，絶无木金克泄之神，当从土重，作稼穑格论，旣成此格，最忌木之官杀。'],
  ['戊', '辰', '庚', '申', '戊土辰提，时逢庚申，金泄旺土，秀气？通，地支申中有长生之壬，辰中有坐库之癸，以申辰又有拱水之情，故如其言食神旺相，不如言财星有气，以多见火土幇身为宜。'],
  ['戊', '辰', '辛', '酉', '时逢辛酉，伤官得禄，酉辰明为？合，实则辰土生金，日元戊土，虽在司令之候，以辰比被酉牵绊，助身之力失专，以泄气太过为病，自应火印为救，书云，混杀贵淸，遇伤喜印，旣见火矣，劫比亦不可少。'],
  ['戊', '辰', '壬', '戌', '月辰时戌皆属土，所谓朋冲，因冲以土气犹旺，时干壬水，为辰戌制之殆尽，喜有木以疏之，否则金来泄之亦可，忌土再重，微火不妨。'],
  ['戊', '辰', '癸', '亥', '日元戊土，逢辰提以身旺，时値癸亥，上下皆财，亥中甲木，？有水财之生，七杀神完气足，因之比财虽争，而有杀来制劫，身主较轻，财杀较旺，用火印则身杀？停矣。'],
  ['戊', '巳', '壬', '子', '巳月丙戊司权，火旺土实，喜有木之疏辟，水之润泽，此系初夏戊土不离之眞神，戊土建禄于巳，母旺子相，时逢壬子，喜能润土之燥，自当以财为用，劫比不欲透干，透则假神乱眞。'],
  ['戊', '巳', '癸', '丑', '戊土得禄于巳，母子同旺之象，夏土阳气相催，土有干燥之患，欲其万物生长，全赖水以相济，时落癸丑，金藏水透，用在癸财，喜余柱再见金水为助，火土皆忌神，少见为是。'],
  ['戊', '巳', '甲', '寅', '提巳为戊土之禄，时寅为戊土之生，劫印通根，日元气势充沛，时甲坐禄于寅，木助火势而益旺，杀有印化，土有印生，格局纯粹，惟柱中火炎土燥，偏枯之象，欲其气势中和，非有水来调候，金来发源不为功。'],
  ['戊', '巳', '乙', '卯', '时逢乙卯，官星得禄，月提巳火，见木生而愈旺，因之日元戊土，高亢极矣，天地万物之生固在土，苟非水以灌漑，从属石田而已，故水财为夏土当务之急，有水而无金，荣华不久。'],
  ['戊', '巳', '丙', '辰', '戊土通根于巳，巳为日元之禄，时丙亦根于巳，印绶亦得禄也，身印？旺，且又根深蒂固，时支辰土，以藏癸水之财，土气润而火赖以泄，惟库中沟渎之水，？量极微，须有水之元神透干，或有金之食伤相生，用在伤官生财必矣。'],
  ['戊', '巳', '丁', '巳', '戊土？见巳禄，正印又透时干，满盘火土，生旺极矣，此条火高土亢，厚而且实，？应用水调候，乃系格之正用，如不见壬癸之水，喜有金以泄之，此用在食伤，书云，土逢旺月见金多，总为贵论，如不见金，一派戊己者，作稼穑格论。'],
  ['戊', '巳', '戊', '午', '天干？戊，地支巳午，日元禄刃？备，土气过旺则滞，以此一片？火顽土，病在亢燥可知，须有通根之水，为之沃润，方可发育，如滴水气浅，反来激火之炎，终被旺火灼干，故夏土用水，尤须有金来发源也。'],
  ['戊', '巳', '己', '未', '柱中一派火土，日元生机受阻，蹇滞殊难？通，壬癸之水，固为夏戊调候之眞神，如单见水财，又防郡比所夺，未能则以为喜，须有金来泄土，转生水财，方全美妙，是金之食伤，尤较水财为先要。'],
  ['戊', '巳', '庚', '申', '时干庚金，长生于巳，归禄于申，书云，食神有气，胜似财官，惟若金多而泄之太过，须有辰丑之土以幇身，何以必要辰丑，为其夏土湿润也，申中壬水逢生，虽属藏支，气与透干相似，亦可以壬财为用。'],
  ['戊', '巳', '辛', '酉', '巳酉会金，时辛又透干头，日元戊土虽旺，究不敌食伤之盗泄，巳火化伤，土金气势一贯，惟时在四月火旺之候，断无从儿之说，如有水财透干，视其身强则用财，身弱则用印。'],
  ['戊', '巳', '壬', '戌', '日元戊土，戌比巳印，身主甚旺，时干壬水，坐下戌地，其财不攻自破，夏戊最忌土燥，？忌火旺，喜水润，？喜金生，今以水被戌制，是失调候之功，急宜金来泄土生水，万物得以滋长。'],
  ['戊', '巳', '癸', '亥', '巳亥一冲，水弱火旺，夫旺者冲衰，衰者必拔，旺者虽？尽拔，亦不能毫无损伤，惟初夏戊土，？在于比印多见，始言身强，乃以见水湿润为先，今时値癸亥，用财为宜，有金构通身财尤妙。'],
  ['戊', '午', '壬', '子', '午月火势炎炽，戊土有焦折之虞，首重水来调候，戊日午提，位？阳刃，土气旺逾其度，时逢壬子，厚土滋润功成，惟子午日冲，还宜有合神解冲，或金发水源。'],
  ['戊', '午', '癸', '丑', '午中丁己同宫，戊土得午刃而生旺，时支丑土，以中藏癸辛，兼之癸透时干，使日元高亢之气，得以调和，盛夏戊土，原取水来反生，见印生而反克，惟水至午月，休囚已极，非有庚辛助长弱水之势，终不能全其润泽之功也。'],
  ['戊', '午', '甲', '寅', '寅午半会火局，午火羊刃被合，甲寅七杀通根，以木从火势，杀强变为印强，而日元旣有月提之刃，？见时支寅木长生，身主之旺，可以明矣，木旺则火炎，火炎则土燥，际此情形，实以金水调候为急，生克在其次耳。'],
  ['戊', '午', '乙', '卯', '乙卯官星，独发而淸，月提午印逢官，气合情投，惟木旺转为火旺，戊土安能受兹？火威煏，所以夏土见印，生而不生，须有金水透干得根，则木润而土苏矣。'],
  ['戊', '午', '丙', '辰', '天干丙戊并？，聚气月提午火，火炎土燥之象，喜其时支辰土，可以泄火之气，润土之燥，惟辰中癸水太微，一滴难润万里，须支见申酉亥子等字，自然源远？长，'],
  ['戊', '午', '丁', '巳', '丁火得禄于午，戊土得禄于巳，身印相互交禄，火土同旺可知，夏月之土，气势燥热，安能发荣万物，喜有甘霖频降，方收灌漑之功，大凡夏月戊土，除非金木结党，干支杂出，可以转用印比之神，否则总以食伤生财取格。'],
  ['戊', '午', '戊', '午', '天干？戊，地支？午，状如天地一气，火土同归，惟以？刃齐来，愈觉火旺难遏，如再来火土，祗可顺其印比之气从旺，如有滴水杂之，见则必至相激，无非质？并豊之金水，方可用伤食或财星。'],
  ['戊', '午', '己', '未', '时逢己未，月提午刃，又来生土，土势旺而燥矣，月令阳刃，必取七杀为制，但杀有印化，徒然助火，终不如金来泄秀，水来润泽为可贵。'],
  ['戊', '午', '庚', '申', '戊？午刃为身旺，庚坐申地为食旺，身强有金泄秀，旺土得以？通，妙在申中藏壬，藉申发水之源，夏土本燥，见水则润，格取食神生财，如金水之气，胜于火土，则当以火印生身为用，然而极少也。'],
  ['戊', '午', '辛', '酉', '上条时逢食神，此条时値伤官，金有阴阳之分，泄气则一也，日元通根于月提午火，旣有伤官，我当用伤为眞，如柱有壬癸之水，则以水财为用，而以金为喜神也。'],
  ['戊', '午', '壬', '戌', '午戌半会火局，月被羊刃被合，土比化为印绶，身旺极矣，时干壬水偏财，仲夏已属失令，？已坐下戌地，弱水何堪，喜支见申亥，助长金水之气，满盘遂以活跃。'],
  ['戊', '午', '癸', '亥', '日元戊土，月提午火，印劫生旺极矣，时逢癸亥，水气坐旺，身财并茂，刃格本以杀制为贵，独五月戊土，不取杀制，而取金水层层转泄，此系时令配合之需要，可宜会而未可以言传也。'],
  ['戊', '未', '壬', '子', '？月火气转弱，土正当旺，戊日未提，时逢壬子水财得地有根，足以润土之性，惟未月有伤子水，则财星无根，喜支见一申酉之神，则土泄于金，而不去子财，故金之食伤，为夏土通关之要神，格局之佳否，金有莫大关系也。'],
  ['戊', '未', '癸', '丑', '月时丑未冲，土因冲动而愈旺，时癸通根于丑，因冲而财成虚露，？月土旺水衰，急须有助水之神为救，卽食伤是也，如天干再见劫比制财，专用金泄，亦是美格。'],
  ['戊', '未', '甲', '寅', '戊土通根于未，火土同生于寅，时干甲木七杀，以寅中丙火所泄，木旺转为火旺，乃杀印相生之局，木土皆燥，有欠生动，金水为调候之神，？宜聚气于干支也，'],
  ['戊', '未', '乙', '卯', '戊日未提，旺土得根而实，卯未半会，劫化为官，而乙木透时，官多作杀看，遂成杀重身轻之象，书云，身杀？停宜制杀，杀重身轻宜化杀，此亦以有印化杀为贵，化杀且可生身，构通木土之气，土势偏燥，则喜一二点水以润之。'],
  ['戊', '未', '丙', '辰', '戊土日元，月时未辰，时干再丙，火土重矣，妙在辰中一滴癸水，可以泄化润土，功非浅鲜，火土独强喜有泄土之金，书云，土逢贵月见金多，总为贵论，信不诬也。'],
  ['戊', '未', '丁', '巳', '巳未拱火，时干透丁，日元戊土，几成焦？，喜水灌漑，迫切需要，若无水润，禾稼不生矣，旣以火旺为病，水财为药，如不见壬癸之水，金亦可以疗实土之病也。'],
  ['戊', '未', '戊', '午', '戊生土旺之未月，时干比肩幇身，时支午火生身，旺而太过，偏于枯燥，空惹尘埃之气，土旺不？木疏，土燥不？水润，疏土之木，固属至要，调候之水，尤为先急，金能生水，亦不可或缺也。'],
  ['戊', '未', '己', '未', '天干戊己，地支双未，满盘土气迭迭，若在土旺用事之时，干支劫比再来，可作一神成象之稼穑格论，反宜火土助格，柱有金水木，则仍喜疏泄与润泽也。'],
  ['戊', '未', '庚', '申', '日戊提未，根深而旺，时逢庚申，金水同情，燥土而有金泄水润，万物自有滋长，土金气势周流，夏末火势消退，如金水过旺，有三伏生寒之象，果尔，反喜木火为救也。'],
  ['戊', '未', '辛', '酉', '凡土皆能生金，然如此条未中暗藏丁火，土气转燥，非但不能生金，反有损金之虞，故月提之未，幇身则可，生金则不可，辛酉伤官，须先有水，润土之燥，然后土金水生生不息矣，故土能生金与否，以有水无水转移也。'],
  ['戊', '未', '壬', '戌', '戌未劫比同来，日元戊土，愈见气壮，戌未中？印分？，尤足以生身，书云，身弱之造，宜助宜幇，身旺之造宜极宜泄，时壬为助调候之神，焉得不尊之宝之，但以壬水坐下克地，等于虚露，须有金水辅助，无力转为有用矣。'],
  ['戊', '未', '癸', '亥', '戊生未月，时落癸亥，水旺不逮土旺，书云，身旺有官则用官，身旺无官则用财，此论命不二法门，亥中甲木逢生，且亥未拱木，似觉杀旺于财，是用财不如用杀，若有金泄土生水，则用金？胜用木。'],
  ['戊', '申', '壬', '子', '七月戊土，寒气渐增，阳气转退，故论用神，先丙后癸，甲木次之，戊日诞于申月，月时申子会水，时干又透壬水，水来迭迭，土虚？实，财旺为病，喜有比劫制止，火印暖之。'],
  ['戊', '申', '癸', '丑', '申藏庚壬，丑有辛癸时干，又透癸财，财固旺矣，七月戊土不如夏月之实，多水则土气浮荡，难以发荣万物，须有土以驱水之病，火以煊土之性，五行庶归于中和。'],
  ['戊', '申', '甲', '寅', '戊土长生于寅，赖寅中丙印戊比扶助，望之日元通根，乃以时逢申月，申寅互冲，而寅中丙戊皆伤，身主受害匪浅，时干甲木高透，又来克身，须有印透干头，专取杀印相生。'],
  ['戊', '申', '乙', '卯', '时逢乙卯，官星得禄，月提申金，遇卯有暗合之情，戊土日元，不胜金木之克泄，必须先来劫比助之，方可用财用官，如无比劫，喜有火印化官。'],
  ['戊', '申', '丙', '辰', '月提申金秉令，时支辰土生金，辰申有拱水之情，以支无子财，仍作土金看，初秋戊土，气势虚弱，最喜印比为助，则土气磅礡，时干丙火，以坐下辰土，有晦火之光明，喜再木火生助之。'],
  ['戊', '申', '丁', '巳', '戊土得禄于巳，丁火又透干，秋土藉火而温暖，身主朗健，可取申中壬水为用，以全水火旣济之大用，再见火土，当难持久。'],
  ['戊', '申', '戊', '午', '日时戊土？透，时支午火阳刃，厚土之气聚于午，身主巩固极矣，月提申金，藏壬水之财，气势淸而？杂，当以食神生财为用，如金水迭透天干，又防寒土之性，转使高亢之土，化为湿泥。'],
  ['戊', '申', '己', '未', '戊土生申，气泄而弱，秋土最喜阳和，不离丙火照暖，时逢己未，日元得根极深，未中丁火，可施调候之功，身旺原喜财官，如再水木齐透，富贵无疑。'],
  ['戊', '申', '庚', '申', '庚金？坐申禄，食神之气势旺矣，日元戊土，未免泄之太过，食多作伤，伤重必喜佩印，故喜丙丁迭见，制尽金病，我身强？，或则多土幇身亦善。'],
  ['戊', '申', '辛', '酉', '日元戊土，値秋而气休，申中金水同宫，食财气盛，土弱难任，时逢辛酉，干支皆金，伤官之势尤旺，书云，戊土旺于生方，毙于泄方，信然，如不见火土幇身，重来庚申辛酉之神者，可弃其孤立之土，作从儿格论，否则略见火土幇身，亦非上乘之命。'],
  ['戊', '申', '壬', '戌', '戊土通根于戌，藏丁暖土有功，月提申金得禄，申中壬水透干，食神生财而旺，惟秋戊气弱，须有印比生扶，用财方眞。'],
  ['戊', '申', '癸', '亥', '月提申金，时逢癸亥，金旺转为水旺，日元戊土，几被财星包围，其为财多身弱，彰彰明矣，劫比之土，为特效良药，盖水多必赖土以去之，得火以暖土辅土尤妙，金木终忌见也。'],
  ['戊', '酉', '壬', '子', '八月金旺秉令，土之气泄，寒土生机不畅，宜秋阳以曝之，故先丙后癸为用，戊土孤立，月提酉金，时逢壬子，金水一气相生，促成寒土之病，急宜有燥实之土，方收堤防之功，如无火土资助，再见金水同来，作从财论。'],
  ['戊', '酉', '癸', '丑', '酉丑会金，丑中癸水透干，水势旺相极矣，八月戊土，原以火暖为唯一需要，徒见湿润，土之生机危殆，今欲去水之病，非印比互助不为功，有火无土，有土无火，皆非上命。'],
  ['戊', '酉', '甲', '寅', '戊土泄气于酉月，时上甲寅又来克身，八月戊土，原以火为护身符，今欲化杀之顽，制金之强，？非火印救之不为功，土来辅身亦佳，金木大忌，水尤可畏。'],
  ['戊', '酉', '乙', '卯', '月时卯酉一冲，金木？伤，时干乙木官星，因冲而转成虚露，日元戊土，旣有木之克，？有金之泄，其身何堪，官弱喜有财辅，身弱喜劫印生扶，此条需要劫印，似？甚于财也，'],
  ['戊', '酉', '丙', '辰', '辰酉？合，土从金势，戊日本以辰为根，因酉牵绊，而土根被伤，幸喜时干透丙寒土藉以暖，身衰喜有扶，见木无妨，见水宜木化之，土制之。'],
  ['戊', '酉', '丁', '巳', '戊土得禄于巳，丁火透干，印来生助，土气益厚，惟月酉时巳，半会金局，再见金水，或丑土会成全金局，反以身弱论，乃须火印为尙也。'],
  ['戊', '酉', '戊', '午', '戊土坐刃于午，时干戊土幇身，时値秋令，有此得地之午火，土气乃健，月提酉金，可以泄土之秀，火土金一气贯通，生生不已，论用当以月提伤官为宜，如有壬癸之水，转为伤官生财之格。'],
  ['戊', '酉', '己', '未', '三土一金，日元气势充沛，秋土最怕虚露，最喜劫比助之，未中暗藏丁火，藉以温暖，虽属一点吉神，胜于虚火多矣，月提酉泄，秀气？行，用取伤官，有木透干，则用官杀亦佳，'],
  ['戊', '酉', '庚', '申', '一土三金，不言而知伤旺身弱，喜佩火印，以生身而去金，又可驱寒增暖，一神三用，岂不美哉，如无火，唯有用劫比为尊，水木财官皆非宜。'],
  ['戊', '酉', '辛', '酉', '一土三金，日元孤立无助，况秋金当旺，戊土几无存身之可能矣，最喜火印为救，土比为助，不忌甲寅之木，盖能生火而不畏阴金也，水终大忌。'],
  ['戊', '酉', '壬', '戌', '日元戊土，通根于戌，时干壬水，得地于酉，身财均停，戌中一点丁火，以深藏库中，其力未能普照，値兹秋令土寒之时，须有透干之丙丁，得地之巳午，方可驱寒转暖。'],
  ['戊', '酉', '癸', '亥', '戊诞酉月，死地也，时逢癸亥，絶地也，身居死絶之地，其弱槪可想见，时癸通根于亥，兼有月提酉金之生，财亦旺矣，水旺则土荡，其财必不为我用，去水之病惟土，暖土之寒惟火，火土？见，畵？点晴成矣。'],
  ['戊', '戌', '壬', '子', '戌月土旺，戊为阳土，値旺月而气愈厚重，木疏水润，诚不少可，时逢壬子，土赖以润，土水相峙，气势未融，须有金介其间，构通比财之气，且土旺见金而泄秀，水亦因金生而免劫夺，金诚喜神，有则必发。'],
  ['戊', '戌', '癸', '丑', '戊日戌月，土虽厚而涉于燥，戌丑中有丁癸，一煊一润，土气遂以调和，丑中透出癸水，财星归眞，惟土重不离木疏，独水？防劫夺，故喜官杀制土，伤食引水。'],
  ['戊', '戌', '甲', '寅', '戊土通根于戌，甲木通根于寅，土旺有甲木之疏，有杀当先论杀，此条身杀？停，喜再有金以制之，书云，身旺杀旺，而得制其杀，化为权贵，信哉是言。'],
  ['戊', '戌', '乙', '卯', '戊日戌月，土正当令，时逢乙卯，官星独发而淸，木土相峙，兼之土燥而润，气势失之于和，支有一二点水以润之，用取财旺生官。'],
  ['戊', '戌', '丙', '辰', '辰戌为明冲，土因冲动而益旺，惟时干丙火，泄于坐下辰土，幸日主戊土健朗，非似身衰之必欲印助也，九秋土气厚实，甲木万不可少，否则惟喜金之泄，水之润也。'],
  ['戊', '戌', '丁', '巳', '戊土得禄于巳，得比于戌，丁印又得旺于巳，火土一气，身旺可知，气势偏燥，水为调候眞神，可收灌漑湿润之功，有财则病去，金发水源，亦属需要，如不见滴水，重来四库之土，可作稼穑格论。'],
  ['戊', '戌', '戊', '午', '戊土通根于戌，得刃于午，火土？旺，午戌会火，印力愈强，而土气愈燥，甲木为疏土之眞神，自属喜见，惟木燥则不能舒展，？须有水以滋之，财旺生杀，自是上格。'],
  ['戊', '戌', '己', '未', '天干戊己，地支戌未，四土迭迭，未戌中二点丁火，戊土日元，不无太旺太燥乎，如干支再见戊己丑辰等字，当顺其土性而作稼穑格论，旣成此格，木之官杀不可见，金之食伤不妨行，不作稼穑，则最喜金泄，水润，土重木折，木不济事。'],
  ['戊', '戌', '庚', '申', '申戌拱酉，时干透庚，食神之力倍增，戊土之气盗泄，幸九秋正値土旺，泄之，反所以秀土之气，有水泄金，谓之儿又生儿，转辗吐秀？美。'],
  ['戊', '戌', '辛', '酉', '酉戌气归西方，辛金透于时干，日元戊？戌提，比肩通根，戌中一点丁火，殊难去透干之辛，比伤？旺，气势极淸，惟土性极燥，还须有水来润泽方佳。'],
  ['戊', '戌', '壬', '戌', '戊土日元，月时？逢戌库，兼有戌中？丁之生，土气浑然，时干壬水，足润亢燥之土，土之生机，遂以生动，惟水？比地，须有金为水源，乃成富命，无金则徒启土水之争，势成群比争财，穷困必矣。'],
  ['戊', '戌', '癸', '亥', '戊日戌提，土旺而实，时逢癸亥，财星通根，比财接近，不无争夺之势，虽身旺可以用财，不如见金化比，转来生财之为妙，论命总喜五行？通，忌其对敌，淸浊之辨别，卽在此也。'],
  ['戊', '亥', '壬', '子', '土水不容，混合则有碍气势之淸，三冬戊土，气寒而肃，独喜木火，切忌金水，戊日亥月，寒土寒水，生机岌然，时逢壬子，倂亥而水势泛滥，水旺土荡之象成矣，惟喜阳和，故须有厚土以去水患，盛火以温土气，舍此？种，而欲身主康强，信乎其不可也。'],
  ['戊', '亥', '癸', '丑', '戊日丑时，丑系湿土，见亥则荡，明虽是土，实则与水无异，癸丑亥三神皆水，厚土转薄，浸淫堪虞，火盛则土气为荣，比助则水势乃怯，大忌金之生水。'],
  ['戊', '亥', '甲', '寅', '戊土长生于寅，甲木得禄于寅，惟亥寅？合，寅有牵掣，财杀虽旺，日元无气，有火则生机足，且成杀印相生，火印丁不如丙，巳不及午。'],
  ['戊', '亥', '乙', '卯', '亥卯会木，乙透时干，冬土本喜杀旺，为其能生火印也，今以身主孤弱，杀旺？有何益，故喜丙丁同透，化杀助身，金虽制木，奈何泄土。'],
  ['戊', '亥', '丙', '辰', '月提亥水为财，时干丙坐辰地，有晦火之光明，戊土寒湿为病，再有得地之火，与夫透干之木，土自温暖，而神完气足矣。'],
  ['戊', '亥', '丁', '巳', '戊土得禄于巳，再见丁火，寒而不寒，无如月提逢亥，巳亥相冲，斯时水旺火衰，须有寅字见之，亥为寅合而不冲巳，火土恢？自由矣。'],
  ['戊', '亥', '戊', '午', '戊土见刃于时支之午，得比于时干之戊，气势温厚，而可任月提亥水之财，此条五行抒配，凡不太过者，皆吉善之象，惟以时令气候言，金水祗可少而不可多也。'],
  ['戊', '亥', '己', '未', '冬土气怯而弱，故以劫比重见为佳，时落己未幇身，而未中一点丁火，虽不能引以为用，却亦可温暖寒土，月令亥水，旺而不猛，于财可以任用，但恐水多荡土，如木火迭出，金水亦所弗畏矣。'],
  ['戊', '亥', '庚', '申', '庚申食神得禄，亥乃壬水得禄，旺水再有金生，遂成泛滥之势，日元戊土，已化为湿土，去水之病唯土，荣土之气唯火，如水成方局，或结党而成昆仑之象者，作润下格论。'],
  ['戊', '亥', '辛', '酉', '时落辛酉，伤官得禄，月支亥水，见金生而势成冲奔，日元戊土，寒气缚束，几无存在之可能，要有透干得地之印劫幇身，否则当顺其旺势，作从财论。'],
  ['戊', '亥', '壬', '戌', '戊土通根于戌，壬水得禄于亥，身财？强，惟以十月戊土，还忌水财高透，寒土之性，且土水各立，比财相争，须木火并见，木以泄水，火以暖土，斯为美矣。'],
  ['戊', '亥', '癸', '亥', '戊土日元，月时双亥，时干再透癸水，财重身轻，水多土寒为患，非有雄厚之土，为之堤防，焉能任此旺财。无火照暖，生机何在。'],
  ['戊', '子', '壬', '子', '降冬寒气冻泞，土脉？滞，戊土日元，？于水旺之子月，时落壬子，水势冲激，转使混凝厚重，一变而为卑湿，须有寅巳戌未等神，方可挽狂澜于旣倒。'],
  ['戊', '子', '癸', '丑', '戊坐丑时，不可谓无根，惟丑为湿土，见水原以水论，月建为子，时干透癸，自然丑？于水，而失其本气，际兹万物收藏，寒土能毋溃乎，救之之法，喜有带火之土，或带火之木，频来干支，寒湿之病去，身自不弱矣。'],
  ['戊', '子', '甲', '寅', '时逢甲寅，杀印相生，日元戊土，妙处全在一寅，寅中藏丙，冬土得火温暖，分外繁荣，月提子水，见寅则泄，生机不衰，若重见土火，日元愈见发越，频来金水，格局优转为？。'],
  ['戊', '子', '乙', '卯', '乙卯官星得禄，兼有月提子水之生，财官淸纯，惟木旺总来克土，官旺身弱，成虚而孤，要劫比频见，再有丙丁之火，则木生火，愈觉有情矣。'],
  ['戊', '子', '丙', '辰', '月时子辰会水，土虚见水而愈寒，时干丙火无根，暖土之力极弱，冬戊以通根为喜，水财以得地为忌，今适得其反，是五行配合之无情也，须支有寅巳戌未等神，去水之有余，辅丙戊之？足。'],
  ['戊', '子', '丁', '巳', '戊日巳时，时干再透丁火，土暖而成堤，月令子水虽旺，以不透干头，可免坏印，冬戊惟喜火温，愈暖则土之生机愈畅，迭逢金水，危乎殆哉。'],
  ['戊', '子', '戊', '午', '戊土并？，时支坐午，气温而实，一点午火，诚寒土不离之眞神，乃以月支子水，得时秉令，子午为专气之神，相遇必冲，冲则旺发衰拔，身主随之动摇，所喜支有寅卯，则水？情于木，而不伤火，干再丙丁透露，尤妙。'],
  ['戊', '子', '己', '未', '日元戊土，得时上己未？劫之助，身主尙不为弱，月提一点子水，被上下厚土包范，制之殆尽，冬土虽以水财为病，而提纲之水不可损，是不顾其体也，劫比迭见，喜有木以疏之，火以暖之，如土气过重，又喜水来润泽也。'],
  ['戊', '子', '庚', '申', '申子半会水局，时庚情归于水，水盛土薄，喜有燥土以实之，使其身财？停为贵，冬土逢金，则菁英尽泄，佩印尤属需要，所以有火便昌，无火则亡。'],
  ['戊', '子', '辛', '酉', '时落辛酉，伤官之气极旺，日元旺者喜泄，名为秀气？通，弱者？泄，泄则本身愈衰，月提一点子水见金，则水气益寒，而戊土愈冻，诚非火土制金去水之神，重重见之，难以？生。'],
  ['戊', '子', '壬', '戌', '戊土坐库于戌，壬水见刃于子，土水虽均，冬土不耐其寒，须有通根得地之火印，动辟高亢之厚土，方可解此倒悬，否则水势猖狂，仍为财多身弱富屋贫人之命。'],
  ['戊', '子', '癸', '亥', '亥子气归北方，癸又透时助旺，日元戊土，孤立无辅，其病在水明矣，去病惟喜劫比之土，所谓一神一用，如干支再见金水，而身主絶无援助者，格取从财反佳。'],
  ['戊', '丑', '壬', '子', '季冬戊土，其性外寒而内温，在此氷雪满地之候，万物收束之时，土脉最喜温暖，故有一阳高透，名为寒谷回春，戊日丑提，土虚而湿，时落壬子，有丑中辛癸之助其财，土愈被水所困，须有戌未之土以去湿，火印乃调候之眞神，尤不可少。'],
  ['戊', '丑', '癸', '丑', '月时？丑幇身，讵知丑属湿土，冬戊见之非宜，而丑中辛癸同宫，透癸则水寒益增，而日元之生机愈促，火为暖土之神，土为去水之药，不嫌忌多，独患其少。'],
  ['戊', '丑', '甲', '寅', '季冬气进二阳，火气渐苏，戊土长生于寅，丙戊印比藏根，时干甲木，又？通根于寅，明杀生暗印，若丙丁之元神，再透干头，得见一壬或一癸，反作上命。'],
  ['戊', '丑', '乙', '卯', '戊日丑提，通根而不以旺言，时上乙木得禄于卯，卯丑紧制，而土根拔，官星虽淸，无如身不能任，故不论木强土弱，其为寒土寒木，显而？见，火印调候，为必需之神，泄木生土，又为旋乾转坤之字，跂予望焉。'],
  ['戊', '丑', '丙', '辰', '戊逢丑辰，劫比同来，日元不弱，时维深冬，寒气未解，丑辰中分藏辛癸，皆属湿泥，？足以培土之根，适足以寒土之性，而时干丙火，坐下泄地，一点阳和之气，又被吸收殆尽，此系用神无力，须有木火助之，格取杀印相生。'],
  ['戊', '丑', '丁', '巳', '时落丁巳，土赖得暖，有寒谷回春之象，时支巳火归禄，印比同藏，戊不乏生机矣，凡冬土最喜坐下火地，而最忌亥申等字破之，今以火多水少，故虽丑藏癸水，亦无大碍，若有木生印，？见生色。'],
  ['戊', '丑', '戊', '午', '天干戊土？配，通根于时支之午，日元根深蔕固，午为戊土之阳刃，其气极壮，月提丑土，以有午来照暖，寒而不寒，土气已实，喜有甲木出干疏之，如见丙丁杂出，反喜壬癸调济。'],
  ['戊', '丑', '己', '未', '戊日丑月，时逢己未，重重劫比，块然？动之象，冬土虽虚，党众转实，火为解寒之神，喜于柱中见之，如干支？见四库，而无金水木透干逆气者，作稼穑格论。'],
  ['戊', '丑', '庚', '申', '戊？丑提，寒土也，时落庚申，食神之气极旺，丑申中皆藏水，寒金冻水，相继齐来，使日元高亢之戊，变成湿泥，喜有火制金，有土幇身，火土重见，土自病去，而发荣矣。'],
  ['戊', '丑', '辛', '酉', '月时酉丑会金，劫化为伤，不应会而会之，是为无情，时干一辛高透，助长泄气，日元戊土，愈觉颓唐？振，以金旺为病，急宜佩印以药之，重土以补之，如再见壬癸亥子等字，则金泄于水，格取二人同心，则从财是也。'],
  ['戊', '丑', '壬', '戌', '日元戊土见丑戌，戌中藏丁，而寒土得以温暖，时干壬水高透，以坐下比肩之地，财星终被夺去，所喜冬土怕寒，去壬反妙，柱中土气厚实，须有木来疏之，乏木则土顽不？，？见火透照暖，益觉天衣无缝矣。'],
  ['戊', '丑', '癸', '亥', '支见亥丑干透癸水，卽可作亥子丑北方一气看，日元戊土，见洋洋旺水，化为湿泥，絶无生气，除非有戊戌丙寅等字，方可挽此旣倒之狂澜，否则须有壬癸申子等神，再来干支，格成从财。'],
  ['己', '寅', '甲', '子', '正月己土，田园犹冻，所妙寅宫藏丙，用在丙火无疑，有时甲则土？，有时子则土润，还喜干支多火土，以强土势，见巨水非宜，见重金亦忌。'],
  ['己', '寅', '乙', '丑', '丑土阴湿，不能助己，乙木寅木克土太过，最宜火以化木暖土，支有未戌带火之土尤妙，木再多，身？弱，水生木，亦可惧。'],
  ['己', '寅', '丙', '寅', '？寅藏丙，丙再透时，寒土自喜丙暖，但最妙？见微水以润土，或一甲一乙以疏土，一二重金，尙所不畏，多金多水，又非中和矣。'],
  ['己', '寅', '丁', '卯', '丁力远不急丙，但寅卯生丁，木火相生，足以保卫己土，多见火不忌，若有水，小康之象，诚金盛水，絶对不利。'],
  ['己', '寅', '戊', '辰', '土多无火暖之，水多奚益，水火并见，如雨旸旣济，斯为美矣，有金泄土，土乃？秀，或甲或乙，透而疏土制劫，贵显之命。'],
  ['己', '寅', '己', '巳', '寅中有甲丙戊，巳中有丙戊庚，疏土，暖土，化土，助土，诸用齐备，金木水火再各见一二，无冲克，不太多，总是？厚之命，惟土不宜再重矣。'],
  ['己', '寅', '庚', '午', '寅午会火，己土不寒，庚金慑于火势而无力，若水木见于干支，八字有生机矣，一味火土，顽而不化之人。'],
  ['己', '寅', '辛', '未', '寅未中密藏火土，己土不弱，喜辛金之泄化，再见金水，？为？秀，甲乙透干，贵气增加，火土多，则厚重，但不富耳。'],
  ['己', '寅', '壬', '申', '壬水伤丙，申金冲寅，皆为忌神，要有戊土制壬，或午火会寅，方不失淸雅富贵，否则江河泛滥，寒薄之命，总之火土愈多愈妙，金水愈少愈妙。'],
  ['己', '寅', '癸', '酉', '酉金名为长生，其实泄气，癸水之润土，喜有火暄染，相得益彰，火土尽多而不妨，金水不过太过，有火见木则佳，无火见木，弱小胜克。'],
  ['己', '寅', '甲', '戌', '戌寅中皆有火，甲木透干生火，须水润泽，徒多火土，？嫌其亢，又名身旺无财，金水并来，财源取用不竭矣。'],
  ['己', '寅', '乙', '亥', '寅亥中藏木，乙木时杀甚旺，要有火印火杀生身，辛金制杀无力，不如庚透合乙，不论庚辛，地支有申酉以载之为妙，水木切忌再多。'],
  ['己', '卯', '甲', '子', '二月阳气渐盛，万物发生，己土喜甲疏子润，再有丙火暖之尤妙，甲己虽合，卯月木旺而不化土，微金泄气，？见土之？秀，亦财用之无匮乏矣。'],
  ['己', '卯', '乙', '丑', '时上乙木七杀，得禄于卯，幸己土得库于丑，身杀？健，喜火印化杀，或金以制杀，水财润土固佳，但须不伤火印，为主要条件。'],
  ['己', '卯', '丙', '寅', '寅卯？木克己土，幸丙印化杀生身，最喜金水互见，？而不顽，润而不燥，甲乙再透，取丙为用，水若太多，以木为用。'],
  ['己', '卯', '丁', '卯', '？卯施压力于己土？重，自以丁火为救星，忌癸伤丁，或壬合丁，卽地支见水，亦非宜耳，金能克木，制杀为美，但如有水为党杀，金反为忌神矣。'],
  ['己', '卯', '戊', '辰', '土多？喜木疏，甲乙透干最佳，有水生木？可，金水并见无妨，祗金无水，或有火化杀，杀弱劫旺堪虞，土再多，贫夭必矣。'],
  ['己', '卯', '己', '巳', '时上一火一土，皆所以幇身，见甲乙疏土则贵显，金水财乡则富有，宁可财官旺，不宜身再强。'],
  ['己', '卯', '庚', '午', '己土得午生，庚化，卯疏，支配殊当，忌干再透乙，庚必输情于乙，挟诈之徒，日主健朗，有水而不碍火者，富裕之辈。'],
  ['己', '卯', '辛', '未', '卯未会木，时上辛金，要有火土幇身，方为贵命，再见水财，生气蓬勃矣，若尽是克泄，贫弱之人。'],
  ['己', '卯', '壬', '申', '金水木盘踞三角，身弱之造，全要火土之多，幇扶日元，否则贫夭必矣，若干透乙而支有会木局，可作弃命从杀论。'],
  ['己', '卯', '癸', '酉', '酉卯冲，癸生卯，地支若见亥或木，则会杀而忌冲矣，然命局之优？，还以有火无火转移，有火以癸无犯，上命，无火而徒见克泄，下命。'],
  ['己', '卯', '甲', '戌', '甲己卯戌皆合，官杀具绊，平常之命，要水火旣齐，小富小贵，伤官去官？杀，或去杀？官，去留淸净，亦非庸流。'],
  ['己', '卯', '乙', '亥', '乙亥时，亥卯会，本意盎然，杀太重矣，有火用火，有金用金，火金并见，先用火印，水生木大忌，一味木旺则从杀。'],
  ['己', '辰', '甲', '子', '甲与己合，格成化土，惟己土卑湿，喜有火暖，凡泄气之金，破格之木，皆所忌见也，若化土不成，水木为喜神。'],
  ['己', '辰', '乙', '丑', '土多喜木疏，乙木七杀，祗宜滋，不宜制，故水木多见不妨，金若不伤木，火若不猛？，亦属可喜。'],
  ['己', '辰', '丙', '寅', '丙暖土，寅疏土，兹再须要者，水之润耳，有水兼有金，富阜而聪颖，水不伤丙，富而且贵，土多淤水用木。'],
  ['己', '辰', '丁', '卯', '丁火卯木，亦所以疏暖己土，特力不如丙寅时耳，总宜水润木制，如水太多，灭火堪虞，所以水少要金，水多忌金。'],
  ['己', '辰', '戊', '辰', '土重如山，再多便患崩矣，最喜有金化之，木疏亦矣，但若少数之木，恐土重而木折，要水并见方佳。'],
  ['己', '辰', '己', '巳', '火土齐备，赖有金水木以调剂，水木相生者，贵甚于富，金水相生者，富甚于贵，火再多，土？焦，一贫如洗。'],
  ['己', '辰', '庚', '午', '己土当令，又得禄于午时，喜庚金之泄化，若干支见水，为儿又生儿，淸秀极矣，木之疏土亦矣，然须与庚无犯，'],
  ['己', '辰', '辛', '未', '土多则顽，所妙辛金泄秀，忌火土再逢，喜金水并见，木制而无力，不如用辛，水木相生，乃可取木。'],
  ['己', '辰', '壬', '申', '申辰中皆藏水，壬又高透，偏重于财，己土且？卑湿矣，要火土相联，幇身，除湿，单见火，力不敌水，名贪财坏印。'],
  ['己', '辰', '癸', '酉', '己土泄气于酉，辰为财库，癸财又透，再见金水，必致财多身弱矣，丙印戊劫最宜，巳午未乡亦喜，木能克土，亦闲亦忌之神。'],
  ['己', '辰', '甲', '戌', '戌为火库，甲己化土？眞，水火润暖己土，皆有利于化局，金不宜多，多则盗泄土气，若化土不成，金与木，又为必要之神。'],
  ['己', '辰', '乙', '亥', '乙木七杀，余气在辰，又得亥水之生，己土如不胜任，须火印以救之，金虽能克木，亦泄土气，有利有弊，可用而不可用也。'],
  ['己', '巳', '甲', '子', '己生巳月，火旺之初，原喜阴水之滋，庶与阳火相调和，时？甲子，疏之润之，然尙觉水源？足，最喜命逢申金，或辰土水库以张之，倘见庚金而无壬癸，反为不利，盖凡伤官见官故也。'],
  ['己', '巳', '乙', '丑', '乙木透于时干，独杀？淸，月支在巳，杀印相生，然因酉丑会半金局，不免木受其制，削弱疏土之功，所以必须干透壬癸，或支有亥子以化之，倘见丙丁，虽可伐金，究非上策。'],
  ['己', '巳', '丙', '寅', '巳月而见丙火，印绶得禄，况丙坐于寅，长生之位，杲杲出日，田园将有枯燥龟坵之患，最宜金水？全，得以调剂，是为上格。'],
  ['己', '巳', '丁', '卯', '己土日元，丁卯时元，偏官偏印相生，但总火盛木弱，除非水木俱透，方为上格，如多见火土，岂能得志，乃？苦终身，卽使偶尔大运相济，亦必荣华不久，一现昙花而已。'],
  ['己', '巳', '戊', '辰', '生旺之己土，再逢戊辰之时元，劫夺太重，纵岁月有水，亦是虚而？实，无非金发水源，或支见申辰，辰戌冲开水库，申辰半合水局，乃当别论矣。'],
  ['己', '巳', '己', '巳', '己生巳月，再逢己巳，未免火焦土？，卽得水木透出，亦难弥补，？以夏月己土，喜癸水不喜壬水，癸则怕为如许火土所熬干，见乙木疏土力薄，毫不影响于命格，见甲则妒合而牵绊。'],
  ['己', '巳', '庚', '午', '午时己日，名归禄格，揆诸五行生克之正义，时上庚金，虽败气于午，究得长生于巳，则伤官未尝不可为用，但必须其它之干支有水，乃臻上乘，见火大忌，见木亦难矣。'],
  ['己', '巳', '辛', '未', '火炎土燥，一点辛金无力，丙丁再透，或有午会成南方，穷乏之命，有水而？济火，亦局促之士，金水俱多，方为佳格。'],
  ['己', '巳', '壬', '申', '壬水坐于申金，水有源，土不愁燥矣，喜巳火正印幇身，可以任财，若再见官，官印相生，尤为贵征。'],
  ['己', '巳', '癸', '酉', '癸水得酉金之生，巳酉半会金局，反以有火生土为荣，尽火愈旺，愈能显雨露润泽之大用也，徒有木，虚名而已，木火相等，其贵乃眞。'],
  ['己', '巳', '甲', '戌', '火炎土燥木枯，皆须水润，壬癸亥子，总为喜见之神，然有水还要有金，方无涸竭之虞，否则富贵而不久也。'],
  ['己', '巳', '乙', '亥', '亥水生乙木，乙木生巳火，财杀印相生，土得木疏火煊水润，喜有金吐秀生财，若金重，乙木七杀受制太过，亦非所宜。'],
  ['己', '午', '甲', '子', '己土有甲木之疏，子水之润，若再干透辛癸，或庚壬尤妙，盖子午冲，此子水虚而？实也，干支多土则水？涸，多火则甲为火化而助炎，均非上命。'],
  ['己', '午', '乙', '丑', '丑为湿土，可喜，然仍以支有亥子或干透壬癸为贵，金能化土生水，总是恩神，木助火炎，火使土焦，岂宜多见。'],
  ['己', '午', '丙', '寅', '丙生于寅，旺于午，寅午半会火局，己土焦坼矣，单见金或水，尙不能救此危局金水并见，或支辅湿土方佳，有木生火，则如添油，凶不可言。'],
  ['己', '午', '丁', '卯', '丁禄在午，卯木再生火，火势太旺，若有水而无金，虚名虚利，总之，金水不可？也，木火再旺，贫无？锥，湿土多多益善。'],
  ['己', '午', '戊', '辰', '辰中有癸，再见水则财用豊，见金则秀气足，多土非宜，恐财被劫夺也，木疏最喜，官星明朗，亦富亦贵矣。'],
  ['己', '午', '己', '巳', '巳午？火，使己土不燥而燥，喜见阴水，甚于阳水，酉金不如申金，庚辛透天最美，木有助火之嫌，少见为妙。'],
  ['己', '午', '庚', '午', '月时？午，庚金被煏，己土日元，亦嫌焦坼，救金救土，总以水为重心，然若干头虚露壬癸，不如支见亥子为有力，丑辰湿土，熄火而不犯火，尤所喜见。'],
  ['己', '午', '辛', '未', '己土得禄于午，未中又藏丁己，与上条同患顽燥之弊，一重辛金自顾不暇，无能为力，故金水多多益善，且以并见为有功，火土畏如蛇蝎，愈少愈妙。'],
  ['己', '午', '壬', '申', '午月己土，得时上壬水之润，时下申金之泄，如获淸凉剂，再见木疏，富贵双全矣，身主不太旺，而金水支配有情，亦富阜安吉之命，火土若多，小康而已。'],
  ['己', '午', '癸', '酉', '午月己土，得时上癸水，亦甘露也，酉虽长生而实泄气，又资生癸财，秀慧而取用无穷，若再年月干透官印，且有权势矣，最忌逢未戌之燥土。'],
  ['己', '午', '甲', '戌', '己合时甲，当皇而正大，忌年月再透官杀，透则杂乱无章矣，戌为燥土，遥会午火，须壬癸亥子以制其炎，有水而无金发，亦名大？少之辈。'],
  ['己', '午', '乙', '亥', '乙木疏己，亥水润己，己本得禄于午建，财杀身印，盖打成一片，如有庚辛申酉之泄身生财，而与乙杀无犯者，富贵予求予取，或见丑辰之湿土，亦必财用之裕如。'],
  ['己', '未', '甲', '子', '未月之己土，总属生旺，惟若小暑之后十二天，则正土旺用事，？为有力，亟需木以疏之，水以润之，此甲子时之大用也，再见水为？佳，火非必需，不如有金生水之为妙，土必不宜。'],
  ['己', '未', '乙', '丑', '己土未月，未中乙木透露，可以丑未之冲，则乙木？易脱颖而出，最宜水以生之，乃可取杀为用，见金大忌，见土则地广而植物愈稀，皆所不取，如能本命及日坐为卯，尤属上格。'],
  ['己', '未', '丙', '寅', '未月土旺司权，不需火再生之，以犯母慈灭子之弊，金水木皆属可喜，若满盘皆逢火土，则以从旺论，反忌一点水木，便是贫苦之命，必犯痼疾或肾病。'],
  ['己', '未', '丁', '卯', '未月己土，而値卯时，卯未半局，已具旺土得木而疏之势，祗可年月见水见木，切忌金之削木，火之毁木，土之幇身，能逢乙癸透干，定是权威之土，但？不及权耳。'],
  ['己', '未', '戊', '辰', '未月土旺用事，不宜再有比劫幇身，大喜金泄水润木疏，固是定论，但若年月不见财官，而逢印绶之生，同类之助，则当从其旺气，以较前论丙寅时者，？为有力。'],
  ['己', '未', '己', '巳', '己日又己巳时，又当未月得令之时，生旺已极，且巳与未，夹拱日禄之午，断不能逆折其势，应作从旺格推，除非岁月天干，年日地支，尽是水木，庶可取财官为用。'],
  ['己', '未', '庚', '午', '未月己土，气势正盛，喜庚金伤官之毓秀，但要其余干支有水乃发，无水仍属平庸之造，最怕者，命逢阳木及火，阴木不妨，微土亦未必为嫌。'],
  ['己', '未', '辛', '未', '日干为己，月时皆未，辛金高透，食神有气，但若生于小暑后一旬之内，丁火枭神夺食为忌，如年月有水制火，则五行有救，病药相当，苟其火透，则食神絶对无用，应舍而取水矣。'],
  ['己', '未', '壬', '申', '己土日干，虽当旺于未月，亦以此时最？干枯燥？，大喜水以济之，今其壬水下坐于申，为财？长生，养命有源，必全富贵，独畏比劫夺财，最喜金神生水。'],
  ['己', '未', '癸', '酉', '己土生于九夏，时虞火煏，大喜癸水雨露之滋，如地支有卯，卯为震为雷，又为癸之长生，卯酉冲而激发，则大雨时行，杂以雷电，接陌运阡，无不沾足矣，逢金逢水总宜。'],
  ['己', '未', '甲', '戌', '未为甲木之墓库，戌为火土之墓库，甲与己合似乎太燥，不能化土，除非地支得値辰土丑土，藉其冲刑，土气乃动，动则变，变则化矣，否则仍须年月有金水耳。'],
  ['己', '未', '乙', '亥', '未中乙木七杀，透出时干，亥未会而助之，所谓木疏旺土，培成稼穑之禾，四柱仍以有水生木为妙，有火则成杀印相生，惟不可多，虽见金不妨，亦宜少耳。'],
  ['己', '申', '甲', '子', '申月己土，泄气而虚，然因金旺水相，故子水财星有根，子申半局，化金为水，以生甲木，必须柱中有火，否则财多身弱，次宜有土，以分其财，切忌再见金水，'],
  ['己', '申', '乙', '丑', '己生申月，乙木透干，是为身杀？弱，苟无火以生身，则为无根之命，然而有火，还须有水，而水则壬不如癸，庶几财杀印相生有情，而为名利双收之造矣。'],
  ['己', '申', '丙', '寅', '初秋己土，虚而？实，大喜得火相生，时逢丙寅，正印？于长生，母气殊健，苟再癸水财透，成为旣济之功，则寅申虽冲，癸能生木泄金，排解伤官见官之弊，自必回异常流矣。'],
  ['己', '申', '丁', '卯', '己日卯时，适当申月，七杀有制为偏官，见丁则成偏官偏印相生，制化俱全，干上再有水，可以泄旺金而资弱杀，尤得中和为贵之妙。'],
  ['己', '申', '戊', '辰', '泄气之己土，赖戊辰劫财之助，气势一振，申辰半局，化出财星，养命有源矣，然而还须见火，则戊己生气盎然，不可再有金水，削弱火土之力，如其见木，不痛不痒，反非好命。'],
  ['己', '申', '己', '巳', '申月己日，伤官盗气，喜得己土比肩之扶，巳中丙火印绶之生，倘四柱再能有水，所谓伤官之命，最好财印俱全，一生任何运程，皆无所忌矣。'],
  ['己', '申', '庚', '午', '己日庚时，月令値申，申为庚禄，午为己禄，厥名交禄，然考此际金神司权，庚金甚旺，己不如庚，还喜年月有土相助，见火则伤金，不殊削足适履。'],
  ['己', '申', '辛', '未', '己土得未土为助，以生进气之辛，辛又乘旺于申，是卽食神有气胜财官也，四柱倘再有水土调和，乃必发之造，或云秋令己土，必须丙火，然若此造，果其见丙，辛金之气不完，犹蛇足耳。'],
  ['己', '申', '壬', '申', '申金月令，再见申时伤官盗气为病，乃以干支有火制金为佳，惟壬水恃？申母气之生，有江河直下之慨，恐退气之火，不能与敌，所以有火还须有土制壬耳。'],
  ['己', '申', '癸', '酉', '此与上造壬申时，似相伯仲，惟癸水属阴，酉金亦属阴，阴性柔和，水虽盛而不溃决，金虽旺而无创伤，但己土终衰弱，必得火土生扶，方克中和，如其有金水，无火土，则当以弃命从儿从财论矣。'],
  ['己', '申', '甲', '戌', '甲己虽合，莫作化气，？以月令在申，己土泄弱而甚，土虚则空而崩，何能使甲木从之而化，亦不能以甲木正官为用，至于戌土，虽有益于己，但为力不多，如得火以相生，水以去燥，则无间言矣。'],
  ['己', '申', '乙', '亥', '孱弱之阴土，岂宜阴木之戕贼，卽云金旺之令，乙木有制，然因亥水之故，金去生水，而不伐木，所谓贪生忘克是也，是必有赖于火，庶几生其土，和其水，范基金，一举而三美备矣。'],
  ['己', '酉', '甲', '子', '己生酉月，名则长生，实则盗气，故见甲子财官，不任互克交攻，殊？足以为喜，是必天干见丙丁相生，而又日坐旺地者，方可用取财官耳，尤忌阳金，十有九败，无火？凶。'],
  ['己', '酉', '乙', '丑', '己土日元，为酉金所泄，丑又会酉，弱极不堪，以此际之乙木，亦？絶地，坐衰乡，不啻残花剩柳，故七杀为无用，不能泥于有杀祗论杀之说也，是须水火？多，庶土木皆有生气。'],
  ['己', '酉', '丙', '寅', '仲秋己土，本质虚而且燥，所以宜火生之，水润之，固为不祧之论，时落丙寅，若其余干支无水为之协调，亦非上选，以知有火无水，仍是太璞不完，金瓯有缺耳。'],
  ['己', '酉', '丁', '卯', '卯时酉月，相冲无情，惟此时之己土，终喜有丁之相生，丁坐于卯，是为薪火之传，俾己土生机不息，但卯木七杀，终不可用，因？絶地，久必断炊也，如其年月有土，仍取食神，金火弗忌，癸水非宜。'],
  ['己', '酉', '戊', '辰', '酉月而値辰时，辰与酉合，？觉己土之气泄，然而戊为阳土，幇身之力，不殊扛鼎，所以身弱用劫，纵或以食神之金为用，戊亦喜神，盖食神大喜劫财乡也，四柱独忌阴火之多，阳火不妨。'],
  ['己', '酉', '己', '巳', '巳火印绶，生起己土，且是己土之旺气，弱土得己巳生扶，则卽水木财官透于岁月，亦可为用，然不及？月有金之为一淸到底有精神耳，倘能坐丑成局，水火透干，尤胜十倍。'],
  ['己', '酉', '庚', '午', '己土秋生，时？庚午，土金毓秀，伤官佩印，但敎四柱不逢阳木或再有火，定为七艺术家，喜有土金，如其逢水，须消息日主之强弱，强则喜，弱则忌，盖恐财以伤印，无生气耳。'],
  ['己', '酉', '辛', '未', '己土日主，生于酉月辛未时，己土冠带在未，辛金干禄在酉，但敎不见木火，所谓万钟禄食，食神得禄不逢官是也，如见木而有根，则官杀或可用，独怕见火，则一无可取之废材矣。'],
  ['己', '酉', '壬', '申', '己日而遇壬申时，原属财？长生，奈何生当金旺水相土虚之酉月，身不能任，必得火以生之，然若满盘金水，则成从财之格，不可再见一点火土，便财势涣散。'],
  ['己', '酉', '癸', '酉', '酉时酉月，癸水财透，金水相涵，但敎己土有力，所以年月有火，则己土有根，财可为用，惟火不可多，以稀为贵，见土虽比劫夺财，因有当旺之金以缓冲，絶？足虑也。'],
  ['己', '酉', '甲', '戌', '肃杀之气正盛，时上甲木正官决不可用，况乎酉月之己土，亦不生旺，何用木疏乎，仍须火生土助，俾己不空虚，再取当令之食神，能有一点水？佳。'],
  ['己', '酉', '乙', '亥', '酉月之己土，虽曰长生，实非生旺，大喜印绶之生身，故若？月有火，则己土有根，而乙木亦有向营之机，乙虽絶于酉，究坐亥水生气之方，絶处逢生，可以用杀。'],
  ['己', '戌', '甲', '子', '戌月之己土，不论土旺用事与否，终为进气之象，？以戌为火土之库耳，卽使四柱无火，亦自具天地生化之机，所以时逢甲子，财官可用，伤食亦宜，惟庚金终非所喜。'],
  ['己', '戌', '乙', '丑', '乙木墓于戌，己土墓于丑，似皆柔弱，月令在戌，秋木不华，则土气厚，木气薄，必须水火并具于柱中，始可以杀为用，有火无水，不能用杀，逢金？甚。'],
  ['己', '戌', '丙', '寅', '己土旣生戌月，时元又値丙寅，不但丙火坐寅，为印绶？于长生，此寅戌会局，以助丙火，未免火？土燥，全凭有水透干，庶可调济于平，逢水有金？佳，木火土非所宜也。'],
  ['己', '戌', '丁', '卯', '己土生当戌月，戌中藏丁，透而生己，卯虽属木，卯戌？合，此乃生旺太过，以火为病，以水为药，见木则厝火积薪，见土则身旺无依，必得金水相济，乃可有为。'],
  ['己', '戌', '戊', '辰', '己日辰时，而生戌月，辰与戌冲，土气活动，益以戊土相扶，生旺已极，必须得木之疏，而又以水辅之，然而太旺之土，逆折不如疏泄，最合金水？见，始成富贵？达之士。'],
  ['己', '戌', '己', '巳', '日时？己，气势不孤，又有巳火印绶之生，戌土劫财之助，敦厚极矣，土旺则金相，巳中藏庚，戌内脏辛，但敎干透庚辛，再能见水以润泽之，资产富有，？何疑哉。'],
  ['己', '戌', '庚', '午', '虽云旺土而庚金有气，然因午戌会半火局，以镕铄基金，所以火为之病，非水多？足以制火而救庚，或则运走北方亦宜。'],
  ['己', '戌', '辛', '未', '时当戌月，戌中辛金食神，透出时干，而己土则有未戌同类之助，合于食神大喜劫财乡之说，但未戌？支皆有丁火暗藏，必须有水，以制其丁，方无顾虑。'],
  ['己', '戌', '壬', '申', '生旺之己土，力足以任财，兹则壬水财星，坐于申金长生之上，不媿源远？长，可卜富厚终身，且必生贵子，不宜有木，以吸收壬水之？，祗喜金以生水，富有千钟，？见火土者尙无大碍。'],
  ['己', '戌', '癸', '酉', '戌月癸酉时，己土当令，食神有气，而财亦有根，最好柱中再见金水，天生富命，如见土，则以金透为佳，如逢木火不为忌，而亦不为喜。'],
  ['己', '戌', '甲', '戌', '戌月而又戌时，戌乃火土之库，甲木透而合己，可作化土论，但必须不见金水木乃眞，否则宁以金水为用，惟金水不可太少耳，若年月木多，则当仍用官杀。'],
  ['己', '戌', '乙', '亥', '己土正在当令，原须水以滋之，木以疏之，按乙为阴木，亥为地脉泉原，杀得财生，力足疏土，不可再见印绶比劫与财杀相抗，能见金以生水，自不为忌。'],
  ['己', '亥', '甲', '子', '？记月令云，阳气闭？而成冬，则冬至一阳升之前，完全孤阴不生，所以亥月之己土，非有丙火，必为贫苦之命，卽使见到巳火，巳为丙禄，因有亥冲，仍为无用，甲透时上，无丙丁之印，官不为官，子会亥，非火土多，？足以驱寒扶身。'],
  ['己', '亥', '乙', '丑', '亥月己土，水正行权，丑亥拱子，？但无助于己，且助水增寒，乙木虽泄水疏土，亦属爱莫能助，所以必须丙火，始为佳造，见丁灭等，大怕逢金。'],
  ['己', '亥', '丙', '寅', '己土冬生，土衰水旺，若无丙火，则霜雪载途，田园冻结，妙在丙火正印，下座长生之寅，而寅与亥合，俾能一派阳和，春回寒谷，官印相生，气象最纯。'],
  ['己', '亥', '丁', '卯', '冬令寒土，非火则生气索然，丁虽阴火，不及丙火太阳之普遍温暖，然因丁有卯生，亥卯半局生起丁火，犹花棚之生暖气炉，己土亦有生意矣，四柱忌见金水，而火土不厌其重。'],
  ['己', '亥', '戊', '辰', '己土得戊辰之助，在水旺之亥月，似乎身财并茂，然而辰虽阳土，却是辛壬金水之库，终须火以散其寒，土以厚其势，身弱用劫，故以见木为大忌，亦不喜金水。'],
  ['己', '亥', '己', '巳', '己土弱元，得己巳时，所谓辅之翼之，匡之直之，有何不喜，但巳火为亥所冲，财以坏印，名利皆空，惟有年月透丙，印绶得禄，或透戊土制亥，方为佳格。'],
  ['己', '亥', '庚', '午', '亥月之己土，水盛而土弱，时逢庚午，庚生水，午生己，虽似势均力敌，终觉土不及水之生旺耳，所以干支有火为妙，有土幇身亦可，木则可有可无，而金水断不可再见。'],
  ['己', '亥', '辛', '未', '亥月见辛，金寒水冷，虽时遇未，扶助己土，祗因亥未半会木局，终然克制虚弱之土而已，须年月透火，庶木气生火，土不受克，且因火印有根，身生为美矣。'],
  ['己', '亥', '壬', '申', '己本湿土，月令在亥，亥中壬水之干禄，时落壬申，申乃壬水之长生，水冷金寒，己土毫无生气，如再年月见水，应作从财而论，否则必得丙戊当头，乃为好命。'],
  ['己', '亥', '癸', '酉', '己生亥月，湿土将冻，再见癸酉时元，增其寒水之气，身弱已极，必须火以相生，俾可冰融冻解，土来幇扶，在？亦喜，然万物蓄藏，有火则生，无火则死，仍视火之有无为高下耳。'],
  ['己', '亥', '甲', '戌', '己土日干，亥水月令，亥中藏甲透时，财官有力，时落于戌，中藏火土，足以生扶，但须干头得见印绶者为贵，庶甲木生火，以通其气，己土束缚稍松，火再生己，有息息相生之妙。'],
  ['己', '亥', '乙', '亥', '亥为木之长生，中藏壬甲，时再透乙，一派水木，互相攻克，己土最弱，旣无克水之力，致水去生木，又受乙木威胁矣，见金祗能助水，未能伐木，惟遇火土，遂尔化戾气为祥和矣。'],
  ['己', '子', '甲', '子', '己土气絶于子，子月而又子时，重重寒水，己土沈浸其中，而成泥淖，甲虽大木，亦必腐蚀根株，不能生存，所以有丙则发，无火则败，？以太阳之力，可使水暖土干而木得向荣，大忌金水再多。'],
  ['己', '子', '乙', '丑', '己坐子月，时逢乙丑，子与丑合，可喜财星被合，但孤阴不生，还须仰赖阳火，而乙木七杀，亦克寒梅着花，以成杀印相生，杀不宜制而宜化，故见金反为？。'],
  ['己', '子', '丙', '寅', '子月之己土，正？絶地，得丙寅时，印？长生，以生弱土，而散严寒，乃飞腾之命格，因有丙火，故不忌木，而独忌水，盖犹雨雪载途，阴寒弥盛，白日无光矣，金亦不喜。'],
  ['己', '子', '丁', '卯', '己土生于子月，生意毫无，幸得丁火相生，寒水之威稍解，而卯木泄其旺水，生其丁火，亦非平常之造，但敎年月再有木火，不可有金水之忌神，苟有金水，则薪传？熄，湿木生烟，火力反减。'],
  ['己', '子', '戊', '辰', '仲冬之己土，休囚无比，故宜比劫以扶持，然此际地坼天寒，卽戊土亦何尝有气，况辰乃水库，子辰半局，祗足增进寒水，必得年月有火，庶戊己之土，转出生机耳。'],
  ['己', '子', '己', '巳', '己土日元，时逢己巳，比肩扶之，印绶生之，己可返弱为强，四柱再有火土，则身旺财豊，必是富贵之造，卽使略见一点金水，亦无大患，惟怕金水过多，己不能敌耳。'],
  ['己', '子', '庚', '午', '己生子月，而値午时，一点午火生气，为子水所冲破，再有庚金，以资当令之水，湿土愈寒而冻，必得年月透出丙丁，销毁庚金，始为上格，倘无火生，而遇金水，非贫则夭。'],
  ['己', '子', '辛', '未', '仲冬己土，？喜生扶，今则时逢辛未，辛金生当令之水，未土助休囚之己，似乎铢辆悉称，？知己未二土，原无？量，何堪辛金之泄，而水因辛金？旺，惟赖有火，庶免轩轾，若四柱别无火土，乃贫薄之命。'],
  ['己', '子', '壬', '申', '己土生于子月，财多身弱，又时値壬申，壬水长生于申，乘旺于子，申子会而助壬，大有水势滔天，入北冰洋而不见寸土，卽使年月火土，亦难为力，反不若满盘金水，而成弃命从财耳。'],
  ['己', '子', '癸', '酉', '癸为阴水，以喩雨露，在此冬令，则为氷雪，月令之子，乃癸水之禄，一点己土，乌能胜任，最喜戊土夺财，且戊与癸合，化无情而为有情，丙火虽喜，尙逊戊土一筹。'],
  ['己', '子', '甲', '戌', '己土而遇戌时，戌为火库，地下之气转温，子水之势稍杀，然若余柱无火，则甲木有制土之嫌，有火则甲木生火，而火又生土，成官印相生之格矣，大忌见金，阳气尤畏。'],
  ['己', '子', '乙', '亥', '子月水旺木相，己日乙亥时，水木太过，日主弱甚，必得火土之力，以生以长，方能用取财杀，倘若见金，则水力？增，而乙木未必就范，故宁可无金而有火土也。'],
  ['己', '丑', '甲', '子', '丑月己土，纵在土旺用事，亦不多生气，而以金水为忌，按子时虽与丑合，但总水之成分多，土之作用少，甲虽与己合，亦随？随冻，全凭丙火太阳当空，将萧索之环境，改为融化，则土与水木，均有生机矣。'],
  ['己', '丑', '乙', '丑', '丑月丑时，己土一再投墓，其气滞而不？，一片冰天雪？(？)，时上乙木，似乎一草一木，点缀其间，究竟看不到任何生意，惟有干支之中，再见木火，则如岁寒之友，一时绚烂，亦未尝不可用杀，金水总属大忌。'],
  ['己', '丑', '丙', '寅', '丑月己土，日元投墓，所谓少年不发库中人是也，时値丙寅，冬土得火而融，旺土亦以寅木而有生意，不宜再见金水，以勉木火受制，不能发挥效用，尤怕壬水申金，故若壬申俱备，福禄如一现昙花。'],
  ['己', '丑', '丁', '卯', '季冬之土，卽当分亦不能显其本能，兹有丁火生之，卯木生起丁火，偏官与偏印相生，固有为之造，年月还须木火并助，不可柱有金水，以为之梗，？以丁火卯木，原非生旺耳。'],
  ['己', '丑', '戊', '辰', '己土生于丑月，如在小寒后十二天之外，则正土旺用事，不必戊辰劫财之助，惟在大寒未交三天以前，尙非土旺，则戊土可以为用，然辰为水库，必有丙丁透干，则戊己有力，大忌见木，金亦弗宜。'],
  ['己', '丑', '己', '巳', '三冬己土，？要生扶，己巳时元，似可相生为助，然因巳丑会半金局，以泄入墓之己土，故丙丁之生，最为迫切而需要，金水木削弱己土？量，少见不妨，多见非宜。'],
  ['己', '丑', '庚', '午', '以丑月入墓之己土，得午火枭印日禄之相生，固具相济相成之妙，但午火亦墓于丑，不啻镜花水月，必须岁月之上，有火有木，方切实际，否则卽行火运，亦愈掬水月在乎，一时欢喜而已。'],
  ['己', '丑', '辛', '未', '丑月而遇未时，丑未对冲，墓库大抵宜冲，因之己土日元，便非少年不发库中之人？，且因地气冲动，比肩为助，不愁辛金食神泄气，惟若四柱再有阴水及火，则身财尤为美备矣。'],
  ['己', '丑', '壬', '申', '季冬休囚之己土，金水？所弗喜，况以壬之阳水，下坐申位长生乎，卽不将土冲刷无余，亦必将己土冻结，祗可弃命相从，则以余柱不见火土为的，如透火土，反感财重身轻。'],
  ['己', '丑', '癸', '酉', '己土日主，时逢癸酉，酉丑半会金局，以生癸水，成食神之生财，而己土力薄矣，经谓食神身旺则喜财，身弱则喜印，矧在寒冬，火不可少，故以丙透为贵，透丁须有木以生之，亦不失荣华之命。'],
  ['己', '丑', '甲', '戌', '甲与己合，所谓合官星不为贵，时为戌土火库，以温暖其己土，生意自足，得火而有甲木之生，定必权高位重，倘见庚金，潦倒局促矣，苟逢寅午以会局，或得未土而三刑，皆能焕发。'],
  ['己', '丑', '乙', '亥', '休囚之己土，时逢乙亥财杀，？可从杀弃命，切忌火土透出，以致弃而？尽，若见金，七杀之力减削，除非年月皆火，则杀印相生，亦淸纯可贵之命。'],
  ['庚', '寅', '丙', '子', '庚金生于寅月，乃絶气之乡，再落子时，又为水地，则无丙火之杀，亦已失令无气，故喜干支有土相生，或见金为助，如见阴火，则官杀混杂，见水则木愈盛，庚金愈弱矣，甲戊？透，威福絶伦。'],
  ['庚', '寅', '丁', '丑', '初春之金，原喜土生，余寒尙在，则喜火温，所以寅月庚金，时逢丁丑，的是贵命，丑虽属土，却是丁火，庚金之墓库，故最好见未冲之，或透己土相生，忌水灭火，见木无妨。'],
  ['庚', '寅', '戊', '寅', '寅月又値寅时，庚金之气太弱，然而寅中藏戊，透而生庚，亦未见其财多身弱，最怕甲木透干，以伤戊土之母体，水亦不喜，因资旺木，且泄衰金也，金纵夺财，财旺而多，？足患也。'],
  ['庚', '寅', '己', '卯', '初春之庚金，大喜阴土相资，以成絶处逢生，然己坐卯上，干为支克，己土脚地不坚，是须年月有火，以生己土，但总财旺，？能参杂一点比劫之金，则胜见水百倍。'],
  ['庚', '寅', '庚', '辰', '庚金日干，时値庚辰，得比肩以扶身，枭印以生气，虽当寅月絶地，已能反弱为强，所以年月之上，得以甲丙？透为最纯粹，万里扶摇，非凡命焉。'],
  ['庚', '寅', '辛', '巳', '寅月庚金，原？絶地，好在时为辛巳，？但辛金相助有情，且巳为长生之地，此系絶处逢生，但愿柱中再有木火，定可飞黄腾达，见水不畏，逢金不喜。'],
  ['庚', '寅', '壬', '午', '庚金寅月，木旺火相，时逢午火，寅午会局，衰弱之庚金，未免望而生畏，但因午上有壬，足以驾驭，不致燎原，况初春犹寒，故宜有火温暖，惟庚金之弱，非有土金生扶不可耳。'],
  ['庚', '寅', '癸', '未', '春月庚金，弱而宜生，今得未土相生，原为所喜，至于癸水伤官，泄弱金生旺木，似乎疣赘，但癸坐于未为自墓，纵盗气而不重，苟再年月，火以暖之，及土金生扶之，则大佳矣。'],
  ['庚', '寅', '甲', '申', '庚生寅提，甲申时元，庚禄居申，甲禄到寅，金木并能通根，可谓身财？茂，但此际木盛金衰，终喜土来相生，不喜比劫夺财，见火则庚金？弱，见水亦非所宜。'],
  ['庚', '寅', '乙', '酉', '庚日而遇乙酉时，乙与庚合，酉为庚旺，虽不能化金，究财来取我，月令在寅，金衰木盛，有土生金，则力能任财，不宜见水，以免衰金被泄，旺木被生，仍成财多身弱，富屋贫人之象。'],
  ['庚', '寅', '丙', '戌', '庚金日主，戌土时元，虽云土以生金，无如戌为火库，寅戌会成半局，时干又透丙火，生当寅月絶气之庚金，大可弃命而从杀，如柱有水土，便不作弃命论，而杀重身轻，以印比为宜矣。'],
  ['庚', '寅', '丁', '亥', '庚生寅月，木旺火相，时见丁亥，寅与亥合，又生丁火，是则财官太旺，天元嬴弱之征，必须岁月之上，土生金助，或则日坐辰戌申之地乃济。'],
  ['庚', '卯', '丙', '子', '庚金生于卯月，木盛金衰，再有丙火之制，子水之泄，子水再生卯木，财愈旺而金愈钝矣，是必有土相生，乃成上选，柱中不可再有木火或水，若逢比劫，自收扶助之功。'],
  ['庚', '卯', '丁', '丑', '庚生卯月，时上透丁，木以生火，财官有力，妙在时？于丑，正印生身，此乃财官印相生之佳格，岁月逢土，金弱不忌，但若土多，反恐金埋，必须木以疏之矣。'],
  ['庚', '卯', '戊', '寅', '庚金胎于卯，絶于寅，大喜戊土之生身，其余干支，如再有土，恐庚金埋灭，则须有木以救之，苟无土金，则木火断不可用，以犯财官旺处则身倾之弊，水亦不喜。'],
  ['庚', '卯', '己', '卯', '卯月卯时，财星迭见，庚金日主，虽有己土正印之生，而犯财多破印之病，必须有火生土，庶己土有根，然火不宜多，木？可虑，最好得比劫之金，方能中和。'],
  ['庚', '卯', '庚', '辰', '仲春之庚金，原非生旺，然逢庚辰时元，辅之育之，反弱为强，年月再见木火，但敎不过分，亦是富格，如木火重重，则此时之庚辰，原不强盛，仍作身弱论也。'],
  ['庚', '卯', '辛', '巳', '庚金値辛巳时，巳为庚金之长生，辛乃同流，似乎身强，？知卯月之辛金，正当絶地，何能相扶，巳火之长生，究为克气，焉得有情，所以仍须见土方妙。'],
  ['庚', '卯', '壬', '午', '卯月庚金，木气正旺，时逢壬午，壬水生当旺之木，午火有旺木之生，庚金无力，必须印绶之土生之，比劫之金助之，不可再见水与木火。'],
  ['庚', '卯', '癸', '未', '未为庚金冠带之乡，月令在卯，虽居弱地，未土时元，足以生之矣，癸水虽恐生木助财，幸而自墓，水不为忌，但敎余柱之中，杂以土金，终为富造，倘庚坐辰申戌三支，虽木火亦不妨矣。'],
  ['庚', '卯', '甲', '申', '庚日申时，时归日禄，日元通根，则生卯提，亦不为弱，但甲木财透，正値旺乡，较量轻重，犹是不及木，宁可生扶，不喜财官，水神泄身生财尤忌。'],
  ['庚', '卯', '乙', '酉', '卯月酉时，日元为庚，卯酉？冲，羊刃出鞘，庚虽归旺于酉时，柰乙木亦透，财来相就，乙禄于卯，财？通根，三春之初，刬尽还生，最好水土并见，则水润而刈之根，土殖不强之金，'],
  ['庚', '卯', '丙', '戌', '庚生木旺火相之时，丙火七杀独透，卯木生其丙火，戌土资其庚金，惟卯与戌合，丙火势炽，庚力较衰，苟年月无土，祗可弃命从杀。'],
  ['庚', '卯', '丁', '亥', '庚日卯月，时逢丁亥，亥卯会木局，以生时上之丁，固为火炼庚金，必成？器，但若五行无土，则有火而无炉，治而难成，土为必要之神，若柱有比劫，不过略分财力，无大效也，木火大忌，水亦无益。'],
  ['庚', '辰', '丙', '子', '庚金生于辰月，已具进气之象，然尙不宜火克，所以时上丙火七杀，有弱金受制之嫌，时逢子水伤官，与辰土会成半局，似可遥制丙火，苏息庚金，虽然丙火稍敛炎威，而庚金终被泄弱？量，故须木土并透，俾庚丙互有所秉。'],
  ['庚', '辰', '丁', '丑', '庚金辰月，丑时，金得？土之生，祗因辰丑皆为寒湿之土，生气？足，故喜丁火，暖其土，治其金，乃成豊城？器，还须有财以生官，透印以生身，财印？全，富贵可操左券。'],
  ['庚', '辰', '戊', '寅', '庚金生于暮春，辰中戊土透露，生气自足，况戊坐寅上，印？长生，如在淸明十二天后，？其土旺金相，有得天独厚之象，遂尔不妨见财，但财不可多，如见火则生旺土，亦所弗畏，金与水可敝屣视之。'],
  ['庚', '辰', '己', '卯', '季春之庚金，犹喜土来？育，时上透出己土正印，正当旺令，犹慈母育子，洵足恃已然宜年月有火，则母体？健，？以己坐于卯，正印自？受克之地，非得火之泄木生土不可，再有水木便成下格。'],
  ['庚', '辰', '庚', '辰', '生于辰月之庚金，又値庚辰时，？庚？辰，？聚有情，相生有气，须得木火财官为妙，如无木火，干头透水，可作金水伤官论，以辰为水库故也，倘木火水全无，年月中见土金，则是身旺无依，孤寒之造。'],
  ['庚', '辰', '辛', '巳', '庚金旣得月令辰土相生于前，？得时上辛金幇身于后，巳火虽为克气，却系庚之长生，终属身旺，可以时上七杀为用，如能丙火透干，则丙禄于巳，杀通于根，丙与辛合，合杀为贵之命也。'],
  ['庚', '辰', '壬', '午', '庚金日干，时逢壬午，月令建辰，金水火土春色平分，毫无轻重，土旺之金，宜火炼之，壬？午上，火力不强，是宜再见财星，以生午火之官，而泄壬水之气，见土亦可，但必一生劳碌矣。'],
  ['庚', '辰', '癸', '未', '庚金而生辰月未时，如在土旺用事，未免土厚金埋，辰中癸水虽透，如年月无财，则癸水不起作用，必要干头见木，则木赖癸生而方足，始可疏其旺土，而庚金以显，大忌再见土，火与金亦不喜。'],
  ['庚', '辰', '甲', '申', '庚日申时，通根有助，兼逢辰月，枭印生身，日元强而喜甲木偏财或谓此际土旺，甲又自絶地于申，？知五阳絶处，卽是生气，借曰不然，终在春令，卽使土旺，而木气未衰，况？申辰会而生甲乎，独忌见金。'],
  ['庚', '辰', '乙', '酉', '辰中一木，透于时干，下坐于酉，乃眞？絶地，好在三春，苗虽刈而根不拔，正财可用，乙与庚合财来相就，因非秋月，不能化金，柱中不可再见土金，见火财灭，见水财曾。'],
  ['庚', '辰', '丙', '戌', '庚金而遇丙戌时，七杀透而自墓，喜得月令在辰，与戌相冲，其库以开，而庚赖辰戌之资，不算身轻杀重，如有伤官食神以制之，定必独权独断，一世光荣，见木宜少，土金不忌。'],
  ['庚', '辰', '丁', '亥', '庚乃顽钝之金，又在辰月旺土之时，必得丁火之煅炼，方可铸成太阿之？器，亥中生甲木以生丁，不致官星受伤，最宜干透木土，木则泄水生火，土则生金斲木，成大富贵，亦寿考之命矣。'],
  ['庚', '巳', '丙', '子', '庚生巳月，虽系长生，究是火旺之初，金不为坚强，时上透丙，丙火得禄于巳，纵云丙不镕庚，终嫌克制，最宜有土相生，有水制杀，必掌政权，大忌木来泄水资火，则为贫夭之命矣。'],
  ['庚', '巳', '丁', '丑', '丁乃后天之火，力足镕金，况又庚生巳月，丁火乘旺，超于庚金得长生之资，幸赖丑时，丁纳于？炷之中，巳丑半局助金，如见水则曲突无烟，如得土木？透，则丁火官星，与金庚日主，无不生气勃如矣。'],
  ['庚', '巳', '戊', '寅', '庚金日主，巳火月令，巳为戊之禄，庚之长生，且戊土亦坐生于寅，庚金颇有生机，然寅木财星，亦是火之长生，以至燥土不生，必须得水润之，方有活气，柱中无水，便为下格。'],
  ['庚', '巳', '己', '卯', '巳月庚金，火旺土相，己土透干以生金，卯木在时以生火，中和为贵，金木火土各行其是，喜再有壬癸以济之淬之，所谓群金生于夏，妙用玄武是也，倘见甲乙，则印绶受制，生气索然矣。'],
  ['庚', '巳', '庚', '辰', '庚日庚时，枝？同气，生当巳月长生，辰土印星得禄系身强之格，所以见木，定为富人，见火当为贵客，木火皆全，辅以一位之水，则必？业建功，荣华絶顶。'],
  ['庚', '巳', '辛', '巳', '庚日而生巳月巳时，火力多，生气少，剥而不纯，虽有辛相扶，然区区之阴金，为助綦微，终不能作生旺看也，故必水土并透，庶太剥之火，有制有晦，不旺之金，有生有救矣。'],
  ['庚', '巳', '壬', '午', '庚日午时，月建在巳，官杀混杂，幸赖壬水为食，将七杀为制伏，惟尙嫌水源？足，盖壬水絶于巳，气秉不强，弱庚又不能使壬水发育健全，故以见比劫为上。'],
  ['庚', '巳', '癸', '未', '庚金长生于巳，冠带于未，不为无气，卽云火旺土燥，幸有癸水以和之，不可再多火土，惟若见土而又有木，癸水可以保全，则亦无害，盖此条之关键，全寄托于癸之一水耳，最宜者，或比或劫也。'],
  ['庚', '巳', '甲', '申', '庚金得禄于申，时通日气，甲虽自絶于申，在夏初，正値畅茂而条达，自能有助于月支之杀，可以巳与申合，合杀胜于制杀，故可用取财杀，且身杀？强，财权并盛必矣，祗可见水生木，不宜以金伐木，此着不可忽。'],
  ['庚', '巳', '乙', '酉', '乙与庚合，时酉为庚之旺乡，巳虽属火，会酉成局，倘再支逢丑土，而柱中不杂一些木火，则是化金之格，而作名公巨子，若再见木火，总是身强喜财官，亦非薄命。'],
  ['庚', '巳', '丙', '戌', '巳月庚金，克中有生，时逢于戌，戌为火之库，而实土之本质，亦克中相生，不料丙火高透，虽阳火不能镕金，但终嫌炽？矣，须得玄武之水以相解，大怕木透，不啻助桀为虐。'],
  ['庚', '巳', '丁', '亥', '庚日而値亥时，逢巳火，巳亥交冲，火愈冲愈旺，水愈冲愈衰，丁火适値旺乡，亥中藏甲，又在暗中泄水资火，大有星星之火，足以燎原，庚被镕解矣，欲其凝而不流，端非水土之力不为功。'],
  ['庚', '午', '丙', '子', '庚金生于午月，火势正盛，又得丙火七杀透干，庚愈力弱，虽时逢子水，与午交冲，但犹水不抵火，必须食伤高透，辅以比劫，则庶几耳，或见己土生庚，杀印相生，？有权可振。'],
  ['庚', '午', '丁', '丑', '午中藏丁，丁透时元，正官得禄，火煅庚金，若非丑之湿土生金，则庚金难成？器，然须年月食伤印绶之并见，方为优秀之命，大怕木生旺火。'],
  ['庚', '午', '戊', '寅', '庚生午提，时？寅木，寅午会局，火土旺相，似戊土可生庚金，然焦？之阳土，实？足以生金，反有埋金之虑，最好柱中有木疏土，有水济火，有金比助。'],
  ['庚', '午', '己', '卯', '午中藏有己土，生庚金日元，时为己卯，成财官印三宝，然而较量轻重，终嫌火旺，而财被火泄，必须有水透干，则财旣有根，火亦稍杀，而为尊荣安富之命矣。'],
  ['庚', '午', '庚', '辰', '庚乃顽金，必须火炼，生午月固足销镕之而成器，然因时値庚辰，土金生扶，使庚金无身弱之嫌，转觉火候不克纯靑，故以年月逢木为佳，有木不畏水，但不喜再多印劫耳。'],
  ['庚', '午', '辛', '巳', '庚日巳时，生中有克，辛金属阴，助力不强，庚金未为生旺，喜有印以资之，与伤食制火者为妙，不合见财，恐长官杀之焰也。'],
  ['庚', '午', '壬', '午', '庚生午月，又値午时，？火一金，势不相称，妙有壬水食神，与火相调，大忌戊土夺其秀气，而己土则反为所喜，因己为阴土，得禄于午，晦火生金故也，木不宜，金则喜。'],
  ['庚', '午', '癸', '未', '庚日未时，未与月令之午相合，官印相生有情，然而未土位在南方，中藏乙木丁火财官，因而火旺为忌，则癸水在所必需，是宜再有金，以扶投墓之癸，而以木之泄水生火为大戒也。'],
  ['庚', '午', '甲', '申', '午月火旺之候，再有甲木生之，本属财官旺而日柱弱也，喜其时落于申，时归日禄，庚金遂尔弱而弗弱，甲絶于申，死于午，朽木难雕，非有癸水，未免财星无根，畏比肩之夺财，宜食伤以解之。'],
  ['庚', '午', '乙', '酉', '乙与庚合，财来取我，虽不化而终有情，乙木长生在午，而午火亦赖乙木之资，时？酉位，羊刃劫财，最喜壬水生木，又与午合，乃巨富之格。'],
  ['庚', '午', '丙', '戌', '庚金日干，见丙火，固不致金被销镕，但因戌时燥土，不生庚金，且系火库，会午成局，夏日生炉，究属可畏，见阴水尙不能济，非阳水不为功，此格最怕有财，然若满盘木火而无水土，则当以从杀论矣。'],
  ['庚', '午', '丁', '亥', '丁火得禄于午，时方九夏，固足镕金，好在亥水时元，以成旣济，俾庚金不致受克太甚，最好年月阴土生庚，与比劫生亥，定必学优则仕，而致高官厚禄也。'],
  ['庚', '未', '丙', '子', '庚金诞于未月，九夏镕金，再遇丙火，杀重身轻，全凭子水之济其火，未土之生其金，遂能全其中和柱中见金幇身，见土生身，见水制火，皆为所喜，独不宜再有木火，如己土王用事，则财官非所忌惮矣。'],
  ['庚', '未', '丁', '丑', '庚生未月，未为财库，时？丑位，丑乃庚库，丑未？冲，财库大开，况未月土旺之成分为多，原喜冲动，俾地气活而生金，因而时上丁火，一官独秀，确是命中瓌宝，？有一点水以润之，木以生火，名利双辉之人。'],
  ['庚', '未', '戊', '寅', '未月庚金，母气正旺，盖以戊土自坐长生，透出干头，尤有土厚埋金之弊，而燥土不生，印绶有名无实，所以必须水以濡之，木以疏之，时上之寅，虽本质为木，但系火土之长生，故尙宜别见水木耳，倘再见官印，埋没终身矣。'],
  ['庚', '未', '己', '卯', '庚金生于季夏，未中己土，透而生身，五行土较厚实，喜有卯木正财，乃卯未半局，以疏旺土，不忝富命，切忌官印之透，惟喜食伤之生财。'],
  ['庚', '未', '庚', '辰', '日元庚金，旣有当令之未土为生，已非衰弱，再逢庚辰，以助旺相之土金，遂犯太过之嫌，乃水与木火，最所企求，然虽得火？金，未能禁火不去生土，故弗及水之泄金，木之制土，为？有益耳。'],
  ['庚', '未', '辛', '巳', '庚金日主，时？辛巳，辛为同类，巳系长生，月令在未，乃値正印，一派生扶，病在太过，然见官杀之克，则恶其燥热，宜乎得水相涵，而木透干头，庶几五行序配，八檼四平耳。'],
  ['庚', '未', '壬', '午', '未月旺土司权，庚金得康健之遗体，原宜一面煅以火，一面淬以水，庶干将莫耶，新发于铏，壬午时元，原少可訾，但犹须金木之互见，成大名？伟业矣。'],
  ['庚', '未', '癸', '未', '月时皆？于未土正印，虽为阴土，惜其燥性，喜癸水伤官之透，雨露湿润，燥性去而生气显，如能柱逢乙卯，虽不能成杂气财官格，亦是财得根深印得华之造，名利过人，切勿有火，恐生土而碍水，致有轩轾不均之弊。'],
  ['庚', '未', '甲', '申', '季夏庚金，本属有根，况时？申位，得禄通根乎，身强则喜财，甲木原是喜神，然因甲木自絶于申，休囚而不生旺，非有伤食之水以生之，则一点财星，眞有名而无实矣。'],
  ['庚', '未', '乙', '酉', '庚金日主，旣有月支未土之生，？有时下酉金之助，身强之命，必须互克方妙，滋其时上乙木，透自未土堤纲，财星可为我用，岁月之间，有水或火，均属喜而不忌，祗怕印与比劫耳。'],
  ['庚', '未', '丙', '戌', '庚生九夏，时逢丙戌，天干如火伞当空，地支犹洪炉鼓铸，使庚元镕成金汁，凝结为难，是以杀重火多为病，惟有逢阳水，始为对症之良药，阴水力犹不逮，木火则为大戒。'],
  ['庚', '未', '丁', '亥', '未中丁火，透出时干，厥名杂气官星，亥中纳甲，丁火赖其暗裏相生，官星有气，庚得未生亥润，亦属有气，此乃火炼庚金，必成大器之命，四柱比劫不忌，木火无妨，大喜得水，以及湿土。'],
  ['庚', '申', '丙', '子', '庚金生于申月，名建禄格，根通气旺，时干露丙，独杀？淸，子水伤官，制伏？杀，可谓序配得当，但时値金旺水相，子申会局，不免制杀太过，必须有木，泄水而生火，方是有为之命，如见土而成杀印相生，便灭色釆，因土能晦弱火，又生当旺之金也。'],
  ['庚', '申', '丁', '丑', '书言建禄生提，财官喜透，兹则丁火官星透出时干，似足化顽铁而成精金，惜乎丁火自墓于丑，虽成官印相生，究以火衰？晦，必须岁月见木，则丁火有根，且土被抑矣，尤喜透甲合建禄财官之旨，？以庚劈甲，甲生丁，丁炼庚，三物俱备，相制相成，为第一等命造。'],
  ['庚', '申', '戊', '寅', '庚生申月，而値寅时，戊土得遇长生，犯生旺太过之嫌，寅乃财星，建禄所宜，无如寅申交冲，根株受伤，故必年月干头，申中之壬，寅中之甲，水木并显，方妙，苟无水木，而见官杀，便非上选，大忌见金，定为贫命。'],
  ['庚', '申', '己', '卯', '孟秋庚金，气势正锐，不宜再来己土正印，而喜木火财官之克，虽时？卯木，终觉独木难支大厦，必也年月干支，水木配合，乃能财星有根，而为富命，倘木火？全，富贵絶顶。'],
  ['庚', '申', '庚', '辰', '日时均是阳金，生初秋申月，比肩旣重，不宜再有土金生扶矣，奈何时？辰土再生金，终有太过之虑，必须岁月透壬，则为金淸水秀，再能以木配之，定以艺术文学，自由职业，而至巨富也。'],
  ['庚', '申', '辛', '巳', '庚为顽金，时透辛，月支申，一波比劫，太旺为病，幸时？巳火克气，但敎丙丁能露，可许必发，苟见一火，而辅之以木，亦名成？就，此盖金多为病，以火为药，有病有药为可贵也。'],
  ['庚', '申', '壬', '午', '申月庚金，质坚而劲，时？壬午，固是火以锻之，水以悴之，书谓金多金光，以有壬水涵漱，不患比劫之再见，然因与午中之丁相合有情，火力式微，总须干支之间，有木以生其火，方显妙用，大忌阴水，卽不成器矣。'],
  ['庚', '申', '癸', '未', '初秋建禄之庚金，盖以未土印绶相生，？为强健，原喜木火之互克与壬癸之相泄，今得时上癸水伤官，以泄方盛之阳金，应不忌而甚喜，祗因癸水自墓于未，水力微薄，所以忌火土之多，多则虽英雄而用武无地矣。'],
  ['庚', '申', '甲', '申', '庚金日主月时均値于申，所谓禄多不贵，而况甲木财星，？逢絶地乎，是必干逢壬癸，庶几泄旺金以生弱木，为白手兴家之造，至于以火制金，削弱比劫之力，使财得苏息，但财弱不胜火泄，又低乎见水一格矣，土金大忌，犯之必一世赤贫，而尝假富之痛苦。'],
  ['庚', '申', '乙', '酉', '乙与庚合，而生申月酉时，区区一点阴木，势不能与成群之金相抗，惟有伈伈俔俔，低首下心而相从，如能不见火，乃化金之眞，飞黄腾达无疑矣，见火仍喜财官或伤食。'],
  ['庚', '申', '丙', '戌', '月建逢申之庚金，坚刚无比，时逢丙戌，戌虽庚之母气，但系火库，不殊？灶，生中未尝无克，得丙火之显露，乃身杀停均之格，柱中祗可见水与木，则七杀旣有所制，？有所生，见火则杂，见土金则杀弱而无用矣。'],
  ['庚', '申', '丁', '亥', '建禄喜见财官，乃不祧之论断，所以庚生申月，时遇丁亥，亥乃木之长生，虽本质属水，却有生起丁火之效用，况丁亥干支五合，原属有情乎，苟年月有木，尤为尽善，如见阳土阴水，必其？碌无成，金之忌见，固尽人知之矣。'],
  ['庚', '酉', '丙', '子', '庚金生于酉月，値旺气，逢阳刃，必要官杀之火，始能相制相成，兹其时上之丙，固所需要，时元之子，虽属于水，而不致伤及丙火，似亦无碍，但时令金旺水相，火势退化，还当见木以辅之，不可有金之幇身，土之生金与水之克火。'],
  ['庚', '酉', '丁', '丑', '酉月之庚，坚实无比，所以同一火也，与其见丙，不如见丁，盖丁为后天之火，足以销镕顽强之金，但丁火助丑，未见有力，酉丑又会半金局，殊嫌太过，则柱中大喜木火之扶植，阴水最忌，土金不宜。'],
  ['庚', '酉', '戊', '寅', '酉月为庚金之旺乡，不合见土以相生，所以时干戊土，乃其病神，土旣为病，则木为对症之药，时支寅木，应作喜神矣，？知地支之质不纯，寅为戊之长生，克中有生，必也甲木透露，则身旺任财，财通于根之富格，比劫大忌，见火，则当以官杀为用。'],
  ['庚', '酉', '己', '卯', '仲秋阳金，非木火不为功，固千载之定论，所以时支卯木财星，允属瓌宝，无如月支在酉，将卯冲破，区区之财，劫夺殆尽，而当旺之金，又有己土以资之，庚金愈旺，是必余柱有火制金，有水生木，再透甲乙，始是金刚木弱，商买致富之造。'],
  ['庚', '酉', '庚', '辰', '酉月当旺，庚金再遇庚辰时元，比劫重重，又有土生，生旺极矣，倘柱中并无木火，则应从其旺气为断，切忌火之逆折，见木火仍以财官为用，辰中藏癸但敎透壬或癸，必是秀发之士，或见亥子亦佳。'],
  ['庚', '酉', '辛', '巳', '庚日巳时，七杀値长生，生中有克，而亦克中有生，巳酉会局，以助辛金之劫，似与上造从旺相等，？知子平之理，有杀终以杀论，故宜丙丁透出，辅以甲乙之木，不必水来制杀，始是有作有为，杀刃相济之好命。'],
  ['庚', '酉', '壬', '午', '以顽钝之庚金，生当酉月，愈觉坚实，妙在时逢壬午，挹江流以磨洗，鼓洪炉而销镕，水火？不相碍，而并可喜，但若柱中无木，则火候不纯，故尤以有木与否，为评论价値之低昻也，大忌有土，则火被泄而水被？矣。'],
  ['庚', '酉', '癸', '未', '庚金冠带于未，生意自足，再逢酉月，气盛之候，诚属锐锐为奇，未中乙丁财官暗藏，而癸水可生乙木，倘得财官再透，富贵无疑，印绶比劫，仍以回避为？。'],
  ['庚', '酉', '甲', '申', '庚金日干，时？申禄，月坐酉刃，比劫夺财，财透亦无所用，况甲木絶于申，气弱已甚乎，所以则有火以克金，亦有权无利，惟得水生财，或财多，则短中之长，先贫后富。'],
  ['庚', '酉', '乙', '酉', '庚生酉月，又値酉时，羊刃重逢，命硬已极，时干乙木，？酉絶地，遂为环境所化，不能独立，故是乙庚化金格也，但若再见甲乙寅卯，则为财弱身强，有火则化金格破，而以官杀为断，欲其化格之成，端须仅有土金？者。'],
  ['庚', '酉', '丙', '戌', '仲秋之庚，第一须克，不论火之克我，与我之克木，均可为用，金则丙火独杀，以戌土火库助之，纵不能镕解坚刚当旺之庚金，究已合于强者抑之之义矣，是宜年月再见财星，或则官来助杀，皆有一番作为。'],
  ['庚', '酉', '丁', '亥', '当旺之庚，喜有丁火之炼，惟金有二而火仅一，纵亥中甲木，暗生丁火，犹觉火力之不充牣，必须年月有木，使丁火不息，或则有火，以扩张其焰，乃成优秀之命，大怕癸水，戊土亦非相宜。'],
  ['庚', '戌', '丙', '子', '庚金生于戌月，时逢丙子，如已土旺用事，则丙火之光，晦而不扬，必待木以疏其土，生其火，庶七杀可用，按丙火原坐子水之上，不宜再有壬水透干，以剥夺其？量，所以土金水三者，均非所宜，而木火之相需甚殷，不言可喩矣。'],
  ['庚', '戌', '丁', '丑', '戌中藏有丁火，今露时干，庚金日主，喜得锻炼，月戌时丑，其质皆土，旣値土旺，丁火之力极薄，是宜木透干头，方能死灰？燃，而显财官之妙用矣，大忌癸水，以伤官星，壬虽合丁，亦非宜也。'],
  ['庚', '戌', '戊', '寅', '戌月庚金，季秋旺土，生气正盛，再有戊土印透，下？寅位长生，土厚金遭埋灭，尙何疑义，所以寅戌虽会火局，或再有丙丁透出，亦非本格，？以火生当旺之土，徒增埋金之病，是必阳木为救，则斩关直入，旺土亦为辟？矣。'],
  ['庚', '戌', '己', '卯', '庚金日主，戌土月令，已甚生旺，时逢己土，？于病地之卯，自？同于戊土？寅位长生，故己虽忌，而为患较轻，不致土厚埋金，最好乙木出干，或支逢亥卯，则为身旺任财之格矣。'],
  ['庚', '戌', '庚', '辰', '庚金诞生土旺之戌提，而又时値庚辰，土厚金坚，如见甲乙，则力不敌金，倘遇丙丁，则生土忘克，如此配合，未免用神莫属，故祗有顺其生旺之气势，作从旺之格，再喜土金生扶之，倘柱中得有一点之水，骏发可俟矣。'],
  ['庚', '戌', '辛', '巳', '庚日巳时，乃其长生，且为旺土之禄，再有辛金扶助，致犯身强太过，然巳火终系七杀，但敎年月有丙或丁，则官杀通根于禄旺，辅之以木，生火制土，自亦不凡也。'],
  ['庚', '戌', '壬', '午', '庚金质本顽强，再生戌提旺土之候，时逢壬午，似可洗之？之，以成？用，惜乎此际之壬水，？为旺土所掩，而午戌又会局生土，并非尽善，故宜干头木透，壬水生之，使秋木以树疏土之功，亦上格也。'],
  ['庚', '戌', '癸', '未', '秋杪土旺司权，庚日再诞未时，不免土多为病，然未中藏有乙木财星，得癸水生乙，如能引出天干，定致锯富，或他柱多水亦佳，惟此时之阴木，亦値休囚，切忌见金以损伤。'],
  ['庚', '戌', '甲', '申', '庚日申时，名为归禄，时通日气，月令在戌，土旺生金，致嫌身旺太过，故时上甲木财星，洵命中之精华也，还须见水以灌漑，或得木而扶助，否则仍是金刚木强，至多小康，贵？无望矣。'],
  ['庚', '戌', '乙', '酉', '日为庚，时透乙，乙庚为道义之合，在此土金并旺之秋，？可化金，况？时？于酉，又是庚之旺乡，切忌有火克金，或见木而被金克，皆非化气之眞矣，土金本所弗畏，尽？生扶可也，见一点木火，便尔破格下贱之命。'],
  ['庚', '戌', '丙', '戌', '戌为火库，庚金旣生戌月，再？戌时，丙火高透，纵在土旺用事，亦？足以晦其火而埋其金也，年月如得有木，固为上选，惟不可再见土金，以对抗火势耳。'],
  ['庚', '戌', '丁', '亥', '庚金？当火炼，千古不磨，月令在戌，戌中藏丁，今乃引出时干，一官独透，？器必成矣，若地支再得寅卯，天干则露甲木，乃伟大之格，必大富贵亦寿考矣，印生劫助，卽是庸命。'],
  ['庚', '亥', '丙', '子', '亥月水旺木相，庚値病地，时逢子水，水冷金寒，非火之力量，？足以使水？通，金有生气，丙火太阳，虽能解冻，尙？足有益于病地之金，所以有印绶之土为最要，盖？但生金，且可抑制旺水也，金木并不为忌。'],
  ['庚', '亥', '丁', '丑', '十月之庚金，水旺泄气，固喜土以生之，火以暖之，兹则时逢丁丑，似乎深合寒金需要，然丑虽属土，位在北方，而有寒土不生之虑，虽丁火可以生起丑土，但丑为丁墓，亦为庚墓，必得干头土透，辅以甲乙木生丁，乃为上格。'],
  ['庚', '亥', '戊', '寅', '亥月病地之庚金，得戊土以生之，沉疴可以？起，时？于寅，寅乃丙戊之长生，戊土亦非无力，洵为身弱喜印之标准，岁月干头，再能有火，则金木水土，无不生气活泼矣。'],
  ['庚', '亥', '己', '卯', '冬令退气之金，第一要土，盖？但金赖以生，且水赖以抑，时支之卯，虽可泄过旺之水，亦可威胁寒凝之土，故必见火，则己土有所恃，而金水木所束之寒气皆除矣，？但缓冲于土木之间而已也。'],
  ['庚', '亥', '庚', '辰', '书谓身弱喜生扶，孟冬庚金，总非生旺，有辰土之生，庚金之扶，似可返弱为强，但此时令节，阳气闭？而成冬，孤阴不生，全仗年月见火为之斡旋，如无火而有木，仍难焕发。'],
  ['庚', '亥', '辛', '巳', '水寒束缚之庚金，喜得巳火之长生，辛金之同类，其气遂能少舒矣，巳亥交冲，火被旺水所克，非得年月透出戊己不为功，再能辅之以木，使时上七杀，能发挥其天赋之本能，则必光华一世矣，透丙亦可。'],
  ['庚', '亥', '壬', '午', '庚生亥月，亥中壬水高透，食神吐秀，且得禄通根，古训有食神得禄不逢官之说，？知古人此说，非所以论冬令庚金之食神，？以寒金而无火，必致金水寒冷为虑，一点午火，洵足温其金水，惟年月之间，祗可见金，不可再见火耳，戊土大忌。'],
  ['庚', '亥', '癸', '未', '庚日而遇癸时，月建在亥，则是金水伤官，身弱则宜印，时元之未土，洵属必需矣，犹嫌水强土薄，故以天干再见一位印绶方妙，比劫亦喜，木火不忌。'],
  ['庚', '亥', '甲', '申', '亥月之庚金，时？甲申，甲木长生于亥，庚金得禄于申，财星有气，日元通根，可谓四平八稳，然亥水究在旺令，申中水藏壬水，较量重轻，犹是水强，所以宜见一位印绶之土以和之，或有火透出亦佳。'],
  ['庚', '亥', '乙', '酉', '庚虽泄气于月建之亥，然得旺刃于时元之酉，而不虚弱，乙木财星来就，虽？气絶于酉，但値水旺木相，仍可用财，倘能支逢卯未，则尤身财俱茂矣，若见丙丁主贵，金与土不妨。'],
  ['庚', '亥', '丙', '戌', '三冬庚金，寒威凛冽，金气消沉，时元丙戌，丙火则太阳当空，戌土则暖水生金，盖戌为火库，丁火暗藏，生气尤其有力也，其余干支，祗要五行分配停匀，不重复，多见，？佳。'],
  ['庚', '亥', '丁', '亥', '庚金日元，遇亥月亥时，重重泄气，金沉水底，幸亥中藏甲，暗中生丁，则水得火暖而？动，金以火焰而光显，然以一庚而与二水一火相冲，絶不势均力敌，还须金助土生，始臻上选。'],
  ['庚', '子', '丙', '子', '庚生子月，水气正旺，时遇？子，伤官盗泄愈甚，大有金沉水底之势，今得丙火高透，固足稍解寒流，但总觉太阳之火力，不能与金水之寒冷相抵消，所以必得土透干头，一面抑其水，一面生其金，乃克和谐耳。'],
  ['庚', '子', '丁', '丑', '子月庚金，泄气已甚，火与土，洵所斳求者也，奈何丑属湿土，藏金则有余，生金则？足，庚金墓于丑，盖卽此理，还当年月见土生庚，见木生丁，而旺水被遏被泄，方全中和。'],
  ['庚', '子', '戊', '寅', '庚生仲冬泄气之子月，喜得戊寅时元，为之补救，盖戊土旣坐长生于寅，土亦甚厚，足以生金掩水，而寅木？有泄水之功，所？足者，缺一火耳，苟再火明干头，则生生不息矣。'],
  ['庚', '子', '己', '卯', '月令在子，日主为庚，伤官正在旺令，庚金？于死地，则时上己土正印，洵为瓌宝矣，无如己坐于卯，印？病地，虽卯木能吸收当旺之水，己土究嫌？薄，是应年月有火，始克呵成一气。'],
  ['庚', '子', '庚', '辰', '仲冬月建在子，庚金之气甚颓，得时上庚金之助，辰土生之，似可补偏救弊矣，？知辰为水库，子辰会局，纵有比肩幇扶，终觉水盛于金，所以柱中还须火土，盖有土而无火，则土少活力，反恐埋金耳。'],
  ['庚', '子', '辛', '巳', '庚日而逢辛巳时，同气相求，长生资气，为泄弱之庚金所喜，但因地支之气质不纯，不及天干有力，如巳火之中，藏丙戊庚，苟再见丙戊出干，则杀印无不通根，伤官假之为权，必成大器矣。'],
  ['庚', '子', '壬', '午', '庚属阳金，固须火炼，时逢午火，为之？灶，奈生子月，壬水又露，水势包围，将不免倒灶之危，不能援金水伤官喜见官之？，？以子午究属相冲也，除非年月透火，益之以土，方无可訾。'],
  ['庚', '子', '癸', '未', '庚金诞于子月，子中癸水透干，为金水眞伤官格，书谓伤官身弱则喜印，此时庚金不强，所以未土印绶，足为补天之五色石也，最好未中所藏之丁火，能显露于年月干头，尤合金水伤官喜见官星之旨矣。'],
  ['庚', '子', '甲', '申', '子月死气之庚金，得？申时，申为庚禄，气势稍可振作，甲木财星，虽絶于申，申子会局，仍生木，惟是大地凝冰，金寒水冷，如得余柱有火庶藉阳和之暖气，则工善其事，且？其器矣。'],
  ['庚', '子', '乙', '酉', '月令在子，为庚金之死地，乙木之病乡，虽合不化，时？酉位，幸系庚金之旺气，虽水旺泄气，尙能任财，是须木火并透，方用财官，有木无火，伤官生财，此外再来土金，亦所不忌矣。'],
  ['庚', '子', '丙', '戌', '寒？无气之庚金，絶难显其本能，喜丙火之照耀，则水冷金寒之病去，？有戌土火库以生金，则庚金虽死于子，而亦生气勃如矣，其余干支有甲戊寅午辅之，乃身杀并强，权操一世。'],
  ['庚', '子', '丁', '亥', '庚日而遇子月亥时，伤官食神杂见，泄而又泄，坚金锈蚀不堪，亟待鼓洪炉而治之，庶仍可致？用，则丁火一官独秀尙已，惟亥虽木之长生，究不直接生丁，故干头要有木，庚金究少生气，？柱中要有土，备此二者，为上格无疑矣。'],
  ['庚', '丑', '丙', '子', '庚金生于丑月，虽云土旺，终是寒土，而时元又？子水，则水愈寒而金愈？矣，丙火七杀透时，足以生土散寒，应取为用，惟尙宜木以辅之，或者支有寅木，方为尽善，不可见土以晦火见金以生水，须细参之。'],
  ['庚', '丑', '丁', '丑', '庚金日干，生丑月丑时，丑为庚金之墓库，且寒土不能生，故纵再见戊己透露，亦势趋埋金，好在丁火高透，俾土金温暖，惟丁亦墓于丑，犹如？中余烬，年月有木，则为贵格，土金水三者，切忌重见。'],
  ['庚', '丑', '戊', '寅', '丑月库中之金，毫无生气可言，喜戊土之相生，环境稍变，好在戊坐于寅，印？长生，而寅中藏丙，暗中生戊暖庚，亦非无补，然与其弥补于暗中，终不及天干火透之为？佳耳，若用取印绶，甲木忌见，火不怕重。'],
  ['庚', '丑', '己', '卯', '庚生丑月，丑中己土透露，庚金得其生气，但在岁杪严寒之候，金水大忌，寒土亦非有用，至于卯木之财，等于疣赘，唯有干上见火，乃木以生火，而火则生土？金，犹奕者只争一子，使满盘死局，变成节节相生矣。'],
  ['庚', '丑', '庚', '辰', '冬月庚金，无从旺之理，卽如此条，天干？庚，地支辰丑，一派土金，倘余柱再见土金，不杂财官，似可从旺，？知辰丑之土，其性阴湿，皆？足以生金，而入墓之金，何能从旺，是须木火并见，使寒？之土金，顿呈活气，始为佳耳。'],
  ['庚', '丑', '辛', '巳', '庚金生于丑月，为湿土所包，块然凝结，无以自显其材性，兹则时逢辛巳，劫财助之，长生资之，尤妙巳为七杀，火土相生相克，综合一体之中矣，如能丙再透干，而点缀一些之木，？无间言矣。'],
  ['庚', '丑', '壬', '午', '季冬之庚，虽在土旺而效用不着，故庚墓于丑，犹石？之无生育也，不应再来壬水，以增进寒水之气，致土金愈形确磊可憎，尙幸时？午火，差补造化之功，但火力微而无根，不得木终为下格。'],
  ['庚', '丑', '癸', '未', '庚生丑月墓库之地，卽少年不发库中之人是也，妙乎时逢未土，与丑交冲，不独墓库冲开，且土冲而动，动则变化而能生金矣。尙嫌霜雪之癸水增寒，故以未中所藏之乙丁透为上。'],
  ['庚', '丑', '甲', '申', '丑月入墓之庚金，然得禄于时元之申，势力仍非强劲，甲木自絶于申，不殊朽木，所以金木皆无力量，而木尤弱，若以水生木，则金水愈其寒？，必须干头有火，而地支益以寅卯通甲之根，始是上命。'],
  ['庚', '丑', '乙', '酉', '以投墓之庚，而値羊刃旺气之酉时，气势可以一振，然以无力之乙木财星相就未能充分以养命，故须支见寅卯，干头有火，庶乙木财星通根，而回春寒谷矣，如有未土尤妙，盖未中藏乙以幇财，藏丁以温暖木，藏己以植乙生庚也。'],
  ['庚', '丑', '丙', '戌', '寒？之庚金，得戌时火库生之，？带使丑土印绶，亦有生气，况丙火太阳空，不殊献曝负暄之妙，若已土旺用事，则火晦其火，制土生火之财星，为四柱所不可少，惟天干阳木胜于阴木，而地支则寅卯皆宜，因寅戌会局，卯戌互合故耳。'],
  ['庚', '丑', '丁', '亥', '庚日亥时，食神盗气，月支在丑，党于北方水位，又拱子水，仅有一位丁火官星，？足与水相济，最妙亥中甲木财透，财生官，官生印，印生身，而其作用，则庚劈甲，甲生丁，丁炼庚，成为十足高贵之命矣，不透甲，亦要木火相生。'],
  ['辛', '寅', '戊', '子', '辛为阴柔之金，诞生寅月，木旺司权，辛金甚弱，？要土生，不宜水泄，时逢戊子，虽戊土足以生身，然子水则长生其名，盗气是实，故喜丙火官透，使戊土？厚，且合辛金温润为贵之旨矣。'],
  ['辛', '寅', '己', '丑', '孟春之辛，原不虑乎土多而埋金，？以时令木旺，土重何忧，所以己丑时元，无可非难，但因余寒犹凛，辛金殊欠温和，年月得见丙丁，庶辛金之情华显露，盖旣有己丑之孕育，自不虞丙丁之镕铄矣。'],
  ['辛', '寅', '庚', '寅', '辛金逢寅月寅时，本是财多身弱，所以时上庚金，喜其同气能助也，但庚虽阳金，逢寅为絶地，相扶之力，有嫌不够，最好土透干头，则金得母气以孕育，成为财得根深印得华之佳格，而富贵？全矣。'],
  ['辛', '寅', '辛', '卯', '寅月柔脆之辛金，再？卯时，卯乃辛金之絶地，其弱不堪，纵时透比肩，似可为助，？知支连同气，亦在絶气之方，自顾不暇。于何为力耶，最妙寅中之戊土透天，戊土坐长生于寅，力能生金，方可以辛金为用，但与其身弱用比，反不如用印之直截了当，惟忌阳木破格耳。'],
  ['辛', '寅', '壬', '辰', '初春之辛金，逢壬辰时，辰虽印绶生身，却値墓库湿土，生气无多，何况壬水伤官，泄弱金，滋湿土，生旺木乎，祗可弃命从财，但敎柱皆水木，则淸奇之格，倘年月有火，则火以温之，水以洗之，所谓润而淸亦为上格，未可以伤官见官为忌焉。'],
  ['辛', '寅', '癸', '巳', '辛金生于寅月，木旺火相，时？于巳，木火相通，时干之癸以生寅木，虽寅巳之生中皆藏戊土，但辛金总觉弱也，必得戊出干头，则食财官印四美俱，弱极逢生为二难幷矣。'],
  ['辛', '寅', '甲', '午', '辛日午时，时上一贵，故五行生克之理，则寅月为甲木之禄，寅午会半火局以助杀，所谓财官太旺，天元瘦弱之征，必也寅中戊土正印，透露干头，以泄火而生金，方是富贵絶伦之命，或见庚申劫财，将当旺之木，稍予制裁尤妙。'],
  ['辛', '寅', '乙', '未', '寅月胎中之辛金，得未时之土生之，原无不可，惜乎未为木库，而中藏之乙木，又露时干，仍不克挽救财多身弱之弊，柱中还宜有土，如逢比劫，虽可为助，但不成其为时上偏财格矣，？以时上偏财忌见兄弟，固定论耳。'],
  ['辛', '寅', '丙', '申', '辛生寅提，时値丙申，丙辛虽云相合有情，在时令焉能化水，寅申一冲，似为财星之？，但辛金旺气于申，而春木不虞削伐，故仍可用财官，丙火长生再寅，官星亦然甚显，光明烛照，辛金之珠光宝气毕呈矣。'],
  ['辛', '寅', '丁', '酉', '辛金生于孟春，得酉时日禄通根，不致过分孱弱，时上丁火，独杀？淸，寅木生之。可称身杀？停矣，如其余干支，有水生财制杀，亦须有土生金，方全中和为贵之道。'],
  ['辛', '寅', '戊', '戌', '失令之阴金，以有印绶相生，为第一义，则戊土透于时元，洵为可喜，时支之戌，虽系戊土之墓库，幸戊土旣长生于寅，寅戌又会局以生起戊土，此为眞正印绶格，所忌者，仅为甲木耳。'],
  ['辛', '寅', '己', '亥', '辛日寅月，又亥时，恰与寅合，财官甚旺，赖有己土偏印之资，弱金不为无气，惟三春己土，其无力与金相等，必待火之生己，差堪调济，但纵是身弱财豊，纵有火，还宜见戊己，方可弥缝补阙。'],
  ['辛', '卯', '戊', '子', '辛金生于卯月，正逢絶气之乡，必待生扶为上，兹其时逢戊子，正印透而生身，子水虽系长生，实则滋其旺木，最好得庚申劫财为助，则可以食神生财为用，切忌甲透，因犯破印之忌，致辛无生气也。'],
  ['辛', '卯', '己', '丑', '卯月之辛金，濒于絶地，得己丑以土相资，絶处逢生，克任月支之财，惟辛金之质，以喩珠玉，还宜水以淘洗，则精光耀灿，夺目惊人，故若年月逢壬，日坐或値亥始是优秀之命。'],
  ['辛', '卯', '庚', '寅', '辛日而遇卯月寅时，财星极旺，赖庚金劫财幇身，则阳金阳木，分配平衡，然因春令之金，终须生土，故干头第一要有土，而土则不论为戊为己，前人以为二月辛金喜己土，忌戊土埋金之说，未免太泥矣，苟无土，则要有金，丁火及木大忌。'],
  ['辛', '卯', '辛', '卯', '辛日卯月，再逢辛卯时元，？辛以敌？卯，财正旺，而辛金亦吾道不孤，但以时令论，则未较金强，次以地位而推，则辛金皆？絶地，必须再有土金生扶，方可身财并旺矣，如木火水透干，总作身弱论也。'],
  ['辛', '卯', '壬', '辰', '辛为珠玉之金，喜壬水之淘洗，生于仲春卯月，？宜辰土之生，惜乎卯辰位次东方，为辛金絶气墓库之度，所以辰虽印绶，而生金之力殊微，还须干头得土相生，庶无尤耳，忌水木重土，金则有益，火则不需。'],
  ['辛', '卯', '癸', '巳', '二月辛金坐弱，不喜水之泄，与火之克，兹则时逢癸水巳火，皆是忌神，惟巳虽属火，亦系戊土之禄，庚金长生，但显戊庚透而生扶，卽不反弱为强，亦可配合中和矣。'],
  ['辛', '卯', '甲', '午', '辛金絶于卯，辛日而遇卯月午时，财杀极旺，况又甲木高透乎，但可以弃命从财为断，余柱不以水木为忌，见土金生扶则破格，或谓午中藏有己土，弃之？尽者，？知己为旺木所制，有何余力生辛者。'],
  ['辛', '卯', '乙', '未', '卯月未时，卯未会半木局，乙木透干偏财之木，根深蔕固，卽云未属土，能生金，然卽未为土质，亦被乙卯所克，无力生辛矣，亦以弃命从财而论，不怕水木之重沓，祗怕比劫之分夺，火则泄财，土则生金，皆非所喜也。'],
  ['辛', '卯', '丙', '申', '丙与辛合，因在卯月，木旺火相，断不能丙辛化水，然旣丙火官透，卯木财以生官，柔弱之辛金，纵胜旺于申，终少胜任财官之力量，最妙透戊土而値亥水，则辛旣有根，而火暖水洗，自合温润之妙谛，但敎有土，则金水不忌，火木无妨。'],
  ['辛', '卯', '丁', '酉', '卯月辛金，虽得禄于酉时通气，无如酉为丁火所驾驭，则辛金不啻根断源消，况又卯酉之冲乎，必须有土，方能泄相火生弱金，以成杀印相生，如无土，则降格以求，宜有弟兄以扶之，水非所喜，尤忌阴水。'],
  ['辛', '卯', '戊', '戌', '卯月气絶辛金，得戊戌正印生身，洵为絶处逢生之佳造，惟戌为火库，戌中藏丁，暗杀镕金，最喜干头有水以济之，土已作用，木则宜少，火非所需，金则弗嫌其助。'],
  ['辛', '卯', '己', '亥', '子平以卯月辛金，须有壬水之洗，己土之生，今其时逢己亥，以亥为壬禄而论，深与上说吻合无间，但此外尙有年月？干，岁日二支，以何配合为妙耶，根据亥卯半局，而财在旺令，则最喜庚申，可无疑义，此外稍杂木火，亦无妨乎大体。'],
  ['辛', '辰', '戊', '子', '辛金生于辰提，辰中戊土透干，土旺用事，致有埋金之虑，时？于子，虽曰长生，？足以补救埋金，必须甲木出干，以疏旺土，以子水生木，不致成为废材，倘有火，则旺土？厚，见金水，则无关乎荣辱，苟得金木交差，乃为上格。'],
  ['辛', '辰', '己', '丑', '辰月土旺用事，时为己丑，重重之土，柔弱入墓之辛，势必遭其埋灭，所以柱中有木，卽以财星为用，所谓财以破印也，最喜水木，必为时势之英雄，盖不顾名义，不择手段，惟为富贵为目标也。'],
  ['辛', '辰', '庚', '寅', '辛金日元，生于墓库之辰提，辰土生身则未必，埋金则可能，故必须疏土之木，始为佳造，兹时値庚寅，不喜其庚金相助，而喜其寅木疏土，如再干见壬甲，大富可？而俟，奇才亦由天授，火则不喜。'],
  ['辛', '辰', '辛', '卯', '辛日辛时，连枝有助，生辰月墓库之乡，未可谓无生气，则时元卯木偏财，足谓养命之根原，苟再乙透，则成杂气财星，再能支中见亥，使比肩无分财之嫌，独怕丙火，致丙辛妬合，次忌酉金，来冲破财根，苟其露庚坐寅，则身财交茂矣。'],
  ['辛', '辰', '壬', '辰', '辛金墓库于辰，月时皆辰，不啻网罗四布，辛金不能展布其材性，时上虽逢壬水伤官，但壬水亦墓于辰，等于沧海遗珠，鮹人亦难寻见，必得木之克土，火之照水，庶能合浦珠还耳。'],
  ['辛', '辰', '癸', '巳', '辛金墓于辰，死于巳，时巳月辰，休囚之众，卽云土旺，徒使金埋，辰中癸水透露，？巳火似合温润之旨，但若无木，则土何从疏，火何从秉，水何从泄，一派烟雾迷茫，？从何处得生尘之宝钗乎。'],
  ['辛', '辰', '甲', '午', '季春辰提，正当土旺，再値午时，以生旺土，则土愈厚，而辛金沉埋愈深，所以甲木财星，以疏旺土，固相需甚殷也，苟能年月并见庚壬，或露丁而坐申，定是大用之造矣。'],
  ['辛', '辰', '乙', '未', '辰月未时，以？重当旺之土，生入墓之神，反嫌土重，则乙木财以破印，深合强者抑之之旨，不可再有比劫以夺财，并忌官杀之泄财以生土，若逢壬癸，以灌漑其木，定为富命。'],
  ['辛', '辰', '丙', '申', '丙与辛合，而在辰月申时，申辰会局，如支逢子水，未尽土令，则化水之格以成，再考申乃辛之旺乡，四字已有一土二金，何畏一丙，况丙辛合而克中有情耶，金木水土，咸非必忌，独火须回避之。'],
  ['辛', '辰', '丁', '酉', '辰月酉时，辰与酉合，土旺金相，化金助身，故辛虽入墓之金，究因时归日禄而不弱，所以时上一位丁火七杀，允可作用，然丁火犹觉根浅，故岁月有木为佳，壬水不忌，独不喜癸，倘干有土木，则癸水亦？足虑矣。'],
  ['辛', '辰', '戊', '戌', '季春辰月，土旺用事，时为戊戌，辛金日干，眞是土厚金埋矣，纵辰戌交冲，其土冲动而活，但若不见甲木，总是愚蠢？苦之命，最妙壬甲并透，而又日坐于亥，则病重药重，大富大贵之造矣。'],
  ['辛', '辰', '己', '亥', '辛日生于暮春，辰月土旺，再见己土高透，相生太过，而有母慈灭子之嫌，喜其时落亥水，壬甲内脏，苟能壬甲再露干头，必非凡土，火非所需，金则不忌，如以甲易乙，亦甚妙也。'],
  ['辛', '巳', '戊', '子', '巳月火旺，柔软之辛金，望而生畏，务须得水，与火相济，则辛金旣温且润矣，所以巳月子时，确是佳格，不过予上戴戊，弱水为生旺之土迫，还宜比劫之金，泄土资水为上，若见木，虽可疏土，？能生火，并非絶对需要，总喜金水调和也。'],
  ['辛', '巳', '己', '丑', '辛金生于巳月，火初旺而金失令，土以生之，原无不可，时逢己丑干支皆土，似有埋金之嫌，所幸巳为庚金之长生，丑乃庚金库地，巳丑相会，成半金局，足以扶助有情，而金多不致被埋，最妙透出水火，则磨洗照耀，而珠光宝气悉呈矣。'],
  ['辛', '巳', '庚', '寅', '辛生巳建，其气休囚，巳中庚金劫财，透出时干，相助有情，故卽时逢寅木，以有庚金抑制，尙不致财官太过，苟再得土相生，有水济火，必是非常之造，且有纯正之风徽焉。'],
  ['辛', '巳', '辛', '卯', '辛时辛日，同气？枝，然生病地之巳月，絶气之卯时，终属先天？足矣，所以还喜柱有土金，为之生扶，不可再见木火财官，使辛金？感无力，若？得已而求其次，则壬丙？透，亦超脱之格也。'],
  ['辛', '巳', '壬', '辰', '巳月辛金，金衰火旺，喜得时逢壬辰，旺火赖壬水之济，弱金得辰土之生，可称极中和之妙，假使丙丁透干，余柱配合一点土金，亦无弊病可言，但若见木，则须有金以制之，否则木泄其水，生其火，未免偏枯矣。'],
  ['辛', '巳', '癸', '巳', '辛金质柔，而不任克，兹其月时皆巳，巳虽丙禄，与辛暗合，究以一金敌二火，？有未逮，好在癸水食神吐秀，以抑炎上之威，但因夏水？涸，必也巳中庚透为之源，方属上格，苟再木火之露，便是卑下无能之命。'],
  ['辛', '巳', '甲', '午', '夏初巳建，虽巳内藏有戊土庚金，暗中生金，日干之辛，总属失令力薄，时逢甲午，火得木而愈旺，似可援阴干从势之义，而作弃命从杀论，然因巳中戊庚之故，纵未从干，亦弃之？尽，惟有金木？见，庶为病药相济之好命矣。'],
  ['辛', '巳', '乙', '未', '巳月克辛，未时生辛，一生一克，似可平均，但因乙木克未而生巳，生机薄弱，且巳与未拱午火，遂使辛金无力以抗衡，须当干见戊庚生扶，而余柱辅之以水乃佳，倘能地支见申，尤为可贵。'],
  ['辛', '巳', '丙', '申', '夏令之阴金，大喜生之扶之，时？丙申，丙火得禄于巳，辛金乘旺于申，虽非化水，丙辛无不通根，蚓巳余申合，丙与辛合，丙巳二火有所绊，而不为忌矣，故巳月之辛金，惟此一条，对于五行，皆絶对相畏者，和平载福之格也。'],
  ['辛', '巳', '丁', '酉', '辛金得禄于酉，月令在巳，巳酉会半金局，以助衰弱之辛，虽不返弱为强，究是弱而不弱，时上丁火七杀，可以为用，盖丁为灯红，酉为酒缘，愈显辛金珠玉之可贵矣，不可在见火，如见木则宜少忌多，土反不喜，恐埋金而晦火也。'],
  ['辛', '巳', '戊', '戌', '孟夏巳提火旺土相，辛金此时克气盛于生气，兹以时上戊戌正印，得禄于月提之巳，土厚异常，反而生过于克金虞埋灭，故须甲木以制戊，益之以水，俾甲有力，戊戌之土松动，辛金钗钏脱颖而出矣。'],
  ['辛', '巳', '己', '亥', '辛日而生巳月亥时。虽曰巳亥逢冲，伤官见官，但此时官旺，不忌受伤，反有相制相成之美矣，但受克之阴金，何堪亥水之盗气，则时上己土偏印生身尙已，故切忌见木，阴木尤畏，比劫幇身，乃最相宜，'],
  ['辛', '午', '戊', '子', '辛金生于午月，丁己同宫，火旺土相，然午中己土未透，时上见戊，则阳土燥而难生金，喜得时之子水，虽与午冲，究可以润湿戊土，俾阳土之性具阴土之效用矣，然而水尙无根，还宜庚申阳金相资，始可金瓯无缺。'],
  ['辛', '午', '己', '丑', '午月之辛金，正逢病地，时逢己丑，枭印得禄于午，生起病金，苟为所喜，然其余干支，以见壬庚？者为最妙，假使二者之中，得见其一，则杂以一些木火，亦不为忌，惟戊土忌见，虑其埋金耳。'],
  ['辛', '午', '庚', '寅', '辛金生于午月，本是身轻杀重，兼之时又？寅，寅午会杀为凶，卽得庚劫幇身，因庚絶于寅，败于午，助力或微，最好年逢己土生金，或则月有壬水之抑火，地支方面，以年日坐亥为最佳，不必虑其寅亥相合也。'],
  ['辛', '午', '辛', '卯', '辛生午月，火旺金病，时遇辛卯，辛金虽可幇扶，卯木忌其生杀，仍是财杀强而日主弱也，务须壬癸透干而有己土，地支有申，则辛金旣乘生旺之气，壬癸水亦有源，为必发之造矣。'],
  ['辛', '午', '壬', '辰', '仲夏旺火铄金，必得水以济火，土以生金，乃为上选，今则时落壬辰，使珠玉得以保全矣，若干上见金，地支値申，壬水源远有自，伟大之格，切忌阳土，而木火亦当回避焉。'],
  ['辛', '午', '癸', '巳', '午月辛金固嫌杀重，食神癸水，洵收制杀之功，但因癸絶于午，？于干涸，最妙巳中庚金，得见于年月之上，庶癸水有根，而辛金有助，木火是忌，土亦不喜，？以己土枭神夺食，戊土合癸，虽生辛金，终碍癸水也。'],
  ['辛', '午', '甲', '午', '辛病于午，则月令时元，皆値病乡，卽无甲木，已嫌受克太甚，兹甲又透，生起当旺之火，不啻炉火熊熊，珍珠宝玉，势必镕毁无余，必得大量之金水相救，或己土合甲生辛，以牵制其木始为有用之造，'],
  ['辛', '午', '乙', '未', '辛日未时，未土似可生金，然因未中乙透，以生午中当旺之丁，未免相克多，相生少，是宜未中己土亦透年干，而月上逢庚，以合其乙，赖此土金之生扶，则辛金化腐臭为神奇，洵可贵矣。'],
  ['辛', '午', '丙', '申', '书云丙合辛生，权威之客，然此指秋冬之辛金而言，非所以论九夏者也，兹丙火乘旺于干，虽相合有情，终属所畏，幸尔时？申位，为辛金旺气之方，遂能补褊救弊，若得申中壬水再透，则十全十美矣。'],
  ['辛', '午', '丁', '酉', '丁火得禄于午，辛金得禄于酉，颇具力敌势均之妙，惟九夏镕金，终觉火力偏胜，除非干逢壬癸，以子救母，或见己土，以母护子，阴土与水俱全，则辛金为无瑕之璧矣。'],
  ['辛', '午', '戊', '戌', '午月为戊戌阳土之旺乡，辛金赖之以生，所惜戌为火库，午戌半局，致有火焦土？之患，非特不能生辛，且有埋金之弊，故必干头见甲以制戊，辅以壬癸而济火，或有甲而坐亥，均属佳命，如无甲而有壬，则劫财为必要矣。'],
  ['辛', '午', '己', '亥', '辛金生午病地，幸时干土偏印，得禄通根，生金泄火，？赖亥水，与火相济，卽此四者配合，已臻妙用，然则其余之？干？支，于何为宜耶，乃视其土重宜金泄，木多须金削，有火还须水，惟有金水则无妨耳。'],
  ['辛', '未', '戊', '子', '辛生未月，土旺金相，而火尙有余热，喜其子水润之，惜乎子水墓于未，再有戊土盖头，水火薄弱，非有阳金，则？泉无源，决不能普遍应用，故此造之优？，全视有无庚申劫财为断，忌火畏土，木则？害均等，金水最宜。'],
  ['辛', '未', '己', '丑', '未月辛金，未中己土枭印，透干相生，日元有根，时？于丑，似颇犯土厚埋金之弊，所幸丑未冲而地气动，终？发现宝藏，最好未中乙木，丑中癸水，并露干头如乙丑年癸未月，则珠玉在前，贵可知已。'],
  ['辛', '未', '庚', '寅', '辛金生于季夏，虽有旺土相资，究属炎威愈？，则庚金之同类相扶，固为可喜，然因庚坐于寅为絶地，而寅为火之长生，纵使余干无火，还宜阳水补救，己土出干，始臻神妙矣。'],
  ['辛', '未', '辛', '卯', '未月辛金，如在小暑十二天后，母气甚健，再有比肩扶身，几使失令以柔金，跻于生旺之域矣，但因时落于卯，卯未半局，生起暗藏之火，防辛金之被销蚀，必得壬水遥制，则精神毕露，大忌戊土，以及木火，不怕己土与金水。'],
  ['辛', '未', '壬', '辰', '未月土旺之辛，再有时元辰土相资，得天原厚，而此际正当三伏，炎署未消，有火暗铄，赖壬相救，苟再透庚坐申，旣可扶辛，以壬？有源，则虽天干见火，亦？足虑，独有戊土出干，则贵格反成贱命。惜哉'],
  ['辛', '未', '癸', '巳', '辛生于未，虽土旺生金，因夏令终是衰地，时？于巳，又是死乡，故非生旺之象，再在伏天，火威足以？金铄石，癸水食神，似可配耳，但此时之癸气亦休囚，故喜巳中庚透，或年支见申，方可免于疵求。'],
  ['辛', '未', '甲', '午', '辛日而遇未月午时，未为衰乡，午为病地，虽云土旺，究嫌其燥，加以甲木生火，虽觉旺土？足以生，旺火反足以毁玉，是须金水并见，一则克木而扶身，一则制火而护金，乃合生克制化之旨矣，木火大忌，因难弃命故也。'],
  ['辛', '未', '乙', '未', '季夏未建之阴金，又遇未时，土旺用事，遂觉生之太过，而虞金埋土重，时干透乙，故喜疏土，但？知木能生火，此际火势愈炽，但愿壬透申藏，则截长补短，吾何间然。'],
  ['辛', '未', '丙', '申', '季夏建未之月，旺土司权，然以三伏炎天，炎上之势尤盛，柔弱之辛金，殊不能与火相对？，丙透时干，与辛相合，克而无伤，矧値申时，辛金乘旺，申中藏壬，可以制丙，以此而论，强弱相当，正官可用，故忌财之坏印，与官杀之制劫，金水为喜，木无大妨。'],
  ['辛', '未', '丁', '酉', '辛生土旺之未提，不为无根，时又？酉，归禄通根，则未中丁火杀透，尙不致身轻杀重，祗以未为燥土，？足以生辛，是宜有水透干，庶丁火七杀有制，所以寅卯甲乙之财，反为大忌也。'],
  ['辛', '未', '戊', '戌', '辛日而又戊戌时，卽非木旺之未月，亦以厚土埋金为忌，所以必有甲木之制戊，庶金不沈埋，？有壬水之制火，则土方滋润，有甲无壬，徒增火焰，有壬无甲，土？动摇，均非佳造'],
  ['辛', '未', '己', '亥', '未中己土透干，以生衰弱之辛金，并有亥时之水，制无形之火，润有形之土，诚然配合得当，苟其柱有庚申，则旺土以泄，弱水有承，衰金得助，是必到老荣华，一生载福者矣。'],
  ['辛', '申', '戊', '子', '辛金生于申月，不旺自旺，时上戊土正印，原非必要，时？于子，子申会出水局，以成金水假伤官，水为秀气，则戊土反嫌？赘，最宜年月见甲，庶去戊土病神，且与伤官身旺喜财之旨合矣。'],
  ['辛', '申', '己', '丑', '辛金乘旺于申月，得令月旺，不宜再来己丑土生，致犯太过之弊，是宜柱有乙卯之阴木，庶己丑有所制，金不被埋，总之以土为忌，以木为药，而用木？宜有水辅之，怕金削之。'],
  ['辛', '申', '庚', '寅', '申月旺地之辛金，？得劫财庚金扶助，身强已极，身旺任财，则时上寅木财星，允堪为用，惜乎寅木为庚所钳制，再被申金所冲破，财有动摇之势，是必壬甲？透，财有所生，而？得禄，始为先败后兴，大富之格，有甲无壬，或有壬戊甲，发？足矣。'],
  ['辛', '申', '辛', '卯', '比肩透出时干，以助乘金之辛金，？以时上卯木财星为用，但书有时上偏财，忌见兄弟之说，除非天干见乙，再得水以泄旺金，生弱木，方可用财，唯总？业辛？，时多波折耳。'],
  ['辛', '申', '壬', '辰', '孟秋申月之辛，金气正盛，申中所藏壬水高透，是名金水眞伤官，锺？毓秀者也，虽壬水自墓于辰，但因申辰会局，仍能源远？长，其余干支，以有水木为美，火金皆无关系，独忌戊土而已。'],
  ['辛', '申', '癸', '巳', '辛金生于申月巳时，巳与申合，时逢癸水，是名金水假伤官，怕戊己出露，以碍其水，最喜庚金及木，则食神大喜劫财乡，而又身强任财，养命有源矣。'],
  ['辛', '申', '甲', '午', '申提当旺之辛金，力能任财任杀，所以时逢甲午财杀，固是旺金之喜者也，但若水不透干，则杀无所制，财无所资，犹为缺点，必也壬癸当头，则成时逢一贵，富贵无疑矣。'],
  ['辛', '申', '乙', '未', '而当旺之辛金，再遇未时生之，颇有太过之嫌，乙木高透，以制生身太过之印，惜乎秋木不繁，务须食伤之水，以辅失令之乙，斯为美耳，见火则当别论，见金与土，均非美满。'],
  ['辛', '申', '丙', '申', '丙与辛合，妙在月时皆申，申为水之长生，可作化水论也，但旣为化格，柱中只可见金水，倘得见木火与土，便不能化气推，有木火以财官为用，多土金则无足取矣。'],
  ['辛', '申', '丁', '酉', '辛金得禄于酉，乘旺于申，气旺则宜泄克，时干丁火相克，然以一丁而与当旺之金周旋甚难，故宜木以生丁，秋木无根，还喜壬癸佐之，印绶比劫，不宜再见。'],
  ['辛', '申', '戊', '戌', '旺令之辛，时逢戊戌，申金相助，戊戌相生，生旺极耳，惟以辛乃阴干，从势而无情矣，但敎申中壬透，便取伤官，然须甲木克戊为贵，假使戌中丁火出干，则当用杀，亦因印多，有木为？。'],
  ['辛', '申', '己', '亥', '申月旺地之辛，再有己土印生，卽非太过，已甚生旺，好在时？亥水伤官，大喜亥中壬甲？透，则身旺伤官喜财，而有金谷铜山之富矣，有水而再有金不忌，水木大喜，火则须视配合如何，土则断乎不宜。'],
  ['辛', '酉', '戊', '子', '辛金生于酉月，酉为辛禄，日元当旺，时干戊土，正印生身，致犯生旺太过之弊，子水时元，名虽长生，却可疏导旺金，所以喜子水，畏戊土，必得年干有甲，方为上格，大怕柱中再见土金，必较见火为？每下愈况矣。'],
  ['辛', '酉', '己', '丑', '酉月建禄之辛金，不喜生扶，时逢己丑，干支纯为湿土，则如宝钗生尘，因潮润为愈污浊，土多之病，？当以木为药，然见甲则防合己，逢乙则乙絶于酉，毫无用处，最好多水为之冲洗，庶尘土去而金光灿矣。'],
  ['辛', '酉', '庚', '寅', '辛日酉月，再见庚劫，其气极盛，原喜以财为用，然而时支寅木，为庚金所压迫而分夺，财星受损，故宜干支有水，泄旺金而生弱木，得其缓冲于金木之间，而弊絶风淸，岂不妙哉。'],
  ['辛', '酉', '辛', '卯', '酉月辛金，日通月气，十分生旺，时逢辛卯，卯虽可喜，而辛金比肩，犯建禄之忌，且卯为阴木，絶酉逢冲，众金戕贼，犹如败柳残花，能有一火以克金，再有一水以生木，亦败中有成之命。'],
  ['辛', '酉', '壬', '辰', '八月酉建之辛金，逢时元辰土正印，犯生旺之忌，幸得壬水透干，伤官毓秀，金水相通，骏发之造，大忌戊土，有戊必须甲木，或不见戊而见甲，皆？，比劫之中，不忌申金，见火非宜。'],
  ['辛', '酉', '癸', '巳', '辛金建禄于酉，时遇癸巳，巳虽属火，却系金之长生，巳酉会局，辛金生旺，喜癸水食神之透，金水相漱，秀气所种，大忌戊己出干，便是浊而弗淸，丙丁二火见一为贵，东方之木，断无不喜，支遇亥子，乃纯粹之食神格矣。'],
  ['辛', '酉', '甲', '午', '书云建禄之格，大喜财官，酉月辛干，而时遇甲午财官，洵是贵命，最好壬癸见一，使秋木得所生，七杀有所制，定作寒门贵客，？以建禄之命，大抵遗产难承者也。'],
  ['辛', '酉', '乙', '未', '酉月未时，辛金有生有助，颇觉太过，幸尔未中乙透，财以养命，木以克土，合于建禄不宜身再旺，惟喜茂财源之说，定为富命，所惜者，尙觉秋木无根，地支宜有亥水，？胜壬癸透天矣，比劫大忌，印亦非宜。'],
  ['辛', '酉', '丙', '申', '辛金通根于酉，乘旺于申，申为水之长生，故有作为丙辛化水者，？知月令在酉，可化金而不可化水，论命最重月气，故此条祗可用正官，若见壬水，则须有木以泄水，如戊己之土不见为佳，切莫拘泥有官须有印之说也，'],
  ['辛', '酉', '丁', '酉', '酉月辛金名建禄，酉时辛金曰归禄，禄诚多矣，时逢丁火独杀，奈何无制无根，须有水木为配，差可增高地位，大怕再有土生金助，并将水木之效用削弱。'],
  ['辛', '酉', '戊', '戌', '戊戌正印生金，戌土又辛之冠带，纵非生于酉月，亦虑其太过，太旺宜疏不宜克，然若见壬泄金，则壬水被戊土克制，恐难显其本能，故有壬尤要有甲，庶戊土不敢侵壬矣，火与土金，皆不可参杂。'],
  ['辛', '酉', '己', '亥', '辛金得己土生身，再有酉月建禄，当旺之时，虽阴柔之金，却亦甚强，时？亥水，金水有相涵之妙，如得亥中壬甲？透，富贵可以操券，见火不忌，然当改用财官也。'],
  ['辛', '戌', '戊', '子', '九月建戌，土旺用事，辛金此际已甚有根，不应戌中戊土出干，致犯金埋厚土之弊，虽子时为水，不能洗刷土中之金，况为旺土所克乎，必须甲木之透，支逢亥水，或透壬癸，俾伤食生起财星，大富之格。'],
  ['辛', '戌', '己', '丑', '辛金诞于九秋，土旺金相，不喜再有土金生扶，不免蹈太过之病，兹其时逢己土，以增土势，遂使白璧明珠，沉埋厚土，苟使救以甲木，则有合己之嫌，不如有壬水冲去其土，以显其旺，阴木虽喜，惜为效太微耳。'],
  ['辛', '戌', '庚', '寅', '季秋辛金，母体刚健，再有时上庚金相扶，反似畵蛇添足，时？寅木财乡，似疏旺土，然因寅戌会而生土，仍然无用，必得阳水以济火，阳木制土，地支再有亥水，乃必发之命。'],
  ['辛', '戌', '辛', '卯', '辛日辛时，已非孤单无助，矧在九秋旺土之时，生旺甚矣，时虽値卯，旣受辛金之剥削，而又卯与戌合，絶无效用，须水木之并露，则财得通根矣，大忌土金，火亦弗喜。'],
  ['辛', '戌', '壬', '辰', '戌月之辛金，又生辰时，正印重重，故有埋金之虑，幸尔辰与戌冲，土性虽厚，尙得？动，所以时上壬水伤官，足以冲刷其土，洗净辛金矣，有甲？妙，苟使支逢申亥，？觉精神百倍，'],
  ['辛', '戌', '癸', '巳', '辛金生于戌月土旺之时，时支巳火，为旺土之禄，火以晦而土？厚，一点癸水食神，？足以淘洗辛金，如以木疏土，则有生火之嫌，若以金生水，则犯幇身之忌，祗有以水助癸，为最适矣。'],
  ['辛', '戌', '甲', '午', '辛日而生戌月午时，午戌会局，并有甲木生杀，虽旺相之辛金，亦不免望火以生畏，故以干头有水，为必要条件，果见水，则虽杂以土金，亦无大妨，惟不可再逢木火。'],
  ['辛', '戌', '乙', '未', '戌月未时，适当土旺，辛金之柔，忌其沉埋，致犯母慈灭子之患，必须木来相救，然因秋木凋？，乙木得水之滋漑，则菊有黄花，以点缀其三径，切弗同类幇身，亦怕火土。'],
  ['辛', '戌', '丙', '申', '辛生申时为乘旺，诞于戌月値冠带，生旺之金，无畏乎丙，惟丙辛虽合，不能化水，但又用官，若其申中壬水出干，则壬以洗之，丙以耀之，迎眸生缬，咸知珠玉在前，瓦砾自惭形秽。'],
  ['辛', '戌', '丁', '酉', '辛金日主，时？于酉，归禄通根，生在旺土之戌提，日元殊健，戌中藏丁，出露时干，以杀为用，灯光之下，堕珥遗簪，弥觉华贵，惟年月天干，以水木俱备，乃为上格，火则已足，土金无需乎尔。'],
  ['辛', '戌', '戊', '戌', '辛金而遇戌月戌时，已足将辛埋没，何况戌中戊土，又透时干，如此印绶重重，确是母慈灭子，是须壬水以冲之，甲木以疏之，否则毫无用处，如再见金，则身旺无依，倘有火则旺土愈厚，皆枘凿也。'],
  ['辛', '戌', '己', '亥', '辛为柔金，时透己月坐戌，亦有埋金之虑，好在时逢亥水，为木之长生，水之禄旺，余柱有水木，是为优秀之命，官杀与比劫，虽不大忌，究以不杂为佳。'],
  ['辛', '亥', '戊', '子', '辛为阴金，喜水洗濯，则不染纤尘，兹生亥月子时，子虽长生，究以食伤夹杂，泄气为嫌，所以时上戊土正印，抑旺水而资弱金，恰到好处，年月之上，苟再见一位丙丁，尤为可喜，惟旣伤官配印，则甲木财星，？应忌见矣。'],
  ['辛', '亥', '己', '丑', '辛生亥月，寒水之气初生，弱金之力暗泄，时逢己丑二土，似可相救，然己丑土等于泥淖，寒湿过甚，最喜太阳丙火出干，参以一位阴木，以制阴土，而泄水分，则辛金转得温和润泽矣。'],
  ['辛', '亥', '庚', '寅', '亥月辛金，伤官泄气，喜得时逢庚金助之，遂有力量，任受寅木之财矣，寅与亥合，当旺之亥水仍健，不可再逢木火，火土少则不妨，但不及比劫为佳。'],
  ['辛', '亥', '辛', '卯', '辛金日主，生于亥月卯时，水旺木相，亥卯又会木局，未免财旺身衰，得辛金比肩以扶之，差堪振作，惟力量尙薄，假使干支及暗藏再见木火，自非佳格，独喜阳金，而土则无可无不可。'],
  ['辛', '亥', '壬', '辰', '辛日而生亥月辰时，伤官毓秀，时地支辰土，固是印绶，但辰属辛壬之墓库，当令之壬水，不忌入墓，柔弱之辛金，休囚是惧，所喜丙丁得透其一，以生辰土为妙，惟弱见丙，余无土杂，则成丙辛化水之格，亦富贵絶人也。'],
  ['辛', '亥', '癸', '巳', '亥月而时干透癸，辛金日主，相涵相漱，卽为秀气所种，时？于巳，虽与亥冲，然得亥中甲木，暗生其火，不致熄灭，辛得温润矣，忌戊合癸，己克癸，致水浊而不淸，木火以见一位为贵，金则弗厌其多耳。'],
  ['辛', '亥', '甲', '午', '月令在亥，为甲木之长生，辛日逢之，养命有源，但以水旺气泄之辛金，力薄不能任受，岂可再以午火胁之乎，是必见庚或申，努力扶助，以削木而抗火为美，至于印绶之土，虽可生金，但怕减低水之秀气耳。'],
  ['辛', '亥', '乙', '未', '亥月辛金，时？乙未，未虽属土，而是木库，未中乙木旣透，亥未再会木局，几乎满盘皆财，若柱无比劫，及火土，纯为水木，则成弃命从财之格，因妻致富成家，否则见土仍无用，见火则？弱，惟喜比劫之金，以分任之。'],
  ['辛', '亥', '丙', '申', '丙与辛合，节屈初冬水旺，时？于申，又是水之长生，似可合而化水，然亥月水旺木相，丙火絶处逢生，不是眞化，应从强弱方面消息之，按辛金旣被水泄于前，又为火制于后，申虽幇身，犹觉不够，最好庚透年干，或日坐酉禄，方可调和。'],
  ['辛', '亥', '丁', '酉', '酉时辛日，归禄通根，纵生泄气之亥提，而金气仍全，丁为阴火，多则炉冶伤辛，少则九微耀彩，况此际之丁火，不能肆其威力，允是伤官假杀之格，倘再透壬合丁，？胜土来泄丁百倍，木则宜少忌多，火则大怕再见。'],
  ['辛', '亥', '戊', '戌', '亥水月令，卽辛金之秀气，时逢戊戌，干支纯为阳土，几将水之秀气夺尽，故当以土为病，但若治之以木，不如医之以金，？以木虽克土，而亦可以泄水，远不及金之泄土生水，犹陈仓之暗度耳。'],
  ['辛', '亥', '己', '亥', '月亥而时亦亥，辛金値之，卽是伤官重逢伤官，时干己土为湿泥，及一般之辛金所不喜，独是条以伤官太过而用之，犹独中无大将，廖化作先锋，所以大怕水木再见，若得一点之火，生起己土，则功力悉敌矣。'],
  ['辛', '子', '戊', '子', '辛金生于子月，泄重有生，以其珠玉生于蚌，蚌产于水也，今则时又见子，而节序则在大雪冬至之后，寒气甚盛，珠将被冻，所乏戊土正印，足以克水生辛，但虽水有所制，而寒气犹存，则或丙或丁，得透其一，定成伟人，木乃忌神。'],
  ['辛', '子', '己', '丑', '子月水旺之时，辛金泄气，时逢己丑，子丑皆为北方，己土纵透干，亦觉拖泥带水，掩盖宝气珠光，是须壬丙？透，以壬水冲刷之，丙火以温煦之，再加一点阴木，克己丑之土，则成百脉贯通矣。'],
  ['辛', '子', '庚', '寅', '辛生于仲冬子提，子为辛金之食神，徒具长生之名，而其实盗气，时干庚金，幇扶有力，所谓食神大喜劫财乡，辛金旣不为弱，则有力以任寅木财星，洵系富厚之格，不可再有比劫夺财，或则有火以泄木。'],
  ['辛', '子', '辛', '卯', '辛日而値辛时，同类扶助有情，月提子水，以生时上卯木之财，可以致富，惟忌比劫，所谓时上偏财，忌见兄弟，除非天干透乙，地支有亥，财亦甚盛，再见比劫亦无所畏，盖通根之财，犹寒梅着花，而非薄飘水面矣。'],
  ['辛', '子', '壬', '辰', '仲冬建子之月，壬水伤官，透而乘旺，虽壬？于辰，旺水归库，但因子辰会局，仍是一派汪洋，况辛金亦墓于辰，势必金沉水底，必得阳木以泄之，阳土以障之，乃免偏枯之患，否则不见一点土木，而独丙火透干，为眞化水，亦润下格，贵不可言矣。'],
  ['辛', '子', '癸', '巳', '辛日癸时，月提在子，癸水食神，通于月气，其秀非凡，时逢巳火，可去金寒水冷之病，虽巳为戊禄，然亦为金之长生，故无伤乎癸水，独忌年月有土，则如奕之失一子而全盘空矣，最好有金，木亦无碍。'],
  ['辛', '子', '甲', '午', '辛生子月午时，子午冲而火水未济，然因甲木透天，承水生火，仍是时上一位贵格，辛金旣被泄于月令，又受克于时元，柔弱甚矣，故最喜戊己，初不患其渴水埋金也。'],
  ['辛', '子', '乙', '未', '辛金虽为子水盗气，却得未时生之，日干不为无气，乙木偏财出干，有子水之资，木亦有根，藉以抑制枭神之夺食，五行分配，颇具中和，苟再辅以比劫，尤觉日元有力矣。'],
  ['辛', '子', '丙', '申', '丙与辛合，而逢子月申时，子乃水之旺乡，申又水之长生，子申会局，卽白虎备润下之水，旣富且荣是也，倘再年月透壬，年支坐辰，其贵？甚，若见戊己，则源淸成？浊，终身贫贱飘泊矣。'],
  ['辛', '子', '丁', '酉', '子月水盛金衰，辛金虽润欠温，虚而弗实，妙在丁酉时，丁火祛寒，酉金通气，配合殊佳，尙有四字，以五行言，阳水不忌，但畏癸水，见木则配以金，有土则杂以木，庶得之矣。'],
  ['辛', '子', '戊', '戌', '失令寒冷之辛金，固不妨正印以生之，但因戊戌纯土，势将埋没辛金，遏制子秀水气，故土厚过分为虑，最好岁月甲透，以为土病之药，或则比劫泄土扶水，则亦病药相济。'],
  ['辛', '子', '己', '亥', '月令子水，时元亥水，区区失令柔脆之辛金，不胜食伤之盗泄，则己土枭印，亦佳借着，但因天寒地坼，湿泥冻结，故必辅之以火，俾土气融化，金水温润，阴木最忌，水亦弗宜。'],
  ['辛', '丑', '戊', '子', '辛金生于丑月，己土枭印司权之日较多，时逢戊子，戊又正印，生气不薄，何妨子水食神，以泄辛金之秀，然而时序严寒，不有丙丁之出干，终觉索然无生气，但见丁火，还须有木生之，不及天然之丙火为高，金水二者，宁可不逢。'],
  ['辛', '丑', '己', '丑', '丑月辛金，土旺金相，时再己丑，土厚金埋矣，以土为病，以木为弱，但甲木畏己合，远逊乙木，倘能？坐寅而见丙，或月透丁火，日坐卯木，虽非上选之根，亦不属于中下。'],
  ['辛', '丑', '庚', '寅', '辛生季冬，己土用事，辛金有根，益以时上庚金扶助，日元不弱，则时支寅木财星，允是命中瓌宝，盖？但疏土而养命有源，兼系火之长生，土暖金温矣，若再坐于巳火，或丙火透，定然门充驷马，富贵絶伦。'],
  ['辛', '丑', '辛', '卯', '丑月土旺用事，辛金不愁无气，时又逢辛，身旺足以任财，然而卯木无根，又受比肩挟制，最好有火制金，又日坐于亥未，庶几木气健全，寒冬转暖，顿呈繁华气象矣。'],
  ['辛', '丑', '壬', '辰', '丑月又値辰时，丑为北方，辰为水库，所以皆为湿土，辛金有埋没污浊之虑，时干见壬，似可荡涤泥土，显露辛金，奈以季冬之月，正値严寒，水土冻结，成为氷块，故必丙火祛寒以融化之，辅以疏土生火之寅卯，？其出色惊人。'],
  ['辛', '丑', '癸', '巳', '丑中藏己土辛金癸水，辛金生丑，癸水出干，虽不透己，而已在旺令，则土与金水无不上下之气相通，？喜巳火散寒，巳丑会而幇扶，苟生丙岁，则官星得禄为用，若无丙而坐子，则为食神得禄有气胜财官矣，然不问为食为官，木终所喜。'],
  ['辛', '丑', '甲', '午', '丑月天寒之节，虽云土旺金相，亦有寒土不生之虑，所以丑月辛日，喜有木火调和也，兹则时逢甲午，以疗水？金寒之病，如再年日坐亥，或干壬癸，是必富堪敌国，贵压百僚矣。'],
  ['辛', '丑', '乙', '未', '丑月未时，丑为金库藏辛，未为木库藏乙，以丑未之冲，辛日逢乙，乃是身旺财豊，库开必发之命，独忌见金，致比劫夺财，火则喜其温暖，水则喜其生木，但皆以少为贵耳。'],
  ['辛', '丑', '丙', '申', '寒？之辛金，时逢丙申，旣喜丙之御寒，？宜申之扶助，但月支在丑，己土正旺，颇觉火力不强，是宜其余干支之中，配以木火，庶几无疵可求，卽地支见寅巳，而犯刑冲，亦弗忌焉。'],
  ['辛', '丑', '丁', '酉', '辛日酉时，归禄通根，生当丑月，土旺用事，酉丑会局，以助辛金，确乎生旺，？喜丁火之透，以去萧索之气，寒土暖而能生，？金温而耀彩，如再有木生丁，断无不发，独忌阴水，土金亦非所需。'],
  ['辛', '丑', '戊', '戌', '辛金而天干见戊，地支月丑时戌，重重印绶，有慈母害子之嫌，是必甲木制戊，并须日坐于亥者，方成有病有药之佳造，若无甲亥？者，则必生性顽愚，终身？苦无疑。'],
  ['辛', '丑', '己', '亥', '月令丑中己土透出，以生辛金，日元可谓生旺，时？于亥，虽有淘金涮土之功，而亦增其寒？为嫌，所以余柱必须有火济之，而阴火？宜有木，否则不及丙火太阳之有效也，土非所宜，金亦不喜。'],
  ['壬', '寅', '庚', '子', '壬为阳水，生于寅提。木旺火相，时逢庚子，庚为生身之印，子为幇身之刃，此犹春氷解冻，化作巨流，虽有寅木泄水，力尙不够，必也，寅中戊土当头，始成贵格，倘再见丙，旣贵且富矣。'],
  ['壬', '寅', '辛', '丑', '壬水生于？寅月，寅为壬水之病地，得时干辛金生之，气势转强，时？丑土，在此际不关痛痒，因丑为北方，成为湿土，初春寒气未除，难其化学作用，最好寅中丙戊并透，？失为优越之造。'],
  ['壬', '寅', '壬', '寅', '壬水遇寅月寅时，食神盗气甚深，喜时上比肩助之，但壬水旣病于寅，则？壬不及？寅之强，还须比劫幇身，庶可均衡局势，惟若以寅为用，则阳金忌见，阴金无妨。'],
  ['壬', '寅', '癸', '卯', '壬生寅月，木旺司权，又遇卯时，泄而又泄，所以时干癸水，喜得幇身也，但寅衰病之壬癸，虽胜当旺之寅卯，犹病母之？盆，非大补不为功，所以阳水生扶，诚必要耳。'],
  ['壬', '寅', '甲', '辰', '寅月壬水，寅中甲木，得透时干，食神得禄，木愈秀而水愈衰，是宜干见金，俾其泄土制木，并生起壬水，惟庚申阳金，不及辛酉阴金，恐损食神故也。'],
  ['壬', '寅', '乙', '巳', '初春建寅之月，木旺火相，时逢乙巳木火，乙旺于寅，巳生于寅，壬水日元，被泄而不能任受其财，最宜年月见金相生，方克势均力敌，不可再见木火及土，惟比劫之水，其所喜直与金等。'],
  ['壬', '寅', '丙', '午', '壬日値丙午时，偏在？于旺地，时在孟春建寅之月，乃丙火之长生，寅午又会火局，使壬水生气毫无，倘不见官杀之土，生身之印，幇扶之水，祗有木火，则是弃命从财，大富之格也，否则必须金水相救，木火土为忌神矣。'],
  ['壬', '寅', '丁', '未', '丁与壬合，生当旺木之寅提，时元又値木库之未土，假使余柱，不杂一点金与土，乃丁壬化木之命，若以强弱而论，则壬水究为无力，年月以有金水生扶为？。'],
  ['壬', '寅', '戊', '申', '壬水虽生病地之寅，然値长生申时，不为无力，戊土透干，以杀为用，但照时令而论，还须金生水助，木虽可以制杀，而弱水不宜再泄，至于火土之当避，不言可喩矣。'],
  ['壬', '寅', '己', '酉', '孟春之壬，以得生扶为宜，时逢于酉，正印相生固佳，但此际亦属力薄，所以天干之上，还喜见金，则弱水有源，？以时干己土，究克壬水，苟其金不透干，则己土专克其水，而无所泄化耳。'],
  ['壬', '寅', '庚', '戌', '壬日而又寅月戌时，寅戌会火局，财旺身衰，喜得庚金印生，增长壬水？量，然而消息于轻重强弱之间，犹是木火盛于金水，故仍宜有金水，为之生扶，木火与土，？所不喜。'],
  ['壬', '寅', '辛', '亥', '壬水日干，时逢辛亥，辛金正印资生，亥水日禄通气，纵在寅月木旺之时，寅亥又合，亦不以泄气为嫌，其余干支，如见土木，则还要有金，倘有火则仍当见水，方期中和。'],
  ['壬', '卯', '庚', '子', '壬水日干，生于卯月，壬死于卯，木泄弱水，非得生扶不可，时遇庚子，庚金为之源，子水为之流，源远流长，壬水转弱为强，所以余柱须木以泄秀，有火则富，土则喜戊不喜己，以戊土成杀刃相济也。'],
  ['壬', '卯', '辛', '丑', '卯月木旺水死，壬水休囚，时逢辛丑，辛为正印，丑虽官星，而为金库，位居北方，故以官印为用，切忌干透丙丁，以伤辛金之印，木虽弗忌而宜少，金水力薄不嫌多，土少不妨，以其生起辛金耳。'],
  ['壬', '卯', '壬', '寅', '壬水旣病于时元之寅，又？死于月提之卯，颓唐已极，虽时干透壬，相扶有情，但同病祗有相怜，不能为力，必须柱中有金，以发壬水之源，则逢申酉相冲，亦是喜而不忌，不可再见火土，使壬水不胜应付。'],
  ['壬', '卯', '癸', '卯', '日干壬水，生卯月卯时，死地重逢，絶鲜？量，虽癸水劫财相扶，亦以泄气，以幇身徒具虚名，故若有金相生，乃伤官佩印，大忌见火，皆财能坏印，有？根断源消，木土亦忌之。'],
  ['壬', '卯', '甲', '辰', '壬日卯月，伤官泄气，何堪时又甲辰，卯辰会东方，甲木胜旺于卯，几乎全盘皆木，然若四柱无金与火土，则为从儿贵格，倘有一点火土，参杂其间，则须庚申之阳金，削木生水，方是有病为贵之造。'],
  ['壬', '卯', '乙', '巳', '壬水生卯月，卯中一木，透出时干，伤官得禄，时支巳火，虽为财贵，柰身主不能胜任，最好巳中之庚出干，不但壬水絶处逢生，且乙庚相合，以阻其泄壬水之气矣，木亦不宜。'],
  ['壬', '卯', '丙', '午', '仲春卯月，木旺火相，此时之壬，当然失令，时遇丙午，偏财任旺，致无根之水，祗有弃命从财，但必？月皆火，？无一点土与晦火，方为眞弃眞从，否则须有大量之水幇扶，辅之以金，亦富豪之造。'],
  ['壬', '卯', '丁', '未', '壬日未时，月令在卯，卯未会局，时干透丁，丁与壬合，是乃化木格，惟余柱祗可见木，方为眞化，否则须赖金以生之，水以扶之，始克用取伤官生财，然弗论从火或用伤财，官杀之土，从忌见也。'],
  ['壬', '卯', '戊', '申', '壬生中春，卯木伤官相泄，时？申位，长生相资，申金又承戊土生之，以成偏官偏印之格，皆戊有卯制，七杀有制为偏官也，其它干支，如见木火，则以金水配之，？为美满矣。'],
  ['壬', '卯', '己', '酉', '壬水泄于月令之卯，生于时元之酉，一泄一生，虽逢冲而铢？相称，己土官透，生其所坐之酉，再受卯木威胁，可置官星于不论，则使柱有火土，仍以印绶之金，为命之精华也。'],
  ['壬', '卯', '庚', '戌', '壬水命元，时？火库之戌，月在火相之卯，卯戌？合，纵有庚金，亦遭火煏，灭弱生水之力矣，不宜木火，固不待论，唯土则畏戊之克壬，而喜己之生庚，宜辨别之。'],
  ['壬', '卯', '辛', '亥', '卯月死气之壬，而时遇辛亥，正印与日禄生扶，几有反弱为强之势，祗以亥卯会局，而此时辛値絶地，所以生扶之效用，几等于？，还宜再来金水，以振作辛壬之气，木火与土，愈少愈妙。'],
  ['壬', '辰', '庚', '子', '壬水生于辰月，厚土壅？，而水不流畅，卽是弱象，或谓壬水大海，无身弱之说者，须知石烂海枯，海虽大而能枯，焉能必不谓弱哉，好在时逢庚子，庚之源，子之流，不啻昆仑，江河所从出，而汇于大海，反弱为强势将 横决，必得一戊，作之堤防，乃以杀为用，刃杀相济之佳造也。'],
  ['壬', '辰', '辛', '丑', '辰月土旺，壬水休囚，再値丑时，虽丑辰皆湿土，亦足以制弱之壬，幸而时干辛透，印绶相生，使壬水有气，如年月再有一木疏土，尤为美满，如无木疏土，则须有柱有庚申，以泄旺土，亦？得已而求其次之道也。'],
  ['壬', '辰', '壬', '寅', '辰月库中之壬，水源被旺土所？，则时之寅，洵足以启其闭？，使水？通，况又比肩助之，等于？汇交流乎，如再有金，水有所承，而土有所泄，使？美矣，忌戊己而不忌木火。'],
  ['壬', '辰', '癸', '卯', '壬水日元，死于卯而墓于辰，纵有癸水，补助力微，须赖金生，否则等于停留之死水矣，然若坐寅透甲，东方一片秀气种之，其它不见一点土金，则取从儿格可也。'],
  ['壬', '辰', '甲', '辰', '壬値辰月辰时，旺土相克，杀重身轻，甲木透于时干，纵能克制旺土，但亦盗泄水气，有欠十全，必也，柱中有金，则弱水可生，厚土以泄，甲木虽与对敌，但因三春之木，金所不能刬尽根株也。'],
  ['壬', '辰', '乙', '巳', '三月土旺之壬水，源流被？，辰中藏乙，得露时干，可以疏水道而导海流，惜乎时？巳火，受乙木之生，而转生土，增厚土质，助虐为虑，所以最喜年日坐申，不但壬得长生，或见金透，旺土泄气，而又巳与申合，木为金制，火旣无所禀承，则太过之土，亦不获逞矣。'],
  ['壬', '辰', '丙', '午', '季春土旺用事，壬水生此，水为土掩，干涸可虞，岂宜再逢丙午纯火时元，以生旺土，苟在年月上有土而无金水木，追之弃命从杀，反以火土为喜，水木为忌，如以辰月而不作从格论，则非大量金水生扶，定必眞穷似富矣。'],
  ['壬', '辰', '丁', '未', '丁壬虽合，惜乎辰月土旺之时，虽曰木有余气，究竟合而不化，况又未时，未土亦旺，故如上造丙午时？论相同，必须并见金水，则水有所生，土有所制，尤须水多于木，为先决条件，否则还是身弱。'],
  ['壬', '辰', '戊', '申', '壬水生辰提，辰中戊土出干，身衰杀旺，好在时落于申，为壬水之长生，辰余申又会局相助，格为杀印相生，而其身杀两强之妙，如再干头见甲，直接制旺杀，更是十全，降格以求，则以庚易甲亦可。'],
  ['壬', '辰', '己', '酉', '辰月酉时，辰酉？合，土势从金，壬水休囚，相得生气，所惜时干己土，终觉赘疣，是宜以金泄之，或有乙木伤之，乃全中和之道，大怕见火，以及阳木，防火资土而甲与己同化耳。'],
  ['壬', '辰', '庚', '戌', '壬生于辰，乃少年不发库中人之象，时逢庚戌，辰戌相冲，所谓墓库逢冲必发，又有庚金，以为壬水之源，因是杀印相生格也，惟考时令，终觉土旺而杀重，所以火土为尤忌，金水为喜神，佐以一点之木，则美不胜收矣。'],
  ['壬', '辰', '辛', '亥', '辰月库中之壬水，最喜辛金之透，俾衰水有所生，旺土因以泄，况又时？于亥，乃壬水日禄之乡，大可反弱为强，假杀为权矣，故金水不必再见矣，木火宜少，土则独戊一虁已足。'],
  ['壬', '巳', '庚', '子', '壬水生于巳月，火旺土相之时，故壬絶于巳，时遇庚子，巳中庚透，印値长生，壬水已非无气，加以时？子水，为壬之旺乡，因而反弱为强，不忌巳中丙戊，但不可多见火土，若戊土独透，则木之制杀，为不可少矣。'],
  ['壬', '巳', '辛', '丑', '巳月火旺土相，壬水逢絶地，时？于丑，丑中辛金正印透出，已可絶处逢生，况巳丑亦会局生壬乎，不忌戊土，以能生金之故，独忌丙火透干，盖与辛相合，定为失恃之儿，若见丁直接克辛，反不甚忌，因丁被壬合也。'],
  ['壬', '巳', '壬', '寅', '巳月壬日，时壬寅，壬病于寅，絶于巳，则有时上比见幇扶，亦无？量，必须巳中庚金出露为上，否则纵使年月比劫重重，亦犹一群？弱残兵，不经一击，此条关键，全在庚之有无，最忌土木。'],
  ['壬', '巳', '癸', '卯', '壬水生于初夏，火土旺相，时逢癸卯，卯木生起旺火，财多身弱，固喜金水生扶，但时干之癸，乃是阴水，同被木泄火煏，故与上条壬寅时论相同，亦须有金，乃成贵格，不过透庚则忌丙，见辛总畏丁耳。'],
  ['壬', '巳', '甲', '辰', '火旺土相之巳月，再逢甲辰时元，甲虽疏土，亦虑其泄壬水，生旺火也，如余柱有火土，无金水，贫夭之命，盖辰为壬库，故不能从财杀，最喜大量之金水。'],
  ['壬', '巳', '乙', '巳', '壬水日元，生巳月巳时，？逢絶气，盖以乙木相泄，而生当旺之火，无根之水，亦惟弃命从财耳，如从财不能澈底，必也，年月透庚，地支或逢申亥，成财命有气之造，富亦可期。'],
  ['壬', '巳', '丙', '午', '壬水生于孟夏，火气日进，水势？于垂絶之地，其所？絶如？者，仅有巳中藏庚暗生，今以时为丙午，火旺已极，非得壬庚透而坐子申不可，否则金水毫无，祗有木火，是诚弃命从财，为入赘齐髡。'],
  ['壬', '巳', '丁', '未', '丁与壬合，财来取我，时令旺火，故不化木，时値未土，质虽土而位于南，巳未拱午，财旺身衰，必须比劫之助，以分财力，而轻壬水责任，但比劫尙嫌无根，还要有金生水，始为贵耳。'],
  ['壬', '巳', '戊', '申', '壬水在巳月为絶地，遇申时为长生，是眞生逢絶地矣，但戊土透杀，得禄于巳，纵巳申合，亦难使土之压力减低，必须生于庚年，则为辛月，金气生旺，或壬水自坐于子，方许权威盖世。'],
  ['壬', '巳', '己', '酉', '壬日酉时，正印生身，月令在巳，巳酉会局，己土虽制壬，然因生金之故，不致克壬太甚，所谓贪生忘克，由是以断，则财官未尝不可为用，切忌见木，不但生火制金，且官星亦被所伤矣。'],
  ['壬', '巳', '庚', '戌', '巳火月建，固是壬水絶地，然巳为庚金之长生，庚透时干，壬水絶而？续矣，时元之戌，本质为克水之土，且是火库，于是火土凭生旺之势，以？轹壬庚，因而财杀旺于日主，须年月曁日支，再得金水生扶，以平衡之。'],
  ['壬', '巳', '辛', '亥', '壬日而逢巳月亥时，亥为壬禄，遂与旺火相济，至云无根之水，不胜火力者，幸有时上辛金正印为之辅救，故年月之间，不怕再见财官，壬日辛时，如遇丙年癸月，又年申日寅者，诚絶？？群矣。'],
  ['壬', '午', '庚', '子', '午月火盛已极，壬水当然力薄，但因时値庚子，有庚金母体相生，子水旺气为助，大可转弱为强，其余？干？支，但敎？全是火土，则壬水终有？量，以任财官或独戊透出，卽不见木，亦不妨矣。'],
  ['壬', '午', '辛', '丑', '壬水生于午月，火旺土相，时逢辛丑，丑虽克壬，然为北方，又是金库，丑中辛透，印绶相资，序配五行，颇具中和之槪，祗敎不犯丙丁，使辛金保全为第一义，其它如金水固喜，卽土木，亦未必为忌。'],
  ['壬', '午', '壬', '寅', '壬日壬时，比肩相助有情，时？于寅，食神盗气，与月令午火会局，颇具水火旣济之象，惟总喜金，则水有源，其余干支，有木火，亦须配以金水，否则使不平均，至于官杀之土，终于不见为妙，借曰不能，则应以印绶启承之。'],
  ['壬', '午', '癸', '卯', '午月之壬，水衰火盛，时逢癸卯，癸虽同类相扶，但卯木泄弱水而生旺火，究尙木火有余，壬癸？足，最好得见庚申辛酉，则壬癸有源，木火势抑，而平衡矣，大忌再逢火以克金，土以克水，木以生火。'],
  ['壬', '午', '甲', '辰', '壬生午月，正在火炽之候，时逢甲辰，甲木生火，午火生辰，无源之水，岂能调和，故宜年月金水生扶，倘柱中？有木火与土，则身弱可虑，决非奋发有为之辈。'],
  ['壬', '午', '乙', '巳', '巳时午月，再有乙木，生旺火，此时之壬，衰弱已极，全仗巳中一点庚金，为返魂之香，但庚藏不露，犹觉畵餠充饥，必须出露干头，或日坐于申，方克以抑其有余，补其空虚。'],
  ['壬', '午', '丙', '午', '月午时午，卽无丙火透干，壬水已不能任受其财，何况时又见丙，祗有弃命从财，乃余柱反喜见木火而忌金水，如见土，便当从杀不从财，若欲有力任财，则惟有庚年壬月，地支再子申耳。'],
  ['壬', '午', '丁', '未', '火旺土相之午提，丁壬虽合不化木，丁禄于午，正财得禄，午与未合，南方之势？横，无根之壬，何能与火相济耶，柱中金水毫无，倘重见丙火，支坐寅戌，从财并无疑义，否则祗喜重重金水，亦有病得药之理也。'],
  ['壬', '午', '戊', '申', '壬日而値戊申时，杀印相生，但月令在午，为戊土之旺气，而申金虽系壬水长生，因受午火威胁，其生水之力以减，必须庚透干头，则庚禄居申，并泄戊土，而克和谐矣。'],
  ['壬', '午', '己', '酉', '午火月令，丁己同宫，时値己酉，己土得禄于午，生起坐下酉金，壬水日干，成为财官印生，但酉畏午之虎视，必须辛金出露，得禄于酉，印绶方能有力，如有得地通根之水，亦甚需宜。'],
  ['壬', '午', '庚', '戌', '时上庚金，生起日主壬水，但时？于戌土火库，与月提之午火会局，致庚金大受打击，除非地支见申，庶几庚金通根再见一位癸水，以遏方张之焰，俾臻十全，木火与土，悬为厉禁可也。'],
  ['壬', '午', '辛', '亥', '亥时壬日，名曰日禄归时，再有辛金相生，虽在午月火炽，亦可胜任其财，壬水旣返弱为强，不畏天干有土，盖土生辛印也，木火亦所弗忌。'],
  ['壬', '未', '庚', '子', '壬水生于未月，未虽阴土，而性则燥，故喜时上庚金之生壬，时支子水之助壬也，金水旣盛，虽土旺而日元不弱，但总忌丙火太阳之热？，与戊土之重压，如得木以疏旺土，如甲年必为辛月，虽地支有巳午，亦是秀发之命矣。'],
  ['壬', '未', '辛', '丑', '未月土旺，此时壬水，原赖金生，时为辛丑，丑未冲而土不壅？，但较水势不盛，必可畅流无阻，而无黄河改道之弊矣，土去生金，则辛金母气亦健，不过三伏炎天，大忌丁火伤辛，卽午火亦忌，土旺且多，当然不喜再见，金土木三者平均，卽是佳命。'],
  ['壬', '未', '壬', '寅', '壬日而时又透壬，同气有情而得助，虽生土旺之未月，倘不致十分受窘，时落于寅，虽可疏土，然系丙戊之长生，所以天干不可再见丙戊为第一条件，年月能逢金以生之，并点缀少量之阴木阴火，卽是大用之造矣。'],
  ['壬', '未', '癸', '卯', '壬水生于季夏，土旺用事，水力不强，时逢癸卯，喜卯木之制土，月卯未之会局，又有癸水助之，则克水之土力以减，但夏令水？干涸，须再得金，以发其源，有金必贵，无金则庸，盖无疑义矣。'],
  ['壬', '未', '甲', '辰', '壬水未月，时落甲辰，土多且旺，甲木疏土之力？足，日主克泄交加，必须岁月之间，得金以泄旺土，生衰水，再见另木为补助，始是优等之造，火土之当忌，自在想象中矣。'],
  ['壬', '未', '乙', '巳', '季夏己土司权，壬水日元受其克制，则时上疏土之乙木，允为喜神，惜乎时？巳火，乙去生巳，巳来生土，致使助土之效能，多于克土之应用矣，最好巳中庚透，日坐申金，或为辛亥年命，？失中上之命格。'],
  ['壬', '未', '丙', '午', '壬水生于土旺用事之未提，再逢丙午财？旺地之时元，火土重重，使壬水大受威偪矣，补救之道，唯有庚壬俱透，而申亥在支，庶几势均力敌，否则财官旺而日主弱，再逢旺地必倾，若见子午相冲，亦降格以求之意也。'],
  ['壬', '未', '丁', '未', '丁与壬合，化则为木，月建在未，须在土旺用事之前，方可言化，若已进土壬，支见？未，再有未中丁火，透而生土，财官太过，火土为病，水木为药，然卽水木出干，而壬尙无根，故尤以干支见金为要着也。'],
  ['壬', '未', '戊', '申', '土旺用事之时，而时干见戊，使未月之壬水，受制极深，幸也，时支为申，金以生水，壬得长生，不过尙嫌杀重，须得木以制杀，然有木又须有水，因弱水畏木盗泄也，金如孟母之贤，火则助桀为虐。'],
  ['壬', '未', '己', '酉', '月令未中藏己，出露时干，虽阴土而嫌太过，喜得时坐于酉，壬水得其相生，以成官印相生之格，然而尙嫌金少，须得辛金出干，则印绶得禄，水源不竭矣，切忌丁午二火，以伤其印。丙亦不宜，巳火无碍，以巳酉会局故也。'],
  ['壬', '未', '庚', '戌', '壬水生未月戌时，皆系燥土，受克甚重，所喜庚金枭印，透于时干，泄土生水，以庚为用柱中如无木，则土总嫌厚，但有木而无水，则无根之木，易受庚金斲丧，卽使水木并见，还要无火克庚，始臻上策。'],
  ['壬', '未', '辛', '亥', '壬水得禄于亥，再有正印之辛，虽在土旺之未月，似可返弱为强，但因亥未会局，卽有制土之功，亦有泄水之？，区区辛金，？犹？足，还须支坐申酉，以助生机，苟能如是，则虽有火土出干，亦不为害矣。'],
  ['壬', '申', '庚', '子', '壬诞申月，长生之度，气势已盛，时为庚子，庚金得禄于申，壬水乘旺于子，子辰会局助壬，絶顶身强，必须见戊土出干，作之堤防，？宜有火生土，否则一世空权，己土无用，木亦不喜，若一派金水，则作从旺看。'],
  ['壬', '申', '辛', '丑', '壬生申月，长生相资，辛金透出时干，得丑土相生，而又乘旺于申，相生太过，身旺无依，必须火土并见，以为挽救，但见火则丙不如丁，以丙与辛合，见土则己不如戊，以阴土难障狂澜，土厚而有木参加，则？超脱矣。'],
  ['壬', '申', '壬', '寅', '申月长生之壬，岂宜再见壬水，以成横流泛滥，则时元寅木之泄水，原无可訾，但因寅申之冲，寅如朽木，于事无辅，除非年月透甲，则食神得禄，若寅中丙戊透露亦佳。'],
  ['壬', '申', '癸', '卯', '孟秋金旺水相，日壬时癸，水有金生，颇具实力，故时支之卯木伤官，絶不虑其泄，而反觉其秋木不荣矣，喜乙木透干，无乙而有火，以铄旺金，存弱木，亦可，惟旣取伤官，则以见金为大戒矣。'],
  ['壬', '申', '甲', '辰', '壬水长生于申，墓库于辰，然辰土为甲木所制，旺金所泄，申辰又会，致有堤防溃决之象，是应戊透年月，以成食神制杀，再能配合丙丁巳午之一，方荣华无比之造矣。'],
  ['壬', '申', '乙', '巳', '申月之壬，母气甚健，时逢乙巳，虽曰伤官生起财星，惜乎伤官力薄，且巳申相合，财有所绊，以致乙巳木火，均？足为用，宜多见木火土，若巳中丙戊？透，尤为伟大之造。'],
  ['壬', '申', '丙', '午', '申月金旺水相，故壬水甚为有力，时逢丙午，财星乘旺，天生富格，年月之间，若有木，还须有金，有火仍宜得水，始是身旺财宏，或土透天干，不须干制，祗以金水生扶为合矣。'],
  ['壬', '申', '丁', '未', '壬水値申月，当然旺相，？喜财官，丁未时元，恰喜财以生官，丁虽财来就我，不作化木论，而较量其间，犹是金水盛于火土，所以地支不妨坐午，以通财官之气，天干逢食或伤，以为财星之根，必大富贵矣。'],
  ['壬', '申', '戊', '申', '申月申时，壬水？値长生，金愈旺而水愈盛，大有秋潮奔放之虑，则时上戊土七杀，洵足以鎭横流，挽狂澜也，但申中藏戊庚壬，比较金水犹众，最妙得火，以生其戊土七杀，切不可再逢甲木，苟见甲来克戊，则涓涓不？，为可虑矣。'],
  ['壬', '申', '己', '酉', '壬日而生申月酉时，生气太过，况己虽属正官，却被旺金所泄，则阴土虚而？实，？为壬水所冲，必得有力之火，以生己土，庶财官印三宝相生，为一世安然有福之命，但谈不到任何建树发挥耳，倘其见木，？有败无成。'],
  ['壬', '申', '庚', '戌', '壬日庚时，月提申建，庚禄居申，金气太过，时支之戌，虽火库而属土，但因位在西方，申戌拱酉，终觉金多水浊，所以年月须见丙或丁，而地支再有木火辅之方妙，否则见戊亦宜。'],
  ['壬', '申', '辛', '亥', '壬水生申月亥时，月坐长生，时？归禄，再见辛金，乘旺于申，以生其水，一派金水之气，但敎柱无一点火土，则以从旺而推，否则纵见火土财官，亦须有力，若火土力弱，支见寅巳，犯旺者冲衰冲冲者拔家破人亡之命。'],
  ['壬', '酉', '庚', '子', '壬日庚透，酉月子时，壬旺于子，庚旺于酉，金淸水白，生旺非凡，？喜火土财官，或木火伤食生财，不可再有金水，否则金多水浊，身旺无依，鳏寡孤独之命。'],
  ['壬', '酉', '辛', '丑', '壬水生于酉月，金旺水相，时遇辛丑，辛禄居酉，正印通根，酉丑会局，生气太过，以土金为病，以木火为药，然阳火之丙，与辛五合，而受牵掣，不如丁火出干，辅之以木或坐于午，内大富之命矣。'],
  ['壬', '酉', '壬', '寅', '酉月金旺，壬水承母气而生，不为身弱，时又透壬，雨水汇合交流，颇具太过之象，时？寅木，以泄其水，然因秋木气衰，？足以吸收大水，除非寅中甲丙戊三者，得透其一为苗，但丙为？壬夹攻，故还须支有午戌助之。'],
  ['壬', '酉', '癸', '卯', '壬日生于酉提，甚为有气，又有癸劫幇扶，日元强甚，时落于卯，虽可泄水，但以卯酉之冲，枯木难以吸水，是应年月乙木出干，支坐亥未，以木为用，但若不逢火运，仍是孤寒。'],
  ['壬', '酉', '甲', '辰', '壬水生于酉月金令，辰酉再合，生气十足，甲木食神，固为秀气，奈何失时，必须寅亥财地，杂以一点丙丁，始可骏发，庚申阳金，乃大忌之神。'],
  ['壬', '酉', '乙', '巳', '酉月壬水，生旺之象，时逢乙巳，伤官生财，惟巳为金之长生，巳酉再会生气之局，乙木此时，又在絶地，遂使木火等于虚设，若不透丙火，见卯木，定是庸流，丙卯？者见一，纵得志，亦非絶顶伟大。'],
  ['壬', '酉', '丙', '午', '壬生酉月，金水相通，时逢丙午，偏财乘旺，乃财命有气，安富尊荣之造，不可见土，以其晦火克水，最好金木并透干头，或干支金木交差，始是石崇王顗一流人物，'],
  ['壬', '酉', '丁', '未', '仲秋酉月，金旺而木气休囚，卽使壬日丁时，断不能丁壬化木，生旺之壬，有丁未一财一官，合诸酉金正印，成为三宝相生，纯正之象，为庸庸多厚福之命，如年月再见一位己土，亦无碍，最怕戊土，至于金木？者，原亦弗忌，惟不可太多耳。'],
  ['壬', '酉', '戊', '申', '八月酉建之壬，正値秋泛之时，益以长生之申时，泛滥之势已具，则时上戊土，以为堤防，原属必要，所谓身强杀浅，假杀为权者也，纵无伤食之木，亦不虑其七杀无制，如有木，必须有火扶杀。'],
  ['壬', '酉', '己', '酉', '月时二酉，以生壬水，金水多而势成，区区一点己土，焉能为中流砥柱，必须支有午未，干见丙丁，方可以财辅官，若无火，阴土反为激流所冲，毫无用处，必致桀惊不驯，犯法戕官，为社会之蟊矣。'],
  ['壬', '酉', '庚', '戌', '壬日而生酉月庚时，？啻经三峡，奔流急湍，喜得戌时火库障之，土力尙嫌不厚，须火土？透，支坐寅午，方是权利过人之命，金水不必再见，木则乙不如甲之有用，然见木必须有火方妙。'],
  ['壬', '酉', '辛', '亥', '酉月壬日，时逢辛亥，亥为壬禄，酉为辛禄，金水虽则相涵，不免生旺太过，喜得亥中藏甲，但敎出干，再无正印枭神之金，以戕其木，则此一点水气可用，必成显宦，至少为科学权威，有火土而若少，反嫌糅杂。'],
  ['壬', '戌', '庚', '子', '壬水生于戌月，秋末土旺用事，时逢庚子，枭印羊刃生扶，壬水转强，故喜戌中火土透干，然丁己不及丙戊有力，杀印带刃，可操生杀大权，木则非所忌也。'],
  ['壬', '戌', '辛', '丑', '壬生戌月，中藏辛金，透出时干，相生有力，然因丑戌？土相克，官杀不淸，是宜甲透天干，以制旺土，惟秋令木不强盛，有木还喜有水生之，若柱中有金，则生之太过，不妨以火镕铄之，但怕火多之助土？水。'],
  ['壬', '戌', '壬', '寅', '戌月壬水，戌为丙戊之库，时行于寅，又是丙戊之生，寅戌合局，本觉火土过旺，而喜时上壬水扶之，戌中虽藏辛，究未能直接相生，故以干头有辛，地支见酉方妙，火非所喜，土亦怕见。'],
  ['壬', '戌', '癸', '卯', '季秋土旺司权，壬水受制，原喜癸水幇身，卯木制杀，无如卯与戌合，癸水乏力，必须见酉冲卯，或以辛金剿之，苟无辛金，则代以庚申，如金气全无，则必一生遭小人，而亲？众叛。'],
  ['壬', '戌', '甲', '辰', '壬水日干，生于戌月辰时，已属身轻杀重，喜得甲木克之，然而斯时土旺用事，木弱无力必有劫比生甲，伤食助甲为妙，得有亥卯在支，尤如三径之松，毫无凋？气象矣，大怕有金，庚？可畏。'],
  ['壬', '戌', '乙', '巳', '三秋壬水，生气少，而克气多，时？乙巳，乙生巳而无疏土之功，壬水甚衰，必得金水配合，而为抚翼匡直，始能调济于平。'],
  ['壬', '戌', '丙', '午', '壬生九秋，月令在戌，戌为火库，时？丙午，午戌会局，几乎全局皆火，壬水孤单，致有杯水？薪之槪，必得比肩以遏其火，又以金生其水，方克任其财星矣，土虽泄火而制壬，木则泄水以资财，皆不宜也。'],
  ['壬', '戌', '丁', '未', '壬日而値月戌时未，？土皆藏丁火，丁透时干，虽与壬合，财来就我，但总财官太过，日元嬴弱可虑，不可以木克土，恐其生火为？，祗合以金泄土生水，卽是釜底抽薪之法。'],
  ['壬', '戌', '戊', '申', '壬日申时，为値长生，月令在戌戊透时干，虽可生金，究嫌克水，以此际土旺用事也，必须金木并见，庶水有所承，土有所制，大怕见火，以其烁金资土，有害无？耳。'],
  ['壬', '戌', '己', '酉', '戌月酉时，壬水为杀印相生，时干己土，虽有生印之功，亦有当杀之弊故与上条戊申时上同，仍须将当旺之土，泄之以金，抑之以木，不宜火之销金生土也。'],
  ['壬', '戌', '庚', '戌', '壬水而月时皆戌，杀重身轻，纵得庚金为缓冲，还当阳木阴水相辅助，？以甲虽疏土，然被庚金斧斤所砍，必也，有水以缓冲，俾秋木克施其技。'],
  ['壬', '戌', '辛', '亥', '九秋之壬水，土旺司权，壬水虽冠带在戌，犹将及成童，尙有关杀，好在时为辛亥，旣正印之生身，？通根于归禄，则先天强而后天摄养亦宜，自可免于大患矣，卽见戊透，亦不为忌，？何虑乎木火哉。'],
  ['壬', '亥', '庚', '子', '壬水日干，禄于亥，旺于子，亥月子时，干逢禄旺，卽无时干庚金之生，已属天下滔滔，必须年逢戊土或丙，而日坐寅木或戌土，差免横决之患，若其余干支，并无火土，仍多金水，则以从旺而论可已。'],
  ['壬', '亥', '辛', '丑', '壬水生亥月，格名建禄，喜火土之财官，忌金水之生扶，时逢辛丑，又有辛印相生，丑虽正官，然以亥丑拱子，位次北方，无从补救，必须干有火土，如丙年己月，支逢寅午戌，庶五行抒配中和耳，木无所用，盖有金制，且寒木原不华也。'],
  ['壬', '亥', '壬', '寅', '亥月寅时，寅亥虽合，而未能如寅月亥时之可化木，再有比肩之壬，则犯建禄之忌，寅中丙戊暗藏，但愿日坐于戌，丙戊得透其一，则财官亦非无根，若柱中竟无火土，祗见甲乙，如甲年必乙月，为秀气所种，必文名满宇内。'],
  ['壬', '亥', '癸', '卯', '亥月建禄之壬水，喜克泄，忌生扶，时遇癸卯，忌癸水之扶，喜卯木之泄，亥卯会而木？有气，惟寒气日进，木不发扬，最好年月见火以暖之，则繁荣有自，用取伤官，亦极秀之命，大怕见金，如再见水，则根将腐蚀，木火第一，土无出入。'],
  ['壬', '亥', '甲', '辰', '壬生亥月，水旺木相，亥中藏甲，出露时干，食神有气，原胜财官，无如时落于辰，乃是七杀，遂不能单用甲木，而以食神制杀为用，大喜戊土为配，切忌印绶，以免食神之木受伤，生旺之水加强，倘能有火，？形完善矣。'],
  ['壬', '亥', '乙', '巳', '壬日生亥月巳时，巳亥虽冲，而无足虑，？以旺水生起时上乙木，巳火有所秉承也，但敎年月之上，不见庚辛，则乙木无损，苟犯印绶，必然名利？空矣。土不为忌。'],
  ['壬', '亥', '丙', '午', '亥月得令之壬水，自以财官为喜，时？丙午，偏财乘旺，足为养命之源，成旣济之象，其它干支，最宜以木辅之，则财？有根矣，若干见戊己，则以财官而论，金水生扶，总以避免为妙。'],
  ['壬', '亥', '丁', '未', '壬日而透丁未时，月令在亥，为木之长生，丁与壬合，亥未会局，谓为化木，似是而非，？以时令在冬，不比三春也，是当用取财官，四柱终以火土为妙，倘有木而无土，则宜专用财星，支有午火，乃如雪中送炭，？可贵矣。'],
  ['壬', '亥', '戊', '申', '壬日申时，为逢长生，月提在亥，又値建禄，生旺已极，则时上戊土七杀，正足以遏阻太旺之水，惟戊土为申金所泄，还是身强杀浅，必须有火以资之，甲木制杀，反为大忌，土可助杀，自无抵触也。'],
  ['壬', '亥', '己', '酉', '壬禄在亥，壬日亥月，为建禄格，不宜生旺，唯喜财官，时？己酉，官星虽透而无根，酉金生身而助势，故必干见丙丁，或则支逢午火，俾官星有气，如无火而透乙，则伤官见官，为祸百端矣。'],
  ['壬', '亥', '庚', '戌', '壬为阳水，生于冬初，亥为日禄，正在生旺，时元庚戌，不喜庚金之生，而喜戌土之亟，最宜戌中丁戊透干，以抑太旺之气，若地支见午，则？喜甲寅阳木生财，且杀亦乘旺逢生矣。'],
  ['壬', '亥', '辛', '亥', '亥月壬水，再逢亥时，？禄通根，再有辛印，金水相涵，苟无火土相杂，则以从旺而推，或则亥中甲透，地支有寅，是乃食神得禄，其秀非凡，如是则独忌阳金，水亦不忌，火土财官，固所喜也。'],
  ['壬', '子', '庚', '子', '壬水生于子月，身？旺气之方，时遇庚子，？但旺气迭逢，？有庚金母气，如此生旺，非戊土杀透，再辅以火，定为耗败之命，或透丙藏戊，富而不贵，然此条无丙戊俱透之理，故大抵非成功之士。'],
  ['壬', '子', '辛', '丑', '壬生子月，时？辛丑，除非有亥，则为北方一气，玄武当权之贵格，否则虽有丑土，？足为用，乃须柱有阳土，障其狂澜，丙虽大喜，因合辛金，为所羁绊，所以卽有戊土，或则寅戌，皆非大有作为之命。'],
  ['壬', '子', '壬', '寅', '壬日而时又透壬，月令在子，比劫羊刃幇扶，水旺已极，好在时？于寅，寅位丙戊长生，甲木干禄，甲丙戊三者透一，便是通根佳格，但与其透丙而被制，不如见戊为佳，而一土众水，？不如甲木因势？导之？妙矣。'],
  ['壬', '子', '癸', '卯', '子月旺地之壬，不宜子中癸透，再来幇扶，妙在卯时，伤官独秀，以泄壬癸之气，但区区之木，恐随派而逐流，故须余柱再有木火，或则土木并见，则前者花木向阳，旺水可望吸收，后者土抑水势，使木有所附，方成高等之造。'],
  ['壬', '子', '甲', '辰', '壬水以子为旺地，辰为水库，辰时子月，子辰会局，卽见申金成全水局，其润下格亦不健全，？以时上甲木泄气故也，最好日坐寅，年？卯，寅卯辰一气，助甲木而郁葱秀发，？胜丙戊火土多矣，阳金大忌。'],
  ['壬', '子', '乙', '巳', '壬日而値巳时，月令在子，巳火偏财失令，虽乙木泄水生火，奈何阴木力微，大喜巳中丙透月提，则必是甲己年命，或乙年，则月为戊子，庶财杀得禄，亦富亦贵矣。'],
  ['壬', '子', '丙', '午', '子月壬日，値时为丙午，壬丙子午，虽居敌对之地位，然身旺喜财，颇得身财？旺之妙，盖壬旺于子，丙旺于午也，火不当令，柱中还须木火，切忌再有比劫以夺财，若为壬年，必为壬月，而日非寅午戌者，必是破落户，败家儿。'],
  ['壬', '子', '丁', '未', '时之未中丁火，透而就我，虽月？劫刃之子，因子被未穿，丁不受伤，况丁为正财，并不畏劫耶，惟丁壬不以火木论，柱中如透木土，木以生弱火，泄旺水，土以制盛水，保衰火，乃是好命，或支有寅午戌亦？。'],
  ['壬', '子', '戊', '申', '子月旺地之壬，原须戊土透杀，以为中流砥柱，奈何时干虽戊，时子逢申，申金泄弱戊土，而为壬之长生，子申又？会局，杀弱身旺，金水当然大忌，卽甲木透干，亦一事无成之格，惟有乙年丙月，而坐戌土，方可成材。'],
  ['壬', '子', '己', '酉', '仲冬子建，壬日酉时，酉金正印，以生旺极之壬，奔流激湍，区区己土，势必为其冲涮，挟泥沙而一写汪洋矣，非大量火土抒配，乃无用之命，阳木甲寅，亦为所喜，阴木乙卯，絶无补益。'],
  ['壬', '子', '庚', '戌', '壬日庚时，水得金生，况値子月，壬水正旺，时？戌土火库，可以销其明金，阻其暗流，但觉势力孤单，故必戊透于干，午値于支，成杀刃格，倘再见寅，尤必军政界之第一流矣。'],
  ['壬', '子', '辛', '亥', '子月寒盛水旺，壬日而又时遇辛亥，金沉水底，寒？已极，水旺亦达极点，必也，其余干支，尽是木火或土，方能有所作为，纯木纯火土？妙，多见一分金水，便减低一分福泽。'],
  ['壬', '丑', '庚', '子', '壬水日干，生于丑月，壬水之气衰退，然因时逢庚子，印绶劫刃生扶，仍？失为生旺，虽子与丑合，或已土旺用事，究以寒湿之土，有何效用，故余柱见官杀之土，还不如财星之火，以土有生金之弊，而火则生土祛寒也，甲寅阳木，亦可配合。'],
  ['壬', '丑', '辛', '丑', '壬日而生丑月丑时，衰地重逢，土多而旺，丑中藏辛，透而生壬，遂不以土重为虑，惟一派阴寒水湿，必得木火抒配，庶木旣生火，而又疏土，火与水济，且暖土金，如单见一丙或丁，皆以合而牵掣，还须支有寅巳或午火耳。'],
  ['壬', '丑', '壬', '寅', '壬水生于季冬，盛极而衰，但因壬日壬时，同类有助，并不身弱，时落于寅，寅虽壬水之病地，却又为火之长生，而土附焉，严寒之际，水土凝结成冰，固宜寅木生火疏土泄水为用。若能甲丙出干？妙。'],
  ['壬', '丑', '癸', '卯', '丑月衰地之壬，土旺用事，时逢癸卯，喜癸水之幇身，卯木之制土，但严寒之季冬，苟无温暖之火，则一切的一切，无不生气索然，故喜干见丙丁，按丙年必辛月，丁年则癸月，犹非十全，不若甲年丁月，支有寅午或戌，为最上乘。'],
  ['壬', '丑', '甲', '辰', '壬日丑月，土旺而壬水不强，时逢甲辰，辰党于子申则水旺，党于四库则土强，今在丑月，土旺用事，则官杀自较强盛，卽甲透疏土，最妙日坐于寅，食神得禄，次则配之以火，以缓土木之冲亦贵。'],
  ['壬', '丑', '乙', '巳', '丑月土旺，然寒土不生，壬水生此，并不感觉克气之深，时？乙巳，乙木生起坐下之巳火，巳火生起当旺之官星，壬水转弱，究因巳丑会局，寓印绶于财官之间，遂全中和之妙用，所以其它干支，不论五行，皆非絶对有犯，但敎不偏不倚，终是妙命。'],
  ['壬', '丑', '丙', '午', '季冬丑月之壬，水土皆有冻结之象，凡物之温度，达到氷点，卽无生气，而呈死象，所以丙午之火，需要极矣，？以丙为太阳，下坐午之旺乡，光天化日，四无纤云，？合五行，生气勃如矣，此条见水固忌，见土晦火亦怕，最妙金水调和，定必富有金谷。'],
  ['壬', '丑', '丁', '未', '壬水而逢丑月未时，官多化杀，土旺为嫌，丁虽合壬，而有资土之弊，宜乎透乙値卯，以克敦阜之气，并作丁火正财之根，次则配合一点之金，俾衰地之壬水，气势一扬，因而脉络贯通，无所障碍矣。'],
  ['壬', '丑', '戊', '申', '丑月土旺用事，然金水尙有余气，故壬水生此，衰而不絶，时逢戊申，申为壬水之长生，承戊土之资，成杀印相生之格，惜乎时令关系，寒土之生殖力不强，故当以火辅之，以木驭之，金与水土，至多祗可点缀一二，多则不取。'],
  ['壬', '丑', '己', '酉', '丑月中藏己土，透出时干，为壬水之正气官星，时支値酉，酉丑会局，以成正官正印相生，非有丁或午，卽使淸正可风，亦然弗发，必须有火，庶乎高贵可跻，大怕乙木克己土，卯木冲酉金，则为伪君子矣。'],
  ['壬', '丑', '庚', '戌', '月之丑土，时逢戌土，土旺用事，壬水受制，如在时干透庚，承厚土而生衰水，但金寒水冷，堕指？肤，令人望而生畏，故要木火配合，使凝寒瑟缩之气，消化于无形则善矣。'],
  ['壬', '丑', '辛', '亥', '严寒之壬水，虽生于丑月衰地，却又得禄于时支之亥，且丑中之辛，露干生之，壬水甚旺，仅耳寒？而少活力，如有丙丁，则为辛壬合而牵绊，见巳则有亥冲，唯其支有午寅，然后丙丁出干，虽合无忧矣。'],
  ['癸', '寅', '壬', '子', '癸为阴水，生于寅月，木旺火相，伤官泄气，时为壬子。劫比相助，日禄通根，可以转弱为强，最宜甲透，则丙丁方可有根，或见戊土亦可，至于印绶之金，絶不需要。'],
  ['癸', '寅', '癸', '丑', '初春寅提之癸，原不生旺，时？癸丑，癸可幇身，丑虽克气，此时之土，气无力与癸水相等，必须己土出干，方可用杀，？以金之生水，火之生杀者配之，当可大权独揽，若己土不透，总要金火并见也。'],
  ['癸', '寅', '甲', '寅', '癸日生于寅提，时逢甲寅，伤官得禄，癸水气泄，若柱无土金，再无比劫，仅有木火，则为从儿格，贵不可言，否则唯喜金水幇身。'],
  ['癸', '寅', '乙', '卯', '癸日寅月，乙卯时元，伤官食神杂见，癸水无根，徒具长生之名，必须金水生扶为妙，忌见戊己之土，再见木火，不逢金水，亦以从儿格论。'],
  ['癸', '寅', '丙', '辰', '初春之癸，虽不生旺，而寒气未融，所以得时上丙火暖之，原亦相济相成，但时？辰土，究泄火而制水，必得余柱有金，则癸水方具生气，而能任受生旺之财矣。'],
  ['癸', '寅', '丁', '巳', '寅月木旺，癸水日干，再逢丁巳时元，丁火胜旺于巳，巳火长生于寅，财旺身衰已甚，喜巳中庚透，或年支値申，次则劫财扶助，土最忌，则木火亦不可重见矣。'],
  ['癸', '寅', '戊', '午', '戊与癸合，月寅时午，寅为火之长生，午乃火之旺地，如得戌土，成全火局，别无金水与土，则是戊癸火化之格，否则须有阳水之劫财，辅以生气之印绶，方不致财官太过，身弱？倾。'],
  ['癸', '寅', '己', '未', '寅月癸日，正当木旺，时逢己未，干支皆杀，然此时之土，受木之制，不为杀重，惟癸水之弱而无根，必金以资之，化其土，抑其木，杀印相生，乃成佳格，火为大忌，以其伤金益土耳。'],
  ['癸', '寅', '庚', '申', '孟春泄气之癸水，得庚申时，印绶得禄相生，弱而不弱，其余干支，宜以少量之木火序配之，而木火则以乙与巳，为最适当，因乙有庚合，不致过泄，巳为庚金长生，不致以财损印也。'],
  ['癸', '寅', '辛', '酉', '辛酉之金，生寅月泄气之癸，足可调和，惟因余寒未尽，雨露之癸，在此际犹为霜雪，故以寅中丙透为最宜，？以丙乃太阳，合辛金而不化水，亦不致将柔弱之金水，煏之过甚。'],
  ['癸', '寅', '壬', '戌', '癸之阴水，易为木泄，月令在寅，伤官泄之，时？于戌，寅戌会火，癸水又受火灸，则时干之壬，正喜幇身为助，但壬癸二水，力尙未逮，如戌中辛金得透，或支下有金，则眞美善矣。'],
  ['癸', '寅', '癸', '亥', '孟春寅提，木已司权，癸水日元，？喜金生水助，时逢癸亥，比劫相扶，返弱为强，尤妙亥为木之长生，与癸之旺地，木则种？毓秀，最妙余柱再逢水木，大忌有金夺秀，有土克水。'],
  ['癸', '卯', '壬', '子', '书谓五阴生处不为生，则癸水生于卯，卯为癸之长生，实际卯乃纯粹之木，有泄无生也，时逢壬水劫财，子水日禄，得声应气求之助，癸水弱而转强，不愁泄气，若甲乙透干，无金破木，无土克水，伤食当旺，日主亦强，便是一淸到底，大贵之命。'],
  ['癸', '卯', '癸', '丑', '癸生卯月，假生眞泄，原喜金水生扶，时逢癸丑，喜癸忌丑，但丑位北方，中藏金水，阴木本质，被当令之木所制，土旣无力，不必用杀，若天干透木，则宜地支有金，干露庚辛，则地支不虞火土，按此条任何抒配，皆不是好格局也。'],
  ['癸', '卯', '甲', '寅', '癸生中春，时遇甲寅，甲木以卯位旺地，以寅为禄地，满盘纯木，无根之癸水，旣吸收殆尽，如以金为冲克，则犯衰者冲旺旺者发，絶无用处，不如满盘皆木，弃命从儿，是为淸贵，旣已从儿，则土金为大忌，木火为大宜。'],
  ['癸', '卯', '乙', '卯', '日元癸水，生于卯月卯时，卯中乙木高透，食神得禄，一片秀气，格成从儿，如有克木之金，还须配之以火，御其金，而木得保全，倘见戊己，则当以官杀为论据矣。'],
  ['癸', '卯', '丙', '辰', '仲春癸水，原患身弱，时遇丙辰火土，何堪再见财官，是须年月有金，以生无根之水，然天干有丙火之财，为庚辛之敌，尤须地支再有申金，方称尽善，否则降格以求，比劫为不可少，若无金无水，致命可弃而不可从，以木火土太杂，大有一国三公，吾谁适从之槪，为卑下之命无疑矣。'],
  ['癸', '卯', '丁', '巳', '卯月木旺火相，癸日再逢丁巳时，巳火在卦为巽为风，致使木生火，火乘风，成燎原之势，癸不过杯水，以木火扶之？薪，非得大量金水，以伐木灌火不可，壬庚出干，申亥在支，虽难大造，亦可小就矣。'],
  ['癸', '卯', '戊', '午', '戊癸五合，生木旺火相之卯月，时？戊午，午乃癸之絶地，当柱中再见火土，癸水熬干，必成残废，或犯痼疾，若有金相生，有水相助，而金水并不通根者，亦于事无补也。'],
  ['癸', '卯', '己', '未', '癸日时逢己未，似乎杀重，但在卯月，卯未会局，则木旺过于弱土，有制杀太过，身弱愈甚之二币矣，故必庚辛出干，支有申酉，庶有所抑，而水有所承，不致身杀？衰，勉为无用之命。'],
  ['癸', '卯', '庚', '申', '泄气之癸水，原喜金来相生，时？庚申，正印得禄，足可调和，木之秀气，受金威胁，最好再得木火序配，则木助秀气，火范坚金，相制而？相成，火若太重，又宜以水遏之，或土以晦之。'],
  ['癸', '卯', '辛', '酉', '癸水而卯月酉时，卯酉？冲，文昌冲破，人虽聪明，学识毫无，惟辛金得禄，以生弱癸，却为所喜，不可见火，尤怕丁火损辛，最好支逢巳火，财不坏印，或则土木并透，衣禄无亏。'],
  ['癸', '卯', '壬', '戌', '卯月戌时，虽合不化，木土并不变质，癸水旣被木泄，又为土制，质与？皆削矣，所以劫财壬水幇身，允取为用，唯最好戌中辛金亦透，壬癸之源不渴，再支有子辰，则？妙矣。'],
  ['癸', '卯', '癸', '亥', '癸日亥时，气势不孤，时支亥水，虽系癸之旺乡，究亦木之长生，时方旺木，卯月会亥成局，雨露泉脉，润泽根苗，繁殖敷英，勿杂印绶官杀者必贵，否则外金玉，内败絮之庸人。'],
  ['癸', '辰', '壬', '子', '辰月土旺，然为水库而位东方，水木尙有余气，癸日壬子时，劫比幇身有力，以柱有火土或木为佳，金水不可多见，倘见申金，成水局，则丙戊尤不可少，戊年必为丙月？好。'],
  ['癸', '辰', '癸', '丑', '癸水生于辰月，辰为水库，时？于丑，丑为北方，皆是湿土，悉有癸水内藏，兹又癸透时干，虽土旺而癸水亦非无力，是宜？见火金，否则水土旣非所宜，而木亦未必絶对为利。'],
  ['癸', '辰', '甲', '寅', '癸生辰提，官星当旺，时为甲寅，伤官得禄，幸寅为官星戊土之长生，纵透戊土，亦所不忌，？以旺土宜疏，最好干头有火，所谓唯有水木伤官格，财官？旺最为欢也，庚申阳金，不宜见矣。'],
  ['癸', '辰', '乙', '卯', '辰月癸水，木有余气，辰中乙木，透于时干，通根于卯，虽屈土旺，犹觉木多盗气，最宜壬亥？水幇扶，合于食神大喜劫财乡矣，如有印，则秀气剥夺，絶？足取，火宜少见，土？无需。'],
  ['癸', '辰', '丙', '辰', '癸生辰月辰时，再透丙火，未免财官旺于日主，最好有印，则金生弱水，而化旺土矣，若辰中乙木出干，或支？于卯，亦可收疏土之功，而有生财之道。'],
  ['癸', '辰', '丁', '巳', '癸日辰月，土旺居多，时？丁巳，干支纯火，以生当旺之官，且巳为官星之禄，以致财官旺，日主弱，须得巳中庚印出干，生无源之水，并有比肩或劫财，克火护金，乃正大之命。'],
  ['癸', '辰', '戊', '午', '辰月癸水，殊欠生旺，辰中之戊土透干，下坐午火旺地，而戊癸虽合不化，遂觉财官过旺，须有甲木伤官，以疏之，然甲有生火之嫌，还当辅之以水，次则无木有金，亦不落寞。'],
  ['癸', '辰', '己', '未', '土旺用事之辰月，再遇己未纯土之时元，使癸水四面受敌，未为木库，而辰则尙有木之余气，但敎支坐亥卯，或则乙透，是最喜食神制杀之佳造，不必坭于用杀须印之说，？以一有金，则木力必灭，若无木而单见金，用印化杀亦妙。'],
  ['癸', '辰', '庚', '申', '庚金得禄于申，以生癸水日元，甚为有气，虽在辰月土旺用事，但申辰会局，旺土有同化之势，故宜干有丙丁，以阻庚申生机，印太重，亦难发也，有木？佳。'],
  ['癸', '辰', '辛', '酉', '癸日而生辰月酉时，辰与酉合，因在季春，并不化金，但因辛酉枭印得禄，辰土生之，终觉官弱印强，须有财破印，但丙与辛合，故不如丁，巳酉会，故不如午。'],
  ['癸', '辰', '壬', '戌', '癸日戌时，时逢财库，壬水相扶，癸不为弱，月提辰土，与戌相冲，财库大开，定为富命，最好透丙坐巳，则正财不虞劫夺，若金木？透，如乙命必为庚月，支有巳未，骏发尤操左权。'],
  ['癸', '辰', '癸', '亥', '日时皆为癸水，而又乘旺于时支之亥，则在旺土之辰月，究亦吾道不孤是宜有火生土，庶身旺而喜财官，否则年寅日卯，东方一气，甲乙透一，亦必高贵，然不论为火为木皆不喜金。'],
  ['癸', '巳', '壬', '子', '巳月火旺土相，癸水生此，其弱可知，兹因时逢壬子，旣得归禄通根，？透劫财为助，骎骎乎返弱为强，所以不必再畏火土，惟须有金，则水有源头，十有九发，无金而有比劫者次之，有金或水，则木自无足虑矣。'],
  ['癸', '巳', '癸', '丑', '癸水生于巳月，火土生旺，癸水无根，时支丑土，似乎不喜，然丑为金库湿土，会巳成局生水，化难成恩，以发癸水之源，加以时干癸透相扶，至多日元失令，而谈不到身弱？字，但敎其余干支，再见一点金水生扶，则木与火土，均？足忌矣。'],
  ['癸', '巳', '甲', '寅', '癸日巳月，火正旺而水正衰，时逢甲寅，甲木禄于寅，伤官盗气生财，且寅为丙戊长生，身弱已极，喜巳中庚金透干，得庚制甲，再有水抑火，方为有病有药之佳造。'],
  ['癸', '巳', '乙', '卯', '癸水日干，时逢乙卯，食神盗气，长生徒具虚名，月令建巳火旺，再有乙卯生之，财愈盛，身愈弱，最宜庚辛出干，以浚其源，否则比劫重重，亦堪助势，不可再有官杀。'],
  ['癸', '巳', '丙', '辰', '巳月癸水，时为丙辰，丙火正财，得禄于巳，使水库之辰土，化湿为燥，致癸水无力以任财官矣，是必金水并见为上，庶火有水制，不伤生身之金，木虽可以克土，而亦泄水，？害相等，终不宜多。'],
  ['癸', '巳', '丁', '巳', '癸水而月时皆巳，财已旺，岂可再有丁火透露时干，致癸被众火所煏，转瞬卽干，第一须有制火之水，其次辅以生水之金，倘再支有亥申，必是豪富之命，金水少量，于事无济，土木？者，定必为灾。'],
  ['癸', '巳', '戊', '午', '巳为戊土之禄，午乃戊土之旺，巳月午时，癸水透戊，财官之旺，无以加矣，癸水之涸，可？而待，如柱无金水，仅多木火，则取戊癸化火格，否则大量金水以救之，然不论化火或得金水补救，再见官杀，必残废顚？之命。'],
  ['癸', '巳', '己', '未', '巳月未时，中拱午火，南方之势？横，己土透而有根，癸水日元，必受熬煎，其量？竭，除非巳中庚金印透，俾弱水能生，旺土有泄，但衡量轻重，犹是火土生旺，尙宜水以克火，最妙年坐于申，则庚金得禄，水値长生，而成杀印相生之大格。'],
  ['癸', '巳', '庚', '申', '癸日而时遇庚申，正印通根，虽在巳月火旺之候，癸水究有生机，故柱有生火之木，亦可无虑，卽戊己二土见一，亦无所妨，如干头有火，则丁不如丙，因丙为太阳，丁为炉冶，庚金畏丁不畏丙耳。'],
  ['癸', '巳', '辛', '酉', '癸水而値辛酉时，辛禄居酉，偏印通根相生，月提在巳，巳酉又？会局，癸水得多金之资，犹病夫得大量滋补，顿？健康矣，土固不畏，以其生金，木有金制，生火不？，大怕丁火毁辛金，午亦同？。丙与辛合，克中有情也。'],
  ['癸', '巳', '壬', '戌', '孟夏火正当令，癸水无力，时逢壬戌，虽有壬劫之助，而戌乃火库，本质则为阳土，不独癸水被克，卽壬水亦受影响，故宜庚干申支相配合，苟能如是，纵然再遇火土，亦足调和矣，'],
  ['癸', '巳', '癸', '亥', '癸日生于巳，失令无源，时遇癸亥，同气连枝，所谓守望相助，疾病相扶持，巳被亥冲，火为水克炎威以敛，顿失平衡，故宜巳中丙戊出干，乃全中和为贵之造，否则有木生火亦可。'],
  ['癸', '午', '壬', '子', '午月癸日，乃是絶地，时逢壬子，比劫幇身，癸水以振，子午？冲，火力亦减，但以无根之癸，究难运用其财故必逢金为妙，火土是忌，木亦不喜。'],
  ['癸', '午', '癸', '丑', '癸水生于午月，财旺而身逢絶地，时上癸丑，丑在旺火之月，土自不弱，时上之癸，同病祗有常鳞，而？足以为助，财杀旺而日主弱，非有庚辛申酉不为功矣。'],
  ['癸', '午', '甲', '寅', '午月寅时，火生于寅，旺于午，寅午会局，再有甲木生之，絶处之癸水，毫无生气，非得阳金以制木，再有比劫以制火，定是无用之造，否则其余干支，絶无一点金水搀杂，满盘皆火，则从财弃命，却亦高等之格，但一见土便无一是处矣。'],
  ['癸', '午', '乙', '卯', '癸水生午，时逢乙卯，木生旺火，癸无存在之可能，？可余者都系木火，则与上条甲寅时同为弃命从财之高格，旣以弃命，切忌金水参加，一有金水，则从格破，而须分金水与木火，为？个壁垒，质量相等，亦短中之长耳。'],
  ['癸', '午', '丙', '辰', '午月癸水，时遇丙辰，丙火辰土，皆以午为旺地，虽辰中癸水暗藏，而幇身究难为力，必须金以生之，然旺火足以销金，还要辅之以比劫，最妙庚年壬月，倘得日坐于巳，则庚得长生，丙得干禄，诚万中难得其一者矣。'],
  ['癸', '午', '丁', '巳', '癸水而逢丁巳时，丁火财？旺地，又生午月，为丁火禄地，因巳为金之长生，火纵旺盛，不能弃命从财，必须比劫之水，与之颉顽，乃是身财？旺之命，若年支为申，？其美满。'],
  ['癸', '午', '戊', '午', '癸水生于午月时，？逢絶气，癸水已难生存，时又透戊，火土熬干癸水矣，不如因势？导，配以火局，或丙丁出干，毫无一点金水生扶，则是化火上格，否则金水众多，以逆其生旺之气，虽亦可发，但必十分辛劳矣。'],
  ['癸', '午', '己', '未', '月令午火，为丁火己土之禄，癸日而遇己未时，则七杀得禄，癸水絶对休囚，是须重重金水，方成杀印相生，如金水不多，则有不如无，反不若完全火土相配，而成从杀之格，旣从杀矣，则制杀之木为大戒也。'],
  ['癸', '午', '庚', '申', '午月絶地之癸，得遇庚申时元，正印得禄而生身，絶处逢生之造，不忌官杀之土，因有金以缓冲，木则祗怕一寅，以寅午会局，火则祗畏一丁，以庚被丁镕，但有木火，总须比劫为宜。'],
  ['癸', '午', '辛', '酉', '辛金得禄于酉，生起午月絶处之癸，但阴金总畏丁午，故应有水调剂，庶得抑火存金，而水之由絶而生，从可知已，土虽不忌，而多则埋金，火则宜与水并存，木亦宜少。'],
  ['癸', '午', '壬', '戌', '午月戌时，午戌会局，癸水休囚，何能任受财官，则壬水之幇扶，固必要矣，但较量轻重，仍觉火旺于水，故喜戌中辛透干头，以为水源，无论辛透与否，木火总是大忌。'],
  ['癸', '午', '癸', '亥', '癸日亥时，是名乘旺，时干见癸，相助有情，虽生午月絶地，却无身弱之嫌，故木之生火，与土之克水，皆无所畏，卽丙丁透干，亦有何碍，惟水虽多而无根，仍以见金为善。'],
  ['癸', '未', '壬', '子', '癸水生于未月，絶对休囚，火土在生旺之际，癸水必得生扶为妙，时逢壬子，劫比相助，可与火土抗衡，水尙无根，仍要有金配合，方得源远？长，则逢火土或木，用财用官，莫不自如矣。'],
  ['癸', '未', '癸', '丑', '癸水生于未月，休囚无气，时逢癸丑，丑未冲而开库，并得癸水之助，则七杀已可作用，倘丑乃所藏之辛，得透干头，尤为佳妙，柱中不可再见官杀及财，木则不妨。'],
  ['癸', '未', '甲', '寅', '癸生于未，水弱宜生，土旺宜疏，时逢甲寅，虽可疏其旺土，但？泄弱癸水，所以印绶之金，允为必要，按是尙有火之余？，故阴金不及阳金为有效，惟旣以金为喜神，则克金之火，当然忌矣，木已足用，水不嫌多，干头土透，得金则缓冲。'],
  ['癸', '未', '乙', '卯', '未为木库，中藏乙木，癸日而遇乙卯时，食神透而通根，卯未又会木局，使土化为木，泄多于克，务要印绶之金，泄土制木，而资水源，惟当旺之土，虽化？尽，有己出干，以成食神制杀，杀印相生，至于财星破印，终怕见也。'],
  ['癸', '未', '丙', '辰', '未月癸水，火未尽衰，土势方盛，岂可再会火土，时逢财官，愈使癸水孱弱，然辰未之中皆藏乙木，故卽满盘皆土，亦不能弃命从杀，以杀虽旺而有所制也，身弱喜生扶，乃千古不祧之论，则金水而外，皆所畏矣。'],
  ['癸', '未', '丁', '巳', '季夏土旺用事，癸水受克甚重，益以丁巳时元，丁火乘于旺地，致旺土之杀，势？鸱张，若制之以木，则有厝火积薪之患，是以金水并用，则火畏水克，不犯基金，金得土生，资水有力矣。'],
  ['癸', '未', '戊', '午', '癸日戊时，戊与癸合，时支値午，火之旺乡，月令在未，位居南方，倘其余干支一派木火，则作戊癸化火论，惟大忌己土杀露，以及印绶比劫生扶，犯之皆为破格，果尔破格，则须大量金水以补救之，而木亦不忌矣。'],
  ['癸', '未', '己', '未', '月时皆未，未中己土出干，癸被众土所克，？殊涸辙之水，因未土本身藏乙，致难弃命从杀，然以伤食之木而制杀，不如以印绶之金生水，金泄旺土，尙多一重效用，所谓制杀不如化杀故也，比劫之水，亦在所喜见。'],
  ['癸', '未', '庚', '申', '癸水生于季夏，土旺司权，幸得庚申时元，正印得禄相生，则山川生云，甘霖自霈，按杀轻而印重，亦失平衡，所以不忌火土，惟不可逾分而已，木无喜忌，任之可也。'],
  ['癸', '未', '辛', '酉', '癸为阴水，生于未提，土旺金相，时遇辛酉，枭印生身，旺土被泄，杀不嫌重，故与上条庚申时，同一看法，不过辛酉阴金，生气转弱，所以大怕丁干午支，而丙与巳火，则无伤也，盖丙火克中相合有情，巳火会酉成局耳。'],
  ['癸', '未', '壬', '戌', '癸日而生未月戌时，官杀杂见，且皆系燥土，煎熬虽不显明，而暗中大受威胁，时干壬水，虽幇身，但为坐下之戌土反克，脚跟并不坚？，除非戌中辛透，或支有申金，则卽火土相错，亦无患矣。'],
  ['癸', '未', '癸', '亥', '季夏未提，癸水休囚，时遇癸亥，癸水乘旺，比劫相助有情，然未土又为木库，亥水为木之长生，亥未会局，以泄亥中之水，虽土不为害，而未则猖獗矣，除非满盘皆木，甲乙再透干，为从儿格，否则必须大量之金，为去病生水之药。'],
  ['癸', '申', '壬', '子', '孟秋建申之月，金旺水相，癸水已属有源，时为壬子，壬水长生于申，幇身尤为有力，时支子水，乃是日禄，子申又？会局，身强之象，？要财官，但财星之火，为水所遏，所以有火有土，尙须有木方佳。'],
  ['癸', '申', '癸', '丑', '癸水生于申月，时逢癸丑，丑乃金库，位居北方，阴湿之土，杀无足取，必须丑中己土出干，方可用杀，但因身强杀浅，又须有木有火乃妙，否则有木无火，则制杀太过，有火无木，则财遭劫夺矣。'],
  ['癸', '申', '甲', '寅', '申月金旺之时，癸水得其资生，不为身弱，时逢甲寅，伤官得禄，但寅申冲而伤官之根株动摇，所以癸水虽不为药，还宜水火并见，盖有水则伤官之木无损，而财星之火，亦非如？火之无根矣。'],
  ['癸', '申', '乙', '卯', '癸水日干，申金月令，水得金生，原流不为浅近，则虽乙卯时元，亦不致十分盗气，惟秋木不繁，仍宜水以滋之，？应有火，以为养命之源，而成食神生财之富命，独忌辛酉阴金，来夺乙卯秀气。'],
  ['癸', '申', '丙', '辰', '癸生申提，时値丙辰，财官印三宝，祗因申辰之会，几乎官化为劫，是必再见木火，以生扶丙火之财，或透戊土，以遏水而护火，但此格太觉纯正，虽聪敏而无应变之才。'],
  ['癸', '申', '丁', '巳', '癸水生申，印旺有气，时逢丁巳财星，原可身强用财，巳与申合，虽不化水，而财与印？受牵绊，最妙庚甲并透，庚长生于巳，禄于申，印旺当令，而丁巳之火，则有甲木生之，此名财得根深印得华，一生福禄自无涯矣。'],
  ['癸', '申', '戊', '午', '月令在申，中藏戊土，透于时干，与癸五合，戊坐于午，官？旺宫，虽合不化，格取正官正印，有纯正之风，惟午火之财无气，须有阴木生之，倘见阳木之甲，则犯伤官见官之忌，寅则戊之长生，纵不畏而究与申冲也。'],
  ['癸', '申', '己', '未', '癸水日元，时逢己未，幸在申月，旺金泄土，以成杀印相生之格，惟若有木制杀，亦以印透或有火为上，盖己土此时并不生旺，不须再为克制，木为忌神，最宜金火？见，则成身杀？停，事权必盛。'],
  ['癸', '申', '庚', '申', '癸日而月时皆申，申中庚金，透露时干，以三金而生一癸，大有金多水浊之弊，以火为药，宜乎有丁及午，以制旺金，惟无根之火，又须辅之以木，而土则有生金之嫌，避免为？，水亦不喜，盖因其克火也。'],
  ['癸', '申', '辛', '酉', '癸为雨露，生于初秋申提，原非无气，益以时为辛酉，重重印绶，遂犯生气太过之弊，然太过在金，而不在水，所以土之制水生金，絶不需要，必得有火，方是对症之药，而火则丙不及丁，以丙辛五合故耳，木亦所宜，水则不必。'],
  ['癸', '申', '壬', '戌', '癸日而値壬戌时，月建在申，申为壬水之长生，戌虽属土，位居西方，申戌拱酉，金水之势强盛，所以火土财官，为命中之宝矣，不过劫财高透，财恐被劫，故宜序配以木，财庶有根。'],
  ['癸', '申', '癸', '亥', '申月金旺之癸水，母气殊健，时？癸亥，幇身有力，生旺太过，其偏与不及相等，强者抑之，则火之财，土之官，允为必要矣，最好丁年必为戊月，或己土出干，或午火在支，尙觉财官气弱也。'],
  ['癸', '酉', '壬', '子', '癸乃轻淸之水，酉为柔软之金，癸生酉月，金白水淸，时逢壬子，壬为河海之水，幇身太过，况又子禄通根，犹亦壁赋所谓白露横江，水光接天，酉金母气，为水所侵，成为母被子灭，非得火土重重，不能为有用之命，木则无益，凋？无气故也。'],
  ['癸', '酉', '癸', '丑', '癸水生于酉月，金旺水相，时値癸丑，比肩幇身，丑虽属土，但与酉金会局，土化为金，杀变成印，重重金水，身旺无依，必须丑中己土出干，再有火以生之，方以杀用，有土无火，则官杀无根，木亦不喜，盖有脧削弱杀之虑。'],
  ['癸', '酉', '甲', '寅', '酉月金旺水相，癸水日元有气，时逢甲寅，伤官通根，秋木不荣，所以欲取伤官，必须并逢水火，则水以生木，火以制金，但因火之温暖，而花木向阳，不可再见阳金，土亦不需要也。'],
  ['癸', '酉', '乙', '卯', '癸生酉建，枭印生身，乙卯时元，食神得禄，然因卯酉之冲，不啻月缺花残，最宜火以制金护木，有火则须有土，庶月支一点阴金，不为火毁而赖土生，并使乙卯衰弱之木，有所附丽也。'],
  ['癸', '酉', '丙', '辰', '癸日酉月，时遇丙辰，辰虽属土，然与酉合，土从金势，所以时干丙火负星，允为命之所喜，？以仲秋，玉露飘？，金水渐觉阴寒，得丙火之暖，则金水相涵，弥觉温润矣，柱有一二点木，以助丙火尤妙。'],
  ['癸', '酉', '丁', '巳', '癸水日元，时逢丁巳，丁火财星乘旺，然生酉月，巳酉会成金局，财从印化，而丁火无根，最宜有木，然木不必过多，如见官杀之土，则生旺金，泄弱火，反不优秀，并忌阳水，盖壬则合丁，亥则冲巳，用神受伤矣。'],
  ['癸', '酉', '戊', '午', '戊时癸日，因在酉月，酉为火之死地，不能化火，卽使时？于午，亦不能逆其金，不免微疵，故应以木配之，俾戊土受制，不生当旺之金，死火逢生，堪为养命之源。'],
  ['癸', '酉', '己', '未', '癸为雨露，生白露秋分之后，生气日进，时为己未，干支纯杀，然不嫌杀重，盖有旺金介乎其间，自得转圜无阻，但必有木制杀，必须有生土，如无木而有金水，亦须有火生土，俾与金水旗鼓相当。'],
  ['癸', '酉', '庚', '申', '酉月金旺之时，再得庚申时元，庚禄居申，旺于酉，正印太重，致犯慈母灭子之嫌，必也，干头透丙，支有寅戌，始能财足权高，盖权则印也，大忌再见官杀，而伤食之木，当为所喜，惟无火之木，？被众金所摧，亦无用处。'],
  ['癸', '酉', '辛', '酉', '癸水生于仲秋，月建在酉，又逢辛酉时元，枭神太重，其太过之病，与上条庚申时相等，金多水浊，以金为病，以火为药，所以干支有财，为第一义，庶药来病去，如见木而无火克金，无济于事，若满盘金水或土，则非僧则道，最多不驵僧之流。'],
  ['癸', '酉', '壬', '戌', '酉月癸水，水本有根，况有壬助，是宜戌土火库为用，但戌居西北之方，不离乎金水，犹觉无力，须得有土出干，兼使戌中丁火亦透，则壬为土制，不夺丁火财星矣，木中祗喜一寅，土中最喜一戊，财星之火，皆大欢喜。'],
  ['癸', '酉', '癸', '亥', '癸水阴水，时干得比相扶，时支？亥値旺，况生酉月，旺相极矣，身强之命，大喜克泄，不过克我之官杀，有生金之弊，不如我克之财星，具制金温水之效，至于泄气之食神伤官，少则无益，多亦可用。'],
  ['癸', '戌', '壬', '子', '癸水生于寒露霜降之后，气虽日寒，却是土旺之日为多，壬子为时，有嘤求之助，任其旺土，癸水殊无弱象，宜有木火厕其间，一则旺土旣有所疏，而仍有生机，次则财以养命，若虑比劫之夺，亦须木来启承。'],
  ['癸', '戌', '癸', '丑', '癸生戌月，土旺司权，再？丑时，土势增厚，然有比肩之癸相扶，且丑为寒湿之土，尙不致咄咄逼人，官杀正旺，必得木以制之，若食伤泄癸，？喜印绶以生之，所以金木交差，方可称有守有为之命，但富则未许耳。'],
  ['癸', '戌', '甲', '寅', '戌月土旺用事，癸水生此甚弱，时逢甲寅，伤官得禄，旺土固喜木疏，弱水则忧木泄，挽救之道，惟有阳金之庚申，始足以存水而克木，辛酉阴金，？难胜任，或则以金易水亦妙，但少量还是缺憾。'],
  ['癸', '戌', '乙', '卯', '季秋之癸，失令不强，再得时元乙卯以泄之，犹病妇再遭坐蓐矣，卯戌合而不化，则木土之本质不变，所以当旺之土，稍受压制，故必金火并见，金生孱弱之癸，火资受迫之土，始归中和矣。'],
  ['癸', '戌', '丙', '辰', '癸为阴水，生戌月辰时，土旺且众，再因丙透时干，太阳之火，生起旺土，致区区癸水，有如朝露，转辗卽涸，幸其辰戌之冲，土虽旺而地气转动，若辰中乙癸，戌中辛金出干，或支有卯酉子，以补未透，天干，辅缀无痕，天衣无缝，低下之造，顿成优秀。'],
  ['癸', '戌', '丁', '巳', '癸水生于秋秒，戌月旺土司权，癸水无气，时遇丁巳，干支皆火，以生当令之土，致有癸水熬干之患，虽巳中有庚，戌内藏辛，似可相生，但若身藏不露，则亦爱莫能助，卽庚辛透而生身，还须比劫制火，以免印被财伤，木虽疏土，而亦资火，故弗喜也。'],
  ['癸', '戌', '戊', '午', '戌月癸水，水弱非常，戌中戊土，再透时干，且又？时旺地之午，午戌又会火局，戌中一点辛金，已为遁藏之？丁所铄，生气索然，故须质量并豊之水木，去火土之为病，或则金水并见，否则非贫则夭。'],
  ['癸', '戌', '己', '未', '易云天数五地数五，明指土虽有阴有阳，其实一体，所以癸水生于戌建，时値己未，定杀化为一家，克水之力？巨，但在秋令，癸水不能弃命从杀，杀势正旺，不宜以木逆折之，以免？羞成怒，倒行逆施，祗宜大量之金，以疏导之，则癸水不生自生矣。'],
  ['癸', '戌', '庚', '申', '月提在戌，土旺金相，时遇庚申，阳金得禄，故失令之癸水，生机多于克气，骎骎乎可以转弱为强，土火财官，不惧重见，若有火而无土，则印绶恐伤，有土而无火，则生金太过，皆非中和之道也。'],
  ['癸', '戌', '辛', '酉', '戌土月令，中藏辛金，时逢辛酉，枭印通根，使癸水不虞受克，惟辛酉究是阴金，虽生癸水，不致太甚，故不可柱有丁午以破坏之，丙虽不忌，犹逊巳火之会酉成局也，如再略参水木，则？佳矣。'],
  ['癸', '戌', '壬', '戌', '癸日逢壬，幇身有力，但因生于戌月戌时，旺土迭逢，致壬水亦被抑制矣，最妙戌中辛金，露而不藏，或则地支申酉相生，果能如是，则虽重遇火土财官，亦无伤乎大体。'],
  ['癸', '戌', '癸', '亥', '癸日癸时，气求声应，已不孤单，再値亥时，乃二癸之旺乡，虽戌月旺土司权，以亥中藏甲，官星被伤，有官之命，无官之实也，欲保其官，必须财星之火，欲使财不受劫，则土木并见最矣。'],
  ['癸', '亥', '壬', '子', '癸水乘旺于亥，亥月癸水，天然生旺，岂宜再遇壬子时元，以致汪洋一泻，然因亥中藏甲，但敎透甲见寅，便是秀种东方，大怕见金，阳金？忌，火土财官，是亦身旺之所宜也。'],
  ['癸', '亥', '癸', '丑', '癸水生于亥月，不旺自旺，又有时上癸水相扶，未免太过，时？丑土，其力不够以制水，最好丑中己土出干，？有火以生之，便可用杀木与金皆忌，因犯制杀生身太过之弊，若支有子水，则亥子丑北方一气，作润下格论，反宜金水，而忌火土矣。'],
  ['癸', '亥', '甲', '寅', '亥月癸水，亥中藏甲，时落甲寅，伤官得禄，又値长生，寅与亥合，未免子旺母衰，旺水泄而反弱，然忌金之生水伐木，祗喜并见水火，水则幇身而木不伤，火为财星，身旺伤官宜财之说也。'],
  ['癸', '亥', '乙', '卯', '亥为木之长生，卯为木之旺地，癸水日主，得亥月卯时，亥卯会局，又兼乙透通根，致癸水被泄，宜阳金生水抑木，若逢辛酉阴金，必损乙卯之秀气，宜而不宜也，火少不妨，土最忌见。'],
  ['癸', '亥', '丙', '辰', '癸生亥月，旺气之度，丙辰时元，一财一官可喜，但若余柱无金，则水虽旺而无根，干支无木，则火以少而易晦，所以金木并见，方为正当之命，此条太嫌纯正，其人必有？智，而无手腕，未许伟大建树耳。'],
  ['癸', '亥', '丁', '巳', '孟冬建亥，癸水生此，本是水归冬旺，？事有余，时为丁巳，干支皆财，原可水火旣济，奈因巳亥交冲，财星被劫，不可再有金水生扶，祗合木火助财，先败后兴之命，如四柱有土，则财被泄而水被遏，？败俱伤矣。'],
  ['癸', '亥', '戊', '午', '癸水旺气之亥，本不畏乎财官，戊土正官，虽合不化，戊坐于午，官星亦？旺宫矣，水土？旺，所以不宜再见水土，但若有木，恐伤官星，有金恐生旺水，比较宜金火相配，则成身官？强，各行其是，？不相悖矣。'],
  ['癸', '亥', '己', '未', '孟冬癸水，月提乘旺，己未时元，杀亦不弱，但因未为木库，亥乃木之长生，亥未会局，遂有制杀太过之嫌，泄气甚深之虑，故必柱中有金，以生被泄之水，而抑制杀之木，？要有火，以防金寒水冷。'],
  ['癸', '亥', '庚', '申', '癸日而逢庚申时，正印通根而生身，月提在亥，又値旺宫，满盘金水，虽旺而觉肃索不堪，见木无益，盖为金制，土亦无用，虑其生金，必得丙丁之财透天，则全局皆呈活气矣。'],
  ['癸', '亥', '辛', '酉', '初冬水旺，癸正得令，时値辛酉，枭印得禄，？金？水，寒？为虑，生旺是虞，其余干支，宜有伤食之木，以及财星之火，方不致水冷金寒，金水冻结，至于生金克水之土，徒生牵绊，实际毫无用处，盖寒水旣不能散，？金反得所承也。'],
  ['癸', '亥', '壬', '戌', '癸生亥提，亥中壬透时干，劫财得禄，冬水汪洋，喜其时？戌土，筑之堤防，然因众寡之势悬殊，还恐堤防溃决，所以还要火土助之，切忌金之生水泄土，与木之克制其土耳。'],
  ['癸', '亥', '癸', '亥', '日时？干皆癸，月时？支皆亥，比劫重重，岂非生旺太过乎，然以土而逆折方盛之气，不如有木，以泄当旺之水，而乙卯阴木，恐随波逐？，必须甲寅阳木为妙，苟再见火，便名利？全矣。'],
  ['癸', '子', '壬', '子', '子月癸水，格名建禄，生旺非凡，再値壬子时元，岂特禄多不贵，而又一派比劫，为霜雪，为冰流，非有戊土之障，与丙火之煦，必飘荡孤寒，丙戊？透，可以富贵，有火无土，一生假富，有土无火，一世虚名。'],
  ['癸', '子', '癸', '丑', '日时？癸，又生子月，癸水当令，不虞杀克，时支丑土七杀，虽与子合，并不化土，且中藏辛癸，阴柔之杀，为寒水所包，除非支有亥水，北方一气，成玄武当权，否则亦须质？并富之火土财官，以制水而祛寒。'],
  ['癸', '子', '甲', '寅', '癸水生子月，正在得令之时，时逢甲寅，伤官得禄，以泄旺水，体用？强，盖以水为体，以木为用，最忌有金，致未被摧残，又生水太过，最喜有火相配，以成伤官生财，而水木体用，皆得温和矣，官星之土忌见。'],
  ['癸', '子', '乙', '卯', '仲冬癸水，正値司权，旣喜财官互克，亦宜伤食潜疏，今则时逢乙卯食神，吸收其水，祗以寒威所束，恐难蓓藟敷荣，所以宜见太阳之丙火，以融和水木，使乙卯之木，如寒梅着花，精神越显，金为大忌，土宜戌未。'],
  ['癸', '子', '丙', '辰', '癸生冬至前后，身旺可知，丙辰时元，恰是财官火土，固然融洽无间，但辰为水库，癸水暗藏，还须天干有土耳，以甲乙寅卯之一舒配之，则土不壅？，而火有所承矣，至于金水生扶，须视火土之轻重，而平衡之，无决定性之喜与忌焉。'],
  ['癸', '子', '丁', '巳', '书言建禄生提月，财官喜透天，以子月建禄之癸，得丁巳时，丁火透而乘旺，天干虽无官星之土，然巳中藏戊，亦官星之禄，若无壬以合丁，则戊土尽可不露，不如参加一二食伤之木，俾财？有根，金有火制，不成问题，祗恐太多而已。'],
  ['癸', '子', '戊', '午', '建禄格财官喜透，则子月之癸水，原要戊出干头也，时？午火财星，又是戊官之旺地，深与建禄之格相合，不过子与午冲，则犯旺者冲衰衰者拔之忌，犹宜再逢火来，方免财根之拔耳。'],
  ['癸', '子', '己', '未', '癸日未时，然生子月，生旺之水，不愁转弱，？以己土七杀为用，惟因寒冻之土，气少？通，所谓闭？成冬，故宜未中所藏之乙丁并透，俾丁火有根，己土得疏，以癸水亦能冻解冰消矣，金之有无，不关宏旨。'],
  ['癸', '子', '庚', '申', '庚为阳金，得禄于申，申乃水之长生，以生子月建禄之癸，势成聚禄，子申会局，满盘皆水，寒？极矣，必须有力之火，以镕金而暖水，方为好命，木则喜其生火，土则虑其生金。'],
  ['癸', '子', '辛', '酉', '辛金得禄于酉，长生于子，月令在子，日元为癸，辛金相生，兼成聚禄，金水皆盛，寒？愈甚，必得丁午阴火，以破辛酉生气，以丁午乃是弱者，最宜甲寅阳木为之根，若为乙卯阴木，必为辛酉所侮，而无用矣。'],
  ['癸', '子', '壬', '戌', '癸水旣得壬水为助，再生子月当旺之时，生旺已极，喜时支见戌，本质为阳土，而又为火库，惜支之力，不及天干，故宜戌中戊土，出露干头，以制壬水，苟再有火辅之，便是富命，年支属寅，？其美满。'],
  ['癸', '子', '癸', '亥', '日癸月子，当令生旺，岂宜再有金水生扶，奈时逢癸亥全盘皆水，于何取用，按癸为阴水，固喜有土而逆折其气，然亥中藏甲，若甲木透干，支有寅卯以吸水，水木？强，一淸到底，亦贵显无疑。'],
  ['癸', '丑', '壬', '子', '癸水生于丑月，虽则土旺，而水有余气，再见壬子时，助水增寒，致丑土几被寒流所卷，必得有土出干，以鎭其水，？要丙火太阳，生土散寒，如有戊土制壬，则丁亦可用，见木必须有火，否则弱土？伤矣。'],
  ['癸', '丑', '癸', '丑', '日时皆癸，月时均丑，？水？土，似乎身杀？停，然而水土皆互凝冻结，非得火透天干，必致体用不分，有火然后水之体，土之用，不致混矣，如干头仅见一火，还且生火之木，弥缝缺陷。'],
  ['癸', '丑', '甲', '寅', '癸生丑月，土旺用事，时？甲寅，伤官假杀为权，然木多于土，制杀太过为嫌，所以其余干支，定要有火，则财星得甲寅之生，制土之力量以泄，寒？之水土，顿呈活泼，否则戊己出干亦可，盖有寅中丙火，暗中生暖也。'],
  ['癸', '丑', '乙', '卯', '丑月土令之癸，终非生旺之象，时为乙卯，食神通根，虽有制杀之用，亦有泄水之弊，况以一土而遇二木，受制不无过分，第一须金制木生水，其次须火生土，方能日元有气，而七杀乃可用。'],
  ['癸', '丑', '丙', '辰', '季冬寒？之癸水，原要丙火太阳，始得寒冰冻解，月令在丑，土旺用事，时再逢辰，未免土重，况有丙火生之耶，所以不可再有火土，否则身弱太过，最好印绶与食伤并见，透庚辛而坐寅卯，则无懈可击矣。'],
  ['癸', '丑', '丁', '巳', '癸日丁巳，为时上偏财，月令之丑土当旺，时支在巳，虽亦为财，与丑会金局，以生癸水，则财杀印相生有情，似无轩轾，然丁火无根，故须有木，但木来制杀，己土要透，否则非全美之命。'],
  ['癸', '丑', '戊', '午', '癸水见戊土五合，但生季冬，一则寒水之际，再则土旺之时，决难化火，但因时上之午，生起旺土，癸水纵不熬干，殊觉无力，且丑藏辛癸。又不能弃命相从，是宜金以生水，木以克土，二者缺一，卽非好命。'],
  ['癸', '丑', '己', '未', '癸日而月令在丑，时为己未，旺土重迭，杀重身轻，但丑月癸水，不能弃命从杀，然则奈何，是宜以金生水则旺土之气亦疏，以木制土，而暗藏之火以发，况丑未本冲，暗火容？引出，八字生温矣，'],
  ['癸', '丑', '庚', '申', '丑月土旺金相，癸水而遇庚申时，印绶太强，旺土不旺，弱水不弱，祗因时屈寒冬，难免金寒水冷，故宜有力之火，则？但寒冷无虑，且以抑制太过之金，生起阴寒之杀，？受裨益矣。'],
  ['癸', '丑', '辛', '酉', '丑月酉时，酉丑会局，辛金透干，以生日元之癸，？但金多水浊，？且水冷金寒，以金为病，以火为药，但如丙巳阳火，则丙被辛合，巳会金局，有损无益，祗有丁午阴火，再得木生乃佳。'],
  ['癸', '丑', '壬', '戌', '丑月戌时，官杀杂见，日干之癸，不胜旺土来侵，则时上壬水幇身，似无不可，但严寒？冽，不论阴水阳水，均难免于凝冰，故必金火？见，则水与土无不融化，并得生生之气矣。'],
  ['癸', '丑', '癸', '亥', '癸水而生丑月亥时，亥丑拱子，卽无时干癸助，已属生旺非常，但癸水成润下之格，母多不发者，因其天寒地冻，水不通流也，故若亥中之甲木出干，再能得见寅卯午未等字，则发无止境矣。'],
];

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
    来源: '《八字提要》（韦千里）十干×十二月×十二时；全量 1440 组内置数据',
    校验: '120 节齐、每节 12 条、时支顺序合规、时干全部合五鼠遁',
    注意: '不要手改：TIYAO_ROWS 为全量内置常量表，严禁破坏结构。',
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
  const 同党 = Number((strength.percent[dayEl] + strength.percent[SHENG_MAP[dayEl]]).toFixed(1));
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
    L.push(`${p.position} | ${p.tenGod} | ${p.hidden.map((h) => `${h.stem}(${h.tenGod}·${h.role})`).join(' ')} | ${p.nayin.name} | ${p.selfStage} | ${p.dayStemStage} | ${p.voidBranches.join('')}`);
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
