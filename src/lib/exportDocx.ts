import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, ExternalHyperlink,
  Header, Footer, PageNumber, PageOrientation, HeadingLevel,
} from "docx";
import { Acao, Bloco, Dia, Edicao, Projeto, Trilha, supabase } from "@/lib/supabase";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type DerivedTipo = "MSG" | "GRUPO" | "ÁUDIO" | "VÍDEO" | "IMAGEM" | "IMAGEM+TXT" | "API";

const COLORS: Record<DerivedTipo, { border: string; fill: string }> = {
  MSG:          { border: "5B3A8C", fill: "F2EEF8" },
  GRUPO:        { border: "2E7D6B", fill: "E6F2EF" },
  "ÁUDIO":      { border: "C2772A", fill: "FBEFE0" },
  "VÍDEO":      { border: "2D5DA8", fill: "E7EEF8" },
  IMAGEM:       { border: "B23A78", fill: "F8E9F1" },
  "IMAGEM+TXT": { border: "B23A78", fill: "F8E9F1" },
  API:          { border: "555555", fill: "EFEFEF" },
};
const PRIMARY = "5B3A8C";
const MUTED = "6B7280";
const SUBTLE = "9CA3AF";

const PLACEHOLDER = /\[[A-ZÀ-Ÿ0-9 _.\-]+\]/g;

function deriveTipo(acao: Acao, blocos: Bloco[]): DerivedTipo {
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

// ── WhatsApp markdown → TextRun[] ───────────────────────────────
type Fmt = { bold?: boolean; italics?: boolean; strike?: boolean; mono?: boolean };

function makeRun(text: string, fmt: Fmt, base?: Fmt): TextRun {
  const f = { ...base, ...fmt };
  return new TextRun({
    text,
    bold: f.bold || undefined,
    italics: f.italics || undefined,
    strike: f.strike || undefined,
    font: f.mono ? "Consolas" : undefined,
  });
}

function parseInline(s: string, base?: Fmt): TextRun[] {
  const out: TextRun[] = [];
  let buf = "";
  const fmt: Fmt = { bold: false, italics: false, strike: false, mono: false };
  const flush = () => {
    if (!buf) return;
    out.push(makeRun(buf, fmt, base));
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) { buf += s[i + 1]; i++; continue; }
    if (c === "*") { flush(); fmt.bold = !fmt.bold; continue; }
    if (c === "_") { flush(); fmt.italics = !fmt.italics; continue; }
    if (c === "~") { flush(); fmt.strike = !fmt.strike; continue; }
    if (c === "`") { flush(); fmt.mono = !fmt.mono; continue; }
    buf += c;
  }
  flush();
  return out;
}

