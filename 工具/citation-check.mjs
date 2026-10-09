// 工具/citation-check.mjs
// 引文严查看门狗闸门：自动化核验 流派/*.md 主张库之出处真实性与篇名合规性。
// 规则：
// 1. 凡标注 [原文] 之引文，必须能在对应古籍/原料底本中 100% 逐字命中（或连续整句命中）。
// 2. 凡标有章节篇名者，该篇名必须在原书文本或标题行中真实存在，严禁虚构。
// 3. 查无逐字句者，必须明确标注 [未检得逐字原典]（系学理归纳/坊间口诀），合规放行。
// 4. 任何未经核验之伪造引文、虚构篇名或未标认怂之模糊条目，一律爆红阻断（exit 1）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIUPAI_DIR = path.join(ROOT, '流派');
const GUJI_DIR = path.join(ROOT, '古籍');
const YUANLIAO_DIR = path.join(ROOT, '流派', '原料');

// 建立书名关键字到本地底本文件的映射
function buildBookMap() {
  const map = new Map();
  const register = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md') && f !== 'README.md') {
        const full = path.join(dir, f);
        const base = f.replace(/\.md$/, '');
        map.set(base, full);
        // 拆解简短名
        const simple = base.replace(/^(古法三命-|御定子平秘本|神峰通考-|五行大义-)/, '').split(/[-_]/)[0];
        if (simple && !map.has(simple)) map.set(simple, full);
      }
    }
  };
  register(GUJI_DIR);
  register(YUANLIAO_DIR);
  return map;
}

const BOOK_MAP = buildBookMap();

function findBookFile(bookName) {
  const clean = bookName.replace(/《|》/g, '').trim();
  for (const [k, p] of BOOK_MAP.entries()) {
    if (k.includes(clean) || clean.includes(k)) return p;
  }
  // 别名匹配
  if (clean.includes('李虚中')) return BOOK_MAP.get('李虚中命书') || BOOK_MAP.get('古法三命-李虚中命书');
  if (clean.includes('五行精纪')) return BOOK_MAP.get('五行精纪') || BOOK_MAP.get('古法三命-五行精纪');
  if (clean.includes('兰台妙选')) return BOOK_MAP.get('兰台妙选') || BOOK_MAP.get('古法三命-兰台妙选');
  if (clean.includes('玉照定真经') || clean.includes('玉照')) return BOOK_MAP.get('玉照定真经') || BOOK_MAP.get('古法三命-玉照定真经');
  if (clean.includes('鬼谷')) return BOOK_MAP.get('鬼谷遗文') || BOOK_MAP.get('古法三命-鬼谷遗文');
  if (clean.includes('五行大义')) return BOOK_MAP.get('五行大义-萧吉');
  if (clean.includes('神峰通考') || clean.includes('神峰')) return BOOK_MAP.get('神峰通考-张楠');
  if (clean.includes('子平真诠')) return BOOK_MAP.get('子平真诠');
  if (clean.includes('渊海子平') || clean.includes('渊海')) return BOOK_MAP.get('渊海子平');
  if (clean.includes('滴天髓')) return BOOK_MAP.get('滴天髓阐微');
  if (clean.includes('穷通宝鉴')) return BOOK_MAP.get('穷通宝鉴');
  if (clean.includes('造化元钥')) return BOOK_MAP.get('造化元钥-徐乐吾评注');
  if (clean.includes('三命通会') || clean.includes('三命')) return BOOK_MAP.get('三命通会');
  if (clean.includes('千里命稿')) return BOOK_MAP.get('千里命稿-韦千里');
  if (clean.includes('盲派')) return BOOK_MAP.get('盲派与象法');
  return null;
}

// 提取表格行
function parseMarkdownTable(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const rows = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('|') && l.endsWith('|')) {
      if (l.includes('编号') && l.includes('主张')) {
        inTable = true;
        continue;
      }
      if (inTable && /^[\|\s\-:]+$/.test(l)) {
        continue;
      }
      if (inTable) {
        const cols = l.split('|').map((c) => c.trim()).slice(1, -1);
        if (cols.length >= 4) {
          rows.push({
            lineNo: i + 1,
            id: cols[0],
            claim: cols[1],
            condition: cols[2],
            source: cols[3],
            divergence: cols[4] || '',
          });
        }
      }
    } else {
      if (inTable && l === '') {
        // 表格结束
      }
    }
  }
  return rows;
}

