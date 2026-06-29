import { useEffect, useState } from "react";
import { Acao, Bloco, Variavel } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  autoTitleFromBlocos, deriveTipoFromBlocos, resolvePlaceholders,
  filenameFromUrl, concatTextBlocos, countMediaBlocos,
} from "@/lib/mensageria";
import { StatusChip } from "./StatusChip";
import { RenderConteudo } from "./RenderConteudo";
import {
  Bot, Video, Mic, Image as ImageIcon, MessageSquare, Tag,
  Copy, Pencil, Trash2, ChevronDown, ChevronUp, Files,
} from "lucide-react";
import { toast } from "sonner";

const TIPO_ICON = {
  API: Bot, "VÍDEO": Video, "ÁUDIO": Mic, IMAGEM: ImageIcon,
  "IMAGEM+TXT": ImageIcon, MSG: MessageSquare, GRUPO: Tag,
} as const;

const BLOCO_EMOJI: Record<string, string> = {
  audio: "🎙️", video: "🎬", imagem: "🖼️", outro: "📎",
};

export const collapseStorageKey = (id: string) => `acao-collapsed-${id}`;

interface Props {
  acao: Acao;
  blocos: Bloco[];
  variaveis: Variavel[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: (opts: { otherDay?: boolean }) => void;
  collapseTick?: number;
}

export function ActionCard({ acao, blocos, variaveis, onEdit, onDelete, onDuplicate, collapseTick }: Props) {
  const tipo = deriveTipoFromBlocos(acao, blocos);
  const Icon = TIPO_ICON[tipo];
  const title = autoTitleFromBlocos(acao, blocos);
  const horario = (acao.horario || "").slice(0, 5);

  const isGrupo = acao.tipo === "RENOMEAR_GRUPO";
  const sortedBlocos = [...blocos].sort((a, b) => a.ordem - b.ordem);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(collapseStorageKey(acao.id));
    return v === null ? true : v === "1";
  });

  useEffect(() => {
    if (collapseTick === undefined) return;
    const v = localStorage.getItem(collapseStorageKey(acao.id));
    setCollapsed(v === null ? true : v === "1");
  }, [collapseTick, acao.id]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(collapseStorageKey(acao.id), next ? "1" : "0"); } catch {}
      return next;
    });
  }

  async function copy() {
    if (isGrupo) {
      await navigator.clipboard.writeText(acao.conteudo ?? "");
      toast.success("Nome copiado");
      return;
    }
    const text = concatTextBlocos(sortedBlocos);
    const resolved = resolvePlaceholders(text, variaveis);
    await navigator.clipboard.writeText(resolved);
    const mediaCount = countMediaBlocos(sortedBlocos);
    if (mediaCount > 0) {
      toast.success("Texto copiado", {
        description: `${mediaCount} mídia(s) precisa(m) ser enviada(s) separadamente.`,
      });
    } else {
      toast.success("Copiado");
    }
  }

  const allText = concatTextBlocos(sortedBlocos);
  const resolvedLen = !isGrupo ? resolvePlaceholders(allText, variaveis).length : 0;
  const counterColor =
    resolvedLen <= 600 ? "text-emerald-400" : resolvedLen <= 700 ? "text-amber-400" : "text-rose-400";

  const ChevronIcon = collapsed ? ChevronDown : ChevronUp;

  if (isGrupo) {
    return (
      <Card
        id={`acao-${acao.id}`}
        className="p-4 bg-panel border-border border-l-[3px] transition-all"
        style={{ backgroundColor: "rgba(56,189,248,0.07)", borderLeftColor: "hsl(var(--info))" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
            <span className="font-mono text-base font-semibold tabular-nums shrink-0">{horario}</span>
            <Tag className="w-4 h-4 text-info shrink-0" />
            <span className="text-xs sm:text-sm text-muted-foreground truncate flex-1 min-w-0">{title}</span>
            <StatusChip acao={acao} />
          </div>
          <CardActions onCopy={copy} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onToggle={toggleCollapsed} ChevronIcon={ChevronIcon} />
        </div>
        {!collapsed && (
          <div className="mt-3 font-mono text-base font-bold text-info bg-panel-2/50 rounded-md p-3 break-words">
            {acao.conteudo || <span className="text-muted-foreground italic">(vazio)</span>}
          </div>
        )}
      </Card>
    );
  }

  const hasAnyContent = sortedBlocos.length > 0;

  return (
    <Card id={`acao-${acao.id}`} className="p-4 bg-panel border-border hover:border-border/80 transition-all">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
          <span className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-foreground shrink-0">
            {horario}
          </span>
          <Icon className="w-5 h-5 text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm text-muted-foreground truncate">{title}</div>
          </div>
          <div className="shrink-0">
            <StatusChip acao={acao} />
          </div>
        </div>
        <CardActions onCopy={copy} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onToggle={toggleCollapsed} ChevronIcon={ChevronIcon} />
      </div>

      {!collapsed && hasAnyContent && (
        <div className="mt-3 space-y-2">
          {sortedBlocos.map((b) => {
            if (b.tipo === "texto") {
              const txt = b.conteudo ?? "";
              if (txt.trim() === "") return null;
              return (
                <div key={b.id} className="bg-panel-2/40 rounded-md p-3 border border-border/50">
                  <RenderConteudo text={txt} vars={variaveis} />
                </div>
              );
            }
            const url = b.url ?? "";
            if (!url.trim()) return null;
            const label = b.descricao || filenameFromUrl(url);
            return (
              <a
                key={b.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-panel-2 border border-border text-xs hover:border-accent/40 hover:bg-panel transition-colors max-w-full mr-2"
              >
                <span aria-hidden>{BLOCO_EMOJI[b.tipo] ?? "📎"}</span>
                <span className="truncate max-w-[260px]">{label}</span>
              </a>
            );
          })}
        </div>
      )}

      {!collapsed && allText.trim() !== "" && (
        <div className="mt-2 text-[11px] flex items-center gap-1">
          <span className={`font-mono font-medium ${counterColor}`}>{resolvedLen}</span>
          <span className="text-muted-foreground">chars / 700 limite WhatsApp</span>
        </div>
      )}
    </Card>
  );
}

function CardActions({ onCopy, onEdit, onDelete, onDuplicate, onToggle, ChevronIcon }: {
  onCopy: () => void; onEdit: () => void; onDelete: () => void;
  onDuplicate?: (opts: { otherDay?: boolean }) => void;
  onToggle: () => void; ChevronIcon: typeof ChevronDown;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0 ml-auto">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCopy} title="Copiar">
        <Copy className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Editar">
        <Pencil className="w-4 h-4" />
      </Button>
      {onDuplicate && (
        <Button
          size="icon" variant="ghost" className="h-8 w-8"
          onClick={() => onDuplicate({})}
          title="Duplicar"
        >
          <Files className="w-4 h-4" />
        </Button>
      )}
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Excluir">
        <Trash2 className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onToggle} title="Recolher / Expandir">
        <ChevronIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}
