/**
 * 排盘底座神煞库与推演
 * 依据：《三命通会》《渊海子平》通行神煞法
 */
import {
  STEMS, BRANCHES, LUSHEN, ANLU, ANLU_DAY_GZ, SHIE_DABAI_GZ, YINCHAYANGCUO_GZ,
} from './constants.mjs';

const TIANYI = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};
/** 文昌贵人 */
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
/** 太极贵人 */
const TAIJI = {
  甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'],
};
/** 天德贵人（按月支） */
const TIANDE = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
};
/** 月德贵人（按月支三合局） */
const YUEDE = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };
/** 禄神（十干临官位） */

const YANGREN = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };
/** 金舆 */
const JINYU = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
/** 红艳煞（日干查支） */
const HONGYAN = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
/** 流霞（日干查支） */
const LIUXIA = { 甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳', 己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅' };
/** 三奇 */
const SANQI = ['甲戊庚', '乙丙丁', '壬癸辛'];

/** 三合局：key = 生旺墓三支中的"旺"支（四正） */
const TRIPLE = {
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
};
/** 三合局 → 驿马 / 桃花 / 华盖 / 将星 / 劫煞 / 亡神 / 月德... */
const SANHE_DERIVED = {
  // 局: [驿马, 桃花, 华盖, 将星, 劫煞, 亡神, 灾煞, 天煞, 地煞, 六厄]
  水局: { 驿马: '寅', 桃花: '酉', 华盖: '辰', 将星: '子', 劫煞: '巳', 亡神: '亥', 灾煞: '午', 天煞: '戌', 地煞: '未' },
  木局: { 驿马: '巳', 桃花: '子', 华盖: '未', 将星: '卯', 劫煞: '申', 亡神: '寅', 灾煞: '酉', 天煞: '辰', 地煞: '戌' },
  火局: { 驿马: '申', 桃花: '卯', 华盖: '戌', 将星: '午', 劫煞: '亥', 亡神: '巳', 灾煞: '子', 天煞: '丑', 地煞: '辰' },
  金局: { 驿马: '亥', 桃花: '午', 华盖: '丑', 将星: '酉', 劫煞: '寅', 亡神: '申', 灾煞: '卯', 天煞: '未', 地煞: '丑' },
};
const TRIPLE_NAME = {
  水局: ['申', '子', '辰'], 木局: ['亥', '卯', '未'], 火局: ['寅', '午', '戌'], 金局: ['巳', '酉', '丑'],
};

/** 孤辰寡宿（按年支） */
const GUCHEN = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
const GUASU = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };

/** 童限关煞：小儿关煞（按年支） */
const XIAOER_GUANSHA = {
  寅: '取命关', 卯: '取命关', 辰: '取命关', 巳: '阎王关', 午: '阎王关', 未: '阎王关',
  申: '鬼门关', 酉: '鬼门关', 戌: '鬼门关', 亥: '落井关', 子: '落井关', 丑: '落井关',
};

/** 十恶大败日（干支序） */


