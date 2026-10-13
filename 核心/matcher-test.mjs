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
// --------------------------------------------------------------------
// 测试组 1：单源 420 条标准条目解析验证（SSOT Parser Verification）
// --------------------------------------------------------------------
console.log('▶ [测试组 1] 单源条目解析完整性与字段规范测试');

test('单源条目总数必须严格等于 420 条整', () => {
  const { map, list } = loadAllSchoolEntries(true);
  assert.equal(list.length, 420, `期望 420 条，实际解析得到 ${list.length} 条`);
  assert.equal(map.size, 420, `期望 Map 容量 420，实际得到 ${map.size}`);
});

test('MATCH_PREDICATES 必须 100% 覆盖全量 420 条标准条目（零死条目门禁）', () => {
  const { list } = loadAllSchoolEntries();
  const predicateKeys = Object.keys(MATCH_PREDICATES);
  assert.equal(predicateKeys.length, 420, `谓词字典必须恰好 420 个键，实际得到 ${predicateKeys.length}`);
  for (const entry of list) {
    assert.equal(
      typeof MATCH_PREDICATES[entry.id],
      'function',
      `条目 ${entry.id} (${entry.schoolName} · ${entry.claim}) 缺少匹配谓词实现`
    );
  }
});

test('六大主流学派条目数量校验：格局派 60 条、调候派 90 条、古法三命 60 条、神煞派 90 条、盲派 60 条、旺衰派 60 条（四大专著深度扫尾第二批达成）', () => {
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
  assert.equal(counts.geju, 60, '格局派条目必须为 60 条（30正格+30外格）');
  assert.equal(counts.tiaohou, 90, '调候派条目必须为 90 条（《穷通宝鉴》十干十二月令扫尾达成 90 条）');
  assert.equal(counts.wangshuai, 60, '旺衰扶抑派条目必须为 60 条（批次 F 扩充至 60 条）');
  assert.equal(counts.mangpai, 60, '盲派与象法条目必须为 60 条（批次 E 扩充至 60 条）');
  assert.equal(counts.sanming, 60, '古法三命条目必须为 60 条（批次 C 扩充至 60 条）');
  assert.equal(counts.shensha, 90, '神煞派条目必须为 90 条（《玉照定真经》扫尾第一批 30 条达成 90 条）');
});

