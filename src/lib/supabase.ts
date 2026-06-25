import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fslogjevenlarjitqwje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MPhflij_9qZ_o4Qfh2d40Q_BtHm4qTE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Projeto = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
};

export type AtalhoTipo = "url" | "painel";

export type Atalho = {
  id: string;
  projeto_id: string;
  nome: string;
  url: string;
  icone: string;
  ordem: number;
  tipo: AtalhoTipo;
};

export type PainelItem = {
  id: string;
  atalho_id: string;
  atividade: string;
  falar_com: string;
  ordem: number;
  criado_em?: string;
};

export type Evento = {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
};

export type Edicao = {
  id: string;
  evento_id: string;
  nome: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativa: boolean;
};

export type Trilha = {
  id: string;
  edicao_id: string;
  nome: string;
  ordem: number;
};

export type Dia = {
  id: string;
  edicao_id: string;
  trilha_id: string;
  nome: string;
  slug: string;
  data: string | null;
  ordem: number;
};

export type AcaoTipo = "MENSAGEM" | "RENOMEAR_GRUPO";
export type AcaoStatus = "rascunho" | "pronto" | "agendado" | "enviado";

export type Acao = {
  id: string;
  dia_id: string;
  tipo: AcaoTipo;
  horario: string;
  contexto: string | null;
  rotulo: string | null;
  conteudo: string | null;
  tem_botoes_api: boolean;
  status: AcaoStatus;
  criado_em?: string;
  atualizado_em?: string;
};

export type ArquivoTipo = "audio" | "video" | "imagem" | "outro";

export type Arquivo = {
  id: string;
  acao_id: string;
  tipo: ArquivoTipo;
  url: string;
  descricao: string | null;
  ordem: number;
};

export type BlocoTipo = "texto" | "audio" | "video" | "imagem" | "outro";

export type Bloco = {
  id: string;
  acao_id: string;
  tipo: BlocoTipo;
  conteudo: string | null;
  url: string | null;
  descricao: string | null;
  ordem: number;
  criado_em?: string;
};

export type VariavelTipo = "url" | "texto";

export type Variavel = {
  id: string;
  edicao_id: string;
  chave: string;
  valor: string | null;
  tipo: VariavelTipo;
  ordem: number;
};
