import { Variavel } from "@/lib/supabase";
import { PLACEHOLDER_REGEX } from "@/lib/mensageria";

export function RenderConteudo({ text, vars }: { text: string; vars: Variavel[] }) {
  if (!text) return null;
  const parts: { type: "text" | "ph"; value: string; key?: string }[] = [];
  let lastIdx = 0;
  const re = new RegExp(PLACEHOLDER_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ type: "text", value: text.slice(lastIdx, m.index) });
    parts.push({ type: "ph", value: m[0], key: m[0].slice(1, -1).trim() });
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push({ type: "text", value: text.slice(lastIdx) });

  return (
    <div className="font-mono text-sm whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
      {parts.map((p, i) => {
        if (p.type === "text") return <span key={i}>{p.value}</span>;
        const v = vars.find((x) => x.chave.trim().toUpperCase() === (p.key ?? "").toUpperCase());
        const filled = v && v.valor && v.valor.trim() !== "";
        if (!filled) {
          return <span key={i} className="placeholder-missing">{p.value}</span>;
        }
        if (v.tipo === "url") {
          return (
            <a
              key={i}
              href={v.valor!}
              target="_blank"
              rel="noopener noreferrer"
              className="placeholder-resolved"
              onClick={(e) => e.stopPropagation()}
            >
              {v.valor}
            </a>
          );
        }
        return <span key={i} className="placeholder-text">{v.valor}</span>;
      })}
    </div>
  );
}
