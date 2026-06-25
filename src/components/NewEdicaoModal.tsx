import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, Edicao } from "@/lib/supabase";
import { DEFAULT_DIA_SLUGS, DEFAULT_DIA_NOMES, DEFAULT_VARIAVEIS } from "@/lib/mensageria";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (newEdicaoId: string) => void;
  eventoId: string;
  edicaoAtiva?: Edicao;
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const err = error as { message?: unknown; details?: unknown; code?: unknown };
    return [err.message, err.details, err.code].filter(Boolean).map(String).join(" — ") || "Erro ao criar edição";
  }
  return typeof error === "string" ? error : "Erro ao criar edição";
}

export function NewEdicaoModal({ open, onClose, onSaved, eventoId, edicaoAtiva }: Props) {
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [duplicar, setDuplicar] = useState(true);
  const [marcarAtiva, setMarcarAtiva] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edicoes, setEdicoes] = useState<Edicao[]>([]);
  const [sourceEdicaoId, setSourceEdicaoId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setNome(""); setDataInicio(""); setDataFim("");
    setDuplicar(!!edicaoAtiva); setMarcarAtiva(true);

    (async () => {
      const { data, error } = await supabase
        .from("edicoes")
        .select("*")
        .eq("evento_id", eventoId)
        .order("criado_em", { ascending: false });
      if (error) {
        console.error("[NovaEdição] erro ao carregar edições:", error);
        return;
      }
      const list = (data ?? []) as Edicao[];
      setEdicoes(list);
      const defaultId = list.find((e) => e.ativa)?.id ?? edicaoAtiva?.id ?? list[0]?.id ?? "";
      setSourceEdicaoId(defaultId);
    })();
  }, [open, eventoId, edicaoAtiva]);

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    if (duplicar && !sourceEdicaoId) return toast.error("Selecione a edição de origem");
    setSaving(true);
    try {
      // 1. Criar edição inativa
      const { data: edData, error: edErr } = await supabase.from("edicoes").insert({
        evento_id: eventoId,
        nome: nome.trim(),
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        ativa: false,
      }).select("id").single();
      if (edErr) throw edErr;
      const novaEdicaoId = edData.id;

      if (duplicar && sourceEdicaoId) {
        // Duplica tudo via RPC: trilhas, dias, ações, blocos, variáveis
        console.log("[Duplicar] source:", sourceEdicaoId, "target:", novaEdicaoId);
        const { data: rpcData, error: rpcErr } = await supabase.rpc("duplicar_edicao_completa", {
          source_edicao_id: sourceEdicaoId,
          target_edicao_id: novaEdicaoId,
        });
        if (rpcErr) {
          console.error("[Duplicar] erro:", rpcErr);
          toast.error(`Erro ao duplicar: ${rpcErr.message}`);
          setSaving(false);
          return;
        }
        const r = (rpcData as any) ?? {};
        const t = r.trilhas_copiadas ?? 0;
        const d = r.dias_copiados ?? 0;
        const a = r.acoes_copiadas ?? 0;
        const b = r.blocos_copiados ?? 0;
        toast.success(`Duplicado: ${t} trilhas, ${d} dias, ${a} ações, ${b} blocos.`);
      } else {
        // Edição em branco: 1 trilha "Normal" + dias padrão + variáveis padrão
        const { data: trilhaData, error: trilhaErr } = await supabase.from("trilhas").insert({
          edicao_id: novaEdicaoId,
          nome: "Normal",
          ordem: 0,
        }).select("id").single();
        if (trilhaErr) throw trilhaErr;
        const trilhaId = trilhaData.id;

        const diasPayload = DEFAULT_DIA_SLUGS.map((slug, i) => ({
          edicao_id: novaEdicaoId,
          trilha_id: trilhaId,
          nome: DEFAULT_DIA_NOMES[slug],
          slug,
          data: null,
          ordem: i,
        }));
        const { error: diasErr } = await supabase.from("dias").insert(diasPayload);
        if (diasErr) throw diasErr;

        await supabase.from("variaveis").insert(
          DEFAULT_VARIAVEIS.map((v, i) => ({
            edicao_id: novaEdicaoId, chave: v.chave, tipo: v.tipo, valor: "", ordem: i,
          }))
        );
      }

      if (marcarAtiva) {
        const { error: desativarErr } = await supabase
          .from("edicoes")
          .update({ ativa: false })
          .eq("evento_id", eventoId)
          .neq("id", novaEdicaoId);
        if (desativarErr) throw desativarErr;

        const { error: ativarErr } = await supabase
          .from("edicoes")
          .update({ ativa: true })
          .eq("id", novaEdicaoId);
        if (ativarErr) throw ativarErr;
      }

      toast.success("Edição criada");
      onSaved(novaEdicaoId);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const hasEdicoes = edicoes.length > 0;

  return (
    <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Nova edição">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            autoFocus
            value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="ex: jul26" className="bg-panel-2 font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-panel-2" />
          </div>
          <div className="space-y-2">
            <Label>Data fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-panel-2" />
          </div>
        </div>

        {hasEdicoes && (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 p-3 bg-panel-2 rounded-md border border-border cursor-pointer">
              <span className="text-sm">Duplicar dias e ações</span>
              <Switch checked={duplicar} onCheckedChange={setDuplicar} />
            </label>
            {duplicar && (
              <div className="space-y-2">
                <Label>Duplicar de qual edição?</Label>
                <Select value={sourceEdicaoId} onValueChange={setSourceEdicaoId}>
                  <SelectTrigger className="bg-panel-2 font-mono">
                    <SelectValue placeholder="Selecione uma edição" />
                  </SelectTrigger>
                  <SelectContent>
                    {edicoes.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="font-mono">
                        {e.nome}{e.ativa ? " (ativa)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <label className="flex items-center justify-between gap-3 p-3 bg-panel-2 rounded-md border border-border cursor-pointer">
          <span className="text-sm">Marcar como ativa</span>
          <Switch checked={marcarAtiva} onCheckedChange={setMarcarAtiva} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Criar edição</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
