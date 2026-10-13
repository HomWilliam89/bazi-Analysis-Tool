// 核心/matcher/index.mjs
// 丙层 · 六大学派学理排他特征谓词聚合主入口
import { GEJU_PREDICATES } from './geju.mjs';
import { TIAOHOU_PREDICATES } from './tiaohou.mjs';
import { WANGSHUAI_PREDICATES } from './wangshuai.mjs';
import { MANGPAI_PREDICATES } from './mangpai.mjs';
import { SANMING_PREDICATES } from './sanming.mjs';
import { SHENSHA_PREDICATES } from './shensha.mjs';

export {
  GEJU_PREDICATES,
  TIAOHOU_PREDICATES,
  WANGSHUAI_PREDICATES,
  MANGPAI_PREDICATES,
  SANMING_PREDICATES,
  SHENSHA_PREDICATES,
};

export const MATCH_PREDICATES = {
  ...GEJU_PREDICATES,
  ...TIAOHOU_PREDICATES,
  ...WANGSHUAI_PREDICATES,
  ...MANGPAI_PREDICATES,
  ...SANMING_PREDICATES,
  ...SHENSHA_PREDICATES,
};
