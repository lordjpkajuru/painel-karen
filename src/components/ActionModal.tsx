import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Acao, Bloco, BlocoTipo, AcaoStatus, AcaoTipo, Variavel, supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlocoTextEditor } from "@/components/BlocoTextEditor";
import { toast } from "sonner";
import { Plus, X, ChevronUp, ChevronDown, Type, Image as ImageIcon } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  diaId: string;
  editing?: { acao: Acao; blocos: Bloco[] };
  variaveis?: Variavel[];
}

const STATUSES: AcaoStatus[] = ["rascunho", "pronto", "agendado", "enviado"];
const STATUS_LABEL: Record<AcaoStatus, string> = {
  rascunho: "Rascunho", pronto: "Pronto", agendado: "Agendado", enviado: "Enviado",
};

type DraftBloco = {
  id?: string;
  tipo: BlocoTipo;
  conteudo: string;
  url: string;
  descricao: string;
};

const TIPO_LABEL: Record<BlocoTipo, string> = {
  texto: "Texto", audio: "Áudio", video: "Vídeo", imagem: "Imagem", outro: "Outro",
};

export function ActionModal({ open, onClose, onSaved, diaId, editing, variaveis = [] }: Props) {
  const [tipo, setTipo] = useState<AcaoTipo>("MENSAGEM");
  const [horario, setHorario] = useState("09:00");
  const [contexto, setContexto] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [status, setStatus] = useState<AcaoStatus>("rascunho");
  const [grupoNome, setGrupoNome] = useState("");
  const [temBotoes, setTemBotoes] = useState(false);
  const [blocos, setBlocos] = useState<DraftBloco[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.acao.tipo);
      setHorario((editing.acao.horario || "09:00").slice(0, 5));
      setContexto(editing.acao.contexto ?? "");
      setRotulo(editing.acao.rotulo ?? "");
      setStatus(editing.acao.status);
      setTemBotoes(editing.acao.tem_botoes_api);
      setGrupoNome(editing.acao.tipo === "RENOMEAR_GRUPO" ? (editing.acao.conteudo ?? "") : "");
      const sorted = [...editing.blocos].sort((a, b) => a.ordem - b.ordem);
      setBlocos(sorted.map((b) => ({
        id: b.id, tipo: b.tipo,
        conteudo: b.conteudo ?? "", url: b.url ?? "", descricao: b.descricao ?? "",
      })));
    } else {
      setTipo("MENSAGEM");
      setHorario("09:00");
      setContexto(""); setRotulo(""); setStatus("rascunho");
      setGrupoNome(""); setTemBotoes(false); setBlocos([]);
    }
  }, [open, editing]);

  function updateBloco(i: number, patch: Partial<DraftBloco>) {
    setBlocos((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function moveBloco(i: number, dir: -1 | 1) {
    setBlocos((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function removeBloco(i: number) {
    setBlocos((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addText() {
    setBlocos((arr) => [...arr, { tipo: "texto", conteudo: "", url: "", descricao: "" }]);
  }
  function addMedia() {
    setBlocos((arr) => [...arr, { tipo: "imagem", conteudo: "", url: "", descricao: "" }]);
  }

  async function save() {
    if (!horario) return toast.error("Informe o horário");
    if (tipo === "RENOMEAR_GRUPO" && !grupoNome.trim()) return toast.error("Informe o nome do grupo");

    setSaving(true);
    try {
      const payload = {
        dia_id: diaId,
        tipo,
        horario: horario.length === 5 ? `${horario}:00` : horario,
        contexto: contexto.trim() || null,
        rotulo: rotulo.trim() || null,
        conteudo: tipo === "RENOMEAR_GRUPO" ? (grupoNome.trim() || null) : null,
        tem_botoes_api: tipo === "MENSAGEM" ? temBotoes : false,
        status,
      };

      let acaoId = editing?.acao.id;
      if (editing) {
        const { error } = await supabase.from("acoes").update(payload).eq("id", editing.acao.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("acoes").insert(payload).select("id").single();
        if (error) throw error;
        acaoId = data.id;
      }

      if (tipo === "MENSAGEM" && acaoId) {
        // Filter out empty blocos
        const valid = blocos.filter((b) =>
          b.tipo === "texto" ? (b.conteudo ?? "").trim() !== "" : (b.url ?? "").trim() !== "",
        );

        const existingIds = (editing?.blocos ?? []).map((b) => b.id);
        const keptIds = valid.filter((b) => b.id).map((b) => b.id!) as string[];
        const toDelete = existingIds.filter((id) => !keptIds.includes(id));
        if (toDelete.length > 0) {
          await supabase.from("blocos").delete().in("id", toDelete);
        }
        for (let i = 0; i < valid.length; i++) {
          const b = valid[i];
          const row = {
            tipo: b.tipo,
            conteudo: b.tipo === "texto" ? b.conteudo : null,
            url: b.tipo === "texto" ? null : b.url,
            descricao: b.tipo === "texto" ? null : (b.descricao || null),
            ordem: i,
          };
          if (b.id) {
            await supabase.from("blocos").update(row).eq("id", b.id);
          } else {
            await supabase.from("blocos").insert({ acao_id: acaoId, ...row });
          }
        }
      } else if (tipo === "RENOMEAR_GRUPO" && acaoId && (editing?.blocos.length ?? 0) > 0) {
        await supabase.from("blocos").delete().eq("acao_id", acaoId);
      }

      toast.success(editing ? "Ação atualizada" : "Ação criada");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={editing ? "Editar ação" : "Nova ação"}
      className="space-y-4"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as AcaoTipo)} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="MENSAGEM" id="t-msg" />
              <span className="text-sm">Mensagem</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="RENOMEAR_GRUPO" id="t-grp" />
              <span className="text-sm">Renomear Grupo</span>
            </label>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Horário</Label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="bg-panel-2" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AcaoStatus)}>
              <SelectTrigger className="bg-panel-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Contexto</Label>
            <Input value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="ex: AULA 5, PRÉ, CARRINHO" className="bg-panel-2" />
          </div>
          <div className="space-y-2">
            <Label>Rótulo</Label>
            <Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="ex: 🔴 NO AR, REPESCAGEM" className="bg-panel-2" />
          </div>
        </div>

        {tipo === "MENSAGEM" ? (
          <>
            <div className="space-y-2">
              <Label>Conteúdo (em ordem de envio)</Label>

              <div className="space-y-2">
                {blocos.length === 0 && (
                  <p className="text-xs text-muted-foreground italic px-1">
                    Nenhum bloco. Use os botões abaixo para adicionar texto ou mídia.
                  </p>
                )}

                {blocos.map((b, i) => (
                  <div key={b.id ?? `new-${i}`} className="bg-panel-2 rounded-md border border-border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={b.tipo} onValueChange={(v) => updateBloco(i, { tipo: v as BlocoTipo })}>
                        <SelectTrigger className="bg-panel h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="texto">{TIPO_LABEL.texto}</SelectItem>
                          <SelectItem value="audio">{TIPO_LABEL.audio}</SelectItem>
                          <SelectItem value="video">{TIPO_LABEL.video}</SelectItem>
                          <SelectItem value="imagem">{TIPO_LABEL.imagem}</SelectItem>
                          <SelectItem value="outro">{TIPO_LABEL.outro}</SelectItem>
                        </SelectContent>
                      </Select>

                      <span className="text-[11px] text-muted-foreground font-mono">#{i + 1}</span>

                      <div className="flex items-center gap-0.5 ml-auto">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                          disabled={i === 0} onClick={() => moveBloco(i, -1)} title="Mover para cima">
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                          disabled={i === blocos.length - 1} onClick={() => moveBloco(i, 1)} title="Mover para baixo">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => removeBloco(i)} title="Remover">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {b.tipo === "texto" ? (
                      <BlocoTextEditor
                        value={b.conteudo}
                        onChange={(next) => updateBloco(i, { conteudo: next })}
                        variaveis={variaveis}
                        placeholder="Texto. Use [LINK AULA 1] etc. *negrito* _itálico_ ~riscado~ ```mono```"
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="URL"
                          value={b.url}
                          onChange={(e) => updateBloco(i, { url: e.target.value })}
                          className="bg-panel h-9"
                        />
                        <Input
                          placeholder="Descrição (opcional)"
                          value={b.descricao}
                          onChange={(e) => updateBloco(i, { descricao: e.target.value })}
                          className="bg-panel h-9"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addText}>
                  <Type className="w-3.5 h-3.5" /> Adicionar texto
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addMedia}>
                  <ImageIcon className="w-3.5 h-3.5" /> Adicionar mídia
                </Button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 p-3 bg-panel-2 rounded-md border border-border cursor-pointer">
              <span className="text-sm">É mensagem com botões/CTA estruturado (API)</span>
              <Switch checked={temBotoes} onCheckedChange={setTemBotoes} />
            </label>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Nome novo do grupo</Label>
            <Input
              value={grupoNome}
              onChange={(e) => setGrupoNome(e.target.value)}
              placeholder="Nome novo do grupo"
              className="bg-panel-2 font-mono"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/0">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
