# 工具\ — 自检脚本

| 脚本 | 作用 | 跑法 |
|---|---|---|
| shoukou-check.mjs | 收口检查：禁词、BOM、非 UTF-8 | `node 工具\shoukou-check.mjs` |
| case-runner.mjs | 案例校验（判据建成后升级为真跑） | `node 工具\case-runner.mjs` |

两脚本只读、零依赖；退出码 0 全绿 / 1 有红项。
