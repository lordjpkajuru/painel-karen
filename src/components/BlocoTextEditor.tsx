import { useEffect, useRef, useState } from "react";
import { Variavel } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  variaveis: Variavel[];
  placeholder?: string;
  minHeight?: number;
}

/**
 * Textarea de bloco de texto com botão "[ ]" embutido no canto inferior direito
 * que abre um popover de variáveis (busca + insert na posição do cursor).
 * Auto-trigger ao digitar "[".
 */
export function BlocoTextEditor({
  value, onChange, variaveis, placeholder, minHeight = 110,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Autoresize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(minHeight, ta.scrollHeight) + "px";
  }, [value, minHeight]);

  function insertVariable(chave: string) {
    const ta = taRef.current;
    const insertion = `[${chave}]`;
    if (!ta) {
      onChange(value + insertion);
    } else {
      const start = ta.selectionStart ?? value.length;
      const end = ta.selectionEnd ?? value.length;
      const offset = autoTriggered && value[start - 1] === "[" ? 1 : 0;
      const next = value.slice(0, start - offset) + insertion + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start - offset + insertion.length;
        ta.setSelectionRange(pos, pos);
      });
    }
    setOpen(false);
    setSearch("");
    setAutoTriggered(false);
  }

  const filtered = variaveis
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .filter((v) => v.chave.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => {
          const newVal = e.target.value;
          const pos = e.target.selectionStart;
          if (variaveis.length > 0 && newVal.length > value.length && newVal[pos - 1] === "[") {
            setAutoTriggered(true);
            setSearch("");
            setOpen(true);
          }
          onChange(newVal);
        }}
        placeholder={placeholder}
        className="bg-panel font-mono text-sm pr-12 resize-none"
        style={{ minHeight }}
      />

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(""); setAutoTriggered(false); } }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={variaveis.length === 0}
            title="Inserir variável"
            className={`absolute bottom-2 right-2 inline-flex items-center justify-center h-7 px-2 rounded-md
              border border-border/60 bg-panel-2/80 backdrop-blur text-[11px] font-mono
              text-muted-foreground hover:text-foreground hover:bg-panel-2 hover:border-accent/40
              transition-opacity disabled:opacity-30 disabled:cursor-not-allowed
              ${focused || open ? "opacity-100" : "opacity-60"}`}
          >
            [&nbsp;]
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          collisionPadding={12}
          className="w-72 p-2 max-h-[min(20rem,70vh)] flex flex-col overflow-hidden"
        >
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) { e.preventDefault(); insertVariable(filtered[0].chave); }
                if (e.key === "Escape") { setOpen(false); setAutoTriggered(false); }
              }}
              placeholder="Buscar variável..."
              className="h-8 pl-7 bg-panel-2 text-sm"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 pr-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center italic">Nenhuma variável.</p>
            ) : filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => insertVariable(v.chave)}
                className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-accent/10 text-left min-h-[40px]"
              >
                <span className="font-mono text-xs truncate">{v.chave}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{v.tipo}</Badge>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
