// 核心/report/common.mjs
// 报告装配层通用基础设施与数据底座（D-087 落地）

import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  STEM_YANG, HIDDEN_STEMS_SPEC, gzIndex, nayinOf, xunOf,
  twelveStage, elementStrength, luckDirection, buildLuckPillars,
  castChart, gzRelations, shenshaOf, dateCandidates,
  BRANCH_CLASH, BRANCH_COMBINE, tenGod,
  trueSolarTime
} from '../engine.mjs';
import { occupantsOf } from '../tiyong/physics.mjs';

export const MONTH_BRANCH_SEASON = {
  寅: '木', 卯: '木', 辰: '土',
  巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土',
  亥: '水', 子: '水', 丑: '土',
};

export const ELEM_REL = {
  '木': { 生: '火', 克: '土', 被生: '水', 被克: '金', 同: '木' },
  '火': { 生: '土', 克: '金', 被生: '木', 被克: '水', 同: '火' },
  '土': { 生: '金', 克: '水', 被生: '火', 被克: '木', 同: '土' },
  '金': { 生: '水', 克: '木', 被生: '土', 被克: '火', 同: '金' },
  '水': { 生: '木', 克: '火', 被生: '金', 被克: '土', 同: '水' },
};

/**
 * 宽度对齐辅助（支持中英文字符宽度计算）
 */
export function strWidth(str) {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 粗略判断宽字符（汉字、全角标点等）
    if (code > 0x7f) w += 2;
    else w += 1;
  }
  return w;
}

export function padRight(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - current);
}

export function padCenter(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  const left = Math.floor((targetWidth - current) / 2);
  const right = targetWidth - current - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * 辅助：计算两个天干的十神
 */
export function getTenGod(dayStem, otherStem) {
  const dIdx = STEMS.indexOf(dayStem);
  const oIdx = STEMS.indexOf(otherStem);
  if (dIdx < 0 || oIdx < 0) return '';
  return tenGod(dIdx, oIdx);
}

/**
 * 地支六冲与六合查询辅助
 */
export function getBranchClash(b) {
  const hit = BRANCH_CLASH.find((p) => p.includes(b));
  return hit ? hit.replace(b, '') : '';
}

export function getBranchCombine(b) {
  const hit = Object.keys(BRANCH_COMBINE).find((p) => p.includes(b));
  return hit ? hit.replace(b, '') : '';
}

/**
 * 五行百分比归一化配平（双保险，确保五行相加严格等于 100.0%）
 */
export function normalizeElementPercents(rawPct) {
  const elems = ['木', '火', '土', '金', '水'];
  const res = {};
  let sum = 0;
  let maxKey = '木';
  let maxVal = -1;
  for (const e of elems) {
    const val = Number((rawPct?.[e] ?? 0).toFixed(1));
    res[e] = val;
    sum += val;
    if (val > maxVal) {
      maxVal = val;
      maxKey = e;
    }
  }
  const diff = Number((100 - sum).toFixed(1));
  if (diff !== 0 && maxKey) {
    res[maxKey] = Number((res[maxKey] + diff).toFixed(1));
  }
  return res;
}

/**
 * 单源同党与异党百分比计算（全局唯一口径，确保 1.3、2.2 与 3.2 绝对一致）
 */
export function calcTongYiDang(chart) {
  const dmElem = chart.dayMaster?.element || (chart.pillars?.[2]?.stem ? STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] : '木');
  const rawPct = chart.strength?.percent || { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 };
  const pct = normalizeElementPercents(rawPct);
  const shengElem = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }[dmElem];
  const tongPct = Number(((pct[dmElem] || 0) + (pct[shengElem] || 0)).toFixed(1));
  const yiPct = Number((100 - tongPct).toFixed(1));
  return { tongPct, yiPct, dmElem, shengElem, pct };
}

/**
 * 无法通过公历高保真反推时，构建完备且字段全量的纯四柱排盘底座
 */