function computeShenSha(pillars, dayStemIndex, yearStemIndex, monthBranchIndex, dayBranchIndex, yearBranchIndex, gender) {
  const branches = pillars.map((p) => BRANCHES[p.branchIndex]);
  const stems = pillars.map((p) => STEMS[p.stemIndex]);
  const allBranches = [...branches];
  const allStems = [...stems];
  const dayStem = STEMS[dayStemIndex];
  const yearStem = STEMS[yearStemIndex];

  const hit = (list) => allBranches.filter((b) => list.includes(b));
  const hitStem = (list) => allStems.filter((s) => list.includes(s));

  const result = [];
  const add = (name, positions, note) => {
    if (positions.length === 0) return;
    result.push({ name, positions: [...new Set(positions)], ...(note ? { note } : {}) });
  };
  const posOf = (list) => branches.map((b, i) => (list.includes(b) ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);
  const posOfStem = (list) => stems.map((s, i) => (list.includes(s) ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);
  const posOfBranchEq = (b) => branches.map((x, i) => (x === b ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);

  /* --- 天乙贵人：日干、年干分别查四支 --- */
  {
    const list = [...(TIANYI[dayStem] ?? []), ...(TIANYI[yearStem] ?? [])];
    add('天乙贵人', posOf([...new Set(list)]), '以日干/年干查地支；《三命通会》与《渊海子平》个别干取法略异，此处取通行式');
  }
  /* --- 文昌贵人 --- */
  add('文昌贵人', posOfBranchEq(WENCHANG[dayStem]));
  /* --- 太极贵人 --- */
  add('太极贵人', posOf(TAIJI[dayStem] ?? []));
  /* --- 天德 / 月德 --- */
  {
    const td = TIANDE[BRANCHES[monthBranchIndex]];
    const pos = /[甲乙丙丁戊己庚辛壬癸]/.test(td)
      ? posOfStem([td]) : posOfBranchEq(td);
    if (pos.length) result.push({ name: '天德贵人', positions: pos, note: `按月支${BRANCHES[monthBranchIndex]}取「${td}」` });
  }
  {
    const yd = YUEDE[BRANCHES[monthBranchIndex]];
    const pos = posOfStem([yd]);
    if (pos.length) result.push({ name: '月德贵人', positions: pos, note: `按月支${BRANCHES[monthBranchIndex]}取天干「${yd}」` });
  }
  /* --- 禄神 --- */
  add('禄神', posOfBranchEq(LUSHEN[dayStem]));
  /* --- 暗禄（禄神之六合神，日干查四支） --- */
  add('暗禄', posOfBranchEq(ANLU[dayStem]), `日干${dayStem}正禄${LUSHEN[dayStem]}之六合神「${ANLU[dayStem]}」，主暗中得阴庇贵人`);
  /* --- 羊刃 --- */
  add('羊刃', posOfBranchEq(YANGREN[dayStem]), '阳干取帝旺位，阴干传统有"阴干无刃"与"取帝旺前一位"两说');
  /* --- 金舆 --- */
  add('金舆', posOfBranchEq(JINYU[dayStem]));
  /* --- 红艳煞 --- */
  add('红艳煞', posOfBranchEq(HONGYAN[dayStem]));
  /* --- 流霞 --- */
  add('流霞', posOfBranchEq(LIUXIA[dayStem]));
  /* --- 三奇（天上三奇甲戊庚 / 地下三奇乙丙丁 / 人中三奇壬癸辛，须顺排） --- */
  {
    const s = stems.join('');
    for (const q of SANQI) {
      if (s.includes(q)) result.push({ name: `${q === '甲戊庚' ? '天上' : q === '乙丙丁' ? '地下' : '人中'}三奇`, positions: ['四柱顺排'], note: `${q} 三干依次顺排于年月日时` });
    }
  }

  /* --- 三合局系神煞：以年支（及日支）所属三合局查 --- */
  const juNames = [];
  for (const [name, members] of Object.entries(TRIPLE_NAME)) {
    if (members.includes(BRANCHES[yearBranchIndex])) juNames.push({ name, from: '年支' });
  }
  for (const j of juNames) {
    const d = SANHE_DERIVED[j.name];
    add(`驿马（${j.from}${j.name}）`, posOfBranchEq(d.驿马));
    add(`桃花（${j.from}${j.name}）`, posOfBranchEq(d.桃花));
    add(`华盖（${j.from}${j.name}）`, posOfBranchEq(d.华盖));
    add(`将星（${j.from}${j.name}）`, posOfBranchEq(d.将星));
    add(`劫煞（${j.from}${j.name}）`, posOfBranchEq(d.劫煞));
    add(`亡神（${j.from}${j.name}）`, posOfBranchEq(d.亡神));
    add(`灾煞（${j.from}${j.name}）`, posOfBranchEq(d.灾煞));
    add(`天煞（${j.from}${j.name}）`, posOfBranchEq(d.天煞));
    add(`地煞（${j.from}${j.name}）`, posOfBranchEq(d.地煞));
  }
  /* --- 咸池（即桃花，别名） --- */
  {
    const ju = Object.entries(TRIPLE_NAME).find(([, m]) => m.includes(BRANCHES[yearBranchIndex]));
    if (ju) add('咸池（桃花别名）', posOfBranchEq(SANHE_DERIVED[ju[0]].桃花));
  }

  /* --- 孤辰寡宿（年支） --- */
  add('孤辰', posOfBranchEq(GUCHEN[BRANCHES[yearBranchIndex]]));
  add('寡宿', posOfBranchEq(GUASU[BRANCHES[yearBranchIndex]]));

  /* --- 十恶大败 / 阴差阳错（日柱） --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (SHIE_DABAI_GZ.includes(dayGz)) result.push({ name: '十恶大败日', positions: ['日柱'], note: dayGz });
    if (YINCHAYANGCUO_GZ.includes(dayGz)) result.push({ name: '阴差阳错日', positions: ['日柱'], note: dayGz });
  }

  /* --- 天罗地网（依《三命通会》原典「戌亥为天罗，辰巳为地网」；须成对相并在位） --- */
  {
    const hasXu = branches.includes('戌');
    const hasHai = branches.includes('亥');
    const hasChen = branches.includes('辰');
    const hasSi = branches.includes('巳');

    if (hasXu && hasHai) {
      add('天罗', posOf(['戌', '亥']), '《三命通会》「戌亥为天罗……猪犬侵凌，每虑丈夫厄难」；局中戌亥成对相并在位');
    }
    if (hasChen && hasSi) {
      add('地网', posOf(['辰', '巳']), '《三命通会》「辰巳为地网……龙蛇混杂，常防妇女忧危」；局中辰巳成对相并在位');
    }
  }

  /* --- 小儿关煞 --- */
  {
    const g = XIAOER_GUANSHA[BRANCHES[yearBranchIndex]];
    if (g) result.push({ name: '小儿关煞', positions: ['年支'], note: `${g}（仅供参考，须结合大运流年与童限）` });
  }

  /* --- 四柱魁罡日 --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (['庚辰', '庚戌', '壬辰', '戊戌'].includes(dayGz)) result.push({ name: '魁罡', positions: ['日柱'], note: dayGz });
  }

  /* --- 三奇贵人以外的常见贵格：天赦日 --- */
  {
    const mb = BRANCHES[monthBranchIndex];
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    const tianshe = { 寅: ['戊寅'], 卯: ['戊寅'], 辰: ['戊寅'], 巳: ['甲午'], 午: ['甲午'], 未: ['甲午'], 申: ['戊申'], 酉: ['戊申'], 戌: ['戊申'], 亥: ['甲子'], 子: ['甲子'], 丑: ['甲子'] };
    if ((tianshe[mb] ?? []).includes(dayGz)) result.push({ name: '天赦日', positions: ['日柱'], note: dayGz });
  }

  /* --- 暗禄日（自坐暗禄） --- */
  {
    const dayGz = STEMS[dayStemIndex] + BRANCHES[dayBranchIndex];
    if (ANLU_DAY_GZ.includes(dayGz)) {
      result.push({ name: '暗禄日', positions: ['日柱'], note: `${dayGz}（自坐暗禄）` });
    }
  }

  return result;
}

/** 神煞中"吉""凶"属性粗分类，供参考（非绝对） */
const AUSPICIOUS = ['天乙贵人', '文昌贵人', '太极贵人', '天德贵人', '月德贵人', '禄神', '暗禄', '金舆', '天赦日', '将星'];
const INAUSPICIOUS = ['羊刃', '红艳煞', '流霞', '劫煞', '亡神', '灾煞', '天煞', '地煞', '孤辰', '寡宿', '十恶大败日', '阴差阳错日', '魁罡', '小儿关煞'];
export function shenshaNature(name) {
  if (AUSPICIOUS.some((a) => name.startsWith(a))) return '吉';
  if (INAUSPICIOUS.some((a) => name.startsWith(a))) return '凶';
  return '中';
}

export function shenshaOf(pillars, dayStemIndex, yearStemIndex, gender = '男') {
  return computeShenSha(
    pillars, dayStemIndex, yearStemIndex,
    pillars[1].branchIndex, pillars[2].branchIndex, pillars[0].branchIndex, gender,
  ).map((s) => ({ ...s, nature: shenshaNature(s.name) }));
}

export {
  TIANYI, WENCHANG, TAIJI, TIANDE, YUEDE,
  YANGREN, JINYU, HONGYAN, LIUXIA, SANQI,
  TRIPLE, SANHE_DERIVED, TRIPLE_NAME,
  GUCHEN, GUASU, XIAOER_GUANSHA,
  computeShenSha, AUSPICIOUS, INAUSPICIOUS,
};
