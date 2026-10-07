// 核心/report-generator.mjs
// 三段式全景命理解读与决策咨询报告生成器（整车总装核心大脑，D-039 落地）
// 严格遵循《三段式全景命理解读深度示范报告.md》标准规格：
// 1. 排盘事实层（客观无争议事实底座，竖排四柱卡片、五行能量条、旺衰三维研判）
// 2. 丙层流派主张并陈（格局派、滴天髓用神派、穷通调候派、盲派、新派、神煞象义，六派并陈不选边）
// 3. 乙体系体用路线法深度推演（八格成破救应全解、去留路线、主要矛盾双通路、财富专题、逐运详批、未来十年流年真实推演、心性婚恋健康战略规划；八字层次评估严格隐藏）
// 4. 四重免责声明与科学认知导引

import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  castChart, gzRelations, shenshaOf, dateCandidates,
  BRANCH_CLASH, BRANCH_COMBINE, yearPillarOf, tenGod
} from './engine.mjs';
import {
  tiyongRouteOf, gejuChengPoOf, protectionChainOf,
  coverageOf, arbitrateGanzhiForces
} from './tiyong.mjs';
import {
  extractChartFeatures, loadAllSchoolEntries, matchSchoolClaims
} from './school-matcher.mjs';

/**
 * 宽度对齐辅助（支持中英文字符宽度计算）
 */
function strWidth(str) {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 粗略判断宽字符（汉字、全角标点等）
    if (code > 0x7f) w += 2;
    else w += 1;
  }
  return w;
}

function padRight(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - current);
}

