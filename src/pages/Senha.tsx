import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { unlock } from "@/lib/auth";
import { Lock, Loader2 } from "lucide-react";

export default function Senha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senha.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-action", {
        body: { senha },
      });
      if (error) throw error;
      if (data?.valido === true) {
        unlock();
        toast.success("Acesso liberado");
        navigate("/", { replace: true });
      } else {
        toast.error("Senha incorreta");
        setSenha("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao validar senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-6 sm:p-8 bg-panel border-border shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel WTD</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso restrito</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha"
              className="bg-panel-2 border-border h-11"
            />
          </div>

          <Button type="submit" disabled={loading || !senha.trim()} className="w-full h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
