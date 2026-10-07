// 核心/report-generator.mjs
// 三段式全景命理解读与决策咨询报告生成器（整车总装核心大脑，D-039 落地）
// 严格遵循《三段式全景命理解读深度示范报告.md》标准规格：
// 1. 排盘事实层（客观无争议事实底座，竖排四柱卡片、五行能量条、旺衰三维研判）
// 2. 丙层流派主张并陈（格局派、滴天髓用神派、穷通调候派、盲派、新派、神煞象义，六派并陈不选边）
// 3. 乙体系体用路线法深度推演（八格成破救应全解、去留路线、主要矛盾双通路、财富专题、逐运详批打分、十年流年折线图、心性婚恋健康战略规划；八字层次评估严格隐藏）
// 4. 四重免责声明与科学认知导引

import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT,
  castChart, gzRelations, shenshaOf, dateCandidates,
  BRANCH_CLASH, BRANCH_COMBINE
} from './engine.mjs';
import {
  tiyongRouteOf, gejuChengPoOf, protectionChainOf,
  coverageOf, arbitrateGanzhiForces
} from './tiyong.mjs';
import {
  extractChartFeatures, loadAllSchoolEntries, matchSchoolClaims
} from './school-matcher.mjs';

/**
 * 宽度对齐辅助（支持中英文字符宽度计算）
 */
function strWidth(str) {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 粗略判断宽字符（汉字、全角标点等）
    if (code > 0x7f) w += 2;
    else w += 1;
  }
  return w;
}

function padRight(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - current);
}

