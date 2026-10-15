/**
 * 五行力量量化与月令司令权值
 * 依据：《三命通会》人元司事、《子平真诠》得令得地得势、天干虚浮折减律
 */
import {
  STEMS, BRANCHES, ELEMENTS, STEM_ELEMENT, BRANCH_ELEMENT,
  HIDDEN_STEMS_SPEC, SHENG_MAP, KE_MAP, tenGod,
} from './constants.mjs';
import { BRANCH_COMBINE, gzRelations } from './relations.mjs';
import { solarMonthOf, momentValue } from './calendar.mjs';

const MONTH_BRANCH_SEASON = {
  // 月支 -> 当令五行（旺）。**这是"本气"口径**，仅在无法计司令时使用（如四柱模式无生日）。
  寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土',
};

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

export function hiddenStemsOf(dayStemIndex, branchIndex) {
  return HIDDEN_STEMS_SPEC[branchIndex].map(([s, role, w]) => ({
    stem: s, role, weight: w, tenGod: tenGod(dayStemIndex, STEMS.indexOf(s)),
  }));
}

export function strengthOf(pillars, monthBranchName, kingEl) {
  return elementStrength(pillars, monthBranchName, kingEl);
}

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

export {
  MONTH_BRANCH_SEASON, SI_LING_SEGMENTS, STATE_COEF,
  seasonCoefficient, ALL_TEN_GODS,
};