function checkSource(row) {
  const s = row.source;
  const issues = [];

  // 1. 显式认怂放行
  if (s.includes('[未检得逐字原典]') || s.includes('未检得逐字原典') || s.includes('未检得') || s.includes('未取得正文')) {
    return { status: 'UNVERIFIED', note: '诚实标注未检得原典，合规放行' };
  }

  // 2. 匹配书名
  const bookMatch = s.match(/《([^》]+)》/);
  if (!bookMatch) {
    issues.push(`出处缺少明确书名号《...》`);
    return { status: 'VIOLATION', issues };
  }

  const bookName = bookMatch[1];
  const bookFile = findBookFile(bookName);
  if (!bookFile || !fs.existsSync(bookFile)) {
    issues.push(`本地典籍库中未找到书目《${bookName}》之对应底本`);
    return { status: 'VIOLATION', issues };
  }

  const bookText = fs.readFileSync(bookFile, 'utf8');

  // 3. 检查篇名/章节真实性
  // 格式如 《书名》篇名 [原文] 或 《书名》篇名 [未检得]
  const afterBook = s.slice(s.indexOf('》') + 1).trim();
  const chapterPart = afterBook.split(/\[原文\]|\[未检得|「/)[0].trim();
  if (chapterPart) {
    // 提取纯篇名（去掉开头的卷号、附号等）
    const cleanChapter = chapterPart.replace(/^卷[一二三四五六七八九十上下0-9]+\s*/, '').replace(/[·•]/g, '').trim();
    if (cleanChapter && cleanChapter.length >= 2) {
      if (!bookText.includes(cleanChapter)) {
        issues.push(`所标篇名/章节「${cleanChapter}」在《${bookName}》底本中完全不存在（虚构篇名）`);
      }
    }
  }

  // 4. 检查逐字引文真实性
  // 优先匹配 [原文] 「...」
  let quote = null;
  const explicitQuoteMatch = s.match(/\[原文\]\s*「([^」]+)」/) || s.match(/\[原文\]\s*([^\s\[]+)/);
  if (explicitQuoteMatch) {
    quote = explicitQuoteMatch[1].trim();
  } else {
    const genericQuoteMatch = s.match(/「([^」]+)」/);
    if (genericQuoteMatch) quote = genericQuoteMatch[1].trim();
  }

  if (!quote) {
    // 若既无引文，又无未检得
    if (!s.includes('[未检得') && !s.includes('[学理提要]')) {
      issues.push(`出处既无逐字引文 [原文] 「...」，亦无 [未检得] 声明`);
    }
  } else {
    // 校验引文连续字串是否在底本中存在
    const strip = (str) => str.replace(/[\s\r\n，。；：！？、“”‘’（）《》`*#|—…\.\-]/g, '');
    const cleanBookText = strip(bookText);

    // 若引文中包含省略号，分割成片段逐一检查
    const rawSegments = quote.split(/……|\.\.\./);
    let failedSegments = [];
    let validSegmentCount = 0;

    for (const rawSeg of rawSegments) {
      const cleanSeg = strip(rawSeg);
      if (cleanSeg.length < 3) continue;
      validSegmentCount++;
      if (!cleanBookText.includes(cleanSeg)) {
        failedSegments.push(rawSeg.trim());
      }
    }

    if (validSegmentCount === 0) {
      issues.push(`引文「${quote}」有效字数少于3字，无法构成有效学术断言`);
    } else if (failedSegments.length > 0) {
      issues.push(`引文中存在底本未收录或被改写字句：「${failedSegments.join('」与「')}」在《${bookName}》中不存在`);
    }
  }

  if (issues.length > 0) {
    return { status: 'VIOLATION', issues };
  }

  return { status: 'VERIFIED', note: `在《${bookName}》中逐字对账核验通过` };
}

const FORBIDDEN_CHAPTERS = [
  '论月令格局',
  '通微论',
  '盲派命理·宾主与做功',
  '盲派命理·宾主',
  '从化论',
  '论学堂词馆',
  '论正官配伤官',
  '论正官/偏官'
];

function checkReportFile(reportPath, validClaimIds) {
  if (!fs.existsSync(reportPath)) {
    return { ok: false, issues: [`报告文件不存在: ${reportPath}`] };
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const issues = [];

  // 1. 检查虚构篇名黑名单
  for (const f of FORBIDDEN_CHAPTERS) {
    if (content.includes(f)) {
      issues.push(`报告正文包含已知虚构篇名黑名单字眼「${f}」`);
    }
  }

  // 2. 检查六大流派小节标题
  const requiredSections = [
    '### 2.1 格局派（以《子平真诠》为宗）',
    '### 2.2 旺衰平衡派（以《滴天髓阐微》为宗）',
    '### 2.3 调候穷通派（以《穷通宝鉴》为宗）',
    '### 2.4 盲派象法（以《盲派与象法》为宗）',
    '### 2.5 古法三命（以《李虚中命书》《三命通会·论纳音》为宗）',
    '### 2.6 神煞象义派（以《三命通会》为宗）',
    '### 2.7 现代新派（延伸视点：旺衰极端量化与隔轴生克）',
  ];
  for (const s of requiredSections) {
    if (!content.includes(s)) {
      issues.push(`报告正文缺失规范小节标题「${s}」`);
    }
  }

  // 3. 检查引用的主张编号 S-XX-NNN
  const claimMatches = content.matchAll(/S-([A-Z]+)-([0-9]{3})/g);
  let checkedClaims = 0;
  for (const m of claimMatches) {
    const id = m[0];
    checkedClaims++;
    if (!validClaimIds.has(id)) {
      issues.push(`报告正文中引用了未在主张库收录的虚构主张编号「${id}」`);
    }
  }
  if (checkedClaims === 0) {
    issues.push(`报告正文中未检测到任何 S-XX-NNN 规范学说锚点`);
  }

  // 4. 逐行扫描古籍出处与原典引文
  const EXCLUDE_BOOKS = ['体用路线法', 'AGENTS', '易经', '新派命理评注', '宪法', '决策台账'];
  const strip = (str) => str.replace(/[\s\r\n，。；：！？、“”‘’（）《》`*#|—…\.\-]/g, '');

  let checkedQuotes = 0;
  lines.forEach((l, idx) => {
    const lineNo = idx + 1;
    const m = l.match(/《([^》]+)》(?:[·•\s]*([^\s：「\n，。]+))?[^「“\n]*[「“]([^”」\n]+)[”」]/);
    if (m) {
      const rawBook = m[1].trim();
      if (EXCLUDE_BOOKS.some((ex) => rawBook.includes(ex))) return;

      let bookName = rawBook;
      let chapterName = (m[2] || '').trim();
      if (rawBook.includes('·') || rawBook.includes('•')) {
        const parts = rawBook.split(/[·•]/);
        bookName = parts[0].trim();
        chapterName = parts[1].trim();
      }

      const quote = m[3].trim();
      const bookFile = findBookFile(bookName);
      if (!bookFile) {
        issues.push(`[Line ${lineNo}] 本地典籍库中未找到书目《${bookName}》对应底本`);
        return;
      }
      const bookText = fs.readFileSync(bookFile, 'utf8');
      const cleanBookText = strip(bookText);

      // 验证篇名
      if (chapterName && chapterName.length >= 2) {
        let cleanCh = chapterName.split(/\[原文\]|\[未检得|「/)[0].trim();
        cleanCh = cleanCh.replace(/^卷[一二三四五六七八九十上下0-9]+\s*/, '').replace(/[·•]/g, '').trim();
        const strippedCh = strip(cleanCh);
        if (strippedCh && strippedCh.length >= 2) {
          if (!cleanBookText.includes(strippedCh) && !bookText.includes(cleanCh)) {
            issues.push(`[Line ${lineNo}] 所标篇名「${chapterName}」在《${bookName}》底本中完全不存在`);
          }
        }
      }

      // 验证引文逐字命中
      const segs = quote.split(/……|\.\.\./).map((s) => strip(s)).filter((s) => s.length >= 3);
      if (segs.length > 0) {
        checkedQuotes++;
        for (const seg of segs) {
          if (!cleanBookText.includes(seg)) {
            issues.push(`[Line ${lineNo}] 引文片段「${seg}」在《${bookName}》底本中不存在`);
            break;
          }
        }
      }
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    checkedClaims,
    checkedQuotes
  };
}

function main() {
  console.log('======================================================================');
  console.log('八字分析工具 · 丙层引文文献真伪严查看门狗 (CI 拦截闸门)');
  console.log('======================================================================\n');

  const targetArg = process.argv.find((a, i) => process.argv[i - 1] === '--file' || a.startsWith('--file='));
  const fileFilter = targetArg ? targetArg.replace(/^--file=/, '') : (process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null);

  const reportArg = process.argv.find((a, i) => process.argv[i - 1] === '--report' || a.startsWith('--report='));
  const reportPath = reportArg ? reportArg.replace(/^--report=/, '') : (process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : path.join(ROOT, '三段式全景命理解读深度示范报告.md'));

  let files = fs.readdirSync(LIUPAI_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  if (fileFilter) {
    files = files.filter((f) => f.includes(fileFilter));
  }
  let totalRows = 0;
  let totalVerified = 0;
  let totalUnverified = 0;
  let totalViolations = 0;
  const validClaimIds = new Set();

  for (const f of files) {
    const filePath = path.join(LIUPAI_DIR, f);
    const rows = parseMarkdownTable(filePath);
    rows.forEach((r) => validClaimIds.add(r.id));
    console.log(`📑 正在审查: 流派/${f}（共 ${rows.length} 条主张）`);

    let fileViolations = 0;
    for (const r of rows) {
      totalRows++;
      const res = checkSource(r);
      if (res.status === 'VERIFIED') {
        totalVerified++;
      } else if (res.status === 'UNVERIFIED') {
        totalUnverified++;
      } else {
        totalViolations++;
        fileViolations++;
        console.error(`  ❌ [Line ${r.lineNo}] ${r.id} 出处违规:`);
        for (const iss of res.issues) {
          console.error(`     - ${iss}`);
        }
        console.error(`     原始出处字段: ${r.source}\n`);
      }
    }

    if (fileViolations === 0) {
      console.log(`  ✅ 审查通过，0 项违规。\n`);
    } else {
      console.log(`  ⚠ 该文件存在 ${fileViolations} 项违规！\n`);
    }
  }

  // -------------------------------------------------------------
  // 审查总装报告正文（核验 S-XX-NNN 锚点合法性与正文引文真实性）
  // -------------------------------------------------------------
  if (fs.existsSync(reportPath)) {
    console.log(`📑 正在审查报告正文: ${path.relative(ROOT, reportPath)}`);
    const reportRes = checkReportFile(reportPath, validClaimIds);
    if (reportRes.ok) {
      console.log(`  ✅ 报告正文核验通过：检测到 ${reportRes.checkedClaims} 处主张锚点全部合法，${reportRes.checkedQuotes} 处古典引文逐字核验通过，0 项违规。\n`);
    } else {
      console.log(`  ⚠ 报告正文存在 ${reportRes.issues.length} 项违规！`);
      for (const iss of reportRes.issues) {
        console.error(`     - ${iss}`);
        totalViolations++;
      }
      console.log('');
    }
  }

  console.log('----------------------------------------------------------------------');
  console.log(`🏁 审查汇总：共审查 ${totalRows} 条主张库条目`);
  console.log(`   - 逐字真原典核验通过: ${totalVerified} 条`);
  console.log(`   - 诚实标注未检得原典: ${totalUnverified} 条`);
  console.log(`   - 违规假引文/虚构篇名: ${totalViolations} 条`);
  console.log('----------------------------------------------------------------------');

  if (totalViolations > 0) {
    console.error(`\n🚫 严查看门狗阻断：发现 ${totalViolations} 处引文造假或不合规项！`);
    console.error('请遵循三大铁律：使用 `find-quote.mjs` 提取真原句，或按规范标注 [未检得逐字原典]！');
    process.exit(1);
  } else {
    console.log(`\n🎉 严查看门狗全绿通过！六大流派主张库与报告正文引文 100% 真实合规！`);
    process.exit(0);
  }
}

main();
