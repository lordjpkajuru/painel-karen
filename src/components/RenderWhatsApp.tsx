import { Variavel } from "@/lib/supabase";
import { PLACEHOLDER_REGEX } from "@/lib/mensageria";

/**
 * Renderiza texto aplicando a formatação do WhatsApp:
 *   *texto*    → negrito
 *   _texto_    → itálico
 *   ~texto~    → riscado
 *   ```texto``` → monoespaçado
 * Quebras de linha preservadas. Placeholders [VAR] destacados (verde se preenchido,
 * vermelho se faltando). Variáveis do tipo url viram link clicável.
 */

type Node =
  | { type: "text"; value: string }
  | { type: "ph"; raw: string; key: string }
  | { type: "bold"; children: Node[] }
  | { type: "italic"; children: Node[] }
  | { type: "strike"; children: Node[] }
  | { type: "mono"; value: string };

// Tokenize plus parse simples, com prioridade ``` > * > _ > ~
function parse(text: string): Node[] {
  const out: Node[] = [];
  let i = 0;
  const len = text.length;

  function isBoundaryChar(ch: string | undefined) {
    if (ch === undefined) return true;
    return /[\s.,;:!?()\[\]{}"'\/\\]/.test(ch);
  }

  while (i < len) {
    // Triple backtick mono
    if (text.startsWith("```", i)) {
      const end = text.indexOf("```", i + 3);
      if (end !== -1) {
        out.push({ type: "mono", value: text.slice(i + 3, end) });
        i = end + 3;
        continue;
      }
    }

    // Placeholder [VAR]
    if (text[i] === "[") {
      PLACEHOLDER_REGEX.lastIndex = 0;
      const sub = text.slice(i);
      const m = sub.match(/^\[[A-ZÀ-Ÿ0-9 _.\-]+\]/);
      if (m) {
        out.push({ type: "ph", raw: m[0], key: m[0].slice(1, -1).trim() });
        i += m[0].length;
        continue;
      }
    }

    // Inline markers: * _ ~
    const ch = text[i];
    if ((ch === "*" || ch === "_" || ch === "~") && isBoundaryChar(text[i - 1])) {
      // Find matching closing on same logic
      let j = i + 1;
      let found = -1;
      while (j < len) {
        if (text[j] === ch && isBoundaryChar(text[j + 1]) && text[j - 1] !== " ") {
          found = j;
          break;
        }
        // Don't cross triple-backticks blocks
        if (text.startsWith("```", j)) {
          const e = text.indexOf("```", j + 3);
          j = e === -1 ? len : e + 3;
          continue;
        }
        j++;
      }
      if (found !== -1) {
        const inner = parse(text.slice(i + 1, found));
        const wrap: Node =
          ch === "*" ? { type: "bold", children: inner } :
          ch === "_" ? { type: "italic", children: inner } :
          { type: "strike", children: inner };
        out.push(wrap);
        i = found + 1;
        continue;
      }
    }

    // Plain text accumulator until next special char
    let next = i + 1;
    while (next < len) {
      const c = text[next];
      if (c === "[" || c === "*" || c === "_" || c === "~") break;
      if (text.startsWith("```", next)) break;
      next++;
    }
    out.push({ type: "text", value: text.slice(i, next) });
    i = next;
  }
  return out;
}

function renderNodes(nodes: Node[], vars: Variavel[], keyPrefix = ""): React.ReactNode {
  return nodes.map((n, idx) => {
    const k = `${keyPrefix}-${idx}`;
    switch (n.type) {
      case "text":
        return <span key={k}>{n.value}</span>;
      case "mono":
        return (
          <code
            key={k}
            className="font-mono text-[0.85em] bg-panel border border-border rounded px-1 py-0.5 whitespace-pre-wrap"
          >
            {n.value}
          </code>
        );
      case "bold":
        return <strong key={k} className="font-bold">{renderNodes(n.children, vars, k)}</strong>;
      case "italic":
        return <em key={k} className="italic">{renderNodes(n.children, vars, k)}</em>;
      case "strike":
        return <span key={k} className="line-through opacity-80">{renderNodes(n.children, vars, k)}</span>;
      case "ph": {
        const v = vars.find((x) => x.chave.trim().toUpperCase() === n.key.toUpperCase());
        const filled = v && v.valor && v.valor.trim() !== "";
        if (!filled) return <span key={k} className="placeholder-missing">{n.raw}</span>;
        if (v.tipo === "url") {
          return (
            <a key={k} href={v.valor!} target="_blank" rel="noopener noreferrer"
               className="placeholder-resolved" onClick={(e) => e.stopPropagation()}>
              {v.valor}
            </a>
          );
        }
        return <span key={k} className="placeholder-text">{v.valor}</span>;
      }
    }
  });
}

export function RenderWhatsApp({ text, vars }: { text: string; vars: Variavel[] }) {
  if (!text) return <span className="text-muted-foreground italic text-sm">(vazio)</span>;
  const nodes = parse(text);
  return (
    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
      {renderNodes(nodes, vars)}
    </div>
  );
}
