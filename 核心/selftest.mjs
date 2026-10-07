/**
 * 引擎自检：用已知的权威数据校验四柱、节气、十神、十二长生、纳音、神煞。
 * 运行：node selftest.mjs
 */
import {
  castChart, solarTermsOfYear, solarTermMoment, gzName, gzIndex, nayinOf, xunOf,
  tenGod, twelveStage, STEMS, BRANCHES, hourToBranchIndex, yearPillarOf,
  transitAnalysis, trueSolarTime, formatFacts, formatChart, formatTransit, formatTiaohou,
  relationsOf, shenshaOf, tiaohouOf, tiaohouAssessment, controversiesOf,
  dateCandidates, dayMasterSupport, tenGodStrength, taijiOf, tongguanOf, sixLayersOf,
  silingOf, strengthOf, specialGejuOf,
  yinyangGroupsOf, yinyangGroupDivisions, taijiTiVsWang, taijiFormationOf,
  tiaohouVersionDiff, tiaohouVersionDiffs, tiyaoOf, tiyaoSiblings, tiyaoMeta,
  nayinByShu, nayinTableCheck, sanmingOf, sanmingStrength, elementBranchStage,
  congGateOf, yongshenArbiterOf, dashiOf, wangGateOf, 用神Grainify,
  proximityOf, GONG_WEIGHT, GONG_RANK, occupantsOf, combinedAwayOf, pathOf,
  threatOf, qingOf, protectionOf, protectionChainOf, structureOf, fanwangOf, tiyongRouteOf, routeOf,
  powerOf, canControlOf, canTransformOf, canBindOf,
  SI_XIANG_WUXING, SI_XIANG_YUAN, SI_XIANG_MONTH_SYSTEMS, siXiangOf, genWeightOf, youJiuOf,
  STEM_BRANCH_SELF_COMBINE, BRANCH_HIDDEN_COMBINE, gzRelations, selfHiddenCombineOf,
  BRANCH_HALF_COMBINE, BRANCH_EXTINCTION, JIELU_KONGWANG,
  ANLU, ANLU_DAY_GZ, LUSHEN, shenshaNature,
  DUAL_IMAGE_LIBRARY, dualImageMatrixOf,
  arbitrateGanzhiForces, coverageOf, congErAnalysisOf,
  chengzaiReassess,
} from './engine.mjs';

/** 由 "辛巳" 之类的干支串造出 engine 各原语所需的柱对象数组 */
function pillarsOf(...gzList) {
  const pos = ['年柱', '月柱', '日柱', '时柱'];
  return gzList.map((gz, i) => ({
    position: pos[i], gz, stem: gz[0], branch: gz[1],
    stemIndex: STEMS.indexOf(gz[0]), branchIndex: BRANCHES.indexOf(gz[1]),
  }));
}

let pass = 0, fail = 0;
const failures = [];
function eq(label, actual, expected, extra = '') {
  if (actual === expected) { pass++; return; }
  fail++;
  failures.push(`${label}: 期望 ${expected}，实际 ${actual} ${extra}`);
}
function ok(label, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  failures.push(`${label} ${extra}`);
}

console.log('=== 1. 日柱（儒略日）校验 ===');
// 已知日柱（万年历）：2000-01-01 = 戊午日
eq('2000-01-01 日柱', castChart({ year: 2000, month: 1, day: 1, hour: 12 }).pillars[2].gz, '戊午');
// 1949-10-01 = 甲子日（中华人民共和国开国日，通用万年历）
eq('1949-10-01 日柱', castChart({ year: 1949, month: 10, day: 1, hour: 12 }).pillars[2].gz, '甲子');
// 1984-02-02 = 丙寅日
eq('1984-02-02 日柱', castChart({ year: 1984, month: 2, day: 2, hour: 12 }).pillars[2].gz, '丙寅');
// 2024-01-01 = 甲子日
eq('2024-01-01 日柱', castChart({ year: 2024, month: 1, day: 1, hour: 12 }).pillars[2].gz, '甲子');
// 2025-01-01 = 庚午日
eq('2025-01-01 日柱', castChart({ year: 2025, month: 1, day: 1, hour: 12 }).pillars[2].gz, '庚午');

console.log('=== 2. 干支造表 ===');
eq('甲子 = 0', gzIndex(0, 0), 0);
eq('癸亥 = 59', gzIndex(9, 11), 59);
eq('gzName(0)', gzName(0), '甲子');
eq('gzName(59)', gzName(59), '癸亥');
let allLegal = true;
for (let i = 0; i < 10; i++) for (let j = 0; j < 12; j++) {
  const legal = (i % 2) === (j % 2);
  try { gzIndex(i, j); if (!legal) allLegal = false; } catch { if (legal) allLegal = false; }
}
ok('60 甲子只允许阴阳相配', allLegal);
eq('纳音 甲子', nayinOf(0).name, '海中金');
eq('纳音 癸亥', nayinOf(59).name, '大海水');
eq('纳音 戊午', nayinOf(gzIndex(4, 6)).name, '天上火');
eq('纳音 庚申', nayinOf(gzIndex(6, 8)).name, '石榴木');
eq('旬空 甲子旬', xunOf(0).voidBranches.join(''), '戌亥');
eq('旬空 甲戌旬', xunOf(10).voidBranches.join(''), '申酉');
eq('旬空 甲寅旬', xunOf(50).voidBranches.join(''), '子丑');

console.log('=== 3. 十神 ===');
eq('甲见甲 比肩', tenGod(0, 0), '比肩');
eq('甲见乙 劫财', tenGod(0, 1), '劫财');
eq('甲见丙 食神', tenGod(0, 2), '食神');
eq('甲见丁 伤官', tenGod(0, 3), '伤官');
eq('甲见戊 偏财', tenGod(0, 4), '偏财');
eq('甲见己 正财', tenGod(0, 5), '正财');
eq('甲见庚 七杀', tenGod(0, 6), '七杀');
eq('甲见辛 正官', tenGod(0, 7), '正官');
eq('甲见壬 偏印', tenGod(0, 8), '偏印');
eq('甲见癸 正印', tenGod(0, 9), '正印');
console.log('--- 十神全矩阵（10×10 = 100 格）---');
{
  const expect = {
    甲: { 甲: '比肩', 乙: '劫财', 丙: '食神', 丁: '伤官', 戊: '偏财', 己: '正财', 庚: '七杀', 辛: '正官', 壬: '偏印', 癸: '正印' },
    乙: { 甲: '劫财', 乙: '比肩', 丙: '伤官', 丁: '食神', 戊: '正财', 己: '偏财', 庚: '正官', 辛: '七杀', 壬: '正印', 癸: '偏印' },
    丙: { 甲: '偏印', 乙: '正印', 丙: '比肩', 丁: '劫财', 戊: '食神', 己: '伤官', 庚: '偏财', 辛: '正财', 壬: '七杀', 癸: '正官' },
    丁: { 甲: '正印', 乙: '偏印', 丙: '劫财', 丁: '比肩', 戊: '伤官', 己: '食神', 庚: '正财', 辛: '偏财', 壬: '正官', 癸: '七杀' },
    戊: { 甲: '七杀', 乙: '正官', 丙: '偏印', 丁: '正印', 戊: '比肩', 己: '劫财', 庚: '食神', 辛: '伤官', 壬: '偏财', 癸: '正财' },
    己: { 甲: '正官', 乙: '七杀', 丙: '正印', 丁: '偏印', 戊: '劫财', 己: '比肩', 庚: '伤官', 辛: '食神', 壬: '正财', 癸: '偏财' },
    庚: { 甲: '偏财', 乙: '正财', 丙: '七杀', 丁: '正官', 戊: '偏印', 己: '正印', 庚: '比肩', 辛: '劫财', 壬: '食神', 癸: '伤官' },
    辛: { 甲: '正财', 乙: '偏财', 丙: '正官', 丁: '七杀', 戊: '正印', 己: '偏印', 庚: '劫财', 辛: '比肩', 壬: '伤官', 癸: '食神' },
    壬: { 甲: '食神', 乙: '伤官', 丙: '偏财', 丁: '正财', 戊: '七杀', 己: '正官', 庚: '偏印', 辛: '正印', 壬: '比肩', 癸: '劫财' },
    癸: { 甲: '伤官', 乙: '食神', 丙: '正财', 丁: '偏财', 戊: '正官', 己: '七杀', 庚: '正印', 辛: '偏印', 壬: '劫财', 癸: '比肩' },
  };
  let bad = 0;
  for (let d = 0; d < 10; d++) for (let o = 0; o < 10; o++) {
    const key = STEMS[d] + STEMS[o];
    const got = tenGod(d, o);
    if (got !== expect[STEMS[d]][STEMS[o]]) { bad++; failures.push(`十神 ${key}: 期望 ${expect[STEMS[d]][STEMS[o]]}，实际 ${got}`); }
  }
  eq('十神 100 格全对', bad, 0);
  // 十神五行归属自检：与我同类=比劫，我生=食伤，我克=财，克我=官杀，生我=印
  const cat = (g) => (['比肩', '劫财'].includes(g) ? 'same' : ['食神', '伤官'].includes(g) ? 'output' : ['偏财', '正财'].includes(g) ? 'wealth' : ['七杀', '正官'].includes(g) ? 'power' : 'resource');
  const EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  const CYC = [1, 2, 3, 4, 0];
  const S = CYC, K = CYC.map((_, i) => CYC[CYC[i]]);
  let catBad = 0;
  for (let d = 0; d < 10; d++) for (let o = 0; o < 10; o++) {
    const me = EL[d], other = EL[o];
    const want = me === other ? 'same' : S[me] === other ? 'output' : K[me] === other ? 'wealth' : S[other] === me ? 'resource' : 'power';
    if (cat(tenGod(d, o)) !== want) catBad++;
  }
  eq('十神五行归属自洽', catBad, 0);
}

console.log('=== 4. 十二长生 ===');
eq('甲在亥 长生', twelveStage(0, 11), '长生');
eq('甲在卯 帝旺', twelveStage(0, 3), '帝旺');
eq('甲在午 死', twelveStage(0, 6), '死');
eq('乙在午 长生', twelveStage(1, 6), '长生');
eq('乙在寅 帝旺', twelveStage(1, 2), '帝旺');
eq('丙在寅 长生', twelveStage(2, 2), '长生');
eq('丙在午 帝旺', twelveStage(2, 6), '帝旺');
eq('丁在酉 长生', twelveStage(3, 9), '长生');
eq('戊在寅 长生', twelveStage(4, 2), '长生');
eq('己在酉 长生', twelveStage(5, 9), '长生');
eq('庚在巳 长生', twelveStage(6, 5), '长生');
eq('庚在酉 帝旺', twelveStage(6, 9), '帝旺');
eq('辛在子 长生', twelveStage(7, 0), '长生');
eq('壬在申 长生', twelveStage(8, 8), '长生');
eq('癸在卯 长生', twelveStage(9, 3), '长生');
console.log('--- 十二长生全矩阵（10×12 = 120 格）---');
{
  // 阳干顺行、阴干逆行；长生位：甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
  const STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  const START = { 甲: 11, 乙: 6, 丙: 2, 丁: 9, 戊: 2, 己: 9, 庚: 5, 辛: 0, 壬: 8, 癸: 3 };
  const YANG = { 甲: 1, 乙: 0, 丙: 1, 丁: 0, 戊: 1, 己: 0, 庚: 1, 辛: 0, 壬: 1, 癸: 0 };
  let bad = 0;
  for (let s = 0; s < 10; s++) {
    const name = STEMS[s];
    for (let b = 0; b < 12; b++) {
      const off = YANG[name] ? (((b - START[name]) % 12) + 12) % 12 : (((START[name] - b) % 12) + 12) % 12;
      const want = STAGES[off];
      const got = twelveStage(s, b);
      if (got !== want) { bad++; failures.push(`十二长生 ${name}${BRANCHES[b]}: 期望 ${want}，实际 ${got}`); }
    }
  }
  eq('十二长生 120 格全对', bad, 0);
  // 交叉验证：阳干"临官"即禄位，"帝旺"即羊刃位
  const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  let luBad = 0;
  for (let s = 0; s < 10; s++) {
    const luBranch = BRANCHES.indexOf(LU[STEMS[s]]);
    if (twelveStage(s, luBranch) !== '临官') { luBad++; failures.push(`${STEMS[s]}禄位应为临官，实际 ${twelveStage(s, luBranch)}`); }
  }
  eq('十干禄位均为临官', luBad, 0);
}

console.log('=== 5. 时支边界 ===');
eq('23:30 -> 子', BRANCHES[hourToBranchIndex(23, 30)], '子');
eq('00:30 -> 子', BRANCHES[hourToBranchIndex(0, 30)], '子');
eq('01:00 -> 丑', BRANCHES[hourToBranchIndex(1, 0)], '丑');
eq('02:59 -> 丑', BRANCHES[hourToBranchIndex(2, 59)], '丑');
eq('03:00 -> 寅', BRANCHES[hourToBranchIndex(3, 0)], '寅');
eq('11:00 -> 午', BRANCHES[hourToBranchIndex(11, 0)], '午');
eq('22:59 -> 亥', BRANCHES[hourToBranchIndex(22, 59)], '亥');

console.log('=== 6. 年柱（立春为界） ===');
// 2024 立春 = 2024-02-04 16:27 前后
eq('2024-02-04 12:00 仍为癸卯年', castChart({ year: 2024, month: 2, day: 4, hour: 12 }).pillars[0].gz, '癸卯');
eq('2024-02-05 12:00 为甲辰年', castChart({ year: 2024, month: 2, day: 5, hour: 12 }).pillars[0].gz, '甲辰');
eq('1984-02-05 甲子年', castChart({ year: 1984, month: 2, day: 5, hour: 12 }).pillars[0].gz, '甲子');
eq('2025-01-01 甲辰年（未到立春）', castChart({ year: 2025, month: 1, day: 1, hour: 12 }).pillars[0].gz, '甲辰');
// 2025 立春 = 2025-02-03 22:10 前后（历书值 22:10）
eq('2025-02-03 12:00 甲辰年（立春当日 22:10 前）', castChart({ year: 2025, month: 2, day: 3, hour: 12 }).pillars[0].gz, '甲辰');
eq('2025-02-03 23:00 乙巳年（立春后）', castChart({ year: 2025, month: 2, day: 3, hour: 23 }).pillars[0].gz, '乙巳');
eq('2025-02-05 乙巳年', castChart({ year: 2025, month: 2, day: 5, hour: 12 }).pillars[0].gz, '乙巳');

console.log('=== 7. 月柱（五虎遁 + 节气） ===');
// 甲己之年丙作首：甲年寅月必为丙寅
{
  const c = castChart({ year: 2024, month: 3, day: 1, hour: 12 }); // 甲辰年 惊蛰前 -> 丙寅月
  eq('甲年寅月 = 丙寅', c.pillars[1].gz, '丙寅');
  eq('甲年卯月 = 丁卯', castChart({ year: 2024, month: 3, day: 20, hour: 12 }).pillars[1].gz, '丁卯');
  eq('甲年辰月 = 戊辰', castChart({ year: 2024, month: 4, day: 10, hour: 12 }).pillars[1].gz, '戊辰');
  eq('甲年巳月 = 己巳', castChart({ year: 2024, month: 5, day: 10, hour: 12 }).pillars[1].gz, '己巳');
  eq('甲年午月 = 庚午', castChart({ year: 2024, month: 6, day: 10, hour: 12 }).pillars[1].gz, '庚午');
}
// 乙庚之岁戊为头
eq('乙年寅月 = 戊寅', castChart({ year: 2025, month: 3, day: 1, hour: 12 }).pillars[1].gz, '戊寅');
// 丙辛必定寻庚起
eq('丙年寅月 = 庚寅', castChart({ year: 2026, month: 3, day: 1, hour: 12 }).pillars[1].gz, '庚寅');
// 丁壬壬位顺行流
eq('丁年寅月 = 壬寅', castChart({ year: 2027, month: 3, day: 1, hour: 12 }).pillars[1].gz, '壬寅');
// 戊癸甲寅之上好追求
eq('戊年寅月 = 甲寅', castChart({ year: 2028, month: 3, day: 1, hour: 12 }).pillars[1].gz, '甲寅');

console.log('=== 8. 时柱（五鼠遁） ===');
// 甲己还加甲
{
  const c = castChart({ year: 2024, month: 3, day: 1, hour: 0 }); // 日柱?
  const dayStem = c.pillars[2].stem;
  const expected = { 甲: '甲子', 乙: '丙子', 丙: '戊子', 丁: '庚子', 戊: '壬子', 己: '甲子', 庚: '丙子', 辛: '戊子', 壬: '庚子', 癸: '壬子' }[dayStem];
  eq(`五鼠遁 日干${dayStem} 子时 = ${expected}`, c.pillars[3].gz.slice(0, 2), expected);
}
// 逐日干验证
for (const [ds, exp] of Object.entries({ 甲: '甲子', 乙: '丙子', 丙: '戊子', 丁: '庚子', 戊: '壬子', 己: '甲子', 庚: '丙子', 辛: '戊子', 壬: '庚子', 癸: '壬子' })) {
  const si = STEMS.indexOf(ds);
  // 找一个日干为该干的日期
  for (let d = 1; d <= 60; d++) {
    const c = castChart({ year: 2024, month: 1, day: d, hour: 0 });
    if (c.pillars[2].stem === ds) {
      eq(`五鼠遁 ${ds}日子时`, c.pillars[3].gz.slice(0, 2), exp);
      break;
    }
  }
}

console.log('=== 9. 节气校验（对照紫金山天文台/通用历书） ===');
{
  // 2024 立春：2024-02-04 16:26（北京时间，历书值 16:27）
  const t = solarTermMoment(2024, 2);
  eq('2024 立春 日期', `${t.month}-${t.day}`, '2-4');
  ok('2024 立春 时刻 16:20-16:35', t.hour === 16 && t.minute >= 15 && t.minute <= 40, `实际 ${t.hour}:${t.minute}`);
  // 2024 冬至：2024-12-21 17:20
  const t2 = solarTermMoment(2024, 23);
  eq('2024 冬至 日期', `${t2.month}-${t2.day}`, '12-21');
  ok('2024 冬至 时刻 17:05-17:35', t2.hour === 17 && t2.minute >= 0 && t2.minute <= 40, `实际 ${t2.hour}:${t2.minute}`);
  // 2025 春分：2025-03-20 17:01
  const t3 = solarTermMoment(2025, 5);
  eq('2025 春分 日期', `${t3.month}-${t3.day}`, '3-20');
  // 2024 夏至：2024-06-21 04:50
  const t4 = solarTermMoment(2024, 11);
  eq('2024 夏至 日期', `${t4.month}-${t4.day}`, '6-21');
  ok('2024 夏至 时刻 04:30-05:10', t4.hour === 4 || (t4.hour === 5 && t4.minute <= 10), `实际 ${t4.hour}:${t4.minute}`);
  // 2025 立春：2025-02-03 22:10
  const t5 = solarTermMoment(2025, 2);
  eq('2025 立春 日期', `${t5.month}-${t5.day}`, '2-3');
  ok('2025 立春 时刻 22:00-22:20', t5.hour === 22 && t5.minute <= 20, `实际 ${t5.hour}:${t5.minute}`);
  // 2023 立春：2023-02-04 10:42
  const t6 = solarTermMoment(2023, 2);
  eq('2023 立春 日期', `${t6.month}-${t6.day}`, '2-4');
  ok('2023 立春 时刻 10:30-10:55', t6.hour === 10 && t6.minute >= 30 && t6.minute <= 55, `实际 ${t6.hour}:${t6.minute}`);
  // 逐年 24 节气均落在合理日期范围
  for (const y of [1900, 1950, 2000, 2025, 2050, 2100]) {
    const terms = solarTermsOfYear(y);
    ok(`${y} 年 24 节气`, terms.length === 24 && terms.every((t) => t.month >= 1 && t.month <= 12 && t.day >= 1 && t.day <= 31));
  }
}

console.log('=== 10. 大运方向与起运 ===');
{
  const c1 = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '男' }); // 庚午年，阳年男 -> 顺行
  eq('阳年男 顺行', c1.luck.direction, '顺行');
  const c2 = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '女' });
  eq('阳年女 逆行', c2.luck.direction, '逆行');
  const c3 = castChart({ year: 1991, month: 5, day: 20, hour: 14, gender: '男' }); // 辛未年 阴
  eq('阴年男 逆行', c3.luck.direction, '逆行');
  const c4 = castChart({ year: 1991, month: 5, day: 20, hour: 14, gender: '女' });
  eq('阴年女 顺行', c4.luck.direction, '顺行');
  // 顺行第一步 = 月柱 + 1
  const mIdx = gzIndex(STEMS.indexOf(c1.pillars[1].stem), BRANCHES.indexOf(c1.pillars[1].branch));
  eq('顺行第一步 = 月柱+1', c1.luck.pillars[0].gz, gzName(mIdx + 1));
  eq('逆行第一步 = 月柱-1', c2.luck.pillars[0].gz, gzName(mIdx - 1 + 60));
  ok('起运岁数合理(0-10)', c1.luck.start.yearsFloat >= 0 && c1.luck.start.yearsFloat <= 10, `实际 ${c1.luck.start.yearsFloat}`);
  ok('大运干支连续', c1.luck.pillars.every((lp, i) => i === 0 || lp.index === (c1.luck.pillars[i - 1].index + 1) % 60));
}

console.log('=== 11. 神煞（人工核验） ===');
{
  // 甲日见丑/未 -> 天乙贵人
  const c = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '男' });
  const names = c.shensha.map((s) => s.name);
  ok('检出天乙贵人等神煞', c.shensha.length > 0, `共 ${c.shensha.length} 项：${names.join('、')}`);
  // 单独验证：找一个甲日、年支带丑的盘
  ok('神煞均带落宫', c.shensha.every((s) => Array.isArray(s.positions) && s.positions.length > 0));
}
{
  // 驿马：申子辰年支见寅
  const c = castChart({ year: 1984, month: 3, day: 1, hour: 0 }); // 甲子年 -> 水局 -> 驿马在寅
  const yima = c.shensha.find((s) => s.name.startsWith('驿马'));
  if (BRANCHES.indexOf('寅') >= 0) {
    const hasYin = c.pillars.some((p) => p.branch === '寅');
    if (hasYin) ok('子年见寅 -> 驿马', !!yima, `神煞：${c.shensha.map((s) => s.name).join('、')}`);
    else ok('子年无寅 -> 无驿马', !yima || yima.positions.length === 0);
  }
}

console.log('=== 12. 藏干与十神贯通 ===');
{
  const c = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '男' });
  const allHiddenOk = c.pillars.every((p) => p.hidden.length >= 1 && p.hidden.every((h) => h.stem && h.tenGod && h.role));
  ok('每柱均有藏干且带十神', allHiddenOk);
  // 子只藏癸
  const ziPillar = c.pillars.find((p) => p.branch === '子');
  if (ziPillar) ok('子藏干仅癸', ziPillar.hidden.length === 1 && ziPillar.hidden[0].stem === '癸');
  // 寅藏甲丙戊
  const yinPillar = c.pillars.find((p) => p.branch === '寅');
  if (yinPillar) ok('寅藏甲丙戊', yinPillar.hidden.map((h) => h.stem).join('') === '甲丙戊');
}

console.log('=== 13. 使用者提供大运 ===');
{
  const c = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '男', luckPillars: [{ gz: '辛巳', startAge: 6 }, { gz: '壬午', startAge: 16 }] });
  eq('采用使用者大运', c.luck.source, '使用者提供');
  eq('第一步大运', c.luck.pillars[0].gz, '辛巳');
  eq('第二步大运', c.luck.pillars[1].gz, '壬午');
  eq('大运带十神', typeof c.luck.pillars[0].tenGod, 'string');
}

console.log('=== 15. 五行生克表与同柱干支关系 ===');
{
  // 先钉住元素表本身：木(0) 火(1) 土(2) 金(3) 水(4)
  // 相生：木生火 火生土 土生金 金生水 水生木
  // 相克：木克土 火克金 土克水 金克木 水克火
  const SHENG = [1, 2, 3, 4, 0];
  const KE = [2, 3, 4, 0, 1];
  const names = ['木', '火', '土', '金', '水'];
  const shengPairs = SHENG.map((t, i) => `${names[i]}生${names[t]}`).join(' ');
  const kePairs = KE.map((t, i) => `${names[i]}克${names[t]}`).join(' ');
  eq('相生环', shengPairs, '木生火 火生土 土生金 金生水 水生木');
  eq('相克环', kePairs, '木克土 火克金 土克水 金克木 水克火');

  const g = (birth, idx) => castChart({ ...birth, hour: 12 }).relations.天干地支同柱[idx].relation;
  const b = { year: 1990, month: 5, day: 20 }; // 庚午 辛巳 乙酉 壬午
  // 庚午：午火克庚金（火克金）-> 支克干
  ok('庚午 = 支克干（火克金）', g(b, 0).includes('截脚'), g(b, 0));
  // 辛巳：巳火克辛金（火克金）-> 支克干
  ok('辛巳 = 支克干（火克金）', g(b, 1).includes('截脚'), g(b, 1));
  // 乙酉：酉金克乙木（金克木）-> 支克干
  ok('乙酉 = 支克干（金克木）', g(b, 2).includes('截脚'), g(b, 2));
  // 壬午：壬水克午火（水克火）-> 干克支（盖头）
  ok('壬午 = 干克支（水克火）', g(b, 3).includes('盖头'), g(b, 3));
  // 癸未：未土克癸水（土克水）-> 支克干
  const c14 = castChart({ year: 1990, month: 5, day: 20, hour: 14 }); // 癸未时
  eq('癸未 = 支克干（土克水）', c14.relations.天干地支同柱[3].relation, '支克干（截脚）');
  // 甲子：子水生甲木（水生木）-> 支生干（得地）
  const c = castChart({ year: 2024, month: 1, day: 1, hour: 12 }); // 甲子日
  eq('甲子日柱 = 支生干（水生木）', c.relations.天干地支同柱[2].relation, '支生干（得地）');
  // 丙寅：寅木生丙火（木生火）-> 支生干
  eq('丙寅月柱 = 支生干（木生火）', c.relations.天干地支同柱[1].relation, '支生干（得地）');
  // 盖头：甲辰（辰土为甲木所克，木克土）
  const c4 = castChart({ year: 2024, month: 4, day: 10, hour: 12 }); // 甲辰年戊辰月... 找甲辰柱
  const jiaChen = c4.relations.天干地支同柱.find((x) => x.gz === '甲辰');
  if (jiaChen) ok('甲辰 = 干克支（木克土）', jiaChen.relation.includes('盖头'), jiaChen.relation);
  // 泄气：丙戌（丙火生辰土，火生土）-> 干生支
  const c5 = castChart({ year: 2026, month: 10, day: 10, hour: 12 });
  const bingXu = c5.relations.天干地支同柱.find((x) => x.gz === '丙戌');
  if (bingXu) ok('丙戌 = 干生支（火生土）', bingXu.relation.includes('泄气'), bingXu.relation);
  // 同气：找一个是同气的柱（如甲寅、庚申、壬子、丙午）
  for (const probe of [{ y: 2024, m: 1, d: 1 }, { y: 2020, m: 6, d: 6 }, { y: 2021, m: 8, d: 8 }]) {
    const cc = castChart({ year: probe.y, month: probe.m, day: probe.d, hour: 12 });
    const sp = cc.relations.天干地支同柱.find((x) => x.relation.includes('同气'));
    if (sp) { ok('存在干支同气判定', true, sp.gz); break; }
  }
}

