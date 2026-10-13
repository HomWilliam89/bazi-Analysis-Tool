// 核心/matcher/tiaohou.mjs
// 丙层 · 调候派学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';

export const TIAOHOU_PREDICATES = {
  'S-TH-001': (f) => f.isWinter && ['甲', '乙', '壬', '癸'].includes(f.dayStem),
  'S-TH-002': (f) => f.isSummer && ['戊', '己', '庚', '辛'].includes(f.dayStem),
  'S-TH-003': (f) => f.dayStem === '辛' && f.isAutumn,
  'S-TH-004': (f) => f.dayStem === '甲' && f.isSpring,
  'S-TH-005': (f) => f.isWinter || f.isSummer,
  'S-TH-006': (f) => f.dayStem === '甲' && f.isWinter && f.stems.includes('庚') && f.stems.includes('丁'),
  'S-TH-007': (f) => f.isSummer && ['壬', '癸'].includes(f.dayStem),
  'S-TH-008': (f) => f.branches.some((b) => ['辰', '丑', '未', '戌'].includes(b)),
  'S-TH-009': (f) => f.isWinter && ['庚', '辛'].includes(f.dayStem),
  'S-TH-010': (f) => ['甲', '乙'].includes(f.dayStem) && f.isAutumn,
  'S-TH-011': (f) => f.dayStem === '甲' && ['寅', '卯'].includes(f.monthBranch),
  'S-TH-012': (f) => f.dayStem === '乙' && f.isSummer,
  'S-TH-013': (f) => f.dayStem === '丙' && f.isAutumn,
  'S-TH-014': (f) => f.dayStem === '壬' && f.isWinter,
  'S-TH-015': (f) => f.dayStem === '戊' && f.isSummer,
  'S-TH-016': (f) => f.dayStem === '辛' && f.monthBranch === '酉',
  'S-TH-017': (f) => f.dayStem === '己' && f.monthBranch === '丑',
  'S-TH-018': (f) => f.dayStem === '戊' && f.monthBranch === '寅',
  'S-TH-019': (f) => f.dayStem === '庚' && f.monthBranch === '午',
  'S-TH-020': (f) => ['庚', '辛'].includes(f.dayStem) && (f.isAutumn || f.isWinter) && f.stems.some((s) => ['壬', '癸'].includes(s)),
  'S-TH-021': (f) => ['甲', '乙'].includes(f.dayStem) && f.stems.some((s) => ['丙', '丁'].includes(s)),
  'S-TH-022': (f) => f.dayStem === '癸' && f.monthBranch === '子',
  'S-TH-023': (f) => f.dayStem === '乙' && f.isAutumn,
  'S-TH-024': (f) => f.dayStem === '丙' && f.monthBranch === '子',
  'S-TH-025': (f) => f.dayStem === '丁' && f.isSpring,
  'S-TH-026': (f) => f.dayStem === '己' && f.monthBranch === '午',
  'S-TH-027': (f) => ['庚', '辛'].includes(f.dayStem) && f.isWinter,
  'S-TH-028': (f) => f.dayStem === '壬' && f.isSummer,
  'S-TH-029': (f) => f.dayStem === '戊' && f.monthBranch === '戌',
  'S-TH-030': (f) => (
    (f.isWinter && (f.stems.includes('丙') || f.stems.includes('丁')) && (
      f.roots?.byElement?.['火']?.highestTier === '禄刃专气'
      || f.roots?.byElement?.['火']?.highestTier === '长生源头'
      || f.branches.some((b) => ['巳', '午', '寅'].includes(b))
    ))
    || (f.isSummer && (f.stems.includes('壬') || f.stems.includes('癸')) && (
      f.roots?.byElement?.['水']?.highestTier === '禄刃专气'
      || f.roots?.byElement?.['水']?.highestTier === '长生源头'
      || f.branches.some((b) => ['亥', '子', '申', '辰'].includes(b))
    ))
  ),

  // 调候派批次 B（30 条扩充：S-TH-031～S-TH-060）
  // S-TH-031: 正二月甲木素无取从格，得令身旺见财官杀仍以正格论
  'S-TH-031': (f) => f.dayStem === '甲' && ['寅', '卯'].includes(f.monthBranch),

  // S-TH-032: 甲木初春或三冬无丙丁暖局，一派壬癸汪洋无戊己堤防，水泛木浮
  'S-TH-032': (f) => f.dayStem === '甲' && (f.isWinter || f.monthBranch === '寅')
    && !f.stems.includes('丙') && !f.stems.includes('丁')
    && (f.stems.includes('壬') || f.stems.includes('癸'))
    && !f.stems.includes('戊') && !f.stems.includes('己'),

  // S-TH-033: 二月卯月甲木乘旺阳刃，庚金透干得地劈木驾杀，须财星资扶，忌癸水困杀
  'S-TH-033': (f) => f.dayStem === '甲' && f.monthBranch === '卯'
    && f.stems.includes('庚') && !f.stems.includes('癸')
    && (f.stems.includes('戊') || f.stems.includes('己') || f.branches.some((b) => ['辰', '戌', '丑', '未'].includes(b))),

  // S-TH-034: 秋七月申令甲木绝地庚旺，非丁不能造庚，非庚不能劈甲引丁，丁庚两透
  'S-TH-034': (f) => f.dayStem === '甲' && f.monthBranch === '申'
    && f.stems.includes('庚') && f.stems.includes('丁'),

  // S-TH-035: 辰戌丑未四季月甲木土厚，调候疏劈总不外乎庚金劈甲疏土
  'S-TH-035': (f) => f.dayStem === '甲' && ['辰', '戌', '丑', '未'].includes(f.monthBranch)
    && f.stems.includes('庚'),

  // S-TH-036: 三夏甲木火炎木焦，局中乏水润泽且火旺，更行火地名木化成灰
  'S-TH-036': (f) => f.dayStem === '甲' && f.isSummer
    && !f.stems.includes('壬') && !f.stems.includes('癸')
    && (f.stems.some((s) => ['丙', '丁'].includes(s)) || f.branches.some((b) => ['巳', '午'].includes(b))),

  // S-TH-037: 三春乙木芝兰蒿草，丙照暖向阳，癸甘霖滋润，丙癸不可离
  'S-TH-037': (f) => f.dayStem === '乙' && f.isSpring
    && f.stems.includes('丙') && (f.stems.includes('癸') || f.branches.some((b) => ['子', '辰'].includes(b))),

  // S-TH-038: 乙木喜阳不宜阴，最畏壬癸重水漂浮，亦不宜重金苦克
  'S-TH-038': (f) => f.dayStem === '乙'
    && (f.stems.filter((s) => ['壬', '癸'].includes(s)).length >= 2 || f.stems.filter((s) => ['庚', '辛'].includes(s)).length >= 2),

  // S-TH-039: 活木忌埋根之铁，乙木生于春夏季通根，但坐下或支藏庚辛申酉金戕贼木根
  'S-TH-039': (f) => f.dayStem === '乙' && (f.isSpring || f.isSummer)
    && (f.branches.some((b) => ['寅', '卯', '辰', '未'].includes(b)))
    && (f.branches.some((b) => ['申', '酉'].includes(b)) || f.dayBranch === '酉'),

  // S-TH-040: 仲冬子月乙木一阳来复天寒地冻，端用丙火解冻，严忌癸水透干冻木
  'S-TH-040': (f) => f.dayStem === '乙' && f.monthBranch === '子'
    && f.stems.includes('丙') && !f.stems.includes('癸'),

  // S-TH-041: 冬月严寒解冻必须丙火太阳，丁火灯烛不能解严寒之冻，冬令无丙透丁富贵不真
  'S-TH-041': (f) => f.isWinter && f.stems.includes('丁') && !f.stems.includes('丙'),

  // S-TH-042: 春丙火炎光焕发专爱壬水水辅阳光，时月透癸水雨雾迷蒙不晴不雨
  'S-TH-042': (f) => f.dayStem === '丙' && f.isSpring && f.stems.includes('癸') && !f.stems.includes('戊'),

  // S-TH-043: 正二月丙火木旺火相，最忌厚重戊土高透晦光
  'S-TH-043': (f) => f.dayStem === '丙' && ['寅', '卯'].includes(f.monthBranch) && f.stems.includes('戊'),

  // S-TH-044: 秋七月申令丙火水生火退，重叠壬杀，透一戊制杀名众杀猖狂一仁可化
  'S-TH-044': (f) => f.dayStem === '丙' && f.monthBranch === '申'
    && f.stems.includes('壬') && f.stems.includes('戊'),

  // S-TH-045: 三夏丙火阳刃乘旺，透壬水七杀相制，阳刃合杀威权万里
  'S-TH-045': (f) => f.dayStem === '丙' && f.isSummer
    && f.branches.includes('午') && f.stems.includes('壬'),

  // S-TH-046: 仲春卯月丁火逢乙木司权湿木伤丁，先庚去乙，后甲引丁
  'S-TH-046': (f) => f.dayStem === '丁' && f.monthBranch === '卯'
    && f.stems.includes('庚') && f.stems.includes('甲'),

  // S-TH-047: 丁火阴柔灯烛最忌丙火夺光，柱见甲木透出生身引丁身安福临
  'S-TH-047': (f) => f.dayStem === '丁' && f.stems.includes('丙') && f.stems.includes('甲'),

  // S-TH-048: 三秋丁火气弱，甲庚丙并用调候引火生辉
  'S-TH-048': (f) => f.dayStem === '丁' && f.isAutumn
    && f.stems.includes('甲') && (f.stems.includes('庚') || f.stems.includes('丙') || f.branches.some((b) => ['申', '酉'].includes(b))),

  // S-TH-049: 丁用甲不离庚劈木引火，乙用丙温暖向阳，自然配伍铁律
  'S-TH-049': (f) => (f.dayStem === '丁' && f.stems.includes('甲') && (f.stems.includes('庚') || f.branches.includes('申')))
    || (f.dayStem === '乙' && f.stems.includes('丙')),

  // S-TH-050: 三冬丁火微寒水旺，端用庚甲良友劈木引火，成木火通明之局
  'S-TH-050': (f) => f.dayStem === '丁' && f.isWinter
    && f.stems.includes('甲') && (f.stems.includes('庚') || f.branches.includes('申')),

  // S-TH-051: 戊己土赖火运生化，金泄其秀，水润其燥，最忌顽土聚滞
  'S-TH-051': (f) => ['戊', '己'].includes(f.dayStem)
    && f.stems.filter((s) => ['戊', '己'].includes(s)).length >= 2
    && (f.stems.some((s) => ['丙', '丁'].includes(s)) || f.stems.some((s) => ['庚', '辛'].includes(s))),

  // S-TH-052: 辰戌丑未四库土气，辰未蓄水火生机为贵，丑戌肃杀冷金不贵，调候爱辰未
  'S-TH-052': (f) => f.branches.filter((b) => ['辰', '未'].includes(b)).length >= 2
    || (['辰', '未'].includes(f.monthBranch) && f.branches.some((b) => ['辰', '未'].includes(b))),

  // S-TH-053: 夏月金极火盛为铸印乘轩贵格，柱无丑字损模破印
  'S-TH-053': (f) => ['庚', '辛'].includes(f.dayStem) && f.isSummer
    && (f.stems.some((s) => ['丙', '丁'].includes(s)) || f.branches.some((b) => ['巳', '午'].includes(b)))
    && !f.branches.includes('丑'),

  // S-TH-054: 初春寅月庚金微弱，丙甲为上取丙暖局解冻、甲木生火财滋弱杀
  'S-TH-054': (f) => f.dayStem === '庚' && f.monthBranch === '寅'
    && f.stems.includes('丙') && (f.stems.includes('甲') || f.branches.includes('寅')),

  // S-TH-055: 仲春卯月庚金衰绝，专用丁火熔金，借甲引丁、借庚劈甲，无丁用丙勉强
  'S-TH-055': (f) => f.dayStem === '庚' && f.monthBranch === '卯'
    && f.stems.includes('丁') && (f.stems.includes('甲') || f.branches.includes('寅')),

  // S-TH-056: 秋七月申令庚金刚锐最为奇秀，最忌壬癸水泄，喜木火结党成局
  'S-TH-056': (f) => f.dayStem === '庚' && f.monthBranch === '申'
    && !f.stems.includes('壬') && !f.stems.includes('癸')
    && (f.stems.some((s) => ['丙', '丁'].includes(s)) || f.stems.some((s) => ['甲', '乙'].includes(s))),

  // S-TH-057: 秋令庚辛金旺司权，丁火熔金、甲木引丁，丁甲两透定步青云
  'S-TH-057': (f) => ['庚', '辛'].includes(f.dayStem) && f.isAutumn
    && f.stems.includes('丁') && f.stems.includes('甲'),

  // S-TH-058: 季秋戌月戊土厚重埋金，先用甲木疏土，后用壬水洗涤，忌见己土浊壬
  'S-TH-058': (f) => f.dayStem === '庚' && f.monthBranch === '戌'
    && f.stems.includes('甲') && f.stems.includes('壬') && !f.stems.includes('己'),

  // S-TH-059: 初春寅月壬水汪洋，无比肩羊刃者不用戊土，专用庚金发源生水、丙火照暖为佐
  'S-TH-059': (f) => f.dayStem === '壬' && f.monthBranch === '寅'
    && f.stems.filter((s) => ['壬', '癸'].includes(s)).length <= 1
    && !f.stems.includes('戊') && (f.stems.includes('庚') || f.stems.includes('辛'))
    && (f.stems.includes('丙') || f.stems.includes('丁')),

  // S-TH-060: 季冬丑月壬水严冬极冻，专用丙火解冻照暖，兼取甲木疏土佐之
  'S-TH-060': (f) => f.dayStem === '壬' && f.monthBranch === '丑'
    && f.stems.includes('丙') && (f.stems.includes('甲') || f.branches.some((b) => ['寅', '卯'].includes(b))),

  // 调候派四大专著深度扫尾第二批（30 条扩充：S-TH-061～S-TH-090）
  // S-TH-061: 仲夏午月甲木退气火炎木竭，最宜癸水透干滋润，庚金发水之源，癸庚两透为上上之格
  'S-TH-061': (f) => f.dayStem === '甲' && f.monthBranch === '午'
    && f.stems.includes('癸') && f.stems.includes('庚'),

  // S-TH-062: 季冬丑月甲木严寒坚冻，虽见庚金劈木，丁火不可少，庚丁两透科甲恩封，乏庚略可乏丁无用
  'S-TH-062': (f) => f.dayStem === '甲' && f.monthBranch === '丑'
    && f.stems.includes('丁') && (f.stems.includes('庚') || f.branches.some((b) => ['申', '酉'].includes(b))),

  // S-TH-063: 季春辰月乙木阳气渐盛，木气向荣，先癸滋培次用丙火照暖，癸丙两透不见己庚为玉堂之客
  'S-TH-063': (f) => f.dayStem === '乙' && f.monthBranch === '辰'
    && f.stems.includes('癸') && f.stems.includes('丙') && !f.stems.includes('己') && !f.stems.includes('庚'),

  // S-TH-064: 孟夏巳月乙木火土乘旺，木性枯槁，端取癸水为尊，癸水透干庚辛又透发源，科甲定然
  'S-TH-064': (f) => f.dayStem === '乙' && f.monthBranch === '巳'
    && f.stems.includes('癸') && (f.stems.includes('庚') || f.stems.includes('辛')),

  // S-TH-065: 仲秋申酉戌月乙木秋金肃杀，日时见甲木高透攀附引化，名藤萝系甲，可春可秋借势显贵
  'S-TH-065': (f) => f.dayStem === '乙' && ['申', '酉', '戌'].includes(f.monthBranch)
    && f.stems.includes('甲'),

  // S-TH-066: 孟冬亥月乙木壬水乘权，木浮水冷，取丙火暖局戊土制水为急，丙戊两透科甲定然
  'S-TH-066': (f) => f.dayStem === '乙' && f.monthBranch === '亥'
    && f.stems.includes('丙') && f.stems.includes('戊'),

  // S-TH-067: 初春寅月丙火三阳开泰侮雪欺霜，取壬水为尊庚金佐之，壬庚两透科甲定然
  'S-TH-067': (f) => f.dayStem === '丙' && f.monthBranch === '寅'
    && f.stems.includes('壬') && (f.stems.includes('庚') || f.stems.includes('辛') || f.branches.includes('申')),

  // S-TH-068: 孟夏巳月丙火建禄乘旺火势炎烈，专用壬水为调候，壬庚两透不见戊土制水，名湖水汪洋封荣之象
  'S-TH-068': (f) => f.dayStem === '丙' && f.monthBranch === '巳'
    && f.stems.includes('壬') && (f.stems.includes('庚') || f.branches.some((b) => ['申', '辰'].includes(b)))
    && !f.stems.includes('戊'),

  // S-TH-069: 仲夏午月丙火阳极，若满局木火不见滴水，合炎上格反主富贵，行运最忌水破格
  'S-TH-069': (f) => f.dayStem === '丙' && f.monthBranch === '午'
    && !f.stems.includes('壬') && !f.stems.includes('癸')
    && (f.stems.includes('丙') || f.stems.includes('丁') || f.stems.includes('甲') || f.stems.includes('乙'))
    && (f.branches.includes('寅') || f.branches.includes('戌')),

  // S-TH-070: 仲秋酉月丙火日落西山余光在湖海，若支成金局而天干无辛从化，名为朱门饿莩
  'S-TH-070': (f) => f.dayStem === '丙' && f.monthBranch === '酉'
    && f.branches.some((b) => ['巳', '丑'].includes(b))
    && !f.stems.includes('辛') && !f.stems.includes('甲') && !f.stems.includes('乙'),

  // S-TH-071: 孟冬亥月丙火水冷火熄，得甲戊庚三字出干制水生身，斯文领袖清高之命
  'S-TH-071': (f) => f.dayStem === '丙' && f.monthBranch === '亥'
    && f.stems.includes('甲') && f.stems.includes('戊')
    && (f.stems.includes('庚') || f.branches.includes('申')),

  // S-TH-072: 季冬丑月丙火雪地冰霜，若满局重见己土伤官无木制土，名假伤官聪明性傲
  'S-TH-072': (f) => f.dayStem === '丙' && f.monthBranch === '丑'
    && f.stems.includes('己') && !f.stems.includes('甲'),

  // S-TH-073: 仲夏午月丁火建禄身旺，不宜乱用甲木生塞，若得一癸透干制刃，名独杀当权出人头地
  'S-TH-073': (f) => f.dayStem === '丁' && f.monthBranch === '午'
    && f.stems.includes('癸') && !f.stems.includes('甲'),

  // S-TH-074: 仲秋酉月丁火退气微弱，无甲用乙为枯草引灯，全赖丙火晒暖方可引火通明
  'S-TH-074': (f) => f.dayStem === '丁' && f.monthBranch === '酉'
    && !f.stems.includes('甲') && f.stems.includes('乙')
    && (f.stems.includes('丙') || f.branches.includes('巳')),

  // S-TH-075: 三春寅卯月戊土阳和始生，必须丙暖甲疏癸润三要齐备，三者齐透一品当朝
  'S-TH-075': (f) => f.dayStem === '戊' && ['寅', '卯'].includes(f.monthBranch)
    && f.stems.includes('丙') && f.stems.includes('甲')
    && (f.stems.includes('癸') || f.branches.some((b) => ['子', '辰'].includes(b))),

  // S-TH-076: 孟夏巳月戊土乘权，最喜甲木疏土兼取癸水润泽，若支成金局干出癸水，名土润金生富贵非轻
  'S-TH-076': (f) => f.dayStem === '戊' && f.monthBranch === '巳'
    && f.stems.includes('癸') && f.branches.some((b) => ['酉', '丑'].includes(b)),

  // S-TH-077: 仲夏午月戊土火炎土焦，先看壬水解炎，壬甲两透名君臣庆会，官高爵显
  'S-TH-077': (f) => f.dayStem === '戊' && f.monthBranch === '午'
    && f.stems.includes('壬') && (f.stems.includes('甲') || f.branches.includes('寅')),

  // S-TH-078: 孟冬亥月戊土气进寒冬，非甲木疏劈土不显灵，非丙火照暖土不能生，甲丙两透富贵中人
  'S-TH-078': (f) => f.dayStem === '戊' && f.monthBranch === '亥'
    && f.stems.includes('甲') && f.stems.includes('丙'),

  // S-TH-079: 初春寅月己土田园犹冻，端用丙火温土回春，忌见壬水浸漫泛滥破堤
  'S-TH-079': (f) => f.dayStem === '己' && f.monthBranch === '寅'
    && f.stems.includes('丙') && !f.stems.includes('壬'),

  // S-TH-080: 三夏巳午未月己土禾稼在田最喜甘霖，取癸水为要次用丙火，无癸名旱田无丙名孤阴
  'S-TH-080': (f) => f.dayStem === '己' && f.isSummer
    && (f.stems.includes('癸') || f.branches.some((b) => ['子', '辰'].includes(b)))
    && (f.stems.includes('丙') || f.branches.some((b) => ['巳', '午'].includes(b))),

  // S-TH-081: 仲秋酉月己土子旺母衰，天干透丙火照暖地支藏丁火生身，丙透丁藏名魁天下
  'S-TH-081': (f) => f.dayStem === '己' && f.monthBranch === '酉'
    && f.stems.includes('丙') && (f.branches.some((b) => ['午', '未', '戌', '巳'].includes(b)) || f.stems.includes('丁')),

  // S-TH-082: 三冬亥子丑月己土湿泥寒冻，若壬水大水透干浸溢，名为水浸湖田孤苦无依，见火不孤见土不贫
  'S-TH-082': (f) => f.dayStem === '己' && f.isWinter
    && f.stems.includes('壬') && (f.stems.includes('丙') || f.stems.includes('戊')),

  // S-TH-083: 季春辰月庚金值戊土司令，土厚有埋金之患，顽金宜丁旺土须甲，丁甲丙齐透科甲之造
  'S-TH-083': (f) => f.dayStem === '庚' && f.monthBranch === '辰'
    && f.stems.includes('甲') && (f.stems.includes('丁') || f.stems.includes('丙'))
    && f.stems.filter((s) => ['庚', '辛'].includes(s)).length <= 1,

  // S-TH-084: 孟冬十月亥令庚金性寒水冷，非丁火不能煅造，非丙火不能温局，水冷金寒爱丙丁
  'S-TH-084': (f) => f.dayStem === '庚' && f.monthBranch === '亥'
    && (f.stems.includes('丁') || f.stems.includes('丙'))
    && (f.stems.includes('甲') || f.branches.some((b) => ['寅', '卯'].includes(b))),

  // S-TH-085: 仲冬子月辛金寒凝之极，局中见亥子丑成水局干出比劫而无丙火照暖，名润下格富贵运喜西北
  'S-TH-085': (f) => f.dayStem === '辛' && f.monthBranch === '子'
    && f.branches.some((b) => ['亥', '丑'].includes(b))
    && !f.stems.includes('丙') && !f.stems.includes('丁'),

  // S-TH-086: 季冬丑月辛金寒冻之极湿泥封金，丙火解冻为先壬水淘洗为次，丙壬两透金马玉堂名臣之选
  'S-TH-086': (f) => f.dayStem === '辛' && f.monthBranch === '丑'
    && f.stems.includes('丙') && (f.stems.includes('壬') || f.branches.some((b) => ['亥', '申'].includes(b))),

  // S-TH-087: 孟夏巳月壬水值丙火乘旺气极休囚，壬水辛金两透相生相济，四柱多金转弱为强，金榜有名
  'S-TH-087': (f) => f.dayStem === '壬' && f.monthBranch === '巳'
    && (f.stems.includes('辛') || f.stems.includes('庚'))
    && (f.stems.includes('壬') || f.stems.includes('癸')),

  // S-TH-088: 仲秋酉月辛金司令金白水清，得甲木透干制戊破土，则壬水澈底澄清名高翰苑
  'S-TH-088': (f) => f.dayStem === '壬' && f.monthBranch === '酉'
    && f.stems.includes('甲') && !f.stems.includes('戊'),

  // S-TH-089: 仲夏午月癸水至弱无根丁火司权，金难敌火，庚辛两透干又见壬癸比劫助身，定主钟鼎名家
  'S-TH-089': (f) => f.dayStem === '癸' && f.monthBranch === '午'
    && (f.stems.includes('庚') || f.stems.includes('辛'))
    && (f.stems.includes('壬') || f.stems.includes('癸')),

  // S-TH-090: 季冬丑月癸水寒极成冰，天干癸己会党，年透一丁孤灯照暖，名雪后灯光夜生者贵
  'S-TH-090': (f) => f.dayStem === '癸' && f.monthBranch === '丑'
    && f.stems.includes('丁') && f.stems.some((s) => ['己', '癸'].includes(s)),
};
