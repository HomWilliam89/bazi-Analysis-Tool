// 丙层 · 六大主流学派动态规则匹配器自动化测试套件
// 依据决策编号 D-038 落地构建：消除匹配器无测裸奔隐患，
// 全面验证单源条目解析、命盘特征提取、六大学派典型规则命中与排除，以及格式化渲染健壮性。
// 用法：node 核心\matcher-test.mjs
// 退出码：0 全绿，1 有失败项

import assert from 'node:assert/strict';
import {
  loadAllSchoolEntries,
  extractChartFeatures,
  matchSchoolClaims,
  formatSchoolMatches,
} from './school-matcher.mjs';

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    passedCount += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedCount += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('======================================================================');
console.log('【丙层流派匹配器自动化测试套件 · D-038 回归验证】');
console.log('======================================================================\n');

// --------------------------------------------------------------------
// 测试组 1：单源 180 条标准条目解析验证（SSOT Parser Verification）
// --------------------------------------------------------------------
console.log('▶ [测试组 1] 单源条目解析完整性与字段规范测试');

test('单源条目总数必须严格等于 180 条整', () => {
  const { map, list } = loadAllSchoolEntries(true);
  assert.equal(list.length, 180, `期望 180 条，实际解析得到 ${list.length} 条`);
  assert.equal(map.size, 180, `期望 Map 容量 180，实际得到 ${map.size}`);
});

test('六大主流学派条目数量必须均衡，各派恰好 30 条', () => {
  const { list } = loadAllSchoolEntries();
  const counts = {
    geju: 0,
    tiaohou: 0,
    wangshuai: 0,
    mangpai: 0,
    sanming: 0,
    shensha: 0,
  };
  for (const entry of list) {
    assert.ok(entry.schoolKey in counts, `未知的学派 key: ${entry.schoolKey}`);
    counts[entry.schoolKey] += 1;
  }
  assert.equal(counts.geju, 30, '格局派条目必须为 30 条');
  assert.equal(counts.tiaohou, 30, '调候派条目必须为 30 条');
  assert.equal(counts.wangshuai, 30, '旺衰扶抑派条目必须为 30 条');
  assert.equal(counts.mangpai, 30, '盲派与象法条目必须为 30 条');
  assert.equal(counts.sanming, 30, '古法三命条目必须为 30 条');
  assert.equal(counts.shensha, 30, '神煞派条目必须为 30 条');
});

test('全部 180 条条目元数据字段完整且非空', () => {
  const { list } = loadAllSchoolEntries();
  const idPattern = /^S-(GJ|TH|WS|MP|SM|SS)-\d{3}$/;
  for (const item of list) {
    assert.ok(idPattern.test(item.id), `条目编号格式不合法: ${item.id}`);
    assert.ok(item.schoolName && item.schoolName.length > 0, `${item.id} 缺少 schoolName`);
    assert.ok(item.claim && item.claim.length > 0, `${item.id} 缺少 claim 主张正文`);
    assert.ok(item.condition && item.condition.length > 0, `${item.id} 缺少 condition 成立条件`);
    assert.ok(item.source && item.source.length > 0, `${item.id} 缺少 source 出处原句`);
    assert.ok(typeof item.controversy === 'string', `${item.id} 缺少 controversy 字段`);
  }
});

// --------------------------------------------------------------------
// 测试组 2：盘面特征提取器测试（Feature Extraction Verification）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 2] 命盘特征提取器多模式输入与属性提取测试');

test('支持四柱干支数组输入并正确解析十神与地支特征', () => {
  const features = extractChartFeatures(['庚申', '戊寅', '甲申', '壬申']);
  assert.equal(features.dayStem, '甲');
  assert.equal(features.monthBranch, '寅');
  assert.equal(features.dayElement, '木');
  assert.equal(features.hasLu, true, '甲见寅应识别为禄');
  assert.ok(features.chongPairs.length > 0, '寅申相冲应识别到冲');
});

test('神煞列表与干支互涉关系正确关联提取', () => {
  const features = extractChartFeatures(['戊戌', '辛酉', '庚辰', '丙戌']);
  assert.equal(features.dayGz, '庚辰');
  assert.equal(features.dayStem, '庚');
  assert.ok(Array.isArray(features.shenshaList), '神煞列表应为数组');
  assert.ok(features.hasYangRen, '庚见酉为阳刃');
});

// --------------------------------------------------------------------
// 测试组 3：学派典型命盘规则命中与排除测试（Rule Matches & Exclusions）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 3] 六大主流学派典型案例命中与排除断言测试');

test('案例 1（冲战破刃盘：庚申 戊寅 甲申 壬申）命中与排除', () => {
  const res = matchSchoolClaims(['庚申', '戊寅', '甲申', '壬申']);
  const matchedIds = res.matched.map((x) => x.id);

  // 命中断言
  assert.ok(matchedIds.includes('S-TH-004'), '应命中初春甲木调候主张 S-TH-004');
  assert.ok(matchedIds.includes('S-MP-001'), '应命中盲派禄受穿冲主张 S-MP-001');
  assert.ok(matchedIds.includes('S-WS-005'), '应命中旺衰金木相战主张 S-WS-005');
  assert.ok(matchedIds.includes('S-SS-006'), '应命中神煞驿马逢冲主张 S-SS-006');

  // 排除断言（严禁误命中）
  assert.ok(!matchedIds.includes('S-SS-004'), '非魁罡日，严禁误命中魁罡 S-SS-004');
  assert.ok(!matchedIds.includes('S-TH-001'), '非仲冬癸水，严禁误命中冬水调候 S-TH-001');
  assert.ok(!matchedIds.includes('S-WS-002'), '非润下专旺，严禁误命中专旺格 S-WS-002');
});