export function whatsappRuns(text: string, base?: Fmt): TextRun[] {
  const tokens: { t: string; ph: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    if (m.index! > last) tokens.push({ t: text.slice(last, m.index!), ph: false });
    tokens.push({ t: m[0], ph: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) tokens.push({ t: text.slice(last), ph: false });

  const runs: TextRun[] = [];
  for (const tok of tokens) {
    if (tok.ph) runs.push(new TextRun({ text: tok.t, color: "92400E" }));
    else runs.push(...parseInline(tok.t, base));
  }
  return runs.length ? runs : [new TextRun({ text: "" })];
}

// ── Helpers ─────────────────────────────────────────────────────
function sanitizeFilename(s: string): string {
  return (s || "").replace(/[\\/:*?"<>|\u0000-\u001F]/g, "").trim() || "documento";
}

function paragraphsFromText(text: string): string[] {
  // split on blank lines (1+ empty lines) — preserves single newlines as separate paragraphs too
  return text.replace(/\r\n/g, "\n").split(/\n/);
}

function fmtHHMM(h: string): string {
  return (h || "").slice(0, 5);
}

function autoTitle(acao: Acao, tipo: DerivedTipo): string {
  const ctx = acao.contexto?.trim() || "—";
  const rotulo = acao.rotulo?.trim() || "—";
  return `${ctx} - ${fmtHHMM(acao.horario)} --- ${tipo} --- ${rotulo}`;
}

// ── Document building ───────────────────────────────────────────
type DiaComAcoes = Dia & { acoes: (Acao & { blocos: Bloco[] })[] };

function buildCover(projeto: Projeto, edicao: Edicao, stats: { dias: number; acoes: number; perTipo: Record<DerivedTipo, number> }): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 2400 } }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "MENSAGERIA", bold: true, color: PRIMARY, size: 20, characterSpacing: 60 })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text: projeto.nome, bold: true, size: 52, color: "1F2937" })],
  }));
  const sub: string[] = [edicao.nome];
  if (edicao.data_inicio && edicao.data_fim) {
    try {
      sub.push(`${format(parseISO(edicao.data_inicio), "dd/MM/yyyy")} – ${format(parseISO(edicao.data_fim), "dd/MM/yyyy")}`);
    } catch {}
  }
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY, space: 4 } },
    children: [new TextRun({ text: sub.join(" · "), color: MUTED, size: 24 })],
  }));

  const parts: string[] = [`${stats.dias} dias`, `${stats.acoes} ações`];
  const tipoOrder: { key: DerivedTipo; sg: string; pl: string }[] = [
    { key: "MSG", sg: "mensagem", pl: "mensagens" },
    { key: "GRUPO", sg: "renomeação", pl: "renomeações" },
    { key: "ÁUDIO", sg: "áudio", pl: "áudios" },
    { key: "VÍDEO", sg: "vídeo", pl: "vídeos" },
    { key: "IMAGEM", sg: "imagem", pl: "imagens" },
    { key: "IMAGEM+TXT", sg: "imagem+texto", pl: "imagens+texto" },
    { key: "API", sg: "API", pl: "API" },
  ];
  const breakdown = tipoOrder
    .filter((t) => (stats.perTipo[t.key] ?? 0) > 0)
    .map((t) => `${stats.perTipo[t.key]} ${stats.perTipo[t.key] === 1 ? t.sg : t.pl}`);
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    children: [new TextRun({ text: [...parts, ...breakdown].join(" · "), color: SUBTLE, size: 18 })],
  }));
  return out;
}

