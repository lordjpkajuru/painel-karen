import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, Projeto, Atalho } from "@/lib/supabase";
import { lock } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { DynamicIcon, ICON_OPTIONS } from "@/lib/icons";
import { LogOut, Plus, MoreVertical, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Hub() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const projetosQ = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").order("ordem");
      if (error) throw error;
      return data as Projeto[];
    },
  });

  const atalhosQ = useQuery({
    queryKey: ["atalhos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("atalhos").select("*").order("ordem");
      if (error) throw error;
      return data as Atalho[];
    },
  });

  const [projetoModal, setProjetoModal] = useState<{ open: boolean; editing?: Projeto }>({ open: false });
  const [atalhoModal, setAtalhoModal] = useState<{ open: boolean; editing?: Atalho; projetoId?: string }>({ open: false });
  const [delProjeto, setDelProjeto] = useState<Projeto | null>(null);
  const [delConfirmText, setDelConfirmText] = useState("");

  async function doDeleteProjeto() {
    if (!delProjeto) return;
    const { error } = await supabase.from("projetos").delete().eq("id", delProjeto.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Projeto excluído");
    qc.invalidateQueries({ queryKey: ["projetos"] });
    qc.invalidateQueries({ queryKey: ["atalhos"] });
    setDelProjeto(null);
    setDelConfirmText("");
  }

  function logout() {
    lock();
    navigate("/senha", { replace: true });
  }

  const projetos = projetosQ.data ?? [];
  const atalhos = atalhosQ.data ?? [];
  const loading = projetosQ.isLoading || atalhosQ.isLoading;

  // (no-op)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <span className="text-accent font-bold text-sm">W</span>
            </div>
            <h1 className="text-base sm:text-lg font-semibold">Painel WTD</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {loading && (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-24" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && projetos.length === 0 && (
          <Card className="p-8 text-center bg-panel border-border">
            <p className="text-muted-foreground mb-4">Nenhum projeto cadastrado.</p>
            <Button onClick={() => setProjetoModal({ open: true })} className="gap-2">
              <Plus className="w-4 h-4" /> Criar primeiro projeto
            </Button>
          </Card>
        )}

        {projetos.map((projeto) => {
          const items = atalhos.filter((a) => a.projeto_id === projeto.id);
          return (
            <section key={projeto.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold truncate">{projeto.nome}</h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setProjetoModal({ open: true, editing: projeto })}>
                        Editar projeto
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { setDelProjeto(projeto); setDelConfirmText(""); }}
                      >
                        Excluir projeto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={() => setAtalhoModal({ open: true, projetoId: projeto.id })}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo atalho</span>
                </Button>
              </div>

              {items.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground bg-panel border-border border-dashed">
                  Nenhum atalho. Clique em "Novo atalho" para adicionar.
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((a) => <ShortcutCard key={a.id} atalho={a} projetoSlug={projeto.slug} onEdit={() => setAtalhoModal({ open: true, editing: a })} />)}
                </div>
              )}

              <Button
                size="lg"
                className="w-full sm:w-auto mt-4 gap-2 h-12 px-6 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                onClick={() => navigate(`/projetos/${projeto.slug}/mensageria`)}
              >
                <Play className="w-5 h-5 fill-current" />
                Abrir Mensageria
              </Button>
            </section>
          );
        })}

        {!loading && projetos.length > 0 && (
          <div className="pt-2">
            <Button variant="outline" className="gap-2" onClick={() => setProjetoModal({ open: true })}>
              <Plus className="w-4 h-4" /> Novo projeto
            </Button>
          </div>
        )}
      </main>

      <ProjetoModal
        open={projetoModal.open}
        editing={projetoModal.editing}
        onClose={() => setProjetoModal({ open: false })}
        onSaved={() => qc.invalidateQueries({ queryKey: ["projetos"] })}
        nextOrdem={projetos.length}
      />
      <AtalhoModal
        open={atalhoModal.open}
        editing={atalhoModal.editing}
        projetoIdDefault={atalhoModal.projetoId}
        projetos={projetos}
        onClose={() => setAtalhoModal({ open: false })}
        onSaved={() => qc.invalidateQueries({ queryKey: ["atalhos"] })}
        nextOrdem={atalhos.length}
      />

      <AlertDialog
        open={!!delProjeto}
        onOpenChange={(v) => { if (!v) { setDelProjeto(null); setDelConfirmText(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto {delProjeto?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Isso vai remover todos os atalhos, eventos, edições, dias e ações deste projeto. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Digite o nome do projeto pra confirmar</Label>
            <Input
              value={delConfirmText}
              onChange={(e) => setDelConfirmText(e.target.value)}
              placeholder={delProjeto?.nome ?? ""}
              className="bg-panel-2 font-mono"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={delConfirmText !== (delProjeto?.nome ?? "")}
              onClick={doDeleteProjeto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Excluir projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShortcutCard({ atalho, projetoSlug, onEdit }: { atalho: Atalho; projetoSlug: string; onEdit: () => void }) {
  const qc = useQueryClient();
  const isPainel = atalho.tipo === "painel";
  const disabled = !isPainel && (!atalho.url || atalho.url === "#");

  async function remove() {
    if (!confirm(`Remover atalho "${atalho.nome}"?`)) return;
    const { error } = await supabase.from("atalhos").delete().eq("id", atalho.id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Atalho removido");
    qc.invalidateQueries({ queryKey: ["atalhos"] });
  }

  const cardInner = (
    <Card
      className={`group relative p-4 bg-panel border-border hover:border-accent/40 transition-all min-h-[88px] ${
        disabled ? "opacity-60" : "hover:bg-panel-2 cursor-pointer"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-panel-2 border border-border flex items-center justify-center shrink-0 group-hover:bg-accent/10 group-hover:border-accent/30 transition-colors">
          <DynamicIcon name={atalho.icone || "Box"} className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div className="font-medium text-sm leading-tight truncate">{atalho.nome}</div>
          {disabled ? (
            <Badge variant="outline" className="mt-2 text-[10px] border-warning/40 text-warning">
              configurar URL
            </Badge>
          ) : isPainel ? (
            <div className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1">
              <Play className="w-3 h-3" /> abrir painel
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> abrir
            </div>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={remove}>Remover</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );

  if (disabled) return cardInner;
  if (isPainel) {
    return (
      <Link to={`/projetos/${projetoSlug}/painel/${atalho.id}`} className="block">
        {cardInner}
      </Link>
    );
  }
  return (
    <a href={atalho.url} target="_blank" rel="noopener noreferrer" className="block">
      {cardInner}
    </a>
  );
}

function ProjetoModal({ open, editing, onClose, onSaved, nextOrdem }: {
  open: boolean; editing?: Projeto; onClose: () => void; onSaved: () => void; nextOrdem: number;
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  useStateOnOpen(open, () => {
    setNome(editing?.nome ?? "");
  });

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const slug = slugify(nome);
      if (editing) {
        const { error } = await supabase.from("projetos").update({ nome, slug }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Projeto atualizado");
      } else {
        const { error } = await supabase.from("projetos").insert({ nome, slug, ordem: nextOrdem });
        if (error) throw error;
        toast.success("Projeto criado");
      }
      onSaved(); onClose(); setNome("");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) { onClose(); setNome(""); } }}
      title={editing ? "Editar projeto" : "Novo projeto"}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Desafio Despertar"
            className="bg-panel-2"
          />
          <p className="text-xs text-muted-foreground">slug: {slugify(nome) || "—"}</p>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => { onClose(); setNome(""); }}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function AtalhoModal({ open, editing, projetoIdDefault, projetos, onClose, onSaved, nextOrdem }: {
  open: boolean;
  editing?: Atalho;
  projetoIdDefault?: string;
  projetos: Projeto[];
  onClose: () => void;
  onSaved: () => void;
  nextOrdem: number;
}) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [icone, setIcone] = useState<string>(editing?.icone ?? "Link2");
  const [tipo, setTipo] = useState<"url" | "painel">(editing?.tipo ?? "url");
  const [projetoId, setProjetoId] = useState<string>(editing?.projeto_id ?? projetoIdDefault ?? "");
  const [saving, setSaving] = useState(false);

  // initialize fields when modal opens
  useStateOnOpen(open, () => {
    setNome(editing?.nome ?? "");
    setUrl(editing?.url ?? "");
    setIcone(editing?.icone ?? "Link2");
    setTipo(editing?.tipo ?? "url");
    setProjetoId(editing?.projeto_id ?? projetoIdDefault ?? projetos[0]?.id ?? "");
  });

  async function save() {
    if (!nome.trim()) return toast.error("Informe o nome");
    if (!projetoId) return toast.error("Selecione um projeto");
    setSaving(true);
    try {
      const payload = {
        nome,
        url: tipo === "painel" ? "#" : (url || "#"),
        icone,
        tipo,
        projeto_id: projetoId,
      };
      if (editing) {
        const { error } = await supabase.from("atalhos").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Atalho atualizado");
      } else {
        const { error } = await supabase.from("atalhos").insert({ ...payload, ordem: nextOrdem });
        if (error) throw error;
        toast.success("Atalho criado");
      }
      onSaved(); onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={editing ? "Editar atalho" : "Novo atalho"}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Planilha de leads" className="bg-panel-2" />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as "url" | "painel")}>
            <SelectTrigger className="bg-panel-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url">URL (link externo)</SelectItem>
              <SelectItem value="painel">Painel (tabela editável)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tipo === "url" && (
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="bg-panel-2" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select value={projetoId} onValueChange={setProjetoId}>
            <SelectTrigger className="bg-panel-2"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ícone</Label>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-panel-2 rounded-md border border-border">
            {ICON_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setIcone(name)}
                className={`aspect-square rounded-md flex items-center justify-center transition-colors ${
                  icone === name ? "bg-accent/20 ring-2 ring-accent" : "hover:bg-panel"
                }`}
                title={name}
              >
                <DynamicIcon name={name} className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

// helper to run an effect each time `open` flips to true
import { useEffect, useRef } from "react";
function useStateOnOpen(open: boolean, fn: () => void) {
  const prev = useRef(false);
  useEffect(() => {
    if (open && !prev.current) fn();
    prev.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
