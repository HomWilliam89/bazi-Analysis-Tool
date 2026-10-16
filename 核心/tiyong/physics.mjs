/**
 * 乙体系 · 体用路线法 · 基础物理位阶与能量模块
 *
 * 规格依据：《规矩/体用路线法.md》
 * 承载：宫位干支定位、权重序、物理位阶、合去/羁绊、能量与通关路径、通根权重。
 */
import {
  STEMS,
  BRANCHES,
  ELEMENTS,
  STEM_ELEMENT,
  STEM_YANG,
  BRANCH_ELEMENT,
  HIDDEN_STEMS_SPEC,
  twelveStage,
  SHENG_MAP,
  KE_MAP,
  elementBranchStage,
} from '../engine/constants.mjs';
import {
  STEM_COMBINE,
  BRANCH_COMBINE,
  BRANCH_DESTROY,
  relationsOf,
} from '../engine/relations.mjs';
import {
  seasonState,
  kingOf,
  elementStrength,
  tenGodStrength,
} from '../engine/strength.mjs';


export const 生我者 = (el) => Object.keys(SHENG_MAP).find((k) => SHENG_MAP[k] === el);
export const 克我者 = (el) => Object.keys(KE_MAP).find((k) => KE_MAP[k] === el);


export const TP_PILLARS = ['年', '月', '日', '时'];

export const 此字五行 = (ch) => (STEMS.includes(ch)
  ? ELEMENTS[STEM_ELEMENT[STEMS.indexOf(ch)]]
  : ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(ch)]]);
export const stemAt = (p) => p.stem ?? STEMS[p.stemIndex];
export const branchAt = (p) => p.branch ?? BRANCHES[p.branchIndex];

/**
 * **轴甲 · 宫位分量** —— 该宫位**本身**在局中的轻重（0–1）。
 *
 * 使用者已定两条：「**月令最大，时支其次**」。
 * 余者使用者未逐一列举，据**轴乙**「**贴身力度大，隔位力度低**」推得：
 *   日支与日主**同一柱**（贴身）⇒ 分量高于年支（隔月柱，隔位）；天干整体轻于地支。
 * ⚠ **序关系是判据，具体数值是引擎操作化**（见 `GONG_WEIGHT_NOTE`）。
 * 日干为调用者自身，无分量可言，故为 `null`。
 */
export const GONG_WEIGHT = {
  年干: 0.30, 月干: 0.55, 日干: null, 时干: 0.45,
  年支: 0.40, 月支: 1.00, 日支: 0.70, 时支: 0.80,
};

/** 宫位分量的**序**（判据本身，供断言用）。 */
export const GONG_RANK = ['月支', '时支', '日支', '月干', '时干', '年支', '年干'];

export const GONG_WEIGHT_NOTE =
  '轴甲（宫位分量）：使用者已定「月令最大，时支其次」两条；'
  + '其余位次据轴乙「贴身力度大，隔位力度低」推得（日支与日主同一柱 ⇒ 高于隔位之年支）。'
  + '**序**为判据，**数值**为引擎操作化，待核定。轴乙（作用力度）见 proximityOf。';

/**
 * **轴乙 · 作用力度** —— 一个字对另一个字的力，随**相距几柱**衰减。
 *
 * 使用者：「**贴身力度大，隔位力度低。**」
 *   同柱(0)／邻柱(1) → **贴身**，系数 1.00
 *   隔一柱(2)（如 年↔日）→ **隔位**，系数 0.55
 *   隔两柱(3)（即 年↔时）→ **遥隔**，系数 0.25
 *
 * ★ 本条同时决定**通关神能不能当桥**：**桥须两头贴身**
 *   （通关神与克者柱差 ≤ 1 **且** 与受克者柱差 ≤ 1）。
 *   于是 **年 → 时 之间无论放谁都够不着两头 ⇒ 遥隔永无通关**（然其克力本已最低）。
 *   而「相邻则无中间柱可容」并不排除**同柱**引化：
 *   官在月干、印在月支 → 杀印相生，此即经典「化杀」。
 *
 * @param {string} 宫A 如 '月干' | '日支' | '月'
 * @param {string} 宫B 如 '日干' | '年支'
 */
