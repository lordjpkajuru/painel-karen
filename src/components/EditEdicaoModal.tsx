import { useEffect, useState } from "react";
import { ResponsiveModal } from "./ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase, Edicao } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edicao: Edicao | undefined;
  onSaved: () => void;
  onDeleted: () => void;
}

export function EditEdicaoModal({ open, onOpenChange, edicao, onSaved, onDeleted }: Props) {
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ativa, setAtiva] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (edicao && open) {
      setNome(edicao.nome ?? "");
      setDataInicio(edicao.data_inicio ?? "");
      setDataFim(edicao.data_fim ?? "");
      setAtiva(!!edicao.ativa);
    }
  }, [edicao, open]);

  async function save() {
    if (!edicao) return;
    if (!nome.trim()) {
      toast.error("Informe o nome da edição");
      return;
    }
    setSaving(true);
    try {
      if (ativa && !edicao.ativa) {
        // unset others in same evento
        await supabase.from("edicoes").update({ ativa: false })
          .eq("evento_id", edicao.evento_id).neq("id", edicao.id);
      }
      const { error } = await supabase.from("edicoes").update({
        nome: nome.trim(),
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        ativa,
      }).eq("id", edicao.id);
      if (error) throw error;
      toast.success("Edição atualizada");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!edicao) return;
    setDeleting(true);
    const { error } = await supabase.from("edicoes").delete().eq("id", edicao.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Edição excluída");
    setConfirmDelete(false);
    onOpenChange(false);
    onDeleted();
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title="Editar edição"
        description="Atualize os dados da edição ou exclua-a permanentemente."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-nome">Nome</Label>
            <Input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: mai26" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-ini">Data início</Label>
              <Input id="ed-ini" type="date" value={dataInicio ?? ""} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-fim">Data fim</Label>
              <Input id="ed-fim" type="date" value={dataFim ?? ""} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="ed-ativa" className="cursor-pointer">Edição ativa</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ao ativar, as outras edições deste evento ficam inativas.
              </p>
            </div>
            <Switch id="ed-ativa" checked={ativa} onCheckedChange={setAtiva} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>

          <Separator className="my-2" />

          <div>
            <Button
              variant="destructive"
              className="gap-2 w-full sm:w-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={!edicao}
            >
              <Trash2 className="w-4 h-4" /> Excluir edição
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá todas as ações, dias e variáveis desta edição. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
