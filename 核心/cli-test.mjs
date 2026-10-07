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
assert('第三段包含 3.5 未来十年流年财富走势折线图与表', md.includes('### 3.5 未来十年流年财富走势曲线与重点年份分析'));
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
assert('sync-skill 清单定义至少包含 19 个核心资产', SYNC_MANIFEST.length >= 19);

const tempMirrorDir = path.join(ROOT, '命令行', 'temp-skill-mirror');
const applyRes = syncSkill({ skillDir: tempMirrorDir, apply: true, silent: true });
assert('sync-skill --apply 真分发执行成功且返回退出码 0', applyRes.exitCode === 0 && applyRes.copiedCount === SYNC_MANIFEST.length);
assert('镜像目录 bazi.mjs 入口真实落地', fs.existsSync(path.join(tempMirrorDir, 'bazi.mjs')));

const checkRes = syncSkill({ skillDir: tempMirrorDir, apply: false, silent: true });
assert('sync-skill --check 二次复核 100% 一致且退出码 0', checkRes.exitCode === 0 && checkRes.consistentCount === SYNC_MANIFEST.length);

if (fs.existsSync(tempMirrorDir)) {
  fs.rmSync(tempMirrorDir, { recursive: true, force: true });
}
assert('测试临时镜像目录清理完毕', !fs.existsSync(tempMirrorDir));

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