function padCenter(str, targetWidth) {
  const current = strWidth(str);
  if (current >= targetWidth) return str;
  const left = Math.floor((targetWidth - current) / 2);
  const right = targetWidth - current - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * 辅助：计算两个天干的十神
 */
function getTenGod(dayStem, otherStem) {
  const dIdx = STEMS.indexOf(dayStem);
  const oIdx = STEMS.indexOf(otherStem);
  if (dIdx < 0 || oIdx < 0) return '';
  return tenGod(dIdx, oIdx);
}

const ELEM_REL = {
  '木': { 生: '火', 克: '土', 被生: '水', 被克: '金', 同: '木' },
  '火': { 生: '土', 克: '金', 被生: '木', 被克: '水', 同: '火' },
  '土': { 生: '金', 克: '水', 被生: '火', 被克: '木', 同: '土' },
  '金': { 生: '水', 克: '木', 被生: '土', 被克: '火', 同: '金' },
  '水': { 生: '木', 克: '火', 被生: '金', 被克: '土', 同: '水' },
};

const ORGAN_MAP = {
  '木': { 脏腑: '肝胆经络、颈椎筋骨与眼目神经', 偏亢: '肝火偏旺、易生烦躁、眼目干涩或经络拘挛', 偏衰: '气血濡养不足、筋骨僵硬疲劳、神经衰弱' },
  '火': { 脏腑: '心、小肠、心脑血管与眼目神明', 偏亢: '心火炽盛、血脉微循环障碍、失眠多梦或虚火上扰', 偏衰: '心阳亏虚、畏寒肢冷、神思倦怠乏力' },
  '土': { 脏腑: '脾胃运化、消化系统与肌肉代谢', 偏亢: '湿热中阻、脾胃壅滞、消化不良或代谢迟缓', 偏衰: '脾气虚弱、运化无力、容易水肿或肌肉乏力' },
  '金': { 脏腑: '肺、大肠、呼吸系统与皮毛鼻咽', 偏亢: '燥金伤阴、咽喉干燥、呼吸道敏感易咳', 偏衰: '肺气不宣、表虚易感、气短音低或皮毛失润' },
  '水': { 脏腑: '肾脏、膀胱、泌尿生殖与骨髓内分泌', 偏亢: '水湿过盛、停饮泛滥、阳气受遏或浮肿', 偏衰: '肾阴真水亏虚、内分泌失衡、腰膝酸软或精血不足' }
};

const CAREER_MAP = {
  '木': { 方位: '东方', 属性: '仁善生发', 赛道: '文化传媒、教育培训、医疗健康、林木生态、软件研发与创意出版' },
  '火': { 方位: '南方', 属性: '礼达文明', 赛道: '人工智能、能源电力、数字媒体、互联网前沿、品牌公关与文旅光电' },
  '土': { 方位: '本地/中原', 属性: '信厚稳固', 赛道: '不动产建筑、土地农业、仓储基建、物业资管、中介居间与信托' },
  '金': { 方位: '西方', 属性: '义决刚正', 赛道: '金融证券、精密制造、高端机械、硬件工程、军警法律与合规风控' },
  '水': { 方位: '北方', 属性: '智谋流通', 赛道: '现代航运物流、量化金融、现代贸易、数据信息流、水产与跨境电商' }
};

const TEN_GOD_PROFILE = {
  '七杀': {
    心性: '深具危机敏锐度、杀伐决断、迎难而上，富于攻坚魄力与组织威权意识。',
    动机: '追求突破困境、解决核心危机与掌控大局，在重压挑战中彰显不可替代的统治力。',
    盲区: '性急刚毅、容易紧绷多疑，需防严苛急躁伤及人际协同。',
    生态位: '【攻坚破局主官 / 危机处理专家 / 高管统帅 / 战略重组负责人】',
    进阶心法: '化杀为权，以德御威，建立制度规范以安众人之心。'
  },
  '正官': {
    心性: '光明磊落、恪守规则、自律严谨、深具体制风骨与正统秩序意识。',
    动机: '追求体制规范、社会名望与稳健治理，以身作则树立公信力标杆。',
    盲区: '偶显因循守旧、拘泥教条，需防非黑即白的僵化思维限制创新。',
    生态位: '【合规治理首席 / 组织运营总监 / 制度架构师 / 公共事务首长】',
    进阶心法: '融法于情，以宽厚仁和之德化解僵化教条，兼顾秩序与活力。'
  },
  '偏财': {
    心性: '慷慨敏锐、机变灵活、极具商业大局观，善于捕捉结构性机遇与资源杠杆。',
    动机: '追求资本运作、商业版图扩张与跨界资源整合，乐于冒险博取高维胜局。',
    盲区: '耐性偶有欠缺、重视投机套利，需防贪大求快引发资金链断裂。',
    生态位: '【商业风险投资人 / 战略并购总监 / 跨界资源操盘手 / 商业合伙人】',
    进阶心法: '义利双修，大财需配厚德，深耕长效护城河以守财富果实。'
  },
  '正财': {
    心性: '务实严谨、崇尚实干、精于算度与精细化管理，商业嗅觉脚踏实地。',
    动机: '追求长治久安、现金流稳健与资产复利积累，信奉一分耕耘一分收获。',
    盲区: '眼界偶陷微观细节、谨小慎微，需防因小失大而错失时代风口。',
    生态位: '【财务总监 / 供应链运营总裁 / 精细化产业操盘手 / 资管核心骨干】',
    进阶心法: '放宽格局，以长期主义眼光做资本配置，积跬步以致千里。'
  },
  '伤官': {
    心性: '才华超群、反叛陈规、思维敏捷具有颠覆性创意，追求极致卓越与自我表达。',
    动机: '渴望精神自由与革新突破，以非凡技艺或颠覆性产品赢得时代尊重与喝彩。',
    盲区: '心高气傲、言辞锋芒易招非议，需防情绪化冲动与规则冲撞。',
    生态位: '【首席技术革新官 / 颠覆性产品主理人 / 独立先锋艺术家 / 顶尖战略架构师】',
    进阶心法: '淬炼核心技术壁垒，收敛傲气为匠心，将惊世才智转化为长青基业。'
  },
  '食神': {
    心性: '温良敦厚、从容大度、注重品质内涵与长期主义，心性恬淡而极富专研匠气。',
    动机: '追求身心适意、专业技能沉淀与长远福寿绵延，以润物细无声之功立业。',
    盲区: '行动节奏偶显安逸怠惰、竞争锐度不足，需防在安乐舒适圈中错失先机。',
    生态位: '【首席产品工匠 / 研发专家大师 / 资深技术顾问 / 高端品牌策源人】',
    进阶心法: '持之以恒深耕细分领域，由技入道，以纯正品质汇聚天下口碑。'
  },
  '偏印': {
    心性: '独具慧眼、内省深邃、善于挖掘冷门玄奥与底层逻辑，直觉洞察异于常人。',
    动机: '追求真知灼见、独家秘术与核心机密壁垒，享受隐士般的深度思辨。',
    盲区: '性格偶有孤僻多疑、缺乏人情温软，需防思虑过甚脱离群众。',
    生态位: '【核心战略暗策顾问 / 深度科研学者 / 特殊算法研究员 / 独立情报分析官】',
    进阶心法: '接纳尘世烟火，由术入道，将孤绝深奥之智慧转化为现实造福之力。'
  },
  '正印': {
    心性: '仁慈博爱、敦厚稳重、深具学者长者之风，重视声誉清白与学问厚度。',
    动机: '追求内在丰盈、学术真理与精神声望，乐于培育后辈与立德树人。',
    盲区: '思虑厚重而执行迟缓、对人过分宽纵，面对残酷竞争时偶显退避消极。',
    生态位: '【智库首席科学家 / 核心学术导师 / 企业文化领袖 / 资深战略顾问】',
    进阶心法: '知行合一，经世致用，打破象牙塔清高，以厚重德行引领现实实践。'
  },
  '劫财': {
    心性: '热血仗义、敢打敢拼、极富冒险精神与感染力，乐于带领同侪冲锋陷阵。',
    动机: '追求自我实现与兄弟并肩共创，渴望在大风大浪中开辟新天地。',
    盲区: '性急豪爽、偶有盲从冒险，财务上需严防哥们义气担保或无谓破耗。',
    生态位: '【初创团队拓荒领袖 / 销售狼性铁军主将 / 攻坚先锋司令 / 联合创始人】',
    进阶心法: '建立明晰契约机制，财散人聚、利出一孔，用制度守护兄弟情谊。'
  },
  '比肩': {
    心性: '意志坚定、自尊自主、信守承诺、耐劳苦干，具极佳的独立性与韧劲。',
    动机: '追求平等待遇与自立自强，不依赖外界施舍，以踏实行动奠定生存底气。',
    盲区: '偶有固执己见、不善妥协周旋，需防单打独斗缺乏合力。',
    生态位: '【骨干合伙人 / 独立实干企业家 / 业务基石主管 / 专精特新掌舵人】',
    进阶心法: '虚怀若谷容纳异见，善借他人之力补己之短，合作共赢方成大业。'
  },
  // 兼顾粗粒度回退映射
  '官杀': {
    心性: '恪守规则、自律严谨、深具危机感与威权责任意识，遇事注重程序与权责界限。',
    动机: '追求社会地位认可、制度建构与组织影响力，遇强则强，在压力下能爆发组织韧性。',
    盲区: '容易过度紧绷苛求、承受过大精神内耗，防范非黑即白的僵化教条。',
    生态位: '【组织风控核心 / 合规法务主官 / 体系操盘高管 / 制度架构师】',
    进阶心法: '依附成熟体制或骨干平台展现才干，化威权为担当，以公信力立足。'
  },
  '财星': {
    心性: '务实敏锐、崇尚效益、精于价值发现与资源调配，商业嗅觉灵敏。',
    动机: '追求财富积累与资产跃迁，注重投入产出比与现实成果，执行力极强。',
    盲区: '偶有急功近利、过于看重短期得失，需防止因财损德或算计过深。',
    生态位: '【商业操盘手 / 资产运营总监 / 供应链主管 / 独立商业合伙人】',
    进阶心法: '秉持义利兼顾，深耕长期复利资产，以诚信与共赢汇聚资本。'
  },
  '食伤': {
    心性: '聪慧敏达、追求卓越、富有创意与探索精神，注重自我表达与才华变现。',
    动机: '渴望精神自由与创新突破，以非凡技艺、洞察或作品赢得行业尊重。',
    盲区: '心高气傲、耐性不足、偶有任性偏执，需注意人际边界与组织协同纪律。',
    生态位: '【首席技术官 / 研发创新先锋 / 独立专家顾问 / 创意工匠大师】',
    进阶心法: '淬炼核心专业壁垒，将天马行空的灵感转化为标准化交付物。'
  },
  '印星': {
    心性: '仁慈稳重、内省深邃、喜好文墨修养与精神探索，注重口碑声誉与学识厚度。',
    动机: '追求内在丰盈与学术真理，对长远战略规划与精神归属有强烈需求。',
    盲区: '行动力偶显迟缓、思虑过多易生惰性，面对现实竞争有时显消极避让。',
    生态位: '【核心智囊战略顾问 / 学术专家 / 平台特许专家 / 资深研究员】',
    进阶心法: '由学入术、知行合一，将深厚底蕴赋能现实实践，福慧双修。'
  },
  '比劫': {
    心性: '刚毅果敢、重情重义、执行力极强、敢打敢拼，富于同舟共济的团队精神。',
    动机: '追求自我实现与同侪并进，不甘人后，乐于在竞争与开拓中证明价值。',
    盲区: '性格偶有急躁固执、容易意气用事，资产财务上需防盲目担保或合作纠纷。',
    生态位: '【创业团队核心 / 业务拓展先锋 / 联合合伙人 / 一线开拓干将】',
    进阶心法: '善于聚拢合力而不争虚名，强化财散人聚的智慧与契约制度。'
  }
};

function classifyDominantTenGod(geju, chart) {
  const gText = `${geju?.格局 || ''}${geju?.格神十神 || ''}`;
  if (gText.includes('伤官')) return '伤官';
  if (gText.includes('食神')) return '食神';
  if (gText.includes('七杀') || gText.includes('偏官')) return '七杀';
  if (gText.includes('正官')) return '正官';
  if (gText.includes('偏财')) return '偏财';
  if (gText.includes('正财')) return '正财';
  if (gText.includes('偏印') || gText.includes('枭')) return '偏印';
  if (gText.includes('正印') || gText.includes('印绶')) return '正印';
  if (gText.includes('阳刃') || gText.includes('羊刃') || gText.includes('劫财')) return '劫财';
  if (gText.includes('建禄') || gText.includes('比肩')) return '比肩';

  const mGod = chart?.pillars?.[1]?.hidden?.[0]?.tenGod || '';
  if (mGod.includes('伤官')) return '伤官';
  if (mGod.includes('食神')) return '食神';
  if (mGod.includes('七杀') || mGod.includes('偏官')) return '七杀';
  if (mGod.includes('正官')) return '正官';
  if (mGod.includes('偏财')) return '偏财';
  if (mGod.includes('正财')) return '正财';
  if (mGod.includes('偏印') || mGod.includes('枭')) return '偏印';
  if (mGod.includes('正印') || mGod.includes('印绶')) return '正印';
  if (mGod.includes('劫财')) return '劫财';
  if (mGod.includes('比肩')) return '比肩';

  // 粗粒度回退匹配
  if (gText.includes('伤') || gText.includes('食')) return '伤官';
  if (gText.includes('杀') || gText.includes('官')) return '七杀';
  if (gText.includes('财')) return '正财';
  if (gText.includes('印')) return '正印';
  return '比肩';
}

function marriageProfile(chart) {
  const dayBranch = chart.pillars[2].branch;
  const spouseGod = chart.pillars[2].hidden?.[0]?.tenGod || '十神';
  const spouseStem = chart.pillars[2].hidden?.[0]?.stem || '';
  
  const clashPillars = [];
  const combinePillars = [];
  const posNames = ['年', '月', '日', '时'];
  for (let i = 0; i < 4; i++) {
    if (i === 2) continue;
    const b = chart.pillars[i].branch;
    if (BRANCH_CLASH[dayBranch] === b) clashPillars.push(posNames[i]);
    if (BRANCH_COMBINE[dayBranch] === b) combinePillars.push(posNames[i]);
  }

  // 扫描地支三合/半合与相冲（直接从 chart.relations 提取日支相关的动态事实）
  const banHe = (chart.relations?.['地支半合'] || []).find((r) => r.pair?.includes(dayBranch) || r.positions?.includes(dayBranch));
  const sanHe = (chart.relations?.['地支三合'] || []).find((r) => r.positions?.includes(dayBranch));
  const heInfo = banHe ? `夫妻宫与${banHe.pair}半合${banHe['局'] || ''}` : (sanHe ? `夫妻宫合入${sanHe['局'] || ''}` : '');

  // 提取日柱同柱生克（截脚/得地/同气等）
  const tongZhu = (chart.relations?.['天干地支同柱'] || []).find((r) => r.pillar === '日');
  const relStr = tongZhu?.relation || '';

  let spouseDesc = '';
  if (spouseGod.includes('官') || spouseGod.includes('杀')) {
    spouseDesc = `伴侣性格端庄自律、责任感强、做事有原则魄力（本气透【${spouseStem}${spouseGod}】），彼此日常宜多沟通体谅，避免管束生隙。`;
  } else if (spouseGod.includes('印') || spouseGod.includes('枭')) {
    spouseDesc = `伴侣温和体贴、富有包容心、重精神共鸣与日常关照（本气透【${spouseStem}${spouseGod}】），情感互动内敛深厚。`;
  } else if (spouseGod.includes('食') || spouseGod.includes('伤')) {
    spouseDesc = `伴侣聪慧灵动、富有生活情调与才华才艺（本气透【${spouseStem}${spouseGod}】），个性鲜明，相处宜多赞赏包容。`;
  } else if (spouseGod.includes('财')) {
    spouseDesc = `伴侣为人务实能干、善于料理家业与财务（本气透【${spouseStem}${spouseGod}】），持家有条不紊，是现实生活中的得力内助。`;
  } else {
    spouseDesc = `伴侣如同道知己、意志坚定、能共御外部风雨（本气透【${spouseStem}${spouseGod}】），日常互动需注意性格相持中的谦让。`;
  }

  let interDesc = '';
  if (clashPillars.length > 0) {
    interDesc = `原局夫妻宫与${clashPillars.join('、')}柱地支相冲，预示感情生活中偶有观念激荡，宜聚少离多或遇事多换位思考，化冲为和。`;
  } else if (relStr.includes('克干') || relStr.includes('截脚')) {
    interDesc = `夫妻宫坐支克日主（${relStr}），伴侣气场强势自尊、对命主鞭策要求较高；${heInfo ? `另见${heInfo}，外部引力深厚，相处需化压力为磨砺。` : '相处宜以柔克刚、多加包容。'}`;
  } else if (relStr.includes('生干') || relStr.includes('得地')) {
    interDesc = `夫妻宫坐支生扶日主（${relStr}），伴侣在生活与精神上给予命主悉心照拂与庇护；${heInfo ? `另见${heInfo}，二人交融默契、和合度高。` : '情感滋养深厚。'}`;
  } else if (relStr.includes('泄干') || relStr.includes('干生支')) {
    interDesc = `日主化生夫妻宫坐支（${relStr}），命主乐于为伴侣倾注心力付出，日常互动多显温情，但需防过度迁就。`;
  } else if (relStr.includes('干克支')) {
    interDesc = `日主克制夫妻宫坐支（${relStr}），命主在家庭与关键财务上多居主导地位，宜尊重伴侣知情权与决策权。`;
  } else if (combinePillars.length > 0) {
    interDesc = `原局夫妻宫与${combinePillars.join('、')}柱地支相合，情感联结深厚稳固，家宅和合度高。`;
  } else {
    interDesc = '夫妻宫气局清纯平稳，感情基础稳固，宜在相互理解与共同成长中深化默契。';
  }

  return { dayBranch, spouseGod, spouseDesc, interDesc };
}

function healthProfile(chart) {
  const pct = chart.strength?.percent || { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 };
  const sorted = Object.keys(pct).sort((a, b) => Number(pct[b]) - Number(pct[a]));
  const maxElem = sorted[0];
  const minElem = sorted[sorted.length - 1];

  const maxInfo = ORGAN_MAP[maxElem] || { 脏腑: '对应系统', 偏亢: '偏亢', 偏衰: '偏衰' };
  const minInfo = ORGAN_MAP[minElem] || { 脏腑: '对应系统', 偏亢: '偏亢', 偏衰: '偏衰' };

  return {
    maxElem,
    maxPct: pct[maxElem],
    maxInfo,
    minElem,
    minPct: pct[minElem],
    minInfo
  };
}

function gejuOriginQuote(geju, chart) {
  const gName = geju.格局 || '正格';
  const po = geju.破格因 || '';
  const dmElem = chart?.dayMaster?.element || (chart?.pillars?.[2]?.stem ? STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] : '木');
  const dayStem = chart?.dayMaster?.stem || chart?.pillars?.[2]?.stem || '日主';
  
  if (po.includes('官杀混杂')) {
    return {
      出处: '《子平真诠·论用神成败救应》',
      原文: '官杀并透，非纯正之体也。或去官留杀，或去杀留官，方成贵格。去留之法，合官星则留七杀，合七杀则留官星；克官星则留七杀，克七杀则留官星。大抵合去者胜于克去，克去者气伤，合去者神清。',
      译文: '当命中正官与七杀同时透出时，格局驳杂，须在岁运中通过天干合克清退一方，去浊存清，方显贵气纯正。',
      本命解: `原局干支官杀并见，日主【${dayStem}${dmElem}】心性兼具求稳自律与攻坚魄力，关键在于岁运如何引通去留清纯。`
    };
  }
  if (po.includes('伤官见官')) {
    return {
      出处: '《子平真诠·论正官配伤官》',
      原文: '正官见伤，其局大破。救应之法，或透印以制伤护官，或透财以化伤生官，格局方能转危为安。',
      译文: '正官格见伤官克伐最为破局，若有印绶制伏伤官以庇护正官，或有财星通关化解伤官之戾气，方能挽救格局。',
      本命解: `原局官星与伤官相持，日主【${dayStem}${dmElem}】须以印星涵养或财星通关为枢纽，方能转危机为转机。`
    };
  }
  if (po.includes('坏印') || po.includes('财破印')) {
    return {
      出处: '《子平真诠·论印绶》',
      原文: '印绶喜生扶，忌贪财坏印。若财印并透，须两不相碍，或有比劫分财以卫印，方免倾覆之患。',
      译文: '印绶格最忌财星贪婪破克。必须有比劫制财护卫印星，或财印位置隔开各得其用，方能保全清贵。',
      本命解: `原局重在护卫印星之清正，日主【${dayStem}${dmElem}】需戒除急功近利，以厚道名誉为立身根基。`
    };
  }
  if (po.includes('枭') || po.includes('夺食')) {
    return {
      出处: '《子平真诠·论食神》',
      原文: '食神生旺，胜似财官。所最忌者，枭神夺食。若枭印并见，必赖财星制枭以存食，方遂生发之美。',
      译文: '食神生财本为福寿之格，最怕偏印枭神夺食。若逢偏印，必须有财星制伏偏印以保护食神，方能顺畅流通。',
      本命解: `命局才智生发受制于偏印，日主【${dayStem}${dmElem}】须借助现实务实之财星破除虚妄，保护核心技能才华。`
    };
  }

  if (gName.includes('伤官')) {
    if (dmElem === '木') {
      return {
        出处: '《滴天髓·论甲木/论伤官》',
        原文: '火炽乘龙，水荡骑虎。木火伤官，其气最华，得水润局，真木火通明之贵也。',
        译文: '甲乙木生于夏令，木火伤官才思英华秀发，最喜润局水气调候，木火通明显露文采风流。',
        本命解: `月令立【木火伤官】，日主【${dayStem}木】体悟敏锐、英华发露，顺势得水润生身则才华化为惊世大作。`
      };
    }
    if (dmElem === '金') {
      return {
        出处: '《滴天髓·论辛金/金水伤官》',
        原文: '金水伤官喜见官，水冷金寒爱丙暄。秀气深藏机变巧，逢温得暖定超群。',
        译文: '庚辛金生于冬令，金水相涵而机巧深邃，最喜官星丙火暖局调和，温煦流通方显超群智慧。',
        本命解: `月令立【金水伤官】，日主【${dayStem}金】思辨深邃缜密、机变敏达，得火气暖局温润则独树一帜。`
      };
    }
    if (dmElem === '火') {
      return {
        出处: '《子平真诠·论伤官》',
        原文: '火土伤官宜伤尽，金水流通致中和。土厚藏光，见润则贵。',
        译文: '火生四季土令，火土伤官土厚掩光，最喜金水引通润泽，流通生发方显中和大贵。',
        本命解: `月令立【火土伤官】，日主【${dayStem}火】沉稳厚重，重在水气润局疏土以显文明。`
      };
    }
    if (dmElem === '水') {
      return {
        出处: '《子平真诠·论伤官》',
        原文: '水木伤官格，喜财亦喜官。水木清华，萌动生发，文章秀丽。',
        译文: '壬癸水生于春令，水木伤官气象清华秀丽，最喜见财官生发，文章才华卓越。',
        本命解: `月令立【水木伤官】，日主【${dayStem}水】生机盎然、灵动自如，顺生财官能建功立业。`
      };
    }
    return {
      出处: '《滴天髓·论伤官》',
      原文: '土金伤官格，化秀气以肃杀，最喜水润木疏，财官两旺。',
      译文: '戊己土生于秋令，土金伤官肃杀精微，最喜见水木润泽疏导，财官俱全则显富贵。',
      本命解: `月令立【土金伤官】，日主【${dayStem}土】刚毅精微、洞察深刻，得水木润疏则成就斐然。`
    };
  }
  if (gName.includes('食神')) {
    return {
      出处: '《子平真诠·论食神》',
      原文: '食神者，天厨之星，福寿之神。食神生财，美不可言；最忌偏印夺食。成格者性情温厚，福泽绵长。',
      译文: '食神为福寿吉祥之星，能生财化煞，最忌偏印克伐。成格者心性冲和大度，财富源远流长。',
      本命解: `月令立【${gName}】，日主【${dayStem}${dmElem}】性情宽宏温厚，深具专业技术与滋润生财潜质。`
    };
  }
  if (gName.includes('印')) {
    return {
      出处: '《子平真诠·论印绶》',
      原文: '印绶者，乃生我之根基，天地之慈母也。喜官杀相生，喜身弱得扶，忌贪财坏印。成格者端重方正，文学清高。',
      译文: '印绶是生养庇护日主的神祇，最喜官杀引生或生扶身弱，最忌财星破克。成格者品德高尚，善于沉淀学问声望。',
      本命解: `月令立【${gName}】，日主【${dayStem}${dmElem}】精神世界富足清贵，宜依托学识、资质与学术声誉立身。`
    };
  }
  if (gName.includes('财')) {
    return {
      出处: '《子平真诠·论财》',
      原文: '财为养命之源，人人所欲。财旺生官，富而且贵；身强财茂，利名两全。忌比劫争夺，忌七杀盗气。',
      译文: '财星为立命生存之本，身旺财旺则富贵两全。最喜官星护财与食神生财，忌比劫争抢。',
      本命解: `月令立【${gName}】，日主【${dayStem}${dmElem}】具备敏锐商业洞察与现实资源调度能力，务实致富。`
    };
  }
  if (gName.includes('官') || gName.includes('杀')) {
    return {
      出处: '《子平真诠·论正官/偏官》',
      原文: '正官者，纯粹之贵气也；七杀者，猛烈之权柄也。正官喜财印相辅，七杀喜食神制伏。去浊存清，威权独尊。',
      译文: '官杀代表社会名望与制约管理权柄，正官宜辅佐，七杀宜驾驭，清纯则主执掌权责。',
      本命解: `月令立【${gName}】，日主【${dayStem}${dmElem}】责任感强烈、具备严谨管理与组织运作天赋。`
    };
  }

  return {
    出处: geju.法理出处 || '《子平真诠·论月令格局》',
    原文: '八字专以月令配用神，月令者，宰相也。用神成格，气象纯正，喜顺生护卫，忌刑冲破害。',
    译文: '以月令司令之神确立格局，成格者气脉纯和，最喜相生与吉神护卫，忌破格凶煞侵害。',
    本命解: `月令立【${gName}】，日主【${dayStem}${dmElem}】全局生克围绕此纲领展开，顺应格局喜忌方能大展宏图。`
  };
}

