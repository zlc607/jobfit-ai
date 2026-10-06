import Link from "next/link";
import { Lock } from "lucide-react";

/** 首页底部隐私声明：明确简历不会被服务端持久化 */
export function SiteFooter() {
  return (
    <footer className="no-print border-t py-8">
      <div className="container space-y-3 text-xs leading-relaxed text-muted-foreground">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <p>
            <strong className="font-medium text-foreground">隐私声明：</strong>
            简历与职位描述仅在本次请求内用于调用你配置的模型接口，
            <strong className="font-medium text-foreground">
              服务端不做任何持久化存储、不写数据库、不落盘
            </strong>
            ；历史记录保存在你自己浏览器的 localStorage 中，可逐条删除或一键清空。
            请勿提交包含身份证号、银行卡号等敏感信息的文本。
            <Link
              href="/privacy"
              className="ml-1 underline underline-offset-2 hover:text-foreground"
            >
              查看完整隐私说明
            </Link>
          </p>
        </div>
        <p>
          JobFit AI 是开源项目（MIT），分析结论由大模型生成，可能存在偏差，请结合自身判断使用。
        </p>
      </div>
    </footer>
  );
}
