import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render a markdown string as nicely-styled prose (dark theme). */
export function Markdown({ children }: { children: string }) {
  return (
    <div
      className="prose prose-invert prose-sm max-w-none
        prose-headings:font-semibold prose-headings:text-white
        prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:border-b prose-h2:border-edge prose-h2:pb-1
        prose-h3:text-sm prose-h3:mt-4
        prose-p:text-[#cbd2dc] prose-li:text-[#cbd2dc]
        prose-strong:text-white prose-a:text-accent
        prose-code:text-accent prose-code:bg-ink prose-code:px-1 prose-code:rounded
        prose-hr:border-edge"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