export function proximityOf(宫A, 宫B) {
  const a = TP_PILLARS.indexOf(String(宫A)[0]);
  const b = TP_PILLARS.indexOf(String(宫B)[0]);
  if (a < 0 || b < 0) throw new Error(`proximityOf: 宫位须以 年/月/日/时 起首，收到「${宫A}」「${宫B}」`);
  const 柱差 = Math.abs(a - b);
  const 档 = 柱差 === 0 ? '同柱' : 柱差 === 1 ? '贴身' : 柱差 === 2 ? '隔位' : '遥隔';
  const 系数 = 柱差 <= 1 ? 1 : 柱差 === 2 ? 0.55 : 0.25;
  return { 宫A, 宫B, 柱差, 档, 系数, 可容中间柱: 柱差 >= 2 };
}

/**
 * 某五行在局中的**全部落点**（宫位级）。
 *
 * `层` 区分：`天干` / `地支本气` / `地支藏干`。
 * 日干是调用者自身，默认排除（`includeDayStem: true` 可取回，用于「日主被克」）。
 * `宫位分量`：天干取轴甲原值；地支本气取原值，**藏干折半**（藏者力减）。
 */
export function occupantsOf(chart, el, opts = {}) {
  const { includeDayStem = false } = opts;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = chart.pillars[i];
    const 宫 = TP_PILLARS[i];
    const stem = stemAt(p);
    const branch = branchAt(p);
    if ((includeDayStem || i !== 2) && 此字五行(stem) === el) {
      out.push({
        五行: el, 宫位: `${宫}干`, 柱序: i, 层: '天干', 字: stem,
        宫位分量: GONG_WEIGHT[`${宫}干`],
        性质: i === 2 ? '日主自身' : '透干',
      });
    }
    HIDDEN_STEMS_SPEC[BRANCHES.indexOf(branch)].forEach((h, k) => {
      if (此字五行(h[0]) !== el) return;
      out.push({
        五行: el, 宫位: `${宫}支`, 柱序: i, 层: k === 0 ? '地支本气' : '地支藏干',
        字: branch, 藏: `${h[1]}${h[0]}`,
        宫位分量: Number(((GONG_WEIGHT[`${宫}支`] ?? 0) * (k === 0 ? 1 : 0.5)).toFixed(3)),
        性质: k === 0 ? '本气' : `藏干（${h[1]}${h[0]}）`,
      });
    });
  }
  return out;
}

/** 某五行被**合**（绊）的情况：天干五合与地支六合。 */
export function combinedAwayOf(chart, el) {
  const stems = chart.pillars.map(stemAt);
  const branches = chart.pillars.map(branchAt);
  const 合 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = stems[i], b = stems[j];
      const hua = STEM_COMBINE[a + b] ?? STEM_COMBINE[b + a];
      if (hua && (此字五行(a) === el || 此字五行(b) === el)) {
        合.push({
          途径: '天干五合', 二宫: `${TP_PILLARS[i]}干${a} — ${TP_PILLARS[j]}干${b}`, 化: hua,
          被合者: 此字五行(a) === el ? `${TP_PILLARS[i]}干${a}` : `${TP_PILLARS[j]}干${b}`,
          注: '合化须看月令与化神是否得地；合而未化则只是"绊住"',
        });
      }
      const a2 = branches[i], b2 = branches[j];
      const hua2 = BRANCH_COMBINE[a2 + b2] ?? BRANCH_COMBINE[b2 + a2];
      if (hua2 && (此字五行(a2) === el || 此字五行(b2) === el)) {
        const 又破 = BRANCH_DESTROY.includes(a2 + b2) || BRANCH_DESTROY.includes(b2 + a2);
        合.push({
          途径: '地支六合', 二宫: `${TP_PILLARS[i]}支${a2} — ${TP_PILLARS[j]}支${b2}`, 化: hua2,
          被合者: 此字五行(a2) === el ? `${TP_PILLARS[i]}支${a2}` : `${TP_PILLARS[j]}支${b2}`,
          注: 又破 ? '⚠ 同一对地支既六合又相破（寅亥、巳申），合与破孰主为**分歧点**' : '合化须看月令与化神是否得地',
          分歧: 又破 || undefined,
        });
      }
    }
  }
  return 合;
}

