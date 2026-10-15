/**
 * 乙体系 · 体用路线法 · 干支多重作用力受力与仲裁模块
 *
 * 规格依据：《规矩/体用路线法.md》、D-030、D-031、D-029、D-034
 * 承载：干支多重作用力四维物理仲裁器、受力状态输出、自合暗合情向、双轨意象词库与动态研判。
 */
import {
  STEMS,
  BRANCHES,
  ELEMENTS,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  SHENG_MAP,
  KE_MAP,
  kingOf,
  elementStrength,
  gzRelations,
  tiaohouAssessment,
  relationsOf,
  五行字,
  LUSHEN,
} from '../engine.mjs';

import {
  branchAt,
  dayMasterOf,
  occupantsOf,
  受损Of,
  受损文字,
  此字五行,
  生我者,
  克我者,
} from './physics.mjs';


export function arbitrateGanzhiForces(chart, opts = {}) {
  const { 用神五行 = null, 岁运 = null } = opts;
  const pillars = chart.pillars;
  const posNames = ['年柱', '月柱', '日柱', '时柱'];
  const posShort = ['年', '月', '日', '时'];
  const D = dayMasterOf(chart).element;

  let luckP = null;
  if (岁运 && 岁运.length >= 2) {
    const s = 岁运[0], b = 岁运[1];
    const si = STEMS.indexOf(s), bi = BRANCHES.indexOf(b);
    if (si >= 0 && bi >= 0) luckP = { stemIndex: si, branchIndex: bi };
  }
  const rels = gzRelations(pillars, luckP);

  const branches = pillars.map(branchAt);
  const stems = pillars.map((p) => p.stem);

  const 逐支受力 = [];

  for (let i = 0; i < 4; i++) {
    const b = branches[i];
    const pos = posNames[i];
    const shortPos = posShort[i];
    const label = `${shortPos}${b}`;

    // 1. 六冲
    const chongs = (rels['地支六冲'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label)).map((x) => {
      const pairStr = String(x.pair ?? x.positions ?? '');
      const otherLabel = pairStr.split(/[—、]/).map((s) => s.trim()).find((s) => !s.startsWith(shortPos));
      const otherPosIdx = otherLabel ? posShort.indexOf(otherLabel[0]) : -1;
      const dist = otherPosIdx >= 0 ? Math.abs(i - otherPosIdx) : 99;
      return { pair: pairStr, otherLabel, otherPosIdx, dist, note: x.note };
    });

    // 2. 六合与自合
    const liuhes = (rels['地支六合'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label)).map((x) => {
      const pairStr = String(x.pair ?? x.positions ?? '');
      const otherLabel = pairStr.split(/[—、]/).map((s) => s.trim()).find((s) => !s.startsWith(shortPos));
      const otherPosIdx = otherLabel ? posShort.indexOf(otherLabel[0]) : -1;
      const dist = otherPosIdx >= 0 ? Math.abs(i - otherPosIdx) : 99;
      return { pair: pairStr, otherLabel, otherPosIdx, dist, 化: x.化 };
    });
    const zihes = (rels['干支自合'] ?? []).filter((x) => x.pillar === shortPos).map((x) => ({
      pair: `${shortPos}柱${x.gz}`,
      otherLabel: `${shortPos}干${x.stem}`,
      otherPosIdx: i,
      dist: 0,
      合: x.合,
    }));
    const hes = [...liuhes, ...zihes];

    // 3. 刑害破绝
    const xings = (rels['地支相刑'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label));
    const hais = (rels['地支相害'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label));
    const posList = (rels['地支相破'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label));
    const jues = (rels['地支相绝'] ?? []).filter((x) => String(x.pair ?? x.positions ?? '').includes(label));

    // 4. 印星贴身引化（贪生忘克）
    let hasYinTransform = false;
    let yinNote = '';
    const bElem = ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(b)]];
    const shengB = 生我者(bElem);
    for (let j = 0; j < 4; j++) {
      if (Math.abs(i - j) <= 1 && j !== i) {
        if (ELEMENTS[STEM_ELEMENT[STEMS.indexOf(stems[j])]] === shengB ||
            ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(branches[j])]] === shengB) {
          hasYinTransform = true;
          yinNote = `${posShort[j]}见${shengB}贴身引化`;
          break;
        }
      }
    }

    // 5. 四维仲裁
    let 最终受力 = '安稳';
    let 仲裁依据 = '原局未见冲刑穿破，受力安稳';
    let 动摇否 = false;

    const minDistChong = chongs.length ? Math.min(...chongs.map((c) => c.dist)) : 999;
    const minDistHe = hes.length ? Math.min(...hes.map((h) => h.dist)) : 999;
    const hasChong = chongs.length > 0;
    const hasHe = hes.length > 0;
    const hasXingHaiPo = (xings.length + hais.length + posList.length + jues.length) > 0;

    if (hasChong && hasHe) {
      if (minDistHe <= 1 && minDistChong >= 2) {
        最终受力 = '贪合免冲';
        仲裁依据 = `贴身相合（柱差${minDistHe}）力大优先，解开隔位相冲（柱差${minDistChong}），字受牵绊合留，贪合忘冲`;
        动摇否 = false;
      } else if (minDistChong <= 1 && minDistHe >= 2) {
        最终受力 = '冲散破合';
        仲裁依据 = `贴身相冲（柱差${minDistChong}）剧烈冲击，近冲破远合，撕裂隔位相合（柱差${minDistHe}），破合动摇`;
        动摇否 = true;
      } else if (minDistChong <= 1 && minDistHe <= 1) {
        最终受力 = '冲散破合';
        仲裁依据 = `冲合俱贴身贴身战克，虽有合象但冲击已至，做功与动摇并见`;
        动摇否 = true;
      } else {
        最终受力 = '贪合免冲';
        仲裁依据 = `合能级优于冲能级，合力羁绊免除动摇`;
        动摇否 = false;
      }
    } else if (hasChong && !hasHe) {
      if (hasYinTransform && minDistChong >= 2) {
        最终受力 = '贪生免克';
        仲裁依据 = `虽有隔位冲克，但得${yinNote}，冲克之气受化，贪生忘克免动摇`;
        动摇否 = false;
      } else {
        最终受力 = '直克动摇';
        仲裁依据 = `原局见相冲（最近柱差${minDistChong}）且无贴身合解救，根基动摇`;
        动摇否 = true;
      }
    } else if (!hasChong && hasXingHaiPo) {
      if (hasHe && minDistHe <= 1) {
        最终受力 = '贪合免冲';
        仲裁依据 = `贴身相合牵住，化解刑穿破害之扰，不作动摇论`;
        动摇否 = false;
      } else {
        最终受力 = '直克动摇';
        仲裁依据 = `受刑穿破害侵扰且无合解，根基动摇`;
        动摇否 = true;
      }
    } else {
      最终受力 = '安稳';
      仲裁依据 = '原局无冲刑穿破，受力安稳';
      动摇否 = false;
    }

    逐支受力.push({
      宫位: pos,
      字: b,
      六冲: chongs,
      相合: hes,
      刑害破绝: { xings, hais, pos: posList, jues },
      最终受力,
      仲裁依据,
      动摇否,
    });
  }

  const 汇总 = {
    安稳数: 逐支受力.filter((x) => x.最终受力 === '安稳').length,
    贪合免冲数: 逐支受力.filter((x) => x.最终受力 === '贪合免冲').length,
    贪生免克数: 逐支受力.filter((x) => x.最终受力 === '贪生免克').length,
    冲散破合数: 逐支受力.filter((x) => x.最终受力 === '冲散破合').length,
    直克动摇数: 逐支受力.filter((x) => x.最终受力 === '直克动摇').length,
  };

  const 总评 = `干支多重作用力四维仲裁完成：`
    + `安稳 ${汇总.安稳数} 支；`
    + `贪合免冲 ${汇总.贪合免冲数} 支；`
    + `贪生免克 ${汇总.贪生免克数} 支；`
    + `冲散破合 ${汇总.冲散破合数} 支；`
    + `直克动摇 ${汇总.直克动摇数} 支。`
    + (汇总.贪合免冲数 > 0 ? '【贴身合解隔位冲】成立；' : '')
    + (汇总.冲散破合数 > 0 ? '【近冲破远合】成立；' : '');

  return {
    法则: '四维物理仲裁（贴身律/能级律/转化律/状态输出）',
    逐支受力,
    汇总,
    总评,
  };
}

