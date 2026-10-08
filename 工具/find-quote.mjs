// 工具/find-quote.mjs
// 古籍原典物理检索工具：直接扫描本地古籍与原料底本，定位真原句、所属真实章节与精确行号。
// 用法：node 工具/find-quote.mjs --book <书名关键字> --keyword <关键字1> [关键字2...] [--context <行数>]
// 示例：node 工具/find-quote.mjs --book 子平真诠 --keyword "用神" "月令"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUJI_DIR = path.join(ROOT, '古籍');
const YUANLIAO_DIR = path.join(ROOT, '流派', '原料');

function listAllBooks() {
  const books = [];
  const scan = (dir, tag) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md') && f !== 'README.md') {
        books.push({
          name: f,
          baseName: f.replace(/\.md$/, ''),
          path: path.join(dir, f),
          tag,
        });
      }
    }
  };
  scan(GUJI_DIR, '古籍');
  scan(YUANLIAO_DIR, '原料');
  return books;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let bookFilter = null;
  const keywords = [];
  let contextLines = 2;
  let allBooks = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--book' || a === '-b') {
      bookFilter = args[++i];
    } else if (a === '--keyword' || a === '-k') {
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        keywords.push(args[++i]);
      }
    } else if (a === '--context' || a === '-c') {
      contextLines = Number(args[++i]) || 2;
    } else if (a === '--all') {
      allBooks = true;
    } else if (!a.startsWith('-')) {
      keywords.push(a);
    }
  }

  return { bookFilter, keywords, contextLines, allBooks };
}

function searchInBook(book, keywords, contextLines) {
  const content = fs.readFileSync(book.path, 'utf8');
  const lines = content.split(/\r?\n/);
  const results = [];
  let currentHeader = '卷首/篇首';

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/^#{1,6}\s+/.test(line)) {
      currentHeader = line.replace(/^#{1,6}\s+/, '').trim();
    }

    const matched = keywords.every((k) => line.includes(k));
    if (matched) {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(lines.length - 1, idx + contextLines);
      const ctx = lines.slice(start, end + 1).map((l, i) => {
        const lineNo = start + i + 1;
        const prefix = lineNo === idx + 1 ? ' >' : '  ';
        return `${prefix} ${String(lineNo).padStart(5, ' ')} | ${l}`;
      });

      results.push({
        lineNo: idx + 1,
        header: currentHeader,
        matchedLine: line,
        context: ctx,
      });
    }
  }

  return results;
}

function main() {
  const { bookFilter, keywords, contextLines, allBooks } = parseArgs();

  if (keywords.length === 0) {
    console.log('用法: node 工具/find-quote.mjs [--book <书名>] --keyword <词1> [词2...] [--all] [--context <行数>]');
    console.log('可用书籍列表：');
    for (const b of listAllBooks()) {
      console.log(`  - [${b.tag}] ${b.name}`);
    }
    process.exit(1);
  }

  const allBooksList = listAllBooks();
  let targetBooks = allBooksList;

  if (bookFilter && !allBooks) {
    targetBooks = allBooksList.filter((b) => b.name.includes(bookFilter));
    if (targetBooks.length === 0) {
      console.error(`❌ 未找到匹配书名「${bookFilter}」的典籍底本！`);
      console.log('可用书籍：', allBooksList.map((b) => b.name).join(', '));
      process.exit(1);
    }
  }

  console.log(`🔍 检索关键字: [${keywords.map((k) => `"${k}"`).join(', ')}]`);
  console.log(`📚 目标书籍范围: ${targetBooks.map((b) => b.name).join(', ')}\n`);

  let totalHits = 0;
  for (const book of targetBooks) {
    const hits = searchInBook(book, keywords, contextLines);
    if (hits.length === 0) continue;

    console.log(`======================================================================`);
    console.log(`📖 【${book.tag}】${book.name}（命中 ${hits.length} 处）`);
    console.log(`======================================================================`);

    for (const h of hits) {
      totalHits++;
      console.log(`\n📍 行号: ${h.lineNo} | 所属章节: 【${h.header}】`);
      console.log(h.context.join('\n'));
    }
    console.log('');
  }

  console.log(`----------------------------------------------------------------------`);
  console.log(`🏁 检索完成，共命中 ${totalHits} 处。`);
}

main();