export function buildPillarsChart(input, options = {}) {
  const pos = ['年柱', '月柱', '日柱', '时柱'];
  const dayStem = input[2][0];
  const dayStemIdx = STEMS.indexOf(dayStem);
  const yearStemIdx = STEMS.indexOf(input[0][0]);
  const monthBranch = input[1][1];
  const monthBranchIdx = BRANCHES.indexOf(monthBranch);
  const gender = options.gender || '男';

  const pillars = input.map((gz, i) => {
    const stem = gz[0];
    const branch = gz[1];
    const stemIndex = STEMS.indexOf(stem);
    const branchIndex = BRANCHES.indexOf(branch);
    const stemEl = stemIndex >= 0 ? ELEMENTS[STEM_ELEMENT[stemIndex]] : '';
    const branchEl = branchIndex >= 0 ? ELEMENTS[BRANCH_ELEMENT[branchIndex]] : '';

    let gzIdx = -1;
    if (stemIndex >= 0 && branchIndex >= 0 && stemIndex % 2 === branchIndex % 2) {
      gzIdx = gzIndex(stemIndex, branchIndex);
    }
    let nayin = { name: '—', element: '—' };
    let xun = { name: '—', voidBranches: [] };
    if (gzIdx >= 0) {
      try { nayin = nayinOf(gzIdx); } catch {}
      try { xun = xunOf(gzIdx); } catch {}
    }

    const hidden = (branchIndex >= 0 && HIDDEN_STEMS_SPEC[branchIndex])
      ? HIDDEN_STEMS_SPEC[branchIndex].map(([s, role, w]) => {
          const sIdx = STEMS.indexOf(s);
          return {
            stem: s,
            role,
            weight: w,
            tenGod: (dayStemIdx >= 0 && sIdx >= 0) ? tenGod(dayStemIdx, sIdx) : '',
          };
        })
      : [];

    return {
      position: pos[i],
      gz,
      stem,
      branch,
      stemIndex,
      branchIndex,
      stemElement: stemEl,
      branchElement: branchEl,
      stemYinYang: (stemIndex >= 0 && STEM_YANG[stemIndex]) ? '阳' : '阴',
      branchYinYang: branchIndex % 2 === 0 ? '阳' : '阴',
      tenGod: (dayStemIdx >= 0 && stemIndex >= 0) ? (i === 2 ? '日主' : tenGod(dayStemIdx, stemIndex)) : '',
      hidden,
      nayin,
      xun: xun.name,
      voidBranches: xun.voidBranches || [],
      selfStage: (stemIndex >= 0 && branchIndex >= 0) ? twelveStage(stemIndex, branchIndex) : '',
      dayStemStage: (dayStemIdx >= 0 && branchIndex >= 0) ? twelveStage(dayStemIdx, branchIndex) : '',
      zodiac: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'][branchIndex] || '',
    };
  });

  const dayVoid = pillars[2].voidBranches || [];
  const yearVoid = pillars[0].voidBranches || [];

  const monthHiddenFirst = (monthBranchIdx >= 0 && HIDDEN_STEMS_SPEC[monthBranchIdx]?.[0])
    ? HIDDEN_STEMS_SPEC[monthBranchIdx][0][0]
    : '甲';
  const silingEl = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(monthHiddenFirst)]] || '木';

  let strength;
  try {
    strength = elementStrength(pillars, monthBranch, silingEl);
  } catch {
    strength = { percent: { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 } };
  }

  let luckPillars = [];
  try {
    const forward = luckDirection(STEM_YANG[yearStemIdx], gender);
    const mPillarObj = {
      index: pillars[1].stemIndex >= 0 && pillars[1].branchIndex >= 0 && pillars[1].stemIndex % 2 === pillars[1].branchIndex % 2
        ? gzIndex(pillars[1].stemIndex, pillars[1].branchIndex)
        : 0
    };
    luckPillars = buildLuckPillars(mPillarObj, 10, forward);
    luckPillars.forEach(lp => {
      lp.tenGod = (dayStemIdx >= 0 && lp.stemIndex >= 0) ? tenGod(dayStemIdx, lp.stemIndex) : '';
    });
  } catch {}

  const dayStemEl = dayStemIdx >= 0 ? ELEMENTS[STEM_ELEMENT[dayStemIdx]] : '木';
  return {
    input: { gzList: input, gender },
    calendar: {
      solar: '四柱直推推演',
      solarTermMonth: { term: monthBranch + '令', startedAt: '未知', nextTerm: '未知', nextAt: '未知' },
    },
    pillars,
    dayMaster: {
      stem: dayStem,
      element: dayStemEl,
      yinYang: (dayStemIdx >= 0 && STEM_YANG[dayStemIdx]) ? '阳' : '阴',
      bornMonthBranch: monthBranch,
      stageInMonth: (dayStemIdx >= 0 && monthBranchIdx >= 0) ? twelveStage(dayStemIdx, monthBranchIdx) : '',
      season: MONTH_BRANCH_SEASON[monthBranch] || '四季',
      '司令': {
        '月支': monthBranch,
        '司令': monthHiddenFirst,
        '司令五行': silingEl,
        '本气': monthHiddenFirst,
      },
      '当令五行': silingEl,
      '当令据': '月令本气司权（四柱直推模式）',
    },
    void: {
      xunKong: [],
      dayVoid,
      yearVoid,
    },
    relations: gzRelations(pillars, null),
    shensha: shenshaOf(pillars, dayStemIdx, yearStemIdx, gender),
    strength,
    luck: {
      pillars: luckPillars,
    },
  };
}