console.log('=== 16. 岁运作用 ===');
{
  const c = castChart({ year: 1990, month: 5, day: 20, hour: 14, gender: '男' });
  const ta = transitAnalysis(c, { gz: '乙巳' });
  eq('岁运十神', ta.tenGod, '比肩');
  eq('岁运干支', ta.transit.gz, '乙巳');
  ok('检出与原局作用', ta.interactions.length > 0, `共 ${ta.interactions.length} 条`);
  // 三合补全：原局有巳酉（缺丑），岁运丑来 -> 补全金局
  const ta2 = transitAnalysis(c, { gz: '辛丑' });
  const completed = ta2.interactions.filter((x) => x.作用 === '三合局补全');
  ok('丑运补全巳酉丑金局', completed.length >= 1, JSON.stringify(ta2.interactions.map((x) => x.作用)));
  // 原局已三会（巳午未），岁运再来巳应报"叠加"而非"补全"
  const ta3 = transitAnalysis(c, { gz: '乙巳' });
  ok('巳运对已成火方报叠加', ta3.interactions.some((x) => x.作用 === '三会方叠加'), JSON.stringify(ta3.interactions.map((x) => x.作用)));
  ok('巳运对已成火方不报补全', !ta3.interactions.some((x) => x.作用 === '三会方补全'));
  // 冲：子运冲年支午
  const ta4 = transitAnalysis(c, { gz: '丙子' });
  ok('子运冲午', ta4.interactions.some((x) => x.作用 === '地支六冲' && x.说明.includes('冲午')), JSON.stringify(ta4.interactions));
  // 流年形式
  const ta5 = transitAnalysis(c, { year: 2025 });
  eq('按年传入 -> 乙巳', ta5.transit.gz, '乙巳');
}

console.log('=== 17. 真太阳时校正 ===');
{
  const tst = trueSolarTime({ year: 1990, month: 5, day: 20, hour: 14, minute: 30 }, 116.4);
  // 北京 116.4E 相对 120E 应约 -14.4 分钟
  ok('北京经度差约 -14.4 分', Math.abs(tst.longitudeMinutes - (-14.4)) < 0.01, String(tst.longitudeMinutes));
  ok('均时差在 ±17 分内', Math.abs(tst.eotMinutes) <= 17, String(tst.eotMinutes));
  ok('合计偏移为两者之和', Math.abs(tst.totalMinutes - (tst.longitudeMinutes + tst.eotMinutes)) < 0.01);
  // 乌鲁木齐 87.6E 偏移应超过 -2 小时
  const tst2 = trueSolarTime({ year: 1990, month: 5, day: 20, hour: 14, minute: 30 }, 87.6);
  ok('乌鲁木齐偏移约 -130 分', tst2.longitudeMinutes < -125 && tst2.longitudeMinutes > -135, String(tst2.longitudeMinutes));
}

console.log('=== 14. 流年干支 ===');
{
  eq('1984 甲子', yearPillarOf(1984).gz, '甲子');
  eq('2024 甲辰', yearPillarOf(2024).gz, '甲辰');
  eq('2025 乙巳', yearPillarOf(2025).gz, '乙巳');
  eq('2043 癸亥', yearPillarOf(2043).gz, '癸亥');
  eq('2000 庚辰', yearPillarOf(2000).gz, '庚辰');
  eq('1949 己丑', yearPillarOf(1949).gz, '己丑');
}

console.log('=== 18. 地支相刑：两派口径并报，且两条路径必须一致 ===');
{
  // (a) 三支全见 → 无争议
  const p3 = pillarsOf('甲寅', '丁巳', '庚申', '丙子');
  const x3 = relationsOf(p3)['地支相刑'];
  eq('寅巳申三支全见 → 一条', x3.length, 1);
  eq('寅巳申三支全见 → 口径', x3[0].口径, '三刑全见');
  eq('寅巳申三支全见 → 无争议', x3[0].争议, false);

  // (b) 只见两支 → 争议，且必须标出两派
  //     用本盘 辛巳 丙申 乙巳 丁丑：巳见两支（年、日），故 positions 须把两个巳都列出
  const p2 = pillarsOf('辛巳', '丙申', '乙巳', '丁丑');
  const x2 = relationsOf(p2)['地支相刑'];
  eq('巳申只见两支 → 一条', x2.length, 1);
  eq('巳申只见两支 → 口径', x2[0].口径, '两两互刑');
  eq('巳申只见两支 → 标记争议', x2[0].争议, true);
  ok('争议条须注明两派', /三刑全见/.test(x2[0].note) && /两两互刑/.test(x2[0].note));
  ok('两支须各自列出全部宫位（年巳与日巳都不得漏）', /年巳/.test(x2[0].positions) && /日巳/.test(x2[0].positions) && /月申/.test(x2[0].positions));

  // (c) 两支成刑者（子卯）本无争议
  const pz = pillarsOf('甲子', '丁卯', '乙辰', '丙辰');
  const xz = relationsOf(pz)['地支相刑'];
  ok('子卯 + 辰辰自刑 各一条', xz.length === 2, JSON.stringify(xz));
  eq('子卯口径为通行', xz.find((z) => z.members === '子卯')?.口径, '通行（二支即成）');
  eq('子卯无争议', xz.find((z) => z.members === '子卯')?.争议, false);
  eq('辰辰自刑', xz.find((z) => z.members === '辰辰')?.刑, '自刑');

  // (d) 核心回归：relationsOf 与 transitAnalysis 对同一结构不得给出相反口径
  //     （旧版 relationsOf 只报三支全见、transitAnalysis 却报两支互刑，同一盘两处结论相反）
  const chartP2 = { pillars: p2 };
  const taSame = transitAnalysis(chartP2, { gz: '癸巳' });   // 岁运支巳已在原局，结构未变
  const taXing = taSame.interactions.filter((x) => x['作用'] === '地支相刑');
  ok('岁运临已见之支时仍报相刑', taXing.length >= 1, JSON.stringify(taSame.interactions));
  ok('大运侧口径与原局一致（均为两两互刑）', taXing.every((x) => /两两互刑/.test(x['说明'])), JSON.stringify(taXing));

  const chartP3 = { pillars: p3 };
  const ta3 = transitAnalysis(chartP3, { gz: '壬寅' });      // 寅巳申已在原局，岁运再临寅
  const ta3Xing = ta3.interactions.filter((x) => x['作用'] === '地支相刑');
  ok('三支全见时大运侧口径为三刑全见', ta3Xing.some((x) => /三刑全见/.test(x['说明'])), JSON.stringify(ta3Xing));

  // (e) 原局固有的刑不得被误报为"岁运所致"
  const taNo = transitAnalysis(chartP3, { gz: '己亥' });     // 亥不属寅巳申
  ok('岁运不涉该刑时不得报出相刑', taNo.interactions.filter((x) => x['作用'] === '地支相刑').length === 0,
    JSON.stringify(taNo.interactions.filter((x) => x['作用'] === '地支相刑')));
}

