// 核心/report/section2_schools.mjs
// 第二段：丙层六大流派经典主张并陈 Markdown 装配器（六派+新派小节与附录，D-087 落地）

import {
  STEMS, STEM_ELEMENT, ELEMENTS, gzRelations, tiaohouAssessment,
  gzIndex, nayinOf
} from '../engine.mjs';
import {
  gejuChengPoOf
} from '../tiyong.mjs';
import {
  matchSchoolClaims
} from '../school-matcher.mjs';
import {
  getTenGod, calcTongYiDang, ELEM_REL
} from './common.mjs';


export const SHENSHA_CLASSICS = {
  '天乙贵人': {
    source: '《三命通会·论天乙贵人》',
    quote: '其神最尊贵，所至之处，一切凶煞隐然而避。',
    inquiry: '天乙贵人之遇难成祥与社会贤达庇护，如何转化为实业开拓中的信誉护城河？'
  },
  '太极贵人': {
    source: '《三命通会》神煞类目表',
    quote: '位班上列据权衡',
    inquiry: '太极贵人之哲思玄学天赋与深邃直觉，如何与现实专业技能深度融合？'
  },
  '天德贵人': {
    source: '《三命通会》神煞类目表',
    quote: '利物济人、掩凶作善……贵神在位，诸煞伏藏；二德扶持，众凶解散。',
    inquiry: '天德吉星之祥和仁厚，如何在剧烈商业博弈中保持底线并赢得长期信赖？'
  },
  '月德贵人': {
    source: '《三命通会》神煞类目表',
    quote: '利物济人、掩凶作善……贵神在位，诸煞伏藏；二德扶持，众凶解散。',
    inquiry: '月德吉神之阴阳调和之机，如何助力于人际合作与团队凝聚力？'
  },
  '华盖': {
    source: '《三命通会》神煞类目表',
    quote: '凡人命得华盖，多主孤寡，总贵亦不免孤独，作僧道艺术论',
    inquiry: '华盖孤高之超然独见与学术造诣，如何避免孤芳自赏并落地为现实影响力？'
  },
  '文昌贵人': {
    source: '《三命通会》神煞类目表',
    quote: '主文名、科第、荣达受封',
    inquiry: '文昌才思与深度文墨创作力，如何高效转化为时代前沿的知识产权壁垒？'
  },
  '学堂': {
    source: '《三命通会》神煞类目表',
    quote: '长生为学堂正位……学业精专，文章出类。',
    inquiry: '学堂吉宿之持续学习与认知迭代优势，如何在长周期职业生涯中发挥长板？'
  },
  '词馆': {
    source: '《三命通会》神煞类目表',
    quote: '学业精专，文章出类',
    inquiry: '词馆星宿之敏锐表达与舆论洞察力，如何为组织发声与品牌塑造赋能？'
  },
  '将星': {
    source: '《三命通会》神煞类目表',
    quote: '三合中位谓之将星……常欲吉星相扶，贵煞加临乃为吉庆。',
    inquiry: '将星掌权之领导决断魄力，如何在复杂多元利益格局中实现团队上下齐心？'
  },
  '驿马': {
    source: '《三命通会》神煞类目表',
    quote: '主迁官得禄、变动远行',
    inquiry: '驿马奔波之空间迁徙与跨界机遇，如何在快节奏动变中保持核心基本盘的定力？'
  },
  '金舆': {
    source: '《三命通会》神煞类目表',
    quote: '妇人逢之，不富即贵',
    inquiry: '金舆福星之优渥资粮与体面身段，如何转化为更富利他精神的社会担当？'
  },
  '禄神': {
    source: '《三命通会》神煞类目表',
    quote: '禄随旺行，所以甲禄寅，乙禄卯。',
    inquiry: '禄神建根之自力更生本领，如何在时代浪潮起伏中守住稳健现金流防线？'
  },
  '暗禄': {
    source: '《三命通会》神煞类目表',
    quote: '暗禄格，主贵',
    inquiry: '暗禄潜沉之隐形庇护与贵人机缘，如何在关键战略转折期审慎借力？'
  },
  '阳刃': {
    source: '《三命通会》神煞类目表',
    quote: '劫财阳刃，切忌时逢，岁运并临，灾殃立至',
    inquiry: '阳刃刚烈之破局霸气与坚毅心力，如何通过法制契约化暴戾为建设性执行力？'
  },
  '亡神': {
    source: '《三命通会》神煞类目表',
    quote: '亡神七煞祸非轻，用尽机关一不成',
    inquiry: '亡神机敏之深谋韬略，如何恪守正道原则以防聪明反被聪明误？'
  },
  '劫煞': {
    source: '《三命通会》神煞类目表',
    quote: '劫煞为灾不可当，徒然奔走名利场',
    inquiry: '劫煞勇悍之攻坚魄力，如何配合理性风控以防孤注一掷之险？'
  },
  '空亡': {
    source: '《三命通会》神煞类目表',
    quote: '如犯空亡，有他位来冲，亦为破祸成福。',
    inquiry: '空亡虚灵之超然物外感悟，如何沉淀为艺术哲思或新赛道的破局洞察？'
  }
};

export const GEJU_KNOWLEDGE = {
  '正官格': {
    name: '正官格',
    definition: '以月令地支所藏本气或当令正官星司权立格。五行阴阳异性相克为官（如甲见辛、乙见庚、丙见癸等），以其阴阳配合有情，制我而不害我，如严父良师约束身心，为天地之正气、五行至贵之吉神。',
    meaning: '性格上崇尚正统规矩、自律端方、责任担当极强、重视名誉与社会信用、处事稳健客观；社会象义上具备天然的体制亲和力与组织管理才干，追求正统功名、阶层晋升与制度框架内的长期建树。若官星纯粹无破，主品格高洁、居官得位、孚尹旁达。'
  },
  '七杀格': {
    name: '七杀格（偏官格）',
    definition: '以月令藏干本气或七杀当令司权立格。五行阴阳同性相克为杀（如甲见庚、乙见辛、丙见壬等）。同性相克，其势暴烈残酷，如敌国强寇逼身，故称“七杀”。虽为凶神，然克伐有力，若制化得宜，反成大将权柄。',
    meaning: '性格刚毅果决、危机意识极强、敢于冒险突破、抗压攻坚、具备非凡的生存本能与破局手腕；人生追求不甘平庸，善于在动荡混乱或高风险竞争中杀伐决断、建立功业；适合开疆拓土、司法军警、危机公关或创业竞争。杀旺有制为大贵之造。'
  },
  '正印格': {
    name: '正印格',
    definition: '以月令正印当令司权立格。阴阳异性生我者为正印（如甲见癸、乙见壬等），天地慈爱之象，如母育子，官刑不犯，神明庇佑，为纯粹善神。',
    meaning: '性格仁慈善良、宽厚包容、重视精神学识与资质信誉、清高自律；适合依托深厚学问、学术声誉、专业资质、文化教育或组织授权立身立命，财富绵长稳定。'
  },
  '偏印格': {
    name: '偏印格（枭神格）',
    definition: '以月令偏印当令司权立格。同性相生（如甲见壬、乙见癸等），又名枭神。生我而带疏离冷峻之气。',
    meaning: '性格敏锐精微、直觉极强、洞察深刻、偏好独门绝技或前沿探索；善于在复杂冷门领域精研深耕，一鸣惊人。'
  },
  '正财格': {
    name: '正财格',
    definition: '以月令正财当令司权立格。我克者为财，阴阳异性配合有情（如甲见己、乙见戊等），为养命之源，勤劳致富之象。',
    meaning: '性格务实严谨、注重稳健收益与契约精神、勤勉节制、步步为营；善于商业精细化管理与实体资产积累，信誉卓著。'
  },
  '偏财格': {
    name: '偏财格',
    definition: '以月令偏财当令司权立格。我克者同性相见（如甲见戊、乙见己等），众人之财、天下之财，流动运转之象。',
    meaning: '性格豪迈豁达、商业嗅觉敏锐、善于调动社会资本与抓取大机遇、慷慨重义；善于跨界整合、金融资本运作与规模化布局。'
  },
  '食神格': {
    name: '食神格',
    definition: '以月令食神当令司权立格。我生者同性相见（如甲见丙、乙见丁等），天厨之星、福寿之神。',
    meaning: '性格冲和温厚、谦逊包容、追求生活品质与精神从容；善于专业技术研发、文化创意与优雅生财，福泽绵长。'
  },
  '伤官格': {
    name: '伤官格',
    definition: '以月令伤官当令司权立格。我生者异性相见（如甲见丁、乙见丙等），才华英华尽情发露，因克制官星故名伤官。',
    meaning: '聪明绝顶、求新求变、突破传统、傲骨嶙峋；极具开创精神与变革魄力，配印则贵、生财则富。'
  },
  '建禄格': {
    name: '建禄格',
    definition: '月令日干得禄（如甲生寅月、乙生卯月等），月令比肩当权，日元根深蒂固，精气饱满。',
    meaning: '性格自信刚毅、自立自强、不依附他人、具有强烈的自主创业与奋斗精神；喜天干透财官，白手起家创大业。'
  },
  '阳刃格': {
    name: '阳刃格（月刃格）',
    definition: '阳干生于旺地（如甲生卯月、庚生酉月等），阳刚之极、杀戮之气，为极旺之神。',
    meaning: '性格刚猛无匹、坚韧不屈、极具决断魄力；最喜七杀驾刃，成大将帅才，威震边疆。'
  },
  '从杀格': {
    name: '从杀格（从官杀格）',
    definition: '日干衰弱无气，局中毫无微根印比生扶，满盘官杀星乘旺司权。日主不得不顺从官杀至刚克伐之势，弃命从杀，以杀为尊。',
    meaning: '性格极具隐忍自持与时势洞察力，不计个人私利而顺从时代或体制巨浪；善于依附强大权威平台迅速崛起，抗压与危机处理手腕极其冷酷果断，成就封疆裂土之大富大贵。'
  },
  '从财格': {
    name: '从财格',
    definition: '日主衰绝无根，局中无一点印绶比劫生扶，满盘正偏财星乘令或结党成势，气势偏聚于财。日主弃命顺从财星之旺气。',
    meaning: '性格极具商业敏感度与现实审势能力，为人圆融机变、不拘泥教条；善于随顺市场大势与资本流动，拥有极其广博的商业资源调配魄力，富甲天下。'
  },
  '从儿格': {
    name: '从儿格（从食伤格）',
    definition: '日主衰弱无根或仅余微根，满局食神伤官成党成局，秀气极度宣泄；局中无印星克食伤，见财星顺泄秀气，成“我儿又见儿”之大顺生格局。',
    meaning: '才智天纵、敏锐灵动、极具前瞻性与艺术独创性；不从世俗规矩，追求精神探索与自我实现之极致，凭不可替代的技艺成果或开创性发明惊艳时代。'
  },
  '从势格': {
    name: '从势格',
    definition: '日干衰竭无依，局中食伤、财星、官杀三者并旺均停，日主无所专从，顺从三者相生相克之复合气势；局中必须以财星为通关和解枢纽，食伤生财、财生官杀，顺行流通。',
    meaning: '情商与适应力极高、长袖善舞、极善于多方博弈与利益平衡；能在极其复杂的职场或商业生态中左右逢源，化解各方矛盾，成为各大势力的核心纽带操盘手。'
  },
  '曲直格': {
    name: '曲直格（曲直仁寿格）',
    definition: '甲乙木日主生于春月（寅卯辰），地支全亥卯未木局或寅卯辰东方一气，局中绝无庚辛申酉金气破木，木气纯粹冲霄，为一行得气专旺之贵格。',
    meaning: '心性质朴仁慈、博爱大度、德行高洁、富有君子长者之风；具备强大的精神号召力与思想感染力，立德树人、长寿安泰，为社会道德或文化领域领袖。'
  },
  '炎上格': {
    name: '炎上格',
    definition: '丙丁火日主生于夏令（巳午未），地支全寅午戌火局或巳午未南方一气，无壬癸亥子水气伤克，局中火势炽烈升腾、纯粹光明，为火之一行得气专旺格。',
    meaning: '心性热情开朗、磊落光明、崇尚文明礼法、极富前瞻远见与感染力；适合科技前沿、文化传媒、数字光电或聚光灯下的布道开拓，名满天下。'
  },
  '稼穑格': {
    name: '稼穑格',
    definition: '戊己土日主生于四季月（辰戌丑未），地支纯土无木克破，土气凝重浑厚、气象万千，为土之一行得气专旺大格。',
    meaning: '心性诚信宽厚、容纳万物、稳重如山、信誉卓著；深谙财富与实体资管运营之道，善于构筑坚不可摧的长期基业，基业长青。'
  },
  '从革格': {
    name: '从革格',
    definition: '庚辛金日主生于秋月（申酉戌），地支全巳酉丑金局或申酉戌西方一气，局无丙丁巳午烈火熔金，金气刚锐纯粹、坚硬无比，为金之一行得气专旺大格。',
    meaning: '心性刚直果断、义字当头、临事能断、纪律严明；精通风控法制、精密制造或硬核攻坚，铁面无私、令行禁止，为制度执行与攻坚重臣。'
  },
  '润下格': {
    name: '润下格',
    definition: '壬癸水日主生于冬月（亥子丑），地支全申子辰水局或亥子丑北方一气，无戊己辰戌丑未厚土浑浊水质，水势汪洋浩荡、奔流不息，为水之一行得气专旺格。',
    meaning: '心性渊深智谋、胸襟如海、机变无穷、善于融通变通；擅长跨界创新、国际贸易、信息资本流通，顺势而为，达则兼济天下。'
  }
};

