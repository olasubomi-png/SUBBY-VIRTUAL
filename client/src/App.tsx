import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { useAuth } from "@/_core/hooks/useAuth";
import { ShieldCheck } from "lucide-react";
import { LocalAuthCard } from "./components/LocalAuthCard";
import { useLocation } from "wouter";

function ProtectedWorkspace() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a0f] text-cyan-200">
        Loading secure workspace…
      </div>
    );
  if (!user)
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a0f] p-6">
        <LocalAuthCard />
      </div>
    );
  if (location === "/admin" && user.role !== "admin")
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a0f] p-6 text-center">
        <div>
          <ShieldCheck className="mx-auto h-10 w-10 text-cyan-300" />
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Administrator access required
          </h1>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            This operations console is restricted to approved administrator
            accounts.
          </p>
        </div>
      </div>
    );
  return <Home />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedWorkspace} />
      <Route path="/dashboard" component={ProtectedWorkspace} />
      <Route path="/sms" component={ProtectedWorkspace} />
      <Route path="/mail" component={ProtectedWorkspace} />
      <Route path="/wallet" component={ProtectedWorkspace} />
      <Route path="/transactions" component={ProtectedWorkspace} />
      <Route path="/settings" component={ProtectedWorkspace} />
      <Route path="/support" component={ProtectedWorkspace} />
      <Route path="/admin" component={ProtectedWorkspace} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