test('案例 2（魁罡日造：戊戌 辛酉 庚辰 丙戌）命中与排除', () => {
  const res = matchSchoolClaims(['戊戌', '辛酉', '庚辰', '丙戌']);
  const matchedIds = res.matched.map((x) => x.id);

  // 命中断言
  assert.ok(matchedIds.includes('S-SS-004'), '庚辰自坐魁罡，必须命中魁罡 S-SS-004');
  assert.ok(matchedIds.includes('S-SS-002'), '庚见酉刃，必须命中羊刃神煞 S-SS-002');
  assert.ok(matchedIds.includes('S-GJ-001'), '官杀透干有印，必须命中官印双清 S-GJ-001');

  // 排除断言
  assert.ok(!matchedIds.includes('S-TH-004'), '非甲木生寅月，严禁误命中初春甲木 S-TH-004');
  assert.ok(!matchedIds.includes('S-TH-001'), '非冬水，严禁误命中冬水 S-TH-001');
});

test('案例 3（纯阴润下极寒盘：癸亥 癸亥 癸亥 癸亥）命中与排除', () => {
  const res = matchSchoolClaims(['癸亥', '癸亥', '癸亥', '癸亥']);
  const matchedIds = res.matched.map((x) => x.id);

  // 命中断言
  assert.ok(matchedIds.includes('S-TH-001'), '仲冬癸水急需调候，必须命中 S-TH-001');
  assert.ok(matchedIds.includes('S-WS-002'), '满局皆水旺极，必须命中润下专旺 S-WS-002');

  // 排除断言
  assert.ok(!matchedIds.includes('S-SS-004'), '癸亥非魁罡，严禁误命中魁罡 S-SS-004');
  assert.ok(!matchedIds.includes('S-GJ-001'), '局无官星印绶，严禁误命中官印格 S-GJ-001');
});

test('案例 4（金水伤官冬金盘：庚子 戊子 辛亥 壬辰）命中与排除', () => {
  const res = matchSchoolClaims(['庚子', '戊子', '辛亥', '壬辰']);
  const matchedIds = res.matched.map((x) => x.id);

  // 命中断言
  assert.ok(matchedIds.includes('S-TH-008'), '辛金生冬水冷，必须命中金水伤官喜见官 S-TH-008');
  assert.ok(matchedIds.includes('S-TH-027'), '冬金见水金沉，必须命中水冷金沉 S-TH-027');

  // 排除断言
  assert.ok(!matchedIds.includes('S-SS-004'), '辛亥日非魁罡，严禁误命中魁罡 S-SS-004');
});

test('案例 5（盲派相穿倒禄盘：乙丑 己丑 癸丑 戊午）命中与排除', () => {
  const res = matchSchoolClaims(['乙丑', '己丑', '癸丑', '戊午']);
  const matchedIds = res.matched.map((x) => x.id);

  // 命中断言：丑午相穿，盲派穿破
  assert.ok(matchedIds.includes('S-MP-001') || matchedIds.includes('S-MP-002'), '丑午相穿必命中盲派穿害条目');

  // 排除断言
  assert.ok(!matchedIds.includes('S-TH-004'), '非初春甲木，严禁误命中初春甲木 S-TH-004');
});

// --------------------------------------------------------------------
// 测试组 4：格式化输出与健壮性测试（Formatting & Robustness）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 4] CLI 格式化渲染与健壮性测试');

test('formatSchoolMatches 渲染结果结构完整且包含六大流派分节', () => {
  const res = matchSchoolClaims(['庚申', '戊寅', '甲申', '壬申']);
  const text = formatSchoolMatches(res);
  assert.ok(text.includes('八字各派主张并陈'), '渲染结果必须包含主标题');
  assert.ok(text.includes('【格局派】'), '渲染结果必须包含格局派');
  assert.ok(text.includes('【调候派】'), '渲染结果必须包含调候派');
  assert.ok(text.includes('【旺衰扶抑派】'), '渲染结果必须包含旺衰扶抑派');
  assert.ok(text.includes('【盲派与象法】'), '渲染结果必须包含盲派与象法');
  assert.ok(text.includes('【古法三命】'), '渲染结果必须包含古法三命');
  assert.ok(text.includes('【神煞派】'), '渲染结果必须包含神煞派');
  assert.ok(text.includes('命中主张总计：'), '渲染结果必须包含命中总计');
});

test('空特征盘与冷门盘不崩溃且优雅呈现无命中提示', () => {
  const res = matchSchoolClaims(['甲子', '甲子', '甲子', '甲子']);
  const text = formatSchoolMatches(res);
  assert.ok(typeof text === 'string' && text.length > 0, '格式化输出不能为 null');
  assert.ok(res.totalMatched >= 0, '命中计数应为有效非负整数');
});

// --------------------------------------------------------------------
// 汇总报告与退出码裁决
// --------------------------------------------------------------------
console.log('\n----------------------------------------------------------------------');
console.log(`【测试结果看板】通过: ${passedCount} 项，失败: ${failedCount} 项`);
if (failedCount === 0) {
  console.log('✓ 丙层流派匹配器独立测试套件全绿通过！');
  console.log('----------------------------------------------------------------------\n');
  process.exit(0);
} else {
  console.error(`✗ 存在 ${failedCount} 项失败，请检查并修复！`);
  console.log('----------------------------------------------------------------------\n');
  process.exit(1);
}
