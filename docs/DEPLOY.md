# 部署指南

## 一、Vercel 部署（推荐）

### 1. 推送到 GitHub

```bash
cd jobfit-ai
git init
git add .
git commit -m "feat: JobFit AI MVP"
git branch -M main
git remote add origin https://github.com/<your-name>/jobfit-ai.git
git push -u origin main
```

> 确认 `.env.local` 没有被提交（`.gitignore` 已包含）。推送前可执行 `git status --short` 自查。

### 2. 在 Vercel 导入项目

1. 打开 [vercel.com/new](https://vercel.com/new)，选择该仓库。
2. Framework Preset 会自动识别为 **Next.js**，构建命令与输出目录保持默认（`vercel.json` 已声明）。
3. 在 **Environment Variables** 中添加：

| 变量 | 必填 | 示例 |
| --- | --- | --- |
| `OPENAI_API_KEY` | ✅ | `sk-...`（建议在 Vercel 中标记为 Sensitive） |
| `OPENAI_BASE_URL` | 可选 | `https://api.openai.com/v1` 或你的兼容网关地址 |
| `MODEL` | 可选 | `gpt-4o-mini` |
| `MODEL_TEMPERATURE` | 可选 | `0.2` |
| `MODEL_COMPATIBILITY` | 可选 | `strict`（直连 OpenAI 官方需要 strict structured outputs 时） |

4. 点击 **Deploy**，等待构建完成。

### 3. 部署后自检

依次点开线上地址验证：

1. 首页能正常渲染，右上角暗色模式切换生效；
2. 点「填入示例，直接体验」→「开始分析」，能跑完整流程；
3. 结果页「复制 Markdown」与「打印 / 导出 PDF」可用；
4. 顶部「历史记录」能看到刚才那条记录。

任何一步报错，先看 **Vercel → Deployments → Functions 日志**，错误码与首页提示是对应的：

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 首页提示"未配置 OPENAI_API_KEY" | 环境变量没生效 | 检查变量名拼写；改了变量必须 **Redeploy** 才会生效 |
| 502 + `Thinking mode does not support this tool_choice` | 思考/推理模型拒绝 function calling 方式的结构化输出 | 默认 `MODEL_OBJECT_MODE=auto` 会自动改走 JSON 通道并再次降级到文本通道，通常无需处理；若仍报错，显式设 `MODEL_OBJECT_MODE=text`，或换非思考模型 |
| 502 + 提到 `response_format` / `json_object` | 该网关不支持 JSON 输出模式 | 设 `MODEL_OBJECT_MODE=text`（完全不依赖服务端结构化能力） |
| 502 + "模型接口调用失败"（其他） | Key 无效 / BaseURL 不可达 / 模型名错 | 错误信息里已附带针对性建议（401 / 404 / 429 / 超时分别有对应提示），按提示排查 |
| 上传 PDF 后报 `PARSE_FAILED` | 扫描件（图片型 PDF） | 改用「粘贴文本」；本项目不做 OCR |
| 请求 60 秒后被中断 | 模型首字延迟过高 | Vercel Hobby 函数上限 60s，换更快的模型；思考类模型延迟高，建议用非思考模型 |
| JSON 解析失败（`MODEL_FAILED`） | 模型遵循 schema 的能力不足 | 换更强的模型（本地模型建议 14B 以上），或设 `MODEL_OBJECT_MODE=text` 让本地负责提取与校验 |

### 关于函数时长

`vercel.json` 已把 `src/app/api/**/route.ts` 设为 `maxDuration: 60`。若是 Vercel 免费版且偶发超时，优先缩短 Prompt（`src/lib/ai/prompts.ts` 的 `MAX_INPUT_CHARS`）或换更快的模型。

## 二、自托管

### Node 直接运行

```bash
npm ci
npm run build
npm run start        # 默认 3000，可用 PORT 覆盖
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# next start 会读取 next.config.mjs，必须一起拷贝
COPY --from=builder /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build -t jobfit-ai .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxx \
  -e OPENAI_BASE_URL=https://api.openai.com/v1 \
  -e MODEL=gpt-4o-mini \
  jobfit-ai
```

### 用本地模型（数据不出机器）

以 Ollama 为例：

```dotenv
OPENAI_API_KEY=ollama              # 任意非空字符串
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL=qwen2.5:14b                  # 或 llama3.1:8b 等
```

注意：结构化输出依赖模型对 JSON 的遵循能力，7B 级别模型可能在复杂 schema 上失败，建议 14B 以上，或改用 vLLM 部署支持 `response_format` 的模型。

## 三、反向代理与安全

- 如果部署在公网，建议在网关层加上**速率限制**（本项目不自带限流，避免误伤自用场景），否则你的 API Key 可能被刷。
- `OPENAI_API_KEY` 只存在于服务端环境变量中，前端永远拿不到（所有模型调用都在 Route Handler 内）。
- 若需登录保护，优先用平台能力（Vercel Password Protection / Cloudflare Access），不必在应用里加鉴权。
