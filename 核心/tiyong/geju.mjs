/**
 * 乙体系 · 体用路线法 · 格局成破、从格与覆盖率熔断模块
 *
 * 规格依据：《规矩/判据.md》（P-016、P-018、P-021）、D-032、D-037、D-042
 * 承载：乙体系未覆盖熔断认怂出口(P-018)、从儿格见比劫判定与流通归宿(P-016)、子平八格成破救应全矩阵研判(P-021)。
 */
import {
  STEMS,
  BRANCHES,
  ELEMENTS,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  HIDDEN_STEMS_SPEC,
  tenGod,
  SHENG_MAP,
  KE_MAP,
  kingOf,
  elementStrength,
  gzRelations,
  tenGodStrength,
  specialGejuOf,
} from '../engine.mjs';

import {
  stemAt,
  branchAt,
  dayMasterOf,
  proximityOf,
  occupantsOf,
  生我者,
  克我者,
} from './physics.mjs';


export function coverageOf(chart, opts = {}) {
  // 1. 显式声明未覆盖
  if (opts.未覆盖 === true || opts.covered === false) {
    return {
      covered: false,
      判定: '本体系未覆盖，暂不判断',
      结论: '本体系未覆盖，暂不判断',
      原因: opts.原因 || '调用方或命局标记为本体系暂未覆盖之复杂外格/未知相战',
      依据: '《AGENTS.md》§0「乙体系未覆盖的局面 ⇒ 只并陈，明写『本体系未覆盖，暂不判断』，不硬答」；《规矩/宪法.md》',
    };
  }

  // 2. 极端死结相战（P-018 两神极战均停且无通关之神）
  const D = dayMasterOf(chart).element;
  const percent = elementStrength(chart.pillars, branchAt(chart.pillars[1]), kingOf(chart)).percent;
  const 旺序 = [...ELEMENTS].sort((a, b) => percent[b] - percent[a]);
  const e1 = 旺序[0], e2 = 旺序[1];
  const isDirectClash = KE_MAP[e1] === e2 || KE_MAP[e2] === e1;
  const bridgeElem = KE_MAP[e1] === e2 ? 生我者(e2) : 生我者(e1);
  const bridgeOccupants = bridgeElem ? occupantsOf(chart, bridgeElem) : [];

  if (percent[e1] >= 30 && percent[e2] >= 30 && (percent[e1] + percent[e2] >= 70) && isDirectClash && bridgeOccupants.length === 0) {
    const 特殊 = specialGejuOf(chart).成立者 ?? [];
    if (!特殊.some((x) => /从|专旺|化气/.test(String(x)))) {
      return {
        covered: false,
        判定: '本体系未覆盖，暂不判断',
        结论: '本体系未覆盖，暂不判断',
        原因: `局中两神（${e1}与${e2}）极战均停（合占 ${(percent[e1] + percent[e2]).toFixed(1)}%）且无通关之神（${bridgeElem}），两神交战死结，已超出现行普通格与特殊格判据覆盖范畴`,
        依据: '《AGENTS.md》§0「乙体系未覆盖的局面 ⇒ 只并陈，明写『本体系未覆盖，暂不判断』，不硬答」；《规矩/宪法.md》',
      };
    }
  }

  // 3. 一气专旺格局（未立宪外格主动熔断）
  // 乙体系《体用路线法》现行判据（P-001～P-021）仅覆盖正格与从儿格（P-016），
  // 未对一气专旺格局（曲直/炎上/稼穑/从革/润下/纯四柱同干支）立宪。
  // 当局中同党占绝对统治地位（>= 80%）且天干无任何异党（食伤/财星/官杀）透出流通引导，
  // 或四柱天元一气纯同党干支时，正格体用路线无法确立用神，必须主动熔断认怂，坚决不硬答。
  const 印五行 = 生我者(D);
  const 同党比印占比 = (percent[D] || 0) + (percent[印五行] || 0);
  const 天干异党透出 = chart.pillars.some((p) => {
    const s = p.stem || STEMS[p.stemIndex];
    const elem = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(s)]];
    return elem !== D && elem !== 印五行;
  });
  const 四柱纯同一同党干支 = chart.pillars.every((p) => (p.gz === chart.pillars[0].gz));

  const isZhuanWang = 同党比印占比 >= 80 && !天干异党透出;
  const isPureGz = 四柱纯同一同党干支 && !天干异党透出;

  if (isZhuanWang || isPureGz) {
    const patternDetail = isZhuanWang
      ? `一气专旺格局（同党比印占 ${同党比印占比.toFixed(1)}% 且天干无食伤财官流通引导）`
      : `四柱天元一气纯同干支格局（${chart.pillars[0].gz} 纯一，同党比印占 ${同党比印占比.toFixed(1)}%）`;
    return {
      covered: false,
      判定: '本体系未覆盖，暂不判断',
      结论: '本体系未覆盖，暂不判断',
      原因: `命局属于${patternDetail}，乙体系《体用路线法》现行判据（P-001～P-021）仅覆盖正格与从儿格，未对专旺与天元一气纯同干支等特殊格局立宪，依据宪法铁律「未覆盖不硬答」，本体系暂不作价值推演`,
      依据: '《AGENTS.md》§0「乙体系未覆盖的局面 ⇒ 只并陈，明写『本体系未覆盖，暂不判断』，不硬答」；《规矩/宪法.md》',
    };
  }

  return {
    covered: true,
    判定: '本体系已覆盖',
    结论: '命局在体用路线法宪法判据体系覆盖之内，正常输出推演研判',
    原因: '命局主要矛盾与五行流通路线明确，有法可依',
    依据: '《规矩/判据.md》P-001～P-015；《规矩/体用路线法.md》',
  };
}

