export type AnalysisBlock =
  | { type: "text" | "heading" | "code"; text: string }
  | { type: "list"; text: string; marker: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function cells(line: string) {
  let value = line.trim().replace(/^\|/, "");
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);
  const result: string[] = [];
  let cell = "";
  // Avoid regex lookbehind so the same parser runs in Hermes and browsers.
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && value[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (value[i] === "|") {
      result.push(cell.trim());
      cell = "";
    } else cell += value[i];
  }
  result.push(cell.trim());
  return result;
}

// A small Markdown subset. Unsupported syntax stays visible as text;
// backend text is never interpreted as HTML, executable code, or a chart formula.
export function parseAnalysis(content: string): AnalysisBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: AnalysisBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      const opening = line;
      while (++i < lines.length && !lines[i].trimStart().startsWith("```"))
        code.push(lines[i]);
      blocks.push({
        type: "code",
        text:
          i < lines.length ? code.join("\n") : [opening, ...code].join("\n"),
      });
      continue;
    }
    const headers = cells(line);
    const separator = cells(lines[i + 1] ?? "");
    if (
      line.includes("|") &&
      separator.length === headers.length &&
      separator.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const rows: string[][] = [];
      i++;
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        lines[i + 1].includes("|")
      ) {
        const row = cells(lines[i + 1]);
        // Keep malformed rows as text instead of silently dropping extra cells.
        if (row.length !== headers.length) break;
        rows.push(row);
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
    const list = line.match(/^\s*(?:([-*+])|(\d+[.)]))\s+(.+)$/);
    if (heading) blocks.push({ type: "heading", text: heading[1] });
    else if (list)
      blocks.push({ type: "list", marker: list[2] ?? "•", text: list[3] });
    else blocks.push({ type: "text", text: line });
  }
  return blocks;
}
