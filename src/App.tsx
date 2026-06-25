import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireUnlock } from "@/lib/auth";
import Hub from "./pages/Hub";
import Senha from "./pages/Senha";
import Mensageria from "./pages/Mensageria";
import Painel from "./pages/Painel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/senha" element={<Senha />} />
          <Route path="/" element={<RequireUnlock><Hub /></RequireUnlock>} />
          <Route path="/projetos/:slug/mensageria" element={<RequireUnlock><Mensageria /></RequireUnlock>} />
          <Route path="/projetos/:slug/painel/:atalhoId" element={<RequireUnlock><Painel /></RequireUnlock>} />
          <Route path="/despertar/mensageria" element={<Navigate to="/projetos/despertar/mensageria" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
