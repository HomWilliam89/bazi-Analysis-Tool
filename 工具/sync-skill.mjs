#!/usr/bin/env node
/**
 * 工具/sync-skill.mjs — 正本（EightWordsWorkSpace）→ 安装镜像（skills/bazi-myskill）校验与分发
 *
 * 遵循《文档/03 技术.md》§9「正本＝本仓，镜像由同步脚本分发」纪律：
 *   - 正本：本工作区（EightWordsWorkSpace）
 *   - 镜像：<DSH_HOME>\skills\bazi-myskill 或由 --skill 指定
 *
 * 用法：
 *   node 工具/sync-skill.mjs                 无参数 ＝ --check（只校验差异，不写磁盘）
 *   node 工具/sync-skill.mjs --check         只校验差异
 *   node 工具/sync-skill.mjs --apply         真分发：计算差异 → 逐文件复制 → SHA256 复核
 *   node 工具/sync-skill.mjs --skill <path>  指定镜像安装路径（测试/旁路分发用）
 *   node 工具/sync-skill.mjs --help          显示帮助
 *
 * 退出码：
 *   0  全部一致（--check 下全部文件一致；--apply 下全部分发并复核通过）
 *   1  --check 存在差异/缺失；--apply 存在复制或校验失败
 *   2  环境或参数异常（正本缺失、权限拒绝等）
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SKILL_DIR_NAME = 'bazi-myskill';

/**
 * 正本向镜像的静态映射清单（正本相对路径 → 镜像相对路径）
 */
export const SYNC_MANIFEST = [
  // 技能入口
  { src: 'SKILL.md', dest: 'SKILL.md' },
  { src: '命令行/bazi.mjs', dest: 'bazi.mjs' },

  // 核心执行与推演大脑
  { src: '核心/engine.mjs', dest: '核心/engine.mjs' },
  { src: '核心/tiyong.mjs', dest: '核心/tiyong.mjs' },
  { src: '核心/school-matcher.mjs', dest: '核心/school-matcher.mjs' },
  { src: '核心/report-generator.mjs', dest: '核心/report-generator.mjs' },
  { src: '核心/selftest.mjs', dest: '核心/selftest.mjs' },
  { src: '核心/matcher-test.mjs', dest: '核心/matcher-test.mjs' },
  { src: '核心/cli-test.mjs', dest: '核心/cli-test.mjs' },

  // 规矩层（宪法、判据、术语、母本）
  { src: '规矩/宪法.md', dest: '规矩/宪法.md' },
  { src: '规矩/判据.md', dest: '规矩/判据.md' },
  { src: '规矩/术语.md', dest: '规矩/术语.md' },
  { src: '规矩/体用路线法.md', dest: '规矩/体用路线法.md' },

  // 丙层流派标准条目库（六大流派各 30 条）
  { src: '流派/格局.md', dest: '流派/格局.md' },
  { src: '流派/调候.md', dest: '流派/调候.md' },
  { src: '流派/旺衰.md', dest: '流派/旺衰.md' },
  { src: '流派/盲派象法.md', dest: '流派/盲派象法.md' },
  { src: '流派/古法三命.md', dest: '流派/古法三命.md' },
  { src: '流派/神煞.md', dest: '流派/神煞.md' },
];

function calcSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function resolveDefaultMirrorDir() {
  const dshHome = process.env.DSH_HOME;
  if (dshHome && dshHome.trim()) {
    return path.join(path.resolve(dshHome), 'skills', SKILL_DIR_NAME);
  }
  return path.join(os.homedir(), '.dsh', 'skills', SKILL_DIR_NAME);
}

function printHelp() {
  console.log(`
======================================================================
八字分析工具 · 正本至技能镜像分发脚本 (sync-skill.mjs)
======================================================================

【基本用法】
  node 工具/sync-skill.mjs [--check | --apply] [--skill <镜像目录路径>]

【选项参数】
  --check              只校验正本与镜像一致性（默认模式，不修改磁盘）
  --apply              执行实际分发复制，并逐一复核 SHA256
  --skill <path>       自定义镜像目标根目录（默认: ~/.dsh/skills/bazi-myskill）
  -h, --help           显示本帮助信息并退出

【退出码】
  0: 全部文件严格一致 / 复制且复核成功
  1: 存在文件缺失或 SHA256 不一致 / 复制失败
  2: 参数错误或源文件缺失
======================================================================
`);
}