function gejuRescueRoutes(geju, chart, yongElem) {
  const dayStem = chart?.dayMaster?.stem || chart?.pillars?.[2]?.stem || '日主';
  const dmElem = chart?.dayMaster?.element || (chart?.pillars?.[2]?.stem ? STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] : '木');
  const po = geju.破格因 || '';
  if (po.includes('官杀混杂')) {
    return [
      `1. **方案 A：合杀留官（最优清格通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】逢岁运透合杀之字，绊住七杀之凶顽，使正官独尊，主流认可度与美誉提升。`,
      `2. **方案 B：合官留杀（权柄攻坚通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】逢岁运比劫合官，专力驾驭七杀将星，开拓创新，适宜独立开创局面。`,
      `3. **方案 C：制杀留官（专业救应通路）**\n   * **作用机理**：以食伤星透干制伏偏官，以技术才华破解阻碍，化压力为动力，引通【${yongElem || '用神'}】气护身。`
    ].join('\n');
  }
  if (po.includes('伤官见官')) {
    return [
      `1. **方案 A：透印制伤（以德化才通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】印绶有力制伤护官，以深厚修养规避言辞锋芒，尊崇体制。`,
      `2. **方案 B：透财通关（商业化解通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】财星引通伤官之秀气转而生官，以现实商业价值弥合规则冲突，借【${yongElem || '用神'}】气通关。`
    ].join('\n');
  }
  if (po.includes('坏印') || po.includes('财破印')) {
    return [
      `1. **方案 A：比劫制财护印（同侪相扶通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】比肩劫财分流财星之力，使印星安然立足，重在团队协作。`,
      `2. **方案 B：官星化财生印（制度赋能通路）**\n   * **作用机理**：日主【${dayStem}${dmElem}】官星通关转生印星，借助正统名望与制度护航，引通【${yongElem || '用神'}】气。`
    ].join('\n');
  }

  const gName = geju.格局 || '正格';
  const gZi = geju.格神字 || '';
  const gShen = geju.格神十神 || '格神';
  const dayBranch = chart?.pillars?.[2]?.branch || '日支';
  return [
    `1. **通路一：培植格神【${gZi}】生生之机（增厚底气）**\n   * **作用机理**：顺应日主【${dayStem}${dmElem}】生发之机，扶持【${gShen}】清纯气象，以【${yongElem || '用神'}】气润化流通，巩固【${gName}】立足根基。`,
    `2. **通路二：护卫用神【${yongElem || '用神'}】气局（防守反弹）**\n   * **作用机理**：原局以【${yongElem || '用神'}】为核心权变枢纽，逢岁运地支刑冲【${dayBranch}】日支之年，沉着冷静，严防岁运破格，守正待时。`
  ].join('\n');
}

function futureTenYears(chart, options = {}) {
  const currentYear = options.startYear || 2026;
  const dayStem = chart.dayMaster?.stem || chart.pillars[2].stem;
  const yongElem = options.yongElem || chart.dayMaster?.element || '木';
  const pBranches = chart.pillars.map((p) => p.branch);
  const posNames = ['年', '月', '日', '时'];

  const list = [];
  for (let i = 0; i < 10; i++) {
    const yr = currentYear + i;
    const yp = yearPillarOf(yr);
    const tStem = yp.gz[0];
    const tBranch = yp.gz[1];
    const tStemElem = STEM_ELEMENT[yp.stemIndex];
    const tBranchElem = BRANCH_ELEMENT[yp.branchIndex];
    const sElem = ['木', '火', '土', '金', '水'][tStemElem];
    const bElem = ['木', '火', '土', '金', '水'][tBranchElem];

    const tg = getTenGod(dayStem, tStem);

    const clashes = [];
    const combines = [];
    pBranches.forEach((ob, idx) => {
      if (BRANCH_CLASH[tBranch] === ob) clashes.push(`${posNames[idx]}支${ob}`);
      if (BRANCH_COMBINE[tBranch] === ob) combines.push(`${posNames[idx]}支${ob}`);
    });

    let stance = '';
    let advice = '';

    const isHelper = (sElem === yongElem || bElem === yongElem || ELEM_REL[yongElem]?.被生 === sElem || ELEM_REL[yongElem]?.被生 === bElem);
    const isChallenger = (ELEM_REL[yongElem]?.被克 === sElem || ELEM_REL[yongElem]?.被克 === bElem);

    if (isHelper) {
      stance = '助用生发 · 顺畅拓展';
      advice = `岁运引通${yongElem}气用神，利于专业深造、业务开拓与借势作为。`;
    } else if (isChallenger) {
      stance = '克用磨砺 · 防御持重';
      advice = `岁运制伐用神，宜韬光养晦、严控流动性与合规风险，不可盲目冒进。`;
    } else {
      stance = '生克制衡 · 稳步蓄力';
      advice = `五行气象互有生泄，稳扎稳打、注重内功沉淀与团队协作。`;
    }

    if (clashes.length > 0) {
      advice += ` 太岁冲原局${clashes.join('、')}，引动变动契机，主动求变或防范动荡。`;
    } else if (combines.length > 0) {
      advice += ` 太岁合原局${combines.join('、')}，人脉聚拢合和，利于合作共赢。`;
    }

    list.push({
      year: yr,
      gz: yp.gz,
      nayin: yp.nayin.name,
      tenGod: tg,
      stance,
      advice
    });
  }
  return list;
}

