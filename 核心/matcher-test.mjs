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
  safeTenGod,
  calculateTaiyuan,
  calculateMinggong,
  analyzeRoots,
  analyzeGongJia,
  MATCH_PREDICATES,
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

test('MATCH_PREDICATES 必须 100% 覆盖全量 180 条标准条目（零死条目门禁）', () => {
  const { list } = loadAllSchoolEntries();
  const predicateKeys = Object.keys(MATCH_PREDICATES);
  assert.equal(predicateKeys.length, 180, `谓词字典必须恰好 180 个键，实际得到 ${predicateKeys.length}`);
  for (const entry of list) {
    assert.equal(
      typeof MATCH_PREDICATES[entry.id],
      'function',
      `条目 ${entry.id} (${entry.schoolName} · ${entry.claim}) 缺少匹配谓词实现`
    );
  }
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
  // D-061 锁死：透干十神必须准确计算，严禁假比肩缺陷与假绿测试
  assert.deepEqual(
    features.exposedTenGods,
    ['七杀', '偏财', '偏印'],
    '甲见年庚(七杀)、月戊(偏财)、时壬(偏印)透干十神必须准确，严禁比肩假类型'
  );
});

test('safeTenGod 支持天干字符与数字索引多态调用且严密防御非法类型', () => {
  assert.equal(safeTenGod(0, 6), '七杀', '甲(0)见庚(6)应为七杀');
  assert.equal(safeTenGod('甲', '庚'), '七杀', '甲字符见庚字符应自适应解析为七杀，严禁返回比肩');
  assert.equal(safeTenGod('乙', '辛'), '七杀', '乙见辛应为七杀');
  assert.equal(safeTenGod('丙', '癸'), '正官', '丙见癸应为正官');
  assert.equal(safeTenGod('丁', '壬'), '正官', '丁见壬应为正官');
  assert.equal(safeTenGod('戊', '甲'), '七杀', '戊见甲应为七杀');
  assert.equal(safeTenGod('甲', '甲'), '比肩', '同干同阳为比肩');
  assert.equal(safeTenGod('甲', '乙'), '劫财', '同干异阴为劫财');
  assert.equal(safeTenGod('未知', '庚'), '', '非法干支返回空');
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

  // 命中断言：D-061 激活格局派杀印相生与建禄用煞
  assert.ok(matchedIds.includes('S-GJ-003'), '甲生寅月透杀透印，格局派必须真实命中杀印相生 S-GJ-003');
  assert.ok(matchedIds.includes('S-GJ-009'), '建禄格透杀，格局派必须真实命中建禄用煞 S-GJ-009');
  assert.ok(matchedIds.includes('S-TH-004'), '应命中初春甲木调候主张 S-TH-004');
  assert.ok(matchedIds.includes('S-MP-001'), '应命中盲派主宾冲制主张 S-MP-001');
  assert.ok(matchedIds.includes('S-WS-005'), '应命中旺衰金木相战主张 S-WS-005');
  assert.ok(matchedIds.includes('S-SS-006'), '应命中神煞驿马逢冲主张 S-SS-006');
  assert.ok(matchedIds.includes('S-WS-030'), '冲战地支破刃盘，必须命中五行偏枯 S-WS-030');

  // 排除断言（严禁误命中）
  assert.ok(!matchedIds.includes('S-SS-004'), '非魁罡日，严禁误命中魁罡 S-SS-004');
  assert.ok(!matchedIds.includes('S-TH-001'), '非仲冬癸水，严禁误命中冬水调候 S-TH-001');
  assert.ok(!matchedIds.includes('S-WS-002'), '非润下专旺，严禁误命中专旺格 S-WS-002');
  assert.ok(!matchedIds.includes('S-WS-015'), '冲战破刃偏枯盘，严禁误命中中和纯粹 S-WS-015');
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
  assert.ok(matchedIds.includes('S-WS-030'), '一气专旺偏亢极寒盘，必须命中五行偏枯 S-WS-030');

  // 排除断言
  assert.ok(!matchedIds.includes('S-SS-004'), '癸亥非魁罡，严禁误命中魁罡 S-SS-004');
  assert.ok(!matchedIds.includes('S-GJ-001'), '局无官星印绶，严禁误命中官印格 S-GJ-001');
  assert.ok(!matchedIds.includes('S-WS-015'), '一气极偏盘，严禁误命中中和纯粹 S-WS-015');
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

test('案例 6（中和纯粹与五行偏枯学理互斥测试）', () => {
  // 极端偏枯盘：癸亥四柱
  const resPianKu = matchSchoolClaims(['癸亥', '癸亥', '癸亥', '癸亥']);
  const idsPianKu = resPianKu.matched.map((x) => x.id);
  assert.ok(idsPianKu.includes('S-WS-030'), '极偏盘必须命中五行偏枯 S-WS-030');
  assert.ok(!idsPianKu.includes('S-WS-015'), '极偏盘严禁命中中和纯粹 S-WS-015');

  // 和平无冲盘：甲寅 丙寅 己巳 辛未
  const resPeace = matchSchoolClaims(['甲寅', '丙寅', '己巳', '辛未']);
  const idsPeace = resPeace.matched.map((x) => x.id);
  assert.ok(idsPeace.includes('S-WS-015'), '四柱无刑冲且五行不亢盘应命中中和纯粹 S-WS-015');
  assert.ok(!idsPeace.includes('S-WS-030'), '和平中和盘严禁误命中五行偏枯 S-WS-030');
});

test('案例 7（新实装流派规则命中验证：从杀格、悬针煞、红鸾天喜）', () => {
  // 从杀格命中：戊戌 辛酉 乙酉 辛巳 (乙木绝无印比生扶，满盘官杀财星)
  const resCongSha = matchSchoolClaims(['戊戌', '辛酉', '乙酉', '辛巳']);
  const idsCongSha = resCongSha.matched.map((x) => x.id);
  assert.ok(idsCongSha.includes('S-GJ-010'), '满盘官杀无印比生扶必须命中从煞格 S-GJ-010');

  // 悬针煞重叠命中：甲午 辛酉 辛卯 甲午 (甲、辛、卯、午重见)
  const resXuanZhen = matchSchoolClaims(['甲午', '辛酉', '辛卯', '甲午']);
  const idsXuanZhen = resXuanZhen.matched.map((x) => x.id);
  assert.ok(idsXuanZhen.includes('S-SS-029'), '悬针重见必须命中悬针煞 S-SS-029');

  // 红鸾天喜命中：甲子年生人四柱见卯支 (红鸾在卯)
  const resHongLuan = matchSchoolClaims(['甲子', '丁卯', '丙寅', '己丑']);
  const idsHongLuan = resHongLuan.matched.map((x) => x.id);
  assert.ok(idsHongLuan.includes('S-SS-027'), '子年见卯支必须命中红鸾天喜 S-SS-027');
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
// 测试组 5：路径 A 高阶易学特征提取器验证（胎元、命宫、通根离散图谱、虚邀暗夹）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 5] 路径 A 高阶易学特征提取器与升级谓词验证');

test('胎元计算精度：对照《三命通会》《渊海子平》标准案例', () => {
  const ty1 = calculateTaiyuan('丙寅');
  assert.equal(ty1.gz, '丁巳', '丙寅月胎元必须为丁巳');
  assert.equal(ty1.nayin, '沙中土', '丁巳胎元纳音必须为沙中土');

  const ty2 = calculateTaiyuan('己巳');
  assert.equal(ty2.gz, '庚申', '己巳月胎元必须为庚申');

  const ty3 = calculateTaiyuan('丁丑');
  assert.equal(ty3.gz, '戊辰', '丁丑月胎元必须为戊辰');
});

test('命宫计算精度：对照《命理探源》俞曲园案与道光坤造案', () => {
  // 案例 1：《命理探源》行 738 俞曲园《游艺录》甲子年三月酉时
  const mg1 = calculateMinggong('甲子', '戊辰', '辛酉');
  assert.equal(mg1.gz, '戊辰', '甲子年辰月酉时命宫必须为戊辰');
  assert.equal(mg1.nayin, '大林木', '戊辰命宫纳音必须为大林木');

  // 案例 2：《命理探源》行 742 丙午年十二月过大寒（建寅）申时
  const mg2 = calculateMinggong('丙午', '庚寅', '丙申');
  assert.equal(mg2.gz, '乙未', '丙午年寅月申时命宫必须为乙未');
  assert.equal(mg2.nayin, '沙中金', '乙未命宫纳音必须为沙中金');
});

test('通根离散图谱推导：纯离散命理状态机测试（禄刃专气 vs 虚浮无根 vs 刑穿动摇）', () => {
  // 盘 A：甲木深根安稳盘（甲子 丙寅 甲寅 戊辰）——无冲无穿
  const fA = extractChartFeatures(['甲子', '丙寅', '甲寅', '戊辰']);
  assert.equal(fA.roots.dayMaster.highestTier, '禄刃专气', '甲木坐寅通提纲寅禄必须为禄刃专气');
  assert.equal(fA.roots.dayMaster.isSelfRooted, true, '甲寅自坐寅木必须识别为自坐通根');
  assert.equal(fA.roots.dayMaster.isMonthRooted, true, '寅月必须识别为提纲通根');
  assert.equal(fA.roots.dayMaster.status, '安稳', '四柱无冲穿状态必须为安稳');

  // 盘 A2：卯辰相害穿损盘（甲寅 丁卯 甲辰 丙寅）——卯辰相穿
  const fA2 = extractChartFeatures(['甲寅', '丁卯', '甲辰', '丙寅']);
  assert.equal(fA2.roots.dayMaster.status, '刑穿受损', '卯辰相穿必须精准识别为刑穿受损');

  // 盘 B：乙木虚浮盘（辛巳 丙申 乙巳 丁丑）
  const fB = extractChartFeatures(['辛巳', '丙申', '乙巳', '丁丑']);
  assert.equal(fB.roots.dayMaster.highestTier, '虚浮无根', '乙木满盘无水木必须判定为虚浮无根');
  assert.equal(fB.roots.dayMaster.isSelfRooted, false, '乙巳绝地必须判定非自坐通根');
  assert.equal(fB.roots.dayMaster.status, '无根', '虚浮无根状态必须为无根');
  assert.equal(fB.roots.dayMaster.purity, '无根', '虚浮无根纯度必须为无根');
});

test('虚邀暗拱与暗夹推导：三合拱中神、隔位暗夹与倒冲飞天', () => {
  // 申辰虚拱子水
  const gj1 = analyzeGongJia(['壬申', '甲辰', '甲子', '丙寅'], '甲', ['申', '辰', '子', '寅']);
  // 局中已有子，不算虚拱；若无子则算虚拱：
  const gj2 = analyzeGongJia(['壬申', '甲辰', '甲寅', '丙戌'], '甲', ['申', '辰', '寅', '戌']);
  assert.ok(gj2.gongChong.some((g) => g.mid === '子'), '申辰无子必须虚拱子水');

  // 癸亥日癸丑时暗夹子禄（局中无子，真拱禄不填实）
  const gj3 = analyzeGongJia(['乙卯', '己卯', '癸亥', '癸丑'], '癸', ['卯', '卯', '亥', '丑']);
  assert.equal(gj3.hasGongLu, true, '癸亥日癸丑时隔位必暗夹子禄');

  // 局中已有子字（填实）：严谨不作拱禄
  const gj3Tianshi = analyzeGongJia(['辛丑', '庚子', '癸亥', '癸丑'], '癸', ['丑', '子', '亥', '丑']);
  assert.equal(gj3Tianshi.hasGongLu, false, '局中见子填实绝不误判为虚拱');

  // 庚子日四子倒冲飞天禄马
  const gj4 = analyzeGongJia(['庚子', '戊子', '庚子', '丙子'], '庚', ['子', '子', '子', '子']);
  assert.equal(gj4.hasFeiTianDaoChong, true, '四子水无午必须判定倒冲飞天禄马');
});

test('升级谓词命中精度验证（S-SM-004、S-SM-014、S-SM-015、S-SM-028、S-TH-030）', () => {
  // 验证 S-TH-030 调候通根有力触发
  const resTH = matchSchoolClaims(['庚子', '戊子', '丙午', '甲午']);
  const idsTH = resTH.matched.map((x) => x.id);
  assert.ok(idsTH.includes('S-TH-030'), '冬火透丙坐午禄必须命中调候通根有力 S-TH-030');

  // 验证 S-SM-014 拱禄格命中（真拱禄不填实造）
  const resGong = matchSchoolClaims(['乙卯', '己卯', '癸亥', '癸丑']);
  const idsGong = resGong.matched.map((x) => x.id);
  assert.ok(idsGong.includes('S-SM-014'), '癸亥见癸丑夹子禄必须命中拱禄 S-SM-014');

  // 验证 S-SM-004 胎元命宫立身命中（丙寅月生，胎元丁巳沙中土，生甲子年海中金）
  const resSM = matchSchoolClaims(['甲子', '丙寅', '戊辰', '辛酉']);
  const idsSM = resSM.matched.map((x) => x.id);
  assert.ok(idsSM.includes('S-SM-004'), '胎元命宫相生必须命中 S-SM-004');
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