export function detectChartMajorConfigurations(chart) {
  const p = chart.pillars || [];
  if (!p || p.length < 4) return [];
  const dayStem = p[2]?.stem || chart.dayMaster?.stem || '';
  const stems = p.map((x) => x.stem);
  const branches = p.map((x) => x.branch);
  const tgs = stems.map((s) => getTenGod(dayStem, s));
  const rels = gzRelations(p);
  const strength = chart.strength || {};
  const pct = strength.percent || {};

  // 提取四柱地支藏干
  // 年柱(0): 宾位客位; 月柱(1): 宾位提纲; 日柱(2): 主位配偶宫/自坐; 时柱(3): 主位门户归宿
  const branchMainTgs = p.map((item) => item.hidden?.[0]?.tenGod || '');

  const configs = [];

  // 1. 阳刃驾杀局（杀刃双全）
  const isYangMaster = ['甲', '丙', '戊', '庚', '壬'].includes(dayStem);
  const yangRenBranch = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' }[dayStem];
  const hasYangRen = yangRenBranch && branches.includes(yangRenBranch);
  const hasQiSha = tgs.includes('七杀') || branchMainTgs.includes('七杀');
  if (isYangMaster && hasYangRen && hasQiSha) {
    configs.push({
      name: '阳刃驾杀局',
      badge: '威权赫奕 · 将帅折冲之局',
      weight: 100,
      whatIs: '阳日干刚健勇烈，逢月令或坐下阳刃（帝旺极盛之神），又见天干透出【七杀】暴烈克制。以极旺之刃御暴烈之煞，宝刀配将星，杀刃双全，相互钳制、相辅相成，化暴虐为统帅群伦之赫赫威权。',
      meaning: '性格刚猛沉雄、意志如铁、临危不乱、具非凡统帅力与抗压魄力；不惧惊涛骇浪，善于在危难破产、法制重典、军警刑宪或高难度行业竞争中冲锋陷阵、力挽狂澜，成统领千军之将帅帅才。',
      classics: [
        {
          source: '《渊海子平·论阳刃》',
          quote: '杀无刃不显，刃无杀不威'
        }
      ]
    });
  }

  // 2. 伤官合杀局
  const shangHeSha = (rels['天干五合'] || []).some((c) => {
    const pairStr = c.pair || '';
    const m = pairStr.match(/([年月日時大运])([甲乙丙丁戊己庚辛壬癸])\s*—\s*([年月日時大运])([甲乙丙丁戊己庚辛壬癸])/);
    if (!m) return false;
    const tg1 = getTenGod(dayStem, m[2]);
    const tg2 = getTenGod(dayStem, m[4]);
    return (tg1 === '伤官' && tg2 === '七杀') || (tg1 === '七杀' && tg2 === '伤官');
  });
  if (shangHeSha) {
    configs.push({
      name: '伤官合杀局',
      badge: '以柔克刚 · 巧智取权之局',
      weight: 95,
      whatIs: '日主之【伤官】（才华英华、机谋应变、公关交涉）与外部【七杀】（强权权威、竞争对手、制度险阻）在天干作五合。不同于食神之刚猛硬制，伤官以情合之、以计诱之，去杀之暴烈、去伤之傲气，合干戈为玉帛，合煞为权。',
      meaning: '极具公关斡旋与资源统合智慧，善于借力打力、化敌为友；不走寻常路，能把最大的对手转化为最强的合伙盟友，在复杂博弈、外交磋商、商业并购与制度夹缝中游刃有余，属于典型的“巧智取权、化煞为柄”之上乘大格局。'
    });
  }

  // 3. 食神制杀局
  const hasShiShen = tgs.includes('食神');
  const hasQiShaStem = tgs.includes('七杀');
  const shiZhiShaKe = (rels['天干相克'] || []).some((c) => {
    const pairStr = c.pair || '';
    const m = pairStr.match(/([年月日時大运])([甲乙丙丁戊己庚辛壬癸])\s*克\s*([年月日時大运])([甲乙丙丁戊己庚辛壬癸])/);
    if (!m) return false;
    const tg1 = getTenGod(dayStem, m[2]);
    const tg2 = getTenGod(dayStem, m[4]);
    return tg1 === '食神' && tg2 === '七杀';
  });
  if ((hasShiShen && hasQiShaStem) || shiZhiShaKe) {
    configs.push({
      name: '食神制杀局',
      badge: '以智驭暴 · 化煞为权之局',
      weight: 90,
      whatIs: '日主以我生之【食神】（才华智慧、专业技艺、沉着谋略），正面克制威胁自身之暴烈【七杀】（权威敌手、高压危机、制度险阻）。食神为福寿文雅之善神，七杀为凶猛刚烈之暴客；以智御暴、以柔克刚，凶神低头受制，暴烈之气化为命主掌中之威权。',
      meaning: '性格上临危不乱、谋略深沉、擅长以四两拨千斤之智慧化解千钧一发之危机；面对外部高压竞争具有极强的战术攻坚与竞争博弈手腕，不惧艰险强敌，适合危机公关处置、尖端技术攻关、企业法务谈判、战略开拓帅才。古诀云「杀无制则伤身，杀有制则化权」，杀旺食强往往成就力压群雄、挽狂澜于既倒之功业。',
      classics: [
        {
          source: '《三命通会·论食神》',
          quote: '食神制煞，逢枭不贫则夭。'
        }
      ]
    });
  }

  // 4. 伤官合制官星局（制官得官）
  const hexCombines = rels['地支六合'] || [];
  const xingList = rels['地支相刑'] || [];
  const poList = rels['地支相破'] || [];

  const checkShangZhiGuan = () => {
    const hostIndices = [2, 3];
    for (const hIdx of hostIndices) {
      const hostBranch = p[hIdx].branch;
      const monthBranch = p[1].branch;
      const hostHasShang = (p[hIdx].hidden || []).some((h) => h.tenGod === '伤官');
      const monthHasGuan = (p[1].hidden || []).some((h) => h.tenGod === '正官');

      if (hostHasShang && monthHasGuan) {
        const isHex = hexCombines.some((c) => c.pair.includes(hostBranch) && c.pair.includes(monthBranch));
        const isXing = xingList.some((c) => (c.members || '').includes(hostBranch + monthBranch) || (c.members || '').includes(monthBranch + hostBranch));
        const isPo = poList.some((c) => c.pair.includes(hostBranch) && c.pair.includes(monthBranch));
        if (isHex || isXing || isPo) return true;
      }
    }
    return false;
  };

  if (checkShangZhiGuan()) {
    configs.push({
      name: '伤官合制官星局（制官得官）',
      badge: '以技御法 · 夺权立威之局',
      weight: 88,
      whatIs: '主位（日支配偶宫或时支门户）之【伤官】旺相，直接合制、刑制月令提纲宾位之【正官】。在盲派命理与子平象法中，伤官为自身卓越技艺与破坏性开创力，月令官星为体制权力与公共资产；主位伤官合制月令官星，火金相炼（或木土相制、水火相济），成“制官得官、合官得权”之功。',
      meaning: '具有强烈的反权威精神与高维度的专业掌控力；不甘于循规蹈矩接受官僚管束，而是凭借自身不可替代的硬核业务才能与技术壁垒，凌驾于条条框框之上，直接将体制内平台、公共牌照与行业资源揽入自身麾下，功大层次高。'
    });
  }

  // 5. 杀印相生局
  const hasYin = tgs.includes('正印') || tgs.includes('偏印') || branchMainTgs.includes('正印') || branchMainTgs.includes('偏印');
  if (hasQiSha && hasYin && !configs.some((x) => x.name === '阳刃驾杀局')) {
    configs.push({
      name: '杀印相生局',
      badge: '化煞为印 · 贵德自持之局',
      weight: 85,
      whatIs: '日主以【印星】（正印或偏印）引通化解【七杀】之暴烈克伐之气。杀生印、印生身，转凶煞为祥和瑞气，不制而化，以仁德学问与正统授权涵养威权，化敌为友。',
      meaning: '性格沉稳大气、重德行声誉、深孚众望；善于以博大学识、崇高胸襟与卓越的制度合法性化解外部敌意与险阻挑战，文武兼资、名利双全，居官显赫而无凶祸。',
      classics: [
        {
          source: '《子平真诠·论偏官》',
          quote: '煞用印绶，不利财乡，伤官为美，印绶身旺俱为福地。'
        }
      ]
    });
  }

  // 6. 官印相生局
  const hasGuan = tgs.includes('正官') || branchMainTgs.includes('正官');
  const hasZhengYin = tgs.includes('正印') || branchMainTgs.includes('正印');
  if (hasGuan && hasZhengYin && !tgs.includes('七杀')) {
    configs.push({
      name: '官印相生局',
      badge: '正气纯粹 · 显贵清华之局',
      weight: 82,
      whatIs: '天地正气之【正官】与慈爱生身之【正印】相辅相成。官能生印、印能护官，官印两清，清气灌顶，无刑冲破害侵蚀，乃子平正格中最稳固端方之上乘大格局。',
      meaning: '性格端方严谨、品行高洁、恪守法度、深具公信力与体制归属感；具备天然的管理才能与学者风范，在主流组织、大型企事业单位或政府平台中按部就班、青云直上。'
    });
  }

  // 7. 伤官佩印局
  const hasShang = tgs.includes('伤官');
  const hasCai = tgs.includes('正财') || tgs.includes('偏财');
  if (hasShang && hasYin && !shangHeSha) {
    configs.push({
      name: '伤官佩印局',
      badge: '才华敛抑 · 清贵文章之局',
      weight: 80,
      whatIs: '伤官英华发露，聪明绝顶而行事任性傲物，泄日元之气太过；赖【正印/偏印】贴身生身制伤，如烈马得辔、宝剑入鞘。才华受到德行与理性的淬炼，敛抑浮躁，文质彬彬。',
      meaning: '才高八斗、治学严谨、兼具敏锐洞察与沉着理性；善于在尖端科研、学术著述、文化艺术、高级战略规划等领域取得崇高成就，才华名扬海内而深具学者清贵之风。',
      classics: [
        {
          source: '《渊海子平·伤官》',
          quote: '伤官用印宜去财'
        }
      ]
    });
  }

  // 8. 食伤生财局
  if ((hasShiShen || hasShang) && hasCai) {
    configs.push({
      name: '食伤生财局',
      badge: '财气通门 · 技艺变现之局',
      weight: 75,
      whatIs: '日主以食神伤官之聪明才智、专业技艺与创新成果为源泉，顺势生助正偏财星。食伤为水源，财星为深潭，水流通畅，形成源源不断之盈利闭环，即古人所谓「财气通门户」。',
      meaning: '商业洞察极其灵敏、极具实战变现才能与产品思维；凭借核心技术、自营品牌或商业模式打通财富链路，善于调动社会资源创造增量价值，白手起家成就丰厚家业。'
    });
  }

  // 9. 财旺生官局
  if (hasCai && hasGuan && !tgs.includes('伤官')) {
    configs.push({
      name: '财旺生官局',
      badge: '资通权门 · 富贵双全之局',
      weight: 72,
      whatIs: '财为官之源泉根基，财旺自然生官。财星充沛以奠定现实基业，正官尊贵以光大门楣名望；以财富资助名望，以名望守护资产，富贵相济，阶层跃迁之坦途。',
      meaning: '兼具敏锐的商业头脑与正统的组织影响力；擅长以资本与资源撬动更高的平台特许与社会声望，擅长合规治理与政商合作，实现义利双收之宏伟格局。',
      classics: [
        {
          source: '《三命通会·论财》',
          quote: '财旺生官，富而且贵'
        }
      ]
    });
  }

  // 10. 真官真禄局（禄官双全）
  const luBranch = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }[dayStem];
  const hasLu = luBranch && branches.includes(luBranch);
  if (hasLu && hasGuan && !tgs.includes('伤官')) {
    configs.push({
      name: '真官真禄局',
      badge: '基石稳固 · 禄位崇隆之局',
      weight: 70,
      whatIs: '日主地支得日干之正禄（临官本气），气血充足、根本坚固；天干透出正官，清纯端正。身旺能胜官，官清能护禄，禄官相得益彰，基业极为扎实。',
      meaning: '性格脚踏实地、极富稳健担当与实干本色；既有深厚自立自强的专业根基，又能承载国家体制或大型集团之公权信任，步步登高，福寿绵长。'
    });
  }

  // 11. 木火通明局
  const isWoodMaster = ['甲', '乙'].includes(dayStem);
  const woodFirePct = (pct['木'] || 0) + (pct['火'] || 0);
  const metalPct = pct['金'] || 0;
  if (isWoodMaster && woodFirePct >= 50 && metalPct <= 15 && !tgs.includes('七杀') && !tgs.includes('正官')) {
    configs.push({
      name: '木火通明局',
      badge: '文明焕发 · 锦绣文章之局',
      weight: 68,
      whatIs: '甲乙木生于春夏之令，得火以泄秀发荣。木为春之仁德，火为夏之文明；木火相生，如草木逢春华发，如薪助火，满盘文明清秀之气，绝无金水浊局。',
      meaning: '才华横溢、思想旷达、富有浪漫主义与人文关怀；在文化传播、理论建构、艺术创作或科技布道领域具有非凡的感染力与美誉度，文章盖世、声誉卓著。'
    });
  }

  // 12. 金白水清局
  const isMetalMaster = ['庚', '辛'].includes(dayStem);
  const metalWaterPct = (pct['金'] || 0) + (pct['水'] || 0);
  const earthPct = pct['土'] || 0;
  if (isMetalMaster && metalWaterPct >= 50 && earthPct <= 15 && !tgs.includes('七杀') && !tgs.includes('正官')) {
    configs.push({
      name: '金白水清局',
      badge: '澄澈灵透 · 旷世神明之局',
      weight: 68,
      whatIs: '庚辛金生于秋冬清寒之令，见壬癸水秀气引通，无厚土混淆水质，无烈火焦烁金性。金主义而坚毅，水主智而灵透；金水澄澈汪洋，冰清玉洁。',
      meaning: '心思极其细腻缜密、智商超群、逻辑思维极为严谨；擅长精密算法、数理模型、司法逻辑与高阶战略研判，才智超迈绝伦，人格风清骨峻。'
    });
  }

  // 13. 贪合忘克局
  const isTanHe = (rels['天干五合'] || []).some((c) => {
    const pairStr = c.pair || '';
    const m = pairStr.match(/([年月日時大运])([甲乙丙丁戊己庚辛壬癸])\s*—\s*([年月日時大运])([甲乙丙丁戊己庚辛壬癸])/);
    if (!m) return false;
    const tg1 = getTenGod(dayStem, m[2]);
    const tg2 = getTenGod(dayStem, m[4]);
    return ['七杀', '伤官', '劫财'].includes(tg1) || ['七杀', '伤官', '劫财'].includes(tg2);
  });
  if (isTanHe && !shangHeSha) {
    configs.push({
      name: '贪合忘克局',
      badge: '合化干戈 · 祥和释难之局',
      weight: 65,
      whatIs: '局中本有金木交战、水火相射之生克烈性，因天干地支相合牵绊，凶暴克伐之神留恋合情而忘却克伐。五行化戾气为祥和，解杀伐于谈笑之间。',
      meaning: '极具柔韧圆融的人际智慧与危机公关手腕；善于通过利益捆绑、情感沟通与战略结盟化解尖锐对立，化干戈为玉帛，在复杂局势中游刃有余。'
    });
  }

  // 14. 枭神夺食局
  const hasPianYin = tgs.includes('偏印');
  const xiaoDuoShi = (rels['天干相克'] || []).some((c) => {
    const pairStr = c.pair || '';
    const m = pairStr.match(/([年月日時大运])([甲乙丙丁戊己庚辛壬癸])\s*克\s*([年月日時大运])([甲乙丙丁戊己庚辛壬癸])/);
    if (!m) return false;
    const tg1 = getTenGod(dayStem, m[2]);
    const tg2 = getTenGod(dayStem, m[4]);
    return tg1 === '偏印' && tg2 === '食神';
  });
  if (hasPianYin && hasShiShen && xiaoDuoShi && !hasCai) {
    configs.push({
      name: '枭神夺食局',
      badge: '警示之象 · 才华受抑与内耗之局',
      weight: 60,
      whatIs: '食神为天厨福寿之神，偏印（枭神）同透紧贴相克，局无财星制枭护食。枭神夺食，福禄受阻，才华发露之际易遭突发打压或心理内耗。',
      meaning: '心思精微敏感、多思多虑，但偶有疑神疑鬼、临门退缩之弊；在事业推进中须防劳动成果被人截胡或合同节外生枝，宜注重心理调适与契约防线。'
    });
  }

  // 15. 比劫夺财局
  const biJieCount = tgs.filter((tg) => tg === '比肩' || tg === '劫财').length;
  if (hasCai && biJieCount >= 2 && !hasGuan && !hasQiSha) {
    configs.push({
      name: '比劫夺财局',
      badge: '警示之象 · 群贤竞逐与分润之局',
      weight: 60,
      whatIs: '财为养命之源，比肩劫财为同侪竞逐之客。财星孤透天干，而比劫结党成群，又无官杀严加看护，财星被分夺剥蚀，财源易生争夺分润。',
      meaning: '为人热忱仗义、慷慨好施，但在商业合伙与资产管理中边界模糊；必须建立健全现代合伙契约机制，严防碍于情面违规担保借贷，以制度守护资产安全。'
    });
  }

  // 16. 井栏斜叉局（井栏叉格）
  const hasShen = branches.includes('申');
  const hasZi = branches.includes('子');
  const hasChen = branches.includes('辰');
  const hasWaterSanHe = (hasShen && hasZi && hasChen) || (rels['地支三合'] || []).some((r) => r['局'] === '水');
  const hasFireClash = stems.includes('丙') || stems.includes('丁') || branches.includes('午');
  if (dayStem === '庚' && hasWaterSanHe && !hasFireClash) {
    configs.push({
      name: '井栏斜叉局（井栏叉）',
      badge: '暗冲天门 · 汪洋聚贵之局',
      weight: 92,
      whatIs: '庚日生人，地支申子辰三合水局全。庚以丁火为官星，局中绝无丙丁午火显露羁绊；申子辰纯阳水气磅礴，暗冲南方午火（子午相冲），冲动午中丁火官星、己土印绶。庚金暗中坐享官印福泽，名曰「井栏斜叉格」。',
      meaning: '行事机敏灵动、不走寻常路、深具出其不意之战略眼光；不求虚名浮利，擅长在水面之下整合庞大势能，以隐蔽布局在关键时刻破局突围，属于大智若愚、暗度陈仓成就大事业之雄才。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '庚遇申子辰，乃井栏叉，又谓之入局，忌丙丁、愁巳午'
        }
      ]
    });
  }

  // 17. 飞天禄马局
  const ziCount = branches.filter((b) => b === '子').length;
  const haiCount = branches.filter((b) => b === '亥').length;
  const isGengRenZi = (
    (dayStem === '庚' && ziCount >= 2 && !branches.includes('丑') && !branches.includes('午') && !branches.includes('巳') && !stems.includes('丙') && !stems.includes('丁')) ||
    (dayStem === '壬' && ziCount >= 2 && !branches.includes('丑') && !branches.includes('午') && !stems.includes('戊') && !stems.includes('己') && !branches.includes('戌') && !branches.includes('未'))
  );
  const isXinGuiHai = (
    (dayStem === '辛' && haiCount >= 2 && !branches.includes('寅') && !branches.includes('巳') && !branches.includes('午') && !stems.includes('丙') && !stems.includes('丁')) ||
    (dayStem === '癸' && haiCount >= 2 && !branches.includes('寅') && !branches.includes('巳') && !stems.includes('戊') && !stems.includes('己') && !branches.includes('辰') && !branches.includes('戌') && !branches.includes('未'))
  );
  if (isGengRenZi || isXinGuiHai) {
    configs.push({
      name: '飞天禄马局',
      badge: '绝处凌虚 · 倒冲紫微之局',
      weight: 92,
      whatIs: isGengRenZi
        ? '庚壬日生人地支子字重聚，局中绝无官星与合绊羁绊。子水结党，气势凌虚，暗冲南方对宫午火（子冲午），倒拔午中丁己官星禄马，无中生有，故名「飞天禄马」。'
        : '辛癸日生人地支亥字重聚，局中绝无官星与合绊羁绊。亥水结党，气势浩大，暗冲南方对宫巳火（亥冲巳），倒拔巳中丙戊官星禄马，凭虚引贵，故名「飞天禄马」。',
      meaning: '具有极强的爆发力、破局魄力与逆商；往往在看似毫无依靠、没有体制现成背景的情况下，凭借自身极致的坚守与暗中借势，异军突起、横空出世，平地起风雷。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '内有正倒禄飞，忌官星，亦嫌羁绊'
        }
      ]
    });
  }

  // 18. 壬骑龙背局
  const isRenChenDay = p[2]?.gz === '壬辰';
  const chenCount = branches.filter((b) => b === '辰').length;
  const xuCount = branches.filter((b) => b === '戌').length;
  if (isRenChenDay && chenCount >= 2 && xuCount < chenCount) {
    configs.push({
      name: '壬骑龙背局',
      badge: '驭龙乘风 · 纵横开阖之局',
      weight: 90,
      whatIs: '壬辰日柱，辰为龙宿草泽。原局地支辰字重见，局无重戌填实；群龙奔腾，暗冲对宫戌土（辰多冲戌），冲开戌库中丁火正财、戊土七杀与辛金正印。财官印绶齐出，为命主所乘，威权赫奕。',
      meaning: '胸怀丘壑、志存高远、器局宏伟；具有极高的大局统御与复杂局势驾驭能力，敢于涉险博弈，行事开阖自如，能在时代风口乘风破浪，成统摄一方之巨擘。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '阳水叠逢辰位，是壬骑龙背之乡。'
        }
      ]
    });
  }

  // 19. 六乙鼠贵局
  const isLiuYiShuGui = dayStem === '乙' && p[3]?.gz === '丙子' && !branches.includes('午') && !branches.includes('丑') && !stems.includes('庚') && !stems.includes('辛') && !branches.includes('申') && !branches.includes('酉');
  if (isLiuYiShuGui) {
    configs.push({
      name: '六乙鼠贵局',
      badge: '虚灵引贵 · 芝兰玉树之局',
      weight: 88,
      whatIs: '乙木日干生于丙子时。乙以庚金为正官，子位暗合巳火（子巳暗合），巳中丙戊引动申中庚金官星，申为乙木官星与天乙贵人，辗转暗合而生官。局中不见庚辛官杀填实，不见午冲丑绊，清贵非常。',
      meaning: '温润如玉、谈吐文雅、清奇脱俗；深孚人望，行事低调谦逊却总能获贵人长辈暗中提携青睐，文质彬彬，享有极高的社会清誉与崇高学识地位。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '阴木独遇子时，为六乙鼠贵之地。'
        }
      ]
    });
  }

  // 20. 六阴朝阳局
  const isLiuYinChaoYang = dayStem === '辛' && p[3]?.gz === '戊子' && !stems.includes('丙') && !stems.includes('丁') && !branches.includes('巳') && !branches.includes('午') && !branches.includes('未');
  if (isLiuYinChaoYang) {
    configs.push({
      name: '六阴朝阳局',
      badge: '金白朝阳 · 丹墀折桂之局',
      weight: 88,
      whatIs: '辛金日干生于戊子时。辛为阴金，子为纯阴之水；辛以丙火为正官，子中癸水暗合巳中戊土，巳中丙火动而照临辛金，朝向旭日阳和之气，故称「六阴朝阳」。局无火星官煞填实，纯阴引阳，官自天降。',
      meaning: '心性质朴高洁、持身清白、学贯天人；具有极强的学术悟性与组织协调才智，善于在幕后规划运筹，终能厚积薄发、一鸣惊人，名列前茅。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '六辛日逢戊子，嫌午未位，运喜西方。'
        }
      ]
    });
  }

  // 21. 子遥巳格
  const isZiYaoSi = dayStem === '甲' && p[2]?.branch === '子' && (p[3]?.gz === '甲子' || ziCount >= 2) && !stems.includes('庚') && !stems.includes('辛') && !branches.includes('申') && !branches.includes('酉') && !branches.includes('午') && !branches.includes('丑');
  if (isZiYaoSi && !isLiuYiShuGui) {
    configs.push({
      name: '子遥巳格',
      badge: '凌空遥摄 · 智谋远引之局',
      weight: 86,
      whatIs: '甲子日生甲子时（或地支重重见子），局中不见官星。甲以辛金为官，以重子暗中遥合对宫巳火，巳中丙戊引动申中庚金，转生官贵。无中生有、凭虚凌空，名曰「子遥巳格」。',
      meaning: '思维具有极强的远见卓识与跨界穿透力；善于跳出本位格局进行高维布局，运筹帷幄之中，决胜千里之外，成无形中操盘大局之幕后战略大师。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '甲子日再逢子时，畏庚辛申酉丑午。'
        }
      ]
    });
  }

  // 22. 丑遥巳格
  const chouCount = branches.filter((b) => b === '丑').length;
  const isChouYaoSi = ['辛', '癸'].includes(dayStem) && p[2]?.branch === '丑' && chouCount >= 2 && !stems.includes('丙') && !stems.includes('丁') && !branches.includes('巳') && !branches.includes('午') && !branches.includes('未') && !branches.includes('子');
  if (isChouYaoSi) {
    configs.push({
      name: '丑遥巳格',
      badge: '暗蓄厚德 · 水到渠成之局',
      weight: 86,
      whatIs: '辛丑、癸丑日生人，地支丑字重见。辛癸以丙戊为官星，局中不见官星与刑冲合绊，重丑合聚，暗遥合巳火（丑巳暗拱暗合），引来巳中丙戊金神官印之气，名曰「丑遥巳格」。',
      meaning: '为人沉潜笃实、厚重坚毅、极具战略定力；不喜浮夸张扬，善于在静默中蓄积深厚资本与技术底蕴，水到渠成之际平地登临高位。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '辛癸日多逢丑地，不喜官星；岁时逢子巳二宫，虚名虚利。'
        }
      ]
    });
  }

  // 23. 虚拱禄贵局（拱禄拱贵）
  const gzList = p.map((item) => item.gz);
  const checkGongLuGui = () => {
    // 拱禄
    if (gzList.includes('癸亥') && gzList.includes('癸丑') && !branches.includes('子')) return { type: '拱禄', note: '癸亥见癸丑虚拱【子】禄' };
    if (gzList.includes('丁巳') && gzList.includes('丁未') && !branches.includes('午')) return { type: '拱禄', note: '丁巳见丁未虚拱【午】禄' };
    if (gzList.includes('己未') && gzList.includes('己巳') && !branches.includes('午')) return { type: '拱禄', note: '己未见己巳虚拱【午】禄' };
    // 拱贵
    if (gzList.includes('甲寅') && gzList.includes('甲子') && !branches.includes('丑')) return { type: '拱贵', note: '甲寅见甲子虚拱【丑】天乙贵人' };
    if (gzList.includes('戊申') && gzList.includes('戊午') && !branches.includes('未')) return { type: '拱贵', note: '戊申见戊午虚拱【未】天乙贵人' };
    if (gzList.includes('辛丑') && gzList.includes('辛卯') && !branches.includes('寅')) return { type: '拱贵', note: '辛丑见辛卯虚拱【寅】天乙贵人' };
    return null;
  };
  const gongInfo = checkGongLuGui();
  if (gongInfo) {
    configs.push({
      name: '虚拱禄贵局',
      badge: '虚灵夹拱 · 藏锋守拙之局',
      weight: 88,
      whatIs: `四柱干支相夹，${gongInfo.note}。所拱之神在原局空灵虚设，无一字填实破格。古人谓之「神龙见首不见尾」，暗中借天地真气拱夹禄贵，格局清纯超拔。`,
      meaning: '行事谦抑内敛、深藏不露、极具修养与贵人福荫；关键时刻总有不可思议之机缘与外力相助，无声无息中化险为夷、平步青云。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '拱禄拱贵，填实则凶。'
        }
      ]
    });
  }

  // 24. 日禄归时局（青云得路）
  const luBranchMap = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  const hourBranch = p[3]?.branch;
  const isRiLuGuiShi = luBranchMap[dayStem] === hourBranch && !tgs.includes('正官') && !tgs.includes('七杀');
  if (isRiLuGuiShi) {
    configs.push({
      name: '日禄归时局（青云得路）',
      badge: '青云得路 · 晚岁大成之局',
      weight: 82,
      whatIs: `日主【${dayStem}】在时支门户得临官禄位【${hourBranch}】，四柱天干无官杀攻克，时禄安稳清泰。时支为归宿之所，日禄居之，主平生自力更生、晚境丰隆，号曰「青云得路」。`,
      meaning: '意志坚定、自立自强、深具长期主义精神；早岁深耕蓄势，中年之后声势大震，晚景丰隆享福，门庭光显，基业长青。',
      classics: [
        {
          source: '《渊海子平·喜忌篇》',
          quote: '日禄居时没官星，号青云得路。'
        }
      ]
    });
  }

  // 25. 伤官伤尽局（支持两种境界：全无官星，或官星无根一粒虚浮被强伤彻底伤尽）
  const stemGuanCount = tgs.filter((t) => t === '正官').length;
  const hiddenGuanShaCount = p.reduce((acc, cur) => acc + (cur.hidden || []).filter((h) => h.tenGod === '正官' || h.tenGod === '七杀').length, 0);
  const isChunShangJin = hasShang && stemGuanCount === 0 && hiddenGuanShaCount === 0 && !shangHeSha;
  const isXuFuShangJin = hasShang && stemGuanCount === 1 && hiddenGuanShaCount === 0 && !hasCai && !shangHeSha;

  if (isChunShangJin || isXuFuShangJin) {
    const detailWhatIs = isXuFuShangJin
      ? '日主伤官秀气旺盛，虽天干透出一粒正官，但地支无半点官杀根气（纯粹虚浮无根），局中又无财星通关生助。强旺伤官顺势克去虚浮孤官，将其拔除制伏；无根之官不能为害，反显伤官克伐征服之功，正是古籍名著所论「官星无根一粒虚浮，伤官有力亦作伤尽」之上乘境界。'
      : '日主伤官秀气旺盛发露，原局四柱天干地支（含地支藏干）无半点官星显露或藏伏。伤官不见正官，无克破受辱之虞，伤尽官星反为至贵，豪迈倜傥，自开法度。';

    configs.push({
      name: isXuFuShangJin ? '伤官伤尽局（虚浮官星伤尽）' : '伤官伤尽局',
      badge: '横刀立法 · 自开法度之局',
      weight: 85,
      whatIs: detailWhatIs,
      meaning: '极具开创精神与颠覆性洞见；不受陈规陋习束缚，敢想敢干、横刀破局，善于在无路处开出新路，在制度空白区缔造新规则，成一代行业宗师或变革先锋。',
      classics: [
        {
          source: '《滴天髓·论伤官》',
          quote: '伤官见官果难辨，可见不可见。'
        },
        {
          source: '《三命通会·论伤官》',
          quote: '伤官伤尽，亦有不作福者，伤官见官，亦有不作祸者'
        }
      ]
    });
  }

  // 26. 两气成象局（相生/相成）
  const elemEntries = Object.entries(pct).sort((a, b) => Number(b[1]) - Number(a[1]));
  const topTwoPct = (Number(elemEntries[0]?.[1]) || 0) + (Number(elemEntries[1]?.[1]) || 0);
  const e1 = elemEntries[0]?.[0];
  const e2 = elemEntries[1]?.[0];
  if (topTwoPct >= 85 && e1 && e2) {
    const isSheng = ELEM_REL[e1]?.生 === e2 || ELEM_REL[e2]?.生 === e1;
    const isKe = ELEM_REL[e1]?.克 === e2 || ELEM_REL[e2]?.克 === e1;
    if (isSheng || isKe) {
      configs.push({
        name: `两气成象局（${e1}${e2}相${isSheng ? '生' : '成'}）`,
        badge: '两气双清 · 浑然天成之局',
        weight: 84,
        whatIs: `全命局能量高度凝聚于【${e1}】与【${e2}】两种五行（二者占比合计高达 ${topTwoPct.toFixed(1)}%），五行相${isSheng ? '生流通、气象纯和' : '克均停、交战相成'}，无第三行杂气破局，成两神相生之清粹纯局。`,
        meaning: '性情纯粹、专注至极、无旁骛之思；在特定专业赛道或艺术科研领域具有惊人的超然天赋与沉浸力，往往能突破常人极限，成就非凡绝顶之境界。'
      });
    }
  }

  // 排序与筛选：按重要性权重排序，取前 3 个最具代表性的大局
  configs.sort((a, b) => b.weight - a.weight);
  return configs.slice(0, 3);
}