/**
 * **从儿格见比劫判定与流通归宿研判**（D-032 / 判据 P-016）。
 *
 * 典籍法理（《滴天髓》《千里命稿》）：
 *   ① 「从儿不管身强弱，只要我儿又见儿」：以食伤为用，顺生流通；
 *   ② 比劫顺生食伤通常为喜（比劫生食伤，秀气有源，不悖从儿之势）；
 *   ③ 印绶破格（枭神夺食）为第一大忌；
 *   ④ 官杀相战（伤官见官）为忌；
 *   ⑤ 若局中比劫与财星贴身直克（柱差 <= 1）且无食伤在两者之间通关，
 *      判定为「越位夺财为忌」（虽从儿亦有争财破耗之害）。
 *
 * @param {object} chart
 * @param {object} [opts]
 * @returns {object}
 */
export function congErAnalysisOf(chart, opts = {}) {
  const pillars = chart.pillars;
  const D = dayMasterOf(chart).element;
  const monthBranch = branchAt(pillars[1]);
  const s = elementStrength(pillars, monthBranch, kingOf(chart));
  const 占比 = s.percent;
  const tgs = tenGodStrength(chart);
  const byGod = Object.fromEntries((tgs.各十神 ?? []).map((x) => [x.十神, x]));
  const sg = specialGejuOf(chart);
  const 特殊成立 = sg.成立者 ?? [];

  const 食伤五行 = SHENG_MAP[D];
  const 财星五行 = KE_MAP[D];
  const 官杀五行 = 克我者(D);
  const 印星五行 = 生我者(D);
  const 比劫五行 = D;

  const 食伤占比 = 占比[食伤五行] ?? 0;
  const 印星占比 = 占比[印星五行] ?? 0;
  const 月令五行 = ELEMENTS[BRANCH_ELEMENT[BRANCHES.indexOf(monthBranch)]];
  const 月令食伤 = 月令五行 === 食伤五行;

  const R = ['极', '强', '中', '弱'];
  const 食伤力 = Math.min(R.indexOf(byGod['食神']?.级别 ?? '弱'), R.indexOf(byGod['伤官']?.级别 ?? '弱'));
  const 印星力 = Math.min(R.indexOf(byGod['正印']?.级别 ?? '弱'), R.indexOf(byGod['偏印']?.级别 ?? '弱'));

  const 标记从儿 = 特殊成立.includes('从儿');
  const 属于从儿 = 标记从儿 || (月令食伤 && 食伤占比 >= 30 && 印星力 >= 2 && 印星占比 < 12);

  if (!属于从儿) {
    return {
      属于从儿: false,
      说明: '局中食伤未达从儿独旺标准，或印星有力破格，不入从儿格',
    };
  }

  // 1. 印绶检验
  const 印落点 = occupantsOf(chart, 印星五行).filter((o) => o.层 === '天干' || o.层 === '地支本气');
  const 印破格 = 印落点.length > 0 && 印星占比 >= 10;
  const 印绶判定 = {
    角色: 印破格 ? '枭印破格' : '无破格之虞',
    说明: 印破格
      ? `局中见${印星五行}（印绶）有力透藏，枭神夺食犯旺逆势，破从儿之格`
      : `局中无印绶破格，或印星衰绝无力，从儿气势得以保全`,
  };

  // 2. 官杀检验
  const 官杀落点 = occupantsOf(chart, 官杀五行).filter((o) => o.层 === '天干' || o.层 === '地支本气');
  const 财落点 = occupantsOf(chart, 财星五行).filter((o) => o.层 === '天干' || o.层 === '地支本气');
  const 有官杀 = 官杀落点.length > 0;
  const 官杀相战 = 有官杀 && (占比[官杀五行] ?? 0) >= 10 && 财落点.length === 0;
  const 官杀判定 = {
    角色: 官杀相战 ? '相战为忌（伤官见官）' : '无相战之害',
    说明: 官杀相战
      ? `局中见${官杀五行}（官杀）透藏，与食伤直接相战，伤官见官局势动荡`
      : (有官杀 ? `官杀有财星通关转化，不直接冲犯食伤` : `局无官杀相犯，气势专一`),
  };

  // 3. 比劫角色判定（P-016 核心重点）
  const 比劫落点 = occupantsOf(chart, 比劫五行).filter((o) => o.性质 !== '日主自身');
  let 比劫判定;
  if (比劫落点.length === 0) {
    比劫判定 = {
      角色: '无透藏',
      说明: '局中无比劫透藏，日主全神贯注于食伤',
    };
  } else {
    const 食伤落点 = occupantsOf(chart, 食伤五行);
    let 存在越位夺财 = false;
    let 夺财细节 = '';

    for (const b of 比劫落点) {
      for (const c of 财落点) {
        const prox = proximityOf(b.宫位, c.宫位);
        if (prox.柱差 <= 1) {
          let hasTongGuan = false;
          if (prox.柱差 === 0) {
            // 同柱直克（盖头截脚）：通关之神必须在同柱（同柱藏有或透出食伤）
            hasTongGuan = 食伤落点.some((s) => s.宫位[0] === b.宫位[0]);
          } else {
            // 邻柱直克（柱差1）：若同为天干直克，须天干透出食伤或同柱引化
            hasTongGuan = 食伤落点.some((s) => {
              const p1 = proximityOf(s.宫位, b.宫位);
              const p2 = proximityOf(s.宫位, c.宫位);
              if (p1.柱差 > 1 || p2.柱差 > 1) return false;
              if (b.层 === '天干' && c.层 === '天干') {
                return s.层 === '天干' || s.宫位[0] === b.宫位[0] || s.宫位[0] === c.宫位[0];
              }
              return true;
            });
          }
          if (!hasTongGuan) {
            存在越位夺财 = true;
            夺财细节 = `${b.宫位}${b.字}与${c.宫位}${c.字}贴身直克（柱差${prox.柱差}），中间无食伤通关`;
            break;
          }
        }
      }
      if (存在越位夺财) break;
    }

    if (存在越位夺财) {
      比劫判定 = {
        角色: '越位夺财为忌',
        说明: `比劫与财星贴身直克（${夺财细节}），比劫越位夺财，虽从儿亦有争财破耗之害`,
      };
    } else {
      比劫判定 = {
        角色: '顺生为喜',
        说明: '比劫顺生食伤，秀气有源，不悖从儿之势（《滴天髓》「不论身强弱，四柱虽有比劫仍去生助食伤也」）',
      };
    }
  }

  // 4. 流通归宿
  const 见儿 = 财落点.length > 0 && (占比[财星五行] ?? 0) >= 10;
  const 流通归宿 = 见儿
    ? `食伤生财，秀气流行，以食伤为用、财星为归宿（我儿又见儿）`
    : `食伤独旺泄秀，以食伤为用（局中财弱，纯粹泄秀）`;
  const 所从之势 = 见儿 ? 财星五行 : 食伤五行;

  const 综合结论 = `从儿格成立，以【${食伤五行}】为用；比劫【${比劫判定.角色}】；${流通归宿}`;

  return {
    属于从儿: true,
    用神: 食伤五行,
    所从之势,
    流通归宿,
    比劫判定,
    印绶判定,
    官杀判定,
    综合结论,
    依据: '《规矩/判据.md》P-016；《滴天髓》从儿章；《千里命稿》从儿格',
  };
}