/**
 * 确保输入被解析为完整的排盘 chart
 */
export function ensureFullChart(input, options = {}) {
  const gender = options.gender || '男';
  const longitude = (options.longitude !== undefined && options.longitude !== null && Number.isFinite(Number(options.longitude)))
    ? Number(options.longitude)
    : (input && input.longitude !== undefined && input.longitude !== null && Number.isFinite(Number(input.longitude)))
    ? Number(input.longitude)
    : null;

  if (input && input.pillars && input.dayMaster) {
    if (!input.relations) input.relations = gzRelations(input.pillars, null);
    if (!input.shensha) {
      const dayStemIdx = STEMS.indexOf(input.pillars[2].stem);
      const yearStemIdx = STEMS.indexOf(input.pillars[0].stem);
      input.shensha = shenshaOf(input.pillars, dayStemIdx, yearStemIdx, input.input?.gender || gender);
    }
    if (longitude !== null) {
      input.calendar = input.calendar || {};
      if (!input.calendar.trueSolar) input.calendar.trueSolar = { longitude };
    }
    return input;
  }

  // 若传入的是生日对象 { year, month, day, hour, minute, gender }
  if (input && typeof input.year === 'number' && typeof input.month === 'number') {
    let moment = {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour ?? 12,
      minute: input.minute ?? 0,
    };
    let trueSolar = null;
    if (longitude !== null) {
      const tst = trueSolarTime(moment, longitude);
      trueSolar = {
        longitude,
        longitudeMinutes: tst.longitudeMinutes,
        eotMinutes: tst.eotMinutes,
        totalMinutes: tst.totalMinutes,
        original: `${moment.year}-${String(moment.month).padStart(2, '0')}-${String(moment.day).padStart(2, '0')} ${String(moment.hour).padStart(2, '0')}:${String(moment.minute).padStart(2, '0')}`,
        corrected: `${tst.corrected.year}-${String(tst.corrected.month).padStart(2, '0')}-${String(tst.corrected.day).padStart(2, '0')} ${String(tst.corrected.hour).padStart(2, '0')}:${String(tst.corrected.minute).padStart(2, '0')}`,
      };
      moment = tst.corrected;
    }
    const chart = castChart({ ...moment, gender: input.gender || gender });
    if (trueSolar) {
      chart.calendar.trueSolar = trueSolar;
    }
    return chart;
  }

  // 若传入的是四柱数组 ['庚午', '辛巳', '乙酉', '癸未']
  if (Array.isArray(input) && input.length === 4) {
    const targetYear = options.year || options.targetYear;
    try {
      const cands = dateCandidates(input, { fromYear: 1600, toYear: 2050 });
      if (cands && cands.候选 && cands.候选.length > 0) {
        const branchHourMap = {
          '子': 0, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10,
          '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22
        };

        const validCandidates = [];
        for (const cand of cands.候选) {
          const [y, m, d] = cand.日期.split('-').map(Number);
          const h = branchHourMap[cand.时支] ?? 12;
          const chart = castChart({ year: y, month: m, day: d, hour: h, minute: 30, gender });
          // 严格校验排盘干支是否与传入四柱 100% 一致（彻底杜绝 Pillar Mutation 篡改盘面）！
          if (chart.pillars.every((p, idx) => p.gz === input[idx])) {
            validCandidates.push({
              cand,
              year: y,
              chart,
              solarDate: `${cand.日期} ${h.toString().padStart(2, '0')}:30`
            });
          }
        }

        if (validCandidates.length > 0) {
          let chosen;
          let exactMatched = false;
          if (targetYear) {
            // 用户显式指定基准年份：优先完全一致，次选最接近者
            const match = validCandidates.find((c) => c.year === targetYear || c.cand.立春年 === targetYear);
            if (match) {
              chosen = match;
              exactMatched = true;
            } else {
              chosen = [...validCandidates].sort((a, b) => Math.abs(a.year - targetYear) - Math.abs(b.year - targetYear))[0];
              exactMatched = false;
            }
          } else {
            // 未指定基准年份：按现代活跃年龄中位（1990 年）启发式排序，避免落入古人或百岁老人盘
            const MODERN_ANCHOR_YEAR = 1990;
            chosen = [...validCandidates].sort((a, b) => {
              const diffA = Math.abs(a.year - MODERN_ANCHOR_YEAR);
              const diffB = Math.abs(b.year - MODERN_ANCHOR_YEAR);
              return diffA - diffB;
            })[0];
          }

          const selectedChart = chosen.chart;
          selectedChart.isFourPillarsMode = true;
          if (longitude !== null) {
            selectedChart.calendar = selectedChart.calendar || {};
            if (!selectedChart.calendar.trueSolar) selectedChart.calendar.trueSolar = { longitude };
          }
          selectedChart.dateCandidatesInfo = {
            candidates: validCandidates.map((c) => ({
              year: c.year,
              solarDate: c.solarDate,
              isChosen: c === chosen
            })),
            chosenYear: chosen.year,
            chosenDate: chosen.solarDate,
            targetYear: targetYear ?? null,
            exactMatched,
            userSpecifiedYear: !!targetYear
          };
          return selectedChart;
        }
      }
    } catch {}

    // 无法精准匹配公历或四柱自洽性异常时，走完备四柱结构构建器
    const fallbackChart = buildPillarsChart(input, { gender });
    fallbackChart.isFourPillarsMode = true;
    if (longitude !== null) {
      fallbackChart.calendar = fallbackChart.calendar || {};
      if (!fallbackChart.calendar.trueSolar) fallbackChart.calendar.trueSolar = { longitude };
    }
    fallbackChart.dateCandidatesInfo = {
      candidates: [],
      chosenYear: null,
      userSpecifiedYear: false
    };
    return fallbackChart;
  }

  throw new Error('ensureFullChart: 无法识别的输入格式（支持生日对象或四柱数组）');
}

