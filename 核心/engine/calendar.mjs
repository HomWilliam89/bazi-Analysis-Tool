/**
 * 历法天文与大运流年推演引擎
 * 依据：寿星天文历高精度节气算法、立春起年、交运起法
 */
import { SunPosition, SearchSunLongitude } from '../astronomy.mjs';
import {
  STEMS, BRANCHES, SOLAR_TERMS, TERM_LONGITUDE, ZODIAC,
  gzIndex, gzName, nayinOf,
} from './constants.mjs';

const RAD = Math.PI / 180;
function norm360(d) { const x = d % 360; return x < 0 ? x + 360 : x; }

/** 由儒略日(JD, 力学时 TT)算太阳视黄经（度） */
export function sunApparentLongitude(jde) {
  const ms = (jde - 2440587.5) * 86400000;
  return SunPosition(new Date(ms)).elon;
}

/** TT - UT（秒）近似，Espenak & Meeus 多项式，用于把力学时换算到世界时 */
function deltaTSeconds(year) {
  let y = year;
  let u, t;
  if (y < 1900) {
    t = (y - 1860) / 1;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
  u = (y - 1820) / 100; return -20 + 32 * u * u;
}

/** JD(TT) -> JD(UT) */
function jdeToJd(jde, year) { return jde - deltaTSeconds(year) / 86400; }

/** JD -> 北京时间的年月日时分（UTC+8） */
export function jdToBeijing(jd) {
  const z = jd + 0.5 + 8 / 24;
  const Z = Math.floor(z);
  let F = z - Z;
  let A;
  if (Z < 2299161) A = Z;
  else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayWithFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayWithFrac);
  const frac = dayWithFrac - day;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  let totalMinutes = Math.round(frac * 1440);
  let d = day, m = month, y = year;
  if (totalMinutes >= 1440) { totalMinutes -= 1440; d += 1; }
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return { year: y, month: m, day: d, hour: hh, minute: mm };
}

/** 儒略日 -> 干支序（用于校准） */
function jdToGzDay(jd) {
  const jdn = Math.floor(jd + 0.5);
  return ((jdn + 49) % 60 + 60) % 60;
}

/**
 * 求某年某节气的时刻（北京时间，天文级高精度，分钟级严格对齐历书）。
 * @param {number} year 公历年（节气名以该年 1 月的小寒为起点）
 * @param {number} index 0-23，对应 SOLAR_TERMS
 * @returns {{year,month,day,hour,minute,second}} 北京时间
 */
export function solarTermMoment(year, index) {
  const targetLon = TERM_LONGITUDE[index];
  // 估算节气中心时刻（小寒起点约在 1 月 5-6 日）
  const baseMs = Date.UTC(year, 0, 5, 0, 0, 0) + index * 15.2184 * 86400000;
  // 前置 7 天作为搜索起点，向后搜索 15 天（自适应变号割线求根，彻底消除出窗撞端点缺陷）
  const startDate = new Date(baseMs - 7 * 86400000);
  const astroTime = SearchSunLongitude(targetLon, startDate, 15);
  if (!astroTime || !astroTime.date) {
    throw new Error(`无法计算 ${year} 年节气 ${SOLAR_TERMS[index]} 的天文时刻`);
  }
  // 四舍五入到整秒，消除毫秒截断并确保分秒天然一致
  const roundedMs = Math.round(astroTime.date.getTime() / 1000) * 1000;
  const bjDate = new Date(roundedMs + 8 * 3600000);
  return {
    year: bjDate.getUTCFullYear(),
    month: bjDate.getUTCMonth() + 1,
    day: bjDate.getUTCDate(),
    hour: bjDate.getUTCHours(),
    minute: bjDate.getUTCMinutes(),
    second: bjDate.getUTCSeconds(),
  };
}

/** 某公历年 24 节气（北京时间） */
export function solarTermsOfYear(year) {
  return SOLAR_TERMS.map((name, i) => ({ name, index: i, ...solarTermMoment(year, i) }));
}

/** 比较两个北京时间的先后 */
function cmpMoment(a, b) {
  return (a.year - b.year) || (a.month - b.month) || (a.day - b.day) || (a.hour - b.hour) || (a.minute - b.minute);
}
/** 把 {y,m,d,h,mi} 转为可比较的数值（近似，用于区间定位） */
function momentValue(t) {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) / 60000;
}