/** 某字（宫位＋字）在原局关联网络中**受损**的情况。天干与地支各查各的关系桶。 */
export function 受损Of(relations, 宫位, 字, 层) {
  const label = `${宫位[0]}${字}`;
  const keys = 层 === '天干'
    ? [['天干五合', '合'], ['天干相冲', '冲'], ['天干相克', '克']]
    : [['地支六合', '合'], ['地支六冲', '冲'], ['地支相刑', '刑'], ['地支相害', '穿'], ['地支相破', '破']];
  const out = [];
  for (const [k, kind] of keys) {
    for (const e of relations[k] ?? []) if (String(e.pair).includes(label)) out.push({ 途: kind, 关系: e.pair });
  }
  return out;
}
export const 受损文字 = (arr) => arr.map((x) => `${x.途}（${x.关系}）`);

/**
 * **五行实际力度**（不是"在不在"，而是"有多大"）。
 *
 * 使用者原话：「**能不能制住／化尽／合住，看五行在当月的力量、人元司令、大运配合。**」
 * 故本函数把四样东西合起来给一个**档位**：
 *   ① **月令令态**（最重）——`seasonState`，旺／次旺／相／休／囚／死
 *   ② **人元司令**——该五行是否正是当月**司令之神**（得令之实际体现；四柱模式无时刻，不可计）
 *   ③ **通根透干**——地支本气／中气／余气，与天干透出
 *   ④ **宫位分量**——见 `GONG_WEIGHT`（轴甲）
 *   ⑤ **牵制**——被合冲刑害破（合而未化只是羁绊，见 `canBindOf`）
 *   ⑥ **大运配合**——可传 `岁运` 两字干支
 *
 * ⚠ **不合成单一数值评分**（项目原则：引擎不作吉凶评分），只给**档位 + 逐项依据**。
 * 档位沿用 `tenGodStrength` 的 **极／强／中／弱**，以便两处互相印证。
 *
 * @param {object} chart
 * @param {string} el 五行
 * @param {{岁运?: string}} [opts]
 */
