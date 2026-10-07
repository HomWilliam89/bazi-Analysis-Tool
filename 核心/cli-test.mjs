// 核心/cli-test.mjs
// 八字分析工具 · 期 5 命令行与整车总装自动化测试套件（D-039 验证）
// 覆盖：
//   1. report-generator 模块接口与双输入格式解析
//   2. 三段式全景报告内容完整性（四段式齐全、结构无缺漏）
//   3. 乙体系未覆盖（认怂出口）在总装报告中的横幅呈现
//   4. 严格合规检查：默认严禁泄露「八字整体层次评估」隐藏项
//   5. CLI 命令行参数解析、标准退出码与文件导出功能验证

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateFullReport, ensureFullChart, formatConsoleSummary } from './report-generator.mjs';
import { runCli } from '../命令行/bazi.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(desc, condition) {
  totalTests += 1;
  if (condition) {
    passedTests += 1;
    console.log(`  ✓ ${desc}`);
  } else {
    failedTests += 1;
    console.log(`  ✗ ${desc}`);
  }
}

console.log('======================================================================');
console.log('【期 5 三段式 CLI 交付工具与总装生成器自动化测试套件 · D-039】');
console.log('======================================================================\n');

// -------------------------------------------------------------------
// 1. report-generator 模块接口与输入格式测试
// -------------------------------------------------------------------
console.log('▶ [测试组 1] report-generator 接口与输入解析测试');