function buildSummary(dias: DiaComAcoes[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text: "Sumário", bold: true, color: PRIMARY, size: 32 })],
  }));
  const rowBorder = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const rows = dias.map((d, i) => new TableRow({
    children: [
      new TableCell({
        width: { size: 800, type: WidthType.DXA },
        borders: { top: noBorder, left: noBorder, right: noBorder, bottom: rowBorder },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: String(i + 1).padStart(2, "0"), color: PRIMARY, bold: true })] })],
      }),
      new TableCell({
        width: { size: 7000, type: WidthType.DXA },
        borders: { top: noBorder, left: noBorder, right: noBorder, bottom: rowBorder },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: d.nome })] })],
      }),
      new TableCell({
        width: { size: 1560, type: WidthType.DXA },
        borders: { top: noBorder, left: noBorder, right: noBorder, bottom: rowBorder },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${d.acoes.length} ações`, color: MUTED })] })],
      }),
    ],
  }));
  out.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 7000, 1560],
    rows,
  }));
  return out;
}

function buildActionBlock(acao: Acao & { blocos: Bloco[] }): (Paragraph | Table)[] {
  const tipo = deriveTipo(acao, acao.blocos);
  const c = COLORS[tipo];
  const out: (Paragraph | Table)[] = [];

  // Header line
  out.push(new Paragraph({
    spacing: { before: 240, after: 80 },
    keepNext: true,
    children: [
      new TextRun({ text: fmtHHMM(acao.horario), bold: true, color: c.border, size: 22 }),
      new TextRun({ text: "   " }),
      new TextRun({ text: tipo, bold: true, color: c.border, size: 18, characterSpacing: 40 }),
      new TextRun({ text: "   ·   ", color: SUBTLE, size: 18 }),
      new TextRun({ text: autoTitle(acao, tipo), italics: true, color: MUTED, size: 18 }),
    ],
  }));

  // Content box
  const innerParas: Paragraph[] = [];
  const blocos = [...acao.blocos].sort((a, b) => a.ordem - b.ordem);

  if (acao.tipo === "RENOMEAR_GRUPO") {
    const newName = (acao.conteudo ?? "").trim();
    if (newName) {
      innerParas.push(new Paragraph({
        children: [
          new TextRun({ text: "Novo nome: ", color: MUTED }),
          ...whatsappRuns(newName, { bold: true }),
        ],
      }));
    } else {
      innerParas.push(new Paragraph({ children: [new TextRun({ text: "(sem texto)", italics: true, color: SUBTLE })] }));
    }
  } else if (blocos.length === 0) {
    innerParas.push(new Paragraph({ children: [new TextRun({ text: "(sem texto)", italics: true, color: SUBTLE })] }));
  } else {
    for (const b of blocos) {
      if (b.tipo === "texto") {
        const txt = b.conteudo ?? "";
        if (!txt.trim()) continue;
        const lines = paragraphsFromText(txt);
        for (const ln of lines) {
          innerParas.push(new Paragraph({ children: whatsappRuns(ln) }));
        }
      } else {
        const label = (b.tipo || "").toUpperCase();
        const desc = (b.descricao ?? "").trim();
        const url = (b.url ?? "").trim();
        const runs: any[] = [
          new TextRun({ text: `[${label}] `, bold: true, color: c.border }),
        ];
        if (desc) runs.push(new TextRun({ text: desc + " " }));
        runs.push(new TextRun({ text: "→ ", color: MUTED }));
        if (url) {
          runs.push(new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: url, color: "2563EB", size: 18, underline: {} })],
          }));
        }
        innerParas.push(new Paragraph({ children: runs }));
      }
    }
    if (innerParas.length === 0) {
      innerParas.push(new Paragraph({ children: [new TextRun({ text: "(sem texto)", italics: true, color: SUBTLE })] }));
    }
  }

  const thin = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };
  const left = { style: BorderStyle.SINGLE, size: 14, color: c.border };
  out.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9360, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: c.fill, color: "auto" },
        borders: { top: thin, bottom: thin, right: thin, left },
        margins: { top: 150, bottom: 150, left: 200, right: 200 },
        children: innerParas,
      })],
    })],
  }));

  return out;
}

function buildDay(dia: DiaComAcoes, index: number, isFirst: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const numStr = String(index + 1).padStart(2, "0");

  out.push(new Paragraph({
    pageBreakBefore: !isFirst ? true : undefined,
    spacing: { before: isFirst ? 600 : 0, after: 80 },
    children: [new TextRun({ text: `${numStr} · ${dia.nome}`, bold: true, color: PRIMARY, size: 36 })],
  }));

  if (dia.data) {
    try {
      const ext = format(parseISO(dia.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
      out.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: ext, color: MUTED, size: 18 })],
      }));
    } catch {}
  }
  out.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 4 } },
    children: [new TextRun({ text: `${dia.acoes.length} ações`, color: SUBTLE, size: 18 })],
  }));

  for (const acao of dia.acoes) {
    out.push(...buildActionBlock(acao));
  }
  return out;
}

// ── Public API ──────────────────────────────────────────────────
export async function exportEdicaoToDocx(opts: { projeto: Projeto; edicao: Edicao }) {
  const { projeto, edicao } = opts;

  // Trilhas
  const { data: trilhasData, error: errTrilhas } = await supabase
    .from("trilhas").select("*").eq("edicao_id", edicao.id).order("ordem");
  if (errTrilhas) throw errTrilhas;
  const trilhas = (trilhasData ?? []) as Trilha[];

  // Dias (toda a edição) — agrupar por trilha
  const { data: diasData, error: errDias } = await supabase
    .from("dias").select("*").eq("edicao_id", edicao.id).order("ordem");
  if (errDias) throw errDias;
  const diasList = (diasData ?? []) as Dia[];

  const acoesByDia: Record<string, Acao[]> = {};
  const blocosByAcao: Record<string, Bloco[]> = {};

  if (diasList.length > 0) {
    const diaIds = diasList.map((d) => d.id);
    const { data: acoes, error: errAcoes } = await supabase
      .from("acoes").select("*").in("dia_id", diaIds)
      .order("horario", { ascending: true }).order("criado_em", { ascending: true });
    if (errAcoes) throw errAcoes;
    const acoesList = (acoes ?? []) as Acao[];
    acoesList.forEach((a) => { (acoesByDia[a.dia_id] ??= []).push(a); });

    if (acoesList.length > 0) {
      const acaoIds = acoesList.map((a) => a.id);
      const { data: blocos, error: errBlocos } = await supabase
        .from("blocos").select("*").in("acao_id", acaoIds).order("ordem");
      if (errBlocos) throw errBlocos;
      ((blocos ?? []) as Bloco[]).forEach((b) => { (blocosByAcao[b.acao_id] ??= []).push(b); });
    }
  }

  const composed: DiaComAcoes[] = diasList.map((d) => ({
    ...d,
    acoes: (acoesByDia[d.id] ?? []).map((a) => ({ ...a, blocos: blocosByAcao[a.id] ?? [] })),
  }));

  // Stats
  const perTipo: Record<DerivedTipo, number> = {
    MSG: 0, GRUPO: 0, "ÁUDIO": 0, "VÍDEO": 0, IMAGEM: 0, "IMAGEM+TXT": 0, API: 0,
  };
  let totalAcoes = 0;
  for (const d of composed) {
    for (const a of d.acoes) {
      totalAcoes++;
      perTipo[deriveTipo(a, a.blocos)]++;
    }
  }
  const stats = { dias: composed.length, acoes: totalAcoes, perTipo };

  // Agrupa dias por trilha
  const diasByTrilha: Record<string, DiaComAcoes[]> = {};
  for (const d of composed) {
    (diasByTrilha[d.trilha_id] ??= []).push(d);
  }
  const trilhasComDias = (trilhas.length > 0 ? trilhas : [{ id: "_", edicao_id: edicao.id, nome: "Normal", ordem: 0 }] as Trilha[])
    .map((t) => ({ trilha: t, dias: diasByTrilha[t.id] ?? [] }))
    .filter((g) => g.dias.length > 0);

  const dayBlocks: (Paragraph | Table)[] = [];
  let dayCounter = 0;
  const multipleTrilhas = trilhasComDias.length > 1;
  for (const g of trilhasComDias) {
    if (multipleTrilhas) {
      dayBlocks.push(new Paragraph({
        pageBreakBefore: true,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: `Trilha · ${g.trilha.nome}`, bold: true, color: PRIMARY, size: 44 })],
      }));
    }
    for (const d of g.dias) {
      dayBlocks.push(...buildDay(d, dayCounter, false));
      dayCounter++;
    }
  }

  const body: (Paragraph | Table)[] = [
    ...buildCover(projeto, edicao, stats),
    ...buildSummary(composed),
    ...dayBlocks,
  ];

  const doc = new Document({
    creator: "Mensageria",
    title: `Mensageria - ${projeto.nome} - ${edicao.nome}`,
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `${projeto.nome} · ${edicao.nome}`, color: SUBTLE, size: 16 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
            children: [
              new TextRun({ text: "Página ", color: MUTED, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
            ],
          })],
        }),
      },
      children: body,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = sanitizeFilename(`Mensageria - ${projeto.nome} - ${edicao.nome}`) + ".docx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