/**
 * 解析流年起推基准年份（D-060 落地，联动用户传参基准年、历史名造时代或现代默认年）
 */
export function resolveStartYear(chart, options = {}) {
  if (options.startYear && Number.isFinite(Number(options.startYear))) {
    return Number(options.startYear);
  }
  if (options.year && Number.isFinite(Number(options.year))) {
    return Number(options.year);
  }
  if (chart.dateCandidatesInfo?.userSpecifiedYear && chart.dateCandidatesInfo?.chosenYear) {
    return chart.dateCandidatesInfo.chosenYear;
  }
  const baseYear = chart.dateCandidatesInfo?.chosenYear || chart.calendar?.year || (chart.calendar?.solar ? Number(chart.calendar.solar.slice(0, 4)) : null);
  if (baseYear && baseYear < 1926) {
    return baseYear;
  }
  return 2026;
}

/**
 * 辅助推导日主与目标五行的十神通称类别（拓展至所有五行与所有格局）
 */
export function elemTenGodCategory(dmElem, targetElem) {
  if (!targetElem || !dmElem) return '十神';
  if (targetElem === dmElem) return '比肩劫财';
  if (ELEM_REL[targetElem]?.生 === dmElem) return '正印偏印';
  if (ELEM_REL[dmElem]?.生 === targetElem) return '食神伤官';
  if (ELEM_REL[targetElem]?.克 === dmElem) return '正官七杀';
  if (ELEM_REL[dmElem]?.克 === targetElem) return '正财偏财';
  return '十神';
}

/**
 * 确定命局真正主要矛盾病灶凶神（D-047 落地，杜绝机械按全盘占比盲目定病，彻底根除日主变病神硬伤）
 */