/**
 * 找出给定时刻所在的"节气月"。
 * 月支：以 12 个"节"为界（立春→寅、惊蛰→卯、清明→辰、立夏→巳、芒种→午、
 * 小暑→未、立秋→申、白露→酉、寒露→戌、立冬→亥、大雪→子、小寒→丑）。
 * @returns {{monthBranchIndex:number, termName:string, termMoment:object, nextTerm:object}}
 */
export function solarMonthOf(moment) {
  const y = moment.year;
  // 收集 y-1, y, y+1 三年的"节"（偶数 index 为节，奇数 index 为中气）
  const jieIndexes = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; // 小寒 立春 惊蛰 ...
  const points = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const i of jieIndexes) {
      const t = solarTermMoment(yy, i);
      points.push({ termIndex: i, termName: SOLAR_TERMS[i], moment: t });
    }
  }
  points.sort((a, b) => cmpMoment(a.moment, b.moment));
  const v = momentValue(moment);
  let current = points[0];
  let next = points[points.length - 1];
  for (let i = 0; i < points.length; i++) {
    if (momentValue(points[i].moment) <= v) { current = points[i]; next = points[i + 1] ?? points[i]; }
  }
  // 节 -> 月支：小寒(0)->丑(1)，立春(2)->寅(2)，惊蛰(4)->卯(3) ...
  const branchIndex = ((current.termIndex / 2) + 1) % 12;
  return { monthBranchIndex: branchIndex, termName: current.termName, termMoment: current.moment, nextTerm: next };
}

/* ------------------------------------------------------------------ *
 * 八、四柱
 * ------------------------------------------------------------------ */

const MONTH_BRANCH_OF_TERM = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]; // 小寒->丑 立春->寅 ...

/** 年柱：以立春为界 */
function yearPillar(moment) {
  const thisYearLichun = solarTermMoment(moment.year, 2);
  const gzYear = cmpMoment(moment, thisYearLichun) < 0 ? moment.year - 1 : moment.year;
  const index = ((gzYear - 1984) % 60 + 60) % 60;
  return { index, stemIndex: index % 10, branchIndex: index % 12, gzYear, lichun: thisYearLichun };
}

/** 月柱：由节气月支 + 五虎遁推月干 */
function monthPillar(yearStemIndex, monthBranchIndex) {
  // 五虎遁：甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸何方发，甲寅之上好追求
  const base = (yearStemIndex % 5) * 2 + 2; // 寅月天干
  const offset = ((monthBranchIndex - 2) % 12 + 12) % 12; // 距寅月
  const stemIndex = (base + offset) % 10;
  return { stemIndex, branchIndex: monthBranchIndex, index: gzIndex(stemIndex, monthBranchIndex) };
}

/** 日柱：儒略日推 */
function dayPillar(moment) {
  // 以当地（北京）日期的正午作为该日的 JD，避免跨日误差
  const jd = gregorianToJd(moment.year, moment.month, moment.day) + 0.5;
  const index = jdToGzDay(jd);
  return { index, stemIndex: index % 10, branchIndex: index % 12 };
}