export function powerOf(chart, el, opts = {}) {
  const { 岁运 = null } = opts;
  const pillars = chart.pillars;
  const monthBranch = branchAt(pillars[1]);
  const silingEl = kingOf(chart);           // 人元司令之神；四柱模式为 undefined
  const s = elementStrength(pillars, monthBranch, silingEl);

  const 令态 = s.令态[el];
  const 占比 = s.percent[el];
  const 是司令 = silingEl ? silingEl === el : null;

  const 落点 = occupantsOf(chart, el);
  const 干 = 落点.filter((o) => o.层 === '天干');
  const 本气根 = 落点.filter((o) => o.层 === '地支本气');
  const 中余气根 = 落点.filter((o) => o.层 === '地支藏干');
  const 根 = [...本气根, ...中余气根];

  // 牵制：合冲刑害破
  const 受损 = 落点.map((o) => ({ 落点: `${o.宫位}${o.字}`, 损: 受损Of(relationsOf(pillars), o.宫位, o.字, o.层) }))
    .filter((x) => x.损.length);
  const 被合 = combinedAwayOf(chart, el);

  // 大运／岁运配合
  let 岁运段 = null;
  if (岁运) {
    const gz = String(岁运);
    const si = STEMS.indexOf(gz[0]);
    const bi = BRANCHES.indexOf(gz[1]);
    if (si < 0 || bi < 0 || gz.length !== 2) throw new Error(`powerOf: 岁运须为两字干支，收到「${岁运}」`);
    const 岁运五行 = new Set([此字五行(gz[0]), 此字五行(gz[1])]);
    const 生此者 = 生我者(el);
    const 克此者 = 克我者(el);
    const 补 = [...岁运五行].some((x) => x === el || x === 生此者);
    const 助敌 = [...岁运五行].some((x) => x === 克此者);   // 岁运带克我者 ⇒ 助敌
    岁运段 = {
      干支: 岁运, 岁运五行: [...岁运五行],
      补我: 补, 助我之克者: 助敌,
      说明: 补 && !助敌 ? `岁运${岁运}带${[...岁运五行].join('、')}，**补${el}**（或补其源${生此者}），力度加分。`
        : !补 && 助敌 ? `岁运${岁运}带${[...岁运五行].join('、')}，**不补${el}且助其克者${克此者}**，力度减分。`
          : `岁运${岁运}带${[...岁运五行].join('、')}，与${el}关系平（${补 ? '补我但亦助敌' : '不补我亦不助敌'}）。`,
    };
  }

  // 档位（沿用 tenGodStrength 口径）
  let 档;
  if (是司令 || 令态 === '旺') 档 = 本气根.length ? '极' : '强';
  else if (本气根.length) 档 = 令态 === '相' || 令态 === '次旺' ? '强' : '中';
  else if (干.length || 中余气根.length) 档 = 令态 === '休' || 令态 === '囚' || 令态 === '死' ? '弱' : '中';
  else 档 = '弱';

  const 依据 = [
    `月令${monthBranch}对${el}为「**${令态}**」`,
    是司令 === null ? '**人元司令未计**（四柱模式无出生时刻，只能按月支本气估）'
      : 是司令 ? `**${el}正是当月司令之神**（人元用事）` : `当月司令为${silingEl}，非${el}`,
    `透干 ${干.length ? 干.map((o) => `${o.宫位}${o.字}`).join('、') : '**无**'}`,
    `通根 ${根.length ? 根.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}·${o.性质}`).join('、') : '**无根**'}`,
    `占比 ${占比}%`,
  ];
  if (受损.length) 依据.push(`被牵制：${受损.map((x) => `${x.落点}←${受损文字(x.损).join('、')}`).join('；')}`);
  if (被合.length) 依据.push(`被合：${被合.map((x) => `${x.被合者}（${x.途径}${x.化 ? '化' + x.化 : ''}）`).join('、')}`);
  if (岁运段) 依据.push(岁运段.说明);

  // 「虚露失垣」：只透干而全无根 —— 《八字提要》「虚露失垣之庚，不能制裁旺盛之木」
  const 虚露失垣 = 干.length > 0 && 根.length === 0;
  // ★★ 源头（2026-10-04 使用者口径）：**无自根 ≠ 无力**——还须看"谁在生它"（生我者）够不够力。
  //   使用者原话：「官有财作为地支的气，如果财旺（位置、力量等等），那么这个官即使地支无根，
  //   那它也是有力量的。其他的十神以此类推」「力量看源头是否有力（源头的宫位、是否被月令支持、
  //   源头数量等等）……宫位力量要去考虑的，比如时支力量也比较高」「综合考虑」。
  //   ⇒「源头有力」＝ 源头**在局有落点** **且**（令态支持 **或** 宫位分量合计够重）。
  //   ⚠ 必须先有"在局"这一条：否则会出现"**水在盘里一个落点都没有，却因酉月金生水而令态得相**"
  //     被判有力——那是虚的（实测：乙酉 己酉 甲戌 庚午 就是此例）。
  //   ⚠ 阈值 0.80 ＝ 一个「时支」的分量（GONG_WEIGHT.时支）——**引擎操作化、且未校准**，
  //     与 60%／15个百分点 同规；不得当作古籍明文。
  const 源头五行 = 生我者(el);
  const 源头落点 = 源头五行 ? occupantsOf(chart, 源头五行) : [];
  const 源头宫位和 = Number(源头落点.reduce((a, o) => a + (o.宫位分量 ?? 0), 0).toFixed(3));
  const 源头令态 = 源头五行 ? s.令态[源头五行] : null;
  const 源头在局 = 源头落点.length > 0;
  const 源头月令支持 = 源头令态 != null && ['旺', '次旺', '相'].includes(源头令态);
  const 源头宫位档 = 源头宫位和 >= 1.2 ? '极' : 源头宫位和 >= 0.8 ? '强' : 源头宫位和 >= 0.5 ? '中' : '弱';
  const 源头有力 = 源头在局 && (源头月令支持 || 源头宫位档 === '强' || 源头宫位档 === '极');
  // ⛔ 唯一会自指的情形：el 正是「日主所生」⇒ 源头即日主本字。此时不递归，只报已算出的档。
  const 源头即日主 = !!源头五行 && 源头五行 === dayMasterOf(chart).element;
  /** 「真正虚浮」＝自无根 **且** 源头亦无力（原 `虚露失垣` 只查自根，会把"有源无根"误杀） */
  const 真正虚浮 = 虚露失垣 && !源头有力;

  return {
    五行: el, 档,
    令态, 是司令之神: 是司令, 月支: monthBranch, 司令五行: silingEl ?? null,
    占比, 透干: 干.map((o) => `${o.宫位}${o.字}`),
    通根: 根.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}·${o.性质}`),
    本气根数: 本气根.length, 根数: 根.length,
    虚露失垣,
    // ★ 源头一组（使用者 2026-10-04）：自无根时看"谁在生我"
    源头五行, 源头令态, 源头月令支持, 源头宫位和, 源头宫位档, 源头在局, 源头有力, 源头即日主,
    真正虚浮,
    宫位分量合计: Number(落点.reduce((a, o) => a + (o.宫位分量 ?? 0), 0).toFixed(3)),
    被牵制: 受损, 被合,
    岁运: 岁运段,
    依据,
    断语: 档 === '极' || 档 === '强'
      ? `${el}在局中「**${档}**」——有力，可当制／化／合之任。`
      : 档 === '中'
        ? `${el}在局中「**中**」——**力不足以独任**：能起点作用，但不能独当制／化／合之全责。`
        : `${el}在局中「**弱**」——**无力**${真正虚浮
          ? `（**真虚浮**：自无根、源头${源头五行 ?? '—'}亦无力｜宫位和 ${源头宫位和}／令态 ${源头令态 ?? '—'}）`
          : 虚露失垣 ? `（虽**只透干无自根**，但源头${源头五行}**有力**——宫位和 ${源头宫位和}／令态 ${源头令态 ?? '—'}／档 ${源头宫位档}，故**不算虚浮**）` : ''}，不足以制／化／合。`,
    说明: '档位沿用 `tenGodStrength` 之极／强／中／弱口径，便于两处互证。'
      + '**不合成单一数值评分**；月令为大，人元司令为次，通根透干为实，宫位分量与牵制为余。',
    据: '使用者「能不能制住／化尽／合住，看五行在当月的力量、人元司令、大运配合」；'
      + '《三命通会》人元司事；《八字提要》「虚露失垣……不能制」',
  };
}