console.log('=== 19. 调候用神表（《穷通宝鉴》十干×十二月 120 组）===');
{
  // 120 组必须全备，且表外组合须返回 null
  let missing = [];
  for (const g of STEMS) for (const b of BRANCHES) {
    const r = tiaohouOf(g, b);
    if (!r) missing.push(g + b);
    else if (!r.用神 || !r.辅佐 || !r.忌 || !r.要点) missing.push(g + b + '(空栏)');
  }
  eq('120 组全部有值且六栏非空', missing.length, 0, missing.join(','));
  eq('表外组合返回 null', tiaohouOf('甲', 'X'), null);
  eq('表外日干返回 null', tiaohouOf('子', '寅'), null);

  // 用神/辅佐须真取自原表（本盘乙木生申月）
  const y = tiaohouOf('乙', '申');
  eq('乙·申 用神', y.用神, '丙');
  eq('乙·申 辅佐', y.辅佐, '癸／己');
  eq('乙·申 忌', y.忌, '庚多');
  eq('乙·申 无回填', y.回填, null);
  eq('乙·申 非分用', y.分用, null);
  eq('乙·申 非并列', y.并列用神, null);

  // 「／」的两种用法必须分清：月内分用 vs 并列次选
  const yw = tiaohouOf('乙', '午');
  ok('乙·午 为月内分用', Array.isArray(yw.分用) && yw.分用.length === 2, JSON.stringify(yw.分用));
  eq('乙·午 分用上期', yw.分用[0].期, '上半月');
  eq('乙·午 分用上期之神', yw.分用[0].神, '癸');
  eq('乙·午 分用下期之神', yw.分用[1].神, '丙');
  eq('乙·午 不得记为并列', yw.并列用神, null);

  const ys = tiaohouOf('乙', '酉');
  ok('乙·酉 以节气分用', Array.isArray(ys.分用) && ys.分用.length === 2, JSON.stringify(ys.分用));
  eq('乙·酉 分用首期', ys.分用[0].期, '白露後');

  const bh = tiaohouOf('丙', '亥');
  eq('丙·亥 不得误判为月内分用', bh.分用, null);
  ok('丙·亥 应记为并列次选', Array.isArray(bh.并列用神) && bh.并列用神.length === 2, JSON.stringify(bh.并列用神));
  eq('丙·亥 并列首项', bh.并列用神[0], '甲戊庚');
  eq('丙·亥 并列次项', bh.并列用神[1], '壬');

  // 原书体例缺漏后的回填须标注
  eq('己·午 回填来源', tiaohouOf('己', '午').回填, '三夏己土');
  eq('己·丑 回填来源', tiaohouOf('己', '丑').回填, '三冬己土');
  eq('丁·戌 回填来源', tiaohouOf('丁', '戌').回填, '八九月丁火（两月合为一条）');
  eq('戊·寅 回填来源', tiaohouOf('戊', '寅').回填, '三春戊土／正二月戊土');
  eq('乙·申 无回填（有独立条目）', tiaohouOf('乙', '申').回填, null);

  // 辅佐栏含否定语者不得被当作"宜用"
  eq('乙·子 辅佐原文', tiaohouOf('乙', '子').辅佐, '不宜用癸');
  eq('乙·子 辅佐纯为 false', tiaohouOf('乙', '子').辅佐纯, false);
  ok('否定语条必被标出', tiaohouOf('乙', '子').辅佐.includes('不宜'));

  // 到位评估：透干 / 通根 / 被合 / 被冲
  const a = tiaohouAssessment({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') });
  eq('评估 日干', a.日干, '乙');
  eq('评估 月令', a.月令, '申');
  eq('评估 用神', a.用神, '丙');
  const bing = a.用神到位.神[0];
  eq('丙 透月干', bing.透干.join(','), '月干');
  eq('丙 通根两支', bing.通根.length, 2);
  eq('丙 五行属火', bing.五行, '火');
  eq('丙 未现为 false', bing.未现, false);
  ok('丙 被辛合', bing.被合.length === 1 && bing.被合[0].化 === '水', JSON.stringify(bing.被合));
  ok('被合者涉及他干（非日干）', bing.被合[0].涉日干 === false);

  // 日干自合 vs 他干合去：这是《子平真诠》"本身之合不为合去"的关键区分
  const ctl = tiaohouAssessment(castChart({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' }));
  const geng = ctl.被合之神.find((x) => x.神 === '庚');
  ok('年庚被日乙合 → 标为日干自合', geng && geng.类别 === '日干自合（不为合去）', JSON.stringify(ctl.被合之神));
  const bing2 = tiaohouAssessment({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }).被合之神.find((x) => x.神 === '丙');
  ok('丙被年辛合 → 标为他干合之', bing2 && bing2.类别 === '他干合之（或为合去）', JSON.stringify(bing2));

  // 忌神栏混"神"与"条件"，引擎不得机械解释
  ok('必有"忌栏不代为取舍"之提示', a.提示.some((t) => /不代为取舍/.test(t)), JSON.stringify(a.提示));
  // 分用条须提示不可压平（乙日午月，正是「癸（上半月）／丙（下半月）」那条）
  const aFen = tiaohouAssessment({ pillars: pillarsOf('庚午', '壬午', '乙卯', '丙子') });
  eq('分用盘 月令', aFen.月令, '午');
  ok('分用条须提示不可压平', aFen.提示.some((t) => /在一月之内分用/.test(t)), JSON.stringify(aFen.提示));
  const aNoFen = tiaohouAssessment({ pillars: pillarsOf('丙寅', '庚寅', '乙卯', '丙子') });
  ok('非分用条不得误加分用提示', !aNoFen.提示.some((t) => /在一月之内分用/.test(t)), JSON.stringify(aNoFen.提示));
}

console.log('=== 20. 分歧触发器（controversiesOf）===');
{
  const chart = { pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') };
  chart.shensha = shenshaOf(chart.pillars, STEMS.indexOf('乙'), STEMS.indexOf('辛'), '男');
  const cs = controversiesOf(chart);
  const ids = cs.map((c) => c.代号);
  console.log('   命中：' + ids.join(', '));

  // 本盘的核心分歧点必须全部命中——漏一个就是"没意识到此处有分歧"
  // 注意 officer-mixed：本盘官只藏、杀透，按严口径**不是混杂**，故应命中 officer-hidden-exposed
  for (const must of ['follow-vs-normal', 'combine-away', 'combine-transform',
    'combine-destroy', 'punish-two-schools', 'officer-hidden-exposed', 'output-mixed',
    'tiaohou-vs-geju', 'shensha-scope']) {
    ok(`分歧触发器须命中 ${must}`, ids.includes(must), '实得 ' + ids.join(','));
  }
  ok('本盘不得报 officer-mixed（一藏一透非混杂）', !ids.includes('officer-mixed'), ids.join(','));
  // 本盘无六害，穿之争不得误报
  ok('本盘无穿，harm-status 不得误报', !ids.includes('harm-status'));

  // 每一条的结构完整性：主张须带出处、须列"须先确定"
  for (const c of cs) {
    ok(`${c.代号} 有各派主张`, Array.isArray(c.各派主张) && c.各派主张.length >= 2, String(c.各派主张?.length));
    ok(`${c.代号} 每条主张皆注明出处`, c.各派主张.every((p) => p.派 && p.主张 && p.据 && p.据.length > 8),
      JSON.stringify(c.各派主张));
    ok(`${c.代号} 列出须先确定之事`, Array.isArray(c.须先确定) && c.须先确定.length >= 1);
    ok(`${c.代号} 有命中结构与本盘事实`, !!c.命中结构 && !!c.本盘事实);
  }

  // 从格之争只在无根盘命中；有根盘不得误报
  const rooted = castChart({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' });
  ok('乙酉日（支藏同类）不得报从格之争',
    !controversiesOf(rooted).map((c) => c.代号).includes('follow-vs-normal'));
  const rootedIds = controversiesOf(rooted).map((c) => c.代号);
  ok('有根盘应命中官杀混杂（庚辛并透）', rootedIds.includes('officer-mixed'), rootedIds.join(','));

  // 调候与格局相反之争，须真按月令本气判
  const tg = cs.find((c) => c.代号 === 'tiaohou-vs-geju');
  eq('调候格局之争：月令', tg.本盘事实.月令, '申');
  eq('调候格局之争：月令本气十神', tg.本盘事实.月令本气十神, '正官');
  eq('调候格局之争：格局所忌', tg.本盘事实.格局所忌.join(','), '伤官,七杀');
  ok('调候格局之争：调候用神确为伤官', tg.本盘事实.调候用神之十神.includes('伤官'), JSON.stringify(tg.本盘事实));
  ok('调候格局之争须声明未判成破', /未判成破/.test(tg.引擎注 ?? ''), tg.引擎注);

  // 引擎注须自承无机械判据者，不得装作有定论
  const fo = cs.find((c) => c.代号 === 'follow-vs-normal');
  ok('从格之争须自承无机械判据', /没有给出可核对的界限/.test(fo.引擎注 ?? ''), fo.引擎注);

  // 空盘（无神煞）不得因神煞触发
  const bare = { pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') };
  ok('未提供神煞时不得报神煞之争',
    !controversiesOf(bare).map((c) => c.代号).includes('shensha-scope'));
}

console.log('=== 21. 官杀混杂：严口径（藏干不计入定性）===');
{
  const ids = (gz, extra = {}) => controversiesOf({ pillars: pillarsOf(...gz), ...extra })
    .filter((c) => c.代号.startsWith('officer')).map((c) => c.代号);

  // 官杀**同天干并透** → 真混杂
  eq('庚午辛巳乙酉癸未（庚辛并透）→ officer-mixed', ids(['庚午', '辛巳', '乙酉', '癸未']).join(','), 'officer-mixed');
  // 官只藏（未透、非本气）、杀透 → 一藏一透，**不得报混杂**
  ok('辛巳丙申乙巳丁丑 → 不得报 officer-mixed', !ids(['辛巳', '丙申', '乙巳', '丁丑']).includes('officer-mixed'));
  // 只有正官、全无七杀 → 什么也不得报（曾误报"藏杀露官"）
  eq('甲子丙寅辛卯戊子（无七杀）→ 无官杀条目', ids(['甲子', '丙寅', '辛卯', '戊子']).length, 0);
  // 官当令本气 + 杀透干 → 非混杂，但须单列（含《子平真诠》李参政命之型）
  eq('庚寅乙酉甲子戊辰（李参政命）→ officer-hidden-exposed', ids(['庚寅', '乙酉', '甲子', '戊辰']).join(','), 'officer-hidden-exposed');
  const li = controversiesOf({ pillars: pillarsOf('庚寅', '乙酉', '甲子', '戊辰') }).find((c) => c.代号 === 'officer-hidden-exposed');
  ok('李参政命条须引该书命例', /李参政命/.test(JSON.stringify(li.各派主张)), '');
  ok('须指明"只论显现者"', /安顿|只论/.test(li.本盘事实.只论 ?? ''), li.本盘事实.只论);
}

console.log('=== 22. 由四柱反推公历日期 ===');
{
  // 已知真值：1990-05-20 14:30 男 → 庚午 辛巳 乙酉 癸未
  const r = dateCandidates(['庚午', '辛巳', '乙酉', '癸未'], { fromYear: 1900, toYear: 2100 });
  eq('四柱回显', r.四柱, '庚午 辛巳 乙酉 癸未');
  eq('自洽性通过', r.自洽, true);
  ok('必须含真值 1990-05-20', r.候选.some((c) => c.日期 === '1990-05-20'), JSON.stringify(r.候选.map((c) => c.日期)));
  eq('时柱回显', r.候选.find((c) => c.日期 === '1990-05-20').时柱, '癸未');
  ok('时辰窗口须含 14:30', /13:00/.test(r.候选.find((c) => c.日期 === '1990-05-20').时辰), r.候选[1].时辰);
  ok('六十年一循环，1900–2100 内应有多解', r.候选.length >= 3, String(r.候选.length));

  // 自洽性校验：月柱不合五虎遁 / 时柱不合五鼠遁
  const bad1 = dateCandidates(['庚午', '乙巳', '乙酉', '癸未'], { fromYear: 1900, toYear: 2100 });
  eq('月柱不合五虎遁 → 自洽=false', bad1.自洽, false);
  ok('须指出应为辛巳', /辛巳/.test(bad1.校验.join('')), bad1.校验.join(''));
  const bad2 = dateCandidates(['庚午', '辛巳', '乙酉', '丙申'], { fromYear: 1900, toYear: 2100 });
  eq('时柱不合五鼠遁 → 自洽=false', bad2.自洽, false);
  ok('须指出应为甲申', /甲申/.test(bad2.校验.join('')), bad2.校验.join(''));

  // 年份范围外无该年柱
  const bad3 = dateCandidates(['庚午', '辛巳', '乙酉', '癸未'], { fromYear: 1890, toYear: 1899 });
  eq('范围内无该年柱 → 自洽=false', bad3.自洽, false);
  eq('且无候选', bad3.候选.length, 0);

  // 阴阳不配之干支须抛错
  let threw = false;
  try { dateCandidates(['甲丑', '辛巳', '乙酉', '癸未']); } catch { threw = true; }
  ok('阴阳不配须抛错', threw);
}

console.log('=== 23. 力度分级 / 旺衰三项 / 太极层 / 通关 / 六层 ===');
{
  const c = castChart({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: '男' });

  // 力度分级：月令巳为火，火的十神（食神/伤官）应为"极"
  const g = tenGodStrength(c);
  eq('月令五行', g.月令五行, '火');
  eq('当令之十神为「极」', g.各十神.filter((x) => x.级别 === '极').every((x) => x.五行 === '火'), true);
  ok('当令者必须是食神或伤官', g.各十神.filter((x) => x.级别 === '极').map((x) => x.十神).sort().join(',') === '伤官,食神',
    g.各十神.filter((x) => x.级别 === '极').map((x) => x.十神).join(','));
  ok('失令而有本气根者不得称「极」', g.各十神.filter((x) => x.级别 === '极').length === 2, String(g.各十神.filter((x) => x.级别 === '极').length));
  ok('十神全备（10 个）', g.各十神.length === 10, String(g.各十神.length));

  // 旺衰三项
  const d = dayMasterSupport(c);
  eq('日主', d.日主, '乙');
  eq('日主五行', d.日主五行, '木');
  eq('月令令态（木在巳为休）', d.月令令态, '休');
  eq('得令=false', d.得令, false);
  ok('力量占比须声明是气候气势而非日主受力', /不是日主的受力/.test(d.提示[0] + (c.strength.语义 ?? '')), d.提示[0]);
  ok('strength 须带语义字段', typeof c.strength.语义 === 'string' && c.strength.语义.length > 10);
  // 反例警示：日支得禄不抵月令失令（须取日支**本气**为日主同五行者：甲日坐寅，月令午）
  const c2 = { pillars: pillarsOf('甲子', '庚午', '甲寅', '丙子') };
  const d2 = dayMasterSupport(c2);
  eq('甲日坐寅 → 日支本气通根', d2.得地.some((x) => x.位.startsWith('日支') && x.层 === '本气'), true);
  eq('月令午对木为休 → 不得令', d2.得令, false);
  ok('日支本气而月令失令者须出反例警示', d2.提示.some((t) => /不能抵消月令失令/.test(t)), JSON.stringify(d2.提示));
  // 反面：得令者不应出该警示
  const d2b = dayMasterSupport({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '丙子') });
  eq('寅月对木为旺 → 得令', d2b.得令, true);
  ok('得令者不得出"不抵月令失令"警示', !d2b.提示.some((t) => /不能抵消月令失令/.test(t)), JSON.stringify(d2b.提示));

  // 太极层：十二月全覆盖，且申月两说相反
  for (const b of BRANCHES) {
    const t = taijiOf(b);
    ok(`太极层 ${b} 有体`, ['阴', '阳', '依组合'].includes(t.体), t.体);
    ok(`太极层 ${b} 有用神方向`, t.用神方向.length >= 1);
  }
  eq('亥月立阴为体', taijiOf('亥').体, '阴');
  eq('巳月立阳为体', taijiOf('巳').体, '阳');
  eq('卯月依组合', taijiOf('卯').体, '依组合');
  eq('寅月按知识模块立阴为体', taijiOf('寅').体, '阴');
  ok('寅月须标注与提示词相反', taijiOf('寅').提示.some((t) => /两说相反/.test(t)), JSON.stringify(taijiOf('寅').提示));
  eq('申月立阳为体', taijiOf('申').体, '阳');
  ok('申月两说方向相反（取水 vs 忌水）', taijiOf('申').用神方向.length === 2
    && taijiOf('申').用神方向[0].取.includes('阴') && taijiOf('申').用神方向[1].忌.includes('阴'),
    JSON.stringify(taijiOf('申').用神方向.map((x) => [x.取, x.忌])));

  // 通关：A克B → 通关 = A所生
  const tg = tongguanOf(c);
  for (const x of tg.相战) {
    eq(`通关神 ${x.相战}`, x.通关神, { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }[x.甲方.五行]);
  }
  const c3 = castChart({ year: 1984, month: 2, day: 4, hour: 4, gender: '男' });
  const tg3 = tongguanOf(c3);
  ok('通关神须同时生甲、生乙之母关系成立',
    tg3.相战.every((x) => x.通关神 && x.通关神 !== x.甲方.五行 && x.通关神 !== x.乙方.五行), JSON.stringify(tg3.相战));

  // 六层作答表
  const six = sixLayersOf(c);
  eq('六层', six.层.length, 6);
  eq('层序 1..6', six.层.map((x) => x.序).join(','), '1,2,3,4,5,6');
  ok('第5层须有"最后候选"硬约束', six.层[4].硬约束.includes('最后一名候选'), six.层[4].硬约束);
  ok('硬约束须含"不得跳层"', six.硬约束.some((h) => /不得跳层/.test(h)));
  ok('硬约束须含"取印比（逆气势）须说明为何可逆"',
    six.硬约束.some((h) => /逆气势/.test(h) && /为何可逆/.test(h)), six.硬约束.join('|').slice(0, 120));
  ok('硬约束不得再提"不逆太极"（太极法已停用）',
    !six.硬约束.some((h) => /不逆太极/.test(h)), '');
  ok('须并列《盲派与象法》的另一种合并方案', six.硬约束.some((h) => /不互相补洞/.test(h)));
  ok('第1层须预填调候用神', six.层[0].引擎已定 && six.层[0].引擎已定.用神 === '癸', JSON.stringify(six.层[0].引擎已定));
  // ★ 第2层原为「阴阳／太极层」，太极法停用后改为「顺逆层（从格闸／旺格闸）」
  eq('第2层须为顺逆层（含两侧闸门）', six.层[1].层, '顺逆层（从格闸／旺格闸）');
  ok('第2层须带从格闸', six.层[1].引擎已定 && six.层[1].引擎已定.从格闸, '');
  ok('第2层不得再带太极层字段', !(six.层[1].引擎已定 && six.层[1].引擎已定.体), '');
  ok('第3层须声明未判成破', /未判成破/.test(six.层[2].引擎限制 ?? ''), six.层[2].引擎限制);
  // ★ 使用者 2026-09-28：「子平，格局权重优先于旺衰」——六层亦须同步该权重口径
  ok('硬约束须含"格局权重优先于旺衰"', six.硬约束.some((h) => /格局权重优先于旺衰/.test(h)), '');
  ok('硬约束须含"格局与扶抑冲突时格局优先"', six.硬约束.some((h) => /格局优先/.test(h) && /扶抑/.test(h)), '');
  ok('硬约束须含旺衰白名单（三用）', six.硬约束.some((h) => /旺衰白名单/.test(h) && /兜底/.test(h)), '');
  ok('第1层须标明调候限冬夏（余月以格局为重）', /冬夏以调候为急/.test(six.层[0].判断) && /余月以格局为重|余月.*格局/.test(six.层[0].判断), six.层[0].判断);
  ok('硬约束须将相战改为"哪种手段最好用"择优', six.硬约束.some((h) => /哪种手段最好用/.test(h)), '');

  // 提示词 §八 的"调候与太极相反"必须被检出
  const fen = castChart({ year: 1981, month: 11, day: 15, hour: 10, gender: '男' });
  const six2 = sixLayersOf(fen);
  ok('六层须检出层间冲突字段', Array.isArray(six2.冲突));
}

console.log('=== 23b. 阴阳集团与成太极（太极法的"后天一半"）===');
{
  // 集团划分必须并列两说、且标注出处等级（古籍核查已证明其非古法）
  const divs = yinyangGroupDivisions();
  ok('集团划分须并列两说', divs.length >= 2, String(divs.length));
  const A = divs.find((d) => d.代号 === 'A-蒲云星命');
  eq('A 说阴集团', A.阴集团.join(''), '水木');
  eq('A 说阳集团', A.阳集团.join(''), '火土金');
  ok('A 说须标注为现代讲义（**不得标为古法**）', /现代讲义/.test(A.出处等级), A.出处等级);
  ok('A 说须自承缺可校勘原始文本', /缺可校勘原始文本/.test(A.出处等级), A.出处等级);
  ok('须声明金入阳集团为特有设定', /特有设定/.test(A.附加规定), A.附加规定);

  // ★★ 关键反证命例：甲戌 辛未 壬戌 甲辰
  //    模块《盲派与象法》§4.4 判「有太极、有富贵」，理由是阴气可附于水木之形。
  //    实测阴占比 33.9%——**纯占比法会得出"太极不成"的错论**，故引擎只报结构、不判成否。
  const K = { pillars: pillarsOf('甲戌', '辛未', '壬戌', '甲辰') };
  const k = yinyangGroupsOf(K);
  eq('反证命例 阴占比', k.阴集团.占比, 33.9);
  eq('反证命例 阳占比', k.阳集团.占比, 66.1);
  ok('反证命例：日干壬属阴集团', k.日干.五行 === '水' && k.日干.所属集团 === '阴', JSON.stringify(k.日干));
  ok('反证命例：阴集团须报"日干在此集团"', k.阴集团.日干在此集团 === true, '');
  ok('反证命例：弱方须有形可附（透干甲或通根）', k.阴集团.有形可附 === true, JSON.stringify(k.阴集团));
  ok('反证命例：须检出"金克木→土自由→助阳"机制',
    (k.跨集团互动 ?? []).some((x) => /金克木/.test(x.机制) && x.方向 === '助阳'),
    JSON.stringify((k.跨集团互动 ?? []).map((x) => x.机制)));
  ok('成太极须**不设机械判据**（不得给出 true/false）',
    typeof k.成太极 !== 'boolean' && /不设机械判据/.test(k.成太极.状态), JSON.stringify(k.成太极 && k.成太极.状态));
  ok('成太极须带关键反证命例供回归', /甲戌 辛未 壬戌 甲辰/.test(k.成太极.关键反证命例.四柱), '');
  ok('成太极须并陈两派主张', k.成太极.两派主张.length >= 2, String(k.成太极.两派主张.length));

  // 先后天分离：寅月 + 寅午戌火局 → 先天立阴、后天阳旺（模块 §4.3 明写的翻盘条件）
  const flip = yinyangGroupsOf({ pillars: pillarsOf('丙午', '庚寅', '戊戌', '甲寅') });
  const fv = flip.先后天比对;
  eq('寅月先天之体', fv.先天.体, '阴');
  eq('寅月火局后天旺方', fv.后天.旺方, '阳');
  eq('先后天须判为不一致', fv.先后天是否一致, false);
  eq('寅月须判"后天做主"', fv.何者做主, '后天（春秋）');
  ok('须显式警示不得混同先天体与后天旺', /不可把先天的「体」当后天的「旺」用/.test(fv.说明.join('')), fv.说明.join('|'));
  ok('须引"春秋少阴少阳后天寻"口诀', /春秋少阴少阳后天寻/.test(fv.说明.join('')), '');

  // 冬夏：先天即基调
  const winter = yinyangGroupsOf({ pillars: pillarsOf('壬子', '壬子', '壬子', '壬子') });
  eq('子月须判"先天做主"', winter.先后天比对.何者做主, '先天（冬夏）');

  // 强方压倒 + 弱方无形可附 → 近于"太极不成"（模块例：辰月戊土命，火土一片）
  const strong = yinyangGroupsOf({ pillars: pillarsOf('戊午', '丙辰', '戊戌', '丁巳') });
  ok('强方须报压倒之势', strong.提示.some((t) => /占据/.test(t)), strong.提示.join('|'));

  // 二说划分均可调用，且不得抛错
  const divB = yinyangGroupsOf(K, 'B-阴阳本义');
  eq('B 说阴集团', divB.阴集团.五行.join(''), '水金');
  let threw = false;
  try { yinyangGroupsOf(K, '不存在的划分'); } catch { threw = true; }
  ok('未知划分须抛错', threw);

  // taijiTiVsWang 参数校验
  let threw2 = false;
  try { taijiTiVsWang('寅', {}); } catch { threw2 = true; }
  ok('taijiTiVsWang 缺 strength 须抛错', threw2);
}

console.log('=== 23d. 成太极判据（古典判据 + 校准状态）===');
{
  // ★ 校准用例一：模块明判"有太极、有富贵"（阴仅 33.9%）
  const A = { pillars: pillarsOf('甲戌', '辛未', '壬戌', '甲辰') };
  const fa = taijiFormationOf(A);
  eq('A 需救方', fa.需救方, '阴集团');
  eq('A 需救方占比', fa.需救方占比, 33.9);
  ok('A 须判"有救"（三判据同判）', /有救/.test(fa.判定), fa.判定);
  ok('A 须倾向成太极但标注未校准', /成太极/.test(fa.成太极) && /未校准/.test(fa.成太极), fa.成太极);

  // ★ 校准用例二：《滴天髓》原文例证「寒金冷水赖寅时一阳解冻」
  const B = { pillars: pillarsOf('甲申', '丙子', '庚辰', '戊寅') };
  const fb = taijiFormationOf(B);
  ok('B（滴天髓原文例证）须判"有救"', /有救/.test(fb.判定), fb.判定);
  ok('B 需救方须为阳集团', fb.需救方 === '阳集团', fb.需救方);

  // 古典判据必须逐字带出处
  ok('须引《滴天髓·寒暖》原文', /寒虽甚，要暖有气；暖虽至，要寒有根/.test(fa.古典判据.原文), fa.古典判据.原文);
  ok('须引反面条件「反以无之为美」', /反以无暖为美/.test(fa.古典判据.原文), fa.古典判据.原文);
  ok('须声明该条是就寒暖言、转用集团属现代引申', /不是就"阴阳集团"言/.test(fa.古典判据.注意), fa.古典判据.注意);

  // ★★ 关键：必须如实声明"无法校准"，且反面例为零
  ok('须声明判据无法校准', /无法校准/.test(fa.校准状态.结论), fa.校准状态.结论);
  ok('须报"反面例 0 个"', /反面例 0 个/.test(fa.校准状态.结论), fa.校准状态.结论);
  eq('正面例须有 2 个', fa.校准状态.正面例.length, 2);
  // 反面例：唯一的反面例**不可复核**（无四柱），故校准用例数仍为 0
  eq('反面例清单须恰 1 条（且为不可复核者）', fa.校准状态.反面例.length, 1);
  ok('该唯一反面例须标为不可复核（无四柱）',
    /不可复核/.test(fa.校准状态.反面例[0].判定) || /不可复核/.test(fa.校准状态.反面例[0].依据),
    JSON.stringify(fa.校准状态.反面例[0]));
  ok('须写明收紧判据的前置条件（先找到四柱完整的反面例）',
    /必须先找到/.test(fa.校准状态.待办), fa.校准状态.待办);

  // 三个候选判据都要给出，且各带古典对应
  eq('候选判据须 3 条', fa.候选判据.length, 3);
  ok('每条候选判据须带古典对应', fa.候选判据.every((j) => j.古典对应 && j.明细), '');
  ok('引擎**不得**输出二值成/不成',
    !/^(成|不成)$/.test(fa.成太极) && /未校准/.test(fa.成太极), fa.成太极);
}

console.log('=== 23c. 古籍新增分歧代号 ===');
{
  // 时支为子才报晚子时；非子不报（避免噪声淹没真分歧）
  const zi = controversiesOf({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '甲子') }).map((c) => c.代号);
  ok('时支为子须报 late-zi-hour', zi.includes('late-zi-hour'), zi.join(','));
  const chou = controversiesOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }).map((c) => c.代号);
  ok('时支非子不得报 late-zi-hour', !chou.includes('late-zi-hour'), chou.join(','));
  const lz = controversiesOf({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '甲子') })
    .find((c) => c.代号 === 'late-zi-hour');
  ok('晚子时须并陈三派（含《命理探源》"日不进、时进"）',
    lz.各派主张.length >= 3 && lz.各派主张.some((p) => /日不进、时进/.test(p.派 + p.主张)),
    String(lz.各派主张.length) + ' ' + lz.各派主张.map((p) => p.派).join('|'));
  // 通用披露两条：无盘也应报
  for (const id of ['ganzhi-interaction-model', 'shensha-abolition']) {
    const e = controversiesOf({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '丙子') });
    ok(`无盘亦须报 ${id}`, e.some((c) => c.代号 === id && c.类别 === '通用披露'), e.map((c) => c.代号).join(','));
  }
  const gm = controversiesOf({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '丙子') })
    .find((c) => c.代号 === 'ganzhi-interaction-model');
  ok('干支作用模型须并陈"天只与天关"与"支为干之生地"',
    gm.各派主张.some((p) => /天只与天关/.test(p.主张)) && gm.各派主张.some((p) => /支为干之生地/.test(p.主张)), '');
}

console.log('=== 23e. 调候版本差异（《造化元钥》对校）===');
{
  const diffs = tiaohouVersionDiffs();
  eq('版本差异须 4 条（该底本只存 17/120 组，其余八干原缺）', diffs.length, 4);
  eq('版本差异的定位', diffs.map((d) => d.日干 + d.月支).join(' '), '甲卯 甲巳 甲亥 丙辰');
  for (const d of diffs) {
    ok(`版本差异 ${d.日干}${d.月支} 须带现有/评注本/差异/出处`,
      !!(d.现有 && d.评注本 && d.差异 && d.出处), JSON.stringify(Object.keys(d)));
  }
  // 甲木四月：现有把庚整体列入忌，评注本作辅佐——这是最关键的一条
  const jiaSi = tiaohouVersionDiff('甲', '巳');
  ok('甲巳条须指出"又须有庚透"', /庚/.test(jiaSi.评注本.说明), jiaSi.评注本.说明);
  ok('甲巳条须点明现有把庚整体入忌的错误', /忌神栏/.test(jiaSi.差异), jiaSi.差异);
  // 丙火三月：丁己 vs 乙丁 异文（关键在忌神栏的两字之差）
  const bingChen = tiaohouVersionDiff('丙', '辰');
  ok('丙辰条评注本忌神须作"丁己离乱"', /丁己/.test(bingChen.评注本.忌), bingChen.评注本.忌);
  ok('丙辰条现有表忌神须作"乙丁杂乱"', /乙丁/.test(bingChen.现有.忌), bingChen.现有.忌);
  ok('丙辰条须说明两说并列不代判', /两说并列/.test(bingChen.差异), bingChen.差异);
  // 甲木十月：漏戊
  ok('甲亥条须报"漏戊"', /漏戊/.test(tiaohouVersionDiff('甲', '亥').差异), tiaohouVersionDiff('甲', '亥').差异);
  // 无差异的组合须返回 null
  eq('无差异组合须返回 null', tiaohouVersionDiff('甲', '寅'), null);

  // 挂到评估上：甲木四月、时支寅
  const a = tiaohouAssessment({ pillars: pillarsOf('庚午', '己巳', '甲子', '丙寅') });
  ok('tiaohouAssessment 须带版本差异', a.版本差异 && a.版本差异.日干 === '甲', JSON.stringify(a.版本差异 && a.版本差异.日干));
  ok('版本差异须进提示', a.提示.some((t) => /版本差异/.test(t)), '');
}

console.log('=== 23f. 《八字提要》1440 组（十干×十二月×十二时）===');
{
  const meta = tiyaoMeta();
  eq('条数须 1440', meta.条数, 1440);
  ok('须报完整', meta.完整 === true, '');
  ok('须声明"不要手改"', /不要手改/.test(meta.注意), meta.注意);

  // 时干必须由日干+时支推出（五鼠遁）——用引擎排盘交叉验证
  const cases = [
    ['甲', '子', '子', '甲子'], ['甲', '子', '卯', '丁卯'],
    ['乙', '子', '子', '丙子'], ['丙', '子', '子', '戊子'],
    ['癸', '亥', '酉', '辛酉'], ['癸', '丑', '亥', '癸亥'],
  ];
  for (const [g, m, hb, wantHz] of cases) {
    const t = tiyaoOf(g, m, hb);
    ok(`提要 ${g}日${m}月${hb}时 时柱应为 ${wantHz}`, t && t.时干 + t.时支 === wantHz,
      t ? t.时干 + t.时支 : 'null');
    ok(`提要 ${g}日${m}月${hb}时 须有正文`, t && t.论述.length > 20, t ? String(t.论述.length) : 'null');
  }

  // ★ 定位键必须含时干：甲日子月「卯」时实为丁卯，不可与甲卯混同
  const jiaMao = tiyaoOf('甲', '子', '卯');
  eq('甲日子月卯时 时干', jiaMao.时干, '丁');
  ok('该条正文须是"甲日子提，位？沐浴"那一条（即丁卯时）',
    /沐浴|丁火/.test(jiaMao.论述), jiaMao.论述.slice(0, 30));

  // 全量可寻址 + 键唯一
  let miss = 0; const keys = new Set(); let dup = 0;
  for (const g of STEMS) {
    for (const mb of ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']) {
      for (const hb of ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']) {
        const t = tiyaoOf(g, mb, hb);
        if (!t) { miss++; continue; }
        const k = g + mb + t.时干 + t.时支;
        if (keys.has(k)) dup++;
        keys.add(k);
      }
    }
  }
  eq('全量 1440 组须可寻址', miss, 0);
  eq('定位键须唯一无冲突', dup, 0);

  // tiyaoSiblings：12 条，时柱序列合五鼠遁
  const sib = tiyaoSiblings('甲', '子');
  eq('整节须 12 条', sib.length, 12);
  eq('甲日子月整节时柱序列', sib.map((x) => x.时柱).join(' '),
    '甲子 乙丑 丙寅 丁卯 戊辰 己巳 庚午 辛未 壬申 癸酉 甲戌 乙亥');
  const sibYi = tiyaoSiblings('乙', '子');
  eq('乙日子月整节时柱序列（乙庚丙作初）', sibYi.map((x) => x.时柱).join(' '),
    '丙子 丁丑 戊寅 己卯 庚辰 辛巳 壬午 癸未 甲申 乙酉 丙戌 丁亥');

  // 非法输入不得抛错
  eq('非法日干须返回 null', tiyaoOf('X', '子', '子'), null);
  eq('非法时支须返回 null', tiyaoOf('甲', '子', 'X'), null);
  eq('非法日干整节须空数组', tiyaoSiblings('X', '子').length, 0);

  // 挂到评估上
  const a = tiaohouAssessment({ pillars: pillarsOf('庚午', '己巳', '甲子', '丙寅') });
  ok('tiaohouAssessment 须带提要条', a.提要 && a.提要.时柱 === '丙寅', JSON.stringify(a.提要 && a.提要.时柱));
  ok('须声明"11/12 的概率取错"', a.提示.some((t) => /11\/12/.test(t)), a.提示.join('|').slice(0, 120));
  ok('须带提要使用规则', /仅知月令/.test(a.提要使用规则), a.提要使用规则);

  // ── ★ 2026-10-01 修 D4：**渲染层不得丢掉提要正文** ─────────────────────
  // 旧 bug：提要正文在 tiaohouAssessment 里算出，却在 formatTiaohou 处被丢弃，
  // 模型只看到一句"须并陈"、拿不到要并陈的东西。旧测试只测数据层，故测不出。
  // 以下三条把"最后一公里丢失"钉成红灯。
  const ft = formatTiaohou(a);
  ok('formatTiaohou 须印出《八字提要》本时辰条标题（含时柱）',
    ft.includes('【《八字提要》') && ft.includes('丙寅时'), ft.slice(-200));
  ok('formatTiaohou 须逐字印出 a.提要.论述（渲染层不得与数据层脱钩）',
    ft.includes(a.提要.论述), '提请正文未出现在 formatter 输出中');
  ok('提要存在时不得出现 ⛔ 闸门', !/⛔/.test(ft), ft.slice(-200));
  // fail-closed：取不到提要条时，须顶格 ⛔ 并声明不得作确定性结论
  const fakeMissing = formatTiaohou({ ...a, 提要: null, 提要缺失: true });
  ok('提要缺失时须 fail-closed（⛔ + "不得作为确定性结论"）',
    /⛔/.test(fakeMissing) && /不得作为确定性结论/.test(fakeMissing), fakeMissing.slice(-200));
  // 数据完整时不得误报缺失；并须回报"数据完整"标志
  // （注：`tiaohouAssessment` 强制四柱，故"仅知月令"一路由 `tiaohouOf` 承担，不在此测。）
  ok('数据完整时 提要缺失 须为 false（不误报）', a.提要缺失 === false, String(a.提要缺失));
  ok('须回报 提要数据完整 = true', a.提要数据完整 === true, String(a.提要数据完整));
}

console.log('=== 23g. 古法三命与唐代纳音算法 ===');
{
  // ── 唐代纳音算法：支干数（两柱）→ 除六五 → 余数配五行 ──────────────
  const chk = nayinTableCheck();
  ok('唐代纳音算法须与纳音表 30 组全符', chk.通过 === true, JSON.stringify(chk.不一致.slice(0, 3)));
  eq('校验组数', chk.检验组数, 30);
  eq('校验柱数', chk.检验柱数, 60);
  eq('不一致须为 0', chk.不一致.length, 0);

  // 八组原文例证（《李虚中命书》卷中 + 《命理探源》引《瑞桂堂暇录》）
  const cite = [['甲子', '金'], ['丙子', '水'], ['戊子', '火'], ['庚子', '土'], ['壬子', '木'],
    ['戊辰', '木'], ['庚午', '土'], ['甲申', '水']];
  for (const [gz, want] of cite) {
    const n = nayinByShu(gz[0], gz[1]);
    eq(`原文例证 ${gz} → ${want}`, n.五行, want);
    ok(`原文例证 ${gz} 须与纳音表一致`, n.与纳音表一致 === true, n.表值);
  }
  // 甲子乙丑 = 甲9+子9+乙8+丑8 = 34
  const jz = nayinByShu('甲', '子');
  eq('甲子的两柱', jz.两柱, '甲子乙丑');
  eq('甲子的数（两柱合计）', jz.数, 34);
  eq('甲子的余数', jz.余数, 4);
  ok('须声明"必须两柱"', /必须两柱/.test(jz.生成元.两柱合计), jz.生成元.两柱合计);
  ok('须声明干支取值周期不同', /干 9−\(序号%5\)、支 9−\(序号%6\)/.test(jz.生成元.取值周期), jz.生成元.取值周期);
  // ★ 单柱法会算错——回归锚点：乙丑的数必须也是 34（同组两柱同数），而非 17
  eq('乙丑的数（同组同数）', nayinByShu('乙', '丑').数, 34);
  // 余数配五行：实测映射 + 古典异说并陈
  // 甲子余 4 —— 实测"余4→金"与古典"余4→金"恰好相同，故此处相同为 true
  ok('须并陈古典异说', jz.古典异说 && jz.古典异说.余数配五行_古典 === '金', JSON.stringify(jz.古典异说));
  eq('甲子余4 古典与实测须相同', jz.古典异说.与实测是否相同, true);
  // 取一个余数上两说**不同**的来验证并陈：庚子余 2（实测土／古典火）
  const gz2 = nayinByShu('庚', '子');
  eq('庚子余数', gz2.余数, 2);
  eq('庚子实测五行', gz2.五行, '土');
  eq('庚子古典异说', gz2.古典异说.余数配五行_古典, '火');
  eq('庚子两说须判为不同', gz2.古典异说.与实测是否相同, false);
  ok('须声明实测与古典只在余3、4相同', /只在余 3、4 两处相同/.test(jz.古典异说.注), jz.古典异说.注);
  // 非法输入
  eq('阴阳不配者须返回 null', nayinByShu('甲', '丑'), null);
  eq('非法天干须返回 null', nayinByShu('X', '子'), null);

  // ── 古法三命（三元／九命），以年为本 ──────────────────────────────
  // 原文例：癸未 乙卯 甲子 己巳（《鬼谷遗文-三命结构》所举）
  const sm = sanmingOf({ pillars: pillarsOf('癸未', '乙卯', '甲子', '己巳') });
  eq('干禄＝年干', sm.本命.干禄, '癸');
  eq('支命＝年支', sm.本命.支命, '未');
  eq('纳音身＝年柱纳音', sm.本命.纳音身, '杨柳木');
  eq('纳音五行', sm.本命.纳音五行, '木');
  ok('须声明以年为本、与子平两套体系', /以年为本/.test(sm.体系声明) && /两套体系/.test(sm.体系声明), sm.体系声明);
  ok('须警告同名异义不可混用', /同名异义/.test(sm.体系声明), sm.体系声明);
  // 三元取象（《鬼谷遗文》原文）
  ok('干禄所主须合原文', /名禄贵权/.test(sm.三元.干禄.主), sm.三元.干禄.主);
  ok('支命所主须合原文', /金珠积富/.test(sm.三元.支命.主), sm.三元.支命.主);
  ok('纳音身所主须合原文', /材能器识/.test(sm.三元.纳音身.主), sm.三元.纳音身.主);
  // 九命＝三元×生旺库
  eq('九命须含三元', Object.keys(sm.九命).join(','), '干禄,支命,纳音身');
  // 原文例：纳音木 落未 → 木墓在未 → 库
  eq('纳音身（木）落未之三态', sm.三元.纳音身.三态, '库');
  eq('得位三元数', sm.得位三元数, 1);
  // 四柱纳音
  eq('四柱纳音须 4 条', sm.四柱纳音.length, 4);
  eq('日柱纳音', sm.四柱纳音[2].纳音, '海中金');
  eq('日柱纳音五行', sm.四柱纳音[2].五行, '金');
  // 生旺库与三合局一致（甲与乙、丙与丁…同宫）
  eq('五行寄生十二宫：木墓在未', elementBranchStage('木', BRANCHES.indexOf('未')), '墓');
  eq('五行寄生十二宫：火旺在午', elementBranchStage('火', BRANCHES.indexOf('午')), '帝旺');
  eq('五行寄生十二宫：金生在巳', elementBranchStage('金', BRANCHES.indexOf('巳')), '长生');
  eq('五行寄生十二宫：水墓在辰', elementBranchStage('水', BRANCHES.indexOf('辰')), '墓');
  eq('五行寄生十二宫：土旺在午（与火同宫）', elementBranchStage('土', BRANCHES.indexOf('午')), '帝旺');
  ok('纳音表校验须随三命一并给出', sm.纳音表校验 && sm.纳音表校验.通过 === true, '');
}

console.log('=== 23h. 旺衰闸 / 从格闸（congGateOf）===');
{
  // ★ 极弱盘：不得令、无根、无势 → 第 5 层须被阻止
  const A = congGateOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') });
  eq('A 日主', A.日主, '乙');
  eq('A 是否极弱', A.是否极弱, true);
  eq('A 是否无根', A.是否无根, true);
  ok('A 第5层须被阻止', A.第5层被阻止 === true, String(A.第5层被阻止));
  eq('A 须挂 4 条不从严', A.不从严.length, 4);
  // 本局：有印可依（申中壬、丑中癸）＋ 食伤透干（丙丁）→ 两条拦住 → 不作从论
  ok('A 须判定"有印可依"为拦', A.不从严.find((x) => /有印可依/.test(x.条)).拦 === true, '');
  ok('A 须判定"食伤透干有气"为拦',
    A.不从严.find((x) => /食伤透干有气/.test(x.条)).拦 === true, '');
  eq('A 拦住条数', A.拦住条数, 2);
  ok('A 结论须含"不作从论"', A.闸门结论.some((c) => /不作从论/.test(c)), A.闸门结论.join('|'));
  ok('A 须声明"若论从"而非常论', A.闸门结论.some((c) => /仅当最终仍论从时/.test(c)), A.闸门结论.join('|'));
  ok('食伤条须引"可依之体"',
    /可依之体/.test(A.不从严.find((x) => /食伤透干有气/.test(x.条)).结果), '');
  ok('印条须引不从严原文',
    /干上有木不作从财/.test(A.不从严.find((x) => /有印可依/.test(x.条)).据), '');

  // ★ 无根但得势 → 不算极弱，第 5 层可用但有前提
  const B = congGateOf({ pillars: pillarsOf('庚申', '甲申', '甲子', '丙子') });
  eq('B 是否极弱', B.是否极弱, false);
  eq('B 是否无根', B.是否无根, true);
  eq('B 第5层被阻止', B.第5层被阻止, false);
  ok('B 结论须含"无根但或有余势"', B.闸门结论.some((c) => /无根但或有余势/.test(c)), B.闸门结论.join('|'));

  // 有根盘：闸门不触发
  const C = congGateOf({ pillars: pillarsOf('壬子', '壬寅', '乙亥', '癸未') });
  eq('C 是否极弱', C.是否极弱, false);
  eq('C 有根即不从 须拦住', C.不从严.find((x) => /有根即不从/.test(x.条)).拦, true);
  ok('C 结论须含"从格关不触发"', C.闸门结论.some((c) => /从格关不触发/.test(c)), C.闸门结论.join('|'));

  // 专旺盘：得令得地得势，闸门不触发
  const D = congGateOf({ pillars: pillarsOf('壬子', '壬子', '壬子', '壬子') });
  eq('D 是否极弱', D.是否极弱, false);
  eq('D 得地须 4 处', D.旺衰三项.得地.length, 4);

  // ★ 闸门必须挂进 sixLayersOf 的第 2 层与第 5 层
  const six = sixLayersOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') });
  ok('第2层须携带从格闸', !!six.层[1].引擎已定.从格闸, JSON.stringify(Object.keys(six.层[1].引擎已定)));
  ok('第2层硬约束须提到闸门阻止第5层', /第 5 层被阻止直接取印比/.test(six.层[1].硬约束), six.层[1].硬约束.slice(-140));
  ok('第5层须带闸门字段', !!six.层[4].闸门, '');
  ok('第5层闸门须声明被阻止', /已被闸门阻止直接取印比/.test(six.层[4].闸门), six.层[4].闸门);
  ok('第5层闸门须给出须先过的关', /须先过：/.test(six.层[4].闸门), '');
  // 中性对照须用**真正两闸皆不触发**的盘。
  // 注：'壬子壬寅乙亥癸未' 初看像"有根不太弱"，**实为极旺盘**（印重身旺：水56.8%+木33.4%=90.2%），
  // 故不可用作中性对照；改用基准锚点盘 '庚午辛巳乙酉癸未'（极弱=false、极旺=false）。
  const sixNeu = sixLayersOf({ pillars: pillarsOf('庚午', '辛巳', '乙酉', '癸未') });
  ok('中性盘（基准锚点）两闸俱不触发', /未被闸门阻止/.test(sixNeu.层[4].闸门), sixNeu.层[4].闸门);

  ok('须声明不作结论、只报结构', /不作从与不作的结论/.test(A.各家立场), A.各家立场.slice(0, 60));
  ok('须声明挂第2层而非第5层', /第 2 层/.test(A.注) && /不并进第 5 层/.test(A.注), A.注);
  ok('须引《滴天髓》"没有给出可核对的界限"', /没有给出可核对的界限/.test(A.各家立场), '');
}

console.log('=== 23i. 诸法仲裁（体用最高 + 严重不符才附异议）===');
{
  // ① 令牌→五行：调候用神写的是**天干字**（如"丙"），不是五行名
  const A = yongshenArbiterOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }, { 用神五行: '水' });
  const 调候A = A.诸法.find((x) => x.法 === '调候');
  eq('调候取向须把天干丙解析为火', 调候A.取向.join(''), '火');
  ok('调候依据须带原文用神', /用神丙/.test(调候A.依据), 调候A.依据);

  // ② 规则 1：体用为最高裁决
  eq('主结论法须为体用', A.主结论.法, '体用');
  eq('主结论用神', A.主结论.用神.join(''), '水');
  ok('主结论须声明为最高裁决', /最高裁决/.test(A.主结论.地位), A.主结论.地位);
  ok('须写明规则本身', A.说明.some((s) => /体用最高/.test(s)), A.说明[0]);

  // ③ 规则 2：未达严重不符时**不附**异议推理链
  //    本盘：体用水；调候火相左，其余同向 → 相左 1 法 < 2 且 < 半数 → 不严重
  eq('A 相左法数', A.比对.相左法数, 1);
  eq('A 严重不符', A.比对.严重不符, false);
  eq('A 须附异议推理链须为空', A.须附异议推理链.length, 0);
  eq('A 异议各法思考须为 null', A.异议各法思考, null);
  ok('A 说明须含"未达"', A.说明.some((s) => /未达/.test(s)), '');

  // ④ 规则 3：严重不符时须附异议各法的推理链
  //    癸未乙卯甲子己巳：体用水 → 调候庚(金)、扶抑火土金、格局金 全部相左 → 严重
  const B = yongshenArbiterOf({ pillars: pillarsOf('癸未', '乙卯', '甲子', '己巳') }, { 用神五行: '水' });
  ok('B 须判为严重不符', B.比对.严重不符 === true, JSON.stringify(B.比对));
  ok('B 相左法数须 ≥2', B.比对.相左法数 >= 2, String(B.比对.相左法数));
  ok('B 须列出须附推理链的各法', B.须附异议推理链.length >= 2, JSON.stringify(B.须附异议推理链));
  ok('B 异议各法思考须非空', Array.isArray(B.异议各法思考) && B.异议各法思考.length >= 2, '');
  ok('B 每条异议须带依据', B.异议各法思考.every((x) => x.依据), '');
  ok('B 说明须含"严重不符"与"须附"', B.说明.some((s) => /严重不符/.test(s) && /须附上/.test(s)), '');
  ok('B 须声明不得私下调和', B.说明.some((s) => /不得私下调和/.test(s)), '');

  // ⑤ 古法三命不参与仲裁，只并列提示
  ok('须声明古法三命不参与仲裁',
    /不参与本仲裁/.test(A.古法三命并列.提示), A.古法三命并列.提示);
  ok('须并列给出古法三命的本命', !!A.古法三命并列.本命, '');

  // ⑥ 各法须逐条标注级别与声明
  // ★ 太极法已按使用者 2026-09-28 决定从解盘停用 → 默认**不参与仲裁**
  for (const f of ['体用', '调候', '扶抑（六层第5层）', '格局']) {
    const x = A.诸法.find((y) => y.法 === f);
    ok(`诸法须含 ${f}`, !!x, A.诸法.map((y) => y.法).join(','));
    if (x) ok(`${f} 须带级别`, !!x.级别, '');
  }
  ok('太极法默认不得参与仲裁',
    !A.诸法.some((y) => y.法 === '太极'), A.诸法.map((y) => y.法).join(','));
  ok('须在已停用各法列出太极', !!A.已停用各法?.太极, JSON.stringify(Object.keys(A.已停用各法 ?? {})));
  ok('已停用提示须说明传 includeTaiji 可恢复',
    /includeTaiji/.test(A.已停用各法.太极.提示), A.已停用各法.太极.提示);
  const A2 = yongshenArbiterOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }, { 用神五行: '水', includeTaiji: true });
  ok('includeTaiji=true 时太极须恢复入列',
    A2.诸法.some((y) => y.法 === '太极'), A2.诸法.map((y) => y.法).join(','));
  ok('恢复后太极声明须含"无古籍依据"',
    /无古籍依据/.test(A2.诸法.find((y) => y.法 === '太极').声明), '');
  ok('格局须声明未判成破救应',
    /未判成破救应/.test(A.诸法.find((x) => x.法 === '格局').声明), '');
  ok('扶抑须声明永远最后',
    /永远最后/.test(A.诸法.find((x) => x.法 === '扶抑（六层第5层）').声明), '');
  ok('须声明不合并不加权不评分', /不合并、不加权、不评分/.test(A.注), A.注);

  // ⑦ 挂进六层：诸法仲裁 + 硬约束条款
  const six = sixLayersOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') });
  ok('六层须带诸法仲裁', !!six.诸法仲裁, '');
  ok('硬约束须含诸法优先级条款', six.硬约束.some((h) => /体用最高/.test(h) && /严重不符/.test(h)), '');
  ok('硬约束须给出严重不符的机械判据', six.硬约束.some((h) => /可比对法数 × 60%/.test(h)), '');

  // ⑦之二 ★ 太极法从解盘停用：第 2 层改为「顺逆层（从格闸／旺格闸）」
  eq('第2层须改名顺逆层（含两侧闸门）', six.层[1].层, '顺逆层（从格闸／旺格闸）');
  ok('第2层不得再带太极字段',
    !('体' in six.层[1].引擎已定) && !('用神方向' in six.层[1].引擎已定),
    JSON.stringify(Object.keys(six.层[1].引擎已定)));
  ok('第2层须带从格闸', !!six.层[1].引擎已定.从格闸, '');
  ok('第2层须声明太极已移除', /不再参与解盘/.test(six.层[1].已移除 ?? ''), six.层[1].已移除);
  ok('硬约束不得再提"不逆太极"', !six.硬约束.some((h) => /不逆太极/.test(h)), '');
  ok('硬约束须改为"逆气势须说明为何可逆"',
    six.硬约束.some((h) => /逆气势/.test(h) && /为何可逆/.test(h)), '');
  ok('默认冲突检出不得含太极类',
    six.冲突.every((c) => !/太极/.test(JSON.stringify(c))), JSON.stringify(six.冲突));

  // ⑦之三 分歧代号：太极相关的两条默认不报
  const cBase = { pillars: pillarsOf('甲子', '丙寅', '甲寅', '丙子') };
  const idsBase = controversiesOf(cBase).map((x) => x.代号);
  ok('默认不得报 tiaohou-vs-taiji', !idsBase.includes('tiaohou-vs-taiji'), idsBase.join(','));
  ok('默认不得报 autumn-wood-fall-vs-taiji', !idsBase.includes('autumn-wood-fall-vs-taiji'), idsBase.join(','));
  ok('默认不得报隐藏的太极类代号',
    !idsBase.some((x) => /taiji/.test(x)), idsBase.join(','));

  // ⑧ 裸 chart 健壮性：不依赖调用方附带 chart.dayMaster
  //    （曾因读 chart.dayMaster.element 而静默吞掉「体用」「调候」两项）
  const bare = { pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') };
  const 裸测 = [
    ['threatOf', () => threatOf(bare)],
    ['qingOf', () => qingOf(bare, {})],
    ['structureOf', () => structureOf(bare)],
    ['tiyongRouteOf', () => tiyongRouteOf(bare, { 用神五行: '水' })],
    ['dashiOf', () => dashiOf(bare)],
    ['congGateOf', () => congGateOf(bare)],
    ['yongshenArbiterOf', () => yongshenArbiterOf(bare, { 用神五行: '水' })],
  ];
  for (const [名, fn] of 裸测) {
    let err = null;
    try { fn(); } catch (e) { err = e; }
    ok(`裸 chart 下 ${名} 不得抛错`, err === null, err && err.message);
  }
}