/** 公历 -> 儒略日（当日 0h UT 起点） */
export function gregorianToJd(y, m, d) {
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const A = Math.floor(yy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5;
}

/** 时柱：由日干 + 五鼠遁推时干 */
function hourPillar(dayStemIndex, hourBranchIndex) {
  // 五鼠遁：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
  const base = (dayStemIndex % 5) * 2; // 子时天干
  const stemIndex = (base + hourBranchIndex) % 10;
  return { stemIndex, branchIndex: hourBranchIndex, index: gzIndex(stemIndex, hourBranchIndex) };
}

/** 时辰 -> 时支序（子=0）；23:00-00:59 为子时 */
export function hourToBranchIndex(hour, minute = 0) {
  const h = hour + (minute >= 60 ? 1 : 0);
  if (h >= 23 || h < 1) return 0;       // 子
  return Math.floor((h + 1) / 2) % 12;
}

export function luckDirection(yangYear, gender) {
  const forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
  return forward ? '顺行' : '逆行';
}

/**
 * 由起运岁数（年/月/日）推**交运公历时刻**。
 *
 * 为什么必须这样算：起运是按"三日折一年"折算出来的**时长**，不是"从立春年起算的年号"。
 * 它必须落到「出生时刻 + 该时长」上，再取公历年。
 * 旧实现用 `立春年 + floor(起运岁)` 且丢掉月日 —— 于是
 *   ① 每隔一年错一次：2001-08-10 生、起运 0年9个月 → 记成 2001 年起，应交运于 2002-05；
 *   ② 1 月生者更荒谬：立春年还是上一年，1 运起始年可以**早于出生日**。
 * 实测 2001 全年 365 天中有 199 天（54.5%）因此早一年。
 *
 * @param {{year:number,month:number,day:number,hour?:number,minute?:number}} m 出生时刻
 * @param {{startAgeYears:number,startAgeMonths:number,startAgeDays:number}} st 起运岁数
 * @returns {{year:number,month:number,day:number,hour:number,minute:number}} 交运时刻
 */
function addStartAgeToMoment(m, st) {
  let mo = m.month - 1 + (st.startAgeMonths || 0);
  const y = m.year + (st.startAgeYears || 0) + Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  // 先按"目标月的实际天数"夹取日，再叠加零余天数，避免 1/31 + 1 月 溢出成 3/3。
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const day = Math.min(m.day, daysInMonth) + (st.startAgeDays || 0);
  const dt = new Date(Date.UTC(y, mo, day, m.hour || 0, m.minute || 0));
  return {
    year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(),
    hour: dt.getUTCHours(), minute: dt.getUTCMinutes(),
  };
}

/**
 * 由节气推起运：顺行数至下一个节，逆行数至上一个节，三日折一年。
 */
function computeStartLuck(moment, forward) {
  const info = solarMonthOf(moment);
  const from = forward ? info.nextTerm.moment : info.termMoment;
  const diffDays = Math.abs(momentValue(from) - momentValue(moment)) / 1440;
  const yearsFloat = diffDays / 3;
  const years = Math.floor(yearsFloat);
  const monthsFloat = (yearsFloat - years) * 12;
  const months = Math.floor(monthsFloat);
  const days = Math.round((monthsFloat - months) * 30);
  const nominalAge = years + 1; // 虚岁
  const startMoment = addStartAgeToMoment(moment, {
    startAgeYears: years, startAgeMonths: months, startAgeDays: days,
  });
  const p2 = (n) => String(n).padStart(2, '0');
  return {
    forward,
    referenceTerm: from,
    daysToTerm: Number(diffDays.toFixed(4)),
    yearsFloat: Number(yearsFloat.toFixed(4)),
    startAgeText: `${years}年${months}个月${days}天`,
    startAgeYears: years,
    startAgeMonths: months,
    startAgeDays: days,
    startNominalAge: nominalAge,
    startMoment,
    startDate: `${startMoment.year}-${p2(startMoment.month)}-${p2(startMoment.day)}`,
    startYearCivil: startMoment.year,
  };
}

/**
 * 生成大运干支序列。
 * @param {object} monthPillarObj 月柱
 * @param {number} count 步数
 * @param {boolean} forward
 */
export function buildLuckPillars(monthPillarObj, count = 10, forward = true, startInfo = null) {
  const out = [];
  const base = monthPillarObj.index;
  for (let i = 1; i <= count; i++) {
    const idx = ((base + (forward ? i : -i)) % 60 + 60) % 60;
    const age = startInfo ? startInfo.startAgeYears + (i - 1) * 10 : (i - 1) * 10 + 1;
    out.push({
      step: i,
      index: idx,
      gz: gzName(idx),
      stemIndex: idx % 10,
      branchIndex: idx % 12,
      startAge: age,
      ageRange: `${age}-${age + 9}`,
      ...(startInfo ? { startYear: null } : {}),
    });
  }
  return out;
}

/** 公历年 -> 年柱干支序（以立春为界，此处用公历年近似，精确判定用 yearPillar） */
export function yearGzIndex(year) { return ((year - 1984) % 60 + 60) % 60; }

/** 流年（按立春为界的干支年） */
export function yearPillarOf(gzYear) {
  const idx = yearGzIndex(gzYear);
  return {
    year: gzYear,
    index: idx,
    gz: gzName(idx),
    stemIndex: idx % 10,
    branchIndex: idx % 12,
    nayin: nayinOf(idx),
    zodiac: ZODIAC[idx % 12],
  };
}

/** 流月（某干支年的十二月建） */
export function monthsOfYear(gzYear) {
  const yidx = yearGzIndex(gzYear);
  const ys = yidx % 10;
  const out = [];
  for (let k = 0; k < 12; k++) {
    const branchIndex = (2 + k) % 12; // 寅月起
    const mp = monthPillar(ys, branchIndex);
    out.push({
      order: k + 1, gz: gzName(mp.index), stemIndex: mp.stemIndex, branchIndex: mp.branchIndex,
      monthBranch: BRANCHES[branchIndex], term: SOLAR_TERMS[(2 + k * 2) % 24],
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 十三、主入口：排盘
 * ------------------------------------------------------------------ */

/**
 * 排盘：由公历时刻推出完整命盘结构。
 *
 * @param {object} input
 * @param {number} input.year  公历年
 * @param {number} input.month 公历月 1-12
 * @param {number} input.day   公历日
 * @param {number} input.hour  0-23
 * @param {number} [input.minute=0]
 * @param {'男'|'女'} [input.gender='男']
 * @param {Array<{gz:string,startAge?:number,startYear?:number}>} [input.luckPillars]
 *        使用者直接提供的大运；若提供则优先采用，否则按节气推演
 * @param {number} [input.luckCount=10] 自动推演的大运步数
 * @returns {object} Chart
 */
export function isValidYear(year) {
  return Number.isInteger(year) && year >= 1000 && year <= 2500;
}

export function isValidGregorianDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
  const maxDays = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  return day <= maxDays;
}

function equationOfTimeMinutes(moment) {
  const jd = gregorianToJd(moment.year, moment.month, moment.day) + 0.5;
  const t = (jd - 2451545.0) / 36525;
  const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const eps = 23.439291 - 0.0130042 * t;
  const y = Math.tan(eps / 2 * RAD) ** 2;
  const eot = 4 * (180 / Math.PI) * (
    y * Math.sin(2 * l0 * RAD)
    - 2 * e * Math.sin(m * RAD)
    + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD)
    - 0.5 * y * y * Math.sin(4 * l0 * RAD)
    - 1.25 * e * e * Math.sin(2 * m * RAD)
  );
  return eot;
}

/**
 * 真太阳时校正。
 * 中国官方时间以东经 120° 为标准；出生地经度与 120° 之差每度折 4 分钟，
 * 再加均时差。用于精确判定时辰（尤其生于时辰边界者）。
 *
 * @param {{year,month,day,hour,minute}} moment 北京时间
 * @param {number} longitudeDeg 出生地东经（东经为正，西经为负）
 * @returns {{corrected:object, longitudeMinutes:number, eotMinutes:number, totalMinutes:number, shifted:boolean}}
 */
export function trueSolarTime(moment, longitudeDeg) {
  const lonMinutes = (longitudeDeg - 120) * 4;
  const eotMinutes = equationOfTimeMinutes(moment);
  const totalMinutes = lonMinutes + eotMinutes;
  const base = Date.UTC(moment.year, moment.month - 1, moment.day, moment.hour, moment.minute);
  const shifted = new Date(base + Math.round(totalMinutes) * 60000);
  return {
    corrected: {
      year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
    },
    longitudeMinutes: Number(lonMinutes.toFixed(2)),
    eotMinutes: Number(eotMinutes.toFixed(2)),
    totalMinutes: Number(totalMinutes.toFixed(2)),
    shifted: Math.round(totalMinutes) !== 0,
  };
}

export function dateCandidates(pillars, options = {}) {
  const { fromYear = 1900, toYear = 2100, maxCandidates = 60 } = options;
  const pos = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['year', 'month', 'day', 'hour'];
  const raw = Array.isArray(pillars) ? pillars : keys.map((k) => pillars?.[k]);

  const parsed = raw.map((gz, i) => {
    const s = String(gz ?? '').trim();
    if (s.length !== 2) throw new Error(`dateCandidates: ${pos[i]} 应为两个字的干支，收到「${s}」`);
    const si = STEMS.indexOf(s[0]), bi = BRANCHES.indexOf(s[1]);
    if (si < 0) throw new Error(`dateCandidates: ${pos[i]} 的天干「${s[0]}」不是合法天干`);
    if (bi < 0) throw new Error(`dateCandidates: ${pos[i]} 的地支「${s[1]}」不是合法地支`);
    if (si % 2 !== bi % 2) throw new Error(`dateCandidates: ${pos[i]}「${s}」阴阳不配，六十甲子中不存在此组合`);
    return { gz: s, stemIndex: si, branchIndex: bi, index: gzIndex(si, bi) };
  });
  const [yp, mp, dp, hp] = parsed;

  const 校验 = [];

  // ① 月柱须合五虎遁
  const expectMp = monthPillar(yp.stemIndex, mp.branchIndex);
  if (gzName(expectMp.index) !== mp.gz) {
    校验.push(`月柱不合五虎遁：年干「${yp.gz[0]}」配月支「${mp.gz[1]}」，月干应为「${STEMS[expectMp.stemIndex]}」，`
      + `即「${gzName(expectMp.index)}」，而非「${mp.gz}」`);
  }
  // ② 时柱须合五鼠遁
  const expectHp = hourPillar(dp.stemIndex, hp.branchIndex);
  if (gzName(expectHp.index) !== hp.gz) {
    校验.push(`时柱不合五鼠遁：日干「${dp.gz[0]}」配时支「${hp.gz[1]}」，时干应为「${STEMS[expectHp.stemIndex]}」，`
      + `即「${gzName(expectHp.index)}」，而非「${hp.gz}」`);
  }

  // ③ 年柱候选：六十年一循环
  const 年候选 = [];
  for (let y = fromYear; y <= toYear; y++) if (yearPillarOf(y).gz === yp.gz) 年候选.push(y);
  if (!年候选.length) {
    校验.push(`公历 ${fromYear}–${toYear} 年间不存在「${yp.gz}」年柱（年柱六十年一循环，且以立春为界）；请扩大年份范围`);
  }

  // ④ 逐候选年找该节气月，再在月内找日柱相合之日
  const JIE_IDX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const branchOfTerm = (i) => ((i / 2) + 1) % 12;
  const 候选 = [];
  let 有月区间但无日 = 0;

  for (const Y of 年候选) {
    const lichun = solarTermMoment(Y, 2);
    const pts = [];
    for (const yy of [Y, Y + 1]) {
      for (const i of JIE_IDX) pts.push({ i, name: SOLAR_TERMS[i], b: branchOfTerm(i), m: solarTermMoment(yy, i) });
    }
    pts.sort((a, b) => cmpMoment(a.m, b.m));
    let start = -1;
    for (let k = 0; k < pts.length; k++) {
      if (cmpMoment(pts[k].m, lichun) < 0) continue;
      if (pts[k].b === mp.branchIndex) { start = k; break; }
    }
    if (start < 0 || start + 1 >= pts.length) continue;
    const A = pts[start].m, B = pts[start + 1].m;
    有月区间但无日++;

    const startUtc = Date.UTC(A.year, A.month - 1, A.day);
    const endUtc = Date.UTC(B.year, B.month - 1, B.day);
    for (let t = startUtc; t <= endUtc; t += 86400000) {
      const dt = new Date(t);
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, dd = dt.getUTCDate();
      const dpi = dayPillar({ year: y, month: m, day: dd });
      if (gzName(dpi.index) !== dp.gz) continue;

      const b = hp.branchIndex;
      const h0 = (23 + 2 * b) % 24;      // 该时支的起始钟点（子时＝23 点起）
      const h1 = (h0 + 2) % 24;
      const 跨夜 = h1 < h0;             // 仅子时跨夜
      const startM = { year: y, month: m, day: dd, hour: h0, minute: 0 };
      let endM;
      if (跨夜) {
        const nx = new Date(Date.UTC(y, m - 1, dd + 1));
        endM = { year: nx.getUTCFullYear(), month: nx.getUTCMonth() + 1, day: nx.getUTCDate(), hour: h1, minute: 0 };
      } else {
        endM = { year: y, month: m, day: dd, hour: h1, minute: 0 };
      }

      // 与节气月区间求交：节气交接那一日的时辰窗口可能只有一部分落在本月，
      // 也可能完全不落。**不可把整段时辰照发**——那等于给出一个半属于隔壁月的日期。
      const effStart = cmpMoment(startM, A) > 0 ? startM : { ...A, minute: A.minute ?? 0 };
      const effEnd = cmpMoment(endM, B) < 0 ? endM : { ...B, minute: B.minute ?? 0 };
      if (cmpMoment(effStart, effEnd) >= 0) continue;   // 该时辰全在节气月之外
      const 被节气截断 = cmpMoment(effStart, startM) !== 0 || cmpMoment(effEnd, endM) !== 0;
      const fmt = (mm) => `${mm.year}-${String(mm.month).padStart(2, '0')}-${String(mm.day).padStart(2, '0')} `
        + `${String(mm.hour).padStart(2, '0')}:${String(mm.minute).padStart(2, '0')}`;
      const 时辰 = 被节气截断
        ? `${fmt(effStart)} – ${fmt(effEnd)}（已按节气${pts[start].name}／${pts[start + 1].name}交接截取）`
        : (跨夜
          ? `${String(h0).padStart(2, '0')}:00–次日${String(h1).padStart(2, '0')}:59`
          : `${String(h0).padStart(2, '0')}:00–${String(h1).padStart(2, '0')}:59`);

      候选.push({
        立春年: Y,
        日期: `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
        时支: hp.gz[1],
        时辰,
        时柱: hp.gz,
        被节气截断,
        节气月: `${fmt(A)}（${pts[start].name}）起，至 ${fmt(B)}（${pts[start + 1].name}）止`,
        边界提示: 被节气截断
          ? '⚠ 该时辰窗口与节气交接重叠，已按交接时刻截取；出生时刻若在校正后的窗口之外，则月柱不属本月'
          : '生于上述节气的交接前后数分钟者，节气月归属可能不同，须核对该年的节气时刻',
      });
      if (候选.length >= maxCandidates) break;
    }
    if (候选.length >= maxCandidates) break;
  }
  候选.sort((a, b) => (a.日期 < b.日期 ? -1 : a.日期 > b.日期 ? 1 : 0));

  const 说明 = [];
  if (校验.length) {
    说明.push('所报四柱**不自洽**——干支并非可以任意组合，请先核对后再用。');
    说明.push('下列候选是按所报的**年柱、月支、日柱、时支**推得的：月干／时干之误不影响日期定位，'
      + '但更正后须重新排盘，不可沿用本结果。');
  } else {
    说明.push('四柱通过五虎遁、五鼠遁两项自洽性校验。');
  }
  if (候选.length) {
    说明.push(`在 ${fromYear}–${toYear} 年内找到 ${候选.length} 个可能日期。`
      + '若使用者能提供大致年龄或出生年份，即可唯一确定；确定后请改用 birth 方式排盘，以取回大运起运与流年应期。');
  } else if (!校验.length) {
    说明.push(`在 ${fromYear}–${toYear} 年内未找到相合日期（已检视 ${有月区间但无日} 个候选年的对应节气月）。`
      + '日柱六十日一循环而节气月不足六十日，故并非每个年份都会命中；请扩大年份范围，或核对日柱。');
  }
  if (hp.branchIndex === 0) {
    说明.push('时支为子，含**晚子时（23:00–23:59）**。传统有"日柱进次日"与"不进日"两说，'
      + '本引擎默认**不进日**（即 23:xx 仍属当日的日柱）；若使用者所宗为"进日"之说，该日的日柱须改取次日，候选日期亦随之改变。');
  }

  return {
    四柱: parsed.map((p) => p.gz).join(' '),
    自洽: 校验.length === 0,
    校验,
    候选,
    说明,
    注: '本函数只给出**候选日期**，不代替使用者确认。日期一旦确定，应以 birth 方式重新排盘，'
      + '届时节气边界、真太阳时与起运岁数均由引擎重算，不要沿用本函数的分步结果。',
  };
}

export {
  RAD, norm360, deltaTSeconds, jdeToJd, jdToGzDay, cmpMoment, momentValue,
  MONTH_BRANCH_OF_TERM, yearPillar, monthPillar, dayPillar, hourPillar,
  addStartAgeToMoment, computeStartLuck, equationOfTimeMinutes,
};