/**
 * **第 4 条 · 结构稳定性**（规格 §一之二）。
 *
 * 判据**不是**某一行力量，而是**四柱关联网络是否被切断**：
 * 日主之根、用神之根**所在之支**是否被冲／刑／穿／破（合则另论）。
 * 可传入岁运干支，判该岁运是否**切断根基**。
 *
 * @param {object} chart
 * @param {{用神五行?: string, 岁运?: string}} [opts] 岁运为两字干支，如 '丙寅'
 */
export function structureOf(chart, opts = {}) {
  const D = dayMasterOf(chart).element;
  const { 用神五行 = null, 岁运 = null } = opts;
  const r = relationsOf(chart.pillars);
  const 仲裁 = arbitrateGanzhiForces(chart, opts);
  const 破害键 = [['地支六冲', '冲'], ['地支相刑', '刑'], ['地支相害', '穿'], ['地支相破', '破']];

  const 查根 = (el, 名) => {
    const 根 = occupantsOf(chart, el).filter((o) => o.层 !== '天干');
    return {
      名, 五行: el, 有根: 根.length > 0,
      根: 根.map((o) => {
        const 损 = 受损Of(r, o.宫位, o.字, o.层);
        const 被 = 损.filter((x) => x.途 !== '合');
        const 合 = 损.filter((x) => x.途 === '合');
        const posShort = String(o.宫位)[0];
        const zhicheng = 仲裁.逐支受力.find((z) => z.宫位.startsWith(posShort));
        const 受力状态 = zhicheng?.最终受力 ?? (被.length > 0 ? '直克动摇' : '安稳');
        return {
          宫位: o.宫位, 字: o.字, 藏: o.藏, 层次: o.层, 宫位分量: o.宫位分量,
          被冲刑穿破: 受损文字(被), 被合: 受损文字(合), 被动摇: 被.length > 0,
          受力状态,
          仲裁依据: zhicheng?.仲裁依据 ?? '',
        };
      }),
    };
  };

  const 日主根 = 查根(D, '日主之根');
  const 用神根 = 用神五行 ? 查根(用神五行, '用神之根') : null;

  let 岁运段 = null;
  if (岁运) {
    const gz = String(岁运);
    const stemIndex = STEMS.indexOf(gz[0]);
    const branchIndex = BRANCHES.indexOf(gz[1]);
    if (stemIndex < 0 || branchIndex < 0 || gz.length !== 2) throw new Error(`structureOf: 岁运须为两字干支，收到「${岁运}」`);
    const rr = gzRelations(chart.pillars, { stemIndex, branchIndex });
    const 切 = [];
    for (const [名, root] of [['日主之根', 日主根], ['用神之根', 用神根]].filter((x) => x[1])) {
      for (const g of root.根) {
        const label = `${g.宫位[0]}${g.字}`;
        for (const [k, kind] of 破害键) for (const e of rr[k] ?? []) {
          if (String(e.pair).includes(label) && String(e.pair).includes('大运')) {
            切.push({ 根: `${名}·${g.宫位}${g.字}`, 途: kind, 关系: e.pair });
          }
        }
      }
    }
    const 岁运落点 = [`大运干${gz[0]}`, `大运支${gz[1]}`];
    岁运段 = {
      干支: 岁运, 岁运落点, 与原局关系: rr, 切根: 切,
      结论: 切.length
        ? `**岁运切断根基**：${切.map((x) => `${x.根}被${x.途}（${x.关系}）`).join('、')}`
        : '该岁运未直接冲刑原局之根。',
    };
  }

  // 去重：日主之根与用神之根**常为同一批支**（同一支可同时载日主之气与用神之气，
  // 如寅载甲(木)与丙(火)；用神五行＝日主五行时更是完全同根，如丁火日主取火为用）。
  // 旧实现把两列表直接拼接，导致同一根被计两次、「原局有 N 处根被动摇」数字翻倍（2→4）。
  const 根键 = (x) => `${x.宫位}|${x.字}|${x.层次}`;
  const 动摇根 = (root) => (root?.根 ?? []).filter((g) => g.被动摇);
  const 日主动摇 = 动摇根(日主根);
  const 用神动摇 = 动摇根(用神根);
  const 日主键 = new Set(日主动摇.map(根键));
  const 用神键 = new Set(用神动摇.map(根键));
  const 动摇 = [];
  const 已见 = new Set();
  for (const [名, list] of [['日主之根', 日主动摇], ['用神之根', 用神动摇]]) {
    for (const g of list) {
      const k = 根键(g);
      if (已见.has(k)) continue;
      已见.add(k);
      动摇.push({ ...g, 兼: 名, 同根: 日主键.has(k) && 用神键.has(k) });
    }
  }
  const 动摇数 = {
    日主之根: 日主键.size,
    用神之根: 用神键.size,
    同根: [...日主键].filter((k) => 用神键.has(k)).length,
    合计: 动摇.length,
  };
  const 名短 = { 日主之根: '日主', 用神之根: '用神' };

  // ★（一）「合」计入动根 —— 使用者 2026-09-28 裁「**算**，但是要看谁去合谁」。
  // 三层合看：①被合者身份（日主之根／用神之根…）②合的方向（外来合走 / 合入家中）③合方本身对全局之吉凶。
  // 特例：忌神来合用神 ≠ 用神被坏，而是"用神锁住忌神、发挥了作用"（但用神自身被占用，仍有代价）。
  const 合判 = [];
  const 合已见 = new Set();
  const 内外 = (宫) => (String(宫).startsWith('年') || String(宫).startsWith('月')) ? '外' : '内';
  const 六合对 = r.地支六合 ?? [];
  for (const [名, list] of [['日主之根', 日主根.根], ['用神之根', 用神根?.根 ?? []]]) {
    for (const g of list) {
      const 本 = `${String(g.宫位)[0]}${g.字}`;                 // 如「年巳」
      for (const h of 六合对) {
        const pair = String(h.pair ?? '');
        if (!pair.includes(本)) continue;
        const parts = pair.split('—').map((s) => s.trim());
        const 他 = parts.find((p) => p !== 本) ?? '';
        const 他支 = 他.slice(-1);
        const bi = BRANCHES.indexOf(他支);
        if (bi < 0) continue;
        const 他五行 = ELEMENTS[BRANCH_ELEMENT[bi]];
        const 他处 = 他.startsWith('大运') ? '大运' : (他.startsWith('年') || 他.startsWith('月') ? '外' : '内');
        const key = `${名}|${g.宫位}${g.字}|${他}`;
        if (合已见.has(key)) continue;
        合已见.add(key);
        const 对日主 = 他五行 === 克我者(D) ? '克我(官杀)' : 他五行 === 生我者(D) ? '生我(印)' : 他五行 === SHENG_MAP[D] ? '我生(食伤)' : 他五行 === KE_MAP[D] ? '我克(财)' : '同我(比劫)';
        let 判;
        if (名 === '日主之根' && 他五行 === 克我者(D)) {
          判 = `⚠ 日主之根被**官杀（${他五行}）**合走 ⇒ 按使用者「卯被申合走」之例，**不吉**`;
        } else if (名 === '日主之根' && 他五行 === 生我者(D)) {
          判 = `日主之根与**印（${他五行}）**相合（${他处}方），「外来喜神被合入家中」之型 ⇒ **偏吉**，仍须看该神对全局吉凶`;
        } else if (名 === '用神之根' && 用神五行 && 他五行 === 克我者(用神五行)) {
          判 = `⚠ 用神之根被**克用神者（${他五行}）**合走 ⇒ 用神之根被动摇`;
        } else if (名 === '用神之根' && 用神五行 && 他五行 === KE_MAP[用神五行]) {
          判 = `用神之根与**用神所克者（${他五行}）**相合 ⇒ 正是「**火去合克金**」之型：用神合忌神＝做功，`
            + `**但用神之根被牵住、须标代价**（使用者例：壬合丁，丁发挥作用、丙不受伤，但"会有影响"）`;
        } else if (名 === '用神之根' && 用神五行 && 他五行 === 生我者(用神五行)) {
          判 = `用神之根与**生用神者（${他五行}）**相合 ⇒ 用神之源被牵住，**做功但须标代价**（使用者：「发挥了作用……但是会有影响」）`;
        } else {
          判 = `见合（${pair}）：计入动根；吉凶须按合方（${他五行}·${对日主}）对全局之角色定，引擎不预判`;
        }
        合判.push({
          被合者: `${名}·${g.宫位}${g.字}`, 合方: 他, 合方五行: 他五行, 合方与日主: 对日主,
          内外: `${内外(g.宫位)}×${他处}`, 化: h.化 ?? null, 判语: 判,
        });
      }
    }
  }

  const 结语 = [];
  if (!日主根.有根) {
    结语.push(`⚠ **日主${D}地支无根**（四支藏干皆无${D}）——`
      + `此即规格 §二所指「从」的前提（日主无一丝生扶）；**须先走特殊格局排查**，不可径以正格论强弱。`);
  }
  if (动摇.length) {
    const 角色 = 动摇数.同根
      ? `（日主之根 ${动摇数.日主之根} 处、用神之根 ${动摇数.用神之根} 处，其中 **${动摇数.同根} 处为日主与用神同根**）`
      : `（日主之根 ${动摇数.日主之根} 处、用神之根 ${动摇数.用神之根} 处）`;
    结语.push(`原局有 ${动摇.length} 处根被动摇${角色}：`
      + `${动摇.map((x) => `${名短[x.兼]}${x.同根 ? '·同根' : ''}${x.宫位}${x.字}`).join('、')}。`
      + `⚠ **「根被冲刑」不等于结构即破**：合与冲并见（如巳申既六合又相破）、或冲而逢合救，`
      + `须并陈两说，不得径判结构已破。`);
  }
  if (合判.length) {
    结语.push(`另有 **${合判.length} 处根被「合」**（使用者 2026-09-28 裁：**合亦计入动根，但须辨谁合谁**）：`
      + 合判.map((x) => `${x.被合者}—${x.合方}[${x.内外}${x.化 ? `化${x.化}` : ''}]${x.判语}`).join('；'));
  }
  if (岁运段?.切根.length) {
    结语.push(岁运段.结论 + `（所切者：${岁运段.切根.map((x) => `${x.根}·${x.途}`).join('、')}）`);
  }
    if (!结语.length) {
    结语.push(用神根
      ? '原局日主之根与用神之根皆未被冲刑穿破，结构未见切断。'
      : '原局**日主之根**未见冲刑穿破；⚠ **用神未声明 ⇒ 用神之根未算**，故本节不含用神之根的结论。');
  }

  if (仲裁?.总评) {
    结语.push(`【干支受力仲裁】${仲裁.总评}`);
  }

  return {
    日主五行: D,
    原局关联: r,
    多重仲裁: 仲裁,
    日主之根: 日主根,
    用神之根: 用神根,
    岁运: 岁运段,
    动摇之根: 动摇.map((x) => `${x.宫位}${x.字}（${x.同根 ? '日主与用神同根；' : ''}${x.被冲刑穿破.join('、')}；受力：${x.受力状态 ?? '直克动摇'}）`),
    动摇计数: { 合计: 动摇.length, ...动摇数 },
    受力汇总: 仲裁.汇总,
    合之动根: 合判,
    结论: 结语.join(' '),
    说明: '本节只报**关联网络**与**根是否被动摇**，不代判格局成败；'
      + '"护卫链闭环 ＝ 结构稳定"是引擎作者的推断、**非使用者原话**，故不写入本函数结论（规格 §一之二 复盘第 3 条）。',
    据: '规格 §一之二「第 4 条 · 根基」；《滴天髓》通关章；D-030 干支多重作用力并发四维仲裁法则',
  };
}

