import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase, Acao, AcaoStatus } from "@/lib/supabase";
import { STATUS_LABELS, STATUS_CLASSES } from "@/lib/mensageria";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const OPTIONS: AcaoStatus[] = ["rascunho", "pronto", "agendado", "enviado"];

interface Props {
  acao: Acao;
}

export function StatusChip({ acao }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function setStatus(s: AcaoStatus) {
    if (s === acao.status) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("acoes").update({ status: s }).eq("id", acao.id);
    setSaving(false);
    setOpen(false);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["acoes", acao.dia_id] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wide hover:opacity-80 hover:ring-1 hover:ring-border transition ${STATUS_CLASSES[acao.status]}`}
          title="Mudar status"
        >
          {STATUS_LABELS[acao.status]}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        {OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent/15 hover:text-accent flex items-center justify-between ${
              s === acao.status ? "bg-accent/10 text-accent" : ""
            }`}
          >
            <span className={`inline-flex items-center gap-2`}>
              <span className={`w-2 h-2 rounded-full border ${STATUS_CLASSES[s]}`} />
              {STATUS_LABELS[s]}
            </span>
            {s === acao.status && <span className="text-[10px]">●</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