/**
 * **位置路径**：判「克者」能否**克到**「受克者」。
 *
 * 统一机制：`通关神 X = 生[克者]`，且须 `生[X] === 受克者`。
 * X 只要在局中，且**与克者贴身、又与受克者贴身**（桥须两头够得着），
 * 则该路**克化为生**，克力记 0；否则**直克**。
 *
 * ⚠ 「有桥 ⇒ 克力 0」只解决**安危**；**压力仍在**（护卫 ≠ 化解，见规格 §一之二 ②），
 * 故每路同时报 `压力系数`（纯按宫位分量与距离计，不叠五行力量）。
 *
 * @param {object} chart
 * @param {string} 克者五行 五者之一
 * @param {string} 受克者五行 五者之一
 * @param {object} [opts]
 * @param {string} [opts.克者宫位] 限定克者落点，如 '月干'
 * @param {string} [opts.受克者宫位] 限定受克者落点，如 '日干'
 * @param {boolean} [opts.受克者含日主=true]
 */
export function pathOf(chart, 克者五行, 受克者五行, opts = {}) {
  const { 克者宫位 = null, 受克者宫位 = null, 受克者含日主 = true } = opts;
  const X = SHENG_MAP[克者五行];
  const 通关五行成立 = SHENG_MAP[X] === 受克者五行;
  const 克方 = occupantsOf(chart, 克者五行, { includeDayStem: false }).filter((o) => !克者宫位 || o.宫位 === 克者宫位);
  const 受方 = occupantsOf(chart, 受克者五行, { includeDayStem: 受克者含日主 }).filter((o) => !受克者宫位 || o.宫位 === 受克者宫位);
  const 通方 = 通关五行成立 ? occupantsOf(chart, X, { includeDayStem: false }) : [];

  const 路 = [];
  for (const k of 克方) {
    for (const s of 受方) {
      if (k.宫位 === s.宫位) continue;
      const 两者 = proximityOf(k.宫位, s.宫位);
      const 桥 = [];
      for (const t of 通方) {
        // 桥可以是**同宫之另一字**（如丑中辛金为克者、丑中癸水为桥）：
        // 同支藏干本自相生，故不排除同宫，只排除「桥即克者本身／即受克者本身」的退化情形。
        // ⚠ 地支落点的 `字` 是**支名**，故同一支内不同藏干须以 `藏` 区分，不可只比 `字`+`层`。
        const 键 = (o) => `${o.宫位}|${o.藏 ?? o.字}|${o.层}`;
        if (键(t) === 键(k) || 键(t) === 键(s)) continue;
        const p1 = proximityOf(t.宫位, k.宫位);
        const p2 = proximityOf(t.宫位, s.宫位);
        if (p1.柱差 > 1 || p2.柱差 > 1) continue;
        const 严格居中 = Math.min(k.柱序, s.柱序) < t.柱序 && t.柱序 < Math.max(k.柱序, s.柱序);
        桥.push({
          宫位: t.宫位, 字: t.字, 层: t.层, 藏: t.藏, 宫位分量: t.宫位分量,
          严格居中, 近克者: p1.档, 近受者: p2.档,
          形态: 严格居中 ? '夹在中间'
            : (t.宫位 === k.宫位 || t.宫位 === s.宫位) ? '同宫引化'
              : '贴身引化',
        });
      }
      const 通 = 桥.length > 0;
      const 压力 = Number(((k.宫位分量 ?? 0) * 两者.系数).toFixed(3));
      路.push({
        克者: `${k.宫位}${k.字}`,
        克者层: k.层,
        受克者: `${s.宫位}${s.字}${s.性质 === '日主自身' ? '（日主）' : ''}`,
        受克者层: s.层,
        两者: 两者.档,
        柱差: 两者.柱差,
        直接可克: !通,
        通关神: 通关五行成立 ? X : null,
        桥,
        结论: 通
          ? `${k.宫位}${k.字}(${克者五行})克${s.宫位}${s.字}(${受克者五行})，而${X}在${桥.map((b) => `${b.宫位}${b.字}(${b.形态})`).join('、')}：`
            + `${克者五行}生${X}、${X}生${受克者五行}，**克化为生，克不到**。`
          : `${k.宫位}${k.字}(${克者五行})与${s.宫位}${s.字}(${受克者五行})相距「${两者.档}」，`
            + (通关五行成立
              ? 通方.length ? `局中之${X}（${通方.map((t) => t.宫位).join('、')}）**够不着两头，不成桥**，故**直克**。` : `局中**无${X}**，故**直克**。`
              : `${克者五行}生${X}而${X}不生${受克者五行}，本无通关可言，**直克**。`),
        克力系数: 通 ? 0 : 压力,
        压力系数: 压力,
      });
    }
  }
  return {
    问: `${克者五行}克${受克者五行}`,
    通关神: 通关五行成立 ? X : null,
    通关五行成立,
    克者落点: 克方.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}`),
    受克者落点: 受方.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}`),
    通关神落点: 通方.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}`),
    路,
    有路可直克: 路.some((x) => x.直接可克),
    贴身可直克: 路.some((x) => x.直接可克 && x.柱差 <= 1),
    力弱之直克: 路.filter((x) => x.直接可克 && x.柱差 >= 2).map((x) => `${x.克者}→${x.受克者}（${x.两者}，系数${x.克力系数}）`),
    // ★ 桥不是"有个字就算"——该字自己有没有力，见 powerOf（使用者：看当月力量、人元司令、大运配合）
    通关神力度: 通关五行成立 ? powerOf(chart, X) : null,
    威胁判据: '**贴身直克（柱差 ≤ 1）方计为构成威胁**；隔位／遥隔之直克力弱，另列 `力弱之直克`，'
      + '是否作威胁须调用方按本派定（使用者：「贴身力度大，隔位力度低」）。',
    说明: '「克力系数」是有桥时记 0（克化为生）后的值；「压力系数」始终保留——'
      + '**护卫 ≠ 化解**：有护卫则不怕被克，但压力仍须待岁运的通关之神到位方能消除（规格 §一之二 ②）。'
      + '两系数**只按宫位分量与距离计**，不叠五行力量。'
      + '⚠ 桥的形态分三种：**夹在中间**（克者与受克者之间确有中宫）、**贴身引化**（桥与两者皆邻柱）、'
      + '**同宫引化**（桥与克者同处一支，如申中庚金为克者而同支壬水为桥——人元之间本自相生）。'
      + '一说「同宫引化」力薄、不当作全化；本引擎仍记其克力为 0，但**同时给出压力系数**，'
      + '由调用方按本派取舍（分歧并陈，不选边）。',
    据: '《滴天髓》通关章／坎离章「成不独成，而有相持者在」；规格 §一之三',
  };
}

/* ------------------------------------------------------------------ *
 * 二十之一、四象配五行 · 十二月配象（两系并列）· 「有救」的阈值
 *   全部经古籍检索落实，凡未检得者明写"未检得"，凡两说并存者并列不调和。
 * ------------------------------------------------------------------ */

/**
 * **太少四象 → 五行**（三书一致，可直接引用）。
 *   水＝太阴／火＝太阳／木＝少阳／金＝少阴／**土＝阴阳老少冲气所结，不入四象**。
 */

export function genWeightOf(chart, el) {
  const 落点 = occupantsOf(chart, el);
  const 干 = 落点.filter((o) => o.层 === '天干');
  const 本气 = 落点.filter((o) => o.层 === '地支本气');
  const 中余 = 落点.filter((o) => o.层 === '地支藏干');
  const stages = 本气.concat(中余).map((o) => ({
    宫位: o.宫位, 字: o.字, 藏: o.藏, 层: o.层,
    十二宫: elementBranchStage(el, BRANCHES.indexOf(o.字)),
  }));
  const 长生禄旺 = stages.filter((x) => ['长生', '临官', '帝旺'].includes(x.十二宫));
  const 墓库 = stages.filter((x) => x.十二宫 === '墓');
  const 档 = 长生禄旺.length ? '重（有长生／禄／刃）'
    : 本气.length ? '重（本气根）'
      : 中余.length ? '轻（仅余气墓库）'
        : 干.length ? '**仅虚露**（有透无根，效力几等于无）'
          : '**无根**';
  return {
    五行: el,
    透干数: 干.length, 本气根数: 本气.length, 中余气根数: 中余.length,
    透干: 干.map((o) => `${o.宫位}${o.字}`),
    本气根: 本气.map((o) => `${o.宫位}${o.字}`),
    中余气根: 中余.map((o) => `${o.宫位}${o.字}${o.藏 ? `(${o.藏})` : ''}`),
    长生禄旺: 长生禄旺.map((x) => `${x.宫位}${x.字}·${x.十二宫}`),
    墓库: 墓库.map((x) => `${x.宫位}${x.字}`),
    根之轻重: 档,
    序: '天干一比肩 ＜ 地支一余气墓库 ＜ 天干二比肩 ＜ 地支一长生禄旺',
    据: '《子平真诠》「得一比肩，不如得支中一墓库……得三比肩，不如得一长生禄刃」「**干多不如根重**」；'
      + '《滴天髓》「天干得一比肩 ＜ 地支得一余气墓库；得二比肩 ＜ 支中得一长生禄旺」',
    反对说: [
      '《穷通宝鉴》「**透干为上，藏支为中**」——与"干多不如根重"**方向相反**',
      '《御定子平》「八宫中虽透出一字**不论**，只以乘气为主」——透干分量＝0',
      '《神峰通考·骨髓歌》「**四柱无根，得时为旺**」——无根亦可因得时而旺',
    ],
    未检得: '任何一书把「有根／透干／得地」三者并列后给出**权重、成数或百分比**——**未检得**；'
      + '库中三者只以**序关系**（如上）或**分档**（《千里命稿》最强／中强／次强）出现。',
  };
}

/**
 * **「有救」的阈值** —— 规格 6.3 只给了定性（有根／透干／得地），未定权重。
 *
 * 古籍检索结论（见 `genWeightOf`）：**库内无权重数值，只有序关系**。
 * 故本函数：
 *   ① 按可引的**序关系**给档：**得令 ＞ 得地 ＞ 透干**（并附《千里命稿》分档）；
 *   ② 凡有反对说者**一律并陈**，不静默取一。
 *
 * @param {object} chart
 * @param {string} el 待判之五行（通常为用神）
 */

export function dayMasterOf(chart) {
  if (chart?.dayMaster?.element) return chart.dayMaster;
  const p = chart?.pillars?.[2];
  if (!p) throw new Error('dayMasterOf: 无法取日主（chart.pillars[2] 缺失）');
  const si = p.stemIndex ?? STEMS.indexOf(p.stem);
  if (si < 0) throw new Error(`dayMasterOf: 日柱天干「${p.stem}」非法`);
  const el = ELEMENTS[STEM_ELEMENT[si]];
  const mb = chart.pillars[1]?.branch ?? BRANCHES[chart.pillars[1]?.branchIndex];
  return {
    stem: STEMS[si],
    element: el,
    yinYang: STEM_YANG[si] ? '阳' : '阴',
    bornMonthBranch: mb,
    stageInMonth: twelveStage(si, BRANCHES.indexOf(mb)),
    season: seasonState(el, mb, kingOf(chart)),
  };
}

/**
 * 输出两档（使用者要求）：**①是否构成威胁（安危）** / **②压力大小**。
 */
/**
 * `canControlOf` 结论的**判定词**（「能制住」／「不能制」／「制而不足」）——供安危文案取标题。
 * ⚠ 2026-10-05：`结论`（硬伤裁决）与 `程度`（分寸裁决）是**两把尺子**，不得互相充当注脚。
 *   （体检表 R8：旧版把 `程度` 当注脚 ⇒ 出现「制不足（制得其宜）」「制不足（制过（尽法无民））」
 *    这类一句话自相矛盾的文案，实测 105/500＝21%。）
 */