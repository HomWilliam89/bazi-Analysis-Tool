// 核心/matcher/helpers.mjs
// 丙层学派匹配器公共干支常数与特征推导辅助函数
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  tenGod, HIDDEN_STEMS_SPEC, GANZHI, nayinOf,
} from '../engine.mjs';

// 天干地支汉字至五行汉字之快速映射字典
export const STEM_TO_ELEMENT = Object.fromEntries(
  STEMS.map((s, i) => [s, ELEMENTS[STEM_ELEMENT[i]]])
);
export const BRANCH_TO_ELEMENT = Object.fromEntries(
  BRANCHES.map((b, i) => [b, ELEMENTS[BRANCH_ELEMENT[i]]])
);

// 五行生克关系基础映射
export const SHENG_ELEM = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const KE_ELEM = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 健壮的十神推导函数：支持天干字符或数字索引自适应解析（防范字符传参缺陷）
 */
export function safeTenGod(a, b) {
  const idxA = typeof a === 'number' ? a : STEMS.indexOf(a);
  const idxB = typeof b === 'number' ? b : STEMS.indexOf(b);
  if (idxA < 0 || idxA > 9 || idxB < 0 || idxB > 9) return '';
  return tenGod(idxA, idxB);
}

/**
 * 干支旬空推导：返回该干支所在旬轮空之两个地支
 */
export function getKongWang(gz) {
  if (!gz || gz.length < 2) return [];
  const sIdx = STEMS.indexOf(gz[0]);
  const bIdx = BRANCHES.indexOf(gz[1]);
  if (sIdx < 0 || bIdx < 0) return [];
  const xunShou = (bIdx - sIdx + 12) % 12;
  return [BRANCHES[(xunShou + 10) % 12], BRANCHES[(xunShou + 11) % 12]];
}

// 模块级特征映射常量表
export const TIANYI_MAP = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
  辛: ['午', '寅'],
};

export const LU_MAP = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

export const REN_MAP = {
  甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午',
  己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑',
};

export const CHUAN_DEFS = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'],
  ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];

export const CHONG_DEFS = [
  ['子', '午'], ['丑', '未'], ['寅', '申'],
  ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];

export const STEM_HE = [
  ['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸'],
];

export const BRANCH_HE = [
  ['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未'],
];

export const ZAISHA_MAP = {
  申: '午', 子: '午', 辰: '午',
  寅: '子', 午: '子', 戌: '子',
  巳: '卯', 酉: '卯', 丑: '卯',
  亥: '酉', 卯: '酉', 未: '酉',
};

export const YUANCHEN_MAP = {
  子: '未', 丑: '申', 寅: '酉', 卯: '戌',
  辰: '亥', 巳: '子', 午: '丑', 未: '寅',
  申: '卯', 酉: '辰', 戌: '巳', 亥: '午',
};

export const HONGLUAN_MAP = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子',
  辰: '亥', 巳: '戌', 午: '酉', 未: '申',
  申: '未', 酉: '午', 戌: '巳', 亥: '辰',
};

export const TIANXI_MAP = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午',
  辰: '巳', 巳: '辰', 午: '卯', 未: '寅',
  申: '丑', 酉: '子', 戌: '亥', 亥: '戌',
};

export const JIE_MAP = {
  甲: ['申', '酉'], 己: ['申', '酉'],
  乙: ['午', '未'], 庚: ['午', '未'],
  丙: ['辰', '巳'], 辛: ['辰', '巳'],
  丁: ['寅', '卯'], 壬: ['寅', '卯'],
  戊: ['戌', '亥', '子'], 癸: ['戌', '亥', '丑'],
};

// 长生与墓库映射
export const CHANGSHENG_MAP = {
  木: ['亥'], 火: ['寅'], 金: ['巳'], 水: ['申'], 土: ['寅', '申'],
};
export const MUKU_MAP = {
  木: ['未', '辰'], 火: ['戌', '未'], 金: ['丑', '戌'], 水: ['辰', '丑'], 土: ['辰', '戌', '丑', '未'],
};

/**
 * 安全纳音推导：支持两字干支字符串直接推导纳音全称（如「丁巳」⇒「沙中土」）
 */
export function safeNayin(gz) {
  if (!gz || typeof gz !== 'string' || gz.length < 2) return '';
  const idx = GANZHI.indexOf(gz);
  if (idx < 0) return '';
  return nayinOf(idx).name;
}

export {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  tenGod, HIDDEN_STEMS_SPEC, GANZHI, nayinOf,
};