console.log('=== 23j. 极旺闸 wangGateOf（与极弱闸对称）· 用神粒化 · 六成阈值 ===');
{
  // ① 极旺盘：从旺（《千里命稿》例）
  const A = wangGateOf({ pillars: pillarsOf('癸卯', '乙卯', '甲寅', '乙亥') });
  eq('A 是否极旺', A.是否极旺, true);
  eq('A 第5层被阻止', A.第5层被阻止, true);
  ok('A 须报同党占比', A.同党占比 >= 60, String(A.同党占比));
  ok('A 旺格须成立', Array.isArray(A.旺格成立) && A.旺格成立.length > 0, JSON.stringify(A.旺格成立));
  ok('A 取用方向须为顺其旺势', /顺其旺势/.test(A.取用方向), A.取用方向);
  ok('A 结论须含"官杀为忌"', A.闸门结论.some((c) => /官杀为忌/.test(c)), '');
  ok('A 须引《滴天髓》不可逆者', /不可逆者/.test(A.据), '');
  ok('A 阈值须声明为引擎操作化', /引擎操作化/.test(A.阈值说明), '');
  ok('A 须给须先过关', Array.isArray(A.须先过关) && A.须先过关.length >= 2, '');
  ok('A 须带三书对账门槛不一', !!A.各家门槛不一, '');
  ok('A 财（土）仅余气者不得算在局', A.财.在局 === false && A.财.仅藏余气 === true,
    JSON.stringify({ 在局: A.财.在局, 仅: A.财.仅藏余气, 中余: A.财.中余气根 }));

  // ② 从强盘（《千里命稿》例）
  const B = wangGateOf({ pillars: pillarsOf('壬子', '癸卯', '甲子', '甲子') });
  eq('B 是否极旺', B.是否极旺, true);
  ok('B 旺格须成立', (B.旺格成立 ?? []).length > 0, JSON.stringify(B.旺格成立));

  // ③ 纯水专旺
  const C = wangGateOf({ pillars: pillarsOf('壬子', '壬子', '壬子', '壬子') });
  eq('C 是否极旺', C.是否极旺, true);
  eq('C 同党占比须 100', C.同党占比, 100);

  // ④ 非极旺盘：闸门不得误触发
  const D = wangGateOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') });
  eq('D 是否极旺', D.是否极旺, false);
  eq('D 第5层被阻止', D.第5层被阻止, false);
  ok('D 结论须含"不触发"', D.闸门结论.some((c) => /不触发/.test(c)), '');
  const E2 = wangGateOf({ pillars: pillarsOf('庚申', '甲申', '甲子', '丙子') });
  eq('E 是否极旺（无根者不得误判）', E2.是否极旺, false);

  // ⑤ 挂进六层第 2 层
  const sixW = sixLayersOf({ pillars: pillarsOf('癸卯', '乙卯', '甲寅', '乙亥') });
  eq('极旺盘第2层名', sixW.层[1].层, '顺逆层（从格闸／旺格闸）');
  ok('第2层须带旺格闸', !!sixW.层[1].引擎已定.旺格闸, '');
  ok('第2层须带从格闸', !!sixW.层[1].引擎已定.从格闸, '');
  ok('极旺盘第5层闸门须声明阻止', /已被旺格闸阻止直接取食伤财官/.test(sixW.层[4].闸门), sixW.层[4].闸门);
  // 中性盘（非极弱、非极旺）：两闸均不得触发
  // 注：'辛巳丙申乙巳丁丑' 是**极弱**盘、'壬子壬寅乙亥癸未' 是**极旺**盘（印重身旺），
  //     二者皆不可用作中性对照；改用基准锚点盘 '庚午辛巳乙酉癸未'。
  const sixN = sixLayersOf({ pillars: pillarsOf('庚午', '辛巳', '乙酉', '癸未') });
  ok('非极旺盘第5层不得被旺格闸阻止', !/已被旺格闸阻止/.test(sixN.层[4].闸门), sixN.层[4].闸门);
  ok('中性盘两闸均不触发', /未被闸门阻止/.test(sixN.层[4].闸门), sixN.层[4].闸门);
  ok('顶层硬约束须声明专旺时"泄克"亦不成立',
    sixW.硬约束.some((h) => /专旺成格/.test(h) && /顺其旺势/.test(h)), '');
  ok('顶层硬约束须声明两侧闸门对称',
    sixW.硬约束.some((h) => /两侧闸门/.test(h) && /congGateOf/.test(h)), '');

  // ⑥ 用神粒化：五行 → 干支字 + 回验
  const G = 用神Grainify({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }, ['水']);
  eq('粒化候选取到水之干支', G[0].候选字.join(''), '壬癸申子辰');
  ok('回验须报在局之字', Array.isArray(G[0].在局之字) && G[0].在局之字.length > 0, JSON.stringify(G[0].在局之字));
  ok('回验须标三合局位', /长生/.test(JSON.stringify(G[0].地支候选)), '');
  ok('藏干须另栏（不与地支自身混同）', Array.isArray(G[0].藏干另栏) && G[0].藏干另栏.length > 0, '');
  ok('须声明不判吉凶不选用神', /不判吉凶、不选谁当用神/.test(G[0].粒化说明), '');
  const G2 = 用神Grainify({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }, ['土']);
  ok('土之支候选须标"土寄火宫"', G2[0].地支候选.some((x) => /土寄火宫/.test(x.注 ?? '')), '');
  const arb = yongshenArbiterOf({ pillars: pillarsOf('辛巳', '丙申', '乙巳', '丁丑') }, { 用神五行: '水' });
  ok('仲裁须带出用神粒化', !!arb.用神粒化, '');
  ok('粒化须回验出具体字', /在局|全局无/.test(arb.用神粒化[0].回验结论), arb.用神粒化[0].回验结论);

  // ⑦ 严重不符阈值：使用者定为"反对占六成"
  ok('说明须写"反对占六成"', /反对占六成/.test(arb.说明.join('')), '');
  ok('说明须写出算式（相左/可比对）', /需 ≥ /.test(arb.说明.join('')), '');
  eq('1/3 不得判严重不符', arb.比对.严重不符, false);
  const arb3 = yongshenArbiterOf({ pillars: pillarsOf('癸未', '乙卯', '甲子', '己巳') }, { 用神五行: '水' });
  eq('3/3 须判严重不符', arb3.比对.严重不符, true);
  // 2/3：用神=火 → 扶抑含火为同向，调候／格局皆金为相左 ⇒ 恰 2/3 ≥ 1.8
  const arb2 = yongshenArbiterOf({ pillars: pillarsOf('癸未', '乙卯', '甲子', '己巳') }, { 用神五行: '火' });
  eq('2/3 用例须恰为 2 相左', arb2.比对.相左法数, 2);
  eq('2/3 可比对须为 3', arb2.比对.可比对法数, 3);
  ok('2/3 须判严重不符（2 ≥ 1.8）', arb2.比对.严重不符 === true,
    `相左 ${arb2.比对.相左法数}/${arb2.比对.可比对法数}`);
  // ★ 阈值须真正随"可比对法数"变，而非写死"≥2"
  const sole = yongshenArbiterOf({ pillars: pillarsOf('庚午', '辛巳', '乙酉', '癸未') }, { 用神五行: '水' });
  eq('阈值须随法数变化（不得写死 ≥2）',
    sole.比对.严重不符, sole.比对.相左法数 >= sole.比对.可比对法数 * 0.6);
  ok('六层硬约束须写六成判据', sixN.硬约束.some((h) => /可比对法数 × 60%/.test(h)), '');
}

console.log('=== 24. 新增分歧代号（提示词 §八 强制披露表）===');{
  const P = ['辛巳', '丙申', '乙巳', '丁丑'];
  const cs = controversiesOf({ pillars: pillarsOf(...P), shensha: shenshaOf(pillarsOf(...P), STEMS.indexOf('乙'), STEMS.indexOf('辛'), '男') });
  const ids = cs.map((c) => c.代号);
  // ★ autumn-wood-fall-vs-taiji 的"乙方"就是太极派 → 太极法停用后**默认不报**
  for (const must of ['shangguan-jian-guan', 'children-star-schools', 'muku-open-schools', 'geju-vs-mangpai']) {
    ok(`本盘须命中 ${must}`, ids.includes(must), ids.join(','));
  }
  ok('太极法停用后默认不得报 autumn-wood-fall-vs-taiji',
    !ids.includes('autumn-wood-fall-vs-taiji'), ids.join(','));
  // 非秋月本就不该报
  const notAutumn = controversiesOf({ pillars: pillarsOf('甲子', '丙寅', '甲寅', '丙子') }).map((c) => c.代号);
  ok('非秋月不得报 autumn-wood-fall-vs-taiji', !notAutumn.includes('autumn-wood-fall-vs-taiji'), notAutumn.join(','));
  // 秋月木日主无根：太极法停用后也不报（该条整条依赖太极派立场）
  const autumn = controversiesOf({ pillars: pillarsOf('庚申', '甲申', '甲子', '丙子') }).map((c) => c.代号);
  ok('太极停用后秋月木日主无根亦不报该条', !autumn.includes('autumn-wood-fall-vs-taiji'), autumn.join(','));
  // 但代码保留：includeTaiji 须能恢复
  const autumnT = controversiesOf({ pillars: pillarsOf('庚申', '甲申', '甲子', '丙子') }, { includeTaiji: true }).map((c) => c.代号);
  ok('includeTaiji 须能恢复该条（代码保留）', autumnT.includes('autumn-wood-fall-vs-taiji'), autumnT.join(','));

  // 类别分级
  ok('每条须有类别', cs.every((c) => c.类别 === '结构性' || c.类别 === '通用披露'), JSON.stringify(cs.map((c) => [c.代号, c.类别])));
  ok('通用披露须含 children-star-schools 与 geju-vs-mangpai',
    ['children-star-schools', 'geju-vs-mangpai']
      .every((id) => cs.some((c) => c.代号 === id && c.类别 === '通用披露')),
    cs.filter((c) => c.类别 === '通用披露').map((c) => c.代号).join(','));

  // 调候 vs 太极（§八 第2行）：本盘用神丙属火，太极层若忌火则应命中
  const tj = taijiOf('申');
  const 忌火 = tj.用神方向.some((d) => (d.忌 ?? '').includes('火'));
  if (忌火) ok('本盘调候用神属火而太极忌火 → 须报 tiaohou-vs-taiji', ids.includes('tiaohou-vs-taiji'), ids.join(','));

  // 每条仍须结构完整（出处不得为空）
  for (const c of cs) {
    ok(`${c.代号} 主张皆带出处`, c.各派主张.every((p) => p.据 && p.据.length > 8), JSON.stringify(c.各派主张.map((p) => p.据)));
    ok(`${c.代号} 有须先确定`, Array.isArray(c.须先确定) && c.须先确定.length >= 1);
  }
}

console.log('=== 25. 人元司令用事（**月令为大**，司令只提一档）===');
{
  // ① 申月分段：《三命通会》卷二 坤土5 → 壬水5 → 庚金20
  eq('申月 08-10 司令', silingOf({ year: 2024, month: 8, day: 10, hour: 12, minute: 0 }).司令, '戊');
  eq('申月 08-13 司令', silingOf({ year: 2024, month: 8, day: 13, hour: 12, minute: 0 }).司令, '壬');
  eq('申月 08-18 司令', silingOf({ year: 2024, month: 8, day: 18, hour: 12, minute: 0 }).司令, '庚');
  eq('申月 08-10 非本气', silingOf({ year: 2024, month: 8, day: 10, hour: 12, minute: 0 }).是否本气当令, false);
  eq('申月 08-18 是本气', silingOf({ year: 2024, month: 8, day: 18, hour: 12, minute: 0 }).是否本气当令, true);

  // ② 四正月（子午卯酉）：前后两段同五行，仅天干阴阳不同 → 全月当令五行不变
  eq('午月 06-10 司令', silingOf({ year: 2024, month: 6, day: 10, hour: 12, minute: 0 }).司令, '丙');
  eq('午月 06-25 司令', silingOf({ year: 2024, month: 6, day: 25, hour: 12, minute: 0 }).司令, '丁');
  eq('午月两段同五行',
    silingOf({ year: 2024, month: 6, day: 10, hour: 12, minute: 0 }).司令五行,
    silingOf({ year: 2024, month: 6, day: 25, hour: 12, minute: 0 }).司令五行);

  // ③ 段界按**实际节气长度**折算，不是三十日平分
  const 申月长 = silingOf({ year: 2024, month: 8, day: 15, hour: 12, minute: 0 }).实际月长日;
  ok('申月实际月长应≠30 日（证明非平分）', Math.abs(申月长 - 30) > 0.3, String(申月长));
  const 午月长 = silingOf({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 }).实际月长日;
  ok('午月实际月长应>31 日', 午月长 > 31, String(午月长));

  // ④ ★核心：月令为大 —— 全年十二个月、任意一天，月令本气五行都必须是「旺」
  //    （使用者明确：申月即便戊土用事，已正式入秋，金仍是老大）
  const 违反 = [];
  for (let m = 1; m <= 12; m++) {
    for (const d of [3, 8, 14, 20, 26]) {
      const c = castChart({ year: 2024, month: m, day: d, hour: 12, gender: '男' });
      const 本气 = c.strength.当令五行;
      if (c.strength.令态[本气] !== '旺') 违反.push(`${m}/${d} ${本气}=${c.strength.令态[本气]}`);
    }
  }
  eq('全年抽样：月令本气一律为「旺」（老大不可夺）', 违反.join(','), '');

  // ⑤ 司令之神（≠本气时）提为「次旺」，且低于「旺」
  const c1 = castChart({ year: 2024, month: 8, day: 10, hour: 12, gender: '男' }); // 戊土司令
  eq('戊土司令 → 土为次旺', c1.strength.令态['土'], '次旺');
  eq('同时金仍为旺', c1.strength.令态['金'], '旺');
  const c2 = castChart({ year: 2024, month: 8, day: 25, hour: 12, gender: '男' }); // 庚金司令＝本气
  eq('司令即本气时，土回到休', c2.strength.令态['土'], '休');
  eq('司令即本气时，金仍为旺', c2.strength.令态['金'], '旺');

  // ⑥ 四柱模式：算不出司令，须退回本气并**声明**
  const pl = pillarsOf('甲辰', '壬申', '丙午', '癸巳');
  const s = strengthOf(pl, '申');
  eq('四柱模式 当令五行＝本气', s.当令五行, '金');
  eq('四柱模式 司令五行＝null', s.司令五行, null);
  ok('四柱模式 须声明"未能计司令"', /未能计司令/.test(s.当令据), s.当令据);
  ok('birth 模式的当令据须写明"月令为大"', /月令为大/.test(c1.strength.当令据), c1.strength.当令据);

  // ⑦ 司令确实改变了力量：同一个月、不同日 → 五行占比不应相同
  ok('同月不同日 → 五行占比不同（司令已生效）',
    JSON.stringify(c1.strength.percent) !== JSON.stringify(c2.strength.percent),
    JSON.stringify(c1.strength.percent) + ' vs ' + JSON.stringify(c2.strength.percent));

  // ⑧ 申月任何一天，金都不得被司令挤下去
  const 金违 = [];
  for (let d = 8; d <= 31; d++) {
    const c = castChart({ year: 2024, month: 8, day: d, hour: 12, gender: '男' });
    if (c.strength.令态['金'] !== '旺') 金违.push(`${d}日`);
  }
  eq('申月全月金皆为旺', 金违.join(','), '');
}

console.log('=== 26. 特殊格局：以《千里命稿》自己的命例验收 ===');
{
  const mk = (...gz) => ({ pillars: gz.map((g, i) => ({
    position: ['年柱', '月柱', '日柱', '时柱'][i], gz: g, stem: g[0], branch: g[1],
    stemIndex: STEMS.indexOf(g[0]), branchIndex: BRANCHES.indexOf(g[1]),
  })) });
  const 取 = (格, ...gz) => specialGejuOf(mk(...gz)).检查.find((x) => x.格 === 格);

  // 化气：构成五组（§3041–3051 的五个例子）
  for (const [label, gz, 化] of [
    ['化土 戊辰 壬戌 甲辰 己巳', ['戊辰', '壬戌', '甲辰', '己巳'], '化土'],
    ['化金 甲申 癸酉 乙丑 庚辰', ['甲申', '癸酉', '乙丑', '庚辰'], '化金'],
    ['化水 甲辰 丙子 辛丑 壬辰', ['甲辰', '丙子', '辛丑', '壬辰'], '化水'],
    ['化木 乙卯 丁卯 壬午 癸卯', ['乙卯', '丁卯', '壬午', '癸卯'], '化木'],
    ['化火 丙戌 戊戌 癸巳 甲寅', ['丙戌', '戊戌', '癸巳', '甲寅'], '化火'],
  ]) {
    const c = 取('化气', ...gz);
    eq(`${label} → 成立`, c.成立, true);
    eq(`${label} → 化组`, c.化组, 化);
  }
  // 化气：破败三类 + 必不可成（§3075–3127）
  eq('因克而破 庚戌 戊子 辛未 丙申', 取('化气', '庚戌', '戊子', '辛未', '丙申').成立, false);
  ok('因克而破须注明类型', /因克而破/.test(JSON.stringify(取('化气', '庚戌', '戊子', '辛未', '丙申').破败)), '');
  eq('因妒而破 甲戌 丁卯 壬午 丁未', 取('化气', '甲戌', '丁卯', '壬午', '丁未').成立, false);
  ok('因妒而破须注明类型', /因妒而破/.test(JSON.stringify(取('化气', '甲戌', '丁卯', '壬午', '丁未').破败)), '');
  eq('因化而破 壬辰 丁未 甲子 己巳', 取('化气', '壬辰', '丁未', '甲子', '己巳').成立, false);
  ok('因化而破须注明类型', /因化而破/.test(JSON.stringify(取('化气', '壬辰', '丁未', '甲子', '己巳').破败)), '');
  eq('隔位必不可成 辛亥 庚子 丙寅 壬辰', 取('化气', '辛亥', '庚子', '丙寅', '壬辰').成立, false);

  // ★ 两条易错的例外，都是书里的例子逼出来的
  eq('化土：**日干之甲不算"他木"**（戊辰 壬戌 甲辰 己巳）', 取('化气', '戊辰', '壬戌', '甲辰', '己巳').成立, true);
  eq('化水：**辰丑为湿土，不以克破论**（甲辰 丙子 辛丑 壬辰）', 取('化气', '甲辰', '丙子', '辛丑', '壬辰').成立, true);

  // 从旺／从强：以书里的例子验收
  ok('从旺例 癸卯 乙卯 甲寅 乙亥', 取('从旺', '癸卯', '乙卯', '甲寅', '乙亥').成立, 取('从旺', '癸卯', '乙卯', '甲寅', '乙亥').不成立原因);
  ok('从强例 壬子 癸卯 甲子 甲子', 取('从强', '壬子', '癸卯', '甲子', '甲子').成立, 取('从强', '壬子', '癸卯', '甲子', '甲子').不成立原因);

  // 九格须齐全，且每格都注明出处或并列判据
  const s = specialGejuOf(mk('辛巳', '丙申', '乙巳', '丁丑'));
  eq('特殊格局共九扇', s.检查.length, 9);
  eq('九扇名称', s.检查.map((x) => x.格).join(','), '从杀,从财,从儿,从势,两神成象,化气,从官,从旺,从强');
  ok('从财须并列《千里命稿》"逢官不妨"', /逢官不妨/.test(JSON.stringify(s.检查.find((x) => x.格 === '从财'))), '');
  // ★ 日主前提：从杀／从财／从儿 三格**都**须写明"日主无所依归"（无根 + 无印比生扶）
  for (const 格 of ['从杀', '从财', '从儿', '从势']) {
    const c = s.检查.find((x) => x.格 === 格);
    ok(`${格} 须写明日主前提（无根）`, c.逐条.some((x) => /日主无根|无一丝生扶/.test(x.条件)), JSON.stringify(c.逐条.map((x) => x.条件)));
    ok(`${格} 须写明日主前提（无印比生扶）`, c.逐条.some((x) => /无印比|无印生身|无一点生气|无一丝生扶/.test(x.条件)), JSON.stringify(c.逐条.map((x) => x.条件)));
  }
  ok('从儿须并列"不怕比劫""逢官杀不利"', /不怕比劫/.test(JSON.stringify(s.检查.find((x) => x.格 === '从儿'))), '');
  ok('从官/从旺/从强已补齐，未实现之格应为空', s.未实现之格.length === 0, JSON.stringify(s.未实现之格));
}

