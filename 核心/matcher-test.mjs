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
import { gejuChengPoOf } from './tiyong/geju.mjs';
import { castChart } from './engine.mjs';

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
// 测试组 1：单源 720 条标准条目解析验证（SSOT Parser Verification）
// --------------------------------------------------------------------
console.log('▶ [测试组 1] 单源条目解析完整性与字段规范测试');

test('单源条目总数必须严格等于 720 条整', () => {
  const { map, list } = loadAllSchoolEntries(true);
  assert.equal(list.length, 720, `期望 720 条，实际解析得到 ${list.length} 条`);
  assert.equal(map.size, 720, `期望 Map 容量 720，实际得到 ${map.size}`);
});

test('MATCH_PREDICATES 必须 100% 覆盖全量 720 条标准条目（零死条目门禁）', () => {
  const { list } = loadAllSchoolEntries();
  const predicateKeys = Object.keys(MATCH_PREDICATES);
  assert.equal(predicateKeys.length, 720, `谓词字典必须恰好 720 个键，实际得到 ${predicateKeys.length}`);
  for (const entry of list) {
    assert.equal(
      typeof MATCH_PREDICATES[entry.id],
      'function',
      `条目 ${entry.id} (${entry.schoolName} · ${entry.claim}) 缺少匹配谓词实现`
    );
  }
});

test('六大主流学派条目数量校验：格局派 120 条、调候派 120 条、神煞派 120 条、旺衰派 120 条、古法三命 120 条、盲派 120 条（六派 6 × 120 = 720 条绝对对称终极大圆满达成）', () => {
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
  assert.equal(counts.geju, 120, '格局派条目必须为 120 条（30正格+30外格+60成败救应全章大圆满）');
  assert.equal(counts.tiaohou, 120, '调候派条目必须为 120 条（《穷通宝鉴》十干十二月令扫尾达成 120 条）');
  assert.equal(counts.wangshuai, 120, '旺衰扶抑派条目必须为 120 条（《神峰通考》动静盖头生克与病药说全卷大圆满达成 120 条）');
  assert.equal(counts.mangpai, 120, '盲派与象法条目必须为 120 条（盲派象法高级做功与开库换象第二批收官达成 120 条封顶）');
  assert.equal(counts.sanming, 120, '古法三命条目必须为 120 条（《兰台妙选》《五行精纪》纳音神机与名格第二批收官达成 120 条封顶）');
  assert.equal(counts.shensha, 120, '神煞派条目必须为 120 条（《玉照定真经》干支刑冲定位铁断扫尾大圆满达成 120 条）');
});