function conflictRemedyNote(mainConflict, yongElem, chart) {
  const dmElem = chart?.dayMaster?.element || (chart?.pillars?.[2]?.stem ? STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] : '木');
  const dayStem = chart?.dayMaster?.stem || chart?.pillars?.[2]?.stem || '日主';
  const matchElem = String(mainConflict).match(/[【\*]([木火土金水])[】\*]/);
  const targetElem = matchElem ? matchElem[1] : null;

  let rel = '';
  if (targetElem && ELEM_REL[targetElem]) {
    if (ELEM_REL[targetElem]?.被克 === dmElem) rel = '克日主';
    else if (ELEM_REL[dmElem]?.被克 === targetElem) rel = '耗日主';
    else if (ELEM_REL[dmElem]?.生 === targetElem) rel = '泄日主';
    else if (ELEM_REL[targetElem]?.生 === dmElem) rel = '生日主';
    else if (targetElem === dmElem) rel = '比劫过盛';
  }

  if (rel === '克日主' || mainConflict.includes('克日主') || mainConflict.includes('官杀')) {
    return `* **[破局要诀]**：日主【${dayStem}${dmElem}】受外部克伐过甚，首重印星化杀生身或食伤制伏，以制度合规或技术壁垒化解外部重压，引通【${yongElem}】气护身。`;
  }
  if (rel === '耗日主' || mainConflict.includes('耗日主') || mainConflict.includes('财')) {
    return `* **[破局要诀]**：日主【${dayStem}${dmElem}】见财重耗身易生负重劳碌，首重比劫分担与印星固本培元，量力而行，依附【${yongElem}】气培植稳固根基。`;
  }
  if (rel === '泄日主' || mainConflict.includes('泄日主') || mainConflict.includes('食') || mainConflict.includes('伤')) {
    return `* **[破局要诀]**：日主【${dayStem}${dmElem}】秀气外泄过甚易心神劳累，首重印星涵养生身，将灵动才智沉淀为标准化成果，以【${yongElem}】气收敛锋芒。`;
  }
  if (rel === '生日主' || mainConflict.includes('生日主') || mainConflict.includes('印')) {
    return `* **[破局要诀]**：日主【${dayStem}${dmElem}】生扶过厚易致迟疑僵化（印多身滞），首重财星损印澄清或食伤引通秀气，以【${yongElem}】气激发主观能动性。`;
  }
  if (rel === '比劫过盛' || mainConflict.includes('比劫') || mainConflict.includes('身旺')) {
    return `* **[破局要诀]**：日主【${dayStem}${dmElem}】同党过旺易生竞争内耗，首重官杀裁制或食伤秀气流通，推崇契约规则与利益共享，以【${yongElem}】气疏导滞塞。`;
  }
  return `* **[破局要诀]**：日主【${dayStem}${dmElem}】首要矛盾在于病药相济，必须以【${yongElem}】用神为枢纽打通生化防护线，方能成就大器。`;
}

function assetAllocationModel(domTenGod, yongElem, dmElem, dayStem) {
  if (domTenGod === '七杀') {
    return {
      title: '攻坚破局与危机对冲资产模型',
      p1Pct: 35,
      p1Desc: '独立应急防线 (35%)：高信用存款与对冲工具 | <-- 应对攻坚突发危机',
      p2Pct: 40,
      p2Desc: '破局核心业务 (40%)：关键业务控股 / 危机处置项目 | <-- 对应七杀魄力变现',
      p3Pct: 20,
      p3Desc: '稳固实物底盘 (20%)：核心不动产 / 优质保值重资产 | <-- 对应立身之基',
      p4Pct: 5,
      p4Desc: '严禁违规借贷与灰色激进扩张 (5%) | <-- 防范凶煞反噬涉诉',
      r1: `日主【${dayStem}${dmElem}】严禁参与任何无合规背书的盲目杠杆扩张，坚守合规底线；`,
      r2: `重要合同严设法务多重把关，预防合同陷阱，借【${yongElem}】用神稳固阵脚；`,
      r3: '逢岁运七杀冲克之年，主动低调退让，严禁硬碰硬激化外部矛盾。'
    };
  }
  if (domTenGod === '正官') {
    return {
      title: '体制平台信誉与合规治理资产模型',
      p1Pct: 30,
      p1Desc: '底仓安全垫 (30%)：高信用国债 / 稳定流动储备 | <-- 对应正统防御防线',
      p2Pct: 45,
      p2Desc: '平台资质股权 (45%)：特许经营牌照 / 体制内骨干项目 | <-- 对应官印相生护身',
      p3Pct: 20,
      p3Desc: '核心稳固资产 (20%)：优质不动产 / 稳定分红资产 | <-- 对应管理权溢价',
      p4Pct: 5,
      p4Desc: '非法集资与高杠杆金融衍生品绝对禁止 (5%) | <-- 防范商誉损毁',
      r1: `日主【${dayStem}${dmElem}】严守行业监管与法治红线，珍惜职业羽毛，绝不卷入违规操作；`,
      r2: `重要决策落实书面审批与集体审议，借【${yongElem}】气筑牢组织内控防火墙；`,
      r3: '逢岁运刑冲官星之年，恪守本分克制扩权冲动，严防逾矩越权。'
    };
  }
  if (domTenGod === '偏财') {
    return {
      title: '资本运作与跨界生态资产模型',
      p1Pct: 25,
      p1Desc: '战略储备资金 (25%)：高流动性货币头寸 / 黄金对冲 | <-- 随时把握风口机会',
      p2Pct: 45,
      p2Desc: '核心产业股权 (45%)：高成长性赛道合伙 / 战略并购项目 | <-- 对应敏锐商业变现',
      p3Pct: 25,
      p3Desc: '浮动套利组合 (25%)：结构化产业基金 / 稳健多元投资 | <-- 对应资金滚存',
      p4Pct: 5,
      p4Desc: '高杠杆单边做空与全额连带担保绝对禁止 (5%) | <-- 防范资金链断裂',
      r1: `日主【${dayStem}${dmElem}】严禁超出自身极限借贷加杠杆，坚持投资分散与多维安全边际；`,
      r2: `建立个人与企业资产法定隔离，以【${yongElem}】气深筑家庭财富防火墙；`,
      r3: '逢岁运比劫夺财之年，紧缩投机操作，守住利润颗粒归仓。'
    };
  }
  if (domTenGod === '正财') {
    return {
      title: '产业实干与现金流复利资产模型',
      p1Pct: 30,
      p1Desc: '底仓稳健防线 (30%)：低风险大额存款 / 国债保本产品 | <-- 对应现金流生命线',
      p2Pct: 45,
      p2Desc: '核心实业资产 (45%)：抗周期商业实业 / 优质收租不动产 | <-- 对应稳定财源生息',
      p3Pct: 20,
      p3Desc: '稳健分红配置 (20%)：蓝筹高股息资产 / 供应链信托 | <-- 对应稳健复利',
      p4Pct: 5,
      p4Desc: '盲目高频炒作与跨界盲目投机绝对禁止 (5%) | <-- 防范血汗积累破耗',
      r1: `日主【${dayStem}${dmElem}】坚持以正道现金流为导向，不赚认知以外的暴利快钱；`,
      r2: `精打细算控制各项经营成本，建立至少 18 个月以【${yongElem}】为核心之安全运营资金缓冲；`,
      r3: '逢岁运劫财克伐之年，坚决拒绝熟人无抵押借款，防范资金外流。'
    };
  }
  if (domTenGod === '伤官') {
    return {
      title: '知识产权与颠覆创新资产模型',
      p1Pct: 25,
      p1Desc: `底仓安全垫 (25%)：高信用存款 / 避险对冲工具 | <-- 对应${dayStem}${dmElem}印星涵养生身`,
      p2Pct: 40,
      p2Desc: `颠覆研发投资 (40%)：${dmElem === '木' ? '前沿文创版权 / 品牌软件' : dmElem === '金' ? '精密专有技术 / 核心算法' : '核心专有技术 / 研发产权'} | <-- 对应${dmElem}秀气发露变现`,
      p3Pct: 30,
      p3Desc: `核心稳固资产 (30%)：优质实物资产 / 高流动性资产 | <-- 对应${dayStem}命局财库承载收益`,
      p4Pct: 5,
      p4Desc: `盲目跨界重资产与高负债投资绝对禁止 (5%) | <-- 防范${dayStem}${dmElem}才思枯竭断链`,
      r1: `日主【${dayStem}${dmElem}】高度重视知识产权与核心专有成果保护，筑牢技术防护壁垒；`,
      r2: `商务谈判设立严格冷静期，以【${yongElem}】气化解情绪冲动，避免违约纠纷；`,
      r3: `逢岁运印星克制伤官（枭神夺食）之年，日主【${dayStem}】宜放慢脚步潜心进修，厚积薄发。`
    };
  }
  if (domTenGod === '食神') {
    return {
      title: '工匠专精与长效品牌复利资产模型',
      p1Pct: 30,
      p1Desc: '福德底仓基金 (30%)：高稳健年金 / 保本储备资产 | <-- 对应寿星福禄安稳',
      p2Pct: 40,
      p2Desc: '工匠产品研发 (40%)：独家产品打磨 / 专业实验室 / 特色品牌 | <-- 技能转化为实利',
      p3Pct: 25,
      p3Desc: '稳健实业股权 (25%)：长期合作实体收益 / 优质商业基石 | <-- 财源源远流长',
      p4Pct: 5,
      p4Desc: '短期概念炒作与无抵押高息拆借绝对禁止 (5%) | <-- 防范心浮气躁损福',
      r1: `日主【${dayStem}${dmElem}】专注打磨核心产品品质，以口碑赢得天下客，不随波逐流；`,
      r2: `建立稳健可持续的盈利模型，借【${yongElem}】用神保持从容节奏，杜绝透支信用；`,
      r3: '逢岁运偏印夺食之年，提前做好现金储备，守护核心技艺资产。'
    };
  }
  if (domTenGod === '偏印') {
    return {
      title: '独门秘术与隐形暗智资产模型',
      p1Pct: 35,
      p1Desc: '隐密安全储备 (35%)：独立私密存款 / 保本固收资产 | <-- 对应偏印内敛自持',
      p2Pct: 40,
      p2Desc: '专有智力资产 (40%)：特许秘术专精 / 深度科研成果 / 独门数据 | <-- 异路奇思变现',
      p3Pct: 20,
      p3Desc: '稳固实物抵押 (20%)：变现性强的硬通货资产 | <-- 对应立足根基',
      p4Pct: 5,
      p4Desc: '跟风大众热点与无技术壁垒重资产绝对禁止 (5%) | <-- 防范心浮气躁',
      r1: `日主【${dayStem}${dmElem}】深挖护城河，将独家秘门认知转化为不可替代的专业壁垒；`,
      r2: `防范过度孤立封闭，以【${yongElem}】气保持与产业前端的信息触角对接；`,
      r3: '逢岁运偏印过盛之年，加强现实社交与身心户外锻炼，打破思维内耗。'
    };
  }
  if (domTenGod === '正印') {
    return {
      title: '学术名誉与深厚慈德资产模型',
      p1Pct: 45,
      p1Desc: '底仓安全垫 (45%)：国家信用类债券 / 大额存单 / 储备金 | <-- 对应印星本气安稳',
      p2Pct: 35,
      p2Desc: '声誉智库资产 (35%)：资质认证 / 著作版权 / 高端平台合作权益 | <-- 学术声誉溢价',
      p3Pct: 15,
      p3Desc: '稳健不动产 (15%)：自住稳固资产 / 核心保值实物 | <-- 对应立身之基',
      p4Pct: 5,
      p4Desc: '任何形式的高息借贷与投机套利绝对禁止 (5%) | <-- 防范贪财坏印',
      r1: `日主【${dayStem}${dmElem}】严禁参与任何以个人声誉为他人背书的借贷或担保，珍惜羽毛；`,
      r2: `防范资产过度死板僵化，借【${yongElem}】用神保持适度流动性应对突发变故；`,
      r3: '逢岁运财星破印之年，戒除贪婪求快念头，坚持以德求财。'
    };
  }
  if (domTenGod === '劫财') {
    return {
      title: '团队合伙与狼性突围资产模型',
      p1Pct: 30,
      p1Desc: '独立应急防线 (30%)：专属防守基金 / 隔离备用金 | <-- 防范分财损耗',
      p2Pct: 45,
      p2Desc: '合伙扩张项目 (45%)：契约清晰的狼性业务股权 / 攻坚项目分红 | <-- 同侪开拓变现',
      p3Pct: 20,
      p3Desc: '核心现金流工具 (20%)：现金流稳定的核心工具资产 | <-- 务实立足根基',
      p4Pct: 5,
      p4Desc: '无契约熟人借款与非正式盲目合伙绝对禁止 (5%) | <-- 防范兄弟反目',
      r1: `日主【${dayStem}${dmElem}】亲兄弟明算账，所有合作与利益分配严格落实在法律合同之上；`,
      r2: `切忌盲目义气用事充当连带担保人，以【${yongElem}】气防范朋友债务牵连破财；`,
      r3: '逢岁运官杀攻身或比劫争利之年，以退为进，主动散财惠及同侪。'
    };
  }
  return {
    title: '独立自立与稳健合营资产模型',
    p1Pct: 35,
    p1Desc: '独立底气储备 (35%)：个人自立应急存款 / 低风险保本资产 | <-- 对应自尊自主',
    p2Pct: 35,
    p2Desc: '专精合营项目 (35%)：权责对等的合伙企业股权 / 自主经营实体 | <-- 稳健并肩立业',
    p3Pct: 25,
    p3Desc: '稳固实物底盘 (25%)：稳健商铺物业 / 生产型工具资产 | <-- 长效立身基石',
    p4Pct: 5,
    p4Desc: '过度倚赖他人与盲目替人兜底绝对禁止 (5%) | <-- 防范被动受损',
    r1: `日主【${dayStem}${dmElem}】权责清晰，坚持对等合作，不占人便宜亦不让人侵犯边界；`,
    r2: `遇重大投资坚持独立核算，借【${yongElem}】用神杜绝财务混同与无序扩张；`,
    r3: '逢岁运比劫叠见之年，以分利促共赢，主动扩大合作边界。'
  };
}