export function syncSkill(options = {}) {
  const {
    apply = false,
    skillDir = resolveDefaultMirrorDir(),
    workspaceRoot = WORKSPACE_ROOT,
    manifest = SYNC_MANIFEST,
    silent = false,
  } = options;

  const log = silent ? () => {} : console.log;

  log('======================================================================');
  log('八字分析工具 · 正本 → 技能镜像同步校验');
  log('======================================================================');
  log(`正本工作区：${workspaceRoot}`);
  log(`镜像安装区：${skillDir}`);
  log(`模式：${apply ? '【--apply 真分发模式】' : '【--check 只校验模式】'}`);
  log('----------------------------------------------------------------------');

  let consistentCount = 0;
  let missingCount = 0;
  let mismatchCount = 0;
  let copiedCount = 0;
  let errorCount = 0;

  const results = [];

  for (const item of manifest) {
    const srcPath = path.join(workspaceRoot, item.src);
    const destPath = path.join(skillDir, item.dest);

    if (!fs.existsSync(srcPath)) {
      log(`  ✗ [正本缺失] ${item.src} (未在工作区找到)`);
      errorCount += 1;
      results.push({ item, status: 'src_missing' });
      continue;
    }

    const srcHash = calcSha256(srcPath);

    if (apply) {
      // 执行复制
      try {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
        const newDestHash = calcSha256(destPath);
        if (newDestHash === srcHash) {
          copiedCount += 1;
          log(`  ✓ [已分发复核] ${item.src} -> ${item.dest}`);
          results.push({ item, status: 'copied' });
        } else {
          errorCount += 1;
          log(`  ✗ [复制校验失败] ${item.src} -> ${item.dest} (HASH 不一致)`);
          results.push({ item, status: 'verify_failed' });
        }
      } catch (err) {
        errorCount += 1;
        log(`  ✗ [复制异常] ${item.src} -> ${item.dest}: ${err.message}`);
        results.push({ item, status: 'error', error: err.message });
      }
    } else {
      // 只校验
      if (!fs.existsSync(destPath)) {
        missingCount += 1;
        log(`  ⚪ [镜像缺失] ${item.dest}`);
        results.push({ item, status: 'dest_missing' });
      } else {
        const destHash = calcSha256(destPath);
        if (destHash === srcHash) {
          consistentCount += 1;
          log(`  ✓ [一致] ${item.dest}`);
          results.push({ item, status: 'consistent' });
        } else {
          mismatchCount += 1;
          log(`  ✗ [不一致] ${item.dest} (正本与镜像内容有差异)`);
          results.push({ item, status: 'mismatch' });
        }
      }
    }
  }

  log('----------------------------------------------------------------------');
  if (apply) {
    log(`【分发统计】成功同步: ${copiedCount} 项，失败: ${errorCount} 项`);
    const success = errorCount === 0 && copiedCount === manifest.length;
    return { success, exitCode: success ? 0 : 1, copiedCount, errorCount, results };
  } else {
    log(`【校验统计】一致: ${consistentCount} 项，镜像缺失: ${missingCount} 项，不一致: ${mismatchCount} 项`);
    const isClean = missingCount === 0 && mismatchCount === 0 && errorCount === 0;
    return {
      success: isClean,
      exitCode: isClean ? 0 : 1,
      consistentCount,
      missingCount,
      mismatchCount,
      errorCount,
      results,
    };
  }
}

// CLI 直接执行入口
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const args = process.argv.slice(2);
  let isApply = false;
  let customSkill = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else if (a === '--apply') {
      isApply = true;
    } else if (a === '--check') {
      isApply = false;
    } else if (a === '--skill') {
      customSkill = args[++i];
    }
  }

  const res = syncSkill({
    apply: isApply,
    skillDir: customSkill ? path.resolve(customSkill) : resolveDefaultMirrorDir(),
  });

  process.exit(res.exitCode);
}
