// 核心/report-generator.mjs
// 三段式全景命理解读与决策咨询报告生成器（整车总装核心大脑，D-039 落地，D-055 治理，D-087 解耦）
// 严格遵循《三段式全景命理解读深度示范报告.md》标准规格：
// 1. 排盘事实层（客观无争议事实底座，竖排四柱卡片、五行能量条、旺衰三维研判）
// 2. 丙层六大流派经典主张并陈（格局派、旺衰平衡派、调候穷通派、盲派象法、古法三命、神煞象义派，六派并陈不选边，附现代新派延伸视点）
// 3. 乙体系体用路线法深度推演（八格成破救应全解、去留路线、主要矛盾双通路、财富专题、逐运详批、未来十年流年真实推演、心性婚恋健康战略规划；不设宿命论层次与机械打分）
// 4. 四重免责声明与科学认知导引（现代科学哲学、法律商业边界与自强不息哲学）

import { coverageOf } from './tiyong.mjs';
import { ensureFullChart } from './report/common.mjs';
import { renderFactSection } from './report/section1_facts.mjs';
import { renderSchoolSection } from './report/section2_schools.mjs';
import { renderTiyongSection } from './report/section3_tiyong.mjs';
import { renderDisclaimerSection } from './report/section4_disclaimer.mjs';

// 子模块全量重新导出，保持 100% 向后兼容（D-087 落地）
export * from './report/common.mjs';
export * from './report/section1_facts.mjs';
export * from './report/section2_schools.mjs';
export * from './report/section3_tiyong.mjs';
export * from './report/section4_disclaimer.mjs';

/**
 * 总装函数：生成完整万字级 Markdown 报告
 */
export function generateFullReport(input, options = {}) {
  const chart = ensureFullChart(input, options);

  const sec1 = renderFactSection(chart);
  const sec2 = renderSchoolSection(chart);
  const sec3 = renderTiyongSection(chart, options);
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
  let solarDesc = chart.calendar?.solar || '四柱推演';
  if (chart.isFourPillarsMode) {
    if (chart.dateCandidatesInfo?.chosenYear) {
      if (chart.dateCandidatesInfo.userSpecifiedYear && !chart.dateCandidatesInfo.exactMatched) {
        solarDesc = `${chart.dateCandidatesInfo.chosenDate}（四柱推演，指定 ${chart.dateCandidatesInfo.targetYear} 回退锚定 ${chart.dateCandidatesInfo.chosenYear} 年）`;
      } else if (chart.dateCandidatesInfo.userSpecifiedYear) {
        solarDesc = `${chart.dateCandidatesInfo.chosenDate}（四柱推演，锚定基准年：${chart.dateCandidatesInfo.chosenYear} 年）`;
      } else {
        solarDesc = `${chart.dateCandidatesInfo.chosenDate}（四柱推演，默认启发式锚定：${chart.dateCandidatesInfo.chosenYear} 年）`;
      }
    } else {
      solarDesc = '四柱直推（未匹配有效公历时代）';
    }
  }
  L.push(`四柱干支：【${p.map((x) => x.gz).join(' ')}】  日元：【${chart.dayMaster?.stem || p[2].stem}】  生辰：${solarDesc}`);
  L.push('----------------------------------------------------------------------');
  L.push('【第一段：排盘事实】四柱竖排卡片、五行力量对比条已生成完毕');
  L.push('【第二段：各派并陈】格局派、旺衰平衡派、调候穷通派、盲派象法、古法三命、神煞象义六派全列');
  const cov = chart.coverage || coverageOf(chart, {});
  if (cov?.covered === false) {
    L.push(`⚠️ 【第三段：本体系未覆盖，暂不判断】（${cov?.原因 || cov?.结论 || '特殊未立宪格局，依据宪法铁律坚决不硬答'}）`);
  } else {
    L.push('【第三段：体用推演】子平成破救应、去留路线、主要矛盾全景双通路、财富流年已推演');
  }
  L.push('【第四段：合规免责】科学认知导引、法律商业决策边界与自强不息哲学已齐备');
  L.push('----------------------------------------------------------------------');
  L.push('提示：可使用 --output <filepath.md> 导出万字级深度 Markdown 决策咨询报告');
  L.push('======================================================================');
  return L.join('\n');
}
