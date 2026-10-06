/**
 * pdf-parse 没有官方类型，且其 index.js 内含读取本地测试 PDF 的调试代码，
 * 直接 `import "pdf-parse"` 在服务端会因文件不存在而报错。
 * 因此项目统一从 `pdf-parse/lib/pdf-parse.js` 导入，这里补充类型声明。
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  export interface PdfParseResult {
    /** 提取出的纯文本 */
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  export interface PdfParseOptions {
    /** 最多解析的页数 */
    max?: number;
    /** 自定义页渲染函数 */
    pagerender?: (pageData: unknown) => string | Promise<string>;
    version?: string;
  }

  function pdfParse(
    data: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;

  export default pdfParse;
}

declare module "pdf-parse" {
  export * from "pdf-parse/lib/pdf-parse.js";
  export { default } from "pdf-parse/lib/pdf-parse.js";
}
