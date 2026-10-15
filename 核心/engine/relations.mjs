/**
 * 干支互涉关系引擎（冲、合、刑、破、害、绝、暗合等）
 * 依据：《规矩/宪法.md》《三命通会》《滴天髓》
 */
import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, KE_MAP, KE,
  ELEMENT_OF_INDEX, SHENG_IDX, KE_IDX, LUSHEN,
} from './constants.mjs';
import {
  TIANYI, TRIPLE_NAME, YANGREN,
} from './shensha.mjs';

export const STEM_COMBINE = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };
/** 天干相冲 */
const STEM_CLASH = ['甲庚', '乙辛', '丙壬', '丁癸'];
/** 地支六合 */
export const BRANCH_COMBINE = { 子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '土' };
/** 地支六冲 */
export const BRANCH_CLASH = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
/** 地支六害（穿） */
const BRANCH_HARM = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
/** 地支相破 */
export const BRANCH_DESTROY = ['子酉', '卯午', '辰丑', '未戌', '寅亥', '巳申'];
/** 三刑 / 自刑 */
const BRANCH_PUNISH = [
  { members: ['寅', '巳', '申'], kind: '无恩之刑' },
  { members: ['丑', '戌', '未'], kind: '恃势之刑' },
  { members: ['子', '卯'], kind: '无礼之刑' },
];
const SELF_PUNISH = ['辰', '午', '酉', '亥'];
/** 干支自合（七大柱：戊子、壬午、丁亥、辛巳、己亥、癸巳、甲午，D-029/D-034 裁定） */
export const STEM_BRANCH_SELF_COMBINE = {
  戊子: { 合: '戊癸合', 藏干: '癸水正财', note: '自坐正财暗合，天干与坐支主气五合' },
  壬午: { 合: '丁壬合', 藏干: '丁火正财', note: '自坐正财暗合，天干与坐支主气五合' },
  丁亥: { 合: '丁壬合', 藏干: '壬水正官', note: '自坐正官暗合，天干与坐支主气五合' },
  辛巳: { 合: '丙辛合', 藏干: '丙火正官', note: '自坐正官暗合，天干与坐支主气五合' },
  己亥: { 合: '甲己合', 藏干: '甲木正官', note: '自坐正官暗合，天干与坐支藏干五合' },
  癸巳: { 合: '戊癸合', 藏干: '戊土正官', note: '自坐正官暗合，天干与坐支藏干五合' },
  甲午: { 合: '甲己合', 藏干: '己土正财', note: '自坐正财暗合，天干与坐支藏干五合' },
};
/** 地支暗合（三大核心通合：寅丑、卯申、午亥，D-029 裁定） */
export const BRANCH_HIDDEN_COMBINE = {
  寅丑: { 合: '甲己/丙辛/戊癸全合', note: '寅丑通合，天地之藏干三合全聚，暗合力极强' },
  丑寅: { 合: '甲己/丙辛/戊癸全合', note: '寅丑通合，天地之藏干三合全聚，暗合力极强' },
  卯申: { 合: '乙庚暗合', note: '卯申暗合，车骑交结，金木交战转暗合做功' },
  申卯: { 合: '乙庚暗合', note: '卯申暗合，车骑交结，金木交战转暗合做功' },
  午亥: { 合: '丁壬/甲己暗合', note: '午亥暗合，水火既济，君臣暗会通情' },
  亥午: { 合: '丁壬/甲己暗合', note: '午亥暗合，水火既济，君臣暗会通情' },
};

