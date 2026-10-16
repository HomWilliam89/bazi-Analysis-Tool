/**
 * 排盘事实底座引擎主门面 (Facade)
 *
 * 拆分依据：D-087 核心单文件体量拆分与模块解耦方案 (Phase 2)
 *
 * 子模块构成：
 *   - ./engine/constants.mjs    基础物理常量与纯函数（干支、五行、生克、长生、纳音、十神）
 *   - ./engine/shensha.mjs      神煞库与推演
 *   - ./engine/relations.mjs    干支互涉关系引擎
 *   - ./engine/strength.mjs     旺衰力量量化与月令司令
 *   - ./engine/calendar.mjs     历法节气与大运排盘
 *   - ./engine/tiaohou.mjs      穷通宝鉴 120 组调候系统
 *   - ./engine/controversies.mjs 分歧触发器与太极层
 *
 * 100% 保持向后兼容：通过 re-export 导出全部常量、类与推演函数。
 */
import fs from 'node:fs';
import { tiyongRouteOf, formatTiyong } from './tiyong.mjs';

// -------------------------------------------------------------
// Re-export 全量子模块，保持 100% 绝对兼容
// -------------------------------------------------------------
export * from './engine/constants.mjs';
export * from './engine/shensha.mjs';
export * from './engine/relations.mjs';
export * from './engine/strength.mjs';
export * from './engine/calendar.mjs';
export * from './engine/tiaohou.mjs';
export * from './engine/controversies.mjs';

// 内部调用子模块符号（全量导入）
import {
  STEMS, BRANCHES, ELEMENTS, STEM_ELEMENT, STEM_YANG, BRANCH_ELEMENT,
  BRANCH_YANG, ZODIAC, HIDDEN_STEMS_SPEC, SOLAR_TERMS, TERM_LONGITUDE,
  NAYIN, NAYIN_ELEMENT, gzIndex, gzName, GANZHI, isValidGanzhi,
  nayinOf, xunOf, TEN_GOD_NAMES, ELEMENT_CYCLE, SHENG, KE, tenGod,
  TWELVE_STAGES, CHANGSHENG_START, twelveStage, LUSHEN, ANLU, ANLU_DAY_GZ,
  SHIE_DABAI_GZ, YINCHAYANGCUO_GZ, SHIER_SHENSHA, SHENG_MAP, KE_MAP,
  ELEMENT_OF_INDEX, SHENG_IDX, KE_IDX, nayinByShu, ELEMENT_REP_STEM,
  elementBranchStage, sanTai, nayinTableCheck, 五行字,
} from './engine/constants.mjs';

import {
  TIANYI, WENCHANG, TAIJI, TIANDE, YUEDE, YANGREN, JINYU, HONGYAN,
  LIUXIA, SANQI, TRIPLE, SANHE_DERIVED, TRIPLE_NAME, GUCHEN, GUASU,
  XIAOER_GUANSHA, computeShenSha, AUSPICIOUS, INAUSPICIOUS, shenshaNature,
  shenshaOf,
} from './engine/shensha.mjs';

import {
  STEM_COMBINE, STEM_CLASH, BRANCH_COMBINE, BRANCH_CLASH, BRANCH_HARM,
  BRANCH_DESTROY, BRANCH_PUNISH, SELF_PUNISH, STEM_BRANCH_SELF_COMBINE,
  BRANCH_HIDDEN_COMBINE, BRANCH_HALF_COMBINE, BRANCH_EXTINCTION,
  JIELU_KONGWANG, BRANCH_DIRECTION, FOUR_SHENG, FOUR_ZHENG, FOUR_MU,
  branchPunishments, gzRelations, relationsOf,
} from './engine/relations.mjs';

import {
  MONTH_BRANCH_SEASON, SI_LING_SEGMENTS, silingOf, seasonState,
  STATE_COEF, seasonCoefficient, kingOf, elementStrength, hiddenStemsOf,
  strengthOf, dayMasterSupport, ALL_TEN_GODS, tenGodStrength,
} from './engine/strength.mjs';

import {
  RAD, norm360, sunApparentLongitude, deltaTSeconds, jdeToJd, jdToBeijing,
  jdToGzDay, solarTermMoment, solarTermsOfYear, cmpMoment, momentValue,
  solarMonthOf, MONTH_BRANCH_OF_TERM, yearPillar, monthPillar, dayPillar,
  gregorianToJd, hourPillar, hourToBranchIndex, luckDirection,
  addStartAgeToMoment, computeStartLuck, buildLuckPillars, yearGzIndex,
  yearPillarOf, monthsOfYear, isValidYear, isValidGregorianDate,
  equationOfTimeMinutes, trueSolarTime, dateCandidates,
} from './engine/calendar.mjs';

import {
  TIAOHOU_BACKFILL, TIAOHOU_ROWS, TIAOHOU_INDEX, TIAOHOU_VERSION_DIFFS,
  tiaohouVersionDiff, tiaohouVersionDiffs, TIYAO_ROWS, TIYAO_INDEX,
  hourStemIndex, tiyaoOf, tiyaoSiblings, tiyaoMeta, stripParen,
  isCleanStemList, tiaohouOf, tiaohouAssessment, formatTiaohou,
} from './engine/tiaohou.mjs';

import {
  GEJU_FAVOR, yuelingSeed, controversiesOf, formatControversies,
  taijiOf, taijiTiVsWang, taijiFormationOf, yinyangGroupDivisions,
  yinyangGroupsOf, tongguanOf, specialGejuOf, elementOfGod,
} from './engine/controversies.mjs';

export function castChart(input) {
  const { year, month, day, hour, minute = 0, gender = '男' } = input;
  if (![year, month, day, hour].every((v) => Number.isFinite(v))) throw new Error('castChart: year/month/day/hour 必须为数字');
  if (!isValidYear(year)) throw new Error(`castChart: 非法年份「${year}」，仅支持公元 1000 至 2500 年之间整数年份`);
  if (!isValidGregorianDate(year, month, day)) throw new Error(`castChart: 非法公历日期「${year}-${month}-${day}」，超出历法该月有效天数或月份非法`);
  if (hour < 0 || hour > 23) throw new Error(`castChart: 非法小时「${hour}」，必须在 0 至 23 之间`);
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
// tongguanOf 已解耦迁移至 ./engine/controversies.mjs

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

// elementOfGod 已解耦迁移至 ./engine/controversies.mjs

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
 * specialGejuOf 已解耦迁移至 ./engine/controversies.mjs
 */

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