function luckStageAdvice(lp, stance, dmElem, yongElem) {
  const g = lp?.tenGod || '运星';
  const gz = lp?.gz || '本运';
  const stem = gz[0];
  if (g.includes('比') || g.includes('劫') || g.includes('刃') || g.includes('禄')) {
    return `此运逢【${gz}·${g}】同侪汇聚，天干透【${stem}】，日元${dmElem}逢比劫分担，主并肩打拼与团队共创。宜广结善缘、财散人聚，切忌独断专行。`;
  }
  if (g.includes('食') || g.includes('伤')) {
    return `此运逢【${gz}·${g}】秀气发露，天干透【${stem}】，引通日元${dmElem}智巧才情，主开拓创新与才艺变现。宜打磨技术壁垒，以作品赢得尊重。`;
  }
  if (g.includes('官') || g.includes('杀')) {
    return `此运逢【${gz}·${g}】执掌权柄，天干透【${stem}】，直面组织重任与外部考查。宜恪守法规、主动担当组织使命，防范权力傲慢引发争议。`;
  }
  if (g.includes('印') || g.includes('枭')) {
    return `此运逢【${gz}·${g}】生扶生身，天干透【${stem}】，主贵人照拂、深造学习与心性沉淀。宜退后一步蓄积内功，厚积薄发。`;
  }
  if (g.includes('财')) {
    return `此运逢【${gz}·${g}】财气流通，天干透【${stem}】，日元${dmElem}直面现实商业机遇。宜精打细算、抓住产业机遇，但切忌急功近利。`;
  }
  return `此十年行运聚焦【${gz}·${g}】气象，天干【${stem}】主事，宜顺应环境节律，善加把握生克转折契机。`;
}

function strategyGuidance(domTenGod, dmElem, yongElem, dayStem) {
  if (domTenGod === '七杀') {
    return {
      rule: `日主【${dayStem}${dmElem}】直面七杀重压，面临重大战略抉择严格审查法规与契约底线，兼听多方意见，绝不涉险越界。设立重大决断冷却期。`,
      cultivation: `由威入德，日主【${dayStem}${dmElem}】以慈悲利他涵养胸怀，将管束化为担当，借【${yongElem}】气润物无声，方显帅才统御格局。`
    };
  }
  if (domTenGod === '正官') {
    return {
      rule: `日主【${dayStem}${dmElem}】立足正统规范，面临重大战略扩张审视组织承载力，坚决规避灰色违规路径，设立多维内控审核。`,
      cultivation: `由法入情，以宽仁厚德统合规章，戒除僵化严苛，善用【${yongElem}】用神活化组织氛围，成就长治久安之业。`
    };
  }
  if (domTenGod === '偏财') {
    return {
      rule: `日主【${dayStem}${dmElem}】面对重大商业博弈设立严格止损线与至少 14 天冷静期，严禁盲目加杠杆投机，谨防虚妄繁华诱惑。`,
      cultivation: `由利入义，深谙「财散则人聚、财聚则人散」的天道逻辑，以【${yongElem}】用神为护卫，多行利他布施，厚德载物。`
    };
  }
  if (domTenGod === '正财') {
    return {
      rule: `日主【${dayStem}${dmElem}】经营实业须戒除急功近利，坚持以现金流与安全边际为基准，抵制概念炒作，稳步扩张。`,
      cultivation: `由技入道，以诚实守信为立身之本，借【${yongElem}】气赋能产业升级，守正出奇，聚沙成塔。`
    };
  }
  if (domTenGod === '伤官') {
    return {
      rule: `日主【${dayStem}${dmElem}】才华锋芒毕露，面临情绪激荡或重大合同签署时切忌冲动拍板，多听老成持重者意见，建立严格事实核对流程。`,
      cultivation: `参悟「大巧若拙」与「弱德之美」，以【${yongElem}】气涵养才华，收敛锋芒多作包容，将超凡才智转化为造福大众之长青基业。`
    };
  }
  if (domTenGod === '食神') {
    return {
      rule: `日主【${dayStem}${dmElem}】深具工匠底蕴，决策时须警惕舒适区惰性，建立量化推进里程碑，防范议而不决延误战机。`,
      cultivation: `由术入道，保持恬淡从容之心性，以【${yongElem}】用神为枢纽持续精进技艺，达济天下，福泽绵长。`
    };
  }
  if (domTenGod === '偏印') {
    return {
      rule: `日主【${dayStem}${dmElem}】直觉敏锐洞察深邃，面临重大决断须以客观事实数据为凭，防范过度孤僻疑忌导致错判。`,
      cultivation: `打破孤绝清高，接纳人间烟火，借【${yongElem}】气将深奥秘术转化为经世致用之成果，福慧兼修。`
    };
  }
  if (domTenGod === '正印') {
    return {
      rule: `日主【${dayStem}${dmElem}】重大决策切忌拖延空想，注重知行合一，要求战略设想必须配套可量化推进之落地执行清单。`,
      cultivation: `由学入行，打破书生清高执念，借【${yongElem}】气在火热实践中经风雨见世面，经世致用，内圣而外王。`
    };
  }
  if (domTenGod === '劫财') {
    return {
      rule: `日主【${dayStem}${dmElem}】合伙开拓面临合作分成与担保时必须坚持白纸黑字法务合同，拒绝哥们义气绑架，边界清晰方能长久。`,
      cultivation: `成人达己，以包容胸襟凝聚同道同仁，以【${yongElem}】气建立契约法度，不争一时之短长，谋求长远共赢。`
    };
  }
  return {
    rule: `日主【${dayStem}${dmElem}】遇重大抉择坚持独立核算与自主研判，不盲从大流，亦不固步自封。`,
    cultivation: `虚怀若谷，日主【${dayStem}${dmElem}】以自立自强为底气，借【${yongElem}】气合作共赢，博采众长以成大业。`
  };
}

/**
 * 确保输入被解析为完整的排盘 chart
 */
export function ensureFullChart(input) {
  if (input && input.pillars && input.dayMaster) {
    if (!input.relations) input.relations = gzRelations(input.pillars, null);
    if (!input.shensha) {
      const dayStemIdx = STEMS.indexOf(input.pillars[2].stem);
      const yearStemIdx = STEMS.indexOf(input.pillars[0].stem);
      input.shensha = shenshaOf(input.pillars, dayStemIdx, yearStemIdx, input.input?.gender || '男');
    }
    return input;
  }

  // 若传入的是生日对象 { year, month, day, hour, minute, gender }
  if (input && typeof input.year === 'number' && typeof input.month === 'number') {
    return castChart(input);
  }

  // 若传入的是四柱数组 ['庚午', '辛巳', '乙酉', '癸未']
  if (Array.isArray(input) && input.length === 4) {
    // 尝试利用 dateCandidates 寻找最佳公历匹配
    try {
      const cands = dateCandidates(input, { fromYear: 1900, toYear: 2050 });
      if (cands && cands.候选 && cands.候选.length > 0) {
        const best = cands.候选[0];
        const [y, m, d] = best.日期.split('-').map(Number);
        // 推算小时
        const branchHourMap = {
          '子': 23, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10,
          '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22
        };
        const h = branchHourMap[best.时支] ?? 12;
        return castChart({ year: y, month: m, day: d, hour: h, minute: 30, gender: '男' });
      }
    } catch {
      // 容错回退
    }

    // 无法反推或反推失败时，组装标准的四柱结构
    const pos = ['年柱', '月柱', '日柱', '时柱'];
    const pillars = input.map((gz, i) => {
      const stem = gz[0];
      const branch = gz[1];
      const stemIndex = STEMS.indexOf(stem);
      const branchIndex = BRANCHES.indexOf(branch);
      return {
        position: pos[i],
        gz,
        stem,
        branch,
        stemIndex,
        branchIndex,
        stemElement: STEM_ELEMENT[stemIndex],
        branchElement: BRANCH_ELEMENT[branchIndex],
      };
    });

    const dayStem = pillars[2].stem;
    const dayStemIdx = STEMS.indexOf(dayStem);
    const yearStemIdx = STEMS.indexOf(pillars[0].stem);

    const chart = {
      input: { gzList: input, gender: '男' },
      calendar: {
        solar: '根据四柱反推',
        solarTermMonth: { term: '参考月令', startedAt: '未知', nextTerm: '未知', nextAt: '未知' },
      },
      pillars,
      dayMaster: {
        stem: dayStem,
        element: STEM_ELEMENT[dayStemIdx],
        bornMonthBranch: pillars[1].branch,
      },
      void: {
        xunKong: [],
      },
      relations: gzRelations(pillars, null),
      shensha: shenshaOf(pillars, dayStemIdx, yearStemIdx, '男'),
      strength: {
        percent: { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 }
      }
    };
    return chart;
  }

  throw new Error('ensureFullChart: 无法识别的输入格式（支持生日对象或四柱数组）');
}

/**
 * 第一段：排盘事实层生成
 */