/** 地支半三合（生旺半合、墓旺半合）与拱合局（D-035 裁定） */
export const BRANCH_HALF_COMBINE = {
  // 水局（申子辰）
  申子: { type: '生地半合', 局: '水局', 化: '水', note: '生旺半合，水势汇聚，向心力强' },
  子申: { type: '生地半合', 局: '水局', 化: '水', note: '生旺半合，水势汇聚，向心力强' },
  子辰: { type: '墓地半合', 局: '水局', 化: '水', note: '墓旺半合，水聚库门，归宿有力' },
  辰子: { type: '墓地半合', 局: '水局', 化: '水', note: '墓旺半合，水聚库门，归宿有力' },
  申辰: { type: '拱合局', 局: '水局', 拱: '子', 化: '水', note: '长生与墓库虚拱中神子水' },
  辰申: { type: '拱合局', 局: '水局', 拱: '子', 化: '水', note: '长生与墓库虚拱中神子水' },
  // 火局（寅午戌）
  寅午: { type: '生地半合', 局: '火局', 化: '火', note: '生旺半合，木火通明，炎上之势' },
  午寅: { type: '生地半合', 局: '火局', 化: '火', note: '生旺半合，木火通明，炎上之势' },
  午戌: { type: '墓地半合', 局: '火局', 化: '火', note: '墓旺半合，火土相合，敛聚成库' },
  戌午: { type: '墓地半合', 局: '火局', 化: '火', note: '墓旺半合，火土相合，敛聚成库' },
  寅戌: { type: '拱合局', 局: '火局', 拱: '午', 化: '火', note: '长生与墓库虚拱中神午火' },
  戌寅: { type: '拱合局', 局: '火局', 拱: '午', 化: '火', note: '长生与墓库虚拱中神午火' },
  // 金局（巳酉丑）
  巳酉: { type: '生地半合', 局: '金局', 化: '金', note: '生旺半合，火金淬砺，成器之象' },
  酉巳: { type: '生地半合', 局: '金局', 化: '金', note: '生旺半合，火金淬砺，成器之象' },
  酉丑: { type: '墓地半合', 局: '金局', 化: '金', note: '墓旺半合，湿土生金，坚刚沉敛' },
  丑酉: { type: '墓地半合', 局: '金局', 化: '金', note: '墓旺半合，湿土生金，坚刚沉敛' },
  巳丑: { type: '拱合局', 局: '金局', 拱: '酉', 化: '金', note: '长生与墓库虚拱中神酉金' },
  丑巳: { type: '拱合局', 局: '金局', 拱: '酉', 化: '金', note: '长生与墓库虚拱中神酉金' },
  // 木局（亥卯未）
  亥卯: { type: '生地半合', 局: '木局', 化: '木', note: '生旺半合，水生木旺，春气勃发' },
  卯亥: { type: '生地半合', 局: '木局', 化: '木', note: '生旺半合，水生木旺，春气勃发' },
  卯未: { type: '墓地半合', 局: '木局', 化: '木', note: '墓旺半合，木入库藏，意向聚合' },
  未卯: { type: '墓地半合', 局: '木局', 化: '木', note: '墓旺半合，木入库藏，意向聚合' },
  亥未: { type: '拱合局', 局: '木局', 拱: '卯', 化: '木', note: '长生与墓库虚拱中神卯木' },
  未亥: { type: '拱合局', 局: '木局', 拱: '卯', 化: '木', note: '长生与墓库虚拱中神卯木' },
};

/** 地支相绝（四大六绝：寅酉、卯申、午亥、子巳，D-035 裁定） */
export const BRANCH_EXTINCTION = {
  寅酉: { 绝: '寅酉绝', note: '金绝于寅，木绝于酉，上下交绝，情义反背' },
  酉寅: { 绝: '寅酉绝', note: '金绝于寅，木绝于酉，上下交绝，情义反背' },
  卯申: { 绝: '卯申绝', note: '金绝于卯，木绝于申，暗带乙庚合，明绝暗煎' },
  申卯: { 绝: '卯申绝', note: '金绝于卯，木绝于申，暗带乙庚合，明绝暗煎' },
  午亥: { 绝: '午亥绝', note: '水绝于午，火绝于亥，暗带丁壬/甲己合，明绝暗会' },
  亥午: { 绝: '午亥绝', note: '水绝于午，火绝于亥，暗带丁壬/甲己合，明绝暗会' },
  子巳: { 绝: '子巳绝', note: '火绝于子，水绝于巳，上下交灭，水火死绝' },
  巳子: { 绝: '子巳绝', note: '火绝于子，水绝于巳，上下交灭，水火死绝' },
};

/** 截路空亡（以日干查时支，D-035 裁定） */
export const JIELU_KONGWANG = {
  甲: ['申', '酉'],
  己: ['申', '酉'],
  乙: ['午', '未'],
  庚: ['午', '未'],
  丙: ['辰', '巳'],
  辛: ['辰', '巳'],
  丁: ['寅', '卯'],
  壬: ['寅', '卯'],
  戊: ['子', '丑'],
  癸: ['子', '丑'],
};