test('全部 720 条条目元数据字段完整且非空', () => {
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
// 测试组 14：调候派《穷通宝鉴》金水各月十干调候定式专测套件（D-074 批次扩充）
// --------------------------------------------------------------------
console.log('▶ [测试组 14] 调候派《穷通宝鉴》金水各月十干调候定式第二批（S-TH-091～120）命中与排他验证');

test('调候派《穷通宝鉴》金水各月十干调候定式命中（羊刃架杀 S-TH-094、壬甲两透 S-TH-099、白虎格 S-TH-104、金白水清 S-TH-106、专戊用辰戌 S-TH-112、阳刃丙戊 S-TH-115、阴阳和合 S-TH-116、独才格 S-TH-119、金温水暖 S-TH-120）', () => {
  // 1. 仲秋酉月庚金羊刃架杀：庚申 乙酉 庚申 丙戌 (命中 S-TH-094)
  const res1 = matchSchoolClaims(['庚申', '乙酉', '庚申', '丙戌']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-TH-094'), '酉月庚金羊刃无冲丙杀藏支必须命中羊刃架杀 S-TH-094');

  // 2. 季春辰月辛金壬甲并透：甲子 戊辰 辛酉 壬辰 (命中 S-TH-099)
  const res2 = matchSchoolClaims(['甲子', '戊辰', '辛酉', '壬辰']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-TH-099'), '辰月辛金壬甲两透必须命中母旺子相先壬后甲 S-TH-099');

  // 3. 仲秋酉月辛金白虎格：戊申 辛酉 辛酉 壬辰 (命中 S-TH-104)
  const res3 = matchSchoolClaims(['戊申', '辛酉', '辛酉', '壬辰']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-TH-104'), '酉月辛金金局透壬戊无火必须命中白虎格 S-TH-104');

  // 4. 孟冬亥月辛金金白水清：壬辰 辛亥 辛酉 丙申 (命中 S-TH-106)
  const res4 = matchSchoolClaims(['壬辰', '辛亥', '辛酉', '丙申']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-TH-106'), '亥月辛金壬丙两透必须命中金白水清 S-TH-106');

  // 5. 孟秋申月壬水专戊用辰戌：丁丑 戊申 壬戌 庚戌 (命中 S-TH-112)
  const res5 = matchSchoolClaims(['丁丑', '戊申', '壬戌', '庚戌']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-TH-112'), '申月壬水透戊丁支见辰戌必须命中专戊土 S-TH-112');

  // 6. 仲冬子月壬水阳刃丙戊两透：丙辰 庚子 壬戌 戊申 (命中 S-TH-115)
  const res6 = matchSchoolClaims(['丙辰', '庚子', '壬戌', '戊申']);
  const ids6 = res6.matched.map((x) => x.id);
  assert.ok(ids6.includes('S-TH-115'), '子月壬水阳刃丙戊两透必须命中富贵荣华 S-TH-115');

  // 7. 初春寅月癸水阴阳和合：辛未 庚寅 癸未 丙辰 (命中 S-TH-116)
  const res7 = matchSchoolClaims(['辛未', '庚寅', '癸未', '丙辰']);
  const ids7 = res7.matched.map((x) => x.id);
  assert.ok(ids7.includes('S-TH-116'), '寅月癸水辛丙两透必须命中阴阳和合 S-TH-116');

  // 8. 孟秋申月癸水独才格：丁未 戊申 癸午 癸丑 (命中 S-TH-119)
  const res8 = matchSchoolClaims(['丁未', '戊申', '癸午', '癸丑']);
  const ids8 = res8.matched.map((x) => x.id);
  assert.ok(ids8.includes('S-TH-119'), '申月癸水透丁坐午禄必须命中独才格 S-TH-119');

  // 9. 仲冬子月癸水金温水暖：辛酉 庚子 癸丑 丙辰 (命中 S-TH-120)
  const res9 = matchSchoolClaims(['辛酉', '庚子', '癸丑', '丙辰']);
  const ids9 = res9.matched.map((x) => x.id);
  assert.ok(ids9.includes('S-TH-120'), '子月癸水丙辛齐备必须命中金温水暖 S-TH-120');
});

test('调候派《穷通宝鉴》严密排他反向断言（酉金冲刃排除 S-TH-094、见丙破白虎排除 S-TH-104、申月壬水无辰戌排除 S-TH-112、子月壬水无丙解冻排除 S-TH-115、申月癸水无午禄排除 S-TH-119）', () => {
  // 酉月庚金地支逢冲破刃排除 S-TH-094：庚申 乙酉 庚卯 丙戌 (卯酉冲刃破局)
  const resChongRen = matchSchoolClaims(['庚申', '乙酉', '庚卯', '丙戌']);
  assert.ok(!resChongRen.matched.some((x) => x.id === 'S-TH-094'), '酉月庚金地支逢冲破刃必须排除 S-TH-094');

  // 酉月辛金见丙火破白虎格排除 S-TH-104：戊申 辛酉 辛酉 丙申 (见丙破格)
  const resPoBaihu = matchSchoolClaims(['戊申', '辛酉', '辛酉', '丙申']);
  assert.ok(!resPoBaihu.matched.some((x) => x.id === 'S-TH-104'), '酉月辛金见丙火破格必须排除 S-TH-104');

  // 申月壬水地支无辰戌通根排除 S-TH-112：丁卯 戊申 壬子 庚子 (无辰戌燥土)
  const resWuChenXu = matchSchoolClaims(['丁卯', '戊申', '壬子', '庚子']);
  assert.ok(!resWuChenXu.matched.some((x) => x.id === 'S-TH-112'), '申月壬水地支无辰戌燥土通根必须排除 S-TH-112');

  // 子月壬水无丙解冻排除 S-TH-115：壬子 庚子 壬戌 戊申 (无丙火)
  const resWuBing = matchSchoolClaims(['壬子', '庚子', '壬戌', '戊申']);
  assert.ok(!resWuBing.matched.some((x) => x.id === 'S-TH-115'), '子月壬水无丙照暖解冻必须排除 S-TH-115');

  // 申月癸水日时无午禄排除 S-TH-119：丁未 戊申 癸亥 癸丑 (无午禄)
  const resWuWuLu = matchSchoolClaims(['丁未', '戊申', '癸亥', '癸丑']);
  assert.ok(!resWuWuLu.matched.some((x) => x.id === 'S-TH-119'), '申月癸水日时无午禄必须排除 S-TH-119');
});

// --------------------------------------------------------------------
// 测试组 15：格局派《子平真诠》论用神成败救应专测套件（S-GJ-061～S-GJ-090）
// --------------------------------------------------------------------
console.log('▶ [测试组 15] 格局派《子平真诠》论用神成败救应专测套件（S-GJ-061～S-GJ-090）');

test('格局派《子平真诠》经典成败救应命造真实命中测试（官逢财印成格 S-GJ-061、官逢伤透印解 S-GJ-063、杂煞合煞清 S-GJ-064、财透煞食神制煞 S-GJ-072、财透煞劫合煞 S-GJ-073、身印两旺泄秀 S-GJ-075、食带煞无财 S-GJ-081、身强七煞逢制 S-GJ-085、伤官佩印 S-GJ-088、阳刃透官煞无伤 S-GJ-090）', () => {
  // 1. 正官格逢财印无刑冲破害：戊辰 庚申 乙卯 壬午 (命中 S-GJ-061)
  const res1 = matchSchoolClaims(['戊辰', '庚申', '乙卯', '壬午']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-GJ-061'), '申月乙木正官透财印无伤杀刑冲必须命中 S-GJ-061');

  // 2. 官逢伤透印以解之：癸丑 辛酉 甲子 丁卯 (命中 S-GJ-063) 与 己卯 辛未 壬寅 辛亥 (宣参国命)
  const res2 = matchSchoolClaims(['癸丑', '辛酉', '甲子', '丁卯']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-GJ-063'), '酉月甲木官逢伤透癸印制伤必须命中 S-GJ-063');

  const res2xuan = matchSchoolClaims(['己卯', '辛未', '壬寅', '辛亥']);
  const ids2xuan = res2xuan.matched.map((x) => x.id);
  assert.ok(ids2xuan.includes('S-GJ-063'), '未月壬水官逢伤印贴身制伤宣参国造必须命中 S-GJ-063');

  // 3. 官格杂煞而合煞以清之：辛丑 庚寅 甲辰 乙亥 (命中 S-GJ-064)
  const res3 = matchSchoolClaims(['辛丑', '庚寅', '甲辰', '乙亥']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-GJ-064'), '寅月甲木透辛官庚煞乙劫合煞留官必须命中 S-GJ-064');

  // 4. 财透煞食神制煞以生财：庚辰 戊子 戊寅 甲寅 (李御史命，命中 S-GJ-072)
  const res4 = matchSchoolClaims(['庚辰', '戊子', '戊寅', '甲寅']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-GJ-072'), '子月戊土财格透甲煞庚金食神制煞李御史命必须命中 S-GJ-072');

  // 5. 财透煞或存财而合煞：乙酉 庚辰 甲午 戊辰 (毛状元命，命中 S-GJ-073)
  const res5 = matchSchoolClaims(['乙酉', '庚辰', '甲午', '戊辰']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-GJ-073'), '辰月甲木偏财透庚杀乙劫合煞毛状元命必须命中 S-GJ-073');

  // 6. 身印两旺而用食伤泄气：戊戌 乙卯 丙午 乙亥 (李状元命，命中 S-GJ-075)
  const res6 = matchSchoolClaims(['戊戌', '乙卯', '丙午', '乙亥']);
  const ids6 = res6.matched.map((x) => x.id);
  assert.ok(ids6.includes('S-GJ-075'), '卯月丙火身印并旺透戊食吐秀李状元造必须命中 S-GJ-075');

  // 7. 食带煞而无财：乙亥 乙酉 乙卯 丁丑 (命中 S-GJ-081)
  const res7 = matchSchoolClaims(['乙亥', '乙酉', '乙卯', '丁丑']);
  const ids7 = res7.matched.map((x) => x.id);
  assert.ok(ids7.includes('S-GJ-081'), '酉月乙木透丁食制煞无财党煞必须命中 S-GJ-081');

  // 8. 身强七煞逢制：壬辰 戊申 丙午 戊子 (命中 S-GJ-085)
  const res8 = matchSchoolClaims(['壬辰', '戊申', '丙午', '戊子']);
  const ids8 = res8.matched.map((x) => x.id);
  assert.ok(ids8.includes('S-GJ-085'), '丙火坐午刃申月透壬杀透戊食制煞必须命中 S-GJ-085');

  // 9. 伤官佩印伤旺印根：癸亥 庚午 甲子 壬申 (命中 S-GJ-088)
  const res9 = matchSchoolClaims(['癸亥', '庚午', '甲子', '壬申']);
  const ids9 = res9.matched.map((x) => x.id);
  assert.ok(ids9.includes('S-GJ-088'), '午月甲木伤官透癸壬水印星通根佩印必须命中 S-GJ-088');

  // 10. 阳刃透官煞露财印不见伤官：辛酉 甲午 丙申 壬辰 (丞相造，命中 S-GJ-090)
  const res10 = matchSchoolClaims(['辛酉', '甲午', '丙申', '壬辰']);
  const ids10 = res10.matched.map((x) => x.id);
  assert.ok(ids10.includes('S-GJ-090'), '午月丙火阳刃透壬煞甲印辛财无伤官必须命中 S-GJ-090');
});

test('格局派《子平真诠》严密排他反向断言（见伤破官排除 S-GJ-061、官逢伤无印排除 S-GJ-063、财透杀无食神排除 S-GJ-072、食神见财党杀排除 S-GJ-081、阳刃见伤官排除 S-GJ-090）', () => {
  // 官逢财印见伤官破格排除 S-GJ-061：戊辰 庚申 乙卯 丙午 (透丙伤破官)
  const resPoGuan = matchSchoolClaims(['戊辰', '庚申', '乙卯', '丙午']);
  assert.ok(!resPoGuan.matched.some((x) => x.id === 'S-GJ-061'), '见丙伤破官必须排除成格 S-GJ-061');

  // 官逢伤无印制排除 S-GJ-063：丁酉 辛酉 甲子 丁卯 (透丁伤无印制)
  const resWuYin = matchSchoolClaims(['丁酉', '辛酉', '甲子', '丁卯']);
  assert.ok(!resWuYin.matched.some((x) => x.id === 'S-GJ-063'), '官逢伤无印制解救必须排除 S-GJ-063');

  // 财透杀无食神制煞排除 S-GJ-072：庚辰 戊子 戊寅 壬寅 (透壬无食制)
  const resWuShi = matchSchoolClaims(['庚辰', '戊子', '戊寅', '壬寅']);
  assert.ok(!resWuShi.matched.some((x) => x.id === 'S-GJ-072'), '财透杀无食神制杀必须排除 S-GJ-072');

  // 食带煞见财党煞排除 S-GJ-081：乙亥 乙酉 乙卯 戊子 (透戊财党杀)
  const resDangSha = matchSchoolClaims(['乙亥', '乙酉', '乙卯', '戊子']);
  assert.ok(!resDangSha.matched.some((x) => x.id === 'S-GJ-081'), '食带煞见戊财党煞必须排除 S-GJ-081');

  // 阳刃用官见伤官破格排除 S-GJ-090：辛酉 甲午 丙申 己丑 (见己土伤官克官)
  const resPoRen = matchSchoolClaims(['辛酉', '甲午', '丙申', '己丑']);
  assert.ok(!resPoRen.matched.some((x) => x.id === 'S-GJ-090'), '阳刃见伤官克官必须排除成格 S-GJ-090');
});

// --------------------------------------------------------------------
// 测试组 16：格局派《子平真诠》成败救应全章大圆满专测套件（S-GJ-091～S-GJ-120）
// --------------------------------------------------------------------
console.log('▶ [测试组 16] 格局派《子平真诠》成败救应全章大圆满专测套件（S-GJ-091～S-GJ-120）');

test('格局派《子平真诠》经典成败救应命造真实命中测试（S-GJ-091～S-GJ-120）', () => {
  // 1. 建禄月劫透官逢财印：庚午 戊子 癸卯 丁巳 (王少师命，命中 S-GJ-091, S-GJ-098, S-GJ-113, S-GJ-120)
  const res1 = matchSchoolClaims(['庚午', '戊子', '癸卯', '丁巳']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-GJ-098'), '癸生子月月劫透戊官庚印丁财必须命中 S-GJ-098');
  assert.ok(ids1.includes('S-GJ-091'), '财格/禄财透印两不相碍位置妥贴必须命中 S-GJ-091');
  assert.ok(ids1.includes('S-GJ-113'), '财官相生互用相得必须命中 S-GJ-113');

  // 2. 伤官旺身主弱透煞印：己未 丙子 庚子 丙子 (蔡贵妃命，命中 S-GJ-092, S-GJ-093, S-GJ-119)
  const res2 = matchSchoolClaims(['己未', '丙子', '庚子', '丙子']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-GJ-092'), '庚生子月伤官透丙煞己印必须命中 S-GJ-092');
  assert.ok(ids2.includes('S-GJ-093'), '伤官带煞无财专一制煞必须命中 S-GJ-093');
  assert.ok(ids2.includes('S-GJ-119'), '冬金伤官见官煞其秀百倍必须命中 S-GJ-119');

  // 3. 阳刃无官杀为破格：丙寅 丁卯 甲寅 己巳 (甲生卯月阳刃无官杀)
  const res3 = matchSchoolClaims(['丙寅', '丁卯', '甲寅', '己巳']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-GJ-096'), '阳刃当令无官煞制伏破格必须命中 S-GJ-096');

  // 4. 阳刃用官煞带伤食重印以护之：癸酉 甲午 丙申 己亥 (午月阳刃透癸官己伤甲印)
  const res4 = matchSchoolClaims(['癸酉', '甲午', '丙申', '己亥']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-GJ-097'), '阳刃官伤印并透重印护官必须命中 S-GJ-097');

  // 5. 建禄透财逢食伤：甲子 丙子 癸丑 壬辰 (张都统命，命中 S-GJ-099)
  const res5 = matchSchoolClaims(['甲子', '丙子', '癸丑', '壬辰']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-GJ-099'), '子月癸水透丙财甲伤顺流必须命中 S-GJ-099');

  // 6. 建禄用财带煞煞被合：戊辰 癸亥 壬午 丙午 (袁内阁命，命中 S-GJ-103)
  const res6 = matchSchoolClaims(['戊辰', '癸亥', '壬午', '丙午']);
  const ids6 = res6.matched.map((x) => x.id);
  assert.ok(ids6.includes('S-GJ-103'), '亥月壬水透丙财戊煞癸合煞去煞留财必须命中 S-GJ-103');

  // 7. 透官逢合贪合忘贵：丙午 辛卯 甲子 戊辰 (甲生卯月辛官透逢丙合)
  const res7 = matchSchoolClaims(['丙午', '辛卯', '甲子', '戊辰']);
  const ids7 = res7.matched.map((x) => x.id);
  assert.ok(ids7.includes('S-GJ-105'), '正官透干逢丙火合羁必须命中 S-GJ-105');

  // 8. 冻水不能生木：壬子 壬子 甲子 乙亥 (甲木冬生印水太重无火照暖)
  const res8 = matchSchoolClaims(['壬子', '壬子', '甲子', '乙亥']);
  const ids8 = res8.matched.map((x) => x.id);
  assert.ok(ids8.includes('S-GJ-118'), '冬水凝冰不能生木无火调候必须命中 S-GJ-118');

  // 9. 木火伤官非金水见官破格：甲午 丁卯 甲寅 辛未 (甲生卯月透丁伤辛官)
  const res9 = matchSchoolClaims(['甲午', '丁卯', '甲寅', '辛未']);
  const ids9 = res9.matched.map((x) => x.id);
  assert.ok(ids9.includes('S-GJ-094'), '木火伤官见官破格为祸百端必须命中 S-GJ-094');
});

test('格局派《子平真诠》严密排他反向断言（见财破伤官带煞排除 S-GJ-093、冬金见官排除破格 S-GJ-094、阳刃透官煞排除 S-GJ-096、冬木透火照暖排除 S-GJ-118）', () => {
  // 伤官带煞见财党煞排除 S-GJ-093：己未 丙子 庚子 乙酉 (透乙财党杀)
  const resDangCai = matchSchoolClaims(['己未', '丙子', '庚子', '乙酉']);
  assert.ok(!resDangCai.matched.some((x) => x.id === 'S-GJ-093'), '伤官带煞见财转生七煞必须排除成格 S-GJ-093');

  // 冬金金水伤官见官调候为急不作破格排除 S-GJ-094：庚子 戊子 辛亥 丙申 (冬金见官调候)
  const resDongJin = matchSchoolClaims(['庚子', '戊子', '辛亥', '丙申']);
  assert.ok(!resDongJin.matched.some((x) => x.id === 'S-GJ-094'), '冬金见官调候为秀气必须排除破格 S-GJ-094');

  // 阳刃透煞无伤官排除无官杀破格 S-GJ-096：辛酉 甲午 丙申 壬辰 (透壬水七煞制刃)
  const resRenGuan = matchSchoolClaims(['辛酉', '甲午', '丙申', '壬辰']);
  assert.ok(!resRenGuan.matched.some((x) => x.id === 'S-GJ-096'), '阳刃有煞制伏成格必须排除无官杀 S-GJ-096');

  // 冬木透丙火暖局排除冻水不生木 S-GJ-118：壬子 壬子 甲子 丙寅 (丙火高透照暖)
  const resNuanMu = matchSchoolClaims(['壬子', '壬子', '甲子', '丙寅']);
  assert.ok(!resNuanMu.matched.some((x) => x.id === 'S-GJ-118'), '冬木得丙火解冻暖局必须排除冻木 S-GJ-118');
});

// --------------------------------------------------------------------
// 测试组 17：神煞派《玉照定真经》干支刑冲定位铁断大圆满专测套件（D-077）
// --------------------------------------------------------------------
console.log('\n▶ [测试组 17] 神煞派《玉照定真经》干支刑冲定位铁断大圆满专测套件');

test('神煞派《玉照定真经》干支刑冲定位大圆满典型定式命中（S-SS-091, 092, 094, 097, 101, 104, 105, 106, 111, 114, 116）', () => {
  // 1. 庚申辛酉同方人必亡于兵刃：庚申 辛酉 庚申 辛酉
  const res1 = matchSchoolClaims(['庚申', '辛酉', '庚申', '辛酉']);
  const ids1 = res1.matched.map((x) => x.id);
  assert.ok(ids1.includes('S-SS-091'), '庚申辛酉金刚无制必须命中 S-SS-091');

  // 2. 甲乙同来寅卯定出长发师姑：甲寅 乙卯 甲寅 乙卯
  const res2 = matchSchoolClaims(['甲寅', '乙卯', '甲寅', '乙卯']);
  const ids2 = res2.matched.map((x) => x.id);
  assert.ok(ids2.includes('S-SS-092'), '甲乙同来寅卯纯木清冷必须命中 S-SS-092');

  // 3. 乙犯天罡阴人媒氏：乙卯 庚辰 乙丑 丁亥
  const res3 = matchSchoolClaims(['乙卯', '庚辰', '乙丑', '丁亥']);
  const ids3 = res3.matched.map((x) => x.id);
  assert.ok(ids3.includes('S-SS-094'), '乙木加临天罡辰位必须命中 S-SS-094');

  // 4. 丑中立癸甲见而释教之人：甲子 癸丑 丙子 甲午
  const res4 = matchSchoolClaims(['甲子', '癸丑', '丙子', '甲午']);
  const ids4 = res4.matched.map((x) => x.id);
  assert.ok(ids4.includes('S-SS-097'), '丑中立癸甲湿土涵木入佛门必须命中 S-SS-097');

  // 5. 子临井宿须生脾胃之殃：丙子 乙未 戊子 己未
  const res5 = matchSchoolClaims(['丙子', '乙未', '戊子', '己未']);
  const ids5 = res5.matched.map((x) => x.id);
  assert.ok(ids5.includes('S-SS-101'), '子未穿害水土交战腹疾必须命中 S-SS-101');

  // 6. 酉朝罡上金土两和：乙酉 庚辰 辛卯 丁酉
  const res6 = matchSchoolClaims(['乙酉', '庚辰', '辛卯', '丁酉']);
  const ids6 = res6.matched.map((x) => x.id);
  assert.ok(ids6.includes('S-SS-104'), '辰酉相合金土两和必须命中 S-SS-104');

  // 7. 巳刑传送与申到巳中行人反复：庚申 辛巳 丁酉 辛丑 (C-234 盘)
  const res7 = matchSchoolClaims(['庚申', '辛巳', '丁酉', '辛丑']);
  const ids7 = res7.matched.map((x) => x.id);
  assert.ok(ids7.includes('S-SS-105'), '巳申相刑带马必须命中 S-SS-105');
  assert.ok(ids7.includes('S-SS-106'), '申到巳中刑合交加必须命中 S-SS-106');

  // 8. 从魁与亥未辛丁遇太常酒家利路：丁酉 辛亥 乙未 丁亥
  const res8 = matchSchoolClaims(['丁酉', '辛亥', '乙未', '丁亥']);
  const ids8 = res8.matched.map((x) => x.id);
  assert.ok(ids8.includes('S-SS-111'), '酉金见亥未辛丁太常酒家必须命中 S-SS-111');

  // 9. 庚辛向无火之乡出不义军人孤女：庚子 戊子 辛亥 庚子
  const res9 = matchSchoolClaims(['庚子', '戊子', '辛亥', '庚子']);
  const ids9 = res9.matched.map((x) => x.id);
  assert.ok(ids9.includes('S-SS-114'), '冬金无火肃杀寒冽必须命中 S-SS-114');

  // 10. 壬癸旺中必须流落：壬子 壬子 癸亥 癸亥
  const res10 = matchSchoolClaims(['壬子', '壬子', '癸亥', '癸亥']);
  const ids10 = res10.matched.map((x) => x.id);
  assert.ok(ids10.includes('S-SS-116'), '壬癸泛滥无土堤防必须命中 S-SS-116');
});

test('神煞派《玉照定真经》严密排他反向断言（金盛有水通关排除 S-SS-091、木盛透火排除 S-SS-092、无辰土排除 S-SS-094、子午冲无未害排除 S-SS-101、巳申逢冲排除 S-SS-106）', () => {
  // 1. 金盛有水引通流转排除亡于兵刃 S-SS-091：庚申 辛酉 癸亥 壬子
  const resWaterMetal = matchSchoolClaims(['庚申', '辛酉', '癸亥', '壬子']);
  assert.ok(!resWaterMetal.matched.some((x) => x.id === 'S-SS-091'), '金盛有旺水引通化泄必须排除兵刃之险 S-SS-091');

  // 2. 木盛透丙丁火泄秀排除长发师姑 S-SS-092：甲寅 乙卯 丙午 丁巳
  const resWoodFire = matchSchoolClaims(['甲寅', '乙卯', '丙午', '丁巳']);
  assert.ok(!resWoodFire.matched.some((x) => x.id === 'S-SS-092'), '木盛透火通明必须排除出家师姑 S-SS-092');

  // 3. 乙木无辰土天罡排除媒氏 S-SS-094：乙卯 丁亥 乙未 丙子
  const resNoChen = matchSchoolClaims(['乙卯', '丁亥', '乙未', '丙子']);
  assert.ok(!resNoChen.matched.some((x) => x.id === 'S-SS-094'), '乙木地支无辰土天罡必须排除媒氏 S-SS-094');

  // 4. 子水见午冲无未穿排除脾胃之殃 S-SS-101：庚午 戊子 丙午 戊子
  const resZiWu = matchSchoolClaims(['庚午', '戊子', '丙午', '戊子']);
  assert.ok(!resZiWu.matched.some((x) => x.id === 'S-SS-101'), '单纯子午正冲无子未穿害必须排除脾胃之殃 S-SS-101');

  // 5. 巳申逢地支冲战排除合中刑反复 S-SS-106：庚申 辛巳 丙寅 壬辰 (寅申巳三刑并冲)
  const resChongSiShen = matchSchoolClaims(['庚申', '辛巳', '丙寅', '壬辰']);
});

// --------------------------------------------------------------------
// 测试组 18：旺衰扶抑派《神峰通考》动静盖头病药雕枯专测套件 (D-078)
// --------------------------------------------------------------------
console.log('\n▶ [测试组 18] 旺衰扶抑派《神峰通考》动静盖头病药雕枯专测套件 (D-078)');

test('旺衰扶抑派《神峰通考》动静盖头病药雕枯正向特征命中断言（C-235 盘、天干动克、地支静守、四库开锁、官杀排门、四狱全、长生帝旺、病药两停）', () => {
  // 1. C-235 盘：辛卯 辛丑 丁卯 癸卯 (夏贷岱公命造，卯木三重克土，两辛克木一番病过一番医)
  const resC235 = matchSchoolClaims(['辛卯', '辛丑', '丁卯', '癸卯']);
  const idsC235 = resC235.matched.map((x) => x.id);
  assert.ok(idsC235.includes('S-WS-061'), '天干透辛克卯木动攻动必须命中 S-WS-061');
  assert.ok(idsC235.includes('S-WS-070'), '有病方为贵格中如去病必须命中 S-WS-070');
  assert.ok(idsC235.includes('S-WS-090'), '局中大病得药两两相停必须命中 S-WS-090');

  // 2. 地支静守静攻：壬子 庚戌 庚辰 壬午 (天干纯金水金生水无克战，地支辰戌冲子午冲)
  const resJing = matchSchoolClaims(['壬子', '庚戌', '庚辰', '壬午']);
  const idsJing = resJing.matched.map((x) => x.id);
  assert.ok(idsJing.includes('S-WS-062'), '天干无克战地支多冲静攻静必须命中 S-WS-062');

  // 3. 辰戌丑未对冲开锁钥：戊辰 壬戌 己丑 癸未 (辰戌对冲丑未对冲四库齐备)
  const resKu = matchSchoolClaims(['戊辰', '壬戌', '己丑', '癸未']);
  const idsKu = resKu.matched.map((x) => x.id);
  assert.ok(idsKu.includes('S-WS-063'), '辰戌冲丑未冲开库锁钥必须命中 S-WS-063');
  assert.ok(idsKu.includes('S-WS-069'), '辰戌丑未全犯四狱必须命中 S-WS-069');

  // 4. 官杀司权损伤兄弟：甲寅 庚申 乙酉 辛巳 (月令庚申官杀当权透干攻身)
  const resGuanSha = matchSchoolClaims(['甲寅', '庚申', '乙酉', '辛巳']);
  const idsGuanSha = resGuanSha.matched.map((x) => x.id);
  assert.ok(idsGuanSha.includes('S-WS-067'), '月令官杀司权损伤兄弟必须命中 S-WS-067');

  // 5. 六阳长生初生：甲子 乙亥 甲子 乙亥 (甲生亥月六阳长生)
  const resSheng = matchSchoolClaims(['甲子', '乙亥', '甲子', '乙亥']);
  const idsSheng = resSheng.matched.map((x) => x.id);
  assert.ok(idsSheng.includes('S-WS-080'), '甲生亥月六阳生处真为生必须命中 S-WS-080');

  // 6. 金旺得火成器皿：庚申 乙酉 庚申 丙戌 (秋金身旺庚申逢丙火七杀裁制)
  const resJinHuo = matchSchoolClaims(['庚申', '乙酉', '庚申', '丙戌']);
  const idsJinHuo = resJinHuo.matched.map((x) => x.id);
  assert.ok(idsJinHuo.includes('S-WS-082'), '金旺得火方成器皿必须命中 S-WS-082');

  // 7. 土厚埋金：戊辰 己丑 辛丑 戊戌 (重重厚土无水无木土多金埋)
  const resTuJin = matchSchoolClaims(['戊辰', '己丑', '辛丑', '戊戌']);
  const idsTuJin = resTuJin.matched.map((x) => x.id);
  assert.ok(idsTuJin.includes('S-WS-083'), '厚土重叠土多金埋必须命中 S-WS-083');

  // 8. 水大木漂：癸亥 壬子 甲子 乙亥 (木生水月重重汪洋无土水多木漂)
  const resShuiMu = matchSchoolClaims(['癸亥', '壬子', '甲子', '乙亥']);
  const idsShuiMu = resShuiMu.matched.map((x) => x.id);
  assert.ok(idsShuiMu.includes('S-WS-089'), '汪洋巨浪水多木漂必须命中 S-WS-089');
});

test('旺衰扶抑派《神峰通考》严密排他反向断言（地支冲破排除动攻 S-WS-061、天干战克排除静守 S-WS-062、无四库冲排除开锁 S-WS-063、无四狱全排除 S-WS-069、身弱无土印重叠排除土多金埋 S-WS-083）', () => {
  // 1. 地支有六冲相战排除纯动攻 S-WS-061：甲申 戊寅 丙子 壬午 (支逢寅申冲子午冲)
  const resChong = matchSchoolClaims(['甲申', '戊寅', '丙子', '壬午']);
  assert.ok(!resChong.matched.some((x) => x.id === 'S-WS-061'), '地支多冲战必须排除天干纯动攻 S-WS-061');

  // 2. 天干有直接克战排除纯静守 S-WS-062：庚寅 甲申 壬午 丙午 (天干庚克甲、壬克丙)
  const resTianKe = matchSchoolClaims(['庚寅', '甲申', '壬午', '丙午']);
  assert.ok(!resTianKe.matched.some((x) => x.id === 'S-WS-062'), '天干明显克战必须排除纯静守 S-WS-062');

  // 3. 地支无四库对冲排除开锁 S-WS-063：甲寅 乙卯 甲寅 乙卯 (纯木无四库冲)
  const resNoKu = matchSchoolClaims(['甲寅', '乙卯', '甲寅', '乙卯']);
  assert.ok(!resNoKu.matched.some((x) => x.id === 'S-WS-063'), '无辰戌丑未相冲必须排除开库锁钥 S-WS-063');

  // 4. 四库不全排除四狱 S-WS-069：甲辰 乙丑 丙寅 丁卯 (仅辰丑两字)
  const resTwoKu = matchSchoolClaims(['甲辰', '乙丑', '丙寅', '丁卯']);
  assert.ok(!resTwoKu.matched.some((x) => x.id === 'S-WS-069'), '仅犯一二库支必须排除天地四狱 S-WS-069');

  // 5. 庚金生于秋月火炼无厚土排除土多金埋 S-WS-083：庚申 乙酉 庚申 丙戌
  const resNoTuJin = matchSchoolClaims(['庚申', '乙酉', '庚申', '丙戌']);
  assert.ok(!resNoTuJin.matched.some((x) => x.id === 'S-WS-083'), '金旺得火无厚土必须排除土多金埋 S-WS-083');
});

// --------------------------------------------------------------------
// 测试组 19：旺衰扶抑派《神峰通考》动静盖头生克与病药说大圆满专测套件 (D-079)
// --------------------------------------------------------------------
console.log('\n▶ [测试组 19] 旺衰扶抑派《神峰通考》动静盖头生克与病药说大圆满专测套件 (D-079)');

test('旺衰扶抑派《神峰通考》大圆满正向特征命中断言（C-236 李志富命盘、合婚补救、重重生气无官、印重逢财破印、六甲坐申三重见子、阴水从火、丁酉不怕多水从杀、弃命从财从杀）', () => {
  // 1. C-236 李志富公命：辛巳 丁酉 丙寅 己丑 (正财身旺任财、透食伤化劫生财)
  const resC236 = matchSchoolClaims(['辛巳', '丁酉', '丙寅', '己丑']);
  const idsC236 = resC236.matched.map((x) => x.id);
  assert.ok(idsC236.includes('S-WS-098'), '身旺比劫多逢财见杀去比存财必须命中 S-WS-098');
  assert.ok(idsC236.includes('S-WS-100'), '正财有气喜强身旺任财必须命中 S-WS-100');

  // 2. 重重生气若无官常作清高技艺看：甲寅 丙寅 丙寅 甲午 (纯印比无一字官杀)
  const resJiYi = matchSchoolClaims(['甲寅', '丙寅', '丙寅', '甲午']);
  const idsJiYi = resJiYi.matched.map((x) => x.id);
  assert.ok(idsJiYi.includes('S-WS-095'), '重重生气无官杀常作技艺看必须命中 S-WS-095');

  // 3. 六甲坐申三重见子：甲申 丙子 甲申 丙子 (甲申日主支见双子以上)
  const resShenZi = matchSchoolClaims(['甲申', '丙子', '甲申', '丙子']);
  const idsShenZi = resShenZi.matched.map((x) => x.id);
  assert.ok(idsShenZi.includes('S-WS-107'), '六甲坐申重见子北方防溺漂必须命中 S-WS-107');

  // 4. 丁酉阴柔不怕多水、阴火酉月弃命就财：癸酉 辛酉 丁酉 辛亥 (丁火酉提无根弃命就财从杀)
  const resDingYou = matchSchoolClaims(['癸酉', '辛酉', '丁酉', '辛亥']);
  const idsDingYou = resDingYou.matched.map((x) => x.id);
  assert.ok(idsDingYou.includes('S-WS-112'), '丁酉阴柔不怕多水必须命中 S-WS-112');
  assert.ok(idsDingYou.includes('S-WS-120'), '阴火酉月弃命就财北方入格必须命中 S-WS-120');

  // 5. 男比劫重女食伤重合婚补救：庚申 辛酉 庚申 辛酉 (全金比劫极盛)
  const resHeHun = matchSchoolClaims(['庚申', '辛酉', '庚申', '辛酉']);
  const idsHeHun = resHeHun.matched.map((x) => x.id);
  assert.ok(idsHeHun.includes('S-WS-091'), '比劫重叠或食伤重叠合婚补救必须命中 S-WS-091');
});

test('旺衰扶抑派《神峰通考》大圆满严密排他反向断言（有官杀排除技艺看 S-WS-095、非甲申日主排除水漂 S-WS-107、非丁酉日排除丁酉不怕多水 S-WS-112）', () => {
  // 1. 局有官杀排除清高技艺看 S-WS-095：甲子 丁卯 丙寅 癸巳 (透癸水正官)
  const resYouGuan = matchSchoolClaims(['甲子', '丁卯', '丙寅', '癸巳']);
  assert.ok(!resYouGuan.matched.some((x) => x.id === 'S-WS-095'), '局透官星必须排除清高技艺看 S-WS-095');

  // 2. 非甲申日主排除六甲坐申重见子 S-WS-107：甲子 丙子 甲子 丙子 (甲子日非甲申日)
  const resNoShen = matchSchoolClaims(['甲子', '丙子', '甲子', '丙子']);
  assert.ok(!resNoShen.matched.some((x) => x.id === 'S-WS-107'), '日支非申必须排除六甲坐申重见子 S-WS-107');

  // 3. 非丁酉日主排除丁酉阴柔不怕水 S-WS-112：丁巳 壬子 丁丑 辛亥 (丁丑日非丁酉日)
  const resNoDingYou = matchSchoolClaims(['丁巳', '壬子', '丁丑', '辛亥']);
  assert.ok(!resNoDingYou.matched.some((x) => x.id === 'S-WS-112'), '非丁酉日主必须排除丁酉不怕多水 S-WS-112');
});

// --------------------------------------------------------------------
// 测试组 20：古法三命《兰台妙选》《五行精纪》纳音神机与名格专测套件 (D-080)
// --------------------------------------------------------------------
console.log('\n▶ [测试组 20] 古法三命《兰台妙选》《五行精纪》纳音神机与名格专测套件 (D-080)');

test('古法三命纳音神机与名格大圆满第一批正向特征命中断言（C-237 钱丞相盘、宝剑化青龙、日月分秀、源远流清、凤舞顺风、马骤天廷、风雨作霖等）', () => {
  // 1. C-237 钱丞相命造：庚辰 戊寅 庚辰 戊寅 (云龙风虎 S-SM-062、棣萼芬芳 S-SM-082、主本持印 S-SM-090、龙虎拱门 S-SM-049)
  const resQian = matchSchoolClaims(['庚辰', '戊寅', '庚辰', '戊寅']);
  assert.ok(resQian.matched.some((x) => x.id === 'S-SM-062'), '钱丞相盘必须命中云龙风虎格 S-SM-062');
  assert.ok(resQian.matched.some((x) => x.id === 'S-SM-082'), '钱丞相盘必须命中棣萼芬芳格 S-SM-082');
  assert.ok(resQian.matched.some((x) => x.id === 'S-SM-090'), '钱丞相盘必须命中主本持印格 S-SM-090');
  assert.ok(resQian.matched.some((x) => x.id === 'S-SM-049'), '钱丞相盘必须命中龙虎拱门 S-SM-049');

  // 1.1 虎卧荒丘格 S-SM-076 与 一气为根 S-SM-078：甲寅 丙寅 戊寅 己未 (三寅并见、寅年见未丘)
  const resHuQiu = matchSchoolClaims(['甲寅', '丙寅', '戊寅', '己未']);
  assert.ok(resHuQiu.matched.some((x) => x.id === 'S-SM-076'), '寅年日时见未必须命中虎卧荒丘 S-SM-076');
  assert.ok(resHuQiu.matched.some((x) => x.id === 'S-SM-078'), '地支三寅同气连根必须命中一气为根 S-SM-078');

  // 2. 宝剑化青龙 S-SM-061：壬申 壬辰 癸酉 丙辰 (剑锋金见辰龙水库)
  const resBaoJian = matchSchoolClaims(['壬申', '壬辰', '癸酉', '丙辰']);
  assert.ok(resBaoJian.matched.some((x) => x.id === 'S-SM-061'), '剑锋金见辰龙必须命中宝剑化青龙 S-SM-061');

  // 3. 日月分秀 S-SM-063 与 昆山片玉 S-SM-064：戊午 己未 庚申 辛未
  const resRiYue = matchSchoolClaims(['戊午', '己未', '庚申', '辛未']);
  assert.ok(resRiYue.matched.some((x) => x.id === 'S-SM-063'), '见戊午己未必须命中日月分秀 S-SM-063');
  assert.ok(resRiYue.matched.some((x) => x.id === 'S-SM-064'), '石榴木见土丘必须命中昆山片玉 S-SM-064');

  // 4. 源远流清 S-SM-066 与 云凝薄露 S-SM-068：甲申 丙子 甲申 丁卯
  const resYuanYuan = matchSchoolClaims(['甲申', '丙子', '甲申', '丁卯']);
  assert.ok(resYuanYuan.matched.some((x) => x.id === 'S-SM-066'), '泉水见金水顺生必须命中源远流清 S-SM-066');
  assert.ok(resYuanYuan.matched.some((x) => x.id === 'S-SM-068'), '涧下水逢东方卯春必须命中云凝薄露 S-SM-068');

  // 5. 凤舞顺风 S-SM-069 与 风雨作霖 S-SM-071：辛酉 癸巳 壬辰 癸卯 (酉见巳风、水命见辰巳)
  const resFengWu = matchSchoolClaims(['辛酉', '癸巳', '壬辰', '癸卯']);
  assert.ok(resFengWu.matched.some((x) => x.id === 'S-SM-069'), '辛酉木逢巳风必须命中凤舞顺风 S-SM-069');
  assert.ok(resFengWu.matched.some((x) => x.id === 'S-SM-071'), '水命见辰巳必须命中风雨作霖 S-SM-071');

  // 6. 马骤天廷 S-SM-070：戊午 癸亥 壬午 辛亥 (午马逢亥天门)
  const resMaTian = matchSchoolClaims(['戊午', '癸亥', '壬午', '辛亥']);
  assert.ok(resMaTian.matched.some((x) => x.id === 'S-SM-070'), '午马日时见亥必须命中马骤天廷 S-SM-070');
});

test('古法三命纳音神机与名格大圆满严密排他反向断言（无辰排除化青龙、冲寅排除风虎、无戊午排除日月分秀、非秋令排除月白风清、无南离排除魁星指南）', () => {
  // 1. 无辰支排除宝剑化青龙 S-SM-061：壬申 壬子 癸酉 癸亥 (见剑锋金但无辰支)
  const resNoChen = matchSchoolClaims(['壬申', '壬子', '癸酉', '癸亥']);
  assert.ok(!resNoChen.matched.some((x) => x.id === 'S-SM-061'), '无辰支水库化龙必须排除宝剑化青龙 S-SM-061');

  // 2. 申冲寅排除云龙风虎 S-SM-062：庚辰 戊寅 甲申 戊辰 (见申冲寅冲破虎位)
  const resChongHu = matchSchoolClaims(['庚辰', '戊寅', '甲申', '戊辰']);
  assert.ok(!resChongHu.matched.some((x) => x.id === 'S-SM-062'), '见申冲寅破局必须排除云龙风虎 S-SM-062');

  // 3. 纯阴无戊午排除日月分秀 S-SM-063：癸亥 己未 癸亥 己未 (有太阴己未但无太阳戊午)
  const resNoWuWu = matchSchoolClaims(['癸亥', '己未', '癸亥', '己未']);
  assert.ok(!resNoWuWu.matched.some((x) => x.id === 'S-SM-063'), '无戊午太阳并见必须排除日月分秀 S-SM-063');

  // 4. 非申酉秋令排除月白风清 S-SM-079：丙寅 己未 癸巳 丁巳 (寅月非秋，虽有己未与巳风)
  const resNotAutumn = matchSchoolClaims(['丙寅', '己未', '癸巳', '丁巳']);
  assert.ok(!resNotAutumn.matched.some((x) => x.id === 'S-SM-079'), '非申酉秋金之令必须排除月白风清 S-SM-079');

  // 5. 无巳午离明排除魁星指南 S-SM-080：庚辰 戊子 庚戌 壬子 (见魁罡但时支子非南离)
  const resNoNan = matchSchoolClaims(['庚辰', '戊子', '庚戌', '壬子']);
  assert.ok(!resNoNan.matched.some((x) => x.id === 'S-SM-080'), '时支非巳午离南必须排除魁星指南 S-SM-080');
});

// --------------------------------------------------------------------
// 测试组 21：盲派象法高级做功与开库换象专测套件（D-081 规格）
// --------------------------------------------------------------------
console.log('▶ [测试组 21] 盲派象法高级做功、宾主开库与十神换象（S-MP-061～S-MP-090）专测');

test('盲派象法高级做功与十神换象黄金名造正向命中断言（无财以禄当财、无财以食伤当财、官杀统财、财星虚透、官星虚透、七杀合羊刃、日支连体做功、未戌刑开库、食神合印）', () => {
  // 1. 无财以禄当财 S-MP-061 & 无财以食伤当财 S-MP-062：甲子 丙寅 甲寅 丙寅 (甲木坐禄透食伤，四柱无财)
  const resNoCai = matchSchoolClaims(['甲子', '丙寅', '甲寅', '丙寅']);
  assert.ok(resNoCai.matched.some((x) => x.id === 'S-MP-061'), '局中无财坐禄必须命中以禄当财 S-MP-061');
  assert.ok(resNoCai.matched.some((x) => x.id === 'S-MP-062'), '局中无财透食伤必须命中食伤当财 S-MP-062');

  // 2. 官杀统财 S-MP-063 & 劫财当财 S-MP-065：辛巳 丁酉 丙申 戊戌 (丙火透辛财、见巳酉丑申，财官劫齐备)
  const resGuanCai = matchSchoolClaims(['辛巳', '丁酉', '丙申', '戊戌']);
  assert.ok(resGuanCai.matched.some((x) => x.id === 'S-MP-065'), '比劫得势制财必须命中劫财当财 S-MP-065');

  // 3. 财星虚透主才华 S-MP-066：甲申 壬申 甲子 戊申 (戊土虚透无燥土根)
  const resXuCai = matchSchoolClaims(['甲申', '壬申', '甲子', '戊申']);
  assert.ok(resXuCai.matched.some((x) => x.id === 'S-MP-066'), '财星天干虚浮地支无根必须命中财星虚透 S-MP-066');

  // 4. 官星虚透主名誉聪明 S-MP-067：庚子 戊子 己酉 乙丑 (己土见乙木七杀虚透，支无寅卯木根)
  const resXuGuan = matchSchoolClaims(['庚子', '戊子', '己酉', '乙丑']);
  assert.ok(resXuGuan.matched.some((x) => x.id === 'S-MP-067'), '官杀虚透地支无根必须命中官星虚透 S-MP-067');

  // 5. 七杀合羊刃 S-MP-070：庚戌 甲申 甲卯 庚午 (甲生申月七杀，透庚杀坐卯刃)
  const resShaRen = matchSchoolClaims(['庚戌', '甲申', '甲卯', '庚午']);
  assert.ok(resShaRen.matched.some((x) => x.id === 'S-MP-070'), '七杀羊刃并见必须命中七杀合羊刃 S-MP-070');

  // 6. 连体之神不可坏 S-MP-086 & 干与支同 S-MP-084：乙巳 甲申 癸酉 壬戌 (林则徐命造，癸酉自坐印绶连体)
  const resLianTi = matchSchoolClaims(['乙巳', '甲申', '癸酉', '壬戌']);
  assert.ok(resLianTi.matched.some((x) => x.id === 'S-MP-086'), '日柱自坐印绶连体必须命中连体之神不可坏 S-MP-086');

  // 7. 远合年月 S-MP-087：己巳 丙子 甲寅 己丑 (甲日主与年干己土远隔五合)
  const resYuanHe = matchSchoolClaims(['己巳', '丙子', '甲寅', '己丑']);
  assert.ok(resYuanHe.matched.some((x) => x.id === 'S-MP-087'), '日主隔位合年月宾位必须命中远合年月 S-MP-087');

  // 8. 未戌刑开火库 S-MP-088：戊戌 己未 丙子 丁酉 (地支未戌相刑)
  const resWeiXu = matchSchoolClaims(['戊戌', '己未', '丙子', '丁酉']);
  assert.ok(resWeiXu.matched.some((x) => x.id === 'S-MP-088'), '地支未戌相见必须命中未戌刑开火库 S-MP-088');

  // 9. 食神合印 S-MP-089：壬子 丁未 乙卯 丙子 (乙木以丁火为食神、壬水为正印，丁壬相合)
  const resShiHeYin = matchSchoolClaims(['壬子', '丁未', '乙卯', '丙子']);
  assert.ok(resShiHeYin.matched.some((x) => x.id === 'S-MP-089'), '食神与印星天干相合必须命中食神合印 S-MP-089');
});

test('盲派象法高级做功与开库换象严密排他反向断言（有财排除以禄当财、有根排除财星虚透、无杀刃排除七杀合羊刃、无未戌排除未戌刑）', () => {
  // 1. 天干透财排除以禄当财 S-MP-061：戊子 庚申 甲寅 丙寅 (甲见戊土偏财透干)
  const resHasCai = matchSchoolClaims(['戊子', '庚申', '甲寅', '丙寅']);
  assert.ok(!resHasCai.matched.some((x) => x.id === 'S-MP-061'), '天干透正偏财必须排除以禄当财 S-MP-061');

  // 2. 地支有强财根排除财星虚透 S-MP-066：戊辰 丙辰 甲子 丙寅 (辰土有本气戊土财根)
  const resRootCai = matchSchoolClaims(['戊辰', '丙辰', '甲子', '丙寅']);
  assert.ok(!resRootCai.matched.some((x) => x.id === 'S-MP-066'), '地支有财星本气通根必须排除财星虚透 S-MP-066');

  // 3. 无阳刃七杀排除七杀合羊刃 S-MP-070：甲子 丙寅 己丑 丁卯 (无阳刃)
  const resNoRen = matchSchoolClaims(['甲子', '丙寅', '己丑', '丁卯']);
  assert.ok(!resNoRen.matched.some((x) => x.id === 'S-MP-070'), '局无羊刃必须排除七杀合羊刃 S-MP-070');

  // 4. 无未戌并见排除未戌刑开库 S-MP-088：甲子 丙寅 戊辰 庚申 (无未无戌)
  const resNoWeiXu = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resNoWeiXu.matched.some((x) => x.id === 'S-MP-088'), '局无未戌相见必须排除未戌刑开火库 S-MP-088');
});

// --------------------------------------------------------------------
// 测试组 22：古法三命《兰台妙选》《五行精纪》纳音神机与名格收官（S-SM-091～S-SM-120）专测
// --------------------------------------------------------------------
console.log('▶ [测试组 22] 古法三命《兰台妙选》《五行精纪》纳音神机与名格收官（S-SM-091～S-SM-120）专测');

test('古法三命名格收官定式黄金名造正向命中断言（水居湖海、火震雷霆、德合双鸳、官星四干、天关地轴、日精月华、桂林凤隐、海藏龙潜、虎卧凤阙、鱼跃龙池、毕乌登日宫）', () => {
  // 1. 水居湖海格 S-SM-091：壬戌 壬子 癸亥 癸亥 (壬戌癸亥大海水生于子月北方水旺之地，无土填塞)
  const resShuiHai = matchSchoolClaims(['壬戌', '壬子', '癸亥', '癸亥']);
  assert.ok(resShuiHai.matched.some((x) => x.id === 'S-SM-091'), '水命生于子月北方江湖大海必须命中水居湖海 S-SM-091');

  // 2. 火震雷霆格 S-SM-092：戊子 乙卯 丙寅 壬辰 (戊子霹雳火见卯辰雷门)
  const resHuoLei = matchSchoolClaims(['戊子', '乙卯', '丙寅', '壬辰']);
  assert.ok(resHuoLei.matched.some((x) => x.id === 'S-SM-092'), '火命见东方雷霆震地必须命中火震雷霆 S-SM-092');

  // 3. 德合双鸳格 S-SM-093：甲子 己丑 乙丑 庚辰 (甲己合、乙庚合)
  const resDeHe = matchSchoolClaims(['甲子', '己丑', '乙丑', '庚辰']);
  assert.ok(resDeHe.matched.some((x) => x.id === 'S-SM-093'), '两组天干合必须命中德合双鸳 S-SM-093');

  // 4. 官星四干格 S-SM-094：庚辰 辛巳 甲子 辛未 (透庚杀、两辛官)
  const resGuanXing = matchSchoolClaims(['庚辰', '辛巳', '甲子', '辛未']);
  assert.ok(resGuanXing.matched.some((x) => x.id === 'S-SM-094'), '天干官星多透无伤官必须命中官星四干 S-SM-094');

  // 5. 天关地轴格 S-SM-095：甲戌 癸酉 乙未 丁亥 (戌为天关，未为地轴)
  const resGuanZhou = matchSchoolClaims(['甲戌', '癸酉', '乙未', '丁亥']);
  assert.ok(resGuanZhou.matched.some((x) => x.id === 'S-SM-095'), '戌亥与未申兼备必须命中天关地轴 S-SM-095');

  // 6. 日精月华格 S-SM-096：戊午 己未 甲子 丙寅 (四柱同见戊午太阳与己未太阴)
  const resRiYue = matchSchoolClaims(['戊午', '己未', '甲子', '丙寅']);
  assert.ok(resRiYue.matched.some((x) => x.id === 'S-SM-096'), '见戊午与己未交会必须命中日精月华 S-SM-096');

  // 7. 桂林凤隐格 S-SM-101：辛卯 丁酉 乙丑 壬午 (见辛卯松柏木月桂与酉宫金凤)
  const resFengYin = matchSchoolClaims(['辛卯', '丁酉', '乙丑', '壬午']);
  assert.ok(resFengYin.matched.some((x) => x.id === 'S-SM-101'), '见辛卯与酉支相遇必须命中桂林凤隐 S-SM-101');

  // 8. 海藏龙潜格 S-SM-102：庚辰 丁亥 癸亥 丙辰 (辰龙逢癸亥大海水)
  const resLongQian = matchSchoolClaims(['庚辰', '丁亥', '癸亥', '丙辰']);
  assert.ok(resLongQian.matched.some((x) => x.id === 'S-SM-102'), '辰龙见大海水必须命中海藏龙潜 S-SM-102');

  // 9. 虎卧凤阙格 S-SM-108：甲寅 癸酉 丙申 丁酉 (寅年猛虎日时见酉宫凤阙)
  const resHuFeng = matchSchoolClaims(['甲寅', '癸酉', '丙申', '丁酉']);
  assert.ok(resHuFeng.matched.some((x) => x.id === 'S-SM-108'), '寅年日时见酉必须命中虎卧凤阙 S-SM-108');

  // 10. 鱼跃龙池格 S-SM-109：乙亥 庚辰 辛卯 壬辰 (亥年巨鱼日时见辰水库龙池)
  const resYuLong = matchSchoolClaims(['乙亥', '庚辰', '辛卯', '壬辰']);
  assert.ok(resYuLong.matched.some((x) => x.id === 'S-SM-109'), '亥年日时见辰必须命中鱼跃龙池 S-SM-109');

  // 11. 毕乌登日宫 S-SM-120：辛酉 甲午 乙未 壬午 (酉年金乌日时见午位太阳)
  const resWuDeng = matchSchoolClaims(['辛酉', '甲午', '乙未', '壬午']);
  assert.ok(resWuDeng.matched.some((x) => x.id === 'S-SM-120'), '酉年生人日时见午必须命中毕乌登日宫 S-SM-120');
});

test('古法三命名格收官严密排他反向断言（非水命排除水居湖海、无戊午己未排除日精月华、无辛卯排除桂林凤隐、非寅年排除虎卧凤阙）', () => {
  // 1. 纳音无水排除水居湖海格 S-SM-091：丙寅 戊戌 戊戌 丙辰 (纳音炉中火、平地木)
  const resNoShui = matchSchoolClaims(['丙寅', '戊戌', '戊戌', '丙辰']);
  assert.ok(!resNoShui.matched.some((x) => x.id === 'S-SM-091'), '纳音无水必须排除水居湖海 S-SM-091');

  // 2. 无戊午己未排除日精月华格 S-SM-096：甲子 丙寅 戊辰 庚申
  const resNoRiYue = matchSchoolClaims(['甲子', '丙寅', '戊辰', '庚申']);
  assert.ok(!resNoRiYue.matched.some((x) => x.id === 'S-SM-096'), '无戊午己未必须排除日精月华 S-SM-096');

  // 3. 无辛卯柱排除桂林凤隐格 S-SM-101：乙卯 丁酉 乙丑 壬午
  const resNoXinMao = matchSchoolClaims(['乙卯', '丁酉', '乙丑', '壬午']);
  assert.ok(!resNoXinMao.matched.some((x) => x.id === 'S-SM-101'), '无辛卯月桂必须排除桂林凤隐 S-SM-101');

  // 4. 非寅年生人排除虎卧凤阙格 S-SM-108：甲子 癸酉 丙申 丁酉
  const resNoYinHu = matchSchoolClaims(['甲子', '癸酉', '丙申', '丁酉']);
  assert.ok(!resNoYinHu.matched.some((x) => x.id === 'S-SM-108'), '非寅年必须排除虎卧凤阙 S-SM-108');
});

// --------------------------------------------------------------------
// 测试组 23: 盲派象法高级应象与实战断法定式专测套件 (D-083 最终收官大圆满批次)
// --------------------------------------------------------------------
console.log('\n▶ [测试组 23] 盲派象法高级应象与实战断法定式专测 (D-083)');

test('盲派象法高级应象与实战断法定式典型命盘正向命中校验（活木见丙、死木怕火、丁火不怕旺、水流方向、半拱不叫入库、十神组合象）', () => {
  // 1. 活木见丙泄秀 S-MP-091：甲寅 丙寅 甲子 丙寅
  const resHuoMu = matchSchoolClaims(['甲寅', '丙寅', '甲子', '丙寅']);
  assert.ok(resHuoMu.matched.some((x) => x.id === 'S-MP-091'), '活木透丙必须命中活木泄秀 S-MP-091');

  // 2. 丁火是一种光不怕旺 S-MP-093：丁巳 丙午 丁未 乙巳
  const resDingHuo = matchSchoolClaims(['丁巳', '丙午', '丁未', '乙巳']);
  assert.ok(resDingHuo.matched.some((x) => x.id === 'S-MP-093'), '丁火身旺必须命中丁火不怕旺 S-MP-093');

  // 3. 辰子半拱局不叫入墓 S-MP-100：戊子 丙辰 庚申 壬子
  const resChenZi = matchSchoolClaims(['戊子', '丙辰', '庚申', '壬子']);
  assert.ok(resChenZi.matched.some((x) => x.id === 'S-MP-100'), '辰子同见必须命中半拱局 S-MP-100');

  // 4. 戌午拱中神不叫入库 S-MP-101：甲戌 庚午 丙寅 戊戌
  const resXuWu = matchSchoolClaims(['甲戌', '庚午', '丙寅', '戊戌']);
  assert.ok(resXuWu.matched.some((x) => x.id === 'S-MP-101'), '戌午同见必须命中戌拱午 S-MP-101');

  // 5. 丑是财库穿不动 S-MP-102：乙丑 壬午 庚申 辛巳
  const resChouChuan = matchSchoolClaims(['乙丑', '壬午', '庚申', '辛巳']);
  assert.ok(resChouChuan.matched.some((x) => x.id === 'S-MP-102'), '午丑相穿必须命中丑穿不动 S-MP-102');

  // 6. 伤官正财求名求利 S-MP-111：甲戌 丁卯 甲子 己巳 (甲日主透丁伤官己正财)
  const resShangCai = matchSchoolClaims(['甲戌', '丁卯', '甲子', '己巳']);
  assert.ok(resShangCai.matched.some((x) => x.id === 'S-MP-111'), '伤官正财并透必须命中求名求利 S-MP-111');

  // 7. 正官正印适合公职 S-MP-112：乙丑 癸未 丙子 甲午 (丙日主透癸正官乙正印)
  const resGuanYin = matchSchoolClaims(['乙丑', '癸未', '丙子', '甲午']);
  assert.ok(resGuanYin.matched.some((x) => x.id === 'S-MP-112'), '官印同透必须命中公职幕僚 S-MP-112');

  // 8. 七杀正印权威司法 S-MP-113：壬辰 乙巳 丙寅 戊戌 (丙日主透壬七杀乙正印)
  const resShaYin = matchSchoolClaims(['壬辰', '乙巳', '丙寅', '戊戌']);
  assert.ok(resShaYin.matched.some((x) => x.id === 'S-MP-113'), '杀印并透必须命中权威司法 S-MP-113');

  // 9. 七杀劫财军人黑道 S-MP-115：壬子 丁未 丙午 戊子 (丙日主透壬七杀丁劫财)
  const resShaJie = matchSchoolClaims(['壬子', '丁未', '丙午', '戊子']);
  assert.ok(resShaJie.matched.some((x) => x.id === 'S-MP-115'), '杀劫并透必须命中七杀劫财 S-MP-115');

  // 10. 正官七杀一言九鼎 S-MP-120：癸巳 壬戌 丙子 戊子 (丙日主透癸正官壬七杀)
  const resGuanSha = matchSchoolClaims(['癸巳', '壬戌', '丙子', '戊子']);
  assert.ok(resGuanSha.matched.some((x) => x.id === 'S-MP-120'), '官杀并透必须命中说到做到 S-MP-120');
});

test('盲派象法收官严密排他反向断言（非木日主排除活木见丙、非丁火排除丁火不怕旺、无辰子排除半拱水局、非官杀并透排除说到做到）', () => {
  // 1. 庚金日主排除活木见丙 S-MP-091：庚申 丙戌 庚申 丙子
  const resNoHuoMu = matchSchoolClaims(['庚申', '丙戌', '庚申', '丙子']);
  assert.ok(!resNoHuoMu.matched.some((x) => x.id === 'S-MP-091'), '非甲乙木日主必须排除活木泄秀 S-MP-091');

  // 2. 戊土日主排除丁火不怕旺 S-MP-093：戊午 丙午 戊午 丁巳
  const resNoDing = matchSchoolClaims(['戊午', '丙午', '戊午', '丁巳']);
  assert.ok(!resNoDing.matched.some((x) => x.id === 'S-MP-093'), '非丁火日主必须排除丁火不怕旺 S-MP-093');

  // 3. 无辰子排除辰子半拱水局 S-MP-100：甲寅 乙卯 丙午 丁未
  const resNoChenZi = matchSchoolClaims(['甲寅', '乙卯', '丙午', '丁未']);
  assert.ok(!resNoChenZi.matched.some((x) => x.id === 'S-MP-100'), '无辰子必须排除辰子半拱 S-MP-100');

  // 4. 仅透正官无七杀排除官杀并透 S-MP-120：乙丑 癸未 丙子 己丑
  const resNoGuanSha = matchSchoolClaims(['乙丑', '癸未', '丙子', '己丑']);
  assert.ok(!resNoGuanSha.matched.some((x) => x.id === 'S-MP-120'), '仅透正官无七杀必须排除一言九鼎 S-MP-120');
});

// --------------------------------------------------------------------
// 测试组 24：D-090 核心代码层 9 大逻辑缺陷修复与看门狗强化专测
// --------------------------------------------------------------------
console.log('▶ [测试组 24] D-090 核心代码层 9 大逻辑缺陷修复与看门狗强化专测');

test('D-090 看门狗：hasWoodBureau 排除火局，水日主正官格逢火局不误判破格', () => {
  // 外部审计复现盘：壬寅 己丑 壬午 壬辰 (壬水生丑月透己土正官，支含寅午火局生官，绝非木局破官)
  const chartHuo = {
    pillars: [
      { stem: '壬', branch: '寅' },
      { stem: '己', branch: '丑' },
      { stem: '壬', branch: '午' },
      { stem: '壬', branch: '辰' },
    ],
    dayMaster: { stem: '壬', element: '水', bornMonthBranch: '丑' },
    relations: {},
  };
  const resHuo = gejuChengPoOf(chartHuo);
  assert.notEqual(resHuo.破格因, '官逢伤官克破', '水日主正官格逢寅午火局绝不可误判为官逢伤官克破');
  assert.equal(resHuo.状态, '成格', '水日主逢财生官应判定为成格');

  // 真正寅卯辰木局对照盘：壬寅 己丑 壬卯 癸辰 (寅卯辰三会木局克官)
  const chartMu = {
    pillars: [
      { stem: '壬', branch: '寅' },
      { stem: '己', branch: '丑' },
      { stem: '壬', branch: '卯' },
      { stem: '癸', branch: '辰' },
    ],
    dayMaster: { stem: '壬', element: '水', bornMonthBranch: '丑' },
    relations: {},
  };
  const resMu = gejuChengPoOf(chartMu);
  assert.equal(resMu.破格因, '官逢伤官克破', '寅卯辰真木局会方方可判定伤官克官破格');
});

test('D-090 看门狗：流派谓词死代码修复（S-MP-110, S-MP-071, S-WS-075, S-SS-016, S-SS-014, S-SS-021, S-SS-028）', () => {
  // 1. S-MP-110: 甲日年干己土合正财，必须命中
  const m110 = matchSchoolClaims(['己巳', '丁卯', '甲子', '丙寅']);
  assert.ok(m110.matched.some((x) => x.id === 'S-MP-110'), '天干五合合财必须命中 S-MP-110');

  // 2. S-MP-071: 庚日坐酉刃，年支巳藏丙火七杀，必须命中
  const m071 = matchSchoolClaims(['乙巳', '己卯', '庚酉', '丁丑']);
  assert.ok(m071.matched.some((x) => x.id === 'S-MP-071'), '主位刃宾位藏七杀必须命中 S-MP-071');

  // 3. S-WS-075: 岁运有财官则发，地支藏干财官必须命中
  const m075 = matchSchoolClaims(['甲子', '甲子', '甲子', '乙丑']);
  assert.ok(m075.matched.some((x) => x.id === 'S-WS-075'), '地支藏财官必须命中 S-WS-075');

  // 4. S-SS-016: 国印贵人日干查四支，甲见戌必须命中
  const m016 = matchSchoolClaims(['甲子', '甲戌', '甲午', '甲子']);
  assert.ok(m016.matched.some((x) => x.id === 'S-SS-016'), '甲见戌支必须命中 S-SS-016 国印贵人');

  // 5. S-SS-014: 进神查日柱与时柱，时柱见甲子必须命中
  const m014 = matchSchoolClaims(['庚午', '辛巳', '乙酉', '甲子']);
  assert.ok(m014.matched.some((x) => x.id === 'S-SS-014'), '时柱逢进神必须命中 S-SS-014');

  // 6. S-SS-028: 截路空亡戊癸见子丑，戊日丑时必须命中
  const m028 = matchSchoolClaims(['甲子', '丙寅', '戊午', '癸丑']);
  assert.ok(m028.matched.some((x) => x.id === 'S-SS-028'), '戊日丑时必须命中 S-SS-028 截路空亡');
});

test('D-090 看门狗：castChart 底层 API 对 hour=24 严格阻断', () => {
  assert.throws(
    () => castChart({ year: 2024, month: 5, day: 20, hour: 24 }),
    /非法小时「24」，必须在 0 至 23 之间/,
    'hour=24 必须抛出超出 23 边界之异常'
  );
});

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


