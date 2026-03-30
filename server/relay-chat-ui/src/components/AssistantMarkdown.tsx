import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ breaks: true, gfm: true });

type Props = { content: string; className?: string };

export function AssistantMarkdown({ content, className }: Props) {
  const { html, plain } = useMemo(() => {
    const raw = (content || "").trim();
    if (!raw) return { html: "", plain: "" };
    try {
      const parsed = marked.parse(raw, { async: false }) as string;
      if (typeof parsed !== "string") return { html: "", plain: raw };
      return { html: DOMPurify.sanitize(parsed), plain: "" };
    } catch {
      return { html: "", plain: raw };
    }
  }, [content]);

  if (html) {
    return (
      <div
        className={`bubble bubble-md ${className ?? ""}`.trim()}
        // sanitized above
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className={`bubble whitespace-pre-wrap ${className ?? ""}`.trim()}>
      {plain}
    </div>
  );
}