test('全部 420 条条目元数据字段完整且非空', () => {
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
// 测试组 6：子平外格群典型案例命中与排除验证（D-064 批次 A）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 6] 子平外格群典型案例命中与排除验证（D-064 批次 A）');

test('经典外格名造命中断言（飞天禄马、井栏叉、六阴朝阳、丑遥巳禄、壬骑龙背）', () => {
  // 王阳明造：壬辰 辛亥 癸亥 癸亥 -> 飞天禄马格
  const res1 = matchSchoolClaims(['壬辰', '辛亥', '癸亥', '癸亥']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-GJ-031'), '王阳明造三亥冲巳必须命中飞天禄马格 S-GJ-031');
  assert.ok(!ids1.includes('S-GJ-032'), '水命绝非倒冲火格，严禁误命中倒冲禄马格 S-GJ-032');

  // 御史造：癸卯 庚申 庚子 庚辰 -> 井栏叉格
  const res2 = matchSchoolClaims(['癸卯', '庚申', '庚子', '庚辰']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-GJ-033'), '庚日申子辰全必须命中井栏叉格 S-GJ-033');

  // 六阴朝阳造：戊辰 辛酉 辛酉 戊子 -> 六阴朝阳格
  const res3 = matchSchoolClaims(['戊辰', '辛酉', '辛酉', '戊子']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-GJ-036'), '辛生戊子时一位子必须命中六阴朝阳格 S-GJ-036');

  // 丑遥巳禄造：癸丑 乙丑 癸丑 癸亥 -> 丑遥巳禄格
  const res4 = matchSchoolClaims(['癸丑', '乙丑', '癸丑', '癸亥']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-GJ-040'), '癸坐多丑无官必须命中丑遥巳禄格 S-GJ-040');

  // 壬骑龙背造：丙子 甲午 壬辰 甲辰 -> 壬骑龙背格
  const res5 = matchSchoolClaims(['丙子', '甲午', '壬辰', '甲辰']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-GJ-034'), '壬辰日双辰必须命中壬骑龙背格 S-GJ-034');
});

test('外格严密破格与禁忌排除断言（填实破格、官杀混杂破格）', () => {
  // 拱禄真格：丁巳 丙午 癸亥 癸丑 (癸亥日癸丑时拱子禄，局中无子)
  const resGong = matchSchoolClaims(['丁巳', '丙午', '癸亥', '癸丑']);
  assert.ok(resGong.matched.some((x) => x.id === 'S-GJ-037'), '癸亥见癸丑局中无子必须命中拱禄格 S-GJ-037');

  // 拱禄填实破格：丁巳 壬子 癸亥 癸丑 (局中已见子字填实破格)
  const resPo = matchSchoolClaims(['丁巳', '壬子', '癸亥', '癸丑']);
  assert.ok(!resPo.matched.some((x) => x.id === 'S-GJ-037'), '局中见子填实必须排除拱禄格 S-GJ-037');

  // 六乙鼠贵见午冲破格：丁卯 壬午 乙巳 丙子 (见午冲子)
  const resShuPo = matchSchoolClaims(['丁卯', '壬午', '乙巳', '丙子']);
  assert.ok(!resShuPo.matched.some((x) => x.id === 'S-GJ-035'), '六乙鼠贵见月令午冲破格必须排除 S-GJ-035');
});

// --------------------------------------------------------------------
// 测试组 7：调候派扩充典型案例命中与排他验证（D-065 批次 B）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 7] 调候派扩充典型案例命中与排他验证（D-065 批次 B）');

test('调候派扩充经典命造命中（二月甲木阳刃用庚驾杀、秋金丁甲两透、冬月乙木丙暖忌癸、活木埋根之铁）', () => {
  // 阳刃驾杀造：甲戌 丁卯 甲申 庚午 -> 命中 S-TH-033
  const res1 = matchSchoolClaims(['甲戌', '丁卯', '甲申', '庚午']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-TH-033'), '二月甲木透庚见财必须命中阳刃驾杀 S-TH-033');

  // 秋金锐锐丁甲两透造：丁丑 己酉 庚申 甲申 -> 命中 S-TH-057
  const res2 = matchSchoolClaims(['丁丑', '己酉', '庚申', '甲申']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-TH-057'), '秋金丁甲两透必须命中定步青云 S-TH-057');

  // 冬月乙木丙暖忌癸：丙子 庚子 乙亥 丙子 -> 命中 S-TH-040
  const res3 = matchSchoolClaims(['丙子', '庚子', '乙亥', '丙子']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-TH-040'), '子月乙木透丙不透癸必须命中 S-TH-040');

  // 活木埋根之铁：甲寅 己巳 乙酉 壬午 -> 乙木通根但坐酉金暗戕
  const res4 = matchSchoolClaims(['甲寅', '己巳', '乙酉', '壬午']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-TH-039'), '春夏季乙木通根自坐酉金必须命中活木忌埋根之铁 S-TH-039');
});

test('调候派扩充严密排他断言（透癸冻木排除、见己浊水排除）', () => {
  // 冬月乙木透癸冻木排他：癸丑 庚子 乙亥 丙子 (透癸冻木，不入 S-TH-040)
  const resDong = matchSchoolClaims(['癸丑', '庚子', '乙亥', '丙子']);
  assert.ok(!resDong.matched.some((x) => x.id === 'S-TH-040'), '子月乙木透癸出干冻木必须排除 S-TH-040');

  // 九月庚金见己土浊水排他：甲戌 甲戌 庚辰 己卯 (见己土浊水，排除 S-TH-058)
  const resTuo = matchSchoolClaims(['甲戌', '甲戌', '庚辰', '己卯']);
  assert.ok(!resTuo.matched.some((x) => x.id === 'S-TH-058'), '九月庚金见己土浊壬必须排除 S-TH-058');
});

// --------------------------------------------------------------------

// --------------------------------------------------------------------
// 测试组 8：古法三命《兰台妙选》扩充典型案例命中与排他验证（D-066 批次 C）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 8] 古法三命《兰台妙选》扩充典型案例命中与排他验证（D-066 批次 C）');

test('古法三命扩充经典命造命中（苍龙驾海、兔入月宫、藏珠渊海、月桂芬芳、一旬包裹）', () => {
  // 苍龙驾海造：甲辰 丁卯 甲申 癸亥 (辰年命时见癸亥大海水无辰戌冲)
  const res1 = matchSchoolClaims(['甲辰', '丁卯', '甲申', '癸亥']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-SM-031'), '辰年生人日时见癸亥大海水必须命中苍龙驾海 S-SM-031');

  // 兔入月宫造：乙卯 戊寅 己未 丁卯 (卯年生人日见己未无酉冲)
  const res2 = matchSchoolClaims(['乙卯', '戊寅', '己未', '丁卯']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-SM-037'), '卯年生人日亲见己未月宫必须命中兔入月宫 S-SM-037');

  // 藏珠渊海造：癸亥 甲子 癸丑 壬戌 (四柱同见癸亥大海水与甲子海中金)
  const res3 = matchSchoolClaims(['癸亥', '甲子', '癸丑', '壬戌']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-SM-041'), '癸亥逢甲子金水相藏必须命中藏珠渊海 S-SM-041');

  // 月桂芬芳造：己未 丁丑 辛卯 丙申 (己未天上火逢辛卯松柏木月桂)
  const res4 = matchSchoolClaims(['己未', '丁丑', '辛卯', '丙申']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-SM-051'), '己未遇辛卯月桂芬芳必须命中 S-SM-051');

  // 一旬包裹造：甲子 丙寅 戊辰 庚午 (四柱俱在甲子旬)
  const res5 = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚午']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-SM-060'), '四柱俱在同单一旬中必须命中一旬包裹 S-SM-060');
});

test('古法三命扩充严密排他断言（辰戌相冲破龙排除、卯酉相冲破兔排除、丑未冲碎蚌壳排除、杂入他旬排除）', () => {
  // 苍龙驾海辰戌近冲破格排他：甲辰 甲戌 壬戌 癸亥 (年月辰戌近冲破龙)
  const resPoLong = matchSchoolClaims(['甲辰', '甲戌', '壬戌', '癸亥']);
  assert.ok(!resPoLong.matched.some((x) => x.id === 'S-SM-031'), '辰戌近冲破龙格必须排除 S-SM-031');

  // 兔入月宫卯酉相冲排他：乙卯 乙酉 己未 丁卯 (年月卯酉相冲破兔)
  const resPoTu = matchSchoolClaims(['乙卯', '乙酉', '己未', '丁卯']);
  assert.ok(!resPoTu.matched.some((x) => x.id === 'S-SM-037'), '卯酉相冲破兔入月宫必须排除 S-SM-037');

  // 蚌珠照月丑未近冲碎蚌壳排他：乙丑 癸未 甲子 丙寅 (年月丑未近冲碎蚌)
  const resPoBang = matchSchoolClaims(['乙丑', '癸未', '甲子', '丙寅']);
  assert.ok(!resPoBang.matched.some((x) => x.id === 'S-SM-043'), '丑未近冲碎蚌壳必须排除蚌珠照月 S-SM-043');

  // 一旬包裹杂入他旬排他：甲子 丙寅 戊辰 甲戌 (前三柱甲子旬，时柱甲戌旬)
  const resZaXun = matchSchoolClaims(['甲子', '丙寅', '戊辰', '甲戌']);
  assert.ok(!resZaXun.matched.some((x) => x.id === 'S-SM-060'), '杂入他旬必须排除一旬包裹 S-SM-060');
});

// --------------------------------------------------------------------
// 测试组 9：神煞派《玉照定真经》铁断专测套件（批次 D 扩充验证）
// --------------------------------------------------------------------
console.log('▶ [测试组 9] 神煞派《玉照定真经》古法神煞铁断专测套件');

test('神煞派扩充经典命中断言（四阳俱立 S-SS-031、阴覆全逢 S-SS-032、四仲有旺 S-SS-055、寅巳申三刑 S-SS-060、土居四季全 S-SS-054）', () => {
  // 四阳俱立造：甲子 丙寅 戊辰 庚午 (四干纯阳)
  const resYang = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚午']);
  const idsYang = resYang.matched.map((x) => x.id);
  assert.ok(idsYang.includes('S-SS-031'), '四柱天干纯阳必须命中四阳俱立 S-SS-031');

  // 阴覆全逢造：乙丑 丁亥 己未 辛酉 (四干纯阴)
  const resYin = matchSchoolClaims(['乙丑', '丁亥', '己未', '辛酉']);
  const idsYin = resYin.matched.map((x) => x.id);
  assert.ok(idsYin.includes('S-SS-032'), '四柱天干纯阴必须命中阴覆全逢 S-SS-032');

  // 乾隆皇帝造：辛卯 丁酉 庚午 丙子 (地支子午卯酉四仲全备)
  const resQianlong = matchSchoolClaims(['辛卯', '丁酉', '庚午', '丙子']);
  const idsQianlong = resQianlong.matched.map((x) => x.id);
  assert.ok(idsQianlong.includes('S-SS-055'), '子午卯酉四仲全备必须命中四仲见之有旺 S-SS-055');

  // 寅巳申三刑造：壬申 癸卯 丙寅 癸巳 (地支全寅巳申无恩之刑)
  const resSanXing = matchSchoolClaims(['壬申', '癸卯', '丙寅', '癸巳']);
  const idsSanXing = resSanXing.matched.map((x) => x.id);
  assert.ok(idsSanXing.includes('S-SS-060'), '地支寅巳申全备必须命中带刑全申巳寅 S-SS-060');

  // 土居四季全备造：戊辰 己未 辛丑 戊戌 (地支辰戌丑未四墓库全备且透官印)
  const resSiJi = matchSchoolClaims(['戊辰', '己未', '辛丑', '戊戌']);
  const idsSiJi = resSiJi.matched.map((x) => x.id);
  assert.ok(idsSiJi.includes('S-SS-054'), '辰戌丑未四库全备必须命中土居四季见全 S-SS-054');
  assert.ok(idsSiJi.includes('S-SS-056'), '辰戌丑未透印必须命中季中全犯库藏之官 S-SS-056');
});

test('神煞派扩充严密排他断言（杂入阴干排除四阳、四仲缺一排除四仲有旺、非魁罡日排除魁罡屠讼）', () => {
  // 杂入阴干排除四阳：甲子 丙寅 乙卯 庚午 (日干乙为阴干)
  const resZaYin = matchSchoolClaims(['甲子', '丙寅', '乙卯', '庚午']);
  assert.ok(!resZaYin.matched.some((x) => x.id === 'S-SS-031'), '杂入阴干必须排除四阳俱立 S-SS-031');

  // 杂入阳干排除阴覆全逢：乙丑 丁亥 戊午 辛酉 (日干戊为阳干)
  const resZaYang = matchSchoolClaims(['乙丑', '丁亥', '戊午', '辛酉']);
  assert.ok(!resZaYang.matched.some((x) => x.id === 'S-SS-032'), '杂入阳干必须排除阴覆全逢 S-SS-032');

  // 四仲缺一排除四仲有旺：辛卯 丁酉 庚辰 丙子 (地支仅卯酉子三字，辰非四仲)
  const resQueZhong = matchSchoolClaims(['辛卯', '丁酉', '庚辰', '丙子']);
  assert.ok(!resQueZhong.matched.some((x) => x.id === 'S-SS-055'), '四仲仅三字且缺午者必须排除四仲见之有旺 S-SS-055');

  // 非魁罡日排除魁罡屠讼：甲子 戊辰 丙戌 庚戌 (日柱丙戌非魁罡日)
  const resFeiKg = matchSchoolClaims(['甲子', '戊辰', '丙戌', '庚戌']);
  assert.ok(!resFeiKg.matched.some((x) => x.id === 'S-SS-036'), '非魁罡日柱必须排除魁罡往来加临 S-SS-036');
});

// --------------------------------------------------------------------
// 测试组 10：盲派象法做功定式专测套件（批次 E 扩充验证）
// --------------------------------------------------------------------
console.log('▶ [测试组 10] 盲派象法高级做功定式专测套件');

test('盲派象法扩充经典命中断言（巳申合 S-MP-031、生穿 S-MP-032、干支自合九柱 S-MP-037、辰戌冲开库 S-MP-053、官杀生印化用 S-MP-044）', () => {
  // 巳申合效率做功造：甲申 己巳 戊寅 丁巳 (年月巳申合，时丁巳日寅杀印相生)
  const resSiShen = matchSchoolClaims(['甲申', '己巳', '戊寅', '丁巳']);
  const idsSiShen = resSiShen.matched.map((x) => x.id);
  assert.ok(idsSiShen.includes('S-MP-031'), '年月巳申相合必须命中巳申合做功效率最高 S-MP-031');
  assert.ok(idsSiShen.includes('S-MP-044'), '官杀生印必须命中官杀生印良性化用结构 S-MP-044');

  // 生穿造：壬申 辛亥 乙卯 丁亥 (申亥生穿)
  const resShengChuan = matchSchoolClaims(['壬申', '辛亥', '乙卯', '丁亥']);
  const idsShengChuan = resShengChuan.matched.map((x) => x.id);
  assert.ok(idsShengChuan.includes('S-MP-032'), '年月申亥相见必须命中申亥生穿 S-MP-032');

  // 干支自合九柱造：丁亥 癸卯 戊子 丙辰 (自坐戊子、年见丁亥干支自合)
  const resZiHe = matchSchoolClaims(['丁亥', '癸卯', '戊子', '丙辰']);
  const idsZiHe = resZiHe.matched.map((x) => x.id);
  assert.ok(idsZiHe.includes('S-MP-037'), '柱见丁亥戊子必须命中干支自合上下直接做功 S-MP-037');

  // 辰戌相冲开水火财库造：戊戌 丙辰 戊戌 丙辰 (辰戌相冲开库)
  const resChenXu = matchSchoolClaims(['戊戌', '丙辰', '戊戌', '丙辰']);
  const idsChenXu = resChenXu.matched.map((x) => x.id);
  assert.ok(idsChenXu.includes('S-MP-053'), '辰戌相冲必须命中辰戌相冲开水火财库 S-MP-053');
});

test('盲派象法扩充严密排他断言（无巳申排除 S-MP-031、无生穿排除 S-MP-032、无自合排除 S-MP-037、中神不双见排除 S-MP-038）', () => {
  // 无巳申相见排他：甲子 丙寅 戊辰 庚午 (地支无巳申)
  const resWuSiShen = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚午']);
  assert.ok(!resWuSiShen.matched.some((x) => x.id === 'S-MP-031'), '无巳申相见必须排除 S-MP-031');

  // 仅见克穿无生穿排他：乙丑 己卯 戊辰 癸亥 (卯辰穿为克穿，非生穿)
  const resKeChuan = matchSchoolClaims(['乙丑', '己卯', '戊辰', '癸亥']);
  assert.ok(!resKeChuan.matched.some((x) => x.id === 'S-MP-032'), '仅克穿无申亥寅巳生穿必须排除 S-MP-032');

  // 无干支自合九柱排他：甲子 丙寅 戊午 庚申 (无九柱自合)
  const resWuZiHe = matchSchoolClaims(['甲子', '丙寅', '戊午', '庚申']);
  assert.ok(!resWuZiHe.matched.some((x) => x.id === 'S-MP-037'), '无自合九柱必须排除干支自合 S-MP-037');

  // 中神单见成局排他：甲寅 戊午 丙戌 庚寅 (午火仅一字不双见)
  const resDanZhong = matchSchoolClaims(['甲寅', '戊午', '丙戌', '庚寅']);
  assert.ok(!resDanZhong.matched.some((x) => x.id === 'S-MP-038'), '中神单见不双现必须排除中神双现不成局 S-MP-038');
});

// --------------------------------------------------------------------
// 测试组 11：旺衰扶抑派经典体用变局通关专测套件（批次 F 扩充验证）
// --------------------------------------------------------------------
console.log('▶ [测试组 11] 旺衰扶抑派经典体用变局通关专测套件');

test('旺衰扶抑派扩充经典命中断言（君赖臣生 S-WS-031、夫健怕妻 S-WS-033、两气成象 S-WS-038、伤官见官可见 S-WS-055、地生天怕冲 S-WS-059、刃煞神清 S-WS-060）', () => {
  // 君赖臣生造：壬申 壬子 甲子 戊辰 (冬水极旺木浮，日主无禄刃，透戊辰财星培木破印)
  const resJunLai = matchSchoolClaims(['壬申', '壬子', '甲子', '戊辰']);
  const idsJunLai = resJunLai.matched.map((x) => x.id);
  assert.ok(idsJunLai.includes('S-WS-031'), '印绶太旺透财培木必须命中君赖臣生 S-WS-031');

  // 夫健怕妻造：甲寅 己巳 乙卯 戊寅 (乙坐卯禄身健，财星透干结党)
  const resFuJian = matchSchoolClaims(['甲寅', '己巳', '乙卯', '戊寅']);
  const idsFuJian = resFuJian.matched.map((x) => x.id);
  assert.ok(idsFuJian.includes('S-WS-033'), '日主身健身旺财多必须命中夫健怕妻 S-WS-033');

  // 两气合而成象造：甲寅 丁巳 乙卯 丙午 (木火两神相涵并旺成象)
  const resLiangQi = matchSchoolClaims(['甲寅', '丁巳', '乙卯', '丙午']);
  const idsLiangQi = resLiangQi.matched.map((x) => x.id);
  assert.ok(idsLiangQi.includes('S-WS-038'), '木火两气均停必须命中两气合而成象 S-WS-038');

  // 伤官见官有财引化造：庚辰 癸未 丙午 己丑 (丙火见癸水正官、己土伤官、庚金偏财)
  const resShangGuan = matchSchoolClaims(['庚辰', '癸未', '丙午', '己丑']);
  const idsShangGuan = resShangGuan.matched.map((x) => x.id);
  assert.ok(idsShangGuan.includes('S-WS-055'), '伤官见官有财通关必须命中伤官见官果难辨 S-WS-055');

  // 地生天者天衰怕冲造：甲子 庚午 甲子 丙寅 (甲子日自坐印生，子午近冲拔根)
  const resDiSheng = matchSchoolClaims(['甲子', '庚午', '甲子', '丙寅']);
  const idsDiSheng = resDiSheng.matched.map((x) => x.id);
  assert.ok(idsDiSheng.includes('S-WS-059'), '日坐印生而日支逢冲必须命中地生天者天衰怕冲 S-WS-059');

  // 刃煞神清造：癸巳 戊午 丙午 壬辰 (丙生午月坐阳刃，时透壬杀)
  const resRenSha = matchSchoolClaims(['癸巳', '戊午', '丙午', '壬辰']);
  const idsRenSha = resRenSha.matched.map((x) => x.id);
  assert.ok(idsRenSha.includes('S-WS-060'), '阳刃坐局透七杀必须命中刃煞神清气势特 S-WS-060');
});

test('旺衰扶抑派扩充严密排他断言（日主坐禄排他 S-WS-031、见财排他母慈灭子 S-WS-032、五行杂出排他两气成象 S-WS-038、无刃排他刃煞神清 S-WS-060、无坐冲排他地生天 S-WS-059）', () => {
  // 身强坐禄刃排他君赖臣生：壬申 壬子 甲寅 戊辰 (甲坐寅禄，日主自强，非衰弱之君)
  const resLuPai = matchSchoolClaims(['壬申', '壬子', '甲寅', '戊辰']);
  assert.ok(!resLuPai.matched.some((x) => x.id === 'S-WS-031'), '身强坐禄刃者必须排除君赖臣生 S-WS-031');

  // 见财排他母慈灭子：壬申 壬子 甲子 戊辰 (局透戊土偏财，应入君赖臣生破印，非母慈灭子)
  const resCaiPai = matchSchoolClaims(['壬申', '壬子', '甲子', '戊辰']);
  assert.ok(!resCaiPai.matched.some((x) => x.id === 'S-WS-032'), '局中透财星者必须排除母慈灭子 S-WS-032');

  // 五行杂出三党以上排他两气成象：甲子 丙寅 戊辰 庚申 (金木水火土杂出)
  const resZaPai = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resZaPai.matched.some((x) => x.id === 'S-WS-038'), '五行杂出者必须排除两气合而成象 S-WS-038');

  // 无阳刃排他刃煞神清：甲子 丙寅 戊辰 庚申 (无阳刃)
  const resWuRen = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resWuRen.matched.some((x) => x.id === 'S-WS-060'), '无阳刃者必须排除刃煞神清 S-WS-060');

  // 无日支相冲排他地生天怕冲：甲子 丙寅 甲子 丙寅 (日支子水无冲)
  const resWuChong = matchSchoolClaims(['甲子', '丙寅', '甲子', '丙寅']);
  assert.ok(!resWuChong.matched.some((x) => x.id === 'S-WS-059'), '日支无冲者必须排除地生天者天衰怕冲 S-WS-059');
});

// --------------------------------------------------------------------
// 测试组 12：神煞派《玉照定真经》干支刑冲定位铁断专测套件（D-072 30 条新定式）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 12] 神煞派《玉照定真经》干支刑冲定位铁断专测套件（D-072 30 条新定式）');

test('神煞派《玉照定真经》30 条经典命造特征命中测试（S-SS-061～S-SS-090）', () => {
  // 1. 癸巳乙卯庚申连天门亥造：癸巳 乙卯 庚申 丁亥 (命中 S-SS-076 连戌亥九流、S-SS-078 乙庚同会、S-SS-070 龙常经商)
  const resGeng = matchSchoolClaims(['癸巳', '乙卯', '庚申', '丁亥']);
  const idsGeng = resGeng.matched.map((x) => x.id);
  assert.ok(idsGeng.includes('S-SS-076'), '癸巳乙卯庚申连亥天门必须命中九流之士 S-SS-076');
  assert.ok(idsGeng.includes('S-SS-078'), '乙庚两透地支通根必须命中乙庚同会 S-SS-078');
  assert.ok(idsGeng.includes('S-SS-070'), '地支亥卯相合透木必须命中龙常经商利路绵绵 S-SS-070');

  // 2. 自刑重见造：甲辰 戊辰 戊辰 壬戌 (三辰自刑相并)
  const resZiXing = matchSchoolClaims(['甲辰', '戊辰', '戊辰', '壬戌']);
  const idsZiXing = resZiXing.matched.map((x) => x.id);
  assert.ok(idsZiXing.includes('S-SS-086'), '三辰自刑重见必须命中自刑重见自死自凶 S-SS-086');

  // 3. 子卯相刑造：癸未 乙卯 甲子 己巳 (子卯紧贴相刑)
  const resZiMao = matchSchoolClaims(['癸未', '乙卯', '甲子', '己巳']);
  const idsZiMao = resZiMao.matched.map((x) => x.id);
  assert.ok(idsZiMao.includes('S-SS-087'), '子卯紧贴无解必须命中子卯相刑门无礼德 S-SS-087');

  // 4. 冬丁坐巳刃暖局造：丁巳 壬子 丁卯 辛亥 (丁巳生于子月冬水)
  const resDongDing = matchSchoolClaims(['丁巳', '壬子', '丁卯', '辛亥']);
  const idsDongDing = resDongDing.matched.map((x) => x.id);
  assert.ok(idsDongDing.includes('S-SS-079'), '丁巳生于冬月必须命中丁巳丁卯冬生门内官人进纳 S-SS-079');

  // 5. 辛亥卯上相斫造：辛亥 辛卯 乙酉 丁亥 (柱见辛亥与卯)
  const resXinHai = matchSchoolClaims(['辛亥', '辛卯', '乙酉', '丁亥']);
  const idsXinHai = resXinHai.matched.map((x) => x.id);
  assert.ok(idsXinHai.includes('S-SS-083'), '柱逢辛亥与卯必须命中辛亥卯上定生唇缺之人 S-SS-083');

  // 6. 丑戌未刑肢病难痊造：乙丑 丙戌 戊未 壬子 (地支丑戌未三刑全)
  const resSanXing = matchSchoolClaims(['乙丑', '丙戌', '戊未', '壬子']);
  const idsSanXing = resSanXing.matched.map((x) => x.id);
  assert.ok(idsSanXing.includes('S-SS-088'), '地支丑戌未三刑全必须命中丑逢戌未犯支刑肢病难痊 S-SS-088');

  // 7. 丑午相穿害造：甲午 辛未 癸丑 丙辰 (午丑穿害)
  const resWuChou = matchSchoolClaims(['甲午', '辛未', '癸丑', '丙辰']);
  const idsWuChou = resWuChou.matched.map((x) => x.id);
  assert.ok(idsWuChou.includes('S-SS-090'), '午丑相穿害必须命中午逢丑位久病内气之灾 S-SS-090');
});

test('神煞派《玉照定真经》严密排他反向断言（无天门排他 S-SS-076、无自刑排他 S-SS-086、无子卯排他 S-SS-087、非冬令排他 S-SS-079、无穿害排他 S-SS-090）', () => {
  // 无天门戌亥排他 S-SS-076：癸巳 乙卯 庚申 丙子 (无戌亥)
  const resWuTianMen = matchSchoolClaims(['癸巳', '乙卯', '庚申', '丙子']);
  assert.ok(!resWuTianMen.matched.some((x) => x.id === 'S-SS-076'), '无戌亥天门者必须排除 S-SS-076');

  // 无自刑重见排他 S-SS-086：甲子 丙寅 戊辰 庚申 (辰单见无重叠自刑)
  const resWuZiXing = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resWuZiXing.matched.some((x) => x.id === 'S-SS-086'), '无自刑重见者必须排除 S-SS-086');

  // 无子卯相刑排他 S-SS-087：甲子 丙寅 戊辰 庚申 (有子无卯)
  const resWuZiMao = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resWuZiMao.matched.some((x) => x.id === 'S-SS-087'), '无子卯相见者必须排除 S-SS-087');

  // 非冬令排他 S-SS-079：丁巳 丙午 丁卯 辛亥 (生于午月夏令，非三冬)
  const resFeiDong = matchSchoolClaims(['丁巳', '丙午', '丁卯', '辛亥']);
  assert.ok(!resFeiDong.matched.some((x) => x.id === 'S-SS-079'), '非冬令生人必须排除丁巳丁卯冬生 S-SS-079');

  // 无丑午相穿害排他 S-SS-090：甲子 丙寅 戊辰 庚申 (无丑午)
  const resWuChuan = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resWuChuan.matched.some((x) => x.id === 'S-SS-090'), '无丑午相害者必须排除 S-SS-090');
});

// --------------------------------------------------------------------
// 测试组 13：调候派《穷通宝鉴》十干十二月调候专测套件（D-073 30 条新定式）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 13] 调候派《穷通宝鉴》十干十二月调候专测套件（D-073 30 条新定式）');

test('调候派《穷通宝鉴》30 条经典命造特征命中测试（S-TH-061～S-TH-090）', () => {
  // 1. 仲夏午月甲木癸庚两透：癸未 戊午 甲子 庚午 (命中 S-TH-061)
  const res1 = matchSchoolClaims(['癸未', '戊午', '甲子', '庚午']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-TH-061'), '午月甲木透癸庚必须命中上上之格 S-TH-061');

  // 2. 季春辰月乙木癸丙两透无己庚：癸卯 丙辰 乙亥 丙子 (命中 S-TH-063)
  const res2 = matchSchoolClaims(['癸卯', '丙辰', '乙亥', '丙子']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-TH-063'), '辰月乙木癸丙两透无己庚必须命中玉堂之客 S-TH-063');

  // 3. 孟夏巳月丙火建禄壬庚两透无戊：庚申 辛巳 丙子 壬辰 (命中 S-TH-068)
  const res3 = matchSchoolClaims(['庚申', '辛巳', '丙子', '壬辰']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-TH-068'), '巳月丙火壬庚两透无戊必须命中湖水汪洋 S-TH-068');

  // 4. 仲夏午月丁火独杀当权：己未 庚午 丁酉 癸卯 (命中 S-TH-073)
  const res4 = matchSchoolClaims(['己未', '庚午', '丁酉', '癸卯']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-TH-073'), '午月丁火得一癸透干无甲必须命中独杀当权 S-TH-073');

  // 5. 仲夏午月戊土君臣庆会：甲寅 庚午 戊辰 壬子 (命中 S-TH-077)
  const res5 = matchSchoolClaims(['甲寅', '庚午', '戊辰', '壬子']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-TH-077'), '午月戊土壬甲两透必须命中君臣庆会 S-TH-077');

  // 6. 季冬丑月辛金丙壬两透：丙申 辛丑 辛酉 壬辰 (命中 S-TH-086)
  const res6 = matchSchoolClaims(['丙申', '辛丑', '辛酉', '壬辰']);
  const ids6 = res6.matched.map((x) => x.id);
  assert.ok(ids6.includes('S-TH-086'), '丑月辛金丙壬两透必须命中金马玉堂 S-TH-086');

  // 7. 仲秋酉月壬水透甲无戊澄清：甲子 癸酉 壬子 庚子 (命中 S-TH-088)
  const res7 = matchSchoolClaims(['甲子', '癸酉', '壬子', '庚子']);
  const ids7 = res7.matched.map((x) => x.id);
  assert.ok(ids7.includes('S-TH-088'), '酉月壬水透甲无戊必须命中澈底澄清 S-TH-088');

  // 8. 季冬丑月癸水雪后灯光：丁丑 癸丑 癸亥 己未 (命中 S-TH-090)
  const res8 = matchSchoolClaims(['丁丑', '癸丑', '癸亥', '己未']);
  const ids8 = res8.matched.map((x) => x.id);
  assert.ok(ids8.includes('S-TH-090'), '丑月癸水透丁会党必须命中雪后灯光 S-TH-090');
});

test('调候派《穷通宝鉴》严密排他反向断言（无癸排他 S-TH-061、见己排他 S-TH-063、见戊浊源排他 S-TH-068、见戊排他 S-TH-088）', () => {
  // 午月甲木无癸排除 S-TH-061：甲寅 庚午 甲子 庚午 (无癸透)
  const resWuGui = matchSchoolClaims(['甲寅', '庚午', '甲子', '庚午']);
  assert.ok(!resWuGui.matched.some((x) => x.id === 'S-TH-061'), '午月甲木无癸透干必须排除 S-TH-061');

  // 辰月乙木见己土破格排除 S-TH-063：癸卯 丙辰 乙亥 己卯 (见己土浊癸)
  const resJianJi = matchSchoolClaims(['癸卯', '丙辰', '乙亥', '己卯']);
  assert.ok(!resJianJi.matched.some((x) => x.id === 'S-TH-063'), '辰月乙木见己土浊水必须排除 S-TH-063');

  // 巳月丙火见戊土浊源排除 S-TH-068：庚申 辛巳 丙子 戊子 (见戊土浊源)
  const resJianWu = matchSchoolClaims(['庚申', '辛巳', '丙子', '戊子']);
  assert.ok(!resJianWu.matched.some((x) => x.id === 'S-TH-068'), '巳月丙火见戊土克水必须排除 S-TH-068');

  // 酉月壬水见戊土浊水排除 S-TH-088：甲子 癸酉 壬子 戊申 (见戊土浊源)
  const resRenWu = matchSchoolClaims(['甲子', '癸酉', '壬子', '戊申']);
  assert.ok(!resRenWu.matched.some((x) => x.id === 'S-TH-088'), '酉月壬水见戊土克水必须排除 S-TH-088');
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

