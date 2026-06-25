import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, Atalho, PainelItem, Projeto } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { slug = "", atalhoId = "" } = useParams<{ slug: string; atalhoId: string }>();

  const projetoQ = useQuery({
    queryKey: ["projeto", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return (data as Projeto) ?? null;
    },
  });

  const atalhoQ = useQuery({
    queryKey: ["atalho", atalhoId],
    enabled: !!atalhoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("atalhos").select("*").eq("id", atalhoId).maybeSingle();
      if (error) throw error;
      return (data as Atalho) ?? null;
    },
  });

  const itensQ = useQuery({
    queryKey: ["painel_itens", atalhoId],
    enabled: !!atalhoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_itens").select("*").eq("atalho_id", atalhoId).order("ordem");
      if (error) throw error;
      return data as PainelItem[];
    },
  });

  // local draft state for editing without losing focus on every keystroke
  const [draft, setDraft] = useState<Record<string, { atividade: string; falar_com: string }>>({});

  useEffect(() => {
    if (!itensQ.data) return;
    setDraft((prev) => {
      const next: typeof prev = {};
      for (const it of itensQ.data) {
        next[it.id] = prev[it.id] ?? { atividade: it.atividade ?? "", falar_com: it.falar_com ?? "" };
      }
      return next;
    });
  }, [itensQ.data]);

  async function addLinha() {
    const ordem = (itensQ.data?.length ?? 0);
    const { error } = await supabase.from("painel_itens").insert({
      atalho_id: atalhoId, atividade: "", falar_com: "", ordem,
    });
    if (error) { console.error(error); return toast.error("Erro ao adicionar linha"); }
    qc.invalidateQueries({ queryKey: ["painel_itens", atalhoId] });
  }

  async function saveLinha(id: string) {
    const d = draft[id];
    if (!d) return;
    const { error } = await supabase.from("painel_itens")
      .update({ atividade: d.atividade, falar_com: d.falar_com }).eq("id", id);
    if (error) { console.error(error); toast.error("Erro ao salvar"); }
  }

  async function removeLinha(id: string) {
    if (!confirm("Remover esta linha?")) return;
    const { error } = await supabase.from("painel_itens").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    qc.invalidateQueries({ queryKey: ["painel_itens", atalhoId] });
  }

  const loading = projetoQ.isLoading || atalhoQ.isLoading || itensQ.isLoading;
  const itens = itensQ.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate("/")}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {atalhoQ.data?.nome ?? "Painel"}
            </h1>
            {projetoQ.data && (
              <p className="text-xs text-muted-foreground truncate">{projetoQ.data.nome}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden sm:block bg-panel border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-4 py-3 border-b border-border bg-panel-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                <div>Assunto</div>
                <div>Falar com</div>
                <div className="w-9" />
              </div>
              {itens.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma linha. Clique em "Nova linha" pra começar.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {itens.map((it) => (
                    <div key={it.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 items-center">
                      <Input
                        value={draft[it.id]?.atividade ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [it.id]: { ...p[it.id], atividade: e.target.value } }))}
                        onBlur={() => saveLinha(it.id)}
                        placeholder="Descreva mais informações..."
                        className="bg-panel-2 border-border"
                      />
                      <Input
                        value={draft[it.id]?.falar_com ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [it.id]: { ...p[it.id], falar_com: e.target.value } }))}
                        onBlur={() => saveLinha(it.id)}
                        placeholder="Nome do responsável..."
                        className="bg-panel-2 border-border"
                      />
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLinha(it.id)}
                        aria-label="Remover linha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {itens.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground bg-panel border-border border-dashed">
                  Nenhuma linha. Toque em "Nova linha" pra começar.
                </Card>
              ) : (
                itens.map((it) => (
                  <Card key={it.id} className="p-3 bg-panel border-border space-y-2">
                    <div className="space-y-1">
                      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Assunto</label>
                      <Input
                        value={draft[it.id]?.atividade ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [it.id]: { ...p[it.id], atividade: e.target.value } }))}
                        onBlur={() => saveLinha(it.id)}
                        placeholder="Descreva mais informações..."
                        className="bg-panel-2 border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Falar com</label>
                      <Input
                        value={draft[it.id]?.falar_com ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [it.id]: { ...p[it.id], falar_com: e.target.value } }))}
                        onBlur={() => saveLinha(it.id)}
                        placeholder="Nome do responsável..."
                        className="bg-panel-2 border-border"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost" size="sm"
                        className="gap-2 text-muted-foreground hover:text-destructive min-h-[44px]"
                        onClick={() => removeLinha(it.id)}
                      >
                        <Trash2 className="w-4 h-4" /> Remover
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div>
              <Button onClick={addLinha} className="gap-2 min-h-[44px] w-full sm:w-auto">
                <Plus className="w-4 h-4" /> Nova linha
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
