import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, Evento, Edicao, Dia, Acao, Bloco, Variavel, AcaoStatus, Projeto, Trilha } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ActionCard, collapseStorageKey } from "@/components/ActionCard";
import { ActionModal } from "@/components/ActionModal";
import { VariablesSheet } from "@/components/VariablesSheet";
import { NewEdicaoModal } from "@/components/NewEdicaoModal";
import { EditEdicaoModal } from "@/components/EditEdicaoModal";
import { DiaTabs } from "@/components/DiaTabs";
import { TrilhaTabs } from "@/components/TrilhaTabs";
import { FirstEventoModal } from "@/components/FirstEventoModal";
import {
  ArrowLeft, Plus, Wrench, Pencil, ChevronsDownUp, ChevronsUpDown, Calendar,
  Search, X, Check, Download, Loader2,
} from "lucide-react";
import { exportEdicaoToDocx } from "@/lib/exportDocx";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_FILTERS: { value: AcaoStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "pronto", label: "Pronto" },
  { value: "agendado", label: "Agendado" },
  { value: "enviado", label: "Enviado" },
];

function normalize(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function addMinuteToHorario(h: string): string {
  // h like "HH:MM" or "HH:MM:SS"
  const m = (h || "").match(/^(\d{2}):(\d{2})/);
  if (!m) return "00:01:00";
  let hh = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10) + 1;
  if (mm >= 60) { mm = 0; hh = (hh + 1) % 24; }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

export default function Mensageria() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { slug = "" } = useParams<{ slug: string }>();

  const [edicaoId, setEdicaoId] = useState<string>("");
  const [trilhaId, setTrilhaId] = useState<string>("");
  const [diaId, setDiaId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AcaoStatus | "todos">("todos");
  const [search, setSearch] = useState("");
  const [varsOpen, setVarsOpen] = useState(false);
  const [novaEdOpen, setNovaEdOpen] = useState(false);
  const [editEdOpen, setEditEdOpen] = useState(false);
  const [firstEventoOpen, setFirstEventoOpen] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; editing?: { acao: Acao; blocos: Bloco[] } }>({ open: false });
  const [collapseTick, setCollapseTick] = useState(0);
  const [docLoading, setDocLoading] = useState(false);
  const [duplicateTo, setDuplicateTo] = useState<{ acao: Acao; blocos: Bloco[] } | null>(null);
  const [duplicateDiaId, setDuplicateDiaId] = useState<string>("");
  const scrollToAcaoIdRef = useRef<string | null>(null);

  // Projeto pelo slug
  const projetoQ = useQuery({
    queryKey: ["projeto", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return (data as Projeto) ?? null;
    },
  });

  const eventoQ = useQuery({
    queryKey: ["evento", projetoQ.data?.id],
    enabled: !!projetoQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos").select("*")
        .eq("projeto_id", projetoQ.data!.id).order("ordem");
      if (error) throw error;
      return (data as Evento[])[0] ?? null;
    },
  });

  const edicoesQ = useQuery({
    queryKey: ["edicoes", eventoQ.data?.id],
    enabled: !!eventoQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("edicoes").select("*")
        .eq("evento_id", eventoQ.data!.id).order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Edicao[];
    },
  });

  useEffect(() => {
    if (!edicaoId && edicoesQ.data && edicoesQ.data.length > 0) {
      const ativa = edicoesQ.data.find((e) => e.ativa) ?? edicoesQ.data[0];
      setEdicaoId(ativa.id);
    }
  }, [edicoesQ.data, edicaoId]);

  const trilhasQ = useQuery({
    queryKey: ["trilhas", edicaoId],
    enabled: !!edicaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("trilhas").select("*")
        .eq("edicao_id", edicaoId).order("ordem");
      if (error) throw error;
      return data as Trilha[];
    },
  });

  useEffect(() => {
    const list = trilhasQ.data;
    if (!list || list.length === 0) { setTrilhaId(""); return; }
    if (!trilhaId || !list.find((t) => t.id === trilhaId)) {
      setTrilhaId(list[0].id);
    }
  }, [trilhasQ.data, trilhaId]);

  // Reset trilha when edition changes
  useEffect(() => { setTrilhaId(""); }, [edicaoId]);

  const diasQ = useQuery({
    queryKey: ["dias", edicaoId, trilhaId],
    enabled: !!edicaoId && !!trilhaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("dias").select("*")
        .eq("trilha_id", trilhaId).order("ordem");
      if (error) throw error;
      return data as Dia[];
    },
  });

  useEffect(() => {
    if (diasQ.data && diasQ.data.length > 0) {
      if (!diaId || !diasQ.data.find((d) => d.id === diaId)) {
        setDiaId(diasQ.data[0].id);
      }
    } else {
      setDiaId("");
    }
  }, [diasQ.data, diaId]);

  const acoesQ = useQuery({
    queryKey: ["acoes", diaId],
    enabled: !!diaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*")
        .eq("dia_id", diaId)
        .order("horario", { ascending: true })
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return data as Acao[];
    },
  });

  const blocosQ = useQuery({
    queryKey: ["blocos", diaId, acoesQ.data?.map((a) => a.id).join(",")],
    enabled: !!acoesQ.data && acoesQ.data.length > 0,
    queryFn: async () => {
      const ids = acoesQ.data!.map((a) => a.id);
      const { data, error } = await supabase.from("blocos").select("*").in("acao_id", ids).order("ordem");
      if (error) throw error;
      return data as Bloco[];
    },
  });

  const variaveisQ = useQuery({
    queryKey: ["variaveis", edicaoId],
    enabled: !!edicaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("variaveis").select("*")
        .eq("edicao_id", edicaoId).order("ordem");
      if (error) throw error;
      return data as Variavel[];
    },
  });

  const variaveis = variaveisQ.data ?? [];
  const blocosByAcao = useMemo(() => {
    const map: Record<string, Bloco[]> = {};
    (blocosQ.data ?? []).forEach((b) => {
      (map[b.acao_id] ??= []).push(b);
    });
    return map;
  }, [blocosQ.data]);

  const acoesAll = acoesQ.data ?? [];
  const filteredAcoes = useMemo(() => {
    let list = acoesAll;
    if (statusFilter !== "todos") list = list.filter((a) => a.status === statusFilter);
    const q = normalize(search.trim());
    if (q) {
      list = list.filter((a) => {
        const hay = normalize(`${a.contexto ?? ""} ${a.rotulo ?? ""} ${a.conteudo ?? ""}`);
        return hay.includes(q);
      });
    }
    return list;
  }, [acoesAll, statusFilter, search]);

  const edicaoAtual = edicoesQ.data?.find((e) => e.id === edicaoId);
  const diaAtual = diasQ.data?.find((d) => d.id === diaId);

  // After acoes refetch, scroll to newly duplicated card
  useEffect(() => {
    const id = scrollToAcaoIdRef.current;
    if (!id) return;
    const el = document.getElementById(`acao-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1500);
      scrollToAcaoIdRef.current = null;
    }
  }, [acoesQ.data]);

  async function deleteAcao(acao: Acao) {
    if (!confirm("Excluir esta ação?")) return;
    const { error } = await supabase.from("acoes").delete().eq("id", acao.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Ação excluída");
    qc.invalidateQueries({ queryKey: ["acoes", diaId] });
    qc.invalidateQueries({ queryKey: ["blocos"] });
  }

  async function doDuplicate(acao: Acao, blocos: Bloco[], targetDiaId: string) {
    try {
      const newHorario = addMinuteToHorario(acao.horario || "00:00");
      const { data: novo, error } = await supabase.from("acoes").insert({
        dia_id: targetDiaId,
        tipo: acao.tipo,
        horario: newHorario,
        contexto: acao.contexto,
        rotulo: acao.rotulo,
        conteudo: acao.conteudo,
        tem_botoes_api: acao.tem_botoes_api,
        status: "rascunho",
      }).select("id").single();
      if (error) throw error;

      if (blocos.length > 0) {
        await supabase.from("blocos").insert(
          [...blocos]
            .sort((a, b) => a.ordem - b.ordem)
            .map((b, i) => ({
              acao_id: novo.id,
              tipo: b.tipo,
              conteudo: b.conteudo,
              url: b.url,
              descricao: b.descricao,
              ordem: i,
            })),
        );
      }

      toast.success("Ação duplicada");
      if (targetDiaId === diaId) {
        scrollToAcaoIdRef.current = novo.id;
      }
      qc.invalidateQueries({ queryKey: ["acoes", targetDiaId] });
      qc.invalidateQueries({ queryKey: ["blocos"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao duplicar");
    }
  }

  function handleDuplicate(acao: Acao, blocos: Bloco[], opts: { otherDay?: boolean }) {
    if (opts.otherDay) {
      setDuplicateTo({ acao, blocos });
      setDuplicateDiaId(diaId);
    } else {
      doDuplicate(acao, blocos, diaId);
    }
  }

  // ========== Render guards ==========

  if (projetoQ.isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!projetoQ.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Projeto não encontrado.</p>
          <Button onClick={() => navigate("/")}>Voltar ao Hub</Button>
        </div>
      </div>
    );
  }

  // Empty state — projeto sem evento
  if (!eventoQ.isLoading && !eventoQ.data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur border-b border-border">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar</span>
            </Button>
            <h1 className="text-sm sm:text-base font-semibold flex-1 truncate">
              Mensageria — {projetoQ.data.nome}
            </h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
          <p className="text-lg text-muted-foreground">
            Este projeto ainda não tem mensageria configurada.
          </p>
          <Button size="lg" className="gap-2 h-12 px-6" onClick={() => setFirstEventoOpen(true)}>
            <Plus className="w-5 h-5" /> Criar primeiro evento
          </Button>
        </main>

        <FirstEventoModal
          open={firstEventoOpen}
          onClose={() => setFirstEventoOpen(false)}
          projetoId={projetoQ.data.id}
          onCreated={(novaEdicaoId) => {
            qc.invalidateQueries({ queryKey: ["evento", projetoQ.data!.id] });
            qc.invalidateQueries({ queryKey: ["edicoes"] });
            setEdicaoId(novaEdicaoId);
          }}
        />
      </div>
    );
  }

  const ediResults = filteredAcoes.length;
  const ediTotal = acoesAll.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 shrink-0 px-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <h1 className="hidden md:block text-base font-semibold flex-1 text-center truncate">
            Mensageria — {projetoQ.data.nome}
          </h1>
          <h1 className="md:hidden text-sm font-semibold flex-1 truncate">Mensageria</h1>

          <div className="flex items-center gap-2 shrink-0">
            <Select value={edicaoId} onValueChange={setEdicaoId}>
              <SelectTrigger
                className="h-9 bg-panel-2 font-mono text-sm w-auto min-w-[140px] xs:min-w-[180px] max-w-[60vw] sm:max-w-none"
              >
                <SelectValue placeholder="Edição">
                  {edicaoAtual && (
                    <span className="flex items-center gap-1.5">
                      {edicaoAtual.ativa && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                      <span className="truncate">{edicaoAtual.nome}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-w-[90vw]">
                {(edicoesQ.data ?? []).map((e) => (
                  <SelectItem
                    key={e.id}
                    value={e.id}
                    className={`font-mono pl-8 relative ${
                      e.ativa ? "bg-accent/15 text-accent font-bold border-l-[3px] border-accent" : ""
                    }`}
                  >
                    {e.ativa && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
                    )}
                    <span className="flex items-center gap-2">
                      <span>{e.nome}</span>
                      {e.ativa && <Check className="w-3.5 h-3.5 ml-auto" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="icon" className="h-9 w-9"
              onClick={() => setEditEdOpen(true)} disabled={!edicaoId}
              title="Editar edição"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1 hidden sm:flex" onClick={() => setNovaEdOpen(true)}>
              <Plus className="w-3 h-3" /> Nova edição
            </Button>
            <Button variant="outline" size="icon" className="sm:hidden h-9 w-9" onClick={() => setNovaEdOpen(true)} title="Nova edição">
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-9"
              onClick={async () => {
                if (!projetoQ.data || !edicaoAtual) return;
                setDocLoading(true);
                try {
                  await exportEdicaoToDocx({ projeto: projetoQ.data, edicao: edicaoAtual });
                  toast.success("DOC gerado");
                } catch (e: any) {
                  console.error("[DOC] erro:", e);
                  toast.error(`Erro ao gerar DOC: ${e?.message || "desconhecido"}`);
                } finally {
                  setDocLoading(false);
                }
              }}
              disabled={!edicaoAtual || docLoading}
              title="Baixar DOC da edição"
            >
              {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Baixar DOC</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setVarsOpen(true)}>
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Variáveis</span>
            </Button>
          </div>
        </div>

        {edicaoId && (trilhasQ.data?.length ?? 0) > 0 && (
          <div className="border-t border-border bg-panel/95">
            <TrilhaTabs
              trilhas={trilhasQ.data ?? []}
              edicaoId={edicaoId}
              trilhaId={trilhaId}
              currentDias={diasQ.data ?? []}
              onSelect={setTrilhaId}
            />
          </div>
        )}

        {edicaoId && trilhaId && (
          <div className="border-t border-border bg-panel/95">
            <DiaTabs dias={diasQ.data ?? []} edicaoId={edicaoId} trilhaId={trilhaId} trilhas={trilhasQ.data ?? []} diaId={diaId} onSelect={setDiaId} />
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {diaAtual && (
          <DiaHeader
            dia={diaAtual}
            onSaved={() => qc.invalidateQueries({ queryKey: ["dias", edicaoId, trilhaId] })}
          />
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative w-full sm:w-64 order-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
              placeholder="Buscar mensagens..."
              className="pl-7 pr-8 h-8 bg-panel-2 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-panel"
                title="Limpar"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {search && (
            <span className="text-xs text-muted-foreground order-1 sm:order-2">
              {ediResults} de {ediTotal} ações
            </span>
          )}

          <div className="flex flex-wrap gap-1 flex-1 min-w-0 order-3">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 h-8 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === f.value
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "bg-panel-2 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0 order-4">
            <Button
              size="sm" variant="outline" className="gap-1 h-8 px-2"
              disabled={!diaId || acoesAll.length === 0}
              onClick={() => {
                acoesAll.forEach((a) => {
                  try { localStorage.setItem(collapseStorageKey(a.id), "0"); } catch {}
                });
                setCollapseTick((t) => t + 1);
              }}
              title="Expandir tudo"
            >
              <ChevronsUpDown className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Expandir</span>
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1 h-8 px-2"
              disabled={!diaId || acoesAll.length === 0}
              onClick={() => {
                acoesAll.forEach((a) => {
                  try { localStorage.setItem(collapseStorageKey(a.id), "1"); } catch {}
                });
                setCollapseTick((t) => t + 1);
              }}
              title="Recolher tudo"
            >
              <ChevronsDownUp className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Recolher</span>
            </Button>
            <Button
              size="sm" className="gap-1 ml-1"
              disabled={!diaId}
              onClick={() => setActionModal({ open: true })}
            >
              <Plus className="w-4 h-4" /> Nova ação
            </Button>
          </div>
        </div>

        {(eventoQ.isLoading || edicoesQ.isLoading || diasQ.isLoading || acoesQ.isLoading) && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        )}

        {!acoesQ.isLoading && diaId && filteredAcoes.length === 0 && (
          <div className="p-12 text-center border border-dashed border-border rounded-lg text-muted-foreground">
            {search
              ? "Nenhuma ação encontrada para essa busca."
              : `Nenhuma ação para este dia${statusFilter !== "todos" ? ` no status "${statusFilter}"` : ""}.`}
          </div>
        )}

        {filteredAcoes.length > 0 && (
          <div className="space-y-3">
            {filteredAcoes.map((acao) => (
              <ActionCard
                key={acao.id}
                acao={acao}
                blocos={blocosByAcao[acao.id] ?? []}
                variaveis={variaveis}
                collapseTick={collapseTick}
                onEdit={() => setActionModal({ open: true, editing: { acao, blocos: blocosByAcao[acao.id] ?? [] } })}
                onDelete={() => deleteAcao(acao)}
                onDuplicate={(opts) =>
                  handleDuplicate(acao, blocosByAcao[acao.id] ?? [], opts)
                }
              />
            ))}
          </div>
        )}
      </main>

      <ActionModal
        open={actionModal.open}
        onClose={() => setActionModal({ open: false })}
        diaId={diaId}
        editing={actionModal.editing}
        variaveis={variaveis}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["acoes", diaId] });
          qc.invalidateQueries({ queryKey: ["blocos"] });
        }}
      />

      <VariablesSheet
        open={varsOpen}
        onOpenChange={setVarsOpen}
        edicao={edicaoAtual}
        variaveis={variaveis}
        onSaved={() => qc.invalidateQueries({ queryKey: ["variaveis", edicaoId] })}
      />

      {eventoQ.data && (
        <NewEdicaoModal
          open={novaEdOpen}
          onClose={() => setNovaEdOpen(false)}
          eventoId={eventoQ.data.id}
          edicaoAtiva={edicaoAtual}
          onSaved={(novaId) => {
            qc.invalidateQueries({ queryKey: ["edicoes"] });
            setEdicaoId(novaId);
          }}
        />
      )}

      <EditEdicaoModal
        open={editEdOpen}
        onOpenChange={setEditEdOpen}
        edicao={edicaoAtual}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["edicoes"] });
        }}
        onDeleted={() => {
          const remaining = (edicoesQ.data ?? []).filter((e) => e.id !== edicaoId);
          const next = remaining.find((e) => e.ativa) ?? remaining[0];
          setEdicaoId(next?.id ?? "");
          qc.invalidateQueries({ queryKey: ["edicoes"] });
          if (!next) navigate("/");
        }}
      />

      {/* Duplicate-to-other-day dialog */}
      {duplicateTo && (
        <DuplicateToDayDialog
          dias={diasQ.data ?? []}
          currentDiaId={diaId}
          value={duplicateDiaId}
          onChange={setDuplicateDiaId}
          onCancel={() => setDuplicateTo(null)}
          onConfirm={async () => {
            await doDuplicate(duplicateTo.acao, duplicateTo.blocos, duplicateDiaId);
            setDuplicateTo(null);
          }}
        />
      )}
    </div>
  );
}

function DuplicateToDayDialog({
  dias, currentDiaId, value, onChange, onCancel, onConfirm,
}: {
  dias: Dia[];
  currentDiaId: string;
  value: string;
  onChange: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Lazy import to avoid loading dialog when not used
  // Use a lightweight inline dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-popover border border-border rounded-lg p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">Duplicar para outro dia</h3>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-panel-2"><SelectValue placeholder="Escolha um dia" /></SelectTrigger>
          <SelectContent>
            {dias.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nome} {d.id === currentDiaId && <span className="text-muted-foreground text-xs">(atual)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!value}>Duplicar</Button>
        </div>
      </div>
    </div>
  );
}

function DiaHeader({ dia, onSaved }: { dia: Dia; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dia.data ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(dia.data ?? ""); }, [dia.id, dia.data]);

  const formatted = dia.data
    ? format(parseISO(dia.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  async function persist(next: string | null) {
    setSaving(true);
    try {
      const { error } = await supabase.from("dias").update({ data: next }).eq("id", dia.id);
      if (error) throw error;
      toast.success(next ? "Data atualizada" : "Data removida");
      onSaved();
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao salvar data: ${e?.message ?? ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 px-4 py-3 bg-panel-2 rounded-lg border border-border">
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm sm:text-base font-semibold text-foreground">{dia.nome}</span>
      </div>
      <div className="mt-1 pl-7">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {formatted ? (
              <button
                type="button"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                title="Editar data"
              >
                {formatted}
              </button>
            ) : (
              <button
                type="button"
                className="text-xs text-accent/80 hover:text-accent inline-flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Adicionar data
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3 space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Data do dia</label>
              <Input
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="bg-panel-2"
                autoFocus
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                size="sm" variant="ghost"
                disabled={saving || !dia.data}
                onClick={() => persist(null)}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                disabled={saving || !value || value === (dia.data ?? "")}
                onClick={() => persist(value)}
              >
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