const chartFromBirth = ensureFullChart({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' });
assert('生辰输入模式正确解析出四柱 pillars 且长度为 4', chartFromBirth.pillars?.length === 4);
assert('生辰输入模式正确解析日主天干为 乙', chartFromBirth.dayMaster?.stem === '乙');

const chartFromPillars = ensureFullChart(['庚午', '辛巳', '乙酉', '癸未']);
assert('四柱数组输入模式正确解析出四柱 pillars', chartFromPillars.pillars?.length === 4);
assert('四柱数组输入模式正确识别日元为 乙', chartFromPillars.dayMaster?.stem === '乙');

// -------------------------------------------------------------------
// 2. 三段式全景报告内容与四段式结构完整性测试
// -------------------------------------------------------------------
console.log('\n▶ [测试组 2] 三段式全景报告结构与内容完整性测试');

const report = generateFullReport({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' });
const md = report.markdown;

assert('报告包含主标题', md.includes('# 八字全景命理解读与决策咨询报告'));
assert('包含第一段排盘事实标题', md.includes('## 第一段：排盘事实'));
assert('第一段包含 1.1 竖排四柱卡片 ASCII 表格', md.includes('### 1.1 四柱干支与神煞全景（竖排）') && md.includes('|    维度    |      年柱       |      月柱       |      日柱       |      时柱       |'));
assert('第一段包含 1.2 命主基本生辰参数', md.includes('### 1.2 命主基本生辰参数'));
assert('第一段包含 1.3.1 同党 vs 异党对比', md.includes('#### 1.3.1 同党 vs 异党对比'));
assert('第一段包含 1.3.2 五行能量细分', md.includes('#### 1.3.2 五行能量细分'));
assert('第一段包含 1.3.3 日主旺衰三维研判', md.includes('#### 1.3.3 日主旺衰三维研判'));

assert('包含第二段丙层各派学说并陈标题', md.includes('## 第二段：丙层各派学说并陈'));
assert('第二段包含 2.1 格局派', md.includes('### 2.1 格局派'));
assert('第二段包含 2.2 用神气势派', md.includes('### 2.2 用神气势派'));
assert('第二段包含 2.3 调候派', md.includes('### 2.3 调候派'));
assert('第二段包含 2.4 盲派命理', md.includes('### 2.4 盲派命理'));
assert('第二段包含 2.5 新派命理', md.includes('### 2.5 新派命理'));
assert('第二段包含 2.6 神煞象义派', md.includes('### 2.6 神煞象义派'));

assert('包含第三段乙体系体用路线法推演标题', md.includes('## 第三段：乙体系体用路线法深度推演'));
assert('第三段包含 3.1 格局深度研判与去留救应', md.includes('### 3.1 格局深度研判与去留救应全解'));
assert('第三段包含 3.2 主要矛盾剖析与全景护卫双通路', md.includes('### 3.2 主要矛盾剖析与全景护卫双通路'));
assert('第三段包含 3.3 财富与事业发展高阶专题', md.includes('### 3.3 财富与事业发展高阶专题报告'));
assert('第三段包含 3.4 未来大运全景逐步详评', md.includes('### 3.4 未来大运全景逐步详评'));
assert('第三段包含 3.5 未来十年流年财富走势曲线与重点年份分析', md.includes('### 3.5 未来十年流年财富走势曲线与重点年份分析'));
assert('第三段包含 3.6 心性画像与心智修炼', md.includes('### 3.6 心性画像与深度心智修炼'));
assert('第三段包含 3.7 婚恋情感走势', md.includes('### 3.7 婚恋情感走势与关键年份'));
assert('第三段包含 3.8 健康体质监测与日常调养', md.includes('### 3.8 健康体质监测与日常身心调养'));
assert('第三段包含 3.9 给命主本人的战略规划与修行建议', md.includes('### 3.9 给命主本人的战略规划与修行建议'));

assert('包含第四段免责声明与科学认知导引', md.includes('## 第四段：免责声明与科学认知导引'));

// -------------------------------------------------------------------
// 3. 认怂出口与宪法未覆盖测试
// -------------------------------------------------------------------
console.log('\n▶ [测试组 3] 认怂出口与宪法未覆盖呈现测试');

const uncoveredReport = generateFullReport(['乙卯', '乙酉', '乙卯', '辛酉']);
assert('未覆盖盘正确输出认怂警示横幅「本体系未覆盖，暂不判断」', uncoveredReport.markdown.includes('本体系未覆盖，暂不判断'));

// -------------------------------------------------------------------
// 4. 严格合规检查：隐藏项未泄露
// -------------------------------------------------------------------
console.log('\n▶ [测试组 4] 隐藏项合规自律测试');

assert('报告正文严禁出现「八字整体层次评估」字样（按 D-039 严格隐藏）', !md.includes('八字整体层次评估'));
assert('未覆盖报告正文亦无「八字整体层次评估」', !uncoveredReport.markdown.includes('八字整体层次评估'));

// -------------------------------------------------------------------
// 5. 命令行 runCli 参数解析与导出功能测试
// -------------------------------------------------------------------
console.log('\n▶ [测试组 5] CLI 命令行执行与文件导出测试');

const codeHelp = await runCli(['-h']);
assert('CLI -h 执行返回状态码 0', codeHelp === 0);

const codeSolar = await runCli(['--solar', '1990-05-20 14:30', '--gender', '男']);
assert('CLI --solar 正常执行返回状态码 0', codeSolar === 0);

const codePillars = await runCli(['庚午', '辛巳', '乙酉', '癸未']);
assert('CLI 四柱传参正常执行返回状态码 0', codePillars === 0);

const testOutFile = path.join(ROOT, '命令行', 'temp-test-report.md');
const codeExport = await runCli(['庚午', '辛巳', '乙酉', '癸未', '-o', testOutFile]);
assert('CLI -o 导出文件执行返回状态码 0', codeExport === 0);
assert('导出目标文件真实落地且大小大于 5000 字节', fs.existsSync(testOutFile) && fs.statSync(testOutFile).size > 5000);

// 清理临时测试文件
if (fs.existsSync(testOutFile)) {
  fs.unlinkSync(testOutFile);
}
assert('测试临时文件清理完毕', !fs.existsSync(testOutFile));

const codeInvalid = await runCli(['invalid-arguments']);
assert('CLI 非法参数返回非零状态码 1', codeInvalid === 1);

// -------------------------------------------------------------------
// 6. SKILL.md 技能规范与 sync-skill 镜像分发测试
// -------------------------------------------------------------------
console.log('\n▶ [测试组 6] SKILL.md 技能规范与 sync-skill 镜像分发测试');

const skillPath = path.join(ROOT, 'SKILL.md');
assert('根目录 SKILL.md 文件存在', fs.existsSync(skillPath));
const skillContent = fs.readFileSync(skillPath, 'utf8');
assert('SKILL.md 包含技能标识 name: bazi-analysis', skillContent.includes('name: bazi-analysis'));
assert('SKILL.md 包含命令行调用示例', skillContent.includes('node 命令行/bazi.mjs'));

const { syncSkill, SYNC_MANIFEST } = await import('../工具/sync-skill.mjs');
assert('sync-skill 清单定义至少包含 20 个核心资产', SYNC_MANIFEST.length >= 20);

const tempMirrorDir = path.join(ROOT, '命令行', 'temp-skill-mirror');
const applyRes = syncSkill({ skillDir: tempMirrorDir, apply: true, silent: true });
assert('sync-skill --apply 真分发执行成功且返回退出码 0', applyRes.exitCode === 0 && applyRes.copiedCount === SYNC_MANIFEST.length);
assert('镜像目录 命令行/bazi.mjs 入口真实落地', fs.existsSync(path.join(tempMirrorDir, '命令行', 'bazi.mjs')));
assert('镜像目录 bazi.mjs 根级跳板真实落地', fs.existsSync(path.join(tempMirrorDir, 'bazi.mjs')));

// 真跑断言 1：从镜像目录真实运行 node 命令行/bazi.mjs
const mirrorOut1 = execFileSync(process.execPath, [path.join(tempMirrorDir, '命令行', 'bazi.mjs'), '庚午', '辛巳', '乙酉', '癸未'], {
  cwd: tempMirrorDir,
  encoding: 'utf8',
});
assert('镜像内 命令行/bazi.mjs 真实运行成功且输出正常', mirrorOut1.includes('日元：【乙】') && mirrorOut1.includes('第一段：排盘事实'));

// 真跑断言 2：从镜像目录真实运行 node bazi.mjs
const mirrorOut2 = execFileSync(process.execPath, [path.join(tempMirrorDir, 'bazi.mjs'), '庚午', '辛巳', '乙酉', '癸未'], {
  cwd: tempMirrorDir,
  encoding: 'utf8',
});
assert('镜像内 根级 bazi.mjs 真实运行成功且输出正常', mirrorOut2.includes('日元：【乙】') && mirrorOut2.includes('第一段：排盘事实'));

const checkRes = syncSkill({ skillDir: tempMirrorDir, apply: false, silent: true });
assert('sync-skill --check 二次复核 100% 一致且退出码 0', checkRes.exitCode === 0 && checkRes.consistentCount === SYNC_MANIFEST.length);

if (fs.existsSync(tempMirrorDir)) {
  fs.rmSync(tempMirrorDir, { recursive: true, force: true });
}
assert('测试临时镜像目录清理完毕', !fs.existsSync(tempMirrorDir));

// -------------------------------------------------------------------
// 7. 报告千盘千面与防伪防通稿看门狗测试
// -------------------------------------------------------------------
console.log('\n▶ [测试组 7] 报告千盘千面与防伪防通稿看门狗测试');

const chartA = { year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' };
const chartB = { year: 1984, month: 10, day: 2, hour: 6, minute: 0, gender: '男' };
const repA = generateFullReport(chartA).markdown;
const repB = generateFullReport(chartB).markdown;

assert('看门狗1：A盘日元属性为乙木且无写死错字', repA.includes('日元属性**：乙木（阴木）'));
assert('看门狗2：B盘日元属性为己土且无写死木字', repB.includes('日元属性**：己土（阴土）'));
assert('看门狗3：A盘最旺五行为金，B盘最旺五行为水', repA.includes('最旺五行【金】') && repB.includes('最旺五行【水】'));
assert('看门狗4：A盘与B盘健康体质诊断文本绝不相同', repA.slice(repA.indexOf('### 3.8'), repA.indexOf('### 3.8') + 300) !== repB.slice(repB.indexOf('### 3.8'), repB.indexOf('### 3.8') + 300));
assert('看门狗5：A盘夫妻宫坐酉透七杀，B盘夫妻宫坐巳透正印且画像不同', repA.includes('日支坐【酉】（藏干本气透【七杀】）') && repB.includes('日支坐【巳】（藏干本气透【正印】）'));
assert('看门狗6：流年太岁真实计算，2026年A盘岁君为伤官而B盘为正印', repA.includes('| **2026 年** | 丙午 | 天河水 | 伤官 |') && repB.includes('| **2026 年** | 丙午 | 天河水 | 正印 |'));
assert('看门狗7：报告彻底废除假折线图和虚假分值（88分/68分清零）', !repA.includes('财富景气指数折线图') && !repA.includes('88 分') && !repA.includes('68 分'));
assert('看门狗8：未覆盖盘坚决熔断，第三段仅含认怂横幅且绝无3.1/3.5等伪解读', uncoveredReport.markdown.includes('本体系未覆盖，暂不判断') && !uncoveredReport.markdown.includes('### 3.1') && !uncoveredReport.markdown.includes('### 3.5'));
assert('看门狗9：三盘报告全篇严禁出现 undefined 字段错配残渣（1.1 神煞栏与 2.6 神煞详析须真实落地）', !repA.includes('undefined') && !repB.includes('undefined') && !uncoveredReport.markdown.includes('undefined'));

const matrixCharts = [
  { name: 'A-乙木七杀', input: chartA },
  { name: 'B-己土印绶', input: chartB },
  { name: 'C-甲木火伤官', input: ['丁卯', '丙午', '甲午', '丙寅'] },
  { name: 'D-辛金水伤官', input: ['癸亥', '癸亥', '辛丑', '己丑'] },
  { name: 'E-建禄身旺', input: ['甲子', '丙寅', '甲子', '甲子'] },
];

const matrixSec3 = matrixCharts.map((c) => {
  const md = generateFullReport(c.input).markdown;
  const sec3 = md.slice(md.indexOf('## 第三段'), md.indexOf('## 第四段'));
  const lines = sec3.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#') && l !== '---');
  return { name: c.name, lines, set: new Set(lines) };
});

let maxPairRatio = 0;
let allPairsUnder60 = true;
for (let i = 0; i < matrixSec3.length; i++) {
  for (let j = i + 1; j < matrixSec3.length; j++) {
    const c1 = matrixSec3[i];
    const c2 = matrixSec3[j];
    const sameCount = c1.lines.filter((l) => c2.set.has(l)).length;
    const ratio1 = sameCount / c1.lines.length;
    const ratio2 = sameCount / c2.lines.length;
    const maxR = Math.max(ratio1, ratio2);
    if (maxR > maxPairRatio) maxPairRatio = maxR;
    if (maxR >= 0.60) allPairsUnder60 = false;
  }
}

assert('看门狗10：多盘对全矩阵（5盘10对组合）第三段实质解读相同率严格低于60%（实测峰值≤50%，彻底锁定千盘千面）', allPairsUnder60 && maxPairRatio < 0.50);

// -------------------------------------------------------------------
// 统计汇总
// -------------------------------------------------------------------
console.log('\n----------------------------------------------------------------------');
console.log(`【测试结果看板】通过: ${passedTests} 项，失败: ${failedTests} 项`);
if (failedTests > 0) {
  console.log('✗ 测试存在失败项！');
  process.exit(1);
} else {
  console.log('✓ 期 5 命令行与整车总装自动化测试套件全绿通过！');
  console.log('----------------------------------------------------------------------\n');
}
