import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase, Variavel, Edicao, VariavelTipo } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edicao?: Edicao;
  variaveis: Variavel[];
  onSaved: () => void;
}

export function VariablesSheet({ open, onOpenChange, edicao, variaveis, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Variavel | null>(null);

  useEffect(() => {
    if (open) {
      const d: Record<string, string> = {};
      variaveis.forEach((v) => { d[v.id] = v.valor ?? ""; });
      setDraft(d);
    }
  }, [open, variaveis]);

  const filledCount = Object.entries(draft).filter(([, v]) => (v ?? "").trim() !== "").length;

  async function save() {
    setSaving(true);
    try {
      for (const v of variaveis) {
        const novo = (draft[v.id] ?? "").trim();
        const atual = (v.valor ?? "").trim();
        if (novo !== atual) {
          const { error } = await supabase.from("variaveis").update({ valor: novo }).eq("id", v.id);
          if (error) throw error;
        }
      }
      toast.success("Variáveis salvas");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-panel border-border">
          <SheetHeader className="p-4 sm:p-6 border-b border-border">
            <SheetTitle>Variáveis da edição {edicao?.nome ?? ""}</SheetTitle>
            <SheetDescription>
              {filledCount} de {variaveis.length} preenchidas
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {variaveis.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhuma variável cadastrada ainda.</p>
            )}
            {variaveis.map((v) => {
              const filled = (draft[v.id] ?? "").trim() !== "";
              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-md bg-panel-2 border border-border border-l-[3px] transition-colors ${
                    filled ? "border-l-accent" : "border-l-border"
                  }`}
                >
                  <Label className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                    {v.chave} <span className="ml-1 normal-case opacity-70">[{v.tipo}]</span>
                  </Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type={v.tipo === "url" ? "url" : "text"}
                      value={draft[v.id] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [v.id]: e.target.value }))}
                      placeholder={v.tipo === "url" ? "https://..." : "Valor"}
                      className="bg-panel font-mono text-sm h-9 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setEditing(v)}
                      title="Editar variável"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 sm:p-6 border-t border-border space-y-2 bg-panel">
            <Button variant="outline" className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" /> Adicionar variável
            </Button>
            <Button className="w-full gap-2" onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AddVarModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        edicaoId={edicao?.id}
        nextOrdem={variaveis.length}
        existingChaves={variaveis.map((v) => v.chave)}
        onSaved={onSaved}
      />

      <EditVarModal
        variavel={editing}
        onClose={() => setEditing(null)}
        existingChaves={variaveis.map((v) => v.chave)}
        onSaved={onSaved}
      />
    </>
  );
}

function AddVarModal({ open, onClose, edicaoId, nextOrdem, existingChaves, onSaved }: {
  open: boolean; onClose: () => void; edicaoId?: string; nextOrdem: number; existingChaves: string[]; onSaved: () => void;
}) {
  const [chave, setChave] = useState("");
  const [tipo, setTipo] = useState<"url" | "texto">("url");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setChave(""); setTipo("url"); }
  }, [open]);

  const trimmed = chave.trim().toUpperCase();
  const duplicado = trimmed !== "" && existingChaves.some((c) => c.trim().toUpperCase() === trimmed);

  async function save() {
    if (!edicaoId) return toast.error("Edição não selecionada");
    if (!trimmed) return toast.error("Informe a chave");
    if (duplicado) return toast.error("Já existe uma variável com essa chave");
    setSaving(true);
    try {
      const { error } = await supabase.from("variaveis").insert({
        edicao_id: edicaoId,
        chave: trimmed,
        tipo,
        valor: "",
        ordem: nextOrdem,
      });
      if (error) throw error;
      toast.success("Variável adicionada");
      onSaved(); onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao adicionar");
    } finally { setSaving(false); }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Nova variável">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Chave</Label>
          <Input
            value={chave}
            onChange={(e) => setChave(e.target.value.toUpperCase())}
            placeholder="LINK CARRINHO"
            className="bg-panel-2 font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Use letras maiúsculas. Será referenciada como [{trimmed || "EXEMPLO"}]
          </p>
          {duplicado && (
            <p className="text-xs text-destructive">Já existe uma variável com essa chave nesta edição.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as "url" | "texto")}>
            <SelectTrigger className="bg-panel-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="texto">Texto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || duplicado || !trimmed}>Adicionar</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function EditVarModal({ variavel, onClose, existingChaves, onSaved }: {
  variavel: Variavel | null;
  onClose: () => void;
  existingChaves: string[];
  onSaved: () => void;
}) {
  const open = !!variavel;
  const [chave, setChave] = useState("");
  const [tipo, setTipo] = useState<VariavelTipo>("url");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (variavel) {
      setChave(variavel.chave);
      setTipo(variavel.tipo);
    }
  }, [variavel]);

  if (!variavel) return null;

  const trimmed = chave.trim().toUpperCase();
  const duplicado =
    trimmed !== "" &&
    trimmed !== variavel.chave.trim().toUpperCase() &&
    existingChaves.some((c) => c.trim().toUpperCase() === trimmed);

  async function save() {
    if (!trimmed) return toast.error("Informe a chave");
    if (duplicado) return toast.error("Já existe uma variável com essa chave");
    setSaving(true);
    try {
      const { error } = await supabase.from("variaveis").update({
        chave: trimmed,
        tipo,
      }).eq("id", variavel!.id);
      if (error) throw error;
      toast.success("Variável atualizada");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      const { error } = await supabase.from("variaveis").delete().eq("id", variavel!.id);
      if (error) throw error;
      toast.success("Variável excluída");
      onSaved();
      setConfirmDel(false);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Editar variável">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Chave</Label>
            <Input
              value={chave}
              onChange={(e) => setChave(e.target.value.toUpperCase())}
              placeholder="LINK CARRINHO"
              className="bg-panel-2 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Será referenciada como [{trimmed || "EXEMPLO"}]
            </p>
            {duplicado && (
              <p className="text-xs text-destructive">Já existe uma variável com essa chave.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as VariavelTipo)}>
              <SelectTrigger className="bg-panel-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="texto">Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving || duplicado || !trimmed}>Salvar alterações</Button>
          </div>

          <div className="border-t border-border pt-4">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setConfirmDel(true)}
              disabled={saving}
            >
              <Trash2 className="w-4 h-4" /> Excluir variável
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir variável [{variavel.chave}]?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Mensagens que usam [{variavel.chave}] voltarão a mostrar o placeholder em vermelho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
