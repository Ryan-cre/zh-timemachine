# 开发环境

Electron + React + TypeScript 桌面应用。使用 Radix 交互组件、AI SDK 接入模型、Recharts 展示观点分布，SQLite 保存本地研究。

## 启动

安装 Node.js 24 LTS 和 Git，在项目目录执行：

```sh
npm ci
npm run dev
```

在“模型与连接”中配置知乎 Access Secret、搜索来源与模型供应商。支持 DeepSeek 和 OpenAI 兼容的 Chat Completions 服务；兼容地址通常包含 `/v1`，不要填写完整的 `/chat/completions` 路径。每个配置对应一个模型，同一服务可添加多个配置。

Windows PowerShell 如限制 `npm.ps1`，使用 `npm.cmd`。新装 Node.js 后请重新打开终端。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run doctor` | 检查基础工具链 |
| `npm run dev` | 启动开发窗口，支持热更新 |
| `npm run build` | 类型检查并构建应用 |
| `npm start` | 打开构建后的应用 |
| `npm test` | 时间边界、来源地址及引用去重测试 |
| `npm run test:desktop` | 构建后运行桌面模拟联调，截图保存在 test-results |
| `npm run pack` | 生成未压缩的本机应用目录 |
| `npm run dist:win` | 构建 Windows 便携版 |
| `npm run dist:mac` | 构建 macOS DMG，需在 macOS 验证 |
| `npm run dist:linux` | 构建 Linux AppImage，需在 Linux 验证 |

依赖版本由 `package-lock.json` 固定。electron-vite 5 搭配 Vite 7；升级时一并检查兼容范围。

## 代码位置

- `src/main`：本地数据库、凭证加密、知乎及模型适配、研究流程、IPC。
- `src/preload`：向界面暴露有限的桌面能力。
- `src/renderer`：工作台、供应商配置、历史研究、图表与证据阅读。
- `src/shared`：数据类型、时间分段及引用检查。
- `tests`、`scripts/test-desktop.mjs`：单元测试与隔离配置下的桌面联调。

## 数据与分析

研究记录、搜索缓存与限流冷却状态存储在 Electron `userData` 下的 `timemachine.db`，不在仓库内。凭证由系统安全存储加密；Linux 如仅提供 `basic_text` 后端，则拒绝保存凭证。研究可导出为便于分享的 Markdown 报告或完整 JSON 数据，均不包含密钥。

按北京时间分段，最多 24 个阶段、72 次搜索。每次返回最多 10 条摘要，缓存保留一小时。搜索数量包含缓存命中；模型用量记录成功返回的请求，不保证覆盖供应商对失败重试的计费。

程序依次规划关键词、分期采集、归类并汇总。样本按内容类型和 ID 去重，模型引用必须对应实际样本，一条样本只计入一个类别。取消或退出后可继续已保存的任务；重试仍受原搜索上限限制。

当前分析依据搜索摘要。EditTime 的实际语义及历史修改版本仍有不确定性，赞同数是采集时值。图表表示样本占比，不代表知乎全站，也不把跨时期差异解释为同一作者改变观点。

## 验证与发布

桌面模拟联调使用本地模型桩和知乎响应桩，不调用付费接口。可选的 `scripts/test-live.mjs` 从当前进程的 `ZH_LIVE_SECRET`、`ZH_LIVE_LLM_KEY` 读取凭证，执行两个月的小范围真实测试；会产生 API 调用并将凭证加密保存到正常应用配置。不要将这些变量写入代码或提交到 Git。

当前在 Windows 验证。macOS、Linux 已留出构建命令，尚未实机验证；签名、公证和自动更新也尚未配置。未压缩的 Windows 版本需保留整个 `release/win-unpacked` 目录，不能只拷贝 exe。