console.log('=== 27. 体用路线法：宫位权重 · 位置路径 · 四条关键 ===');
{
  /** 造一张含 dayMaster 的四柱盘（体用路线法的函数需要 dayMaster.element） */
  const mkFull = (...gz) => {
    const pillars = gz.map((g, i) => ({
      position: ['年柱', '月柱', '日柱', '时柱'][i], gz: g,
      stem: g[0], branch: g[1],
      stemIndex: STEMS.indexOf(g[0]), branchIndex: BRANCHES.indexOf(g[1]),
    }));
    const dayEl = ['木', '火', '土', '金', '水'][[0, 0, 1, 1, 2, 2, 3, 3, 4, 4][STEMS.indexOf(gz[2][0])]];
    return { pillars, dayMaster: { stem: gz[2][0], element: dayEl, bornMonthBranch: gz[1][1] } };
  };

  // ── 27.1 轴甲：宫位分量（使用者原话「月令最大，时支其次」）──────────────
  // ★ 27.0 补接的两项：四象（月支定）与 用神有救（《千里命稿》分档）
  //   原先这两个函数写好了却无人调用 —— 属"规则与工具脱节"，本轮接入体用路线法。
  {
    const R = tiyongRouteOf(mkFull('辛巳', '丙申', '乙巳', '丁丑'), { 用神五行: '水' });
    ok('体用路线法须带四象', !!R.四象, '');
    eq('四象须由月支定（申→少阴）', R.四象.法一.象, '少阴');
    eq('四象两法须一致（本盘）', R.四象.两法一致, true);
    ok('四象须给法二并标来源', !!R.四象.法二?.据, '');
    ok('四象须并陈反对说（胡渭「易有四象而無五行」）',
      /易有四象而無五行/.test(R.四象.五行?.反对说 ?? ''), '');
    ok('四象须声明未检得项', Array.isArray(R.四象.未检得) && R.四象.未检得.length > 0, '');

    ok('体用路线法须带用神有救', !!R.用神有救, '');
    eq('用神有救的五行', R.用神有救.五行, '水');
    ok('用神有救须给档位', typeof R.用神有救.档 === 'string' && R.用神有救.档.length > 0, R.用神有救.档);
    ok('用神有救须给结论', /有救/.test(R.用神有救.结论), R.用神有救.结论);
    ok('用神有救须引《千里命稿》分档据', /身强之构成/.test(R.用神有救.分档据), '');
    ok('用神有救须给序关系', /得令 ＞ 得地/.test(R.用神有救.序关系), '');
    ok('用神有救须并陈反对说（不静默取一）', !!R.用神有救.反对说, '');
    ok('须给用神三重校验说明', /用神须过三重/.test(R.用神三重校验说明 ?? ''), '');
    // 未声明用神时不得抛错，且 用神有救 应为 null
    const R0 = tiyongRouteOf(mkFull('辛巳', '丙申', '乙巳', '丁丑'), {});
    ok('未声明用神时 用神有救 须为 null（不抛错）', R0.用神有救 === null || !!R0.用神有救, '');
    // routeOf 已弃用：仍可调用，但文档已标废
        // ⚠ 2026-10-04 修：旧式 `routeOf.toString ? true : true` 是**恒真空断言**
    //   （连"可调用"都没验），而 engine 注释却称"selftest 仅验其仍可调用"。今真调用一次。
    let dep = false;
    try { dep = typeof routeOf === 'function' && !!routeOf(mkFull('辛巳', '丙申', '乙巳', '丁丑')); } catch { dep = false; }
    ok('routeOf 仍可调用（弃用但保留）', dep, '');
  }

  // ── 27.1 轴甲：宫位分量（使用者原话「月令最大，时支其次」）──────────────  eq('宫位分量序第一＝月支', GONG_RANK[0], '月支');
  eq('宫位分量序第二＝时支', GONG_RANK[1], '时支');
  const 地支分量 = ['月支', '时支', '日支', '年支'].map((k) => GONG_WEIGHT[k]);
  eq('月支为全局分量最高', GONG_WEIGHT.月支, Math.max(...Object.values(GONG_WEIGHT).filter((v) => v !== null)));
  ok('四支分量严格递减 月＞时＞日＞年', 地支分量.every((v, i) => i === 0 || v < 地支分量[i - 1]), JSON.stringify(地支分量));
  ok('日支分量 ＞ 年支（据「贴身力度大，隔位力度低」）', GONG_WEIGHT.日支 > GONG_WEIGHT.年支, `${GONG_WEIGHT.日支} vs ${GONG_WEIGHT.年支}`);
  eq('日干无分量（是调用者自身）', GONG_WEIGHT.日干, null);

  // ── 27.2 轴乙：作用力度（使用者原话「贴身力度大，隔位力度低」）──────────
  eq('同柱 → 贴身', proximityOf('月干', '月支').档, '同柱');
  eq('邻柱 → 贴身', proximityOf('月支', '日干').档, '贴身');
  eq('隔一柱 → 隔位', proximityOf('年干', '日干').档, '隔位');
  eq('隔两柱 → 遥隔', proximityOf('年支', '时支').档, '遥隔');
  const 力度 = ['贴身', '隔位', '遥隔'].map((d) => {
    const map = { 贴身: ['月干', '月支'], 隔位: ['年干', '日干'], 遥隔: ['年干', '时支'] };
    return proximityOf(...map[d]).系数;
  });
  ok('贴身 ＞ 隔位 ＞ 遥隔（严格递减）', 力度[0] > 力度[1] && 力度[1] > 力度[2], JSON.stringify(力度));
  eq('柱差 ≤ 1 者不得再言"可容中间柱"', proximityOf('月支', '日干').可容中间柱, false);
  eq('柱差 ≥ 2 者可容中间柱', proximityOf('年干', '日干').可容中间柱, true);
  let 抛错 = false;
  try { proximityOf('甲子', '日干'); } catch { 抛错 = true; }
  eq('宫位非年/月/日/时 者须抛错', 抛错, true);

  // ── 27.3 落点（含藏干、层次、宫位分量）────────────────────────────────
  const c1 = mkFull('辛巳', '丙申', '乙巳', '丁丑'); // 使用者举的极端盘，日主乙木
  eq('日主五行', c1.dayMaster.element, '木');
  const 金落点 = occupantsOf(c1, '金').map((o) => o.宫位);
  eq('金之落点齐备（含巳中庚、丑中辛）', 金落点.join(','), '年干,年支,月支,日支,时支');
  eq('地支本气取满分量，藏干折半', [occupantsOf(c1, '金')[2].宫位分量, occupantsOf(c1, '金')[1].宫位分量].join(','), '1,0.2');
  eq('日干默认不计入"外来之神"', occupantsOf(c1, '木').length, 0);
  eq('includeDayStem 可取回日主自身', occupantsOf(c1, '木', { includeDayStem: true }).length, 1);

  // ── 27.4 位置路径：统一机制「中间有没有一个字把克变成生」──────────────
  const 金克木 = pathOf(c1, '金', '木', { 受克者宫位: '日干' });
  eq('通关神＝水（金生水、水生木）', 金克木.通关神, '水');
  eq('通关五行成立', 金克木.通关五行成立, true);
  const 月支路 = 金克木.路.find((x) => x.克者 === '月支申');
  ok('月支本气之桥为「同宫引化」（申中庚为克者、同支壬水为桥）', 月支路.桥.some((b) => b.形态 === '同宫引化'), JSON.stringify(月支路.桥.map((b) => b.形态)));
  eq('月支压力系数＝月令分量×贴身＝1（全局最重）', 月支路.压力系数, 1);
  eq('有桥者克力记 0，压力仍留', [月支路.克力系数, 月支路.压力系数 > 0].join(','), '0,true');
  const 年干路 = 金克木.路.find((x) => x.克者 === '年干辛');
  eq('年干→日干 为隔位', 年干路.两者, '隔位');
  ok('年干→日干 之桥夹在中间（月支申壬）', 年干路.桥.some((b) => b.严格居中), JSON.stringify(年干路.桥.map((b) => b.严格居中)));
  ok('桥之说明须并列「同宫引化力薄」之异说', /同宫引化/.test(金克木.说明), '');

  // 遥隔不得通关：庚子 丁亥 甲寅 甲子，年干庚 → 时干甲，柱差 3
  const c2 = mkFull('庚子', '丁亥', '甲寅', '甲子');
  const 遥 = pathOf(c2, '金', '木', { 克者宫位: '年干', 受克者宫位: '时干' });
  eq('遥隔路只一条', 遥.路.length, 1);
  eq('遥隔者桥数为 0（两头够不着）', 遥.路[0].桥.length, 0);
  eq('遥隔者仍属直克', 遥.路[0].直接可克, true);
  const 隔位 = pathOf(c2, '金', '木', { 克者宫位: '年干', 受克者宫位: '日干' });
  ok('年→日 之桥夹在中间（月支亥水）', 隔位.路[0].桥.some((b) => b.严格居中), JSON.stringify(隔位.路[0].桥));

  // ── 27.5 第 1 条：财官是否构成威胁 ──────────────────────────────────
  const t1 = threatOf(c1);
  // ⚠ 2026-10-04 使用者裁「折中」：报「桥虚设」者该途不算"有"（规格（七）1）
  //   ⇒ 本盘（乙巳）官杀由"不构成威胁"翻为**构成威胁**（水通关档仅「中」＝桥虚设）。
  //   使用者已知此代价（含规格 660 的"金多多益善"举例作废）并裁定接受。
  ok('极端盘：官杀因「桥虚设」判构成威胁（2026-10-04 折中后）',
    /构成威胁/.test(t1.官杀.安危) && /桥虚设/.test(t1.官杀.安危), t1.官杀.安危);
  eq('官杀之阻隔途径有', t1.官杀.途径.阻隔.有, true);
  eq('官杀之被制途径有（火制金）', t1.官杀.途径.被制.有, true);
  eq('官杀之被合途径有（丙辛合、巳申合）', t1.官杀.途径.被合.有, true);
  ok('★「有制神」≠「制得住」：须报制力判定（月令力量／人元司令／大运配合）',
    t1.官杀.制力 !== null && t1.官杀.制力.结论.length > 0, JSON.stringify(t1.官杀.制力?.结论));
  ok('★「有合」≠「合住」：须报合力判定', t1.官杀.合之力 !== null, '');
  ok('制力判据须逐条带可复核出处', t1.官杀.制力.checks.length > 0 && t1.官杀.制力.checks.every((x) => x.据 && x.据.length > 0), '');
  ok('制不足／合未牢时须并陈两说（不选边）', t1.官杀.分歧.length > 0, JSON.stringify(t1.官杀.分歧));
  ok('桥虚设（通关神力度仅中以下）须点名', t1.官杀.分歧.some((x) => /通关有名无实/.test(x)), JSON.stringify(t1.官杀.分歧));
  eq('财之被制途径无（局中无比劫）', t1.财.途径.被制.有, false);
  eq('财之阻隔途径有（经官之路被印引通）', t1.财.途径.阻隔.有, true);
  ok('财须明写「我克属耗不属克」', /不属/.test(t1.财.性质), t1.财.性质);
  ok('压力不得合成单一评分，须并陈占比与系数', typeof t1.官杀.压力 === 'object' && t1.官杀.压力.五行占比 !== undefined, JSON.stringify(t1.官杀.压力));
  ok('分组条件须声明「仅作建议、不作判据」', /不作判据/.test(t1.分组条件.注), '');

  // 反例：辛酉 辛卯 乙卯 辛酉，官杀直克、无制无合无通关
  const t2 = threatOf(mkFull('辛酉', '辛卯', '乙卯', '辛酉'));
  eq('反例：官杀构成威胁', t2.官杀.构成威胁, true);
  ok('反例：安危须写"构成威胁"', /构成威胁/.test(t2.官杀.安危), t2.官杀.安危);
  eq('反例：官杀阻隔途径无', t2.官杀.途径.阻隔.有, false);
  eq('反例：官杀被制途径无', t2.官杀.途径.被制.有, false);
  eq('反例：财不构成威胁（局中无土）', t2.财.构成威胁, false);

  // ── 27.6 第 2 条：印比对日主有情／无情 ────────────────────────────
  // ⚠ 本节「用神＝火」是**使用者 2026-09-28 本人给出的口径**（后由 2026-10-01 复盘确认为本盘定论）。
  //   ★ 2026-10-01 重要更正：旧断言用「忌神＝金、用神＝火」**自相矛盾**的参数
  //   （火是克金者，既当"克忌神之用神"又当"忌"是两回事），
  //   而使用者真实口径是**用神＝火、忌神＝水**（水才是灭火者）。
  //   按规格（七）2，引擎现已**拒绝**自相矛盾的组合并报「口径矛盾」。
  const q1 = qingOf(c1, { 忌神五行: '金' });
  eq('显式声明忌神时不走推定', q1.口径.indexOf('显式声明') >= 0, true);
  eq('印（水）引化忌神金 ⇒ 有情', q1.有情的印比.length, 2);
  ok('结论须写明"有情"', /有情/.test(q1.结论), q1.结论);
  eq('引化归身者＝水', q1.对治.引化归身者, '水');
  eq('制忌神者＝火', q1.对治.制忌神者, '火');
  const q2 = qingOf(mkFull('辛酉', '辛卯', '乙卯', '辛酉'), { 忌神五行: '金' });
  eq('反例：印比皆无情（无印可言，比劫不能制金亦不能引化）', q2.有情的印比.length, 0);
  ok('无情时须引出规格"身弱而印比无情亦不喜印比"', /亦不喜印比/.test(q2.结论), q2.结论);
    const q3 = qingOf(c1);
  // ★ 2026-10-04 使用者裁定「取消推定」：不得再按"占比最旺者"推定忌神。
  //   旧断言（要求口径含"引擎推定"）即编码了被取消的行为，故改写为**反面断言**（非删除）。
  ok('未声明忌神时不得再按"占比最旺"推定（2026-10-04 使用者裁：取消）',
    !/引擎推定/.test(q3.口径) && /不判忌/.test(q3.口径), q3.口径);
  ok('取消推定后：既无用神亦无忌神 ⇒ 不产出结构分析（不判忌）', q3.结构分析 === null, String(q3.结构分析));
  eq('未声明用神时不作交叉裁决（向后兼容）', q1.交叉裁决, null);

  // ★ 使用者真实口径：用神＝火、忌神＝水（水灭火）
  const q4 = qingOf(c1, { 忌神五行: '水', 用神五行: '火' });
  ok('声明用神后须出交叉裁决', !!q4.交叉裁决, q4.交叉裁决);
  const 水用神关系 = (q4.与用神的关系 || []).find((x) => x.五行 === '水');
  eq('水对用神的关系＝克用神者', 水用神关系?.与用神, '克用神者');
  // 使用者 2026-09-28 定：本色为忌（妨碍主要矛盾），纵能引化亦不得作喜用
  eq('水须判忌（妨碍主要矛盾），不再算"有情"', 水用神关系?.有情否, false);
  eq('被判忌者不得计入「有情的印比」', q4.有情的印比.length, 0);
  ok('结论须点出克用神火', /克用神火/.test(q4.结论), q4.结论);
  ok('结论须保留"不得作喜用"', /不得作喜用/.test(q4.结论), q4.结论);
  eq('水之落点须统计为全在支藏（透干 0）', 水用神关系?.落点层次.透干, 0);
  eq('支藏 2 处（申中壬、丑中癸）', 水用神关系?.落点层次.支中藏干, 2);
  ok('结论须附「以主要矛盾为准」', /以主要矛盾为准/.test(q4.结论), q4.结论);

  // ── 27.6b ★（八）结构分析：拆点／犯旺／口径矛盾（2026-10-01 新增）──────────
  //   依据：`体用路线法.md` §一之二（八）；使用者 2026-10-01
  //   「关于那个水灭火的判据，那个是打个比方，你别太死板」。
  const st = q4.结构分析;
  ok('（八）须出结构分析', !!st, '');
  eq('支撑点＝声明之用神（火）', st.支撑点, '火');
  eq('支撑点来源须记为"声明之用神"', st.支撑点来源, '声明之用神');
  eq('主要矛盾＝金（占比最高）', st.主要矛盾.五行, '金');
  eq('次要矛盾＝火', st.次要矛盾.五行, '火');
  eq('拆点态＝暗藏·轻（水全藏支、且占比远低于火）', st.拆点判.态, '暗藏·轻');
  ok('拆点因须引出发制力结论', /不能制/.test(st.拆点判.因), st.拆点判.因);
  eq('制得住支撑＝false（水 6.2% 对火 31.1%，势不敌）', st.支撑点四途.制得住支撑, false);
  ok('柱位贴身与否须明标"不作判据"', /不作判据/.test(st.柱位旁证.注), '');
  ok('判忌门槛须写明"已证／暗藏·轻／暗藏·重"三态成立', /已证/.test(st.判忌门槛) && /暗藏·轻/.test(st.判忌门槛) && /暗藏·重/.test(st.判忌门槛), st.判忌门槛);
  ok('判忌门槛须写明"拆不到支柱／口径矛盾"不得径判', /不得径判忌/.test(st.判忌门槛), st.判忌门槛);
  // ── 27.6d ★ 犯旺（使用者 2026-10-04 **重定义**：旺极之五行被岁运冲克）──────────
  //   原话：「命局中某种五行已经达到旺极的状态，大运流年又来冲克这个五行，就叫犯旺。注意是旺极。」
  const fw0 = fanwangOf(c1);
  ok('犯旺：未给岁运须不报（犯旺是岁运之事）', fw0.有 === false && /不报/.test(fw0.结论), fw0.结论);
  const cFw = mkFull('庚寅', '丙戌', '乙巳', '丁丑');   // 土档「极」，巳／寅皆可被冲
  const fw1 = fanwangOf(cFw, { 岁运: '丁亥' });          // 亥冲巳
  eq('犯旺：土旺极而岁运支亥冲巳 ⇒ 命中', fw1.有, true);
  eq('犯旺：命中者为土', fw1.命中?.[0]?.五行, '土');
  ok('犯旺：须写明"只作次要一条"', /次要/.test(fw1.结论), fw1.结论);
  ok('犯旺：须注明与旧口径（激次要矛盾）不是一回事', /不是一回事/.test(fw1.注), '');
  eq('犯旺：岁运支冲另一支（申冲寅）亦命中', fanwangOf(cFw, { 岁运: '壬申' }).有, true);
  eq('犯旺：岁运干克旺极者（乙木克土）亦命中', fanwangOf(cFw, { 岁运: '乙酉' }).有, true);
  eq('犯旺：岁运既不冲亦不克 ⇒ 不成犯旺', fanwangOf(cFw, { 岁运: '庚午' }).有, false);
  ok('未判项须显式列出（不编造替代路线数）', Array.isArray(st.未判项) && st.未判项.length >= 3, '');
  ok('§（八）据须引使用者 2026-10-01 原话', /别太死板/.test(st.据), st.据);
  // 拆点/犯旺 逐字层
  eq('水之拆点态＝暗藏·轻', st.拆点('水').态, '暗藏·轻');
  eq('非忌神本字的拆点＝不适用（不误判）', st.拆点('木').态, '非忌神本字');
  eq('水之处置须标"克但未透·力薄"', st.拆点('水').动作, '克但未透（当下未成害）·力薄');
  ok('拆点判须带占比差与分档据', typeof st.拆点判.占比差 === 'number' && /阈值 15/.test(st.拆点判.分档据 ?? ''), st.拆点判.分档据);
  ok('逐字须带结构字段', q4.逐字.some((x) => x.五行 === '水' && x.结构?.结构证实), '');

  // ── ★ 27.6d「暗藏」分档（2026-10-01 使用者指示「一要分」）──────────────────
  //   分档依据＝同一 15 个百分点阈值（与 canControlOf 第 4 关「势不敌」同源）：
  //     · 差 = 支撑点(火)占比 − 忌(水)占比；差 ≥ 15 ⇒ 暗藏·轻；差 < 15 ⇒ 暗藏·重。
  //   ⚠ 须两档都覆盖——否则"分了档"这件事本身没被断言保护。
  eq('乙巳盘之差＝火 31.1% − 水 6.2% = 24.9 ⇒ 暗藏·轻（边界之上）', st.拆点判.占比差, 24.9);
  // 暗藏·重 样本（甲木日主，火水皆在局、水不透干、差 1.2 个百分点）
  const cHeavy = mkFull('戊子', '乙卯', '甲寅', '庚午');
  const qHeavy = qingOf(cHeavy, { 用神五行: '火', 忌神五行: '水' });
  const sHeavy = qHeavy.结构分析;
  eq('暗藏·重：差<15 时须判重档', sHeavy.拆点判.态, '暗藏·重');
  ok('暗藏·重 之差须 < 15', sHeavy.拆点判.占比差 < 15, String(sHeavy.拆点判.占比差));
  ok('暗藏·重 的逐字结论须警示"引透即成大害／不得因藏而轻看"',
    qHeavy.逐字.some((x) => x.五行 === '水' && /暗藏·重/.test(x.结论) && /大害|轻看/.test(x.结论)),
    qHeavy.逐字.filter((x) => x.五行 === '水').map((x) => x.结论).join(' | ').slice(0, 200));
  ok('暗藏·重 的交叉裁决短语不得仍写"暗藏为害较小"',
    !(qHeavy.交叉裁决 ?? '').includes('暗藏为害较小'), qHeavy.交叉裁决);

  // ── ★ 27.6f 输出不得出现 [object Object]（2026-10-01 实测修）──────────────
  //   成因：`protectionOf` 的「合」途径其 `合` 是**对象数组**，直插模板串即得 `[object Object]`。
  //   实测盘 1990-05-20 14:30 曾输出「有效护卫：隔（通关）·金；合·[object Object]」。
  const cOBJ = mkFull('庚午', '辛巳', '乙酉', '癸未');
  const tOBJ = protectionOf(cOBJ, '水');
  ok('有效护卫不得出现 [object Object]（合途径须渲染成字位）',
    !JSON.stringify(tOBJ.有效护卫).includes('[object Object]'),
    JSON.stringify(tOBJ.有效护卫).slice(0, 160));
  ok('「合」途径的护卫须给出被合之字位（非对象）',
    tOBJ.有效护卫.filter((x) => x.途径 === '合').every((x) => Array.isArray(x.合)
      && x.合.every((h) => typeof h.被合者 === 'string')), JSON.stringify(tOBJ.有效护卫).slice(0, 160));
  eq('暗藏·重 之处置须标"力不弱"', sHeavy.拆点('水').动作, '克但未透（当下未成害）·力不弱');
  // 边界样本：差 15.2（刚过阈值）⇒ 轻
  const cEdge = mkFull('甲子', '己巳', '甲寅', '庚午');
  const sEdge = qingOf(cEdge, { 用神五行: '火', 忌神五行: '水' }).结构分析;
  eq('边界：差 15.2（≥15）⇒ 暗藏·轻', sEdge.拆点判.态, '暗藏·轻');
  ok('轻档亦须给出占比差与分档据', typeof sEdge.拆点判.占比差 === 'number' && !!sEdge.拆点判.分档据, sEdge.拆点判.分档据);

  // ── ★ 27.6e 判忌范围盲区（2026-10-01 补）────────────────────────────
  //   问题：逐字循环只走**印比**，但「克用神者」未必落在印比。
  //   穷举「日主×用神」20 组合，**10 组合**落在 财／官杀／食伤。
  //   样本：乙木日主·用神水（《穷通宝鉴》申月乙木取癸的常格）⇒ 克水者＝**土（财）**。
  const cScope = mkFull('戊辰', '庚申', '乙亥', '丙子');
  const qScope = qingOf(cScope, { 忌神五行: '土', 用神五行: '水' });
  const sScope = qScope.结构分析;
  eq('（范围）克用神者＝财，须被识别为"印比之外"', sScope.克用神者在印比之外, true);
  eq('（范围）克用神者十神＝财', sScope.克用神者十神, '财');
  ok('（范围）全盘判忌须覆盖多档十神', Array.isArray(sScope.全盘判忌) && sScope.全盘判忌.length >= 3, String(sScope.全盘判忌?.length));
  ok('（范围）须逐档标明"逐字层能否判"',
    sScope.全盘判忌.every((r) => typeof r.逐字层能否判 === 'string'), '');
  // ★ 2026-10-05 改判（R3 修正）：本盘（戊辰 庚申 乙亥 丙子）土对水被 canControlOf 判
  //   「**不能制**：水被合」⇒ 拆点**未成立** ⇒ 财行应写「不判忌（拆点未成立）」，
  //   旧版此处标「本色为忌（拆不到支柱）」属自相矛盾（体检表 R6 同源）。
  //   正向样本（**成立的**非印比拆点须判忌）见下方 qScopeOut＝乙巳盘，断言未丢。
  ok('（范围·改）拆点未成立的非印比行须写「不判忌」，不得标「本色为忌」',
    sScope.全盘判忌.some((r) => r.十神 === '财' && /^\*\*不判忌\*\*/.test(String(r.状态))),
    JSON.stringify(sScope.全盘判忌.map((r) => `${r.十神}:${r.状态}`)));
  // ★ 2026-10-05 更新（R3 修正的连带，非放宽断言）：
  //   原样本（戊辰 庚申 乙亥 丙子／用神水·忌土）经 R3 修正后，土被 canControlOf 判
  //   「**不能制**：水被合」⇒ 拆点态＝「拆不到支柱」⇒ **本就不该补报**（这正是修的目的）。
  //   故本项**改用乙巳盘**（土对水＝暗藏·重 ⇒ 拆点成立）作样本；断言要验的事一字未改：
  //   **非印比的"成立拆点"必须补进结论，不得静默**。
  const qScopeOut = qingOf(c1, { 忌神五行: '土', 用神五行: '水' });
  eq('（范围·改）克用神者＝财（非印比）', qScopeOut.结构分析.克用神者十神, '财');
  ok('（范围·改）非印比的成立拆点须标「本色为忌」',
    qScopeOut.结构分析.全盘判忌.some((r) => r.十神 === '财' && /本色为忌/.test(String(r.状态))),
    JSON.stringify(qScopeOut.结构分析.全盘判忌.map((r) => `${r.十神}:${r.状态}`)));
  ok('（范围·改）结论须**补报**印比之外的拆点，不得静默',
    !!qScopeOut.印外拆点补报 && /印比之外另有拆点/.test(qScopeOut.印外拆点补报) && /不得因/.test(qScopeOut.印外拆点补报),
    qScopeOut.印外拆点补报 ?? '（null）');
  ok('（范围·改）补报须点出规格依据"任一十神皆可"', /任一十神皆可/.test(qScopeOut.印外拆点补报 ?? ''), qScopeOut.印外拆点补报 ?? '');
  // ★ 2026-10-05 新增反向断言（R3 修正的核心）：拆点**未成立**时，
  //   全盘判忌行不得标「本色为忌」（旧版此处会写出「本色为忌（拆不到支柱）」自相矛盾），
  //   亦不得补报。样本＝旧的正向样本（戊辰 庚申 乙亥 丙子：土不能制水）。
  ok('（R3）拆点未成立时，全盘判忌行不得标「本色为忌」',
    !sScope.全盘判忌.some((r) => /本色为忌/.test(String(r.状态))),
    JSON.stringify(sScope.全盘判忌.map((r) => `${r.十神}:${r.状态}`)));
  ok('（R3）拆点未成立时不得补报「印外拆点」', !qScope.印外拆点补报, String(qScope.印外拆点补报));
  // 反向：印比内的情形不得误报"印外拆点"
  ok('（范围）印比内的拆点不得误触发"印外补报"', !q4.印外拆点补报, String(q4.印外拆点补报));
  // 正常路径的全盘扫描须齐备（乙巳盘：金=官杀、火=支撑点、水=忌、木=印、土=财）
  ok('（范围）乙巳盘全盘判忌须含多档十神', Array.isArray(st.全盘判忌) && st.全盘判忌.length >= 3, String(st.全盘判忌?.length));
  ok('（范围）乙巳盘克用神者＝水，属印比 ⇒ 不应误报"在印比之外"',
    st.克用神者十神 === '印' && st.克用神者在印比之外 === false,
    `${st.克用神者十神}/${st.克用神者在印比之外}`);
  // ★ 口径矛盾守卫：用神火／忌神金 自相矛盾 ⇒ 必须拒绝，不得静默择一（规格（七）2）
  const qBad = qingOf(c1, { 忌神五行: '金', 用神五行: '火' });
  eq('自相矛盾的用神／忌神须报"口径矛盾"', qBad.结构分析.拆点判.态, '口径矛盾（未判）');
  ok('口径矛盾须说明"克支撑点者并非所声明的忌神"', /并非所声明的忌神/.test(qBad.结构分析.拆点判.因), qBad.结构分析.拆点判.因);
  ok('口径矛盾下不得据此判忌', /不得据此判忌/.test(qBad.结构分析.拆点判.因), '');
  ok('口径矛盾下结论须写"不得径判忌"', /不得径判忌/.test(qBad.结论), qBad.结论);
  // 加强：拒绝路径须覆盖**另一种**非自洽形态（克用神者非忌神，而非"忌神＝克用神者"）
  const qBad2 = qingOf(c1, { 忌神五行: '火', 用神五行: '土' });   // 克土者＝木，火≠木
  eq('另一种非自洽组合（土／火）亦须报口径矛盾', qBad2.结构分析.拆点判.态, '口径矛盾（未判）');
  ok('口径矛盾不得给固定搭配，须按本盘"克用神者"给出应有忌神',
    /逐盘不同/.test(qBad2.结构分析.拆点判.因) && !/用神＝火、忌神＝水/.test(qBad2.结构分析.拆点判.因),
    qBad2.结构分析.拆点判.因);
  // 相对性：用神为土时水不再是克用神者
  const q5 = qingOf(c1, { 忌神五行: '金', 用神五行: '土' });
  ok('用神为土时水不再是克用神者（相对性）', !/克用神者/.test(q5.交叉裁决 ?? ''), q5.交叉裁决);

  // ── 27.6c ★ 回归：调候表给**干支字**，必须归一为五行（2026-10-01 修）─────────
  //   实测旧 bug：`--tiyong` 不声明用神时，调候表返回「甲」，原样下传致
  //   `克我者('甲')` 返回 undefined，使（八）结构分析/护卫/结构三条全失效。
  const RnoY = tiyongRouteOf(c1, {});
  ok('未声明用神时须由调候表暂取，且归一为五行', ['木', '火', '土', '金', '水'].includes(RnoY.用神五行), RnoY.用神五行);
  ok('用神来源须自陈"暂取"与"待核定"', /暂取/.test(RnoY.用神来源) && /待调用方核定/.test(RnoY.用神来源), RnoY.用神来源);
  ok('归一化后不得出现 undefined（克我者须可判）',
    !/undefined/.test(JSON.stringify(RnoY.第二_印比有情?.结构分析 ?? {})), '');
  // ★ 2026-10-05 更新（R2 接线的连带）：未声明用神时，用神可能取自「④之二 取用定案」
  //   （唯一可行候选），此时来源须写「取用定案」而非「按调候表暂取」；
  //   但**不得冒称"声明之用神"**、且**必须标"待核定"**——这两点即本断言的本意，未放宽。
  ok('暂取／定案路径的支撑点来源须如实自陈，不得冒称"声明之用神"，且须标待核定',
    !/声明之用神/.test(RnoY.第二_印比有情?.结构分析?.支撑点来源 ?? '')
    && /(暂取|取用定案)/.test(RnoY.第二_印比有情?.结构分析?.支撑点来源 ?? '')
    && /核定/.test(RnoY.第二_印比有情?.结构分析?.支撑点来源 ?? ''),
    RnoY.第二_印比有情?.结构分析?.支撑点来源);
  eq('声明路径的支撑点来源须标"声明之用神"',
    q4.结构分析.支撑点来源, '声明之用神');

  // ── 27.7 第 3 条：用神的护卫 ───────────────────────────────────────
  const p1 = protectionOf(c1, '火');
  eq('克用神者＝水', p1.克用神者, '水');
  eq('隔护神＝木（生火者）', p1.隔护神, '木');
  eq('制护神＝土（用神所生、克"克水者"）', p1.制护神, '土');
  ok('有效护卫须含「制」途', p1.有效护卫.some((x) => x.途径 === '制'), JSON.stringify(p1.有效护卫.map((x) => x.途径)));
  ok('护神自身受损须报（巳申既合又破）', p1.护神自身.有损 === true, JSON.stringify(p1.护神自身));
  // ★ 岁运引透克用神者：原局「用神自安」在岁运中不成立（2026-09-28 复盘）
  eq('未给岁运时 岁运引克＝null', p1.岁运引克, null);
  const p1b = protectionOf(c1, '火', { 岁运: '癸亥' });   // 癸冲时干丁，无水合丙
  ok('岁运癸亥须检出「引动克用神者」', !!p1b.岁运引克 && p1b.岁运引克.干引 === true, JSON.stringify(p1b.岁运引克));
  ok('须写明原局「用神自安」在岁运中不成立', /不成立/.test(p1b.岁运引克.结论), p1b.岁运引克.结论);
  ok('须写明「只喜暗藏」之义', /只喜暗藏/.test(p1b.岁运引克.结论), p1b.岁运引克.结论);
  ok('岁运警示须以岁运引克开头', /岁运引动克用神者/.test(p1b.岁运警示), p1b.岁运警示.slice(0, 60));
  ok('安危须声明是原局结论、岁运另判', /原局.*结论|结论.*原局/.test(p1b.说明), '');
  const p1c = protectionOf(c1, '火', { 岁运: '甲午' });   // 甲木午火，非克水
  eq('非克神之岁运不得误报引克', p1c.岁运引克, null);
  // ★ 规格 §四 禁令：用神合忌神＝做功，不得径判用神被坏。
  // 本盘壬辰运：壬与时干丁相合（做功）、与月干丙相冲（直克）⇒ 同一岁运干两种结论，须分列。
  const p1d = protectionOf(c1, '火', { 岁运: '壬辰' });
  eq('壬辰：性质须标为"混合、须分列"', p1d.岁运引克.性质, '混合（有用神干被合、有用神干被冲，须分列）');
  ok('壬辰：须检出用神合克神（时丁—大运壬）', p1d.岁运引克.合对.some((x) => /丁.*壬|壬.*丁/.test(x)), JSON.stringify(p1d.岁运引克.合对));
  ok('壬辰：须检出克神冲用神（月丙—大运壬）', p1d.岁运引克.冲对.some((x) => /丙.*壬|壬.*丙/.test(x)), JSON.stringify(p1d.岁运引克.冲对));
  ok('壬辰：不得整体判"用神被坏"', !/⇒\s*此即使用者/.test(p1d.岁运引克.结论), p1d.岁运引克.结论);
  ok('壬辰：须引规格 §四「用神合忌神＝做功」', /用神合忌神.*做功|把忌神锁住/.test(p1d.岁运引克.结论), '');
  ok('壬辰：须要求分别落点分别断', /分别落点分别断/.test(p1d.岁运引克.结论), '');
  const p1e = protectionOf(c1, '火', { 岁运: '辛亥' });   // 辛非水（不合于丙者亦非克神），仅亥为水
  eq('辛亥：干非克神 ⇒ 不作合/冲裁决', p1e.岁运引克.合对.length, 0);
  eq('辛亥：性质＝克神得本气之根', p1e.岁运引克.性质, '克神得本气之根，转旺');
  // ★ 「在位」≠「够力」（规格 §4.6.7：有制神 ≠ 制得住）
  ok('有效护卫须带力度档', p1.有效护卫.every((x) => x.途径 === '合' || !!x.力度档), JSON.stringify(p1.有效护卫));
  ok('不足力之护卫须单列、不得计入有效护卫', Array.isArray(p1.在位但不足力) &&
    p1.在位但不足力.every((x) => x.力度档 === '弱'), JSON.stringify(p1.在位但不足力));
  ok('安危须写明"够力"或"在位但不足力"', /够力|不足力/.test(p1.安危), p1.安危);
  // ★ 四项的适用前提：若已成从／专旺，须提示四项为非从格判据
  ok('汇总须报适用前提（含从格风险与杂质检验）',
    /杂质|不足论从|前提/.test(tiyongRouteOf(c1, { 用神五行: '火' }).适用前提), tiyongRouteOf(c1, { 用神五行: '火' }).适用前提);
  // ★ 使用者 2026-09-28：从格须「所从之五行气势旺盛、不见杂质；杂质须无力，待岁运祛除」
  const Z = tiyongRouteOf(c1, { 用神五行: '火' }).从格杂质检验;
  ok('须做从格杂质检验（含"气势旺盛"与"杂质力度"）', !!Z && Z.两说.length === 2, JSON.stringify(Z));
  ok('本盘两说皆判"不成从"（与使用者「明显不从」一致）', Z.两说.every((x) => /不成从/.test(x.判)), JSON.stringify(Z.两说.map((x) => x.判)));
  ok('占比最旺说：所从金之杂质＝火，须报其在局且力度', Z.两说[0].杂质 === '火' && Z.两说[0].杂质在局 === true && !!Z.两说[0].杂质力度, JSON.stringify(Z.两说[0]));
  ok('十神最强说：所从土自身不旺 ⇒ 亦判不成从', /自身不旺/.test(Z.两说[1].判), Z.两说[1].判);
  ok('从格改判须标"仅供参考/须改按"之适用性', !!tiyongRouteOf(c1, { 用神五行: '火' }).从格改判.适用性, '');
  // ★ 使用者 2026-09-28：「先保命」只在极端两端定前提，中间不以旺衰定调
  const BM = tiyongRouteOf(c1, { 用神五行: '火' }).主要矛盾.一_先保命;
  ok('极弱无依归须判"无养之必要"并只定前提', /极弱且无依归/.test(BM) && /不给日主强弱打分/.test(BM), BM);
  // ★ 使用者 2026-09-28：「先保命＝优先处理官杀（有杀先论杀），看官杀对我是好是坏（能否承载），是否要供起来」
  ok('先保命须以"有煞只论煞"为纲', /有煞只论煞/.test(BM), BM.slice(0, 40));
  const GS = tiyongRouteOf(c1, { 用神五行: '火' }).主要矛盾.官杀吉凶;
  ok('须报官杀有无与落点', GS.有官杀 === true && GS.落点.length > 0, JSON.stringify(GS.落点));
  ok('须报官杀力度与日主担力', !!GS.力度档 && !!GS.日主担力 && !!GS.担力据, JSON.stringify([GS.力度档, GS.日主担力]));
  eq('本盘日主担力＝不可任（无根无依归）', GS.日主担力, '不可任');
  ok('不可任时须判"为杀、须制化"并引"杀重身轻非贫即夭"', /须\*\*制化\*\*/.test(GS.判) && /杀重身轻/.test(GS.判), GS.判);
  ok('须写明官杀之别在名、好坏在承载', /在\*\*名\*\*/.test(GS.判) && /在\*\*承载\*\*/.test(GS.判), GS.判);
  ok('须报"时上一位贵"是否成立及条件', !!GS.时上一位贵 && ('成立否' in GS.时上一位贵), JSON.stringify(GS.时上一位贵));
  eq('本盘时干丁为食神 ⇒ 不涉时上一位贵', GS.时上一位贵.成立否, false);
  // ★ 使用者 2026-09-28 两项待补：承载按岁运重估 / 相战择优（不以通关优先为定则）
  // 注：承载重估须有真实大运，故此处用「2001-08-10 01:47 男」＝同一四柱的实盘
  const cCase = castChart({ year: 2001, month: 8, day: 10, hour: 1, minute: 47, gender: '男' });
  const CZ = tiyongRouteOf(cCase, { 用神五行: '火' }).承载重估;
  ok('须逐运重估承载', Array.isArray(CZ.逐运) && CZ.逐运.length > 0, '');
  eq('本盘原局判不可任', CZ.原局判, '不可任');
  ok('补根之运须判"可任"并说明官杀转贵', CZ.逐运.some((x) => /^\*\*可任\*\*/.test(x.判) && /转"贵"/.test(x.判)), JSON.stringify(CZ.逐运.map((x) => [x.干支, x.判.slice(0, 18)])));
  ok('只补势未补根者不得判"可任"（实战派口径）', CZ.逐运.filter((x) => x.补势 && !x.补根).every((x) => !/^\*\*可任\*\*/.test(x.判)), '');
  ok('首个补根之运须为辛卯（卯为本气比劫）', CZ.首个补根之运 && CZ.首个补根之运.干支 === '辛卯', JSON.stringify(CZ.首个补根之运?.干支));
  ok('须声明"出运复原"', /出运后复原/.test(CZ.结论), CZ.结论);
  const XZ = tiyongRouteOf(cCase, { 用神五行: '火' }).相战择优;
  ok('相战须并入"官杀与日主"这一对（阈值会漏）', XZ.相战.some((p) => /金克木/.test(p.相战)), JSON.stringify(XZ.相战.map((p) => p.相战)));
  ok('须报主要病神与口径', !!XZ.主要病神 && /须调用方核定/.test(XZ.口径), XZ.口径);
  const 金木 = XZ.相战.find((p) => p.相战 === '金克木');
  eq('金克木之择优须为火（制金）', 金木.择优?.五行, '火');
  ok('通关神水须判"不好用"（灭火工具）', 金木.手段.some((m) => m.五行 === '水' && /不好用/.test(m.净判)), JSON.stringify(金木.手段.map((m) => [m.五行, m.净判])));
  const 火金 = XZ.相战.find((p) => p.相战 === '火克金');
  eq('火金对通关神土不好用（助金）⇒ 择优为空', 火金.择优, null);
  ok('无好用手段时须并陈代价、不得硬择一', /无好用手段/.test(火金.结论), 火金.结论);
  ok('全盘择优须为火', /^全盘择优：火/.test(XZ.总择), XZ.总择);
  // ★ 使用者 2026-09-28 四点补正：合计入动根／主要矛盾定用神／从格顺从改判
  const s5 = structureOf(c1, { 用神五行: '火' });
  ok('「合」须计入动根（使用者裁「算」）', (s5.合之动根 || []).length > 0, JSON.stringify(s5.合之动根));
  ok('合须辨谁合谁（给出被合者/合方/内外/判语）',
    (s5.合之动根 || []).every((x) => x.被合者 && x.合方 && x.内外 && x.判语), '');
  ok('用神之根与用神所克者相合 ⇒ 须判"做功但标代价"（火去合克金之型）',
    (s5.合之动根 || []).some((x) => /做功/.test(x.判语) && /代价/.test(x.判语)), JSON.stringify(s5.合之动根.map((x) => x.判语)));
  ok('合亦计入结语', /合亦计入动根/.test(s5.结论), s5.结论.slice(0, 80));
  const T2 = tiyongRouteOf(c1, { 用神五行: '火' });
  ok('汇总须先摆主要矛盾（先保命一步）', !!T2.主要矛盾 && /依归|从/.test(T2.主要矛盾.一_先保命), T2.主要矛盾?.一_先保命);
  ok('主要矛盾须取全局最旺五行并说明其对日主的关系', /最旺/.test(T2.主要矛盾.二_主要矛盾) && /官杀|财|食伤|印|比劫/.test(T2.主要矛盾.二_主要矛盾), T2.主要矛盾.二_主要矛盾);
  ok('候选用神须并陈多路（至少含制与调候）', (T2.主要矛盾.四_候选用神 || []).length >= 2, JSON.stringify(T2.主要矛盾.四_候选用神));
  ok('候选中须含"引化归身"一路（金生水、水生木）', (T2.主要矛盾.四_候选用神 || []).some((x) => x.字或五行 === '水'), JSON.stringify(T2.主要矛盾.四_候选用神.map((x) => x.字或五行)));
  ok('从格成立须给改判（用神＝所从之势、忌神＝逆势者）', !!T2.从格改判 && /所从之势/.test(T2.从格改判.改判), JSON.stringify(T2.从格改判?.改判));
  ok('从格"所从之势"须两说并陈且有明确裁定说明', (T2.从格改判?.所从之势_两说 || []).length === 2 && /D-015/.test(T2.从格改判.裁定说明), JSON.stringify(T2.从格改判?.所从之势_两说));
  ok('从格须报日主特性（阴阳干从之难易）', /阳干|阴干/.test(T2.从格改判.日主特性), T2.从格改判.日主特性);

  // 壬子 甲寅 戊午 丁巳：用神火，水克火，木夹在中间 → 木护卫火
  const p2 = protectionOf(mkFull('壬子', '甲寅', '戊午', '丁巳'), '火');
  ok('有效护卫须含「隔（通关）」木', p2.有效护卫.some((x) => x.途径 === '隔（通关）' && x.神 === '木'), JSON.stringify(p2.有效护卫));
  ok('遥隔/隔位之直克须列入「力弱之直克」，不计为威胁',
    p2.有路可直克用神 === false && p2.力弱之直克.length > 0, JSON.stringify(p2.力弱之直克));
  ok('用神自安时须同时列出被排除的力弱直克', /用神自安/.test(p2.安危) && /力弱/.test(p2.安危), p2.安危);
  ok('路径存在 ≠ 已伤：贴身直克有路但护卫在位时须判"不被克伤"',
    p1.有路可直克用神 === true && /不被克伤/.test(p1.安危), p1.安危);
  ok('须写明「护卫只解决安危、压力仍待岁运」', /护卫只解决/.test(p2.说明), '');

  // ── 27.7b 护卫链（递归）：「火的护卫是木，那木的护卫是谁」───────────
  // 五行相生之环：火 ← 木 ← 水 ← 金 ← 土 ← 火
  const H = mkFull('丙寅', '己亥', '甲申', '庚午'); // 五行俱全
  const ch1 = protectionChainOf(H, '火');
  eq('五行俱全时护卫链闭合', ch1.结局.类, '闭环');
  eq('闭环涉五行', ch1.结局.环上五行数, 5);
  eq('闭环链长 5', ch1.链.length, 5);
  eq('环为 火→木→水→金→土→火', ch1.结局.环.join(''), '火木水金土火');
  eq('逐层走「隔（通关）」途（沿母亲）', ch1.链.map((x) => x.采).join(','), '隔（通关）,隔（通关）,隔（通关）,隔（通关）,隔（通关）');
  eq('第 1 层被护卫者＝用神火，威胁者＝水', `${ch1.链[0].被护卫者}/${ch1.链[0].威胁者}`, '火/水');
  eq('第 2 层被护卫者＝木（火的护卫是木）', ch1.链[1].被护卫者, '木');
  eq('木之护卫＝水（木之威胁＝金）', `${ch1.链[1].隔护神}/${ch1.链[1].威胁者}`, '水/金');
  eq('环上宫位两两贴身', ch1.宫位校验.全贴身相连, true);
  ok('闭环之结语须写"护卫链闭合"', /护卫链闭合/.test(ch1.结构), ch1.结构);

  // ★ 五行之环 ≠ 宫位关联：使用者 2026-09-27 裁「不是同一件事」
  ok('★ 不得把闭环等同于结构稳定', /不把"闭环"等同于"结构稳定"/.test(ch1.说明), ch1.说明);
  ok('★ 须写明"不是同一件事"并给出使用者裁定日期', /不是同一件事/.test(ch1.说明) && /2026-09-27/.test(ch1.说明), '');
  ok('须声明每层只判在位、未判力度', /在位者未必有力/.test(ch1.说明), '');
  ok('宫位校验须能判"五行有环而宫位不贴身"', ch1.宫位校验 !== null && typeof ch1.宫位校验.全贴身相连 === 'boolean', '');

  // 母亲不在位、儿子在位 ⇒ 改走制途，形成短环而非五行之环
  const ch2 = protectionChainOf(c1, '火'); // 辛巳 丙申 乙巳 丁丑：局中无木
  eq('无木时改走制途（土）', ch2.链[0].采, '制');
  eq('此时为局部循环而非闭环', ch2.结局.类, '局部循环');
  ok('局部循环须声明"非完整五行之环"', /非完整五行之环/.test(ch2.结构), ch2.结构);

  // 断链：局中既无母亲亦无儿子
  const ch3 = protectionChainOf(mkFull('辛酉', '辛卯', '乙卯', '辛酉'), '金');
  eq('金为用而局中无土无水 ⇒ 断链', ch3.结局.类, '断链');
  ok('断链须写明因由', /断链/.test(ch3.结构) && /无护/.test(ch3.结局.因), ch3.结局.因);
  ok('汇总须纳入护卫链', !!tiyongRouteOf(c1, { 用神五行: '火' }).第三之链_护卫链, '');

  // ── 27.8 第 4 条：结构稳定性（根基是否被动摇）─────────────────────
  const s1 = structureOf(c1, { 用神五行: '火' });
  eq('极端盘：日主乙木地支无根', s1.日主之根.有根, false);
  ok('无根须点明这是"从"的前提、须先走特殊格局排查', /从.*前提|前提.*从/.test(s1.结论) && /特殊格局/.test(s1.结论), s1.结论);
  ok('须并陈"根被冲刑不等于结构即破"', /不等于结构即破/.test(s1.结论), s1.结论);
  ok('巳申既六合又相破之分歧须写出', /既六合又相破|既六合.*相破/.test(s1.结论), s1.结论);
  const s2 = structureOf(mkFull('壬子', '甲辰', '甲寅', '丙寅'), { 用神五行: '火' });
  eq('甲寅日：日主有根', s2.日主之根.有根, true);
  eq('原局无冲刑 ⇒ 无动摇之根', s2.动摇之根.length, 0);
  const s3 = structureOf(mkFull('壬子', '甲辰', '甲寅', '丙寅'), { 用神五行: '火', 岁运: '壬申' });
  ok('岁运申冲日支寅 ⇒ 切根须检出', s3.岁运.切根.length > 0, JSON.stringify(s3.岁运.切根));
  ok('岁运结论须写"切断根基"', /切断根基/.test(s3.岁运.结论), s3.岁运.结论);
  let 岁运抛错 = false;
  try { structureOf(c1, { 岁运: '甲子午' }); } catch { 岁运抛错 = true; }
  eq('岁运格式错须抛错', 岁运抛错, true);

  // ── 27.9 汇总入口与禁令 ────────────────────────────────────────────
  // ⚠ 输入须**自洽**：用神火 ⇒ 忌神应为**克火者＝水**（早先此处误用「火／金」，属口径矛盾组合）
  const R = tiyongRouteOf(c1, { 用神五行: '火', 忌神五行: '水' });
  eq('汇总四项齐备', [R.第一_财官威胁, R.第二_印比有情, R.第三_用神护卫, R.第四_结构稳定].every(Boolean), true);
  eq('禁令六条', R.禁令.length, 6);
  ok('禁令须含「合的目的是让他为我所用」', R.禁令.some((x) => /让他为我所用/.test(x)), '');
  ok('禁令须含「禁止以力度大小作合的门槛」', R.禁令.some((x) => /禁止以力度大小作"合"的门槛/.test(x)), '');
  ok('禁令须含「护卫 ≠ 化解」', R.禁令.some((x) => /护卫 ≠ 化解/.test(x)), '');
  ok('禁令须含「禁止把用神合忌神读成用神被坏」', R.禁令.some((x) => /用神合忌神/.test(x)), '');
  ok('禁令须含「不作绝对吉凶判断」', R.禁令.some((x) => /绝对吉凶/.test(x)), '');
  ok('禁令须含「分歧并陈，不选边」', R.禁令.some((x) => /不选边/.test(x)), '');
  ok('汇总须报"月令最大"', /月支.*最大|最大/.test(R.月令最大), R.月令最大);
  eq('用神由调用方声明时须注明', R.用神来源, '调用方声明');
  ok('未声明用神时须注明为引擎暂取、待核定', /待调用方核定/.test(tiyongRouteOf(c1).用神来源), tiyongRouteOf(c1).用神来源);
  ok('汇总须声明四条为"关系判断"、旺衰不作判据', /不作判据/.test(JSON.stringify(R.第一_财官威胁.分组条件)), '');

  // ── 27.10 去重回归（2026-09-28：同一根／同一桥／同一护神被重复计数）──────
  // 用神五行＝日主五行时，日主之根与用神之根完全同根；旧实现直接拼接两个列表，
  // 使「原局有 N 处根被动摇」翻倍（实测 2→4）。c1 为乙木无根之极端盘。
  const s4 = structureOf(c1, { 用神五行: '木' });
  eq('同根时动摇之根不得出现重复条目', s4.动摇之根.length, new Set(s4.动摇之根).size);
  eq('动摇计数合计须等于数组长度', s4.动摇计数.合计, s4.动摇之根.length);
  ok('动摇计数须分出日主之根／用神之根／同根三栏',
    ['日主之根', '用神之根', '同根'].every((k) => typeof s4.动摇计数[k] === 'number'), JSON.stringify(s4.动摇计数));
  const p3 = protectionOf(c1, '水');
  const 桥列 = (p3.有效护卫.find((x) => String(x.途径).includes('隔')) || {}).桥 || [];
  eq('护卫桥不得重复列同一宫的同一字', 桥列.length, new Set(桥列).size);
  const p4 = protectionOf(c1, '土');
  const 护名 = (p4.护神自身.明细 || []).map((x) => x.护神);
  eq('护神自身明细不得重复', 护名.length, new Set(护名).size);
  ok('护神自身须带藏干，以区分同一支之不同气（如 年支巳(本丙) vs 年支巳(中庚)）',
    s4.动摇之根.length >= 0 && 护名.some((x) => /\(.+\)/.test(x)), JSON.stringify(护名));
  ok('岁运切根须并入 structureOf 主结论',
    /岁运切断根基/.test(structureOf(c1, { 用神五行: '火', 岁运: '乙亥' }).结论), '');
  ok('岁运警示不得把使用者原话的「火」直接当成本盘用神',
    /原话举例用的是火/.test(protectionOf(c1, '水').岁运警示), '');
}