export function formatSchoolClaimItem(it) {
  const cleanControversy = (it.controversy || '')
    .replace(/（互链\s*[^）]+）/g, '')
    .replace(/\(互链\s*[^)]+\)/g, '')
    .trim();
  const subLines = [];
  subLines.push(`  * **【学说要义 · ${it.id}】${it.claim}**`);
  subLines.push(`    * 出处：${it.source}`);
  if (cleanControversy && cleanControversy !== '—') {
    subLines.push(`    * 学理分歧：${cleanControversy}`);
  }
  return subLines;
}

export function appendSchoolClaimsBlock(lines, hits, schoolLabel) {
  if (!hits || hits.length === 0) return;
  if (hits.length <= 3) {
    lines.push(`* **${schoolLabel}命中经典主张条目**：`);
    hits.forEach((it) => {
      formatSchoolClaimItem(it).forEach((line) => lines.push(line));
    });
  } else {
    lines.push(`* **${schoolLabel}命中核心强特征详析**（前 3 项深度解析）：`);
    hits.slice(0, 3).forEach((it) => {
      formatSchoolClaimItem(it).forEach((line) => lines.push(line));
    });
    lines.push(`  * **${schoolLabel}其余命中主张全量附录全陈**（共 ${hits.length - 3} 项，全量无遗漏）：`);
    hits.slice(3).forEach((it) => {
      const cleanControversy = (it.controversy || '')
        .replace(/（互链\s*[^）]+）/g, '')
        .replace(/\(互链\s*[^)]+\)/g, '')
        .trim();
      let text = `    * **【学说要义 · ${it.id}】${it.claim}**（出处：${it.source}`;
      if (cleanControversy && cleanControversy !== '—') {
        text += ` ｜ 分歧：${cleanControversy}`;
      }
      text += '）';
      lines.push(text);
    });
  }
}