export function resolveDiseaseElement(chart, ti, primaryYong) {
  const dm = chart.dayMaster?.element || '木';
  const yin = ELEM_REL[dm]?.被生;
  const gs = ti.主要矛盾?.官杀吉凶;
  const danli = ti.主要矛盾?.['四之二_取用定案']?.官杀担力 || gs?.日主担力 || '';
  const { tongPct, pct } = calcTongYiDang(chart);

  // 1. 官杀不可任（首要保命闸门）：官杀对日主为杀且不可任，病神直接锁定为官杀五行
  if (gs?.有官杀 && (gs.可任 === false || danli === '不可任' || danli === '身弱难以任煞')) {
    if (gs.官杀五行 && gs.官杀五行 !== primaryYong) return gs.官杀五行;
  }

  // 2. 日主偏弱（tongPct < 50）：病神必在异党（食伤/财星/官杀），绝不可将日主自身或印星定为病神
  if (tongPct < 50) {
    const yiElems = Object.keys(pct)
      .filter(e => e !== dm && e !== yin)
      .sort((a, b) => (pct[b] || 0) - (pct[a] || 0));
    const cand = yiElems.find(e => e !== primaryYong);
    if (cand) return cand;
  }

  // 3. 日主偏旺（tongPct >= 50）：病神在同党过旺（比劫争财夺福或印星生扶太过壅滞）
  const sorted = Object.entries(pct).sort((a, b) => b[1] - a[1]);
  const tongElems = [dm, yin].filter(Boolean).sort((a, b) => (pct[b] || 0) - (pct[a] || 0));
  if (tongPct >= 50 && tongElems.length > 0) {
    const cand = tongElems.find(e => e !== primaryYong);
    if (cand && (pct[cand] || 0) > 25) return cand;
  }

  // 兜底：全盘最旺且非用神者（病药严格互斥）
  const cand = sorted.find(([e]) => e !== primaryYong)?.[0] || Object.keys(pct).find(e => e !== primaryYong) || '金';
  return cand;
}

/**
 * 依据用神与病神之真实五行生克物理，动态生成多轨作用机理与现实战略（D-047 落地，根除 74.9% 假相克）
 */
export function describeActionMechanism(yong, bing, dmElem, yongTenGod) {
  // 1. 克制轨（用克病，如 金克木、水克火、土克水、火克金、木克土）
  if (ELEM_REL[yong]?.克 === bing) {
    return {
      轨道: '正面克制',
      机理: `以【${yong}】正面克制裁抑原局主要矛盾【${bing}】。以硬核手段伐其过旺嚣张之气，令五行重归平衡秩序。用神为命主安身立命、攻坚做功之核心利器。`,
      战略: `深耕【${yong}】（${yongTenGod}）所代表的专业技术壁垒与高维博弈能力，由技入道，以硬核做功手腕在复杂局势中确立核心生态位。`
    };
  }

  // 2. 通关引化生身轨（病生用，且用生日主，如 杀生印、印生身）
  if (ELEM_REL[bing]?.生 === yong && ELEM_REL[yong]?.生 === dmElem) {
    return {
      轨道: '通关引化',
      机理: `以【${yong}】承上启下，化泄原局主要矛盾【${bing}】之攻伐凶性，转而引通生扶日元【${dmElem}】。贪生忘克，化敌为友，使凶煞之重压转化为滋养日主之源泉，格成杀印相生/官印双清。用神为命主绝处逢生、化危为机之核心枢纽。`,
      战略: `秉持【${yong}】（${yongTenGod}）所代表的学习沉淀、资质背书与组织赋能策略，善于将外部危机与严苛考验转化为个人资历与护城河，化阻力为托举力。`
    };
  }

  // 3. 顺泄引通秀气轨（病生用，用不生日主，如 身旺食伤泄秀）
  if (ELEM_REL[bing]?.生 === yong) {
    return {
      轨道: '顺泄秀气',
      机理: `以【${yong}】顺泄引通原局主要矛盾【${bing}】之旺气。原局【${bing}】气势过盛，不宜逆其锐气强行硬克，而以【${yong}】顺水推舟引化其过亢之能，化顽劣为精英秀气，四两拨千斤。用神为命主疏导风险、点石成金之核心利器。`,
      战略: `善用【${yong}】（${yongTenGod}）所代表的疏导转化、文化创意与价值再造能力，不与强势力量硬碰硬，以柔克刚，将外部庞大动能顺势转化为自身发展势能。`
    };
  }

  // 4. 抗压守正 / 逆境保生轨（病克用）
  if (ELEM_REL[bing]?.克 === yong) {
    return {
      轨道: '抗压生身',
      机理: `局中主要矛盾【${bing}】势重而克伐【${yong}】，【${yong}】作为立命做功之枢纽处于逆境承压之地。此局需以【${yong}】坚守生机根本，内修定力，并借岁运护卫神解围纾困，在逆境重压中百炼成钢。用神为命主守正待时、保全生机的定海神针。`,
      战略: `坚守【${yong}】（${yongTenGod}）所代表的底层根基与核心资产，岁运不济时韬光养晦、严控风险，待护卫岁运到来再谋长远突破。`
    };
  }

  // 5. 强身任泄 / 滋培生发轨（用生病）
  if (ELEM_REL[yong]?.生 === bing) {
    const isDayMasterHelper = (yong === dmElem || ELEM_REL[yong]?.生 === dmElem);
    const jiLi = isDayMasterHelper
      ? `以【${yong}】强固日元体魄，增强抗压担力，源源不断输送动能以滋养【${bing}】之开阖生发。身弱克泄交加，以【${yong}】强身固本，使元气充盈、秀气有源而不竭。用神为命主强身固本、底蕴承托之核心根基。`
      : `以【${yong}】作为动能枢纽，顺生流通以滋养转化原局主要矛盾【${bing}】之气。五行相生有情，以【${yong}】（${yongTenGod}）疏通流通节点，将滞气导向生发之途，变阻力为开阖动能。用神为命主疏通造化、转化生机之核心枢纽。`;
    const zhanLue = isDayMasterHelper
      ? `夯实【${yong}】（${yongTenGod}）所代表的内功修为与体魄身心，注重长远蓄力与底层积累，以内在丰盈的确定性应对外部高负荷消耗。`
      : `深耕【${yong}】（${yongTenGod}）所代表的开创转化与资源整合策略，顺势而为，以生生不息的动态周转盘活全局资产。`;

    return {
      轨道: '强身任泄',
      机理: jiLi,
      战略: zhanLue
    };
  }

  // 6. 同气相求 / 协力分担轨（同类比和，yong === bing）
  // 【学理与防御性收口说明 · D-060 方案 3 A】：
  // 依据《体用路线法》根本宪法与喜病互斥铁律（D-047/D-060），病神（主要矛盾元凶）与用神（做功解救枢纽）在定性上严格对立互斥；
  // 在 resolveDiseaseElement 中已对病神候选作严格过滤（e !== primaryYong）。
  // 数学上五行环中任意两两不同五行必满足前 5 轨之一。因此本分支在当前公理化体系下恒不可达，
  // 特此作为数学逻辑完备性与防御性保底分支保留（Default Fallback），业务推演不落入此轨。
  return {
    轨道: '同气比和',
    机理: `以【${yong}】同气相求，并肩分担命局主要压力。同党合力，众志成城，化解孤立无援之危。用神为命主结伴同行、借力共赢之立足枢纽。`,
    战略: `依靠【${yong}】（${yongTenGod}）所代表的团队协同、合伙机制与同行赋能，抱团取暖，做大生态共同体以抵御外部不确定性。`
  };
}