/** 地支三会方 */
const BRANCH_DIRECTION = [
  { members: ['寅', '卯', '辰'], element: '木', name: '东方木' },
  { members: ['巳', '午', '未'], element: '火', name: '南方火' },
  { members: ['申', '酉', '戌'], element: '金', name: '西方金' },
  { members: ['亥', '子', '丑'], element: '水', name: '北方水' },
];
/** 四生 / 四正 / 四墓 */
const FOUR_SHENG = ['寅', '申', '巳', '亥'];
const FOUR_ZHENG = ['子', '午', '卯', '酉'];
const FOUR_MU = ['辰', '戌', '丑', '未'];

function branchPunishments(labelled, requireLabel) {
  const held = (m) => labelled.filter((l) => l.branch === m);
  const out = [];
  const add = (刑, memberList, labelsArr, 口径, 争议, note) => {
    out.push({
      刑,
      members: memberList.join(''),
      positions: labelsArr.map((l) => l.label + l.branch).join('、'),
      口径,
      争议,
      ...(note ? { note } : {}),
      _labels: labelsArr.map((l) => l.label),
    });
  };

  for (const p of BRANCH_PUNISH) {
    const present = p.members.filter((m) => labelled.some((l) => l.branch === m));
    if (p.members.length === 2) {
      // 子卯：本即两支成刑，无争议
      if (present.length === 2) add(p.kind, p.members, present.flatMap(held), '通行（二支即成）', false);
      continue;
    }
    if (present.length === 3) {
      add(p.kind, p.members, present.flatMap(held), '三刑全见', false);
    } else if (present.length === 2) {
      add(p.kind, present, present.flatMap(held), '两两互刑', true,
        `三刑（${p.members.join('')}）只见${present.join('')}两支：主「三刑全见」者不以为刑，主「两两互刑」者以为刑。两派并存，须并陈，不可静默择一。`);
    }
  }

  for (const s of SELF_PUNISH) {
    const ls = labelled.filter((l) => l.branch === s);
    if (ls.length >= 2) add('自刑', [s, s], ls, '通行（二支即成）', false);
  }

  const picked = requireLabel === undefined ? out : out.filter((x) => x._labels.includes(requireLabel));
  for (const x of picked) delete x._labels;
  return picked;
}