/**
 * 获取地支藏干十神列表
 */
export function branchHiddenWithTenGod(branchChar, dStem) {
  const bi = BRANCHES.indexOf(branchChar);
  if (bi < 0) return [];
  const si = STEMS.indexOf(dStem);
  const spec = HIDDEN_STEMS_SPEC[bi] || [];
  return spec.map(([hStem, layer]) => {
    const hsi = STEMS.indexOf(hStem);
    const god = tenGod(si, hsi);
    const elem = ELEMENTS[STEM_ELEMENT[hsi]];
    return { 字: hStem, 层: layer === '本' ? '本气' : (layer === '中' ? '中气' : '余气'), 十神: god, 五行: elem };
  });
}

/**
 * 八格定格与格神提取
 */
export function determineGeju(chart) {
  const dStem = dayMasterOf(chart).stem;
  const dsi = STEMS.indexOf(dStem);
  const mb = branchAt(chart.pillars[1]);
  const hidden = branchHiddenWithTenGod(mb, dStem);

  // 天干透出的十神（年、月、时）
  const openStems = [
    { stem: stemAt(chart.pillars[0]), pos: '年干', tenGod: chart.pillars[0].tenGod ?? tenGod(dsi, STEMS.indexOf(stemAt(chart.pillars[0]))) },
    { stem: stemAt(chart.pillars[1]), pos: '月干', tenGod: chart.pillars[1].tenGod ?? tenGod(dsi, STEMS.indexOf(stemAt(chart.pillars[1]))) },
    { stem: stemAt(chart.pillars[3]), pos: '时干', tenGod: chart.pillars[3].tenGod ?? tenGod(dsi, STEMS.indexOf(stemAt(chart.pillars[3]))) },
  ];

  // 1. 检查月令藏干透出
  const ben = hidden.find((h) => h.层 === '本气');
  const touBen = ben && openStems.find((o) => o.stem === ben.字);
  const otherHidden = hidden.filter((h) => h.层 !== '本气');
  const touOther = otherHidden.map((h) => ({ hidden: h, open: openStems.find((o) => o.stem === h.字) })).filter((x) => x.open);

  let 格神字 = null;
  let 格神十神 = null;
  let 透干 = false;

  if (touBen) {
    格神字 = ben.字;
    格神十神 = ben.十神;
    透干 = true;
  } else if (touOther.length > 0) {
    格神字 = touOther[0].hidden.字;
    格神十神 = touOther[0].hidden.十神;
    透干 = true;
  } else if (ben) {
    格神字 = ben.字;
    格神十神 = ben.十神;
    透干 = false;
  }

  // 映射到八格名称
  let 格局 = '普通格';
  if (格神十神 === '正官') 格局 = '正官格';
  else if (格神十神 === '七杀') 格局 = '七杀格';
  else if (格神十神 === '正财') 格局 = '正财格';
  else if (格神十神 === '偏财') 格局 = '偏财格';
  else if (格神十神 === '正印') 格局 = '正印格';
  else if (格神十神 === '偏印') 格局 = '偏印格';
  else if (格神十神 === '食神') 格局 = '食神格';
  else if (格神十神 === '伤官') 格局 = '伤官格';
  else if (格神十神 === '比肩') 格局 = '建禄格';
  else if (格神十神 === '劫财') 格局 = '阳刃格';

  return {
    格局,
    格神字,
    格神十神,
    透干,
    月令本气: ben ? ben.字 : null,
    月令地支: mb,
    hidden,
    openStems,
  };
}

