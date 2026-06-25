import { useEffect, useState } from "react";
import { supabase, Trilha, Dia } from "@/lib/supabase";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, ArrowRight, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  trilhas: Trilha[];
  edicaoId: string;
  trilhaId: string;
  currentDias: Dia[];
  onSelect: (id: string) => void;
}

export function TrilhaTabs({ trilhas, edicaoId, trilhaId, currentDias, onSelect }: Props) {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [editing, setEditing] = useState<Trilha | null>(null);
  const [confirmDel, setConfirmDel] = useState<Trilha | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["trilhas", edicaoId] });
  }

  async function moveTrilha(t: Trilha, dir: -1 | 1) {
    const idx = trilhas.findIndex((x) => x.id === t.id);
    const target = trilhas[idx + dir];
    if (!target) return;
    try {
      await supabase.from("trilhas").update({ ordem: -1 }).eq("id", t.id);
      await supabase.from("trilhas").update({ ordem: t.ordem }).eq("id", target.id);
      await supabase.from("trilhas").update({ ordem: target.ordem }).eq("id", t.id);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao mover trilha");
    }
  }

  async function doDelete(t: Trilha) {
    const { error } = await supabase.from("trilhas").delete().eq("id", t.id);
    if (error) {
      toast.error("Erro ao excluir trilha");
      return;
    }
    toast.success("Trilha excluída");
    setConfirmDel(null);
    if (trilhaId === t.id) {
      const remaining = trilhas.filter((x) => x.id !== t.id);
      onSelect(remaining[0]?.id ?? "");
    }
    refresh();
  }

  return (
    <>
      <div className="relative">
        <ScrollArea className="w-full">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 pr-12 sm:pr-14 py-2">
            <div className="flex flex-nowrap gap-1.5 w-max">
              {trilhas.map((t, i) => {
                const active = t.id === trilhaId;
                return (
                  <ContextMenu key={t.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={() => onSelect(t.id)}
                        className={`shrink-0 rounded-full px-4 min-h-[44px] text-xs sm:text-sm font-medium transition-colors border flex items-center gap-2
                          ${active
                            ? "bg-accent/15 text-accent border-accent/40"
                            : "bg-panel-2 text-muted-foreground border-border hover:text-foreground"}`}
                      >
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        {t.nome}
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => setEditing(t)}>
                        <Pencil className="w-4 h-4 mr-2" /> Renomear
                      </ContextMenuItem>
                      <ContextMenuItem disabled={i === 0} onClick={() => moveTrilha(t, -1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Mover pra esquerda
                      </ContextMenuItem>
                      <ContextMenuItem disabled={i === trilhas.length - 1} onClick={() => moveTrilha(t, 1)}>
                        <ArrowRight className="w-4 h-4 mr-2" /> Mover pra direita
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDel(t)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir trilha
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
              <div className="w-10 shrink-0" aria-hidden />
            </div>
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center pl-8 pr-2 sm:pr-4 bg-gradient-to-l from-panel via-panel/90 to-transparent">
          <Button
            size="sm"
            variant="outline"
            className="pointer-events-auto h-9 gap-1 shrink-0"
            onClick={() => setNovoOpen(true)}
            title="Nova trilha"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Trilha</span>
          </Button>
        </div>
      </div>

      <TrilhaModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        edicaoId={edicaoId}
        nextOrdem={(trilhas[trilhas.length - 1]?.ordem ?? -1) + 1}
        currentDias={currentDias}
        onSaved={(newId) => { refresh(); if (newId) onSelect(newId); }}
      />
      <TrilhaModal
        open={!!editing}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
        edicaoId={edicaoId}
        nextOrdem={0}
        currentDias={currentDias}
        onSaved={() => refresh()}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trilha {confirmDel?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dias, ações e mensagens desta trilha serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDel && doDelete(confirmDel)}
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

function TrilhaModal({ open, onClose, edicaoId, editing, nextOrdem, currentDias, onSaved }: {
  open: boolean;
  onClose: () => void;
  edicaoId: string;
  editing?: Trilha;
  nextOrdem: number;
  currentDias: Dia[];
  onSaved: (newId?: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [copiarDias, setCopiarDias] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setCopiarDias(false);
    }
  }, [open, editing]);

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("trilhas").update({ nome: nome.trim() }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Trilha atualizada");
        onSaved();
      } else {
        const { data, error } = await supabase.from("trilhas").insert({
          edicao_id: edicaoId,
          nome: nome.trim(),
          ordem: nextOrdem,
        }).select("id").single();
        if (error) throw error;
        const newId = data.id as string;
        if (copiarDias && currentDias.length > 0) {
          await supabase.from("dias").insert(
            currentDias.map((d) => ({
              edicao_id: edicaoId,
              trilha_id: newId,
              nome: d.nome,
              slug: d.slug,
              data: d.data,
              ordem: d.ordem,
            })),
          );
        }
        toast.success("Trilha criada");
        onSaved(newId);
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar trilha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title={editing ? "Renomear trilha" : "Nova trilha"}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: VIP"
            className="bg-panel-2"
            autoFocus
          />
        </div>
        {!editing && (
          <label className="flex items-center justify-between gap-3 p-3 bg-panel-2 rounded-md border border-border cursor-pointer">
            <span className="text-sm">Copiar os dias da trilha atual (sem mensagens)</span>
            <Switch checked={copiarDias} onCheckedChange={setCopiarDias} />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{editing ? "Salvar" : "Criar"}</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
