// 核心/report/section1_facts.mjs
// 第一段：排盘事实层 Markdown 装配器（四柱卡片、星运、竖排神煞、能量条、旺衰研判，D-087 落地）

import {
  STEMS, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS
} from '../engine.mjs';
import {
  padCenter, calcTongYiDang
} from './common.mjs';

/**
 * 第一段：排盘事实层生成
 */
export function renderFactSection(chart) {
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

  // 神煞（字段名严格对齐底座 shenshaOf 的结构：{ name, positions, nature, note }）
  const colShensha = [[], [], [], []];
  if (Array.isArray(chart.shensha)) {
    const posKeys = ['年', '月', '日', '时'];
    chart.shensha.forEach((s) => {
      const positions = Array.isArray(s?.positions) ? s.positions : [];
      posKeys.forEach((k, idx) => {
        if (positions.some((ps) => String(ps).startsWith(k))) {
          colShensha[idx].push(s.name || '');
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

  const dmElem = chart.dayMaster?.element || STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] || '木';

  // 1.2 命主基本生辰参数
  lines.push('### 1.2 命主基本生辰参数\n');
  const cal = chart.calendar || {};
  lines.push(`* **公历生辰**：${cal.solar || '未提供公历日期（四柱推算）'}`);
  lines.push(`* **农历生辰**：${p[0].gz}年 ${p[1].gz}月 ${p[2].gz}日 ${p[3].gz}时`);
  const ts = chart.calendar?.trueSolar;
  if (ts && ts.longitude !== undefined && ts.longitude !== null) {
    const lonSign = ts.longitude >= 0 ? `${ts.longitude}°E` : `${Math.abs(ts.longitude)}°W`;
    const diffMin = ts.totalMinutes !== undefined ? `，时差校正 ${ts.totalMinutes >= 0 ? '+' : ''}${ts.totalMinutes} 分钟` : '';
    const detail = ts.corrected ? `，真太阳时刻：\`${ts.corrected}\`` : '';
    lines.push(`* **真太阳时**：已依出生地经度（${lonSign}）校正${diffMin}${detail}`);
  } else {
    lines.push(`* **真太阳时**：未指定经度校正（默认基准：北京时间/平太阳时 120°E，可通过 CLI 参数 --longitude <经度> 进行真太阳时校正）`);
  }
  if (cal.solarTermMonth) {
    lines.push(`* **节气划分**：${cal.solarTermMonth.term}令，${chart.dayMaster?.司令?.司令 || '司令'}司权司事`);
  }
  lines.push(`* **生肖属相**：${p[0].zodiac ? `属${p[0].zodiac}` : '生肖相合'}`);
  lines.push(`* **日元属性**：${chart.dayMaster?.stem || p[2].stem}${dmElem}（${chart.dayMaster?.yinYang || '阴'}${dmElem}）`);
  lines.push(`* **旬空信息**：年柱空【${p[0].voidBranches?.join('') || ''}】· 月柱空【${p[1].voidBranches?.join('') || ''}】· 日柱空【${p[2].voidBranches?.join('') || ''}】· 时柱空【${p[3].voidBranches?.join('') || ''}】\n`);

  if (chart.isFourPillarsMode && chart.dateCandidatesInfo) {
    const info = chart.dateCandidatesInfo;
    if (info.candidates && info.candidates.length > 0) {
      lines.push('> **【公历反推多解性与基准年披露】**：');
      lines.push(`> 本报告由四柱干支直推生成。六十甲子六十年一元循环，在 1600–2050 年区间内，共检索到 ${info.candidates.length} 个天体公历重合生辰：`);
      info.candidates.forEach((c, idx) => {
        lines.push(`> * 候选 ${idx + 1}：\`${c.solarDate}\`${c.isChosen ? ' ★【本次推演选定基准】' : ''}`);
      });
      let noteWhy = '';
      if (info.userSpecifiedYear) {
        if (info.exactMatched) {
          noteWhy = `依调用指令显式指定基准年（${info.chosenYear} 年）。`;
        } else {
          noteWhy = `调用指令尝试指定基准年（${info.targetYear} 年），但在 1600–2050 年区间内该四柱未在 ${info.targetYear} 年出现，已依最小时间距离原则匹配回退至最临近样本（${info.chosenYear} 年）。`;
        }
      } else {
        const isFuture = info.chosenYear > 2026;
        noteWhy = `未显式指定年份，系统默认锚定近代活跃年龄中位基准（${info.chosenYear} 年生${isFuture ? '，属于未来时代命造' : '，当前正值核心事业期'}）。`;
      }
      lines.push(`> ※ **时代基准说明**：${noteWhy}若实际命主出生于其他年代，大运绝对公历年份将整体平移 60 年的整数倍，可通过 \`--year <年份>\` 显式锁定基准。\n`);
    } else {
      lines.push('> **【四柱直推说明】**：本报告由四柱干支直接排定，未在 1600–2050 年区间内匹配得唯一样本，大运依流年逐年滚动。\n');
    }
  }

  lines.push('---\n');

  // 1.3 五行气象与能量结构量化
  lines.push('### 1.3 五行气象与能量结构量化\n');

  const strength = chart.strength || {};
  const { tongPct, yiPct, shengElem, pct } = calcTongYiDang(chart);

  function makeBar(ratio, totalBlocks = 20) {
    const filled = Math.round((ratio / 100) * totalBlocks);
    return '█'.repeat(Math.min(totalBlocks, Math.max(0, filled))) + '░'.repeat(Math.max(0, totalBlocks - filled));
  }

  lines.push('#### 1.3.1 同党 vs 异党对比');
  lines.push(`* **同党（生扶日元：${dmElem}、${shengElem}）**：**${tongPct}%**`);
  lines.push(`* **异党（消耗日元：克泄耗诸神）**：**${yiPct}%**`);
  lines.push('* **能量对比图**：');
  lines.push('  ```text');
  lines.push(`  同党 [${makeBar(tongPct)}] ${tongPct}% (${tongPct < 35 ? '弱' : tongPct > 65 ? '强' : '中和'})`);
  lines.push(`  异党 [${makeBar(yiPct)}] ${yiPct}% (${yiPct > 65 ? '强' : yiPct < 35 ? '弱' : '中和'})`);
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
