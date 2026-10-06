# 贡献指南

## 开发环境

```bash
npm install
cp .env.example .env.local   # 填入 OPENAI_API_KEY
npm run dev
```

提交前请保证：

```bash
npm run lint
npm run typecheck
npm run build      # 涉及路由或依赖改动时必跑
```

## 欢迎的贡献

| 类型 | 说明 |
| --- | --- |
| Prompt / 评分校准 | 最有价值。请在 PR 中附同一份样本的前后对比（分数、结论差异），不要只说"更准了" |
| 新解析格式 | `.doc`、HTML 简历、LinkedIn 导出 PDF 等；改 `src/lib/parsing/extract-text.ts` |
| 新导出目标 | DOCX 原格式替换、PDF 直出；参考 `src/lib/markdown.ts` + `export-bar.tsx` |
| 兼容端点适配 | 你踩过的兼容网关坑（`response_format`、`json_schema` 差异），请补进 `docs/DEPLOY.md` 的排查表 |
| 可访问性与中文文案 | 键盘可达、对比度、错别字 |

## 代码约定

- **中文优先**：UI 文案、注释、Prompt 全中文；代码标识符（变量、函数、类型）保持英文。
- **不改的契约**：`src/lib/types.ts` 与 `src/lib/ai/schemas.ts` 必须同步修改——类型是编译期契约，Zod schema 是运行期契约，两者漂移会出现"编译通过但运行时字段缺失"。
- **导出格式是契约**：改动 `src/lib/markdown.ts` 的输出结构要在 PR 说明中写明，因为用户的导出文件会随之变化。
- **新增字段一律给默认值**：结构化输出可能被模型漏填，所有可选字段在渲染侧都要有兜底（参考 `normalizeDimensions`）。
- **不要引入数据库**：默认实现刻意无持久化，服务端历史若要做，请遵守 `docs/ARCHITECTURE.md` 的扩展点（默认关闭）。

## 禁止提交

- 真实简历样本（含姓名、电话、邮箱等个人信息）；
- 任何 API Key / `.env.local` / 令牌；
- 截图中的真实公司内部信息。

## Issue 模板

**Bug 反馈**请包含：

1. 复现步骤（从哪个页面、点了什么、传了什么类型的文件）；
2. 期望结果与实际结果；
3. 报错文案与错误码（首页会显示，如 `MODEL_FAILED`）；
4. 运行环境：`node -v`、操作系统、模型与 `OPENAI_BASE_URL` 类型（官方 / 兼容网关 / 本地）。

**功能建议**请说明：你现在的替代做法是什么、痛点在哪、期望的形态。不要只写"希望更智能"。

## PR 流程

1. Fork → `git checkout -b feat/your-feature`
2. 保持提交粒度清晰（一个提交做一件事），提交信息用 `feat:` / `fix:` / `docs:` / `refactor:` 前缀
3. PR 描述写清**动机 / 改动 / 验证方式**；涉及 UI 请附截图，涉及 Prompt 请附前后对比
4. 等待 review，讨论期间请保持分支与 `main` 同步

## 行为准则

技术讨论对事不对人。不接受：攻击性言论、泄露他人隐私的样本、把项目用于批量伪装经历的用途（本项目明确反对编造经历）。
