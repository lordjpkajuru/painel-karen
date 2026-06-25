import { useEffect, useMemo, useState } from "react";
import { Dia, Trilha, supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, ArrowRight, Trash2, Pencil, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Props {
  dias: Dia[];
  edicaoId: string;
  trilhaId: string;
  trilhas: Trilha[];
  diaId: string;
  onSelect: (id: string) => void;
}

export function DiaTabs({ dias, edicaoId, trilhaId, trilhas, diaId, onSelect }: Props) {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [editing, setEditing] = useState<Dia | null>(null);
  const [confirmDel, setConfirmDel] = useState<Dia | null>(null);
  const [movingDia, setMovingDia] = useState<Dia | null>(null);
  const [moveTargetTrilha, setMoveTargetTrilha] = useState<string>("");
  const [movingBusy, setMovingBusy] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["dias", edicaoId, trilhaId] });
    qc.invalidateQueries({ queryKey: ["dias", edicaoId] });
  }

  async function moveDia(dia: Dia, dir: -1 | 1) {
    const idx = dias.findIndex((d) => d.id === dia.id);
    const target = dias[idx + dir];
    if (!target) return;
    try {
      await supabase.from("dias").update({ ordem: -1 }).eq("id", dia.id);
      await supabase.from("dias").update({ ordem: dia.ordem }).eq("id", target.id);
      await supabase.from("dias").update({ ordem: target.ordem }).eq("id", dia.id);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao mover dia");
    }
  }

  async function doDelete(dia: Dia) {
    const { error } = await supabase.from("dias").delete().eq("id", dia.id);
    if (error) {
      toast.error("Erro ao excluir dia");
      return;
    }
    toast.success("Dia excluído");
    setConfirmDel(null);
    if (diaId === dia.id) {
      const remaining = dias.filter((d) => d.id !== dia.id);
      onSelect(remaining[0]?.id ?? "");
    }
    refresh();
  }

  function startMove(dia: Dia) {
    const others = trilhas.filter((t) => t.id !== dia.trilha_id);
    if (others.length === 0) {
      toast.error("Não há outra trilha para mover");
      return;
    }
    setMovingDia(dia);
    setMoveTargetTrilha(others[0].id);
  }

  async function confirmMove() {
    if (!movingDia) return;
    const targetTrilhaId = moveTargetTrilha;
    if (!targetTrilhaId || targetTrilhaId === movingDia.trilha_id) return;
    setMovingBusy(true);
    try {
      // Slugs in target
      const { data: existing, error: e1 } = await supabase
        .from("dias").select("slug, ordem")
        .eq("trilha_id", targetTrilhaId);
      if (e1) throw e1;
      const slugs = new Set((existing ?? []).map((r: any) => r.slug));
      let newSlug = movingDia.slug;
      if (slugs.has(newSlug)) {
        let i = 2;
        const base = newSlug.replace(/-\d+$/, "");
        while (slugs.has(`${base}-${i}`)) i++;
        newSlug = `${base}-${i}`;
      }
      const maxOrdem = (existing ?? []).reduce((m: number, r: any) => Math.max(m, r.ordem ?? 0), -1);
      const { error: e2 } = await supabase.from("dias").update({
        trilha_id: targetTrilhaId,
        slug: newSlug,
        ordem: maxOrdem + 1,
      }).eq("id", movingDia.id);
      if (e2) throw e2;
      const tname = trilhas.find((t) => t.id === targetTrilhaId)?.nome ?? "trilha";
      toast.success(`Dia movido para a trilha ${tname}`);
      if (diaId === movingDia.id) {
        const remaining = dias.filter((d) => d.id !== movingDia.id);
        onSelect(remaining[0]?.id ?? "");
      }
      setMovingDia(null);
      refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao mover dia: ${e?.message ?? ""}`);
    } finally {
      setMovingBusy(false);
    }
  }

  const otherTrilhas = useMemo(
    () => trilhas.filter((t) => t.id !== movingDia?.trilha_id),
    [trilhas, movingDia],
  );

  return (
    <>
      <div className="relative">
        <ScrollArea className="w-full">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 pr-12 sm:pr-14">
            <Tabs value={diaId} onValueChange={onSelect}>
              <TabsList className="h-12 bg-transparent gap-1 p-0 flex flex-nowrap w-max">
                {dias.map((d, i) => {
                  const active = d.id === diaId;
                  return (
                    <ContextMenu key={d.id}>
                      <ContextMenuTrigger asChild>
                        <TabsTrigger
                          value={d.id}
                          className={`relative shrink-0 rounded-md px-3 min-h-[44px] text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2 transition-colors
                            ${active
                              ? "bg-accent/15 text-accent font-bold border-b-[3px] border-accent rounded-b-none"
                              : "text-muted-foreground hover:text-foreground font-medium"}`}
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />}
                          {d.nome}
                        </TabsTrigger>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => setEditing(d)}>
                          <Pencil className="w-4 h-4 mr-2" /> Renomear dia
                        </ContextMenuItem>
                        <ContextMenuItem disabled={i === 0} onClick={() => moveDia(d, -1)}>
                          <ArrowLeft className="w-4 h-4 mr-2" /> Mover pra esquerda
                        </ContextMenuItem>
                        <ContextMenuItem disabled={i === dias.length - 1} onClick={() => moveDia(d, 1)}>
                          <ArrowRight className="w-4 h-4 mr-2" /> Mover pra direita
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          disabled={trilhas.length < 2}
                          onClick={() => startMove(d)}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" /> Mover para trilha…
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDel(d)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir dia
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
                <div className="w-10 shrink-0" aria-hidden />
              </TabsList>
            </Tabs>
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center pl-8 pr-2 sm:pr-4 bg-gradient-to-l from-panel via-panel/90 to-transparent">
          <Button
            size="icon"
            variant="outline"
            className="pointer-events-auto h-9 w-9 shrink-0"
            onClick={() => setNovoOpen(true)}
            title="Novo dia"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <DiaModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        edicaoId={edicaoId}
        trilhaId={trilhaId}
        nextOrdem={(dias[dias.length - 1]?.ordem ?? -1) + 1}
        onSaved={refresh}
      />
      <DiaModal
        open={!!editing}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
        edicaoId={edicaoId}
        trilhaId={trilhaId}
        nextOrdem={0}
        onSaved={refresh}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir dia {confirmDel?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Todas as ações deste dia serão removidas.
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

      <ResponsiveModal
        open={!!movingDia}
        onOpenChange={(v) => { if (!v) setMovingDia(null); }}
        title={`Mover "${movingDia?.nome ?? ""}" para outra trilha`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trilha de destino</Label>
            <Select value={moveTargetTrilha} onValueChange={setMoveTargetTrilha}>
              <SelectTrigger className="bg-panel-2"><SelectValue placeholder="Escolha a trilha" /></SelectTrigger>
              <SelectContent>
                {otherTrilhas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O dia (com todas as ações e blocos) será movido para o final da trilha escolhida.
              Se houver conflito de slug, será renomeado automaticamente.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setMovingDia(null)}>Cancelar</Button>
            <Button onClick={confirmMove} disabled={!moveTargetTrilha || movingBusy}>
              {movingBusy ? "Movendo..." : "Mover"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}

function DiaModal({ open, onClose, edicaoId, trilhaId, editing, nextOrdem, onSaved }: {
  open: boolean;
  onClose: () => void;
  edicaoId: string;
  trilhaId: string;
  editing?: Dia;
  nextOrdem: number;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [data, setData] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setSlug(editing?.slug ?? "");
      setData(editing?.data ?? "");
      setSlugTouched(!!editing);
    }
  }, [open, editing]);

  function onNomeChange(v: string) {
    setNome(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    const finalSlug = slug.trim() || slugify(nome);
    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        slug: finalSlug,
        data: data || null,
      };
      if (editing) {
        const { error } = await supabase.from("dias").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Dia atualizado");
      } else {
        const { error } = await supabase.from("dias").insert({
          ...payload,
          edicao_id: edicaoId,
          trilha_id: trilhaId,
          ordem: nextOrdem,
        });
        if (error) throw error;
        toast.success("Dia criado");
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar dia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(v) => { if (!v) onClose(); }} title={editing ? "Renomear dia" : "Novo dia"}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={nome}
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Ex: Quinta"
            className="bg-panel-2"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            placeholder="ex: qui"
            className="bg-panel-2 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="bg-panel-2"
          />
          <p className="text-xs text-muted-foreground">
            Aparece no PDF como "segunda-feira, 11 de maio de 2026". Pode deixar em branco.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{editing ? "Salvar" : "Criar"}</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
