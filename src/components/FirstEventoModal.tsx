import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { DEFAULT_DIA_SLUGS, DEFAULT_DIA_NOMES, DEFAULT_VARIAVEIS } from "@/lib/mensageria";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  projetoId: string;
  onCreated: (edicaoId: string) => void;
}

type Template = "despertar7" | "blank";

export function FirstEventoModal({ open, onClose, projetoId, onCreated }: Props) {
  const [nomeEvento, setNomeEvento] = useState("");
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [template, setTemplate] = useState<Template>("despertar7");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNomeEvento(""); setNomeEdicao("");
      setDataInicio(""); setDataFim("");
      setAtiva(true); setTemplate("despertar7");
    }
  }, [open]);

  async function save() {
    if (!nomeEvento.trim()) return toast.error("Informe o nome do evento");
    if (!nomeEdicao.trim()) return toast.error("Informe o nome da edição");
    setSaving(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("eventos")
        .insert({ projeto_id: projetoId, nome: nomeEvento.trim(), ordem: 0 })
        .select("id").single();
      if (evErr) throw evErr;

      const { data: ed, error: edErr } = await supabase.from("edicoes").insert({
        evento_id: ev.id,
        nome: nomeEdicao.trim(),
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        ativa,
      }).select("id").single();
      if (edErr) throw edErr;

      // Sempre cria uma trilha "Normal" (default)
      const { data: tr, error: trErr } = await supabase.from("trilhas").insert({
        edicao_id: ed.id, nome: "Normal", ordem: 0,
      }).select("id").single();
      if (trErr) throw trErr;

      if (template === "despertar7") {
        const diasPayload = DEFAULT_DIA_SLUGS.map((slug, i) => ({
          edicao_id: ed.id,
          trilha_id: tr.id,
          nome: DEFAULT_DIA_NOMES[slug],
          slug,
          data: null,
          ordem: i,
        }));
        await supabase.from("dias").insert(diasPayload);

        await supabase.from("variaveis").insert(
          DEFAULT_VARIAVEIS.map((v, i) => ({
            edicao_id: ed.id, chave: v.chave, tipo: v.tipo, valor: "", ordem: i,
          }))
        );
      }

      toast.success("Evento criado");
      onCreated(ed.id);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Criar primeiro evento">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do evento</Label>
          <Input
            autoFocus value={nomeEvento} onChange={(e) => setNomeEvento(e.target.value)}
            placeholder="ex: Devocional Mensal" className="bg-panel-2"
          />
        </div>
        <div className="space-y-2">
          <Label>Nome da primeira edição</Label>
          <Input
            value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)}
            placeholder="ex: mai26" className="bg-panel-2 font-mono"
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

        <label className="flex items-center justify-between gap-3 p-3 bg-panel-2 rounded-md border border-border cursor-pointer">
          <span className="text-sm">Marcar edição como ativa</span>
          <Switch checked={ativa} onCheckedChange={setAtiva} />
        </label>

        <div className="space-y-2">
          <Label>Template de dias</Label>
          <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
            <SelectTrigger className="bg-panel-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="despertar7">Evento de 7 dias (Pré · Seg-Dom · Carrinho)</SelectItem>
              <SelectItem value="blank">Em branco (criar dias depois)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