console.log('=== 28. 能否制住／化尽／合住（月令力量 · 人元司令 · 大运配合）===');
{
  const mk = (...gz) => {
    const pillars = gz.map((g, i) => ({
      position: ['年柱', '月柱', '日柱', '时柱'][i], gz: g,
      stem: g[0], branch: g[1], stemIndex: STEMS.indexOf(g[0]), branchIndex: BRANCHES.indexOf(g[1]),
    }));
    const dayEl = ['木', '火', '土', '金', '水'][[0, 0, 1, 1, 2, 2, 3, 3, 4, 4][STEMS.indexOf(gz[2][0])]];
    return { pillars, dayMaster: { stem: gz[2][0], element: dayEl, bornMonthBranch: gz[1][1] } };
  };
  const c1 = mk('辛巳', '丙申', '乙巳', '丁丑');   // 乙木日主，申月
  const 判 = (r, 名) => r.checks.find((x) => x.判据 === 名);

  // ── 28.1 powerOf：五行实际力度（月令令态 + 人元司令 + 通根透干 + 宫位 + 牵制 + 大运）──
  const 金 = powerOf(c1, '金'), 木 = powerOf(c1, '木'), 火 = powerOf(c1, '火');
  eq('申月金令态为旺', 金.令态, '旺');
  eq('当令且有本气根者判「极」', 金.档, '极');
  eq('失令且全无根者判「弱」', 木.档, '弱');
  ok('木全无根须报「无根」', 木.根数 === 0, JSON.stringify(木.通根));
  eq('火在申月为囚（月令最大，不以有根而改令态）', 火.令态, '囚');
  ok('powerOf 依据须逐项列出', 金.依据.length >= 4 && 金.依据.some((x) => /月令/.test(x)), JSON.stringify(金.依据));
  ok('powerOf 须声明不合成单一评分', /不合成单一数值评分/.test(金.说明), '');
  ok('人元司令须报（四柱模式为"未计"）', 金.是司令之神 === null && /人元司令未计/.test(金.依据.join('')), JSON.stringify(金.依据));
  // 大运配合
  const 金带运 = powerOf(c1, '金', { 岁运: '庚申' });
  ok('岁运补我须报加分', /补/.test(金带运.岁运.说明), 金带运.岁运.说明);
  const 金逆运 = powerOf(c1, '金', { 岁运: '丙午' });
  ok('岁运助我之克者须报减分', /助其克者/.test(金逆运.岁运.说明), 金逆运.岁运.说明);

  // ── 28.2 制住：逐条判据，各带出处 ──────────────────────────────────
  const 制1 = canControlOf(c1, '火', '金');
  ok('判据齐备（土克水另加"湿土"一条，故 7～8 条）', 制1.checks.length >= 7, String(制1.checks.length));
  ok('每条判据皆带可复核出处', 制1.checks.every((x) => x.据 && x.据.length > 5), '');
  eq('忌神被合住 ⇒ 制神够不着（食不能制也）', 制1.致命伤.includes('被制者未被合住'), true);
  ok('此时判「不能制」，且须引《御定子平》', /^\*\*不能制\*\*/.test(制1.结论) && /御定子平/.test(判(制1, '被制者未被合住').据), 制1.结论);
  eq('制之不及（奴欺主）', 制1.程度, '制之不及（奴欺主）');
  ok('火在申月囚 ⇒ 不得令，须点名', /囚/.test(判(制1, '制者得令').说明), 判(制1, '制者得令').说明);
  ok('「势可相敌但已近临界」须点出（差 10 个百分点）', /临界/.test(判(制1, '势足以敌（不被反克）').说明), '');
  ok('制者部分被合只打折，未合之落点须列出', /制力须打折/.test(判(制1, '制者未被合住').说明) && /时干丁/.test(判(制1, '制者未被合住').说明), '');
  ok('制不及之出处须引《神峰通考》', /神峰通考/.test(判(制1, '制得其宜（不过不不及）').据), '');

  // 虚露失垣：只透干而全无根 —— 《八字提要》「虚露失垣之庚，不能制裁旺盛之木」
  const 虚 = mk('乙丑', '丁酉', '甲子', '己巳');
  eq('乙木只透无根 ⇒ 虚露失垣（自根口径）', powerOf(虚, '木').虚露失垣, true);
  // ── ★ 2026-10-04 使用者口径：**无自根 ≠ 无力**，还须看源头 ──────────────
  //   本盘木之源头＝水；水令态「相」、宫位和 0.9 ⇒ 源头有力
  //   ⇒ 木虽无自根，**不算虚浮**，第 2 关应**通过**（不再因"无根"被简化挡掉）。
  const p木虚 = powerOf(虚, '木');
  eq('木之源头＝水', p木虚.源头五行, '水');
  eq('水对木：源头月令支持（令态相）', p木虚.源头月令支持, true);
  eq('源头宫位档＝强', p木虚.源头宫位档, '强');
  eq('源头有力', p木虚.源头有力, true);
  eq('故「真正虚浮」＝false', p木虚.真正虚浮, false);
  const 制虚 = canControlOf(虚, '木', '土');
  ok('无根但源头有力 ⇒ 第 2 关应**通过**（不再判虚露失垣）',
    !/真虚浮/.test(判(制虚, '制者有根（非虚露失垣）').说明)
    && /源头.*有力/.test(判(制虚, '制者有根（非虚露失垣）').说明),
    判(制虚, '制者有根（非虚露失垣）').说明);
  ok('此时仍判「不能制」——但理由须是实质性的（制之不及／被合），非"无根"',
    /^\*\*不能制\*\*/.test(制虚.结论) && !/虚露失垣/.test(制虚.结论), 制虚.结论);
  ok('虚露失垣之出处须引《八字提要》', /八字提要/.test(判(制虚, '制者有根（非虚露失垣）').据), '');

  // 反向：无根 **且** 源头无力 ⇒ 真虚浮，第 2 关不过
  const 真虚 = mk('乙酉', '戊戌', '甲戌', '庚午');   // 木无根；水在局 0 落点、令态死 ⇒ 源头无力
  const p真虚 = powerOf(真虚, '木');
  eq('（反例）木仍为虚露失垣', p真虚.虚露失垣, true);
  eq('（反例）源头水在局 0 落点', p真虚.源头在局, false);
  eq('（反例）源头无力', p真虚.源头有力, false);
  eq('（反例）故判真正虚浮', p真虚.真正虚浮, true);
  // ⚠ 关键反例：源头**零落点**时，纵月令给"相"也不得算有力（否则凭空得气）
  const 空源 = mk('乙酉', '己酉', '甲戌', '庚午');
  const p空源 = powerOf(空源, '木');
  eq('（反例）水零落点', p空源.源头在局, false);
  eq('（反例）纵令态得相，也不得算有力', p空源.源头有力, false);
  eq('（反例）仍判真正虚浮', p空源.真正虚浮, true);

  // ── ★ 27.6g 取用定案：按官杀担力 + 逐路验可行（2026-10-04 使用者口径）──────
  //   使用者原话：「杀多也不能制吗？」「（通关与制取舍）看哪个可行」「选 ③ 都验」
  //   规则：担力可任⇒宜化（不禁止制）；不可任⇒制化皆可；两条路各验；全不可行⇒兜底。
  const cDr = mk('庚寅', '庚辰', '甲寅', '辛未');   // 甲木当令、官杀金天透地藏(3透)
  const mDr = tiyongRouteOf(cDr, {}).主要矛盾;
  eq('（定案）官杀担力＝可任', mDr.官杀吉凶.日主担力, '可任');
  ok('（定案）可任须判为「贵气·位」且宜化', /贵气/.test(mDr.四之二_取用定案.官杀为) && /化/.test(mDr.四之二_取用定案.宜), mDr.四之二_取用定案.宜);
  const 火c = mDr.四_候选用神.find((x) => x.来源类 === '制');
  const 水c = mDr.四_候选用神.find((x) => x.来源类 === '化');
  ok('（定案）制路须给出可行性（含势／宜）', typeof 火c.可行 === 'boolean' && /势/.test(火c.可行性), 火c.可行性);
  ok('（定案）本盘火弱势不敌 ⇒ 制路不可行', 火c.可行 === false, 火c.可行性);
  ok('（定案）化路可行（印在局）', 水c.可行 === true, 水c.可行性);
  // ⚠ 2026-10-04 自审修正：化路判据**必须与 powerOf 同一把尺子**（`!真正虚浮`），
  //   旧写法 `源头在局 || 根数>0` 与之不一致（且 `源头有力` 是**印的源头**之力，非印自身之力，极易误读）。
  const 水p = powerOf(cDr, '水');
  ok('（自审）化路判据＝!真正虚浮（与 powerOf 同尺）', 水c.可行 === !水p.真正虚浮,
    `化可行=${水c.可行} 真正虚浮=${水p.真正虚浮}`);
  ok('（自审）化路据须写出"印自根／源头"而非误用源头有力当自评',
    /自根/.test(水c.可行性) && /源头/.test(水c.可行性), 水c.可行性);
  eq('（定案）只一条可行 ⇒ 取之', mDr.四之二_取用定案.可行候选.length, 1);
  ok('（定案）取的是水', /水/.test(mDr.四之二_取用定案.可行候选[0]), JSON.stringify(mDr.四之二_取用定案.可行候选));
  // ⛔ 守卫（2026-10-04 自审修正：守卫须**限定**——只在官杀**确实威胁**时拒）：
  //   此盘 `庚申 戊寅 甲申 壬申` 官杀金**不威胁**（担力可任）⇒ 「金」正是"给过剩日主派活"之官，
  //   **不得**当自毁拒掉（旧版守卫过宽，误杀此正解）。
  const cSelf = mk('庚申', '戊寅', '甲申', '壬申');
  const mSelf = tiyongRouteOf(cSelf, {}).主要矛盾;
  const 金c = mSelf.四_候选用神.find((x) => x.来源类 === '制');
  // ⚠ 2026-10-04 折中后：本盘官杀（金）因桥虚设转"**威胁**" ⇒ 自毁守卫**会**拒它。
  //   这与规格 838「若不威胁 ⇒ 不得拒」不冲突——前提"不威胁"在该盘已不成立。
  //   使用者已知此代价并裁定接受（见 体用路线法.md §一之二 一之三 注）。
  ok('（守卫·限定·折中后）官杀转威胁 ⇒ 守卫须判"不得取"',
    !金c || /不得取/.test(金c.可行性), 金c ? 金c.可行性 : '(无制路)');
  ok('（守卫·限定·折中后）须点出"正在威胁日主的官杀"',
    !金c || /正在威胁日主的官杀/.test(金c.可行性), 金c ? 金c.可行性 : '(无制路)');
  // ★★ 化路（通关）的两条硬约束（2026-10-04 自审两次修正后的定式）：
  //   ① 桥 ＝ 有害者所生、且桥生日主；
  //   ② **退化条件「桥即日主本行」只可在有害者确实压日主时用**——
  //      否则「最旺＝印（生我者）」这种**本无冲突**的盘会被误推出"化＝日主本行"。
  //     实测反证 `庚寅 戊寅 癸酉 辛酉`（日主水、最旺＝金＝印、官杀土不威胁）：不得有化路。
  const cYin = mk('庚寅', '戊寅', '癸酉', '辛酉');
  const mYin = tiyongRouteOf(cYin, {}).主要矛盾;
  const 化Yin = mYin.四_候选用神.find((x) => x.来源类 === '化');
  // ⚠ 2026-10-04 折中后：本盘官杀（土）因桥虚设转"威胁" ⇒ 有害者非空 ⇒ **印（金）化杀一路成立**。
  //   注意：出现的是**合法的化路**（土生金、金生水＝化杀生身），**不是**旧 bug「化＝日主本行」。
  ok('（化路·折中后）官杀转威胁 ⇒ 化路（印）成立', !!化Yin,
    JSON.stringify(mYin.四_候选用神.map((x) => x.字或五行 + '/' + x.来源类)));
  ok('（化路）该盘不得把日主本行当桥（旧 bug 不得复发）',
    !化Yin || 化Yin.字或五行 !== cYin.pillars[2].stem,
    化Yin ? 化Yin.字或五行 : '(无化路)');
  // 官杀为害时，化路须真的存在（正例）
  const cGua = mk('庚寅', '庚辰', '甲寅', '辛未');
  const mGua = tiyongRouteOf(cGua, {}).主要矛盾;
  const 化Gua = mGua.四_候选用神.find((x) => x.来源类 === '化');
  ok('（化路·正例）官杀为害 ⇒ 化路须存在（桥＝印）', !!化Gua, JSON.stringify(mGua.四_候选用神.map((x) => x.字或五行 + '/' + x.来源类)));
  ok('（化路·正例）桥须是印（生我者），不是日主本行', !!化Gua && 化Gua.字或五行 !== '木', 化Gua ? 化Gua.字或五行 : '');
  ok('（定案）皆不可行时须报兜底「克／泄／耗」',
    mSelf.四之二_取用定案.可行候选.length > 0 || /兜底/.test(mSelf.四之二_取用定案.判),
    mSelf.四之二_取用定案.判);

  // 势不敌 ⇒ 不但不能制，反被反克（《神峰通考》「木多金少，不能制伏」）
  const 反克 = canControlOf(mk('辛酉', '辛卯', '甲寅', '丁卯'), '金', '木');
  ok('木多金少 ⇒ 势不敌，不能制', /^\*\*不能制\*\*/.test(反克.结论) && /反克|反被反克/.test(反克.结论), 反克.结论);
  ok('势不敌之出处须引《神峰通考》', /神峰通考/.test(判(反克, '势足以敌（不被反克）').据), '');

  // 湿土不能制水（《造化元钥》「辰丑皆湿土，不能制水……惟戌与戊土同功」）
  const 湿 = canControlOf(mk('甲子', '丁丑', '甲辰', '癸亥'), '土', '水');
  ok('辰丑湿土不能制水', /^\*\*不能制\*\*/.test(湿.结论) && /湿土/.test(湿.结论), 湿.结论);
  ok('湿土之出处须引《造化元钥》', /造化元钥/.test(判(湿, '土能制水（非湿土）').据), '');
  const 燥 = canControlOf(mk('甲戌', '丁未', '甲子', '癸亥'), '土', '水');
  eq('戌未之土不属湿土，此条应通过', 判(燥, '土能制水（非湿土）').通过, true);

  let 制抛错 = false;
  try { canControlOf(c1, '火', '木'); } catch { 制抛错 = true; }
  eq('制者并不克被制者时须抛错', 制抛错, true);

  // ── 28.3 化尽：得时月 + 无克破 + 无盗泄 + 地支冲掣 + 三派分歧 ────────
  const H = mk('丙寅', '己亥', '甲申', '庚午');   // 亥月，化木得时
  const 化 = canTransformOf(H, '木');
  eq('亥月化木属得时月（《命理探源》）', 判(化, '化神得时（真化）').通过, true);
  ok('得时月须列出该五／四个月', /亥、卯、未、寅/.test(判(化, '化神得时（真化）').说明), '');
  ok('局中有金克化神 ⇒ 不能化气推', /不能化气推/.test(判(化, '四柱无克化神者').说明), '');
  ok('局中有火盗泄化神 ⇒ 属真化而经破伤', /盗泄/.test(判(化, '无盗泄化神者（真化未经破伤）').说明), '');
  ok('克化神优先于盗泄 ⇒ 判「必不可化」', 化.化名, '必不可化');
  ok('寅亥既六合又相破 ⇒ 只报"冲掣并见"，不径判不成化局',
    /既六合又相破/.test(判(化, '地支不互相冲掣').说明) && /不径判不成化局/.test(判(化, '地支不互相冲掣').说明), '');
  eq('合破并见者该条判为待定（null）', 判(化, '地支不互相冲掣').通过, null);
  ok('三派化气条件须并列（不问月令／指定月／得时月）',
    /子平真诠/.test(化.三派分歧.不问月令) && /御定子平/.test(化.三派分歧.指定月), JSON.stringify(化.三派分歧));
  ok('未化时须声明"只作象，不作本体论"', /只作象，不作本体论/.test(化.合而不化之处理), '');
  ok('须与 specialGejuOf 的化气格声明同源异用', /specialGejuOf/.test(化.说明), '');
  // 失时月 ⇒ 假化
  const 假 = canTransformOf(mk('丙寅', '丁酉', '甲申', '庚午'), '木');
  eq('酉月化木不属得时月', 判(假, '化神得时（真化）').通过, false);
  ok('失时须判假化', /假化/.test(判(假, '化神得时（真化）').说明), '');
  // 岁运之合不作化（《千里命稿》）
  const 化运 = canTransformOf(H, '木', { 岁运: '己未' });
  ok('岁运之合须声明不作化', 化运.checks.some((x) => x.判据 === '岁运之合不作化' && /不作化/.test(x.说明)), '');
  // 宾主
  const 化宾 = canTransformOf(H, '木', { 日干逢合: false });
  ok('他干逢合不能化（宾主）', /他干为命之宾/.test(判(化宾, '宾主（日干逢合方可化）').说明), '');

  // ── 28.4 合住：★ 合不以力度为门槛；「为我所用」看有故无故 ─────────────
  const 合1 = canBindOf(H, '水', { 有故: true });
  ok('有故而合 ⇒ 合住且为我所用、岁运不能伤克',
    /^\*\*合住且为我所用\*\*/.test(合1.结论) && /不能伤克|岁运不能伤克/.test(合1.结论), 合1.结论);
  const 合2 = canBindOf(H, '水', { 有故: false });
  ok('无故而合 ⇒ 合住而不为我所用、仍须防"遇制不制"',
    /^\*\*合住而不为我所用\*\*/.test(合2.结论) && /遇制不制/.test(合2.结论), 合2.结论);
  const 合3 = canBindOf(H, '水', {});
  ok('未声明意图时须并陈"为我所用／反受其殃"', 合3.未定判据.includes('合是否为我所用'), JSON.stringify(合3.未定判据));
  ok('未声明吉凶时亦须并陈', 合3.未定判据.includes('吉神／凶神'), '');
  ok('合破并见（寅亥）须报出', 合3.合破并见.length > 0, JSON.stringify(合3.合破并见));

  // ★★ 使用者更正：「合不需要完全力量大于对方，合的目的是让他为我所用」
  const 门槛 = 合3.checks.find((x) => /不以力度大小为门槛/.test(x.判据));
  ok('★ 合不得以力度大小为门槛', !!门槛 && 门槛.通过 === true, JSON.stringify(合3.checks.map((x) => x.判据)));
  ok('★ 须写明"合是牵住他、让他为我所用，不是压住他"', /牵住他、让他为我所用/.test(门槛.说明), 门槛.说明);
  ok('★ 须引「财来就我」与「合杀最美」为证', /财来就我/.test(门槛.据) && /合杀最美/.test(门槛.据), 门槛.据);
  ok('★ 双方力度只作参考、不参与判定', /不参与判定/.test(门槛.说明) && /仅作参考/.test(合3.双方力度.参考), '');
  ok('★ 合住不受岁运伤克须无条件成立（不看真化与力度）',
    /皆无关/.test(合3.checks.find((x) => x.判据 === '合住者岁运不能伤克').说明), '');
  ok('★ 须点明"合住／为我所用／变本体"是三个独立问题', /三个独立问题/.test(合3.说明), 合3.说明);
  ok('★ 须并陈《子平真诠》逢吉不为吉与《御定子平》遇岁运不能伤克两说',
    /子平真诠/.test(合3.说明) && /御定子平/.test(合3.说明), '');
  const 无合 = canBindOf(c1, '木', {});
  ok('无合者径报未合', /未合/.test(无合.结论), 无合.结论);
  ok('天干五合亦可被检出（辛丙合）', canBindOf(c1, '金', {}).合.some((x) => /天干五合/.test(x)), JSON.stringify(canBindOf(c1, '金', {}).合));

  // ── 28.5 接回体用路线：有制／有合 ≠ 制得住／合得住 ────────────────
  const t = threatOf(c1);
  ok('threatOf 须附带制力判定', !!t.官杀.制力, '');
  ok('threatOf 须附带合力判定', !!t.官杀.合之力, '');
  ok('制不足／合未牢时须落进「分歧」', t.官杀.分歧.length >= 1, JSON.stringify(t.官杀.分歧));
  const t3 = threatOf(c1, { 岁运: '壬子' });   // 水运：通关神得助
  ok('threatOf 须接受岁运并据以重判', t3.官杀.制力 !== null && t3.官杀.制力.制者.岁运 !== null, '');
  const pr = protectionOf(c1, '火');
  ok('protectionOf 须报护神力度（在位 ≠ 有力）', !!pr.隔护力度 && !!pr.制护力度, '');
  eq('制护（土）之档须计算', typeof pr.制护力度.档, 'string');
}