/**
 * **承载重估** —— 使用者 2026-09-28：「官杀是好是坏，看**日主能否承载**」；
> 而承载**随运可升**：大运／流年若补根（比劫、印之本气）则承载升 ⇒ 官杀由"杀"转"贵"；出运复原。
 * ★ **夺根降级与动态重估（D-040 / P-019 落地）**：本函数已实现岁运六冲夺根检测，
 *   若日主本气通根被冲拔，判定为「夺根降级」；尚余本气根则判「动摇降级」；出运复原。
 *
 * 口径并陈：**实战派**——中气、余气不算正式根气；**子平**——另计通根深浅。本表两层都报。
 *
 * @param {object} chart
 * @param {{岁运?: string}} [opts] 指定某一步岁运；缺省则逐大运全列
 */

export function selfHiddenCombineOf(chart, opts = {}) {
  let luckP = null;
  if (opts.岁运 && opts.岁运.length >= 2) {
    const s = opts.岁运[0], b = opts.岁运[1];
    const si = STEMS.indexOf(s), bi = BRANCHES.indexOf(b);
    if (si >= 0 && bi >= 0) luckP = { stemIndex: si, branchIndex: bi };
  }
  const rels = gzRelations(chart.pillars, luckP);
  const zfs = rels['干支自合'] ?? [];
  const ahs = rels['地支暗合'] ?? [];
  const riZihe = zfs.find((x) => x.pillar === '日') ?? null;
  const taZihe = zfs.filter((x) => x.pillar !== '日');

  let 判定 = '无暗合';
  if (riZihe && ahs.length > 0) {
    判定 = '自合兼暗合';
  } else if (riZihe && ahs.length === 0) {
    判定 = '日柱自合';
  } else if (!riZihe && taZihe.length > 0 && ahs.length > 0) {
    判定 = '自合兼暗合';
  } else if (!riZihe && taZihe.length > 0 && ahs.length === 0) {
    判定 = '他柱自合';
  } else if (zfs.length === 0 && ahs.length > 0) {
    判定 = '地支暗合';
  }

  const 说明条 = [];
  if (riZihe) {
    说明条.push(`日柱【${riZihe.gz}】自坐暗合（${riZihe.合}，暗藏${riZihe.藏干}）：同柱干支自合自绊，情向内敛，吉凶受全局主要矛盾与用忌统率`);
  }
  for (const tz of taZihe) {
    说明条.push(`${tz.pillar}柱【${tz.gz}】自合（${tz.合}，暗藏${tz.藏干}）：同柱干支相引自合，情向内敛`);
  }
  for (const ah of ahs) {
    说明条.push(`地支【${ah.pair}】暗合（${ah.合}）：${ah.note}`);
  }
  if (说明条.length === 0) {
    说明条.push('局中无干支自合柱，亦无地支暗合，纯以正五行明见刑冲生克论做功');
  }

  return {
    判定,
    日柱自合: riZihe,
    他柱自合: taZihe,
    地支暗合: ahs,
    自合明细: zfs,
    说明: 说明条.join('；'),
    据: 'P-015 判据 / D-029 裁定：干支自合七柱与地支暗合三组识别法则',
  };
}

