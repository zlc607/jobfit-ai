import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "隐私说明",
  description:
    "JobFit AI 的隐私说明：简历与 JD 的处理链路、数据存放位置、以及为什么不落库。",
};

/** 隐私说明页：把数据链路讲清楚，而不是一句“我们重视隐私” */
export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Button variant="ghost" size="sm" asChild className="no-print -ml-3">
        <Link href="/">
          <ArrowLeft />
          返回首页
        </Link>
      </Button>

      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Lock className="size-5 text-primary" />
          隐私说明
        </h1>
        <p className="text-sm text-muted-foreground">
          最后更新：随仓库版本同步。本页描述的是本仓库默认实现的行为，如果你自部署并做了改动，请以你的部署为准。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据流经的地方</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">1. 你的浏览器。</strong>
            简历文件或文本在浏览器中被读取，随后发送到本应用的服务端 API
            Route（<code className="rounded bg-muted px-1">/api/parse/resume</code>、
            <code className="rounded bg-muted px-1">/api/match</code>、
            <code className="rounded bg-muted px-1">/api/generate</code>）。
          </p>
          <p>
            <strong className="text-foreground">2. 应用服务端（内存）。</strong>
            PDF / DOCX 在这里被解析成文本，随后与 JD 一起组装成 Prompt，
            转发给你自己配置的模型接口。
            <strong className="text-foreground">
              服务端不做持久化：不写数据库、不写文件、不做日志落盘
            </strong>
            ；请求结束后内存中的文本随请求对象一起被回收。响应体也不会被缓存（路由标记为
            dynamic）。
          </p>
          <p>
            <strong className="text-foreground">3. 模型服务商。</strong>
            请求会发往
            <code className="mx-1 rounded bg-muted px-1">OPENAI_BASE_URL</code>
            指向的接口（官方 OpenAI，或你自己填的兼容网关、本地 vLLM / Ollama）。
            这一段的数据处理规则由该服务商决定，请自行确认其隐私政策；用本地模型时数据不出机器。
          </p>
          <p>
            <strong className="text-foreground">4. 历史记录。</strong>
            分析结果默认保存在
            <strong className="text-foreground">你自己浏览器的 localStorage</strong>
            里，最多 10 条，可在「历史记录」页逐条删除或一键清空。服务端无法访问这些数据。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我们不会做的事</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>· 不把简历上传到本项目维护者的任何服务器（本项目没有中心化后端）。</li>
            <li>· 不爬取招聘网站，不做自动投递，不代替你提交任何表单。</li>
            <li>· 不索要账号密码、身份证号、银行卡号等敏感信息。</li>
            <li>· 不接入分析统计脚本（默认仓库不包含任何第三方追踪代码）。</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">给你的建议</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              · 粘贴简历前，删掉身份证号、家庭住址、银行卡号等与分析无关的信息。
            </li>
            <li>
              · 如果用的是第三方免费模型中转服务，注意其可能留存请求内容；对隐私敏感时请自建或使用本地模型。
            </li>
            <li>· 使用公共电脑时，用完记得在「历史记录」页清空记录。</li>
            <li>
              · 生成的结论由大模型给出，存在偏差风险，请自己核对后再用于求职材料。
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">开源与审计</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            以上承诺都可以被代码验证：数据链路集中在
            <code className="mx-1 rounded bg-muted px-1">src/app/api/</code>
            与
            <code className="mx-1 rounded bg-muted px-1">src/lib/ai/pipeline.ts</code>
            ，历史记录逻辑在
            <code className="mx-1 rounded bg-muted px-1">src/lib/storage.ts</code>
            。整个项目没有数据库依赖。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