export function renderSchoolSection(chart) {
  const p = chart.pillars || [];
  const yearGz = p[0]?.gz || '';
  const monthGz = p[1]?.gz || '';
  const dayGz = p[2]?.gz || '';
  const hourGz = p[3]?.gz || '';

  const dayStem = p[2]?.stem || chart.dayMaster?.stem || '';
  const dayElem = ELEMENTS[STEM_ELEMENT[STEMS.indexOf(dayStem)]] || '木';
  const monthBranch = p[1]?.branch || '';
  const hourBranch = p[3]?.branch || '';

  const yearStem = p[0]?.stem || '';
  const monthStem = p[1]?.stem || '';
  const hourStem = p[3]?.stem || '';

  const yearBranch = p[0]?.branch || '';
  const dayBranch = p[2]?.branch || '';

  const yearTg = getTenGod(dayStem, yearStem) || '';
  const monthTg = getTenGod(dayStem, monthStem) || '';
  const hourTg = getTenGod(dayStem, hourStem) || '';

  const rels = gzRelations(p);
  const schoolRes = matchSchoolClaims(chart);
  const tha = tiaohouAssessment(chart);
  const gj = gejuChengPoOf(chart);

  const lines = [];
  lines.push('## 第二段：丙层各派学说并陈（六大流派经典主张）\n');
  lines.push('> **导读**：中国传统命理学在千百年演进中形成了不同研究视角。本段严格并陈各大主要流派对本命造的核心推演逻辑、喜忌判断与实质分歧，不强行选边，全景呈现学理脉络。\n');
  lines.push('---\n');

  // 2.1 格局派
  lines.push('### 2.1 格局派（以《子平真诠》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《子平真诠·论用神》：「八字用神，专求月令，以日干配月令地支，而生克不同，格局分焉。」');
  lines.push('  > 《子平真诠·论用神成败救应》：「成中有败，必是带忌；败中有成，全凭救应。」');
  lines.push('* **本命具体干支详析**：');
  const gejuName = gj?.格局 || chart.geju?.格局 || '正官格';
  const gejuStatus = gj?.状态 || '成格';
  lines.push(`  * **立格原委**：月令【${monthBranch}】当令司权，以月令藏干本气【${gj?.格神字 || ''}】（${gj?.格神十神 || '司令'}）定为【${gejuName}】。天干透出年干【${yearStem}】（${yearTg}）、月干【${monthStem}】（${monthTg}）、时干【${hourStem}】（${hourTg}）。`);
  lines.push(`  * **格局研判**：定格为【${gejuName} · ${gejuStatus}】。${gj?.说明 || '月令气势深厚，天干食伤财官交相呼应，成破关键在于相神是否得力护卫格局。'}`);
  lines.push(`  * **喜忌判定**：喜相神透干护格（如食伤制杀、印绶护身），喜去留清纯；忌刑冲破害动摇月令提纲，忌官杀重战破坏纯粹性。`);

  // 格局专论
  let gKnowledge = GEJU_KNOWLEDGE[gejuName];
  if (!gKnowledge) {
    const foundKey = Object.keys(GEJU_KNOWLEDGE).find((k) => gejuName.includes(k.replace('格', '')) || k.includes(gejuName.replace('格', '')));
    gKnowledge = foundKey ? GEJU_KNOWLEDGE[foundKey] : (GEJU_KNOWLEDGE['正官格'] || Object.values(GEJU_KNOWLEDGE)[0]);
  }
  lines.push('\n* **【深度专论一：本命所立格局释义与学理考辨】**：');
  lines.push(`  * **格局释名与立格原理**：${gKnowledge.definition}`);
  lines.push(`  * **代表什么意思与人生心性**：${gKnowledge.meaning}`);
  lines.push('  * **格局成败与救应关键**：格局用神专求月令提纲，以成格为贵，败格带忌须凭相神救应；去浊留清、相神辅弼方为上乘。');

  // 大局详析
  const majorConfigs = detectChartMajorConfigurations(chart);
  if (majorConfigs.length > 0) {
    lines.push('\n* **【深度专论二：四柱交涉兼备之核心大局详析】**：');
    lines.push('  > **局之奥义**：命理先贤论命，素有“月令为格，干支配合为局”之精论。格定其体，局定其用。本命四柱生克交汇，兼备以下经世大局：');
    majorConfigs.forEach((cfg) => {
      lines.push(`  * **▶ 【${cfg.name}】（${cfg.badge}）**：`);
      lines.push(`    * **什么是${cfg.name}**：${cfg.whatIs}`);
      lines.push(`    * **代表什么意思**：${cfg.meaning}`);
      if (cfg.classics && cfg.classics.length > 0) {
        lines.push('    * **古籍名著论述**：');
        cfg.classics.forEach((cl) => {
          lines.push(`      > ${cl.source}：「${cl.quote}」`);
        });
      }
    });
  }

  const gejuHits = schoolRes.bySchool?.geju || [];
  if (gejuHits.length > 0) {
    lines.push('');
    appendSchoolClaimsBlock(lines, gejuHits, '格局派');
  }
  lines.push('* **学派实质分歧**：');
  lines.push('  * 格局派不以身强身弱为第一要义，将「月令格局清纯与成破救应」置于绝对优先位置；只要去留得当、格局清纯即可取贵。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 若岁运天干透合煞之字，能否真正达成《子平真诠·正官格》所论「合煞留官」之纯粹大贵之格？\n');
  lines.push('---\n');

  // 2.2 旺衰平衡派
  lines.push('### 2.2 旺衰平衡派（以《滴天髓阐微》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《滴天髓阐微·体用》：「道有体用，不可以一端论也，要在扶之抑之得其宜。」');
  lines.push('  > 《滴天髓阐微·衰旺》：「旺则宜泄宜伤，衰则喜帮喜助。」');
  lines.push('* **本命具体干支详析**：');
  const { tongPct, yiPct, pct: normPct } = calcTongYiDang(chart);
  const sortedElems = Object.entries(normPct).sort((a, b) => b[1] - a[1]);
  const maxElem = sortedElems[0] || ['金', 30];
  const minElem = sortedElems[sortedElems.length - 1] || ['水', 5];

  const qiShiDirection = tongPct >= 50
    ? '气势聚于同党印比生助之方。'
    : '气势聚于异党泄耗克制之方。';
  lines.push(`  * **气势全貌**：同党（比劫印星）占比 ${tongPct.toFixed(1)}%，异党（食伤财官）占比 ${yiPct.toFixed(1)}%。全盘五行气势以【${maxElem[0]}】（${maxElem[1].toFixed(1)}%）最强，以【${minElem[0]}】（${minElem[1].toFixed(1)}%）最弱。${qiShiDirection}`);

  let qiLiuDesc = '';
  let xiJiDesc = '';
  if (tongPct >= 55) {
    qiLiuDesc = `日元【${dayStem}${dayElem}】得生扶党众，生旺有余而泄耗不足，局中最旺五行与次旺五行形成能量主导，宜泄其菁华或抑其强顽，以求气流行畅。`;
    xiJiDesc = '喜克抑泄耗、疏通强旺之神，使生机外溢；忌生助过当激增偏枯，忌闭塞不畅自固成滞。';
  } else if (tongPct <= 45) {
    qiLiuDesc = `日元【${dayStem}${dayElem}】身处克泄交加之境，局中最旺五行与次旺五行形成能量主导，两党交战最重通关枢纽与扶身根本；通关生化若成，则化敌为友、生生不息。`;
    xiJiDesc = '喜通关生化、生扶印比之神护身流通；忌两党交争激化矛盾，忌重克多泄耗竭生机。';
  } else {
    qiLiuDesc = `日元【${dayStem}${dayElem}】两党势均力敌，局中最旺五行与次旺五行形成能量主导，重在维持动态均势与气行中和。`;
    xiJiDesc = '喜抑过扶不及、调停中枢；忌岁运偏激打破平衡，引发动荡。';
  }
  lines.push(`  * **气流分析**：${qiLiuDesc}`);
  lines.push(`  * **喜忌判定**：${xiJiDesc}`);

  const wangshuaiHits = schoolRes.bySchool?.wangshuai || [];
  if (wangshuaiHits.length > 0) {
    appendSchoolClaimsBlock(lines, wangshuaiHits, '旺衰平衡派');
  }
  lines.push('* **学派实质分歧**：');
  lines.push('  * 强调全盘气势流通与体用协调，认为日主为“体”，体若衰极无依，一切名利用神皆为克身利刃，保全生机为第一优先。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 原局通关之神力量强弱，是否足以在岁运冲击下保持流通闭环而不至于断链？\n');
  lines.push('---\n');

  // 2.3 调候派
  const MONTH_MAP = {
    寅: { name: '正月（孟春）', season: '初春', climate: '余寒未尽，阳气始升，万物萌芽待暖' },
    卯: { name: '二月（仲春）', season: '仲春', climate: '阳和日盛，草木繁茂，气象融和' },
    辰: { name: '三月（季春）', season: '暮春', climate: '木气渐衰，火气将生，阳热渐长' },
    巳: { name: '四月（孟夏）', season: '初夏', climate: '阳气蒸腾，天地燥烈，火炎土燥' },
    午: { name: '五月（仲夏）', season: '盛夏', climate: '赤帝司权，大暑炎酷，草木枯槁' },
    未: { name: '六月（季夏）', season: '季夏', climate: '火气未退，土燥金脆，焦渴万状' },
    申: { name: '七月（孟秋）', season: '初秋', climate: '秋风渐劲，金气乘权肃杀，草木凋零收敛' },
    酉: { name: '八月（仲秋）', season: '仲秋', climate: '金神秉令，天地严霜，草木根枯叶落' },
    戌: { name: '九月（季秋）', season: '暮秋', climate: '霜降风高，气转严寒，木气归根伏藏' },
    亥: { name: '十月（孟冬）', season: '初冬', climate: '水旺进气，天寒地冻，木无生气' },
    子: { name: '十一月（仲冬）', season: '隆冬', climate: '严寒冰冻，滴水成冰，万物萧索' },
    丑: { name: '十二月（季冬）', season: '暮冬', climate: '残冬寒极，冻土不发，待阳气回春' },
  };
  const mInfo = MONTH_MAP[monthBranch] || { name: `${monthBranch}月`, season: '时令', climate: '四时变幻，寒暖燥湿各异' };

  const pureMonthName = mInfo.name.replace(/（.*）/, '').trim();
  lines.push('### 2.3 调候穷通派（以《穷通宝鉴》为宗）\n');
  lines.push('* **经典出处**：');
  if (tha && tha.要点) {
    lines.push(`  > 《穷通宝鉴·${pureMonthName}${dayStem}${dayElem}》：「${tha.要点}」`);
  } else {
    lines.push('  > 《滴天髓阐微·寒暖》：「天道有寒暖，发育万物，人道行之，不可过也。」');
    lines.push('  > 《滴天髓阐微·燥湿》：「地道有燥湿，生成品汇，人道得之，不可偏也。」');
  }
  if (tha?.提要?.论述) {
    lines.push(`  > 《八字提要·韦千里》论${dayStem}${dayElem}生${monthBranch}月${hourGz}时：「${tha.提要.论述}」`);
  }

  lines.push('* **本命具体干支详析**：');
  lines.push(`  * **气候实况**：命主生于农历【${mInfo.name}】，${mInfo.climate}。自然生态物候以寒暖适宜、生机护卫为最高准则。`);

  const yongShen = tha?.用神 || '水火兼济';
  const fuZuo = tha?.辅佐 || '印绶比劫';
  const jiShen = tha?.忌 || '偏枯暴烈';

  const yongHits = [];
  ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].forEach((st) => {
    if (yongShen.includes(st)) {
      const pos = [];
      if (yearStem === st) pos.push('年干');
      if (monthStem === st) pos.push('月干');
      if (hourStem === st) pos.push('时干');
      if (pos.length > 0) yongHits.push(`用神【${st}】透出${pos.join('、')}`);
    }
  });
  const fuHits = [];
  ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].forEach((st) => {
    if (fuZuo.includes(st)) {
      const pos = [];
      if (yearStem === st) pos.push('年干');
      if (monthStem === st) pos.push('月干');
      if (hourStem === st) pos.push('时干');
      if (pos.length > 0) fuHits.push(`辅佐【${st}】透出${pos.join('、')}`);
    }
  });

  const daoweiDesc = [];
  if (yongHits.length > 0) daoweiDesc.push(yongHits.join('，'));
  if (fuHits.length > 0) daoweiDesc.push(fuHits.join('，'));

  lines.push(`  * **调候用神与局中呼应**：原书定调候用神为【${yongShen}】，辅佐为【${fuZuo}】，忌【${jiShen}】。${daoweiDesc.length > 0 ? `原局干支呼应：${daoweiDesc.join('；')}。` : '原局干支须在大运流年中寻调候之神补益。'}${monthBranch === '申' && dayStem === '乙' && monthStem === '丙' ? '本盘月干丙火透出、地支巳火两见，火气照暖克金，正应原典「丙透又加巳出埋金可云科甲」之象。' : ''}`);
  lines.push(`  * **喜忌判定**：调候派视调和天时为第一急务，喜调候之神透干通根无破，忌调候之神遭冲合克绊或火炎土燥水竭。`);

  const tiaohouHits = schoolRes.bySchool?.tiaohou || [];
  if (tiaohouHits.length > 0) {
    appendSchoolClaimsBlock(lines, tiaohouHits, '调候派');
  }
  lines.push('* **学派实质分歧**：');
  lines.push('  * 突破十神吉凶教条，以大自然生态气候为最高基准；视生水之金为白虎源泉而非克身恶煞，视保全草木生机为先。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 在气候调候优先的前提下，岁运引通金水是否可一举超越原局十神混杂之局限？\n');
  lines.push('---\n');

  // 2.4 盲派象法
  lines.push('### 2.4 盲派象法（以《盲派与象法》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《盲派与象法·宾主》：「年、月为宾位，日、时为主位。宾主是空间与立场，不是吉凶标签。」');
  lines.push('  > 《盲派与象法·做功》：「做功＝命局中代表命主一方的体，通过有效干支作用，对用产生控制、取得、转化、吸收或输出成果的过程。」');
  lines.push('* **本命具体干支详析**：');
  lines.push(`  * **宾主宫位界定**：`);
  lines.push(`    * **宾位（年月外部境域）**：年柱【${yearGz}】（天干透【${yearStem}】${yearTg}，地支坐【${yearBranch}】）、月柱【${monthGz}】（天干透【${monthStem}】${monthTg}，地支坐月令提纲【${monthBranch}】）。代表国家体制、祖辈根基、外部平台与社会公共资产。`);
  lines.push(`    * **主位（日时自我归宿）**：日柱【${dayGz}】（日元【${dayStem}】自坐夫妻宫【${dayBranch}】）、时柱【${hourGz}】（天干透【${hourStem}】${hourTg}，地支坐门户归宿【${hourBranch}】）。代表命主自身才干、家庭内部、个人技能与终身落手之富贵。`);

  lines.push(`  * **局中干支真实做功路径**：`);
  const gongList = [];

  // 1. 天干五合
  if (rels['天干五合'] && rels['天干五合'].length > 0) {
    rels['天干五合'].forEach((c) => {
      const isZhu = c.pair.includes('日') || c.pair.includes('时');
      const isBin = c.pair.includes('年') || c.pair.includes('月');
      let meaning = '两干情聚气凝，以合做功';
      if (isZhu && isBin) {
        meaning = '主宾相合（主位合揽宾位），将外部社会环境与体制资源合入主位，以合做大功';
      } else if (isZhu) {
        meaning = '日时主位相合，自身归宿情意专聚';
      } else {
        meaning = '年月宾位相合，外部平台环境聚合';
      }
      gongList.push(`天干【${c.pair}】作五合（合化${c.化}）：${meaning}`);
    });
  }

  // 2. 天干相克
  if (rels['天干相克'] && rels['天干相克'].length > 0) {
    rels['天干相克'].forEach((c) => {
      const isZhuKeBin = (c.pair.startsWith('日') || c.pair.startsWith('时')) && (c.pair.includes('年') || c.pair.includes('月'));
      const isBinKeZhu = (c.pair.startsWith('年') || c.pair.startsWith('月')) && (c.pair.includes('日') || c.pair.includes('时'));
      if (isZhuKeBin) {
        gongList.push(`天干【${c.pair}】：主位发力制克宾位（我制他人成产业），以制做功`);
      } else if (isBinKeZhu) {
        gongList.push(`天干【${c.pair}】：宾位制克主位，体制与外部平台对自身施加约束`);
      }
    });
  }

  // 3. 地支六合
  if (rels['地支六合'] && rels['地支六合'].length > 0) {
    rels['地支六合'].forEach((c) => {
      const isZhu = c.pair.includes('日') || c.pair.includes('时');
      const isBin = c.pair.includes('年') || c.pair.includes('月');
      if (isZhu && isBin) {
        gongList.push(`地支【${c.pair}】作六合（合化${c.化}）：主位直合宾位，将年月外部公门体制与平台资源合入主位自身，以合做功`);
      } else if (isZhu) {
        gongList.push(`地支【${c.pair}】作六合（合化${c.化}）：日时主位相合，夫妻宫与门户相连，自我根基稳固凝聚`);
      } else {
        gongList.push(`地支【${c.pair}】作六合（合化${c.化}）：年月宾位互合，外部环境与祖基平台聚合`);
      }
    });
  }

  // 4. 地支半合 / 三合
  if (rels['地支半合'] && rels['地支半合'].length > 0) {
    rels['地支半合'].forEach((c) => {
      const isZhu = c.pair.includes('日') || c.pair.includes('时');
      const isBin = c.pair.includes('年') || c.pair.includes('月');
      const tag = (isZhu && isBin) ? '主宾相通汇聚' : (isZhu ? '主位内部汇聚' : '宾位外部汇聚');
      gongList.push(`地支【${c.pair}】${c.type || '半合'}${c.拱 ? `（拱${c.拱}）` : ''}：${tag}【${c.局 || c.化 || '合'}】局之能量做功`);
    });
  }
  if (rels['地支三合'] && rels['地支三合'].length > 0) {
    rels['地支三合'].forEach((c) => {
      gongList.push(`地支【${c.局}】：局中三合汇聚成局，气专力大，全方位调动干支能量`);
    });
  }

  // 5. 地支相刑
  if (rels['地支相刑'] && rels['地支相刑'].length > 0) {
    rels['地支相刑'].forEach((c) => {
      gongList.push(`地支【${c.刑}】（${c.positions || c.members}）：盲派视刑为“开库”或“借刑做功”，干支相刑相激，激发原局潜藏能量做功`);
    });
  }

  // 6. 地支六冲
  if (rels['地支六冲'] && rels['地支六冲'].length > 0) {
    rels['地支六冲'].forEach((c) => {
      const isZhu = c.pair.includes('日') || c.pair.includes('时');
      const isBin = c.pair.includes('年') || c.pair.includes('月');
      if (isZhu && isBin) {
        gongList.push(`地支【${c.pair}】相冲：主位与宾位对冲互激，冲战交涉，以冲做功`);
      }
    });
  }

  if (gongList.length > 0) {
    gongList.forEach((g) => {
      lines.push(`    * **${g}**。`);
    });
  } else {
    lines.push(`    * 局中干支以生克流通为主，岁运引动时干支交涉做功。`);
  }

  const zhuDesc = `日柱【${dayGz}】、时柱【${hourGz}】`;
  const binDesc = `年柱【${yearGz}】、月柱【${monthGz}】`;
  let gongDesc = '';
  if (gongList.length > 0) {
    gongDesc = `本命主位${zhuDesc}与宾位${binDesc}产生多重交涉做功（涵盖${gongList.length}条路径），通过克制合聚外部资源，体现出命主调动并掌控外部环境之能力。制用大、做功效率高则富贵层级显。`;
  } else {
    gongDesc = `本命主位${zhuDesc}与宾位${binDesc}各自成体，局中干支以清平顺遂自守为主；待岁运干支引动冲合交涉之时，方显主位制宾之功用。`;
  }
  lines.push(`  * **做功能量与层次研判**：盲派视“主位制宾位”为成家立业之大成法则（命诀云「我制他人成产业」）。${gongDesc}`);

  const mangpaiHits = schoolRes.bySchool?.mangpai || [];
  if (mangpaiHits.length > 0) {
    appendSchoolClaimsBlock(lines, mangpaiHits, '盲派与象法');
  }
  lines.push('* **学派实质分歧**：');
  lines.push('  * 彻底打破子平身强身弱、日主平衡之教条，纯以宾主做功效率与捕神贼神定社会财富量级；不问日元有根无根，功成即贵。');

  const OPPOSITE_BRANCHES = {
    '子': '午火', '丑': '未土', '寅': '申金', '卯': '酉金',
    '辰': '戌土', '巳': '亥水', '午': '子水', '未': '丑土',
    '申': '寅木', '酉': '卯木', '戌': '辰土', '亥': '巳火'
  };
  const dayOpp = OPPOSITE_BRANCHES[dayBranch] ? `${OPPOSITE_BRANCHES[dayBranch]}冲日支${dayBranch}` : '岁运冲日';
  const monthOpp = OPPOSITE_BRANCHES[monthBranch] ? `${OPPOSITE_BRANCHES[monthBranch]}冲月令${monthBranch}` : '岁运冲提纲';
  lines.push('* **深入追问切入点**：');
  lines.push(`  * 岁运若逢${dayOpp}、或${monthOpp}等震荡字眼，是否会瞬间打散原局做功与体用平衡之链条？\n`);
  lines.push('---\n');

  // 2.5 古法三命
  lines.push('### 2.5 古法三命（以《李虚中命书》《三命通会·论纳音》为宗）\n');
  lines.push('* **经典出处**：');
  lines.push('  > 《五行精纪·主本》：「遁月从年，则以年为主；遁时从日，则以日为本。」');
  lines.push('  > 《五行精纪·论三元》：「干为禄，定贵贱，支为命，定修短，纳音为身，察盛衰。」');
  lines.push('* **本命具体干支详析**：');
  const yearNayin = p[0]?.nayin?.name || nayinOf(gzIndex(yearGz)).name;
  const monthNayin = p[1]?.nayin?.name || nayinOf(gzIndex(monthGz)).name;
  const dayNayin = p[2]?.nayin?.name || nayinOf(gzIndex(dayGz)).name;
  const hourNayin = p[3]?.nayin?.name || nayinOf(gzIndex(hourGz)).name;
  const yNe = p[0]?.nayin?.element || nayinOf(gzIndex(yearGz)).element;
  const dNe = p[2]?.nayin?.element || nayinOf(gzIndex(dayGz)).element;
  let mainOriginRel = '';
  if (yNe === dNe) {
    mainOriginRel = `主本五行同气同和（俱属【${yNe}】），气数凝聚纯粹。`;
  } else if (ELEM_REL[yNe]?.生 === dNe) {
    mainOriginRel = `年命纳音【${yNe}】顺生日柱纳音【${dNe}】，为尊生卑、主育本之有情格局。`;
  } else if (ELEM_REL[dNe]?.生 === yNe) {
    mainOriginRel = `日柱纳音【${dNe}】反生年命纳音【${yNe}】，本固枝荣，下资于上。`;
  } else if (ELEM_REL[yNe]?.克 === dNe) {
    mainOriginRel = `年命纳音【${yNe}】克制日柱纳音【${dNe}】，古法视年克日为尊管卑、顺命无咎。`;
  } else {
    mainOriginRel = `日柱纳音【${dNe}】反克年命纳音【${yNe}】，古法称“日克年为逆”，更赖原局干支生化调和。`;
  }

  lines.push(`  * **四柱纳音排布**：年柱【${yearGz}】（纳音：【${yearNayin}】）、月柱【${monthGz}】（纳音：【${monthNayin}】）、日柱【${dayGz}】（纳音：【${dayNayin}】）、时柱【${hourGz}】（纳音：【${hourNayin}】）。`);
  lines.push(`  * **三命气数分析**：`);
  lines.push(`    * **天元干禄**：年干【${yearStem}】司天元之禄，定社会名位与荣辱尊卑。`);
  lines.push(`    * **地元支命**：年支【${yearBranch}】司地元之命，配十二宫定修短寿考与立身基业。`);
  lines.push(`    * **人元纳音身**：年命纳音【${yearNayin}】为人元之身，察全命造精气盛衰与造化归宿。`);
  lines.push(`  * **主本相资研判**：古法以年柱为主、日柱为本。${mainOriginRel}局中纳音水木火金土气数回转，须与四时旺相休囚之令兼参。`);

  const sanmingHits = schoolRes.bySchool?.sanming || [];
  if (sanmingHits.length > 0) {
    appendSchoolClaimsBlock(lines, sanmingHits, '古法三命');
  }
  lines.push('* **学派实质分歧**：');
  lines.push('  * 古法三命以年柱纳音为身命根基，天元禄、地元马、人元身三命并参；今法子平则纯以日干为唯一元神，弃纳音五行与胎元神煞不用。此乃命理学自唐宋至明清千年演进之根本分野。');
  lines.push('* **深入追问切入点**：');
  lines.push(`  * 岁运纳音行至旺相之乡还是死绝之地？年命纳音【${yearNayin}】身命能否在岁运引动下达成绝处逢生之清奇格局？\n`);
  lines.push('---\n');

  // 2.6 神煞象义派
  lines.push('### 2.6 神煞象义派（以《三命通会》为宗）\n');

  const ssList = Array.isArray(chart.shensha) ? chart.shensha : [];
  const ssNames = ssList.map((s) => s.name || '').filter(Boolean);

  // 动态检索匹配原典与追问
  const matchedQuotes = [];
  let dynamicInquiry = '';
  for (const rawName of ssNames) {
    const cleanName = rawName.replace(/（.*）/, '').trim();
    const item = SHENSHA_CLASSICS[rawName] || SHENSHA_CLASSICS[cleanName];
    if (item) {
      if (!matchedQuotes.some((q) => q.source === item.source)) {
        matchedQuotes.push(item);
      }
      if (!dynamicInquiry) {
        dynamicInquiry = item.inquiry;
      }
    }
  }

  // 若无特定经典神煞匹配，则使用神煞总纲
  if (matchedQuotes.length === 0) {
    matchedQuotes.push({
      source: '《三命通会》神煞类目表',
      quote: '吉凶神煞，不可拘定；轻重较量，要在通变。',
      inquiry: '神煞星宿象义与五行生克推演如何辩证统合，以在长远生涯中趋吉避凶？'
    });
    dynamicInquiry = '神煞星宿象义与五行生克推演如何辩证统合，以在长远生涯中趋吉避凶？';
  }

  lines.push('* **经典出处**：');
  matchedQuotes.slice(0, 2).forEach((cl) => {
    lines.push(`  > ${cl.source}：「${cl.quote}」`);
  });

  lines.push('* **本命具体神煞详析**：');
  const topSs = ssList.slice(0, 8).map((s) => {
    const positions = Array.isArray(s?.positions) ? s.positions.join('/') : '';
    return `【${s?.name || ''}】（${positions || '局中'}，${s?.nature || '中'}神）`;
  }).join('、');
  lines.push(`  * **命中所带核心神煞**：${topSs || '原局神煞清吉，以正五行生克推演为主'}。`);
  const hasJiShen = ssList.some(s => s?.nature === '吉' || /贵人|德|禄/.test(s?.name || ''));
  if (hasJiShen) {
    lines.push('  * **贵人格局**：吉神护佑逢凶化吉，威权与智慧星宿互见，主人内省深刻、具备高阶技术洞察与组织威严。');
  }
  lines.push('  * **警示神煞**：若带有孤辰寡宿、亡神劫煞或截路空亡等神煞，需在人际契约、团队合作与情绪管理上保持审慎。');

  const shenshaHits = schoolRes.bySchool?.shensha || [];
  if (shenshaHits.length > 0) {
    appendSchoolClaimsBlock(lines, shenshaHits, '神煞派');
  }
  lines.push('* **深入追问切入点**：');
  lines.push(`  * ${dynamicInquiry}\n`);
  lines.push('---\n');

  // 2.7 现代新派
  lines.push('### 2.7 现代新派（延伸视点：旺衰极端量化与隔轴生克）\n');
  lines.push('* **理论纲领**：');
  lines.push('  > 现代新派论命纲要：「百神论以实神虚神为凭，生克只论相邻作用，隔柱不直接发生生克。从弱从强顺其气势，平衡格局衰则喜扶、旺则宜抑。」');
  lines.push('* **本命具体干支详析**：');
  lines.push(`  * **三围环境与相邻作用**：日元【${dayStem}】左右直接相邻者为月干【${monthStem}】（${monthTg}）与时干【${hourStem}】（${hourTg}），坐下为日支【${dayBranch}】。新派认为隔柱（如年干【${yearStem}】与日元）不直接发生生克，能量经由相邻柱层层传导。`);

  const ELEM_PRODUCES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ELEM_DESTROYS = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
  const ELEM_INVERSED_DESTROYS = { 土: '木', 金: '火', 水: '土', 木: '金', 火: '水' };
  const ELEM_INVERSED_PRODUCES = { 火: '木', 土: '火', 金: '土', 水: '金', 木: '水' };

  const yinElem = ELEM_INVERSED_PRODUCES[dayElem] || '印星';
  const biElem = dayElem;
  const shiElem = ELEM_PRODUCES[dayElem] || '食伤';
  const caiElem = ELEM_DESTROYS[dayElem] || '财星';
  const guanElem = ELEM_INVERSED_DESTROYS[dayElem] || '官杀';

  const tongPartyElems = `${yinElem}、${biElem}`;
  const yiPartyElems = `${shiElem}、${caiElem}、${guanElem}`;

  let wangshuaiControversy = '';
  if (tongPct < 50) {
    wangshuaiControversy = `日主坐支与邻干多有泄耗克制，若界定为“从弱格”，则局中克泄耗之【${yiPartyElems}】全为喜用；若界定为“偏弱正格”，则局中印比之【${tongPartyElems}】方为生扶用神。新派在此类判定上往往呈现出两极化的喜忌争辩。`;
  } else {
    wangshuaiControversy = `日主生扶党众气势偏旺，若界定为“从强格”，则局中生助日主之【${tongPartyElems}】顺势为用；若界定为普通平衡格，则局中克泄耗之【${yiPartyElems}】方为调停用神。新派在此类判定上往往呈现出两极化的喜忌争辩。`;
  }
  lines.push(`  * **旺衰界定与二元喜忌争议**：${wangshuaiControversy}`);
  lines.push('* **学派实质分歧**：');
  lines.push('  * 展现了纯线性数学化量化体系在边缘盘上的二元争议，将复杂的生克关系简化为相邻作用与旺衰二分法。');
  lines.push('* **深入追问切入点**：');
  lines.push('  * 隔柱相邻作用机制下，年时两端之干支能否直接跨柱产生实质合化？\n');
  lines.push('---\n');
  return lines.join('\n');
}
