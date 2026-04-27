import type { ReactNode } from "react";

interface StreamingMarkdownProps {
  content: string;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g);

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const [, label, href] = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/) || [];
      if (label && href) {
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            {label}
          </a>
        );
      }
    }

    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-slate-300 underline-offset-2 break-all hover:text-slate-900"
        >
          {part}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

export function StreamingMarkdown({ content }: StreamingMarkdownProps) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed whitespace-pre-wrap">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;

        if (line.startsWith("### ")) {
          return (
            <h3 key={index} className="text-base font-semibold text-slate-900">
              {renderInline(line.slice(4))}
            </h3>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <h2 key={index} className="text-lg font-semibold text-slate-900">
              {renderInline(line.slice(3))}
            </h2>
          );
        }

        if (line.startsWith("# ")) {
          return (
            <h1 key={index} className="text-xl font-semibold text-slate-900">
              {renderInline(line.slice(2))}
            </h1>
          );
        }

        if (/^(-|\*|•)\s+/.test(line)) {
          return (
            <div key={index} className="flex gap-2">
              <span className="text-slate-400">•</span>
              <span>{renderInline(line.replace(/^(-|\*|•)\s+/, ""))}</span>
            </div>
          );
        }

        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