export function gzRelations(pillars, luckPillar) {
  const names = ['年', '月', '日', '时'];
  const stems = pillars.map((p) => STEMS[p.stemIndex]);
  const branches = pillars.map((p) => BRANCHES[p.branchIndex]);
  if (luckPillar) { stems.push(STEMS[luckPillar.stemIndex]); branches.push(BRANCHES[luckPillar.branchIndex]); names.push('大运'); }

  const out = {
    天干五合: [], 天干相冲: [], 天干相克: [],
    地支六合: [], 地支半合: [], 地支三合: [], 地支三会: [], 地支六冲: [], 地支相刑: [], 地支相害: [], 地支相破: [], 地支相绝: [],
    干支自合: [], 地支暗合: [], 鸳鸯合: [], 反吟: [], 伏吟: [], 虚邀暗夹: [], 天干地支同柱: []
  };

  // 天干
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const a = stems[i], b = stems[j];
      const key = a + b, key2 = b + a;
      if (STEM_COMBINE[key]) out.天干五合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: STEM_COMBINE[key], note: '合化须看月令与化神是否得地' });
      else if (STEM_COMBINE[key2]) out.天干五合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: STEM_COMBINE[key2], note: '合化须看月令与化神是否得地' });
      if (STEM_CLASH.includes(key) || STEM_CLASH.includes(key2)) out.天干相冲.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      const ea = STEM_ELEMENT[STEMS.indexOf(a)], eb = STEM_ELEMENT[STEMS.indexOf(b)];
      if (KE[ea] === eb) out.天干相克.push({ pair: `${names[i]}${a} 克 ${names[j]}${b}` });
      else if (KE[eb] === ea) out.天干相克.push({ pair: `${names[j]}${b} 克 ${names[i]}${a}` });
    }
  }
  // 地支
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i], b = branches[j];
      const key = a + b, key2 = b + a;
      if (BRANCH_COMBINE[key]) out.地支六合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: BRANCH_COMBINE[key] });
      else if (BRANCH_COMBINE[key2]) out.地支六合.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, 化: BRANCH_COMBINE[key2] });
      if (BRANCH_CLASH.includes(key) || BRANCH_CLASH.includes(key2)) out.地支六冲.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      if (BRANCH_HARM.includes(key) || BRANCH_HARM.includes(key2)) out.地支相害.push({ pair: `${names[i]}${a} — ${names[j]}${b}`, note: '害即"穿"，盲派重其破坏作用' });
      if (BRANCH_DESTROY.includes(key) || BRANCH_DESTROY.includes(key2)) out.地支相破.push({ pair: `${names[i]}${a} — ${names[j]}${b}` });
      if (BRANCH_HIDDEN_COMBINE[key]) {
        out.地支暗合.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          合: BRANCH_HIDDEN_COMBINE[key].合,
          note: BRANCH_HIDDEN_COMBINE[key].note,
        });
      }
      // D-035: 地支半合（生地半合、墓地半合、拱合局）
      if (BRANCH_HALF_COMBINE[key]) {
        const bh = BRANCH_HALF_COMBINE[key];
        out.地支半合.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          type: bh.type,
          局: bh.局,
          化: bh.化,
          ...(bh.拱 ? { 拱: bh.拱 } : {}),
          note: bh.note,
        });
      }
      // D-035: 地支相绝（四绝）
      if (BRANCH_EXTINCTION[key]) {
        const ext = BRANCH_EXTINCTION[key];
        out.地支相绝.push({
          pair: `${names[i]}${a} — ${names[j]}${b}`,
          绝: ext.绝,
          note: ext.note,
        });
      }
    }
  }

  // 整柱关系：鸳鸯合（天合地合）、反吟（天克地冲）、伏吟（干支相同）（D-035 裁定）
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const aS = stems[i], bS = stems[j];
      const aB = branches[i], bB = branches[j];
      const aGz = aS + aB, bGz = bS + bB;

      // 鸳鸯合（天地德合）
      const sKey = STEM_COMBINE[aS + bS] ? aS + bS : STEM_COMBINE[bS + aS] ? bS + aS : null;
      const bKey = BRANCH_COMBINE[aB + bB] ? aB + bB : BRANCH_COMBINE[bB + aB] ? bB + aB : null;
      if (sKey && bKey) {
        out.鸳鸯合.push({
          pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
          天合: `${aS}${bS}合化${STEM_COMBINE[sKey]}`,
          地合: `${aB}${bB}合化${BRANCH_COMBINE[bKey]}`,
          note: '天合地合（鸳鸯合），天地德合，情深意笃，两柱气势紧密交融',
        });
      }

      // 反吟（天克地冲 / 天冲地冲）
      const bClash = BRANCH_CLASH.includes(aB + bB) || BRANCH_CLASH.includes(bB + aB);
      if (bClash) {
        const sClash = STEM_CLASH.includes(aS + bS) || STEM_CLASH.includes(bS + aS);
        const ea = STEM_ELEMENT[STEMS.indexOf(aS)], eb = STEM_ELEMENT[STEMS.indexOf(bS)];
        const sKe = (KE[ea] === eb) || (KE[eb] === ea);
        if (sClash) {
          out.反吟.push({
            pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
            type: '天冲地冲',
            干: `${aS}${bS}冲`,
            支: `${aB}${bB}冲`,
            note: '天冲地冲（反吟），激荡剧烈，根基拔摇',
          });
        } else if (sKe) {
          out.反吟.push({
            pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
            type: '天克地冲',
            干: KE[ea] === eb ? `${aS}克${bS}` : `${bS}克${aS}`,
            支: `${aB}${bB}冲`,
            note: '天克地冲（反吟），上下交伐，动荡不宁',
          });
        }
      }

      // 伏吟（干支相同）
      if (aS === bS && aB === bB) {
        out.伏吟.push({
          pair: `${names[i]}${aGz} — ${names[j]}${bGz}`,
          gz: aGz,
          note: '干支并临伏吟，内外重叠，事多滞涩反复',
        });
      }
    }
  }

  // 虚邀暗夹（相邻柱地支隔位虚拱，含拱禄、拱贵、暗夹刃，D-035 裁定）
  const dayStem = pillars.length > 2 ? STEMS[pillars[2].stemIndex] : stems[0];
  const yearStem = stems[0];
  for (let i = 0; i < branches.length - 1; i++) {
    const b1 = branches[i], b2 = branches[i + 1];
    const idx1 = BRANCHES.indexOf(b1), idx2 = BRANCHES.indexOf(b2);
    let clamped = null;
    if ((idx1 + 2) % 12 === idx2) {
      clamped = BRANCHES[(idx1 + 1) % 12];
    } else if ((idx2 + 2) % 12 === idx1) {
      clamped = BRANCHES[(idx2 + 1) % 12];
    }
    if (clamped) {
      const tags = [];
      if (LUSHEN[dayStem] === clamped) tags.push('拱禄');
      if (TIANYI[dayStem]?.includes(clamped) || TIANYI[yearStem]?.includes(clamped)) tags.push('拱贵');
      if (YANGREN[dayStem] === clamped) tags.push('夹刃');
      out.虚邀暗夹.push({
        pair: `${names[i]}${b1} — ${names[i + 1]}${b2}`,
        夹: clamped,
        格局: tags.length ? tags.join('、') : '地支虚夹',
        note: tags.includes('拱禄')
          ? `相邻虚拱「${clamped}」禄（拱禄格）`
          : tags.includes('拱贵')
          ? `相邻虚拱「${clamped}」天乙贵人（拱贵格）`
          : `相邻两支隔位虚拱「${clamped}」`,
      });
    }
  }

  // 干支自合（七大柱：戊子、壬午、丁亥、辛巳、己亥、癸巳、甲午，D-029 裁定）
  for (let i = 0; i < stems.length; i++) {
    const gz = stems[i] + branches[i];
    if (STEM_BRANCH_SELF_COMBINE[gz]) {
      out.干支自合.push({
        pillar: names[i],
        gz,
        合: STEM_BRANCH_SELF_COMBINE[gz].合,
        藏干: STEM_BRANCH_SELF_COMBINE[gz].藏干,
        note: STEM_BRANCH_SELF_COMBINE[gz].note,
      });
    }
  }
  // 三合 / 三会 / 三刑（要求三支齐现）
  const bset = new Set(branches);
  for (const [ju, members] of Object.entries(TRIPLE_NAME)) {
    if (members.every((m) => bset.has(m))) {
      const pos = members.map((m) => `${names[branches.indexOf(m)]}${m}`).join('、');
      out.地支三合.push({ 局: `${ju}（${members.join('')}）`, positions: pos, note: '三合局成，力大于六合' });
    }
  }
  for (const d of BRANCH_DIRECTION) {
    if (d.members.every((m) => bset.has(m))) {
      const pos = d.members.map((m) => `${names[branches.indexOf(m)]}${m}`).join('、');
      out.地支三会.push({ 方: `${d.name}（${d.members.join('')}）`, positions: pos, note: '三会方局，力最专' });
    }
  }
  // 相刑：寅巳申「无恩之刑」、丑戌未「恃势之刑」的两派口径一并报出（见 branchPunishments）
  out.地支相刑.push(...branchPunishments(branches.map((b, i) => ({ label: names[i], branch: b }))));
  // 同柱干支：天覆地载 / 盖头 / 截脚（按元素编号比较，不能用名字去索引编号表）
  for (let i = 0; i < pillars.length; i++) {
    const se = STEM_ELEMENT[pillars[i].stemIndex];       // 干元素编号
    const be = BRANCH_ELEMENT[pillars[i].branchIndex];   // 支元素编号
    let kind;
    if (se === be) kind = '干支同气（天覆地载）';
    else if (SHENG_IDX[se] === be) kind = '干生支（泄气）';
    else if (SHENG_IDX[be] === se) kind = '支生干（得地）';
    else if (KE_IDX[se] === be) kind = '干克支（盖头）';
    else kind = '支克干（截脚）';
    out.天干地支同柱.push({
      pillar: names[i], gz: stems[i] + branches[i], relation: kind,
      detail: `${ELEMENT_OF_INDEX[se]}干 / ${ELEMENT_OF_INDEX[be]}支`,
    });
  }
  return out;
}

export function relationsOf(pillars) {
  return gzRelations(pillars, null);
}

export {
  STEM_CLASH, BRANCH_HARM, BRANCH_PUNISH, SELF_PUNISH,
  BRANCH_DIRECTION, FOUR_SHENG, FOUR_ZHENG, FOUR_MU,
  branchPunishments,
};