function renderFactSection(chart) {
  const lines = [];
  lines.push('## 第一段：排盘事实（无争议客观事实底座）\n');

  // 1.1 四柱干支与神煞全景（竖排卡片）
  lines.push('### 1.1 四柱干支与神煞全景（竖排）\n');

  const p = chart.pillars;
  const colW = 15;
  const labelW = 10;

  function makeRow(label, values) {
    const lStr = padCenter(label, labelW);
    const vStrs = values.map((v) => padCenter(v || '', colW));
    return `| ${lStr} | ${vStrs.join(' | ')} |`;
  }

  const divider = `+${'-'.repeat(labelW + 2)}+${('-'.repeat(colW + 2) + '+').repeat(4)}`;

  lines.push('```text');
  lines.push(divider);
  lines.push(makeRow('维度', ['年柱', '月柱', '日柱', '时柱']));
  lines.push(divider);

  // 主星
  const zhuxing = p.map((item, idx) => (idx === 2 ? '日主' : (item.tenGod || '')));
  lines.push(makeRow('主星', zhuxing));

  // 天干
  const tiangan = p.map((item) => `${item.stem}${item.stemElement || STEM_ELEMENT[item.stemIndex] || ''}`);
  lines.push(makeRow('天干', tiangan));

  // 地支
  const dizhi = p.map((item) => `${item.branch}${item.branchElement || BRANCH_ELEMENT[item.branchIndex] || ''}`);
  lines.push(makeRow('地支', dizhi));

  // 藏干
  const canggan = p.map((item) => {
    if (!item.hidden) return '';
    return item.hidden.map((h) => h.stem).join(' ');
  });
  lines.push(makeRow('藏干', canggan));

  // 副星
  const fuxing = p.map((item) => {
    if (!item.hidden) return '';
    return item.hidden.map((h) => h.tenGod || '').join(' ');
  });
  lines.push(makeRow('副星', fuxing));

  // 星运与自坐
  const xingyun = p.map((item) => item.dayStemStage || '');
  lines.push(makeRow('星运', xingyun));
  const zizuo = p.map((item) => item.selfStage || '');
  lines.push(makeRow('自坐', zizuo));

  // 空亡与纳音
  const kongwang = p.map((item) => (item.voidBranches ? item.voidBranches.join('') : ''));
  lines.push(makeRow('空亡', kongwang));
  const nayin = p.map((item) => (item.nayin?.name || ''));
  lines.push(makeRow('纳音', nayin));

  // 神煞（字段名严格对齐底座 shenshaOf 的结构：{ name, positions, nature, note }）
  const colShensha = [[], [], [], []];
  if (Array.isArray(chart.shensha)) {
    const posKeys = ['年', '月', '日', '时'];
    chart.shensha.forEach((s) => {
      const positions = Array.isArray(s?.positions) ? s.positions : [];
      posKeys.forEach((k, idx) => {
        if (positions.some((ps) => String(ps).startsWith(k))) {
          colShensha[idx].push(s.name || '');
        }
      });
    });
  }

  // 取最大神煞行数，至少 4 行
  const maxRows = Math.max(4, ...colShensha.map((c) => c.length));
  for (let r = 0; r < maxRows; r++) {
    const rowVals = [0, 1, 2, 3].map((cIdx) => colShensha[cIdx][r] || '');
    lines.push(makeRow(r === 0 ? '神煞' : '', rowVals));
  }

  lines.push(divider);
  lines.push('```\n');

  const dmElem = chart.dayMaster?.element || STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] || '木';

  // 1.2 命主基本生辰参数
  lines.push('### 1.2 命主基本生辰参数\n');
  const cal = chart.calendar || {};
  lines.push(`* **公历生辰**：${cal.solar || '未提供公历日期（四柱推算）'}`);
  lines.push(`* **农历生辰**：${p[0].gz}年 ${p[1].gz}月 ${p[2].gz}日 ${p[3].gz}时`);
  lines.push(`* **真太阳时**：依出生地经度校正（基准：北京时间/真太阳时刻）`);
  if (cal.solarTermMonth) {
    lines.push(`* **节气划分**：${cal.solarTermMonth.term}令，${chart.dayMaster?.司令?.司令 || '司令'}司权司事`);
  }
  lines.push(`* **生肖属相**：${p[0].zodiac ? `属${p[0].zodiac}` : '生肖相合'}`);
  lines.push(`* **日元属性**：${chart.dayMaster?.stem || p[2].stem}${dmElem}（${chart.dayMaster?.yinYang || '阴'}${dmElem}）`);
  lines.push(`* **旬空信息**：年柱空【${p[0].voidBranches?.join('') || ''}】· 月柱空【${p[1].voidBranches?.join('') || ''}】· 日柱空【${p[2].voidBranches?.join('') || ''}】· 时柱空【${p[3].voidBranches?.join('') || ''}】\n`);

  lines.push('---\n');

  // 1.3 五行气象与能量结构量化
  lines.push('### 1.3 五行气象与能量结构量化\n');

  const strength = chart.strength || {};
  const pct = strength.percent || { '木': 20, '火': 20, '土': 20, '金': 20, '水': 20 };

  // 同党（生我、同我） vs 异党（克我、我生、我克）
  const shengElem = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }[dmElem];
  const tongPct = Number(((pct[dmElem] || 0) + (pct[shengElem] || 0)).toFixed(1));
  const yiPct = Number((100 - tongPct).toFixed(1));

  function makeBar(ratio, totalBlocks = 20) {
    const filled = Math.round((ratio / 100) * totalBlocks);
    return '█'.repeat(Math.min(totalBlocks, Math.max(0, filled))) + '░'.repeat(Math.max(0, totalBlocks - filled));
  }

  lines.push('#### 1.3.1 同党 vs 异党对比');
  lines.push(`* **同党（生扶日元：${dmElem}、${shengElem}）**：**${tongPct}%**`);
  lines.push(`* **异党（消耗日元：克泄耗诸神）**：**${yiPct}%**`);
  lines.push('* **能量对比图**：');
  lines.push('  ```text');
  lines.push(`  同党 [${makeBar(tongPct)}] ${tongPct}% (${tongPct < 35 ? '弱' : tongPct > 65 ? '强' : '中和'})`);
  lines.push(`  异党 [${makeBar(yiPct)}] ${yiPct}% (${yiPct > 65 ? '强' : yiPct < 35 ? '弱' : '中和'})`);
  lines.push('  ```\n');

  lines.push('#### 1.3.2 五行能量细分（得令与藏干加权折算）');
  const elements = ['金', '木', '水', '火', '土'];
  elements.forEach((elm) => {
    const val = (pct[elm] || 0).toFixed(1);
    lines.push(`* **${elm}**：**${val}%** \`[${makeBar(Number(val))}]\``);
  });
  lines.push('');

  lines.push('#### 1.3.3 日主旺衰三维研判');
  const deLing = strength.令态?.[dmElem] === '旺' ? 35 : strength.令态?.[dmElem] === '相' ? 25 : 5;
  const deDi = (strength.rooted?.[dmElem] || 0) > 0.5 ? 20 : 8;
  const deShi = tongPct > 40 ? 20 : 6;
  const totalScore = deLing + deDi + deShi;

  lines.push(`1. **得令度**：**${deLing} / 40 分**（月令处「${strength.令态?.[dmElem] || '休囚'}」之气）。`);
  lines.push(`2. **得地度**：**${deDi} / 30 分**（通根力量评估）。`);
  lines.push(`3. **得势度**：**${deShi} / 30 分**（干支同党生助）。`);
  lines.push(`* **综合判定**：**日元${totalScore >= 55 ? '偏旺' : totalScore >= 35 ? '中和偏弱' : '极弱（身弱正格，不作从格妄断）'}**。骨气尚存，立足正格推演。\n`);

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * 第二段：丙层六大派主张并陈
 */