/**
 * 深入解析命局体用路线法取用定案与喜忌体系（公理化拓展至所有五行、所有格局，D-044/D-047 落地）
 */
export function resolveYongAndXiElements(chart, ti) {
  const dmElem = chart.dayMaster?.element || (chart.pillars?.[2]?.stem ? STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] : '木');
  const dingan = ti.主要矛盾?.['四之二_取用定案'] || {};
  const candidates = ti.主要矛盾?.['四_候选用神'] || [];
  const danli = ti.主要矛盾?.官杀吉凶?.日主担力 || dingan.官杀担力 || '';
  const danliDesc = ti.主要矛盾?.官杀吉凶?.担力据 || '';

  const isCongGe = !!(ti.从格改判 && (ti.从格改判.适用性?.includes('从格成立') || ti.从格改判.适用性?.includes('须改按此口径')));
  const congGeYong = isCongGe ? ti.从格改判.改判用神 : null;
  const congGeJi = isCongGe ? ti.从格改判.改判忌神 : null;

  const extractElem = (val) => String(val || '').match(/[木火土金水]/)?.[0] || null;
  const inChart = (elem) => elem ? (occupantsOf(chart, elem) || []).length > 0 : false;

  // 1. 首选用神确定（从格优先 > 两路同归 > 定案采用 > 护卫链用神 > 在局可行候选 > ti.用神五行 > dmElem）
  let rawPrimary = congGeYong
    || (candidates.find((c) => c.来源类 === '同归' && c.可行) ? extractElem(candidates.find((c) => c.来源类 === '同归' && c.可行).字或五行) : null)
    || ti.定案采用?.五行
    || ti['第三之链_护卫链']?.全景通路?.用神
    || ti['第三之链_护卫链']?.用神
    || (candidates.find((c) => c.可行 && inChart(extractElem(c.字或五行)))?.字或五行 ? extractElem(candidates.find((c) => c.可行 && inChart(extractElem(c.字或五行))).字或五行) : null)
    || ti.用神五行
    || dmElem;

  // 幻影用神在局闸门过滤：若 rawPrimary 不在局且不是从格，强制回退至局中在局实神
  let primaryYong = rawPrimary;
  if (!isCongGe && !inChart(primaryYong)) {
    const validInChartCand = candidates.find((c) => c.可行 && inChart(extractElem(c.字或五行)));
    if (validInChartCand) {
      primaryYong = extractElem(validInChartCand.字或五行);
    } else {
      const allInChart = ELEMENTS.filter((e) => inChart(e));
      if (allInChart.length > 0) {
        primaryYong = allInChart.includes(ELEM_REL[dmElem]?.被生) ? ELEM_REL[dmElem]?.被生 : allInChart[0];
      }
    }
  }

  // 2. 破用克神（灭工具第一大忌神）与从格忌神
  const mieToolElem = (isCongGe && congGeJi)
    ? congGeJi
    : (ELEM_REL[primaryYong]?.被克 || ti['第三之链_护卫链']?.全景通路?.克神 || ELEM_REL[primaryYong]?.被克);

  // 3. 病灶凶神（根据官杀攻身与衰旺格局精准定病，彻底根除日主变病神）
  const bingElem = isCongGe ? (congGeJi || resolveDiseaseElement(chart, ti, primaryYong)) : resolveDiseaseElement(chart, ti, primaryYong);

  // 4. 护神（制克神者）与生用神（生第一用神者）——排病排忌全局互斥仲裁（D-047 铁律）
  const rawHuShen = ELEM_REL[mieToolElem]?.被克; // 如土克水护火
  const rawShengYong = ELEM_REL[primaryYong]?.被生; // 如木生火

  // 严格互斥仲裁：病神与大忌神绝不可列入喜神！
  const huShenValid = (rawHuShen !== bingElem && rawHuShen !== mieToolElem);
  const shengYongValid = (rawShengYong !== bingElem && rawShengYong !== mieToolElem);

  const { tongPct } = calcTongYiDang(chart);
  const fallbackXi = (dmElem !== bingElem && dmElem !== mieToolElem && dmElem !== primaryYong && tongPct < 50)
    ? dmElem
    : primaryYong;

  const huShenElem = huShenValid ? rawHuShen : (shengYongValid ? rawShengYong : fallbackXi);
  const shengYongElem = shengYongValid ? rawShengYong : (huShenValid ? rawHuShen : fallbackXi);
  const xiElem = huShenElem || shengYongElem || primaryYong;

  const huaCandidate = candidates.find((c) => (c.来源类 === '化' || c.路线?.includes('通关') || c.路线?.includes('引化')) && c.可行);
  const zhiCandidate = candidates.find((c) => (c.来源类 === '制' || c.路线?.includes('制')) && c.可行);
  const huaElem = huaCandidate ? extractElem(huaCandidate.字或五行) : null;
  const zhiElem = zhiCandidate ? extractElem(zhiCandidate.字或五行) : null;

  // 若化神直接克制第一用神（如水克火灭工具），则化神断然不可为用，直接定为破局灭工具大忌神，绝不作双通路！
  const huaClashesTool = Boolean(huaElem && ELEM_REL[primaryYong]?.被克 === huaElem);
  const isDual = !huaClashesTool && Boolean(
    huaCandidate && zhiCandidate && huaElem && zhiElem
    && huaElem !== zhiElem
    && ELEM_REL[huaElem]?.克 !== zhiElem
    && ELEM_REL[zhiElem]?.克 !== huaElem
    && huaElem === primaryYong
  );

  return {
    isDual,
    isCongGe,
    congGeYong,
    congGeJi,
    primaryYong,
    mainYong: primaryYong,
    mieToolElem,
    jiElem: mieToolElem,
    bingElem,
    huShenElem,
    shengYongElem,
    xiElem,
    workElem: primaryYong,
    danli,
    danliDesc,
    huaCandidate,
    zhiCandidate,
    huaElem,
    zhiElem,
    huaClashesTool,
    allHelpers: [primaryYong, huShenElem, shengYongElem].filter(Boolean),
  };
}