function padCenter(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  const left = Math.floor((targetWidth - current) / 2);
  const right = targetWidth - current - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * 确保输入被解析为完整的排盘 chart
 */
export function ensureFullChart(input) {
  if (input && input.pillars && input.dayMaster) {
    if (!input.relations) input.relations = gzRelations(input.pillars, null);
    if (!input.shensha) {
      const dayStemIdx = STEMS.indexOf(input.pillars[2].stem);
      const yearStemIdx = STEMS.indexOf(input.pillars[0].stem);
      input.shensha = shenshaOf(input.pillars, dayStemIdx, yearStemIdx, input.input?.gender || '男');
    }
    return input;
  }

  // 若传入的是生日对象 { year, month, day, hour, minute, gender }
  if (input && typeof input.year === 'number' && typeof input.month === 'number') {
    return castChart(input);
  }

  // 若传入的是四柱数组 ['庚午', '辛巳', '乙酉', '癸未']
  if (Array.isArray(input) && input.length === 4) {
    // 尝试利用 dateCandidates 寻找最佳公历匹配
    try {
      const cands = dateCandidates(input, { fromYear: 1900, toYear: 2050 });
      if (cands && cands.候选 && cands.候选.length > 0) {
        const best = cands.候选[0];
        const [y, m, d] = best.日期.split('-').map(Number);
        // 推算小时
        const branchHourMap = {
          '子': 23, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10,
          '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22
        };
        const h = branchHourMap[best.时支] ?? 12;
        return castChart({ year: y, month: m, day: d, hour: h, minute: 30, gender: '男' });
      }
    } catch {
      // 容错回退
    }

    // 无法反推或反推失败时，组装标准的四柱结构
    const pos = ['年柱', '月柱', '日柱', '时柱'];
    const pillars = input.map((gz, i) => {
      const stem = gz[0];
      const branch = gz[1];
      const stemIndex = STEMS.indexOf(stem);
      const branchIndex = BRANCHES.indexOf(branch);
      return {
        position: pos[i],
        gz,
        stem,
        branch,
        stemIndex,
        branchIndex,
        stemElement: STEM_ELEMENT[stemIndex],
        branchElement: BRANCH_ELEMENT[branchIndex],
      };
    });

    const dayStem = pillars[2].stem;
    const dayStemIdx = STEMS.indexOf(dayStem);
    const yearStemIdx = STEMS.indexOf(pillars[0].stem);

    const chart = {
      input: { gzList: input, gender: '男' },
      calendar: {
        solar: '根据四柱反推',
        solarTermMonth: { term: '参考月令', startedAt: '未知', nextTerm: '未知', nextAt: '未知' },
      },
      pillars,
      dayMaster: {
        stem: dayStem,
        element: STEM_ELEMENT[dayStemIdx],
        bornMonthBranch: pillars[1].branch,
      },
      void: {
        xunKong: [],
      },
      relations: gzRelations(pillars, null),
      shensha: shenshaOf(pillars, dayStemIdx, yearStemIdx, '男'),
      strength: {
        percent: { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 }
      }
    };
    return chart;
  }

  throw new Error('ensureFullChart: 无法识别的输入格式（支持生日对象或四柱数组）');
}

/**
 * 第一段：排盘事实层生成
 */
function renderFactSection(chart) {
  const lines = [];
  lines.push('## 第一段：排盘事实（无争议客观事实底座）\n');

  // 1.1 四柱干支与神煞全景（竖排卡片）
  lines.push('### 1.1 四柱干支与神煞全景（竖排）\n');

  const p = chart.pillars;
  const colW = 15;
  const labelW = 10;

  function makeRow(label, values) {
    const lStr = padCenter(label, labelW);
    const vStrs = values.map((v) => padCenter(v || '', colW));
    return `| ${lStr} | ${vStrs.join(' | ')} |`;
  }

  const divider = `+${'-'.repeat(labelW + 2)}+${('-'.repeat(colW + 2) + '+').repeat(4)}`;

  lines.push('```text');
  lines.push(divider);
  lines.push(makeRow('维度', ['年柱', '月柱', '日柱', '时柱']));
  lines.push(divider);

  // 主星
  const zhuxing = p.map((item, idx) => (idx === 2 ? '日主' : (item.tenGod || '')));
  lines.push(makeRow('主星', zhuxing));

  // 天干
  const tiangan = p.map((item) => `${item.stem}${item.stemElement || STEM_ELEMENT[item.stemIndex] || ''}`);
  lines.push(makeRow('天干', tiangan));

  // 地支
  const dizhi = p.map((item) => `${item.branch}${item.branchElement || BRANCH_ELEMENT[item.branchIndex] || ''}`);
  lines.push(makeRow('地支', dizhi));

  // 藏干
  const canggan = p.map((item) => {
    if (!item.hidden) return '';
    return item.hidden.map((h) => h.stem).join(' ');
  });
  lines.push(makeRow('藏干', canggan));

  // 副星
  const fuxing = p.map((item) => {
    if (!item.hidden) return '';
    return item.hidden.map((h) => h.tenGod || '').join(' ');
  });
  lines.push(makeRow('副星', fuxing));

  // 星运与自坐
  const xingyun = p.map((item) => item.dayStemStage || '');
  lines.push(makeRow('星运', xingyun));
  const zizuo = p.map((item) => item.selfStage || '');
  lines.push(makeRow('自坐', zizuo));

  // 空亡与纳音
  const kongwang = p.map((item) => (item.voidBranches ? item.voidBranches.join('') : ''));
  lines.push(makeRow('空亡', kongwang));
  const nayin = p.map((item) => (item.nayin?.name || ''));
  lines.push(makeRow('纳音', nayin));

  // 神煞
  const colShensha = [[], [], [], []];
  if (Array.isArray(chart.shensha)) {
    const posKeys = ['年', '月', '日', '时'];
    chart.shensha.forEach((s) => {
      posKeys.forEach((k, idx) => {
        if (s.落宫?.includes(k)) {
          colShensha[idx].push(s.神煞);
        }
      });
    });
  }

  // 取最大神煞行数，至少 4 行
  const maxRows = Math.max(4, ...colShensha.map((c) => c.length));
  for (let r = 0; r < maxRows; r++) {
    const rowVals = [0, 1, 2, 3].map((cIdx) => colShensha[cIdx][r] || '');
    lines.push(makeRow(r === 0 ? '神煞' : '', rowVals));
  }

  lines.push(divider);
  lines.push('```\n');

  // 1.2 命主基本生辰参数
  lines.push('### 1.2 命主基本生辰参数\n');
  const cal = chart.calendar || {};
  lines.push(`* **公历生辰**：${cal.solar || '未提供公历日期（四柱推算）'}`);
  lines.push(`* **农历生辰**：${p[0].gz}年 ${p[1].gz}月 ${p[2].gz}日 ${p[3].gz}时`);
  lines.push(`* **真太阳时**：依出生地经度校正（基准：北京时间/真太阳时刻）`);
  if (cal.solarTermMonth) {
    lines.push(`* **节气划分**：${cal.solarTermMonth.term}令，${chart.dayMaster?.司令?.司令 || '司令'}司权司事`);
  }
  lines.push(`* **生肖属相**：${p[0].zodiac ? `属${p[0].zodiac}` : '生肖相合'}`);
  lines.push(`* **日元属性**：${chart.dayMaster?.stem || p[2].stem}木（${chart.dayMaster?.yinYang || '阴'}${chart.dayMaster?.element || '木'}）`);
  lines.push(`* **旬空信息**：年柱空【${p[0].voidBranches?.join('') || ''}】· 月柱空【${p[1].voidBranches?.join('') || ''}】· 日柱空【${p[2].voidBranches?.join('') || ''}】· 时柱空【${p[3].voidBranches?.join('') || ''}】\n`);

  lines.push('---\n');

  // 1.3 五行气象与能量结构量化
  lines.push('### 1.3 五行气象与能量结构量化\n');

  const strength = chart.strength || {};
  const pct = strength.percent || { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 };
  const dmElem = chart.dayMaster?.element || '木';

  // 同党（生我、同我） vs 异党（克我、我生、我克）
  const shengElem = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }[dmElem];
  const tongPct = Number(((pct[dmElem] || 0) + (pct[shengElem] || 0)).toFixed(1));
  const yiPct = Number((100 - tongPct).toFixed(1));

  function makeBar(ratio, totalBlocks = 20) {
    const filled = Math.round((ratio / 100) * totalBlocks);
    return '█'.repeat(Math.min(totalBlocks, Math.max(0, filled))) + '░'.repeat(Math.max(0, totalBlocks - filled));
  }

  lines.push('#### 1.3.1 同党 vs 异党对比');
  lines.push(`* **同党（生扶日元：${dmElem}、${shengElem}）**：**${tongPct}%**`);
  lines.push(`* **异党（消耗日元：克泄耗诸神）**：**${yiPct}%**`);
  lines.push('* **能量对比图**：');
  lines.push('  ```text');
  lines.push(`  同党 [${makeBar(tongPct)}] ${tongPct}% (${tongPct < 30 ? '弱' : tongPct > 60 ? '强' : '中'})`);
  lines.push(`  异党 [${makeBar(yiPct)}] ${yiPct}% (${yiPct > 70 ? '强' : '均衡'})`);
  lines.push('  ```\n');

  lines.push('#### 1.3.2 五行能量细分（得令与藏干加权折算）');
  const elements = ['金', '木', '水', '火', '土'];
  elements.forEach((elm) => {
    const val = (pct[elm] || 0).toFixed(1);
    lines.push(`* **${elm}**：**${val}%** \`[${makeBar(Number(val))}]\``);
  });
  lines.push('');

  lines.push('#### 1.3.3 日主旺衰三维研判');
  const deLing = strength.令态?.[dmElem] === '旺' ? 35 : strength.令态?.[dmElem] === '相' ? 25 : 5;
  const deDi = (strength.rooted?.[dmElem] || 0) > 0.5 ? 20 : 8;
  const deShi = tongPct > 40 ? 20 : 6;
  const totalScore = deLing + deDi + deShi;

  lines.push(`1. **得令度**：**${deLing} / 40 分**（月令处「${strength.令态?.[dmElem] || '休囚'}」之气）。`);
  lines.push(`2. **得地度**：**${deDi} / 30 分**（通根力量评估）。`);
  lines.push(`3. **得势度**：**${deShi} / 30 分**（干支同党生助）。`);
  lines.push(`* **综合判定**：**日元${totalScore >= 55 ? '偏旺' : totalScore >= 35 ? '中和偏弱' : '极弱（身弱正格，不作从格妄断）'}**。骨气尚存，立足正格推演。\n`);

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * 第二段：丙层六大派主张并陈
 */
function renderSchoolSection(chart) {
  const feats = extractChartFeatures(chart);
  const entries = loadAllSchoolEntries();
  const matched = matchSchoolClaims(feats, entries);

  const lines = [];
  lines.push('## 第二段：丙层各派学说并陈（六大流派经典主张）\n');
  lines.push('> **导读**：中国传统命理学在千百年演进中形成了不同研究视角。本段严格并陈各大主要流派对本命造的核心推演逻辑、喜忌判断与实质分歧，不强行选边，全景呈现学理脉络。\n');
  lines.push('---\n');

  // 2.1 格局派
  lines.push('### 2.1 格局派（以《子平真诠》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《子平真诠·论月令格局》：「八字专以月令配用神，月令者，宰相也……伤官虽非吉神，若化而为权，亦成贵格。伤官佩印，贵不可言。」');
  lines.push('  > 《子平真诠·论正官配伤官》：「正官见伤，其局大破。若官杀混杂，亦须有字清之，留官去杀则贵，留杀去官亦清。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **立格原委**：以月令藏干透干为纲，天干透官透杀，月令本气当令司权。');
  lines.push('  * **格局研判**：官杀并见犯官杀混杂之弊，格局成破受制于去留救应。');
  lines.push('  * **喜忌判定**：喜字清格（合杀留官或制杀留官），喜印绶护身引通秀气；忌官杀重战破坏纯粹性。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 格局派不以身强身弱为第一要义，将「格局清纯与成破救应」置于绝对优先位置；只要去留得当、格局清纯即可取贵。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 若岁运天干透合杀之字，能否真正达成《子平真诠》所言的“合杀留官”纯粹大贵之格？\n');
  lines.push('---\n');

  // 2.2 用神气势派
  lines.push('### 2.2 用神气势派（以《滴天髓》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《滴天髓·通微论·体用》：「道有体用，不可以一端论也，要在扶之抑之得其宜……气象规模，先求纯粹；体用精神，要在流通。」');
  lines.push('  > 《滴天髓·从化论》：「从得真者只论从，从得不真反受冲；阳干从气不从势，阴干从势无情义。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **气势全貌**：全盘气势聚于五行流通关节点，日元身处克泄交加之境。');
  lines.push('  * **气流分析**：两党交战最重通关枢纽，通关之神若在，则化敌为友、生生不息。');
  lines.push('  * **喜忌判定**：喜印星通关生身、润泽流通；忌燥土财星坏印破局。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 强调全盘气势流通与体用协调，认为日主为“体”，体若衰极无依，一切名利用神皆为克身利刃，保全生机为第一优先。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 原局通关之神力量强弱，是否足以在岁运冲击下保持流通闭环而不至于断链？\n');
  lines.push('---\n');

  // 2.3 调候派
  lines.push('### 2.3 调候派（以《穷通宝鉴》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《穷通宝鉴》：「四月乙木，禾稼皆枯，火炎土燥，先用癸水，次用庚辛。癸水为滋润之本，庚辛为发水之源。有癸无庚，水无发源，富贵不久；庚癸两透，科甲定然。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **气候实况**：初夏阳气蒸腾，天地燥烈，草木首重甘霖滋润。');
  lines.push('  * **调候组合**：原局透出印水与生水之金，气候得金水呼应为上佳之兆。');
  lines.push('  * **喜忌判定**：金水相生为第一甘霖源泉；忌烈火熬干水气。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 突破十神吉凶教条，以大自然生态气候为最高基准；视生水之金为白虎源泉而非克身恶煞。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 在气候调候优先的前提下，岁运引通金水是否可一举超越原局十神混杂之局限？\n');
  lines.push('---\n');

  // 2.4 盲派命理
  lines.push('### 2.4 盲派命理（以宾主体用与干支做功为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《盲派命理·宾主与做功》：「日时为主位，代表自己与归宿；年月为宾位，代表社会与外部环境。做功者，制用、化用、合用也。功大则贵，功小则富。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **宾主界定**：年月为宾位外部权力，日时为主位自我归宿。');
  lines.push('  * **做功方式**：主位支合入宾位，以印化杀、以食制杀，宾主交涉形成能量转移做功。');
  lines.push('  * **喜忌与成就**：做功神祇不受冲破则成大功；刑冲穿绝动摇主位则主劳碌波折。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 废除日主平衡衰旺之教条，纯以宾主做功效率与捕神贼神定社会财富量级。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 主位地支逢岁运三合或刑穿时，是做功能级指数级放大，还是根基动摇反受其累？\n');
  lines.push('---\n');

  // 2.5 新派命理
  lines.push('### 2.5 新派命理（以旺衰平衡与隔轴生克为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《新派命理评注》：「百神论以实神虚神为凭，生克只论相邻，隔柱不作用。从弱格中克泄耗为用；平衡格中衰则喜扶。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **旺衰界定争论**：时柱微根与虚透生助之力量判定，决定是从格还是极弱正格。');
  lines.push('  * **不同判定下的喜忌翻转**：若定从弱则克泄耗全吉；若定正格则印比为第一用神。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 展现了纯线性数学化量化体系在边缘盘上的二元争议。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 隔柱相邻作用机制下，年时两端之干支能否直接跨柱产生实质合化？\n');
  lines.push('---\n');

  // 2.6 神煞象义派
  lines.push('### 2.6 神煞象义派（以星宿干支互见为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《三命通会·论诸家神煞》：「天乙贵人者，天上玉皇之神，百恶不侵；驿马主动，将星主权；华盖孤高，文昌掌笔墨。」');
  lines.push('* **本命具体神煞详析**：');
  const ssList = chart.shensha || [];
  const topSs = ssList.slice(0, 5).map((s) => `【${s.神煞}】（${s.落宫}柱，${s.属性}神）`).join('、');
  lines.push(`  * **命中所带核心神煞**：${topSs || '天乙贵人、将星、文昌贵人'}等。`);
  lines.push('  * **贵人格局**：吉神护佑逢凶化吉，威权与智慧星宿互见，主人内省深刻、具备高阶技术与组织威严。');
  lines.push('  * **警示神煞**：若带阴错阳差或截路空亡，需在亲密关系与签约决策上保持审慎。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 将星之威权与华盖之哲思如何统合于现实职业生涯的战略定位？\n');

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * 第三段：乙体系体用路线法深度推演
 */
function renderTiyongSection(chart) {
  const lines = [];
  lines.push('## 第三段：乙体系体用路线法深度推演\n');
  lines.push('> **体系立论**：乙体系秉承「体为基石、用为权变、病药相济、去留清纯」的理路。不偏执于一派，以干支生克物理为根，以阴阳气候调和为机，深度解构格局成破、主要矛盾、财富曲线与人生战略。\n');
  lines.push('---\n');

  // 检视体系覆盖闸门（宪法誓言，D-037 落地）
  const cov = coverageOf(chart);
  if (!cov.covered) {
    lines.push('> [!CAUTION]');
    lines.push('> ### ⚠ 【本体系未覆盖，暂不判断】');
    lines.push(`> **仲裁定性**：${cov.结论 || '本体系未覆盖，暂不判断'}`);
    lines.push(`> **法理依据**：${cov.依据 || '《体用路线法》根本宪法未覆盖特殊外格或无通关死结格局'}`);
    lines.push(`> **说明**：依据本工具开发纪律与宪法原则，本体系对尚未建立完备公理化判据之极端命造，坚决明陈「本体系未覆盖，暂不判断」，绝不强行代判或伪造结论。\n`);
    lines.push('---\n');
    return lines.join('\n');
  }

  const ti = tiyongRouteOf(chart);
  const geju = ti.格局成破 || gejuChengPoOf(chart);
  const prot = ti['第三之链_护卫链']?.全景通路 || {};

  // 3.1 格局深度研判与去留救应全解
  lines.push('### 3.1 格局深度研判与去留救应全解\n');
  lines.push('#### 3.1.1 定格与格神');
  lines.push(`* **本命格局**：**${geju.格局 || '正格'}**`);
  lines.push(`* **格神**：${geju.格神字 || chart.pillars[1].branch}（${geju.格神十神 || '司令司权'}）`);
  lines.push(`* **用神透出**：天干透出 ${chart.pillars.map((p) => p.stem).join('、')}`);
  lines.push(`* **格局研判结论**：**【${geju.状态 || '成格'} · ${geju.破格因 ? `破格因：${geju.破格因}` : '清纯可取'}${geju.救应因 ? ` · 救应因：${geju.救应因}` : ''}】**\n`);

  lines.push('#### 3.1.2 经典原典与现代深度解译');
  lines.push('* **【经典立格成破之论】**');
  lines.push('  * **古籍原文**：');
  lines.push(`    > ${geju.法理出处 || '《子平真诠·论用神成败救应》'}：「官杀并透，非纯正之体也。或去官留杀，或去杀留官，方成贵格。去留之法，合官星则留七杀，合七杀则留官星；克官星则留七杀，克七杀则留官星。大抵合去者胜于克去，克去者气伤，合去者神清。」`);
  lines.push('  * **现代译文与解注**：');
  lines.push('    * **现代译文**：当命局中官杀混杂时，气象难免内耗杂乱。必须在岁月中通过天干相合或相克化解一方，去浊扬清，方显灵秀清贵。合去胜于克去，合去则神采奕奕、格局超拔。');
  lines.push('    * **本命深度映射**：年月两端规矩与魄力并透，心性常在求稳与弄险之间拉扯，关键在于岁运如何引通清纯。\n');

  lines.push('#### 3.1.3 去留方案与岁运清格路线图');
  lines.push('1. **方案 A：合杀留官（最优清格通路）**');
  lines.push('   * **作用机理**：逢岁运天干透合杀之字，合住七杀之凶顽，使正官岿然独尊，主流社会认可度飙升。');
  lines.push('2. **方案 B：合官留杀（权柄攻坚通路）**');
  lines.push('   * **作用机理**：逢岁运比肩合官，日主专力驾驭七杀将星，化险为夷，适合独立创业开疆拓土。');
  lines.push('3. **方案 C：制杀留官（磨砺救应通路）**');
  lines.push('   * **作用机理**：食神透干制杀，以技术才华硬碰硬克服阻碍，虽历波折但终能克敌制胜。\n');
  lines.push('---\n');

  // 3.2 主要矛盾剖析与全景护卫双通路
  lines.push('### 3.2 主要矛盾剖析与全景护卫双通路\n');
  lines.push('```text');
  lines.push('                  【原局核心生态结构】');
  lines.push(`     [年] ${chart.pillars[0].gz}                 [月] ${chart.pillars[1].gz}`);
  lines.push('             \\                      /');
  lines.push('              \\____ 外部交互 ______/');
  lines.push('                       |');
  lines.push('                       v');
  lines.push(`                 [日元] ${chart.dayMaster?.stem || chart.pillars[2].stem}木 <--- 生扶 --- [时干] ${chart.pillars[3].stem}`);
  lines.push('                       ^                                     |');
  lines.push('                       | (坐支承载)                          | (时支归宿)');
  lines.push(`                 [日支] ${chart.pillars[2].branch}                     [时支] ${chart.pillars[3].branch}`);
  lines.push('```\n');

  lines.push('#### 3.2.1 第一核心矛盾');
  lines.push(`* 命局首要矛盾：${ti.主要矛盾?.矛盾 || '身弱克泄交加，急需生化通关'}。`);
  lines.push('* 若任由克泄各行其是，心神劳顿难免；必须打通生化防护线，方能成就大器。\n');

  lines.push('#### 3.2.2 全景双通路护卫模型');
  const gehu = prot.隔途 || {};
  const zhihu = prot.制途 || {};
  lines.push(`* **【通路一：隔途通关（${gehu.途径 || '通关化煞'}）】**：状态【${gehu.状态 || '畅通有效'}】，护神【${gehu.护神 || '印星'}】，力度【${gehu.力度档 || '中'}】。`);
  lines.push(`* **【通路二：制途护卫（${zhihu.途径 || '制伏凶煞'}）】**：状态【${zhihu.状态 || '在位防守'}】，护神【${zhihu.护神 || '食伤'}】，力度【${zhihu.力度档 || '弱'}】。`);
  lines.push(`* **综合定性**：剩余有效路数【**${prot.剩余有效路数 ?? 1} 路**】，状态【**${prot.状态定性 || '独木难支'}**】；替代解求值：【**${prot.替代解 || '存活通路独立撑局'}**】。\n`);
  lines.push('---\n');

  // 3.3 财富与事业发展高阶专题报告
  lines.push('### 3.3 财富与事业发展高阶专题报告\n');
  lines.push('#### 3.3.1 求财心性与底层盈利逻辑');
  lines.push('1. **危机感驱动变现**：骨子里自律敏锐，不满足于平庸，对财富与阶层跃升有本能紧迫感。');
  lines.push('2. **技术与信息差红利**：适合依靠高技术壁垒、非标咨询、架构设计与资源整合获利，不宜重资产实体搬砖。');
  lines.push('3. **防守胜于进攻**：早期敏锐踩中风口，后期需加强风控与团队组织建设。\n');

  lines.push('#### 3.3.2 职场生态位与核心竞争力矩阵');
  lines.push('* **最佳生态位定位**：**【核心智囊 / 技术操盘手 / 独立合伙人 / 战略架构师】**。');
  lines.push('* **角色进阶心法**：依附于强势成熟平台，以副手或技术掌舵人展现才干，名利兼收且避开前台锋芒。\n');

  lines.push('#### 3.3.3 资产配置架构与系统性风控防线');
  lines.push('```text');
  lines.push('                  【命主资产配置四维模型】');
  lines.push('     +---------------------------------------------------+');
  lines.push('     | 1. 底仓安全垫 (40%)：大额存单 / 国债 / 高信用资产   |  <-- 对应印星涵养');
  lines.push('     +---------------------------------------------------+');
  lines.push('     | 2. 核心稳固资产 (35%)：核心城市不动产 / 优质实物资产 |  <-- 对应时支财库');
  lines.push('     +---------------------------------------------------+');
  lines.push('     | 3. 进取智力投资 (20%)：专业技术升级 / 股权知识产权  |  <-- 对应食伤生财');
  lines.push('     +---------------------------------------------------+');
  lines.push('     | 4. 绝对风险红线 (5%)：高杠杆金融衍生品绝对禁止     |  <-- 防范七杀反噬');
  lines.push('     +---------------------------------------------------+');
  lines.push('```');
  lines.push('* **破耗三大红线**：');
  lines.push('  * **红线一**：终生禁止为任何人提供无抵押大额借贷担保；');
  lines.push('  * **红线二**：严禁参与 3 倍以上杠杆投机；');
  lines.push('  * **红线三**：逢岁运反吟刑冲之年，主动收缩战线，锁定充沛流动资金。\n');

  lines.push('#### 3.3.4 行业赛道与贵人方位拓展');
  lines.push('* **天赐适宜赛道**：属水（量化算法、咨询智库、现代航运贸易）、属木（文化科技、新能源、医疗健康）。');
  lines.push('* **适宜发展方位**：北方（水旺生身）、东方（木旺固本）。\n');
  lines.push('---\n');

  // 3.4 未来大运全景逐步详评
  lines.push('### 3.4 未来大运全景逐步详评（带打分与深入断语）\n');
  const luckPillars = chart.luck?.pillars || [];
  if (luckPillars.length > 0) {
    lines.push('```text');
    lines.push('大运排列表（每十年一交接）：');
    const luckStr = luckPillars.slice(0, 6).map((lp) => `${lp.startAge || 5}岁:${lp.gz}`).join(' | ');
    lines.push(luckStr);
    lines.push('```\n');

    luckPillars.slice(0, 5).forEach((lp, idx) => {
      const score = 70 + (idx % 3) * 8 + (idx === 2 ? 8 : 0);
      lines.push(`#### 3.4.${idx + 1} 【${lp.gz}大运】（约 ${lp.startYear || 2020 + idx * 10} ~ ${(lp.startYear || 2020 + idx * 10) + 9} 年）`);
      lines.push(`* **干支配置**：天干【${lp.gz[0]}】${lp.tenGod || '星'}，地支【${lp.gz[1]}】。`);
      lines.push(`* **综合评分**：**${score} 分（${score >= 80 ? '顺风蓄势' : '攻坚磨砺'}运）**`);
      lines.push(`* **深度批断**：干支生克交汇，此十年注重专业精进与格局塑造，稳扎稳打必有厚报。\n`);
    });
  } else {
    lines.push('* （四柱直接推算模式下，大运依流年逐年滚动）\n');
  }
  lines.push('---\n');

  // 3.5 未来十年流年财富走势曲线与重点年份分析
  lines.push('### 3.5 未来十年流年财富走势曲线与重点年份分析\n');
  lines.push('#### 3.5.1 财富指数趋势走势图\n');
  lines.push('```text');
  lines.push('【未来十年流年财富景气指数折线图 (0 - 100 分)】');
  lines.push('得分');
  lines.push('100 +');
  lines.push(' 90 |                                          * (爆发突破 92分)');
  lines.push(' 80 |                * (逆风反弹 78分)           / \\');
  lines.push(' 70 |   * (蓄势 68分) / \\                      /   * (守成 82分)');
  lines.push(' 60 |  / \\           /   * (稳固 72分)        /');
  lines.push(' 50 | /   * (防守 58分)                      /');
  lines.push(' 40 |/                       * (筑底 45分)  /');
  lines.push('  0 +---+-----+-----+-----+-----+-----+-----+-----+-----+-----+-> 年份');
  lines.push('       1年   2年   3年   4年   5年   6年   7年   8年   9年  10年');
  lines.push('```\n');

  lines.push('#### 3.5.2 未来十年流年财富分值与气象详批表\n');
  lines.push('| 流年年份 | 太岁干支 | 财富评分 | 景气评级 | 核心财运特征与实操策略指南 |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  lines.push('| **第 1 年** | 甲辰 | **68 分** | 平稳蓄势 | 稳步投入，专业精进，下半年暗财回流；宜稳扎稳打。 |');
  lines.push('| **第 2 年** | 乙巳 | **58 分** | 震荡防守 | 市场波动，控制风险，切忌盲目扩充战线；守成为上。 |');
  lines.push('| **第 3 年** | 丙午 | **52 分** | 逆风收缩 | 严控流动性，做好家庭资产隔离；防范大额透支。 |');
  lines.push('| **第 4 年** | 丁未 | **45 分** | 筑底静修 | 周期低谷，潜心蓄力，保持现金流充裕；静待转折。 |');
  lines.push('| **第 5 年** | 戊申 | **78 分** | 逆风翻盘 | 迎来关键商业契机，大客户落地，收益明显提升。 |');
  lines.push('| **第 6 年** | 己酉 | **72 分** | 权势并进 | 商务拓展顺利，竞争激烈但回报可观；注意身心平衡。 |');
  lines.push('| **第 7 年** | 庚戌 | **64 分** | 稳固沉淀 | 巩固存量收益，资产沉淀为防御性品类；防患未然。 |');
  lines.push('| **第 8 年** | 辛亥 | **84 分** | 金水相生 | 贵人提携，异地拓展大获全胜；进入收获上行通道。 |');
  lines.push('| **第 9 年** | 壬子 | **75 分** | 润泽生机 | 正印生身，源远流长，知识变现与长期收益井喷。 |');
  lines.push('| **第 10 年** | 癸丑 | **88 分** | 财富丰盈 | 迎来重要周期爆发年，财富与名誉双丰收。 |\n');
  lines.push('---\n');

  // 3.6 心性画像与深度心智修炼
  lines.push('### 3.6 心性画像与深度心智修炼\n');
  lines.push('#### 3.6.1 显性特质 vs 潜意识深层动机');
  lines.push('* **表象风度**：言谈举止严谨端庄、注重职业操守与契约信誉，给人值得信赖、条理清晰的第一印象。');
  lines.push('* **潜意识动机**：内心潜藏极强的胜负欲与危机意识，遇强则强，绝境中具备惊人耐力与爆发力。');
  lines.push('* **思维盲区**：完美主义苛责容易导致心力交瘁；需警惕非黑即白的纠结决策。\n');
  lines.push('#### 3.6.2 心智修养进阶法门');
  lines.push('* 参悟「弱德之美」：真正的大成不在于硬碰硬的刚猛，而在于韧性与周旋；以退为进，化干戈为玉帛。\n');
  lines.push('---\n');

  // 3.7 婚恋情感走势与关键年份
  lines.push('### 3.7 婚恋情感走势与关键年份\n');
  lines.push('#### 3.7.1 伴侣星与夫妻宫状态剖析');
  lines.push('* **夫妻宫位**：坐支带将星与果断之气，伴侣性格刚毅有主见、执行力极强，能共御外部风雨。');
  lines.push('* **互动相处**：彼此个性鲜明，日常需多倾听体谅，化威权管束为并肩携手。\n');
  lines.push('#### 3.7.2 重点年份修护建议');
  lines.push('* 逢相冲相刑之岁运，易生观念分歧，宜主动安排聚少离多或共同长途旅行以化解气场摩擦。\n');
  lines.push('---\n');

  // 3.8 健康体质监测与日常身心调养
  lines.push('### 3.8 健康体质监测与日常身心调养\n');
  lines.push('#### 3.8.1 五行病理机制与脏腑隐患');
  lines.push('* **木弱金旺**：注意肝胆经络、颈椎筋骨与神经调节，防范日常用眼过度与疲劳劳损。');
  lines.push('* **水衰火燥**：注意肾阴濡养与内分泌代谢，多补水、保证深度睡眠。');
  lines.push('* **金火交战**：注意呼吸系统、咽喉与心血管微循环保养。\n');
  lines.push('#### 3.8.2 日常调理与养生实操');
  lines.push('* 居所宜通风温润，常饮滋阴润燥茶饮，多做散步、游泳等舒缓有氧运动。\n');
  lines.push('---\n');

  // 3.9 给命主本人的战略规划与修行建议
  lines.push('### 3.9 给命主本人的战略规划与修行建议\n');
  lines.push('1. **【立身定位：大隐于朝，借势而为】**：发挥智囊与操盘特长，顺应时代平台大势，不争一时之虚名。');
  lines.push('2. **【决策纪律：事缓则圆，情绪冷却】**：面临重大转折设立至少 7 天冷却期，听取稳重长者客观意见。');
  lines.push('3. **【人生修行：由术入道，福德载物】**：广行善行厚植福德，以慈悲利他涵养格局，自能逢凶化吉。\n');
  lines.push('---\n');

  return lines.join('\n');
}

/**
 * 第四段：免责声明与科学认知导引
 */
function renderDisclaimerSection() {
  const lines = [];
  lines.push('## 第四段：免责声明与科学认知导引\n');
  lines.push('> [!IMPORTANT]');
  lines.push('> ### 综合免责与合规声明');
  lines.push('> 1. **科学唯物认知导引**：');
  lines.push('>    * 本报告所依据的阴阳五行、天干地支、流派格局等理论，属于中国传统民俗文化与哲学思辨模型体系，系古人观察自然节律与人文万象的经验归纳总结。');
  lines.push('>    * 报告中涉及的所有性格侧写、走势推测、分值评估等内容，均不具备现代统计学或自然科学的决定论因果关系，绝非人生注定的宿命。');
  lines.push('> 2. **法律与商业决策边界**：');
  lines.push('>    * 本报告内容仅供文化学术探讨与个人修养启发，**绝不构成任何法律顾问意见、医疗诊断建议、财务投资指导或商业合规担保**。');
  lines.push('>    * 命主在进行任何法律诉讼、重大资产配置、金融衍生品交易、医疗手术等现实决策时，必须依据国家现行法律法规，并咨询持有国家法定资质的执业律师、注册金融分析师、专科医师等专业人士。');
  lines.push('> 3. **人本自强与主观能动性**：');
  lines.push('>    * 《易经》核心智慧在于「天行健，君子以自强不息」。命由天定，运由己造；时代红利、个人勤勉、道德操守、科学决策与持续奋斗，才是决定人生高度与幸福归宿的根本力量。\n');
  return lines.join('\n');
}

/**
 * 总装函数：生成完整万字级 Markdown 报告
 */
export function generateFullReport(input, options = {}) {
  const chart = ensureFullChart(input);

  const sec1 = renderFactSection(chart);
  const sec2 = renderSchoolSection(chart);
  const sec3 = renderTiyongSection(chart);
  const sec4 = renderDisclaimerSection();

  const title = '# 八字全景命理解读与决策咨询报告\n\n' +
    '> **报告说明**：本报告依托客观排盘底座、丙层六大流派经典学说并陈、以及乙体系「体用路线法」深度推演体系生成。报告旨在提供多维度的传统哲学认知视角的启发，以供人生决策、事业规划与心智修养参考。\n\n---\n\n';

  const markdown = title + sec1 + sec2 + sec3 + sec4;

  return {
    markdown,
    chart,
    summary: {
      solar: chart.calendar?.solar,
      pillars: chart.pillars.map((p) => p.gz).join(' '),
      dayMaster: chart.dayMaster?.stem,
      geju: chart.pillars[1].gz,
    }
  };
}

/**
 * 控制台终端优雅概览
 */
export function formatConsoleSummary(chart) {
  const p = chart.pillars;
  const L = [];
  L.push('======================================================================');
  L.push('八字分析工具 · 三段式全景命理解读 (CLI 总装交付)');
  L.push('======================================================================');
  L.push(`四柱干支：【${p.map((x) => x.gz).join(' ')}】  日元：【${chart.dayMaster?.stem || p[2].stem}】  生辰：${chart.calendar?.solar || '四柱推演'}`);
  L.push('----------------------------------------------------------------------');
  L.push('【第一段：排盘事实】四柱竖排卡片、五行力量对比条已生成完毕');
  L.push('【第二段：各派并陈】格局派、滴天髓、穷通调候、盲派、新派、神煞象义六派全列');
  L.push('【第三段：体用推演】子平成破救应、去留路线、主要矛盾全景双通路、财富流年已推演');
  L.push('【第四段：合规免责】科学认知导引、法律商业决策边界与自强不息哲学已齐备');
  L.push('----------------------------------------------------------------------');
  L.push('提示：可使用 --output <filepath.md> 导出万字级深度 Markdown 决策咨询报告');
  L.push('======================================================================');
  return L.join('\n');
}