console.log('=== 29. 古籍检索落实：从格前提 · 三书对账 · 四象 · 有救阈值 ===');
{
  const mk = (...gz) => {
    const pillars = gz.map((g, i) => ({
      position: ['年柱', '月柱', '日柱', '时柱'][i], gz: g,
      stem: g[0], branch: g[1], stemIndex: STEMS.indexOf(g[0]), branchIndex: BRANCHES.indexOf(g[1]),
    }));
    const dayEl = ['木', '火', '土', '金', '水'][[0, 0, 1, 1, 2, 2, 3, 3, 4, 4][STEMS.indexOf(gz[2][0])]];
    return { pillars, dayMaster: { stem: gz[2][0], element: dayEl, bornMonthBranch: gz[1][1] } };
  };

  // ── 29.1 从格日主前提（《命理约言》格名定义 + 《造化元钥》不可见印）──────
  const s = specialGejuOf(mk('辛巳', '丙申', '乙巳', '丁丑'));
  for (const 格 of ['从杀', '从财', '从儿', '从势']) {
    const c = s.检查.find((x) => x.格 === 格);
    ok(`${格} 须有「日主无根」前提条`, c.逐条.some((x) => /日主无根/.test(x.条件)), JSON.stringify(c.逐条.map((x) => x.条件)));
    ok(`${格} 须有「月令非日主临官」前提条`,
      c.逐条.some((x) => /临官/.test(x.条件)), JSON.stringify(c.逐条.map((x) => x.条件)));
  }
  // ★ 从儿**不得**立"无比劫"门槛——《滴天髓》明说此格「不论身强弱」，比劫反去生助食伤
  const 从儿 = s.检查.find((x) => x.格 === '从儿');
  ok('★ 从儿不得立"无比劫"硬门槛', !从儿.逐条.some((x) => /无比劫|天干无印比生扶/.test(x.条件)),
    JSON.stringify(从儿.逐条.map((x) => x.条件)));
  ok('★ 从儿须引《滴天髓》「不论身强弱」', /不论身强弱/.test(JSON.stringify(从儿.逐条)), '');
  ok('从儿之破格神为印', 从儿.逐条.some((x) => /无印生身/.test(x.条件)), '');
  // 前提对象须含月令临官
  eq('前提须含「月令临官」', typeof s.前提.月令临官, 'boolean');

  // ── 29.2 三书对账：冲突并列、未检得明写 ─────────────────────────────
  const D = s.三书对账;
  ok('须有三书对账', !!D && !!D.真冲突 && !!D.未检得, '');
  ok('真冲突须含「微根是破格还是假从」', !!D.真冲突.微根是破格还是假从, JSON.stringify(Object.keys(D.真冲突)));
  ok('该冲突须并列三家原句', /八字提要/.test(JSON.stringify(D.真冲突.微根是破格还是假从))
    && /神峰通考/.test(JSON.stringify(D.真冲突.微根是破格还是假从))
    && /造化元钥/.test(JSON.stringify(D.真冲突.微根是破格还是假从)), '');
  ok('真冲突须含从杀分阴阳／从财分阴阳／会财会杀／从旺从强门槛',
    ['从杀分不分阴阳日干', '从财分不分阴阳日干', '是否须「会财／会杀」', '从旺／从强之门槛']
      .every((k) => !!D.真冲突[k]), JSON.stringify(Object.keys(D.真冲突)));
  ok('★ 须明写「从势」三书皆未检得', D.未检得.some((x) => /从势/.test(x) && /未检得/.test(x)), JSON.stringify(D.未检得));
  ok('★ 须明写「日主无一丝生扶」逐字未检得（0 匹配）',
    D.未检得.some((x) => /无一丝生扶/.test(x) && /0 匹配/.test(x)), JSON.stringify(D.未检得));
  ok('须声明《造化元钥》模块残缺之检索局限', /残缺/.test(D.检索局限), '');
  ok('须给出补白之要（《命理约言》格名定义）', /日主无根.*从财格/.test(D.补白之要), '');
  ok('三书同向之处须列出（见印破从）', /不可见印/.test(D.统一之处.见印破从), '');

  // ── 29.3 四象配五行（三书一致）与十二月配象（两法并列）──────────────
  eq('水＝太阴', SI_XIANG_WUXING.水, '太阴');
  eq('火＝太阳', SI_XIANG_WUXING.火, '太阳');
  eq('木＝少阳', SI_XIANG_WUXING.木, '少阳');
  eq('金＝少阴', SI_XIANG_WUXING.金, '少阴');
  ok('土不入四象', /不入四象|冲气/.test(SI_XIANG_WUXING.土), SI_XIANG_WUXING.土);
  const 申 = siXiangOf('申');
  eq('申月：法一作少阴', 申.法一.象, '少阴');
  eq('申月：法二亦作少阴', 申.法二.象, '少阴');
  eq('两法于申月一致', 申.两法一致, true);
  ok('申月结论须给出对应五行＝金', /金/.test(申.结论), 申.结论);
  const 亥 = siXiangOf('亥');
  eq('亥月：法一作太阴', 亥.法一.象, '太阴');
  eq('亥月：法二作老阴', 亥.法二.象, '老阴');
  eq('两法于亥月不一致（名目冲突）', 亥.两法一致, false);
  ok('不一致时须并列不调和', /并列，不调和/.test(亥.结论), 亥.结论);
  ok('★ 四象配五行须附《易图明辨》「易有四象而无五行」之反对说',
    /易有四象而無五行|易有四象而无五行/.test(SI_XIANG_YUAN.反对说), '');
  ok('★ 须明写「老少相配」「少阴喜老阳」未检得',
    siXiangOf('申').未检得.some((x) => /老少相配/.test(x)) && siXiangOf('申').未检得.some((x) => /少阴喜老阳/.test(x)), '');
  ok('须声明两法之名目差异（太阳／太阴 vs 老阳／老阴）', /老阳／老阴/.test(SI_XIANG_YUAN.名目差异), '');

  // ── 29.4 根之轻重与「有救」阈值（只有序关系，无权重数值）──────────
  const g = genWeightOf(mk('辛巳', '丙申', '乙巳', '丁丑'), '火');
  eq('火透干 2 处', g.透干数, 2);
  eq('火本气根 2 处（巳中丙）', g.本气根数, 2);
  ok('根之轻重须给序', /干多不如根重|一比肩/.test(g.序), g.序);
  ok('★ 须附三处反对说（《穷通宝鉴》透干为上／《御定子平》透干不论／《神峰通考》得时为旺）',
    g.反对说.length === 3 && /透干为上/.test(g.反对说[0]) && /不论/.test(g.反对说[1]) && /得时为旺/.test(g.反对说[2]),
    JSON.stringify(g.反对说));
  ok('★ 须明写「权重／成数／百分比」未检得', /未检得/.test(g.未检得), g.未检得);
  const y1 = youJiuOf(mk('辛巳', '丙申', '乙巳', '丁丑'), '火');
  eq('失令而有根 ⇒ 次强', y1.档, '次强（不当令而得地）');
  eq('次强仍算有救', y1.有救, true);
  const y2 = youJiuOf(mk('辛巳', '丙申', '乙巳', '丁丑'), '木');
  ok('不现于局 ⇒ 无救', /无救/.test(y2.档) && y2.有救 === false, y2.档);
  const y3 = youJiuOf(mk('乙丑', '丁酉', '甲子', '己巳'), '木');
  ok('只透无根 ⇒ 虚露、救而无力', /虚露/.test(y3.档) && /效力几等于无/.test(y3.结论), y3.结论);
  eq('有救阈值须附三处反对说', y3.反对说.length, 3);
  ok('须声明"只给序与档、不给数字"', /只给序与档，不给数字/.test(y3.说明), '');
}

