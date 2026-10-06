"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";

interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "value"> {
  /** 需要复制的文本；也支持惰性取值（避免大文本重复 render） */
  value: string | (() => string);
  /** 复制成功提示文案 */
  successMessage?: string;
  /** 按钮文字，不传则为图标按钮 */
  label?: string;
}

/** 一键复制按钮：带成功态与降级方案（execCommand） */
export function CopyButton({
  value,
  successMessage = "已复制到剪贴板",
  label,
  variant = "outline",
  size = label ? "sm" : "icon",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const text = typeof value === "function" ? value() : value;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // 非 HTTPS / 旧浏览器降级；execCommand 失败时返回 false 而不是抛异常，
        // 必须检查返回值，否则会把复制失败报成成功
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const succeeded = document.execCommand("copy");
        document.body.removeChild(el);
        if (!succeeded) throw new Error("execCommand copy 返回 false");
      }
      setCopied(true);
      toast.success(successMessage);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  }, [value, successMessage]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      aria-label={label ?? "复制"}
      {...props}
    >
      {copied ? <Check /> : <Copy />}
      {label ? <span>{copied ? "已复制" : label}</span> : null}
    </Button>
  );
}
