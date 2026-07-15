// ponytail: line-numbered plain code viewer, no syntax highlighting (that's a
// dep — shiki/prism). Seeing the code is the point; color is a later upgrade.
const MAX_LINES = 4000;

export function CodeBlock({ code }: { code: string }) {
  const all = code.split("\n");
  const lines = all.slice(0, MAX_LINES);
  const clipped = all.length > MAX_LINES;

  return (
    <div className="overflow-auto rounded-lg border bg-muted/30 font-mono text-xs leading-relaxed">
      <div className="w-max min-w-full">
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-muted/50">
            <span className="sticky left-0 w-12 shrink-0 select-none border-r bg-muted/40 px-2 text-right text-muted-foreground/50">
              {i + 1}
            </span>
            <span className="whitespace-pre px-3">{line || " "}</span>
          </div>
        ))}
        {clipped && (
          <div className="border-t px-3 py-2 text-muted-foreground/60">
            … {all.length - MAX_LINES} more lines truncated
          </div>
        )}
      </div>
    </div>
  );
}
