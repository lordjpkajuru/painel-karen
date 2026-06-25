import { useEffect, useState, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

const KEY = "painel-wtd-liberado";

export function isUnlocked() {
  return typeof window !== "undefined" && localStorage.getItem(KEY) === "true";
}

export function unlock() {
  localStorage.setItem(KEY, "true");
}

export function lock() {
  localStorage.removeItem(KEY);
}

export function RequireUnlock({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOk(isUnlocked());
    setReady(true);
  }, [location.pathname]);

  if (!ready) return null;
  if (!ok) return <Navigate to="/senha" replace />;
  return <>{children}</>;
}
