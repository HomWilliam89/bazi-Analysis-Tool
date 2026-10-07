#!/usr/bin/env node
/**
 * bazi.mjs — 八字分析工具 · 根级快捷入口跳板
 * 转发至 命令行/bazi.mjs，保持与技能镜像目录同构调用兼容
 */
import { runCli } from './命令行/bazi.mjs';

runCli().then((code) => {
  if (code !== 0) process.exit(code);
});