/**
 * 全天干地支作用关系《双轨意象矩阵库》（D-031 裁定）
 * 拒绝单向褒贬裹挟，每类物理关系均设立【为喜（成全用神/制化忌神）】与【为忌（损伤用神/动摇根基）】双轨应象。
 */
export const DUAL_IMAGE_LIBRARY = {
  地支六冲: {
    喜象: '除旧布新、破土开局、冲去忌煞、战胜凶顽、破而后立、建功异地',
    忌象: '拔根倾摇、动荡波折、奔波劳碌、破败损伤、根基溃决、事多反复',
    出处: '《滴天髓》「旺者冲衰衰者拔，衰神冲旺旺神发」；冲去忌神反为奇',
  },
  地支六合: {
    喜象: '天地交泰、暗掌乾坤、合作共赢、情义和顺、锁住凶煞、积聚资粮',
    忌象: '贪合忘贵、因私废公、羁绊拖累、合化助忌、泥足深陷、动弹不得',
    出处: '《渊海子平》「合得官星荣显，合去七杀威权」；若合绊用神则减福',
  },
  地支半合: {
    喜象: '结党聚气、众志成城、虚拱引贵、顺水推舟、聚沙成塔',
    忌象: '党羽暗聚、暗引凶神、助长忌党、私门结党、牵连拖沓',
    出处: '《子平真诠》「生旺相聚，墓库归宿，暗助局势」',
  },
  地支相刑: {
    喜象: '煞刃相刑逢制执掌刑柄、权威显赫、出奇制胜、执法立威、军旅功名',
    忌象: '刑伤破耗、骨肉反目、官非纠葛、暗生摩擦、病痛手术、情义相残',
    出处: '《三命通会》「君子不刑定不发，若居仕路多腾达」；小人刑则多凶咎',
  },
  地支相害: {
    喜象: '穿倒凶神、破坏忌党、出奇制胜、偏门取贵、快刀斩乱麻',
    忌象: '暗地掣肘、小人反噬、暗疾潜伏、骨肉离心、背信弃义、恩义尽失',
    出处: '《盲派与象法》「穿倒禄身寿不长」；穿去凶煞反显偏才之能',
  },
  地支相破: {
    喜象: '打破僵局、破旧立新、除敝改弦、改换门庭、化解胶着',
    忌象: '暗中损耗、事多缺憾、摩擦内耗、美玉微瑕、晚景破损',
    出处: '《渊海子平》论破：事有参差，吉神破则减福，凶神破则消灾',
  },
  地支相绝: {
    喜象: '绝处逢生、截断凶党、斩断乱麻、脱离泥潭、向死而生',
    忌象: '气机断绝、情义反背、根气断灭、因病损折、进退维谷',
    出处: '《古法三命》「绝处逢生，天地相纽」；绝于凶位则殃害息',
  },
  天干五合: {
    喜象: '羁绊为用、合化生辉、化敌为友、暗通声气、情深意重',
    忌象: '贪合忘生、用神被绊、志气消沉、因私损公、依附羁留',
    出处: '《滴天髓》「合去官星留杀清，合去七杀官星纯」；用神逢合失自由',
  },
  天干相克: {
    喜象: '克制凶顽、裁抑过胜、修剪成材、攻伐建威、扫清障碍',
    忌象: '摧折身主、重压摧残、用神伤损、进退失据、动辄得咎',
    出处: '《子平真诠》「身旺得官克，如金得火炼」；身弱受克则夭折',
  },
  干支自合: {
    喜象: '自力更生、专心致志、暗得其禄、情向专一、天地归心',
    忌象: '固步自封、闭门内耗、因私废业、自我纠缠、暗度私情',
    出处: '《滴天髓》自坐暗合做功；同柱相吸，吉凶视全局主要矛盾为转移',
  },
  天地鸳鸯合: {
    喜象: '同心同德、德行深厚、贵人提携、福庆连绵、天地垂象',
    忌象: '上下胶着、双重合绊、深陷局中、难以自拔、尾大不掉',
    出处: '《三命通会》「天地德合，大贵大福」；若合绊真神则终身羁留',
  },
  反吟: {
    喜象: '拨乱反正、剧烈突破、打破死局、雷霆万钧、扭转乾坤',
    忌象: '天地翻覆、大动倾危、剧震损身、门户倾颓、风波骤起',
    出处: '《滴天髓》「反吟伏吟泪淋淋」；若天克地冲破除大凶党，反见奇勋',
  },
};