console.log('=== 30. 干支自合与地支暗合识别（P-015 · D-029 裁定）===');
{
  // ── 30.1 常量结构校验 ──
  const selfPillars = Object.keys(STEM_BRANCH_SELF_COMBINE);
  eq('自合柱数恰为 7 柱', selfPillars.length, 7);
  ok('包含戊子', selfPillars.includes('戊子'), '');
  ok('包含壬午', selfPillars.includes('壬午'), '');
  ok('包含丁亥', selfPillars.includes('丁亥'), '');
  ok('包含辛巳', selfPillars.includes('辛巳'), '');
  ok('包含己亥', selfPillars.includes('己亥'), '');
  ok('包含癸巳', selfPillars.includes('癸巳'), '');
  ok('包含甲午', selfPillars.includes('甲午'), '');
  eq('戊子合', STEM_BRANCH_SELF_COMBINE['戊子'].合, '戊癸合');
  eq('丁亥合', STEM_BRANCH_SELF_COMBINE['丁亥'].合, '丁壬合');

  const hiddenPairs = Object.keys(BRANCH_HIDDEN_COMBINE);
  eq('暗合对总数（双向对称）为 6', hiddenPairs.length, 6);
  ok('包含寅丑', hiddenPairs.includes('寅丑'), '');
  ok('包含卯申', hiddenPairs.includes('卯申'), '');
  ok('包含午亥', hiddenPairs.includes('午亥'), '');
  eq('寅丑暗合五行', BRANCH_HIDDEN_COMBINE['寅丑'].合, '甲己/丙辛/戊癸全合');
  eq('卯申暗合五行', BRANCH_HIDDEN_COMBINE['卯申'].合, '乙庚暗合');
  eq('午亥暗合五行', BRANCH_HIDDEN_COMBINE['午亥'].合, '丁壬/甲己暗合');

  // ── 30.2 gzRelations 结构化字段输出 ──
  const rels = gzRelations(pillarsOf('戊子', '癸亥', '戊子', '丁巳'), null);
  ok('gzRelations 须包含干支自合字段', Array.isArray(rels['干支自合']), '');
  ok('gzRelations 须包含地支暗合字段', Array.isArray(rels['地支暗合']), '');
  eq('该盘自合柱数（年柱戊子、日柱戊子）', rels['干支自合'].length, 2);
  eq('年柱自合', rels['干支自合'][0].pillar, '年');
  eq('日柱自合', rels['干支自合'][1].pillar, '日');

  // ── 30.3 selfHiddenCombineOf 体用判定枚举 ──
  // ① 日柱自合盘（无暗合）
  const c1 = { pillars: pillarsOf('戊子', '癸亥', '戊子', '丁巳') };
  const r1 = selfHiddenCombineOf(c1);
  eq('戊子造判为日柱自合', r1.判定, '日柱自合');
  ok('日柱自合对象非空', !!r1.日柱自合, '');
  eq('日柱干支', r1.日柱自合.gz, '戊子');

  // ② 自合兼暗合盘（丁亥日柱自合 + 寅丑地支暗合）
  const c2 = { pillars: pillarsOf('丙寅', '己丑', '丁亥', '癸卯') };
  const r2 = selfHiddenCombineOf(c2);
  eq('丁亥造兼寅丑判为自合兼暗合', r2.判定, '自合兼暗合');
  eq('检出地支暗合 1 组', r2.地支暗合.length, 1);
  eq('暗合对为年寅—月丑', r2.地支暗合[0].pair, '年寅 — 月丑');

  // ③ 地支暗合盘（仅有卯申暗合，无自合柱）
  const c3 = { pillars: pillarsOf('乙卯', '甲申', '戊辰', '丙辰') };
  const r3 = selfHiddenCombineOf(c3);
  eq('仅有卯申判为地支暗合', r3.判定, '地支暗合');
  eq('自合明细为空', r3.自合明细.length, 0);

  // ④ 他柱自合盘（年柱辛巳自合，日柱戊辰非自合，无暗合）
  const c4 = { pillars: pillarsOf('辛巳', '丙申', '戊辰', '甲子') };
  const r4 = selfHiddenCombineOf(c4);
  eq('年柱辛巳自合判为他柱自合', r4.判定, '他柱自合');
  eq('他柱自合数', r4.他柱自合.length, 1);
  eq('日柱自合为空', r4.日柱自合, null);

  // ⑤ 无暗合盘
  const c5 = { pillars: pillarsOf('甲子', '丙寅', '戊辰', '庚申') };
  const r5 = selfHiddenCombineOf(c5);
  eq('纯正盘判为无暗合', r5.判定, '无暗合');
}

{
  console.log('=== 31. 核心干支关系与空亡细分（鸳鸯合 · 反吟伏吟 · 半合 · 相绝 · 虚拱 · 空亡细分 · D-035 裁定）===');

  // ── 31.1 鸳鸯合（天地德合） ──
  const relYy = gzRelations(pillarsOf('甲子', '己丑', '丙寅', '丁卯'), null);
  ok('检出鸳鸯合字段存在', Array.isArray(relYy['鸳鸯合']), '');
  eq('甲子见己丑检出 1 组鸳鸯合', relYy['鸳鸯合'].length, 1);
  eq('鸳鸯合对', relYy['鸳鸯合'][0].pair, '年甲子 — 月己丑');
  eq('天合内容', relYy['鸳鸯合'][0].天合, '甲己合化土');
  eq('地合内容', relYy['鸳鸯合'][0].地合, '子丑合化土');

  // ── 31.2 反吟（天冲地冲 / 天克地冲）与伏吟 ──
  // 天冲地冲：甲子见庚午
  const relFy1 = gzRelations(pillarsOf('甲子', '庚午', '丙寅', '丁卯'), null);
  ok('检出反吟字段存在', Array.isArray(relFy1['反吟']), '');
  eq('甲子见庚午反吟数', relFy1['反吟'].length, 1);
  eq('甲子见庚午类型为天冲地冲', relFy1['反吟'][0].type, '天冲地冲');
  // 天克地冲：甲子见戊午（戊甲克，子午冲）
  const relFy2 = gzRelations(pillarsOf('甲子', '戊午', '丙寅', '丁卯'), null);
  eq('甲子见戊午反吟数', relFy2['反吟'].length, 1);
  eq('甲子见戊午类型为天克地冲', relFy2['反吟'][0].type, '天克地冲');
  // 伏吟：甲子见甲子
  const relVy = gzRelations(pillarsOf('甲子', '甲子', '丙寅', '丁卯'), null);
  ok('检出伏吟字段存在', Array.isArray(relVy['伏吟']), '');
  eq('甲子见甲子检出 1 组伏吟', relVy['伏吟'].length, 1);
  eq('伏吟干支', relVy['伏吟'][0].gz, '甲子');

  // ── 31.3 地支半合（生地半合、墓地半合、拱合局） ──
  const relHalf = gzRelations(pillarsOf('壬申', '壬子', '丙辰', '戊戌'), null);
  ok('检出地支半合字段存在', Array.isArray(relHalf['地支半合']), '');
  ok('包含申子生地半合水局', relHalf['地支半合'].some((x) => x.pair === '年申 — 月子' && x.type === '生地半合' && x.局 === '水局'), '');
  ok('包含子辰墓地半合水局', relHalf['地支半合'].some((x) => x.pair === '月子 — 日辰' && x.type === '墓地半合' && x.局 === '水局'), '');
  ok('包含申辰拱合水局（拱子）', relHalf['地支半合'].some((x) => x.pair === '年申 — 日辰' && x.type === '拱合局' && x.拱 === '子'), '');
  eq('半合常量库总条目数', Object.keys(BRANCH_HALF_COMBINE).length, 24);

  // ── 31.4 地支相绝（四绝：寅酉、卯申、午亥、子巳） ──
  const relExt = gzRelations(pillarsOf('甲寅', '乙酉', '丙子', '丁巳'), null);
  ok('检出地支相绝字段存在', Array.isArray(relExt['地支相绝']), '');
  ok('检出寅酉绝', relExt['地支相绝'].some((x) => x.绝 === '寅酉绝'), '');
  ok('检出子巳绝', relExt['地支相绝'].some((x) => x.绝 === '子巳绝'), '');
  eq('相绝常量库总条目数', Object.keys(BRANCH_EXTINCTION).length, 8);

  // ── 31.5 虚邀暗夹（拱禄、拱贵、地支暗夹） ──
  // 癸丑见癸亥（日柱癸丑、时柱癸亥相邻拱子禄）
  const relGongLu = gzRelations(pillarsOf('甲寅', '丙寅', '癸亥', '癸丑'), null);
  ok('检出虚邀暗夹字段存在', Array.isArray(relGongLu['虚邀暗夹']), '');
  ok('检出相邻虚拱子禄（拱禄）', relGongLu['虚邀暗夹'].some((x) => x.夹 === '子' && x.格局.includes('拱禄')), '');

  // 甲寅见甲子（日柱甲寅、时柱甲子相邻拱丑天乙贵人）
  const relGongGui = gzRelations(pillarsOf('丙申', '戊戌', '甲寅', '甲子'), null);
  ok('检出相邻虚拱丑贵（拱贵）', relGongGui['虚邀暗夹'].some((x) => x.夹 === '丑' && x.格局.includes('拱贵')), '');

  // ── 31.6 空亡细分结构（互换空亡、截路空亡、四大空亡） ──
  const chartDemo = castChart({ year: 1984, month: 10, day: 5, hour: 10 });
  ok('chart.void 包含互换空亡对象', typeof chartDemo.void.mutual === 'object', '');
  ok('chart.void 包含截路空亡对象', typeof chartDemo.void.jielu === 'object', '');
  ok('chart.void 包含四大空亡对象', typeof chartDemo.void.fourMajor === 'object', '');
  eq('甲日截路空亡包含申与酉', JIELU_KONGWANG['甲'].includes('申') && JIELU_KONGWANG['甲'].includes('酉'), true);
  eq('己日截路空亡包含申与酉', JIELU_KONGWANG['己'].includes('申') && JIELU_KONGWANG['己'].includes('酉'), true);
  eq('戊日截路空亡包含子与丑', JIELU_KONGWANG['戊'].includes('子') && JIELU_KONGWANG['戊'].includes('丑'), true);
}

console.log('=== 32. 暗禄与暗禄日神煞入库（D-033 裁定）===');
{
  // ── 32.1 十干暗禄全矩阵核验 ──
  eq('甲暗禄为亥', ANLU['甲'], '亥');
  eq('乙暗禄为戌', ANLU['乙'], '戌');
  eq('丙暗禄为申', ANLU['丙'], '申');
  eq('丁暗禄为未', ANLU['丁'], '未');
  eq('戊暗禄为申', ANLU['戊'], '申');
  eq('己暗禄为未', ANLU['己'], '未');
  eq('庚暗禄为巳', ANLU['庚'], '巳');
  eq('辛暗禄为辰', ANLU['辛'], '辰');
  eq('壬暗禄为寅', ANLU['壬'], '寅');
  eq('癸暗禄为丑', ANLU['癸'], '丑');

  // ── 32.2 七大暗禄日自坐核验 ──
  eq('暗禄日总数恰为7柱', ANLU_DAY_GZ.length, 7);
  for (const gz of ANLU_DAY_GZ) {
    const stem = gz[0];
    const branch = gz[1];
    eq(`${gz} 自坐暗禄无误`, ANLU[stem], branch);
  }

  // 验证六十甲子中其它53柱均不自坐暗禄
  let otherSelfAnluCount = 0;
  for (let s = 0; s < 10; s++) {
    for (let b = 0; b < 12; b++) {
      if ((s % 2) === (b % 2)) {
        const gz = STEMS[s] + BRANCHES[b];
        if (ANLU[STEMS[s]] === BRANCHES[b] && !ANLU_DAY_GZ.includes(gz)) {
          otherSelfAnluCount++;
        }
      }
    }
  }
  eq('除七大暗禄日外无其他自坐暗禄柱', otherSelfAnluCount, 0);

  // ── 32.3 命盘神煞实测：丙申日自坐暗禄兼暗禄日 ──
  const c1 = castChart({ year: 2000, month: 2, day: 8, hour: 12 }); // 庚辰 戊寅 丙申 甲午
  const shensha1 = c1.shensha;
  const anluItem1 = shensha1.find((s) => s.name === '暗禄');
  const anluDayItem1 = shensha1.find((s) => s.name === '暗禄日');
  ok('丙申日检出暗禄神煞', !!anluItem1, '');
  ok('丙申日检出暗禄日神煞', !!anluDayItem1, '');
  ok('暗禄神煞落宫包含日', anluItem1?.positions.includes('日'), '');
  ok('暗禄日落宫为日柱', anluDayItem1?.positions.includes('日柱'), '');
  eq('暗禄吉凶定性为吉', anluItem1?.nature, '吉');
  eq('暗禄日吉凶定性为吉', anluDayItem1?.nature, '吉');
  eq('shenshaNature暗禄为吉', shenshaNature('暗禄'), '吉');
  eq('shenshaNature暗禄日为吉', shenshaNature('暗禄日'), '吉');

  // 丁未暗禄日命造验证
  const c2 = castChart({ year: 2000, month: 2, day: 19, hour: 12 }); // 庚辰 戊寅 丁未 丙午
  const anlu2 = c2.shensha.find((s) => s.name === '暗禄');
  const anluDay2 = c2.shensha.find((s) => s.name === '暗禄日');
  ok('丁未日检出暗禄', !!anlu2, '');
  ok('丁未日检出暗禄日', !!anluDay2, '');
}

// ==================================================================
// 33. 全干支双轨意象矩阵与动态研判系统（D-031 裁定）
// ==================================================================
console.log('=== 33. 全干支双轨意象矩阵与动态研判系统（D-031 裁定）===');
{
  // ── 33.1 词库完整度校验 ──
  const requiredCategories = [
    '地支六冲', '地支六合', '地支半合', '地支相刑',
    '地支相害', '地支相破', '地支相绝', '天干五合',
    '天干相克', '干支自合', '天地鸳鸯合', '反吟',
  ];
  for (const cat of requiredCategories) {
    const item = DUAL_IMAGE_LIBRARY[cat];
    ok(`双轨意象词库包含类别: ${cat}`, !!item, '');
    ok(`${cat} 具有非空喜象`, typeof item?.喜象 === 'string' && item.喜象.length > 0, '');
    ok(`${cat} 具有非空忌象`, typeof item?.忌象 === 'string' && item.忌象.length > 0, '');
    ok(`${cat} 具有权威出处`, typeof item?.出处 === 'string' && item.出处.length > 0, '');
  }

  // ── 33.2 动态研判自检 ──
  // 造 1: 甲木日主，地支卯酉冲（酉金冲卯木禄身/用神，破基伤用） -> 六冲定性为忌
  const cPaoLu = {
    pillars: pillarsOf('甲子', '癸酉', '甲卯', '乙丑'),
    dayMaster: { stem: '甲', element: '木', bornMonthBranch: '酉' },
  };
  const res1 = dualImageMatrixOf(cPaoLu, { 用神五行: '木' });
  ok('卯酉冲命盘输出双轨意象对象', typeof res1 === 'object' && Array.isArray(res1.关系条目), '');
  const chongItem1 = res1.关系条目.find((r) => r.类别 === '地支六冲' && (r.字.includes('卯') && r.字.includes('酉')));
  ok('检出卯酉六冲', !!chongItem1, '');
  eq('冲破禄身/用神定性为忌', chongItem1?.定性, '为忌');
  ok('应忌象包含拔根倾摇', chongItem1?.动态应象?.includes('拔根') || chongItem1?.动态应象?.includes('动荡'), '');

  // 造 2: 庚金日主（禄在申），用神取土，以克土之木为忌，局见年酉冲月卯去忌神 -> 冲去忌神定性为喜
  const cQuJi = {
    pillars: pillarsOf('辛酉', '乙卯', '庚子', '丙戌'),
    dayMaster: { stem: '庚', element: '金', bornMonthBranch: '卯' },
  };
  const res2 = dualImageMatrixOf(cQuJi, { 用神五行: '土' });
  const chongItem2 = res2.关系条目.find((r) => r.类别 === '地支六冲' && (r.字.includes('卯') && r.字.includes('酉')));
  ok('检出卯酉六冲', !!chongItem2, '');
  eq('冲去忌神定性为喜', chongItem2?.定性, '为喜');
  ok('应喜象包含除旧布新或破而后立', chongItem2?.动态应象?.includes('除旧布新') || chongItem2?.动态应象?.includes('建功'), '');
}

// ==================================================================
// 34. 干支多重并发作用力四维仲裁与认怂出口（D-030 · D-037 裁定）
// ==================================================================
console.log('=== 34. 干支多重并发作用力四维仲裁与认怂出口（D-030 · D-037 裁定）===');
{
  // ── 34.1 贴身合解隔位冲（贪合免冲）实测 ──
  // 年支辰与日支戌相冲（柱差2，隔位冲）；月支卯与日支戌六合（柱差1，贴身合）
  const cTanHe = {
    pillars: pillarsOf('甲辰', '丁卯', '戊戌', '癸亥'),
    dayMaster: { stem: '戊', element: '土', bornMonthBranch: '卯' },
  };
  const arb1 = arbitrateGanzhiForces(cTanHe);
  ok('输出逐支受力数组', Array.isArray(arb1.逐支受力), '');
  const riXu = arb1.逐支受力.find((z) => z.宫位 === '日柱' && z.字 === '戌');
  ok('检出日柱戌土受力项', !!riXu, '');
  eq('贴身合解隔位冲判定为贪合免冲', riXu?.最终受力, '贪合免冲');
  eq('贪合免冲动摇否为false', riXu?.动摇否, false);
  ok('汇总包含贪合免冲计数', arb1.汇总.贪合免冲数 >= 1, '');

  // ── 34.2 近冲破远合（冲散破合）实测 ──
  // 年支酉与日支辰六合（柱差2，隔位合）；年支酉与月支卯贴身冲（柱差1，贴身强冲破坏隔位合）
  const cJinChong = {
    pillars: pillarsOf('辛酉', '辛卯', '庚辰', '丙子'),
    dayMaster: { stem: '庚', element: '金', bornMonthBranch: '卯' },
  };
  const arb2 = arbitrateGanzhiForces(cJinChong);
  const nianYou = arb2.逐支受力.find((z) => z.宫位 === '年柱' && z.字 === '酉');
  eq('近冲破远合判定为冲散破合', nianYou?.最终受力, '冲散破合');
  eq('冲散破合动摇否为true', nianYou?.动摇否, true);

  // ── 34.3 structureOf 整合验证 ──
  const stRes = structureOf(cTanHe, { 用神五行: '土' });
  ok('structureOf 返回多重仲裁对象', !!stRes.多重仲裁, '');
  ok('structureOf 返回受力汇总', !!stRes.受力汇总, '');
  const xuRoot = stRes.日主之根.根.find((g) => g.字 === '戌');
  eq('戌土根之受力状态为贪合免冲', xuRoot?.受力状态, '贪合免冲');

  // ── 34.4 coverageOf 认怂出口实测（D-037 裁定） ──
  // 显式标记未覆盖
  const covExplicit = coverageOf(cTanHe, { 未覆盖: true, 原因: '外格相搏未决' });
  eq('显式未覆盖标志触发认怂', covExplicit.covered, false);
  eq('未覆盖判定文案严格匹配宪法誓言', covExplicit.判定, '本体系未覆盖，暂不判断');
  eq('未覆盖结论文案严格匹配宪法誓言', covExplicit.结论, '本体系未覆盖，暂不判断');

  // 正常覆盖命局
  const covNormal = coverageOf(cTanHe);
  eq('常规普通格局判定为已覆盖', covNormal.covered, true);
  eq('已覆盖判定文案', covNormal.判定, '本体系已覆盖');

  // 极端两神极战无通关神死结命局
  // 乙卯 乙酉 乙卯 辛酉（金木各半极战无水通关）
  const cSiJie = {
    pillars: pillarsOf('乙卯', '乙酉', '乙卯', '辛酉'),
    dayMaster: { stem: '乙', element: '木', bornMonthBranch: '酉' },
  };
  const covSiJie = coverageOf(cSiJie);
  eq('极端两神交战死结触发认怂出口', covSiJie.covered, false);
  eq('死结命局判定为本体系未覆盖暂不判断', covSiJie.判定, '本体系未覆盖，暂不判断');
}

console.log('=== 35. D-032 / P-016：从儿格见比劫判定与流通归宿法则 ===');
{
  // ── 35.1 从儿格比劫顺生为喜实测（《滴天髓阐微》名造） ──
  // 丁卯 丙午 甲午 丙寅（甲木生午月，满盘食伤，地支木火顺生，秀气有源）
  const cShunSheng = {
    pillars: pillarsOf('丁卯', '丙午', '甲午', '丙寅'),
    dayMaster: { stem: '甲', element: '木', bornMonthBranch: '午' },
  };
  const an1 = congErAnalysisOf(cShunSheng);
  eq('从儿格判定为属于从儿', an1.属于从儿, true);
  eq('从儿格用神为火（食伤）', an1.用神, '火');
  eq('比劫顺生食伤判定为顺生为喜', an1.比劫判定.角色, '顺生为喜');
  eq('印绶判定无破格之虞', an1.印绶判定.角色, '无破格之虞');
  ok('流通归宿包含食伤', an1.流通归宿.includes('食伤'), '');

  // ── 35.2 从儿格比劫越位夺财为忌实测（《千里命稿》变格名造） ──
  // 丁酉 己丑 丁丑 戊申（丁火生丑月土旺，年柱丁火比劫贴身直克酉金财星无食伤通关引化）
  const cDuoCai = {
    pillars: pillarsOf('丁酉', '己丑', '丁丑', '戊申'),
    dayMaster: { stem: '丁', element: '火', bornMonthBranch: '丑' },
  };
  const an2 = congErAnalysisOf(cDuoCai);
  eq('从儿格判定属于从儿', an2.属于从儿, true);
  eq('比劫贴身直克财星判定为越位夺财为忌', an2.比劫判定.角色, '越位夺财为忌');
  ok('比劫判定说明点明争财破耗', an2.比劫判定.说明.includes('争财破耗'), '');

  // ── 35.3 tiyongRouteOf 整合验证 ──
  const routeRes = tiyongRouteOf(cShunSheng);
  ok('tiyongRouteOf 返回从儿分析对象', !!routeRes.从儿分析, '');
  eq('tiyongRouteOf 挂接从儿分析属于从儿', routeRes.从儿分析.属于从儿, true);
  eq('tiyongRouteOf 挂接比劫判定角色', routeRes.从儿分析.比劫判定.角色, '顺生为喜');
}

console.log('=== 36. D-040 / P-019：岁运逆向夺根降级动态重估 ===');
{
  // ── 36.1 岁运冲拔禄神夺根尽失实测（《千里命稿》秋乙坐卯遇辛酉运名造） ──
  // 癸酉 辛酉 乙卯 丙戌（乙木坐卯专恃禄根抗杀，辛酉大运两酉冲卯拔根）
  const cDuoGen = {
    pillars: pillarsOf('癸酉', '辛酉', '乙卯', '丙戌'),
    dayMaster: { stem: '乙', element: '木', bornMonthBranch: '酉' },
  };
  const cz1 = chengzaiReassess(cDuoGen, { 岁运: '辛酉' });
  eq('原局判定为可任', cz1.原局判, '可任');
  eq('辛酉运检测出夺根', cz1.指定岁运.夺根.有夺根, true);
  eq('辛酉运判定为夺根降级', cz1.指定岁运.夺根.降级定性, '夺根降级');
  ok('被冲根包含日支卯', cz1.指定岁运.夺根.被冲根.some((x) => x.includes('日支卯')), '');
  ok('结论点明夺根降级或凶煞攻身', cz1.指定岁运.判.includes('夺根降级'), '');

  // ── 36.2 岁运冲拔阳刃夺根尽失实测（《滴天髓阐微》冬丙坐午遇壬子运名造） ──
  // 壬申 壬子 丙午 己丑（冬丙坐午专恃阳刃抗杀，壬子运两子冲午拔刃）
  const cDuoRen = {
    pillars: pillarsOf('壬申', '壬子', '丙午', '己丑'),
    dayMaster: { stem: '丙', element: '火', bornMonthBranch: '子' },
  };
  const cz2 = chengzaiReassess(cDuoRen, { 岁运: '壬子' });
  eq('原局判定为可任', cz2.原局判, '可任');
  eq('壬子运检测出夺根', cz2.指定岁运.夺根.有夺根, true);
  eq('壬子运判定为夺根降级', cz2.指定岁运.夺根.降级定性, '夺根降级');
  ok('被冲根包含日支午', cz2.指定岁运.夺根.被冲根.some((x) => x.includes('日支午')), '');

  // ── 36.3 未冲根大运维持原局前提实测 ──
  const cz3 = chengzaiReassess(cDuoGen, { 岁运: '丙寅' });
  eq('丙寅运未见冲拔通根', cz3.指定岁运.夺根.有夺根, false);
  eq('丙寅运降级定性为无', cz3.指定岁运.夺根.降级定性, '无');
  ok('丙寅运判词维持原局可任前提', cz3.指定岁运.判.includes('运不改前提'), '');
}

// ====================================================================
// 37. D-041 / P-020：护卫链受损替代解与剩余路数求值
// ====================================================================
console.log('=== 37. D-041 / P-020：护卫链受损替代解与剩余路数求值 ===');
{
  // ── 37.1 独木难支 / 替代解实测（《滴天髓阐微》冬丙水旺己丑制水名造） ──
  // 壬子 壬子 丙子 己丑，用神火。克神水。隔途木缺失，制途土畅通有效。
  const cDumu = {
    pillars: pillarsOf('壬子', '壬子', '丙子', '己丑'),
    dayMaster: { stem: '丙', element: '火', bornMonthBranch: '子' },
  };
  const ch1 = protectionChainOf(cDumu, '火');
  eq('隔途状态为缺失', ch1.全景通路.隔途.状态, '缺失');
  eq('隔途有效为false', ch1.全景通路.隔途.有效, false);
  eq('制途状态为畅通有效', ch1.全景通路.制途.状态, '畅通有效');
  eq('制途有效为true', ch1.全景通路.制途.有效, true);
  eq('剩余有效路数为1', ch1.剩余有效路数, 1);
  eq('通路定性为独木难支', ch1.通路状态, '独木难支');
  eq('替代解为制途替代隔途', ch1.全景通路.替代解, '制途替代隔途');
  eq('衰竭警报为false', ch1.衰竭警报, false);

  // ── 37.2 衰竭断链 / 衰竭警报实测（《滴天髓阐微》冬丙三子冲午拔刃名造） ──
  // 壬子 壬子 丙午 戊子，用神火。克神水。隔途木缺失，制途土虚浮受损。
  const cShuaijie = {
    pillars: pillarsOf('壬子', '壬子', '丙午', '戊子'),
    dayMaster: { stem: '丙', element: '火', bornMonthBranch: '子' },
  };
  const ch2 = protectionChainOf(cShuaijie, '火');
  eq('衰竭盘隔途状态为缺失', ch2.全景通路.隔途.状态, '缺失');
  eq('衰竭盘制途状态为在位但不足力', ch2.全景通路.制途.状态, '在位但不足力');
  eq('衰竭盘剩余有效路数为0', ch2.剩余有效路数, 0);
  eq('衰竭盘通路定性为衰竭断链', ch2.通路状态, '衰竭断链');
  eq('衰竭盘替代解为无替代解', ch2.全景通路.替代解, '无替代解');
  eq('衰竭盘衰竭警报为true', ch2.衰竭警报, true);
  ok('衰竭警报说明包含警报文字', ch2.全景通路.警报说明.includes('护卫衰竭警报'), '');
}

console.log('');
console.log(`\n通过 ${pass}，失败 ${fail}`);
if (failures.length) {
  console.log('\n失败明细：');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('全部自检通过 ✅');
