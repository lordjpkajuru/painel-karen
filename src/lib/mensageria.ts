import { Acao, Arquivo, Bloco, Variavel } from "@/lib/supabase";

export type DerivedTipo = "MSG" | "API" | "VÍDEO" | "ÁUDIO" | "IMAGEM" | "IMAGEM+TXT" | "GRUPO";

export const PLACEHOLDER_REGEX = /\[[A-ZÀ-Ÿ0-9 _.\-]+\]/g;

export function deriveTipo(acao: Acao, arquivos: Arquivo[]): DerivedTipo {
  if (acao.tipo === "RENOMEAR_GRUPO") return "GRUPO";
  if (acao.tem_botoes_api) return "API";
  if (arquivos.some((a) => a.tipo === "video")) return "VÍDEO";
  if (arquivos.some((a) => a.tipo === "audio")) return "ÁUDIO";
  const imagens = arquivos.filter((a) => a.tipo === "imagem");
  const conteudoVazio = !acao.conteudo || acao.conteudo.trim() === "";
  if (imagens.length > 0 && imagens.length === arquivos.length && conteudoVazio) return "IMAGEM";
  if (imagens.length > 0) return "IMAGEM+TXT";
  return "MSG";
}

export function deriveTipoFromBlocos(acao: Acao, blocos: Bloco[]): DerivedTipo {
  if (acao.tipo === "RENOMEAR_GRUPO") return "GRUPO";
  if (acao.tem_botoes_api) return "API";
  if (blocos.some((b) => b.tipo === "video")) return "VÍDEO";
  if (blocos.some((b) => b.tipo === "audio")) return "ÁUDIO";
  const hasImg = blocos.some((b) => b.tipo === "imagem");
  const hasText = blocos.some((b) => b.tipo === "texto" && (b.conteudo ?? "").trim() !== "");
  if (hasImg && !hasText) return "IMAGEM";
  if (hasImg) return "IMAGEM+TXT";
  return "MSG";
}

export function autoTitle(acao: Acao, arquivos: Arquivo[]) {
  const ctx = acao.contexto?.trim() || "—";
  const horario = (acao.horario || "").slice(0, 5);
  const tipo = deriveTipo(acao, arquivos);
  const rotulo = acao.rotulo?.trim() || "—";
  return `${ctx} - ${horario} — ${tipo} — ${rotulo}`;
}

export function autoTitleFromBlocos(acao: Acao, blocos: Bloco[]) {
  const ctx = acao.contexto?.trim() || "—";
  const horario = (acao.horario || "").slice(0, 5);
  const tipo = deriveTipoFromBlocos(acao, blocos);
  const rotulo = acao.rotulo?.trim() || "—";
  return `${ctx} - ${horario} — ${tipo} — ${rotulo}`;
}

export function concatTextBlocos(blocos: Bloco[]): string {
  return blocos
    .filter((b) => b.tipo === "texto" && (b.conteudo ?? "").trim() !== "")
    .map((b) => b.conteudo ?? "")
    .join("\n\n");
}

export function countMediaBlocos(blocos: Bloco[]): number {
  return blocos.filter((b) => b.tipo !== "texto" && (b.url ?? "").trim() !== "").length;
}

export function resolvePlaceholders(text: string, vars: Variavel[]): string {
  if (!text) return "";
  return text.replace(PLACEHOLDER_REGEX, (match) => {
    const key = match.slice(1, -1).trim();
    const v = vars.find((x) => x.chave.trim().toUpperCase() === key.toUpperCase());
    if (v && v.valor && v.valor.trim() !== "") return v.valor;
    return match;
  });
}

export function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || url);
  } catch {
    return url;
  }
}

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  pronto: "Pronto",
  agendado: "Agendado",
  enviado: "Enviado",
};

export const STATUS_CLASSES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  pronto: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  agendado: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  enviado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export const DEFAULT_DIA_SLUGS = ["pre", "seg", "ter", "qua", "qui", "sex", "sab", "dom", "carrinho"];
export const DEFAULT_DIA_NOMES: Record<string, string> = {
  pre: "Pré",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
  carrinho: "Carrinho",
};

export const DEFAULT_VARIAVEIS: { chave: string; tipo: "url" | "texto" }[] = [
  { chave: "LINK GRUPO", tipo: "url" },
  { chave: "LINK AULA 1", tipo: "url" },
  { chave: "LINK AULA 2", tipo: "url" },
  { chave: "LINK AULA 3", tipo: "url" },
  { chave: "LINK AULA 4", tipo: "url" },
  { chave: "LINK AULA 5", tipo: "url" },
  { chave: "LINK CARRINHO", tipo: "url" },
  { chave: "LINK SUPORTE", tipo: "url" },
  { chave: "LINK INSTAGRAM", tipo: "url" },
  { chave: "NOME EVENTO", tipo: "texto" },
  { chave: "DATA INICIO", tipo: "texto" },
  { chave: "PROFESSOR", tipo: "texto" },
];
