// 核心/matcher/geju.mjs
// 丙层 · 格局派学理排他特征匹配谓词集
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS, GANZHI,
  STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, SHENG_ELEM, KE_ELEM,
  safeTenGod, getKongWang, safeNayin,
  TIANYI_MAP, LU_MAP, REN_MAP, CHUAN_DEFS, CHONG_DEFS, STEM_HE, BRANCH_HE,
  ZAISHA_MAP, YUANCHEN_MAP, HONGLUAN_MAP, TIANXI_MAP, JIE_MAP,
  CHANGSHENG_MAP, MUKU_MAP,
} from './helpers.mjs';
import { GEJU_CHENGBAI_PREDICATES } from './geju_chengbai.mjs';
import { GEJU_JIUYING_PREDICATES } from './geju_jiuying.mjs';

export const GEJU_PREDICATES = {
  'S-GJ-001': (f) => f.monthMainStemExposed,
  'S-GJ-002': (f) => f.exposedTenGods.includes('正官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-003': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-004': (f) => f.exposedTenGods.includes('食神') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-005': (f) => ['庚', '辛'].includes(f.dayStem) && f.isWinter && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀')),
  'S-GJ-006': (f) => (f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')) && f.exposedTenGods.includes('七杀'),
  'S-GJ-007': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-008': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财')),
  'S-GJ-009': (f) => (f.branches[1] === f.luBranch || f.branches[1] === f.renBranch) && (f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正财')),
  'S-GJ-010': (f) => {
    const noYinBiExposed = !f.exposedTenGods.some((t) => t.includes('印') || t.includes('比') || t.includes('劫'));
    const hasGuanSha = f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官');
    const monthIsGuanSha = f.monthMainTenGod?.includes('官') || f.monthMainTenGod?.includes('杀');
    const branchHasSelf = f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    return noYinBiExposed && (hasGuanSha || monthIsGuanSha) && !branchHasSelf;
  },
  'S-GJ-011': (f) => f.branches.filter((b) => BRANCH_TO_ELEMENT[b] === f.dayElement).length >= 3,
  'S-GJ-012': (f) => {
    const noYinBiExposed = !f.exposedTenGods.some((t) => t.includes('印') || t.includes('比') || t.includes('劫'));
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const monthIsCai = f.monthMainTenGod?.includes('财');
    const branchHasSelf = f.branches.some((b) => BRANCH_TO_ELEMENT[b] === f.dayElement);
    return noYinBiExposed && (hasCai || monthIsCai) && !branchHasSelf && !f.hasLu && !f.hasYangRen;
  },
  'S-GJ-013': (f) => f.hasYangRen && (f.exposedTenGods.includes('七杀') || f.exposedTenGods.includes('正官')),
  'S-GJ-014': (f) => ['辰', '戌', '丑', '未'].includes(f.monthBranch),
  'S-GJ-015': (f) => {
    const allElems = new Set([...f.stems.map((s) => STEM_TO_ELEMENT[s]), ...f.branches.map((b) => BRANCH_TO_ELEMENT[b])]);
    if (allElems.size <= 2) {
      const arr = [...allElems];
      return arr.length === 2 && (SHENG_ELEM[arr[0]] === arr[1] || SHENG_ELEM[arr[1]] === arr[0]);
    }
    const pcts = f.elemStrength?.percent || f.elemStrength?.percentages || {};
    const entries = Object.entries(pcts).sort((a, b) => b[1] - a[1]);
    if (entries.length >= 2 && entries[0][1] + entries[1][1] >= 85) {
      return SHENG_ELEM[entries[0][0]] === entries[1][0] || SHENG_ELEM[entries[1][0]] === entries[0][0];
    }
    return false;
  },
  'S-GJ-016': (f) => (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')) && f.exposedTenGods.includes('正官'),
  'S-GJ-017': (f) => {
    const monthIsYin = f.monthMainTenGod?.includes('印');
    const hasYin = f.exposedTenGods.some((t) => t.includes('印'));
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const hasGuanSha = f.exposedTenGods.includes('正官') || f.exposedTenGods.includes('七杀');
    return (monthIsYin || hasYin) && hasCai && !hasGuanSha;
  },
  'S-GJ-018': (f) => f.exposedTenGods.includes('偏印') && f.exposedTenGods.includes('食神'),
  'S-GJ-019': (f) => {
    const hasGuan = f.exposedTenGods.includes('正官');
    const hasSha = f.exposedTenGods.includes('七杀');
    const hasCai = f.monthMainTenGod?.includes('财') || f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const hasBiJie = f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财');
    return hasGuan && !hasSha && hasCai && hasBiJie;
  },
  'S-GJ-020': (f) => ['甲', '乙'].includes(f.dayStem) && f.isSummer && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('正官')),
  'S-GJ-021': (f) => (
    f.exposedTenGods.includes('七杀')
    && f.exposedTenGods.includes('食神')
    && (f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财'))
  ),
  'S-GJ-022': (f) => f.exposedTenGods.includes('七杀') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-023': (f) => {
    const isLuJie = f.branches[1] === f.luBranch || f.branches[1] === f.renBranch || f.monthMainTenGod?.includes('比') || f.monthMainTenGod?.includes('劫');
    const hasShiShang = f.exposedTenGods.includes('食神') || f.exposedTenGods.includes('伤官');
    const hasCai = f.exposedTenGods.includes('正财') || f.exposedTenGods.includes('偏财');
    const noYin = !f.exposedTenGods.some((t) => t.includes('印'));
    return isLuJie && hasShiShang && hasCai && noYin;
  },
  'S-GJ-024': (f) => f.hasYangRen && f.yangRenChong,
  'S-GJ-025': (f) => f.branches[3] === f.luBranch,
  'S-GJ-026': (f) => f.exposedTenGods.includes('伤官') && (f.exposedTenGods.includes('正印') || f.exposedTenGods.includes('偏印')),
  'S-GJ-027': (f) => (
    (f.exposedTenGods.includes('偏财') || (f.monthMainTenGod === '偏财' && f.exposedTenGods.includes('正财')))
    && (f.exposedTenGods.includes('比肩') || f.exposedTenGods.includes('劫财'))
    && f.exposedTenGods.includes('正官')
  ),
  'S-GJ-028': (f) => safeTenGod(f.dayStem, f.stems[3]) === '七杀',
  'S-GJ-029': (f) => ['壬午', '癸巳', '甲午'].includes(f.dayGz),
  'S-GJ-030': (f) => f.exposedTenGods.includes('正官') && f.exposedTenGods.includes('七杀'),

  // 子平外格群（批次 A：30 条外格全量落地）
  'S-GJ-031': (f) => {
    // 飞天禄马格：庚子/壬子冲午，辛亥/癸亥冲巳
    const isZiDay = ['庚子', '壬子'].includes(f.dayGz);
    const isHaiDay = ['辛亥', '癸亥'].includes(f.dayGz);
    if (!isZiDay && !isHaiDay) return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    if (!noGuanExposed) return false;
    if (isZiDay) {
      const ziCount = f.branches.filter((b) => b === '子').length;
      return ziCount >= 3 && !f.branches.includes('午') && !f.branches.includes('丑');
    }
    const haiCount = f.branches.filter((b) => b === '亥').length;
    return haiCount >= 3 && !f.branches.includes('巳') && !f.branches.includes('寅');
  },
  'S-GJ-032': (f) => {
    // 倒冲禄马格：丙午冲子，丁巳冲亥
    const isBingWu = f.dayGz === '丙午';
    const isDingSi = f.dayGz === '丁巳';
    if (!isBingWu && !isDingSi) return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    if (!noGuanExposed) return false;
    if (isBingWu) {
      const wuCount = f.branches.filter((b) => b === '午').length;
      return wuCount >= 3 && !f.branches.includes('子') && !f.branches.includes('未');
    }
    const siCount = f.branches.filter((b) => b === '巳').length;
    return siCount >= 3 && !f.branches.includes('亥') && !f.branches.includes('申');
  },
  'S-GJ-033': (f) => {
    // 井栏叉格：庚日申子辰全
    if (f.dayStem !== '庚' || !['庚申', '庚子', '庚辰'].includes(f.dayGz)) return false;
    const hasShenZiChen = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const noFireExposed = !f.stems.some((s) => ['丙', '丁'].includes(s));
    const noFireBranch = !f.branches.some((b) => ['巳', '午'].includes(b));
    return hasShenZiChen && noFireExposed && noFireBranch;
  },
  'S-GJ-034': (f) => {
    // 壬骑龙背格：壬辰日辰多
    if (f.dayGz !== '壬辰') return false;
    const chenCount = f.branches.filter((b) => b === '辰').length;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const notDingHe = !f.stems.includes('丁');
    return chenCount >= 2 && noGuanExposed && notDingHe;
  },
  'S-GJ-035': (f) => {
    // 六乙鼠贵格：乙日丙子时
    if (f.dayStem !== '乙' || f.hourGz !== '丙子') return false;
    const noMetalExposed = !f.stems.some((s) => ['庚', '辛'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    return noMetalExposed && noWuChong && noChouBan;
  },
  'S-GJ-036': (f) => {
    // 六阴朝阳格：六辛日戊子时，只宜子字一位
    if (f.dayStem !== '辛' || f.hourGz !== '戊子') return false;
    const ziCount = f.branches.filter((b) => b === '子').length;
    const noFireExposed = !f.stems.some((s) => ['丙', '丁'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    const noSiTian = !f.branches.includes('巳');
    return ziCount === 1 && noFireExposed && noWuChong && noChouBan && noSiTian;
  },
  'S-GJ-037': (f) => {
    // 拱禄格：日时同干虚拱禄位，忌填实
    const dGz = f.dayGz;
    const hGz = f.hourGz;
    if (f.dayStem !== f.hourStem) return false;
    if ((dGz === '癸亥' && hGz === '癸丑') || (dGz === '癸丑' && hGz === '癸亥')) {
      return !f.branches.includes('子');
    }
    if ((dGz === '丁巳' && hGz === '丁未') || (dGz === '丁未' && hGz === '丁巳')) {
      return !f.branches.includes('午');
    }
    if ((dGz === '己未' && hGz === '己巳') || (dGz === '己巳' && hGz === '己未')) {
      return !f.branches.includes('午');
    }
    if ((dGz === '戊辰' && hGz === '戊午') || (dGz === '戊午' && hGz === '戊辰')) {
      return !f.branches.includes('巳');
    }
    return false;
  },
  'S-GJ-038': (f) => {
    // 拱贵格：日时同干虚拱贵人，忌填实
    if (f.dayStem !== f.hourStem) return false;
    return f.gongJia?.clamps?.some((c) => c.type === '拱贵' && !c.isFilled) || false;
  },
  'S-GJ-039': (f) => {
    // 子遥巳禄格：甲子日甲子时
    if (f.dayGz !== '甲子' || f.hourGz !== '甲子') return false;
    const noGuanShaExposed = !f.stems.some((s) => ['庚', '辛'].includes(s));
    const noWuChong = !f.branches.includes('午');
    const noChouBan = !f.branches.includes('丑');
    const noSiTian = !f.branches.includes('巳');
    return noGuanShaExposed && noWuChong && noChouBan && noSiTian;
  },
  'S-GJ-040': (f) => {
    // 丑遥巳禄格：辛丑/癸丑日丑多
    if (!['辛丑', '癸丑'].includes(f.dayGz)) return false;
    const chouCount = f.branches.filter((b) => b === '丑').length;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const noSiTian = !f.branches.includes('巳');
    const noWeiChong = !f.branches.includes('未');
    return chouCount >= 2 && noGuanExposed && noSiTian && noWeiChong;
  },
  'S-GJ-041': (f) => {
    // 刑合格：癸日甲寅时
    if (!['癸亥', '癸卯', '癸酉'].includes(f.dayGz) || f.hourGz !== '甲寅') return false;
    const noGuanExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const noGengShen = !f.stems.includes('庚') && !f.branches.includes('申');
    const noSiTian = !f.branches.includes('巳');
    return noGuanExposed && noGengShen && noSiTian;
  },
  'S-GJ-042': (f) => {
    // 合禄格：戊日庚申时
    if (f.dayStem !== '戊' || f.hourGz !== '庚申') return false;
    const noJiaBing = !f.stems.includes('甲') && !f.stems.includes('丙');
    const noYinChong = !f.branches.includes('寅');
    const noSiTian = !f.branches.includes('巳');
    return noJiaBing && noYinChong && noSiTian;
  },
  'S-GJ-043': (f) => {
    // 六甲趋乾格：甲日亥多
    if (f.dayStem !== '甲') return false;
    const haiCount = f.branches.filter((b) => b === '亥').length;
    const noSiChong = !f.branches.includes('巳');
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    return haiCount >= 2 && noSiChong && noGuanShaExposed;
  },
  'S-GJ-044': (f) => {
    // 六壬趋艮格：壬日寅多
    if (f.dayStem !== '壬') return false;
    const yinCount = f.branches.filter((b) => b === '寅').length;
    const noShenChong = !f.branches.includes('申');
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const notHaiMonth = f.monthBranch !== '亥';
    return yinCount >= 2 && noShenChong && noGuanShaExposed && notHaiMonth;
  },
  'S-GJ-045': (f) => {
    // 勾陈得位格：戊己日坐财官之局
    if (!['戊', '己'].includes(f.dayStem)) return false;
    const hasWoodJu = f.branches.includes('亥') && f.branches.includes('卯') && f.branches.includes('未');
    const hasWaterJu = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const sitsCaiGuan = ['戊寅', '戊子', '戊申', '己卯', '己亥', '己未'].includes(f.dayGz);
    const hasRoot = f.roots?.highestTier && f.roots.highestTier !== '虚浮无根';
    return (hasWoodJu || hasWaterJu || sitsCaiGuan) && hasRoot;
  },
  'S-GJ-046': (f) => {
    // 玄武当权格：壬癸日坐火土财官之局
    if (!['壬', '癸'].includes(f.dayStem)) return false;
    const hasFireJu = f.branches.includes('寅') && f.branches.includes('午') && f.branches.includes('戌');
    const sitsFireEarth = ['壬午', '壬戌', '壬辰', '癸巳', '癸未', '癸丑'].includes(f.dayGz);
    const hasRoot = f.roots?.highestTier && f.roots.highestTier !== '虚浮无根';
    return (hasFireJu || sitsFireEarth) && hasRoot;
  },
  'S-GJ-047': (f) => {
    // 福德秀气格：乙日巳酉丑金局
    if (f.dayStem !== '乙') return false;
    const isDayValid = ['乙巳', '乙酉', '乙丑'].includes(f.dayGz);
    const hasMetalJu = f.branches.includes('巳') && f.branches.includes('酉') && f.branches.includes('丑');
    const isYueYou = f.monthBranch === '酉';
    return isDayValid && (hasMetalJu || isYueYou);
  },
  'S-GJ-048': (f) => {
    // 魁罡格：戊戌、庚戌、庚辰、壬辰四日
    if (!['戊戌', '庚戌', '庚辰', '壬辰'].includes(f.dayGz)) return false;
    const hasRoot = f.roots?.isSelfRooted || f.roots?.isMonthRooted || (f.roots?.branchCounts >= 2);
    const noZhengGuan = !f.exposedTenGods.includes('正官');
    return hasRoot && noZhengGuan;
  },
  'S-GJ-049': (f) => {
    // 金神格：乙丑、己巳、癸酉时
    if (!['乙丑', '己巳', '癸酉'].includes(f.hourGz)) return false;
    if (!['甲', '己', '乙'].includes(f.dayStem)) return false;
    const hasFire = f.stems.some((s) => ['丙', '丁'].includes(s)) || f.branches.some((b) => ['巳', '午', '寅'].includes(b));
    return hasFire;
  },
  'S-GJ-050': (f) => {
    // 日贵格：丁酉、丁亥、癸巳、癸卯自坐天乙
    if (!['丁酉', '丁亥', '癸巳', '癸卯'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChongOrChuan = (f.chongPairs || []).some((p) => p.includes(dayBranch)) || (f.chuanPairs || []).some((p) => p.includes(dayBranch));
    return !isChongOrChuan;
  },
  'S-GJ-051': (f) => {
    // 日德格：甲寅、丙辰、戊辰、庚辰、壬戌五日
    if (!['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChongOrChuan = (f.chongPairs || []).some((p) => p.includes(dayBranch)) || (f.chuanPairs || []).some((p) => p.includes(dayBranch));
    return !isChongOrChuan;
  },
  'S-GJ-052': (f) => {
    // 日禄归时格：时支见日禄无官杀
    if (f.branches[3] !== f.luBranch) return false;
    const noGuanShaExposed = !f.exposedTenGods.includes('正官') && !f.exposedTenGods.includes('七杀');
    const hourNotChong = !(f.chongPairs || []).some((p) => p.includes(f.branches[3]));
    return noGuanShaExposed && hourNotChong;
  },
  'S-GJ-053': (f) => {
    // 禄马同乡格：壬午、癸巳自坐财官
    if (!['壬午', '癸巳'].includes(f.dayGz)) return false;
    const dayBranch = f.branches[2];
    const isChong = (f.chongPairs || []).some((p) => p.includes(dayBranch));
    return !isChong;
  },
  'S-GJ-054': (f) => {
    // 天元一气格：四干完全相同
    return f.stems.length === 4 && f.stems.every((s) => s === f.stems[0]);
  },
  'S-GJ-055': (f) => {
    // 地支一字格：四支完全相同
    return f.branches.length === 4 && f.branches.every((b) => b === f.branches[0]);
  },
  'S-GJ-056': (f) => {
    // 两干不杂格：年月同干且日时同干，四柱恰好两干各半
    const uniqueStems = new Set(f.stems);
    if (uniqueStems.size !== 2) return false;
    const yearMonthSame = f.stems[0] === f.stems[1] && f.stems[2] === f.stems[3];
    const altSame = f.stems[0] === f.stems[2] && f.stems[1] === f.stems[3];
    return yearMonthSame || altSame;
  },
  'S-GJ-057': (f) => {
    // 胞胎逢印格：时支为日干五行绝位且月令有印生扶
    const JUE_BRANCH = { 甲: '申', 乙: '酉', 丙: '亥', 丁: '子', 戊: '亥', 己: '子', 庚: '寅', 辛: '卯', 壬: '巳', 癸: '午' };
    const isHourJue = f.branches[3] === JUE_BRANCH[f.dayStem];
    const hasYin = f.monthMainTenGod?.includes('印') || f.exposedTenGods.some((t) => t.includes('印'));
    return isHourJue && hasYin;
  },
  'S-GJ-058': (f) => {
    // 夹丘格：日时相隔一位虚夹四库之一
    const MUKU = ['辰', '戌', '丑', '未'];
    const dBranch = f.branches[2];
    const hBranch = f.branches[3];
    const BRANCH_SEQ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const dIdx = BRANCH_SEQ.indexOf(dBranch);
    const hIdx = BRANCH_SEQ.indexOf(hBranch);
    if (Math.abs(dIdx - hIdx) === 2) {
      const midIdx = (dIdx + hIdx) / 2;
      const midBranch = BRANCH_SEQ[midIdx];
      return MUKU.includes(midBranch) && !f.branches.includes(midBranch);
    }
    return false;
  },
  'S-GJ-059': (f) => {
    // 从革格：庚辛日生申酉月，地支巳酉丑或申酉戌金局全
    if (!['庚', '辛'].includes(f.dayStem)) return false;
    const isSiYouChou = f.branches.includes('巳') && f.branches.includes('酉') && f.branches.includes('丑');
    const isShenYouXu = f.branches.includes('申') && f.branches.includes('酉') && f.branches.includes('戌');
    const noHeavyFire = f.stems.filter((s) => ['丙', '丁'].includes(s)).length <= 1;
    return (isSiYouChou || isShenYouXu) && noHeavyFire;
  },
  'S-GJ-060': (f) => {
    // 润下格：壬癸日生亥子月，地支申子辰或亥子丑水局全
    if (!['壬', '癸'].includes(f.dayStem)) return false;
    const isShenZiChen = f.branches.includes('申') && f.branches.includes('子') && f.branches.includes('辰');
    const isHaiZiChou = f.branches.includes('亥') && f.branches.includes('子') && f.branches.includes('丑');
    const noHeavyEarth = f.stems.filter((s) => ['戊', '己'].includes(s)).length === 0;
    return (isShenZiChen || isHaiZiChou) && noHeavyEarth;
  },
  ...GEJU_CHENGBAI_PREDICATES,
  ...GEJU_JIUYING_PREDICATES,
};