/**
 * **子平八格成破救应全矩阵研判**（D-042 / 判据 P-021）。
 *
 * 典籍法理：《子平真诠·论用神成败》《子平真诠·论用神救应》
 *   - 以月令为纲，格神透干优先；
 *   - 矩阵输出：成格、破格、败中有救；
 *   - 严格对应破格因与救应因。
 *
 * @param {object} chart
 * @param {object} [opts]
 * @returns {object}
 */
export function gejuChengPoOf(chart, opts = {}) {
  const ge = determineGeju(chart);
  const dStem = dayMasterOf(chart).stem;
  const dElem = dayMasterOf(chart).element;
  const pillars = chart.pillars;
  const openStems = ge.openStems;

  const 透出十神 = new Set(openStems.map((o) => o.tenGod));
  const hasTou = (tg) => 透出十神.has(tg);

  const branches = pillars.map(branchAt);
  const rels = gzRelations(pillars, null);

  const STEM_COMBINES = {
    '甲': '己', '己': '甲',
    '乙': '庚', '庚': '乙',
    '丙': '辛', '辛': '丙',
    '丁': '壬', '壬': '丁',
    '戊': '癸', '癸': '戊',
  };
  const dsi = STEMS.indexOf(dStem);
  const 天干合 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const s1 = stemAt(pillars[i]);
      const s2 = stemAt(pillars[j]);
      if (STEM_COMBINES[s1] === s2) {
        const tg1 = i === 2 ? '日主' : (pillars[i].tenGod ?? tenGod(dsi, STEMS.indexOf(s1)));
        const tg2 = j === 2 ? '日主' : (pillars[j].tenGod ?? tenGod(dsi, STEMS.indexOf(s2)));
        天干合.push({ s1, s2, i, j, tg1, tg2 });
      }
    }
  }

  const mb = ge.月令地支;
  const monthClash = (rels['地支六冲'] ?? []).filter((c) => String(c.pair ?? c.positions ?? '').includes(`月支${mb}`) || String(c.pair ?? c.positions ?? '').includes(mb));
  const monthHe = (rels['地支六合'] ?? []).filter((c) => String(c.pair ?? c.positions ?? '').includes(`月支${mb}`) || String(c.pair ?? c.positions ?? '').includes(mb));
  const hasMonthClash = monthClash.length > 0;
  const hasMonthHe = monthHe.length > 0;

  const allBranchStr = branches.join('');
  const hasWoodBureau = (allBranchStr.includes('卯') && (allBranchStr.includes('未') || allBranchStr.includes('亥')))
    || (allBranchStr.includes('寅') && (allBranchStr.includes('午') || allBranchStr.includes('戌')));

  const isJinShuiShangGuan = (dElem === '金' && (ge.格局 === '伤官格' || branches[1] === '子' || branches[1] === '亥'));

  let 状态 = '成格';
  let 成格因 = '';
  let 破格因 = '';
  let 救应因 = '';
  const 法理出处 = '《子平真诠·论用神成败救应》';

  switch (ge.格局) {
    case '正官格': {
      const 伤克官 = hasTou('伤官') || (dElem === '水' && hasWoodBureau);
      const 官逢冲 = hasMonthClash;
      const 官杀混 = hasTou('正官') && hasTou('七杀');

      if (伤克官) {
        const 透印 = hasTou('正印') || hasTou('偏印');
        const 伤被合 = 天干合.some((h) => (h.tg1 === '伤官' || h.tg2 === '伤官') && h.tg1 !== '日主' && h.tg2 !== '日主');
        破格因 = '官逢伤官克破';
        if (透印) {
          状态 = '败中有救';
          救应因 = '天干透印制伤护官';
        } else if (伤被合) {
          状态 = '败中有救';
          救应因 = '天干相合合去伤官存官';
        } else {
          状态 = '破格';
        }
      } else if (官逢冲) {
        破格因 = '官星坐支逢地支刑冲';
        if (hasMonthHe) {
          状态 = '败中有救';
          救应因 = '地支得六合贪合免冲以解刑冲';
        } else {
          状态 = '破格';
        }
      } else if (官杀混) {
        破格因 = '官杀混杂';
        const 合杀 = 天干合.some((h) => (h.tg1 === '七杀' || h.tg2 === '七杀'));
        const 制杀 = hasTou('食神');
        if (合杀 || 制杀) {
          状态 = '败中有救';
          救应因 = 合杀 ? '合杀留官取清' : '食神制杀留官取清';
        } else {
          状态 = '破格';
        }
      } else {
        状态 = '成格';
        成格因 = (hasTou('正财') || hasTou('偏财') || hasTou('正印') || hasTou('偏印'))
          ? '官逢财印相资，无刑冲破害'
          : '正官得禄当权，无刑冲破害成格';
      }
      break;
    }

    case '偏财格':
    case '正财格': {
      const 财透杀 = hasTou('七杀');
      const 财逢劫 = hasTou('比肩') || hasTou('劫财');

      if (财透杀) {
        破格因 = '财带七杀泄财党杀';
        const 透食 = hasTou('食神') || hasTou('伤官');
        const 合杀 = 天干合.some((h) => (h.tg1 === '七杀' && (h.tg2 === '劫财' || h.tg2 === '比肩'))
          || (h.tg2 === '七杀' && (h.tg1 === '劫财' || h.tg1 === '比肩')));
        if (合杀) {
          状态 = '败中有救';
          救应因 = '劫刃合杀存财成格';
        } else if (透食) {
          状态 = '败中有救';
          救应因 = '食神制杀护身存财';
        } else {
          状态 = '破格';
        }
      } else if (财逢劫) {
        破格因 = '财轻比劫分夺';
        const 透官 = hasTou('正官');
        const 透食伤 = hasTou('食神') || hasTou('伤官');
        if (透官) {
          状态 = '败中有救';
          救应因 = '透官制劫护财';
        } else if (透食伤) {
          状态 = '败中有救';
          救应因 = '透食伤化劫生财';
        } else {
          状态 = '破格';
        }
      } else {
        状态 = '成格';
        成格因 = hasTou('正官') ? '财旺生官成格' : '财星通门户，无刑冲分夺成格';
      }
      break;
    }

    case '七杀格': {
      const 杀逢财 = hasTou('正财') || hasTou('偏财');
      const 杀逢食制 = hasTou('食神') || hasTou('伤官');
      const 枭印夺食 = 杀逢食制 && hasTou('偏印');

      if (枭印夺食) {
        破格因 = '食神制杀逢枭神夺食';
        const 透财制枭 = hasTou('正财') || hasTou('偏财');
        if (透财制枭) {
          状态 = '败中有救';
          救应因 = '财星制枭护食以制杀';
        } else {
          状态 = '破格';
        }
      } else if (杀逢财 && !杀逢食制) {
        破格因 = '杀重逢财党杀';
        const 透印化杀 = hasTou('正印') || hasTou('偏印');
        if (透印化杀) {
          状态 = '败中有救';
          救应因 = '透印化杀生身';
        } else {
          状态 = '破格';
        }
      } else if (!杀逢食制 && !(hasTou('正印') || hasTou('偏印'))) {
        破格因 = '七杀无制无化';
        状态 = '破格';
      } else {
        状态 = '成格';
        成格因 = 杀逢食制 ? '身强七杀逢食神制伏成格' : '杀透印化，杀印相生成格';
      }
      break;
    }

    case '正印格':
    case '偏印格': {
      const 印逢财 = hasTou('正财') || hasTou('偏财');
      if (印逢财) {
        破格因 = '印轻逢财星克破（贪财坏印）';
        const 透劫制财 = hasTou('劫财') || hasTou('比肩');
        const 合财 = 天干合.some((h) => (h.tg1 === '正财' || h.tg1 === '偏财' || h.tg2 === '正财' || h.tg2 === '偏财'));
        if (透劫制财) {
          状态 = '败中有救';
          救应因 = '天干透比劫制财护印';
        } else if (合财) {
          状态 = '败中有救';
          救应因 = '天干相合合财存印';
        } else {
          状态 = '破格';
        }
      } else {
        状态 = '成格';
        成格因 = (hasTou('正官') || hasTou('七杀')) ? '官印双全（杀印相生）成格' : '印绶纯粹有气，得食伤泄秀成格';
      }
      break;
    }

    case '食神格': {
      const 逢枭 = hasTou('偏印');
      const 生财透杀 = (hasTou('正财') || hasTou('偏财')) && hasTou('七杀');

      if (逢枭) {
        破格因 = '食神逢枭神夺食';
        const 透财制枭 = hasTou('正财') || hasTou('偏财');
        if (透财制枭) {
          状态 = '败中有救';
          救应因 = '天干透财制枭护食成格';
        } else {
          状态 = '破格';
        }
      } else if (生财透杀) {
        破格因 = '食神生财而透杀党杀';
        const 合杀 = 天干合.some((h) => (h.tg1 === '七杀' || h.tg2 === '七杀'));
        if (合杀) {
          状态 = '败中有救';
          救应因 = '天干合杀存财成格';
        } else {
          状态 = '破格';
        }
      } else {
        状态 = '成格';
        成格因 = (hasTou('正财') || hasTou('偏财')) ? '食神生财成格' : '食神吐秀制杀成格';
      }
      break;
    }

    case '伤官格': {
      const 见官 = hasTou('正官') || branches.some((b, i) => i !== 1 && branchHiddenWithTenGod(b, dStem).some((h) => h.十神 === '正官'));
      if (见官 && !isJinShuiShangGuan) {
        破格因 = '伤官见官非金水破格';
        const 透印制伤 = hasTou('正印') || hasTou('偏印');
        const 财星通关 = hasTou('正财') || hasTou('偏财');
        if (透印制伤) {
          状态 = '败中有救';
          救应因 = '天干透印制伤护官';
        } else if (财星通关) {
          状态 = '败中有救';
          救应因 = '财星通关化伤生官';
        } else {
          状态 = '破格';
        }
      } else if (isJinShuiShangGuan && 见官) {
        状态 = '成格';
        成格因 = '金水伤官喜见官成格';
      } else {
        状态 = '成格';
        成格因 = (hasTou('正印') || hasTou('偏印')) ? '伤官佩印成格' : '伤官生财成格';
      }
      break;
    }

    case '建禄格':
    case '阳刃格': {
      const 透官 = hasTou('正官');
      const 透伤 = hasTou('伤官');
      const 透杀 = hasTou('七杀');
      if (透官 && 透伤) {
        破格因 = '禄刃用官逢伤官克破';
        const 透印 = hasTou('正印') || hasTou('偏印');
        if (透印) {
          状态 = '败中有救';
          救应因 = '透印制伤护官成格';
        } else {
          状态 = '破格';
        }
      } else if (ge.格局 === '阳刃格' && !透官 && !透杀) {
        破格因 = '阳刃无官杀驾驭';
        const 透食伤 = hasTou('食神') || hasTou('伤官');
        if (透食伤) {
          状态 = '成格';
          成格因 = '阳刃透食伤吐秀成格';
        } else {
          状态 = '破格';
        }
      } else {
        状态 = '成格';
        成格因 = ge.格局 === '阳刃格' ? '阳刃驾杀（逢官杀）成格' : '建禄逢财官成格';
      }
      break;
    }

    default: {
      状态 = '成格';
      成格因 = '气象纯粹成格';
      break;
    }
  }

  return {
    格局: ge.格局,
    格神字: ge.格神字,
    格神十神: ge.格神十神,
    月令本气: ge.月令本气,
    透干: ge.透干,
    状态,
    成格因: 状态 === '成格' ? 成格因 : null,
    破格因: 状态 !== '成格' ? 破格因 : null,
    救应因: 状态 === '败中有救' ? 救应因 : null,
    法理出处,
    说明: `依据《子平真诠·论用神成败救应》：月令取【${ge.格局}】（格神${ge.格神字}·${ge.格神十神}），`
      + `研判结论为【${ge.格局} · ${状态}】`
      + (状态 === '败中有救' ? `（因${破格因}，赖${救应因}）` : (状态 === '破格' ? `（因${破格因}）` : `（${成格因}）`)),
  };
}

/**
 * **体用路线四条的汇总入口** —— 一次算齐，供工具侧调用。
 *
 * @param {object} chart
 * @param {{用神五行?: string, 忌神五行?: string, 岁运?: string}} [opts]
 */