/**
 * **全天干地支作用关系《双轨意象矩阵与动态输出系统》**（D-031 裁定）
 *
 * 根据命盘的主要矛盾与用忌统率，对全局检出的物理关系动态定性为【为喜】、【为忌】或【中性】，
 * 并分别映射建设性喜象与破坏性忌象。
 *
 * @param {object} chart
 * @param {{主要矛盾?: object, 用神五行?: string, 岁运?: string}} [opts]
 */
export function dualImageMatrixOf(chart, opts = {}) {
  const { 主要矛盾 = null, 用神五行 = null, 岁运 = null } = opts;
  const D = dayMasterOf(chart).element;
  const dayStem = dayMasterOf(chart).stem;
  const luBranch = LUSHEN ? LUSHEN[dayStem] : null;

  // 1. 确定全局用神五行
  let yongEl = 用神五行 ? 五行字(用神五行) : null;
  if (!yongEl && 主要矛盾?.四之二_取用定案?.改判用神) {
    yongEl = 五行字(主要矛盾.四之二_取用定案.改判用神);
  }
  if (!yongEl) {
    yongEl = 五行字(tiaohouAssessment(chart)?.用神);
  }

  // 2. 确定局中忌神/凶党五行
  let jiElList = [];
  if (yongEl) {
    jiElList.push(克我者(yongEl));
  }
  if (主要矛盾?.官杀吉凶?.日主担力 === '不可任') {
    jiElList.push(克我者(D));
  }
  const 占比 = elementStrength(chart.pillars, branchAt(chart.pillars[1]), kingOf(chart)).percent;
  const 旺序 = [...ELEMENTS].sort((a, b) => 占比[b] - 占比[a]);
  if (旺序[0] && 占比[旺序[0]] >= 35 && 旺序[0] !== yongEl && 旺序[0] !== D) {
    jiElList.push(旺序[0]);
  }
  jiElList = [...new Set(jiElList.filter(Boolean))];

  // 3. 提取原局关系
  let luckP = null;
  if (岁运 && 岁运.length >= 2) {
    const s = 岁运[0], b = 岁运[1];
    const si = STEMS.indexOf(s), bi = BRANCHES.indexOf(b);
    if (si >= 0 && bi >= 0) luckP = { stemIndex: si, branchIndex: bi };
  }
  const rels = gzRelations(chart.pillars, luckP);

  const 关系条目 = [];

  const extractChars = (pairStr) => {
    const m = String(pairStr).match(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g);
    return m ? [...new Set(m)] : [];
  };

  const judgeRelation = (类别, pair, note, extra = {}) => {
    const chars = extractChars(pair);
    const lib = DUAL_IMAGE_LIBRARY[类别] ?? {
      喜象: '成全顺遂、转化生辉',
      忌象: '相战损伤、阻滞内耗',
      出处: '体用路线法干支双轨意象法则',
    };

    let 定性 = '中性';
    let 依据 = '吉凶参半，随岁运引化而定';
    let 动态应象 = `${lib.喜象}（喜）／${lib.忌象}（忌）`;

    const els = chars.map((ch) => 此字五行(ch)).filter(Boolean);
    const hasYong = els.includes(yongEl);
    const hasJi = els.some((el) => jiElList.includes(el));
    const hasLu = luBranch && chars.includes(luBranch);

    const isDestructive = /冲|克|穿|刑|破|绝|反吟/.test(类别);
    const isCohesive = /合|自合|鸳鸯/.test(类别);

    if (isDestructive) {
      if (hasJi && !hasYong && !hasLu) {
        定性 = '为喜';
        依据 = `破坏方制裁削弱局中忌神（${jiElList.join('、')}），去浊扬清`;
        动态应象 = lib.喜象;
      } else if (hasYong || hasLu) {
        定性 = '为忌';
        依据 = `破坏方直接损伤全局用神【${hasYong ? yongEl : ''}】或日主禄根【${hasLu ? luBranch : ''}】，破基伤用`;
        动态应象 = lib.忌象;
      } else {
        定性 = '中性';
        依据 = '两相对峙，未直犯要穴，喜忌双轨并陈';
        动态应象 = `${lib.喜象}（喜）／${lib.忌象}（忌）`;
      }
    } else if (isCohesive) {
      if (hasJi && !hasYong) {
        定性 = '为喜';
        依据 = `合绊局中忌党（${jiElList.join('、')}），使凶煞失威为我所用`;
        动态应象 = lib.喜象;
      } else if (hasYong && !hasJi) {
        定性 = '为忌';
        依据 = `用神【${yongEl}】逢合受绊，失去施展自由，贪合忘做功`;
        动态应象 = lib.忌象;
      } else {
        定性 = '为喜';
        依据 = '干支天地相纽，聚气有情，相安为利';
        动态应象 = lib.喜象;
      }
    }

    关系条目.push({
      类别,
      pair,
      定性,
      字: chars.join(''),
      动态应象,
      喜象: lib.喜象,
      忌象: lib.忌象,
      依据,
      出处: lib.出处,
      note: note || '',
      ...extra,
    });
  };

  for (const item of (rels['天干五合'] ?? [])) {
    judgeRelation('天干五合', item.pair, item.化 ? `合化${item.化}` : '');
  }
  for (const item of (rels['天干相克'] ?? [])) {
    judgeRelation('天干相克', item.pair, item.type || '');
  }
  for (const item of (rels['地支六合'] ?? [])) {
    judgeRelation('地支六合', item.pair, item.化 ? `合化${item.化}` : '');
  }
  for (const item of (rels['地支半合'] ?? [])) {
    judgeRelation('地支半合', item.pair, `${item.type}（${item.拱 ? '拱' + item.拱 : ''}化${item.化}）`);
  }
  for (const item of (rels['地支六冲'] ?? [])) {
    judgeRelation('地支六冲', item.pair, item.note || '');
  }
  for (const item of (rels['地支相刑'] ?? [])) {
    const pairStr = item.pair ?? `${item.positions}（${item.members}）`;
    const noteStr = `${item.刑 ?? item.kind ?? '相刑'}（${item.口径 ?? item.type ?? ''}）`;
    judgeRelation('地支相刑', pairStr, noteStr);
  }
  for (const item of (rels['地支相害'] ?? [])) {
    judgeRelation('地支相害', item.pair, item.note || '');
  }
  for (const item of (rels['地支相破'] ?? [])) {
    judgeRelation('地支相破', item.pair, item.note || '');
  }
  for (const item of (rels['地支相绝'] ?? [])) {
    judgeRelation('地支相绝', item.pair, item.绝 || '');
  }
  for (const item of (rels['干支自合'] ?? [])) {
    judgeRelation('干支自合', `${item.pillar}柱${item.gz}`, item.合 || '');
  }
  for (const item of (rels['鸳鸯合'] ?? [])) {
    judgeRelation('天地鸳鸯合', item.pair, `${item.天合}且${item.地合}`);
  }
  for (const item of (rels['反吟'] ?? [])) {
    judgeRelation('反吟', item.pair, `${item.天干}且${item.地支}`);
  }

  const 喜项统计 = 关系条目.filter((r) => r.定性 === '为喜').length;
  const 忌项统计 = 关系条目.filter((r) => r.定性 === '为忌').length;
  const 中性统计 = 关系条目.filter((r) => r.定性 === '中性').length;

  const 总评 = `全局检出 ${关系条目.length} 组干支作用力：`
    + `成全用神/制化忌神为喜 ${喜项统计} 项；`
    + `损伤用神/动摇根气为忌 ${忌项统计} 项；`
    + `吉凶参半双轨中性 ${中性统计} 项。`
    + `任何关系绝非单向定吉凶，一切以命局主要矛盾与用忌统率为归宿。`;

  return {
    总评,
    条目数: 关系条目.length,
    关系条目,
    喜项统计,
    忌项统计,
    中性统计,
    用神参考: yongEl,
    忌神参考: jiElList,
    法理说明: 'D-031 全天干地支作用关系双轨意象法则：拒绝单向低俗定吉凶，喜忌双轨输出。',
  };
}

/**
 * **乙体系推演大脑覆盖率检视与认怂出口**（D-037 裁定 · 宪法第五条第三款）
 *
 * 践行立宪底线誓言：
 * 《AGENTS.md》§0「乙体系未覆盖的局面 ⇒ 只并陈，明写『本体系未覆盖，暂不判断』，不硬答」。
 *
 * 触发认怂（covered = false）场景：
 *   1. 显式声明未覆盖：opts.未覆盖 === true 或 opts.covered === false；
 *   2. 极端死结相战：四柱无通关枢纽，两神极战均停（各占35%以上且差距<=3%）且无通关之神，从正两难；
 *   3. 虚妄用神：所声明用神在局中全无根气与生源，与主要矛盾完全相反。
 *
 * @param {object} chart
 * @param {object} [opts]
 */