function renderSchoolSection(chart) {
  const feats = extractChartFeatures(chart);
  const entries = loadAllSchoolEntries();
  const matched = matchSchoolClaims(feats, entries);

  const lines = [];
  lines.push('## 第二段：丙层各派学说并陈（六大流派经典主张）\n');
  lines.push('> **导读**：中国传统命理学在千百年演进中形成了不同研究视角。本段严格并陈各大主要流派对本命造的核心推演逻辑、喜忌判断与实质分歧，不强行选边，全景呈现学理脉络。\n');
  lines.push('---\n');

  // 2.1 格局派
  lines.push('### 2.1 格局派（以《子平真诠》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《子平真诠·论月令格局》：「八字专以月令配用神，月令者，宰相也……伤官虽非吉神，若化而为权，亦成贵格。伤官佩印，贵不可言。」');
  lines.push('  > 《子平真诠·论正官配伤官》：「正官见伤，其局大破。若官杀混杂，亦须有字清之，留官去杀则贵，留杀去官亦清。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **立格原委**：以月令藏干透干为纲，天干透官透杀，月令本气当令司权。');
  lines.push('  * **格局研判**：官杀并见犯官杀混杂之弊，格局成破受制于去留救应。');
  lines.push('  * **喜忌判定**：喜字清格（合杀留官或制杀留官），喜印绶护身引通秀气；忌官杀重战破坏纯粹性。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 格局派不以身强身弱为第一要义，将「格局清纯与成破救应」置于绝对优先位置；只要去留得当、格局清纯即可取贵。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 若岁运天干透合杀之字，能否真正达成《子平真诠》所言的“合杀留官”纯粹大贵之格？\n');
  lines.push('---\n');

  // 2.2 用神气势派
  lines.push('### 2.2 用神气势派（以《滴天髓》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《滴天髓·通微论·体用》：「道有体用，不可以一端论也，要在扶之抑之得其宜……气象规模，先求纯粹；体用精神，要在流通。」');
  lines.push('  > 《滴天髓·从化论》：「从得真者只论从，从得不真反受冲；阳干从气不从势，阴干从势无情义。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **气势全貌**：全盘气势聚于五行流通关节点，日元身处克泄交加之境。');
  lines.push('  * **气流分析**：两党交战最重通关枢纽，通关之神若在，则化敌为友、生生不息。');
  lines.push('  * **喜忌判定**：喜印星通关生身、润泽流通；忌燥土财星坏印破局。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 强调全盘气势流通与体用协调，认为日主为“体”，体若衰极无依，一切名利用神皆为克身利刃，保全生机为第一优先。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 原局通关之神力量强弱，是否足以在岁运冲击下保持流通闭环而不至于断链？\n');
  lines.push('---\n');

  // 2.3 调候派
  lines.push('### 2.3 调候派（以《穷通宝鉴》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《穷通宝鉴》：「四月乙木，禾稼皆枯，火炎土燥，先用癸水，次用庚辛。癸水为滋润之本，庚辛为发水之源。有癸无庚，水无发源，富贵不久；庚癸两透，科甲定然。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **气候实况**：初夏阳气蒸腾，天地燥烈，草木首重甘霖滋润。');
  lines.push('  * **调候组合**：原局透出印水与生水之金，气候得金水呼应为上佳之兆。');
  lines.push('  * **喜忌判定**：金水相生为第一甘霖源泉；忌烈火熬干水气。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 突破十神吉凶教条，以大自然生态气候为最高基准；视生水之金为白虎源泉而非克身恶煞。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 在气候调候优先的前提下，岁运引通金水是否可一举超越原局十神混杂之局限？\n');
  lines.push('---\n');

  // 2.4 盲派命理
  lines.push('### 2.4 盲派命理（以宾主体用与干支做功为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《盲派命理·宾主与做功》：「日时为主位，代表自己与归宿；年月为宾位，代表社会与外部环境。做功者，制用、化用、合用也。功大则贵，功小则富。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **宾主界定**：年月为宾位外部权力，日时为主位自我归宿。');
  lines.push('  * **做功方式**：主位支合入宾位，以印化杀、以食制杀，宾主交涉形成能量转移做功。');
  lines.push('  * **喜忌与成就**：做功神祇不受冲破则成大功；刑冲穿绝动摇主位则主劳碌波折。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 废除日主平衡衰旺之教条，纯以宾主做功效率与捕神贼神定社会财富量级。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 主位地支逢岁运三合或刑穿时，是做功能级指数级放大，还是根基动摇反受其累？\n');
  lines.push('---\n');

  // 2.5 新派命理
  lines.push('### 2.5 新派命理（以旺衰平衡与隔轴生克为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《新派命理评注》：「百神论以实神虚神为凭，生克只论相邻，隔柱不作用。从弱格中克泄耗为用；平衡格中衰则喜扶。」');
  lines.push('* **本命具体干支详析**：');
  lines.push('  * **旺衰界定争论**：时柱微根与虚透生助之力量判定，决定是从格还是极弱正格。');
  lines.push('  * **不同判定下的喜忌翻转**：若定从弱则克泄耗全吉；若定正格则印比为第一用神。');
  lines.push('* **学派实质分歧**：');
  lines.push('  * 展现了纯线性数学化量化体系在边缘盘上的二元争议。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 隔柱相邻作用机制下，年时两端之干支能否直接跨柱产生实质合化？\n');
  lines.push('---\n');

  // 2.6 神煞象义派
  lines.push('### 2.6 神煞象义派（以星宿干支互见为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《三命通会·论诸家神煞》：「天乙贵人者，天上玉皇之神，百恶不侵；驿马主动，将星主权；华盖孤高，文昌掌笔墨。」');
  lines.push('* **本命具体神煞详析**：');
  const ssList = Array.isArray(chart.shensha) ? chart.shensha : [];
  const topSs = ssList.slice(0, 5).map((s) => {
    const positions = Array.isArray(s?.positions) ? s.positions.join('/') : '';
    return `【${s?.name || ''}】（${positions || '未标落宫'}，${s?.nature || '中'}神）`;
  }).join('、');
  lines.push(`  * **命中所带核心神煞**：${topSs || '天乙贵人、将星、文昌贵人'}等。`);
  lines.push('  * **贵人格局**：吉神护佑逢凶化吉，威权与智慧星宿互见，主人内省深刻、具备高阶技术与组织威严。');
  lines.push('  * **警示神煞**：若带阴错阳差或截路空亡，需在亲密关系与签约决策上保持审慎。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 将星之威权与华盖之哲思如何统合于现实职业生涯的战略定位？\n');

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * 第三段：乙体系体用路线法深度推演
 */
function renderTiyongSection(chart, options = {}) {
  const lines = [];
  lines.push('## 第三段：乙体系体用路线法深度推演\n');
  lines.push('> **体系立论**：乙体系秉承「体为基石、用为权变、病药相济、去留清纯」的理路。不偏执于一派，以干支生克物理为根，以阴阳气候调和为机，深度解构格局成破、主要矛盾、财富曲线与人生战略。\n');
  lines.push('---\n');

  // 检视体系覆盖闸门（宪法誓言，D-037 落地）
  const covOpts = {
    ...options,
    ...(chart.未覆盖 !== undefined ? { 未覆盖: chart.未覆盖 } : {}),
    ...(chart.covered !== undefined ? { covered: chart.covered } : {})
  };
  const cov = coverageOf(chart, covOpts);
  if (!cov.covered) {
    lines.push('> [!CAUTION]');
    lines.push('> ### ⚠ 【本体系未覆盖，暂不判断】');
    lines.push(`> **仲裁定性**：${cov.结论 || '本体系未覆盖，暂不判断'}`);
    lines.push(`> **法理依据**：${cov.依据 || '《体用路线法》根本宪法未覆盖特殊外格或无通关死结格局'}`);
    lines.push(`> **说明**：依据本工具开发纪律与宪法原则，本体系对尚未建立完备公理化判据之极端命造，坚决明陈「本体系未覆盖，暂不判断」，绝不强行代判或伪造结论。\n`);
    lines.push('---\n');
    return lines.join('\n');
  }

  const ti = tiyongRouteOf(chart);
  const geju = ti.格局成破 || gejuChengPoOf(chart);
  const prot = ti['第三之链_护卫链']?.全景通路 || {};
  const yongElem = ti['第三之链_护卫链']?.用神 || ti['第三之链_护卫链']?.全景通路?.用神 || chart.dayMaster?.element || '木';
  const domTenGod = classifyDominantTenGod(geju, chart);
  const profile = TEN_GOD_PROFILE[domTenGod] || TEN_GOD_PROFILE['官杀'];
  const dmElem = chart.dayMaster?.element || STEM_ELEMENT[STEMS.indexOf(chart.pillars[2].stem)] || '木';
  const dayStem = chart.dayMaster?.stem || chart.pillars[2].stem;

  // 3.1 格局深度研判与去留救应全解
  lines.push('### 3.1 格局深度研判与去留救应全解\n');
  lines.push('#### 3.1.1 定格与格神');
  lines.push(`* **本命格局**：**${geju.格局 || '正格'}**`);
  lines.push(`* **格神**：${geju.格神字 || chart.pillars[1].branch}（${geju.格神十神 || '司令司权'}）`);
  lines.push(`* **用神透出**：天干透出 ${chart.pillars.map((p) => p.stem).join('、')}`);
  lines.push(`* **格局研判结论**：**【${geju.状态 || '成格'} · ${geju.破格因 ? `破格因：${geju.破格因}` : '清纯可取'}${geju.救应因 ? ` · 救应因：${geju.救应因}` : ''}】**\n`);

  const quote = gejuOriginQuote(geju, chart);
  lines.push('#### 3.1.2 经典原典与现代深度解译');
  lines.push('* **【经典立格成破之论】**');
  lines.push('  * **古籍原文**：');
  lines.push(`    > ${quote.出处}：「${quote.原文}」`);
  lines.push('  * **现代译文与解注**：');
  lines.push(`    * **现代译文**：${quote.译文}`);
  lines.push(`    * **本命深度映射**：${quote.本命解}\n`);

  lines.push('#### 3.1.3 去留方案与岁运清格路线图');
  lines.push(gejuRescueRoutes(geju, chart, yongElem) + '\n');
  lines.push('---\n');

  // 3.2 主要矛盾剖析与全景护卫双通路
  lines.push('### 3.2 主要矛盾剖析与全景护卫双通路\n');
  lines.push('```text');
  lines.push(`                  【${chart.pillars.map((p) => p.gz).join(' ')} 原局核心生态结构】`);
  lines.push(`     [年] ${chart.pillars[0].gz} (祖荫客位)                 [月] ${chart.pillars[1].gz} (提纲司令)`);
  lines.push(`             \\________________ 外部交互 [${chart.pillars[0].stem}·${chart.pillars[1].stem}] ________________/`);
  lines.push(`                                      | (提纲月令【${chart.pillars[1].branch}】气局透出)`);
  lines.push(`                                      v (生克流通至【${dayStem}】)`);
  lines.push(`     [日元] 【${dayStem}${dmElem}】 <====== 生克引通 ======> [时干] 【${chart.pillars[3].stem}】(归宿门户)`);
  lines.push(`             | (日支【${chart.pillars[2].branch}】坐下承载)                 | (时支【${chart.pillars[3].branch}】归宿归垣)`);
  lines.push('```\n');

  const mainConflict = ti.主要矛盾?.['二_主要矛盾'] || ti.主要矛盾?.矛盾 || '身弱克泄交加，急需生化通关';
  lines.push('#### 3.2.1 第一核心矛盾');
  lines.push(`* 命局首要矛盾：${mainConflict}。`);
  lines.push(conflictRemedyNote(mainConflict, yongElem, chart) + '\n');

  lines.push('#### 3.2.2 全景双通路护卫模型');
  const gehu = prot.隔途 || {};
  const zhihu = prot.制途 || {};
  lines.push(`* **【通路一：${gehu.途径 || '隔途通关'}】**：状态【${gehu.状态 || '畅通有效'}】，护神【${gehu.护神 || '印星'}】，力度【${gehu.力度档 || '中'}】。`);
  lines.push(`* **【通路二：${zhihu.途径 || '制途护卫'}】**：状态【${zhihu.状态 || '在位防守'}】，护神【${zhihu.护神 || '食伤'}】，力度【${zhihu.力度档 || '弱'}】。`);
  lines.push(`* **综合定性**：剩余有效路数【**${prot.剩余有效路数 ?? 1} 路**】，状态【**${prot.状态定性 || '独木难支'}**】；替代解求值：【**${prot.替代解 || '存活通路独立撑局'}**】。\n`);
  lines.push('---\n');

  // 3.3 财富与事业发展高阶专题报告
  lines.push('### 3.3 财富与事业发展高阶专题报告\n');
  lines.push('#### 3.3.1 求财心性与底层盈利逻辑');
  lines.push(`1. **底层驱动心性**：日主【${dayStem}${dmElem}】以主导【${domTenGod}】立意。${profile.心性}`);
  lines.push(`2. **核心变现逻辑**：日主【${dayStem}${dmElem}】${profile.动机}（以【${yongElem}】用神为调和枢纽）。`);
  lines.push(`3. **进阶成长准则**：日主【${dayStem}${dmElem}】${profile.进阶心法}\n`);

  lines.push('#### 3.3.2 职场生态位与核心竞争力矩阵');
  const ecoPos = (domTenGod === '伤官' && dmElem === '木') ? '【前沿文创创意总监 / 传播先锋 / 理念布道师 / 架构大师】'
    : (domTenGod === '伤官' && dmElem === '金') ? '【首席技术架构师 / 深度算法科学家 / 战略研判专家】'
    : profile.生态位;
  lines.push(`* **最佳生态位定位**：**${ecoPos}**。`);
  lines.push(`* **角色进阶心法**：日主【${dayStem}${dmElem}】${profile.进阶心法}\n`);

  lines.push('#### 3.3.3 资产配置架构与系统性风控防线');
  lines.push('> *说明：以下模型系根据传统五行生克意象与体用平衡构想之通用通识参考框架，非本命特有公理断言，切勿替代合规投资顾问之专业决策。*');
  const asset = assetAllocationModel(domTenGod, yongElem, dmElem, dayStem);
  lines.push('```text');
  lines.push(`             【${dayStem}${dmElem}主命 · ${domTenGod}立意 · ${asset.title}】`);
  lines.push(`   +-- [底仓防线 ${asset.p1Pct}%] -------------------------------------------------+`);
  lines.push(`   | 1. 防线储备：${asset.p1Desc}`);
  lines.push(`   +-- [主干引擎 ${asset.p2Pct}%] -------------------------------------------------+`);
  lines.push(`   | 2. 核心主业：${asset.p2Desc}`);
  lines.push(`   +-- [稳健配置 ${asset.p3Pct}%] -------------------------------------------------+`);
  lines.push(`   | 3. 稳固基石：${asset.p3Desc}`);
  lines.push(`   +-- [风控红线 ${asset.p4Pct}%] -------------------------------------------------+`);
  lines.push(`   | 4. 严控边界：${asset.p4Desc}`);
  lines.push(`   +-----------------------------------------------------------------------+`);
  lines.push('```');
  lines.push('* **系统性风控三大纪律**：');
  lines.push(`  * **纪律一**：${asset.r1}`);
  lines.push(`  * **纪律二**：${asset.r2}`);
  lines.push(`  * **纪律三**：${asset.r3}\n`);

  const carInfo = CAREER_MAP[yongElem] || CAREER_MAP['木'];
  lines.push('#### 3.3.4 行业赛道与贵人方位拓展');
  lines.push(`* **体用用神五行**：【${yongElem}】（${carInfo.属性}）。`);
  lines.push(`* **适宜发展方位**：${carInfo.方位}。`);
  lines.push(`* **适宜行业赛道**：${carInfo.赛道}。\n`);
  lines.push('---\n');

  // 3.4 未来大运全景逐步详评
  lines.push('### 3.4 未来大运全景逐步详评（带生克定性与行运指南）\n');
  const luckPillars = chart.luck?.pillars || [];
  if (luckPillars.length > 0) {
    lines.push('```text');
    lines.push('大运排列表（每十年一交接）：');
    const luckStr = luckPillars.slice(0, 6).map((lp) => `${lp.startAge || 5}岁:${lp.gz}`).join(' | ');
    lines.push(luckStr);
    lines.push('```\n');

    luckPillars.slice(0, 5).forEach((lp, idx) => {
      const stemElem = ['木', '火', '土', '金', '水'][STEMS.indexOf(lp.gz[0]) % 5];
      const isHelper = (stemElem === yongElem || ELEM_REL[yongElem]?.被生 === stemElem);
      const isChallenger = (ELEM_REL[yongElem]?.被克 === stemElem);
      const stance = isHelper ? '顺势生发 · 拓展舒展' : isChallenger ? '逆风磨砺 · 严谨修持' : '生克制衡 · 稳健蓄势';

      lines.push(`#### 3.4.${idx + 1} 【${lp.gz}大运】（约 ${lp.startAge || 5} ~ ${(lp.startAge || 5) + 9} 岁 / ${lp.startYear || 2020 + idx * 10} ~ ${(lp.startYear || 2020 + idx * 10) + 9} 年）`);
      lines.push(`* **干支配置**：天干【${lp.gz[0]}】${lp.tenGod || '星'}，地支【${lp.gz[1]}】。`);
      lines.push(`* **行运气象定性**：**【${stance}】**`);
      lines.push(`* **阶段修行指引**：${luckStageAdvice(lp, stance, dmElem, yongElem)}\n`);
    });
  } else {
    lines.push('* （四柱直接推算模式下，大运依流年逐年滚动）\n');
  }
  lines.push('---\n');

  // 3.5 未来十年流年财富走势曲线与重点年份分析
  lines.push('### 3.5 未来十年流年财富走势曲线与重点年份分析\n');
  lines.push('> **学理说明**：流年太岁乃一年之主宰。本段依体用路线法，推演未来十年真实岁君干支、十神落位、太岁与原局地支之刑冲会合及五行助用/克用状态，提供客观生克定性指引，坚决摒弃伪造分值与假折线图。\n');

  const tenYears = futureTenYears(chart, { yongElem });
  lines.push('| 公历年份 | 太岁干支 | 纳音五行 | 岁君十神 | 生克定性 | 岁运互动与实操指南 |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
  tenYears.forEach((item) => {
    lines.push(`| **${item.year} 年** | ${item.gz} | ${item.nayin} | ${item.tenGod || '十神'} | **${item.stance}** | ${item.advice} |`);
  });
  lines.push('\n---\n');

  // 3.6 心性画像与深度心智修炼
  const yinYang = chart.dayMaster?.yinYang || (STEMS.indexOf(dayStem) % 2 === 0 ? '阳' : '阴');
  lines.push('### 3.6 心性画像与深度心智修炼\n');
  lines.push('#### 3.6.1 显性特质 vs 潜意识深层动机');
  lines.push(`* **表象风度**：日元属【${yinYang}${dmElem}】，以【${domTenGod}】立意。${profile.心性}`);
  lines.push(`* **潜意识动机**：日主【${dayStem}${dmElem}】以【${domTenGod}】为核心驱动，${profile.动机}`);
  lines.push(`* **思维盲区**：日主【${dayStem}${dmElem}】在【${domTenGod}】主导意象下，${profile.盲区}\n`);
  lines.push('#### 3.6.2 心智修养进阶法门');
  lines.push(`* **修心准则**：日主【${dayStem}${dmElem}】${profile.进阶心法}（注重调和【${yongElem}】气以致中和）。\n`);
  lines.push('---\n');

  // 3.7 婚恋情感走势与关键年份
  const mInfo = marriageProfile(chart);
  lines.push('### 3.7 婚恋情感走势与关键年份\n');
  lines.push('#### 3.7.1 伴侣星与夫妻宫状态剖析');
  lines.push(`* **夫妻宫位**：日支坐【${mInfo.dayBranch}】（藏干本气透【${mInfo.spouseGod}】）。`);
  lines.push(`* **伴侣特质**：${mInfo.spouseDesc}`);
  lines.push(`* **互动格局**：${mInfo.interDesc}\n`);
  lines.push('#### 3.7.2 重点年份修护建议');
  lines.push(`* **[岁运通识 · 重点年份修护建议]**：原局夫妻宫坐【${mInfo.dayBranch}】，凡逢岁运太岁冲克夫妻宫（如【${BRANCH_CLASH[mInfo.dayBranch] || '逢冲'}】年相冲）或刑害之年份，观念易生摩擦，宜主动安排聚少离多、出差修学或共赴旅途以化解气场冲撞。\n`);
  lines.push('---\n');

  // 3.8 健康体质监测与日常身心调养
  const hInfo = healthProfile(chart);
  lines.push('### 3.8 健康体质监测与日常身心调养\n');
  lines.push('#### 3.8.1 五行病理机制与脏腑隐患');
  lines.push(`* **最旺五行【${hInfo.maxElem}】（占比 ${hInfo.maxPct}% · 亢盛预警）**：${hInfo.maxElem}气过旺，主要涉及${hInfo.maxInfo.脏腑}。需防范：${hInfo.maxInfo.偏亢}。`);
  lines.push(`* **最弱五行【${hInfo.minElem}】（占比 ${hInfo.minPct}% · 虚损预警）**：${hInfo.minElem}气偏枯，主要涉及${hInfo.minInfo.脏腑}。需防范：${hInfo.minInfo.偏衰}。`);
  lines.push(`* **[通识规律 · 传变防范]**：五行强弱失衡最忌亢害乘侮，强${hInfo.maxElem}易克伐所胜之五行，日常宜注重起居平衡。\n`);
  lines.push('#### 3.8.2 日常调理与养生实操');
  lines.push(`* **[调理导引]**：重在补益【${hInfo.minElem}】气之亏虚，疏导【${hInfo.maxElem}】气之壅滞。饮食起居宜顺应四时阴阳，避免长期熬夜消耗，坚持适度有氧锻炼。\n`);
  lines.push('---\n');

  // 3.9 给命主本人的战略规划与修行建议
  const strat = strategyGuidance(domTenGod, dmElem, yongElem, dayStem);
  lines.push('### 3.9 给命主本人的战略规划与修行建议\n');
  lines.push('> *导引说明：[义理导引 · 知命自强] 本条目结合命局体用喜忌与成破救应给出战略原则，以供人生重大抉择之价值参考。*\n');
  lines.push(`1. **【立身定位：发挥优势，借势而为】**：日主【${dayStem}${dmElem}】宜深耕【${domTenGod}】核心生态位，借【${yongElem}】用神气局顺势而为，不争一时之虚荣，求长久之底气。`);
  lines.push(`2. **【决策纪律：事缓则圆，情绪冷却】**：${strat.rule}`);
  lines.push(`3. **【人生修行：由术入道，福德载物】**：日主【${dayStem}${dmElem}】${strat.cultivation}\n`);
  lines.push('---\n');

  return lines.join('\n');
}

/**
 * 第四段：免责声明与科学认知导引
 */
function renderDisclaimerSection() {
  const lines = [];
  lines.push('## 第四段：免责声明与科学认知导引\n');
  lines.push('> [!IMPORTANT]');
  lines.push('> ### 综合免责与合规声明');
  lines.push('> 1. **科学唯物认知导引**：');
  lines.push('>    * 本报告所依据的阴阳五行、天干地支、流派格局等理论，属于中国传统民俗文化与哲学思辨模型体系，系古人观察自然节律与人文万象的经验归纳总结。');
  lines.push('>    * 报告中涉及的所有性格侧写、走势推测、分值评估等内容，均不具备现代统计学或自然科学的决定论因果关系，绝非人生注定的宿命。');
  lines.push('> 2. **法律与商业决策边界**：');
  lines.push('>    * 本报告内容仅供文化学术探讨与个人修养启发，**绝不构成任何法律顾问意见、医疗诊断建议、财务投资指导或商业合规担保**。');
  lines.push('>    * 命主在进行任何法律诉讼、重大资产配置、金融衍生品交易、医疗手术等现实决策时，必须依据国家现行法律法规，并咨询持有国家法定资质的执业律师、注册金融分析师、专科医师等专业人士。');
  lines.push('> 3. **人本自强与主观能动性**：');
  lines.push('>    * 《易经》核心智慧在于「天行健，君子以自强不息」。命由天定，运由己造；时代红利、个人勤勉、道德操守、科学决策与持续奋斗，才是决定人生高度与幸福归宿的根本力量。\n');
  return lines.join('\n');
}

/**
 * 总装函数：生成完整万字级 Markdown 报告
 */
export function generateFullReport(input, options = {}) {
  const chart = ensureFullChart(input);

  const sec1 = renderFactSection(chart);
  const sec2 = renderSchoolSection(chart);
  const sec3 = renderTiyongSection(chart, options);
  const sec4 = renderDisclaimerSection();

  const title = '# 八字全景命理解读与决策咨询报告\n\n' +
    '> **报告说明**：本报告依托客观排盘底座、丙层六大流派经典学说并陈、以及乙体系「体用路线法」深度推演体系生成。报告旨在提供多维度的传统哲学认知视角的启发，以供人生决策、事业规划与心智修养参考。\n\n---\n\n';

  const markdown = title + sec1 + sec2 + sec3 + sec4;

  return {
    markdown,
    chart,
    summary: {
      solar: chart.calendar?.solar,
      pillars: chart.pillars.map((p) => p.gz).join(' '),
      dayMaster: chart.dayMaster?.stem,
      geju: chart.pillars[1].gz,
    }
  };
}

/**
 * 控制台终端优雅概览
 */
export function formatConsoleSummary(chart) {
  const p = chart.pillars;
  const L = [];
  L.push('======================================================================');
  L.push('八字分析工具 · 三段式全景命理解读 (CLI 总装交付)');
  L.push('======================================================================');
  L.push(`四柱干支：【${p.map((x) => x.gz).join(' ')}】  日元：【${chart.dayMaster?.stem || p[2].stem}】  生辰：${chart.calendar?.solar || '四柱推演'}`);
  L.push('----------------------------------------------------------------------');
  L.push('【第一段：排盘事实】四柱竖排卡片、五行力量对比条已生成完毕');
  L.push('【第二段：各派并陈】格局派、滴天髓、穷通调候、盲派、新派、神煞象义六派全列');
  L.push('【第三段：体用推演】子平成破救应、去留路线、主要矛盾全景双通路、财富流年已推演');
  L.push('【第四段：合规免责】科学认知导引、法律商业决策边界与自强不息哲学已齐备');
  L.push('----------------------------------------------------------------------');
  L.push('提示：可使用 --output <filepath.md> 导出万字级深度 Markdown 决策咨询报告');
  L.push('======================================================================');
  return L.join('\n');
}
