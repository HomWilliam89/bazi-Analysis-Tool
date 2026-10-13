import { execSync } from 'node:child_process';
import fs from 'node:fs';

const msg = `[中] D-066：丙层流派主张库扩充（批次 C：古法三命《兰台妙选》纳音名格 30 条）与谓词门禁闭环

改了什么：在《流派/古法三命.md》扩充 30 条经典纳音名格主张（S-SM-031～S-SM-060），并在《核心/school-matcher.mjs》100% 实现 30 条匹配谓词；升级 matcher-test 测试组 1 与新增测试组 8（27 项全绿）；在《案例/cases.jsonl》新增 C-225（兔入月宫名造），全案扩充至 225 盘 439 项断言；同步技术文档、台账、日志与技能镜像。
为什么：响应使用者明确指令“干，C，别偷懒，别写错”，依据古典母本《古法三命-兰台妙选.md》上篇贵格赋及历代起例，将丙层古法三命扩充至 60 条，全仓六派主张库扩充至 270 条且谓词覆盖率保持 100%。
影响面：流派/古法三命.md、核心/school-matcher.mjs、核心/matcher-test.mjs、案例/cases.jsonl、案例/README.md、文档/03 技术.md、核心/README.md、文档/04 决策台账.md、日志/2026-10-13.md、技能镜像。
测试结果：全量 7 道质量闸门全绿（1383 单元自检全绿、27 匹配器测试全绿、91 CLI 测试全绿、225 案例 439 断言 100% 吻合、270 词真原典逐字对账 0 违规、30 md 文件收口 0 违规、技能镜像 23 项 SHA256 100% 一致）。`;

fs.writeFileSync('工具/temp-commit-msg.txt', msg, 'utf8');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -F 工具/temp-commit-msg.txt', { stdio: 'inherit' });

fs.unlinkSync('工具/temp-commit-msg.txt');

const hash = execSync('git rev-parse --short HEAD').toString().trim();
console.log('提交完成！Commit hash:', hash);

// 回填日志
const logPath = '日志/2026-10-13.md';
let logContent = fs.readFileSync(logPath, 'utf8');
logContent = logContent.replace('- **commit hash**：（待提交后回填）。', `- **commit hash**：\`${hash}\`。`);
fs.writeFileSync(logPath, logContent, 'utf8');
console.log('日志 commit hash 回填完成！');

execSync('git add 日志/2026-10-13.md', { stdio: 'inherit' });
execSync(`git commit -m "[轻] 日志：回填 D-066 提交 hash ${hash}"`, { stdio: 'inherit' });
const hashFinal = execSync('git rev-parse --short HEAD').toString().trim();
console.log('最终状态 commit 完成:', hashFinal);
