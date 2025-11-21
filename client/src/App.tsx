import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import AdminUsers from "@/pages/AdminUsers";
import AdminServiceDetails from "@/pages/AdminServiceDetails";
import AdminRemoveBgTokens from "@/pages/AdminRemoveBgTokens";
import ClientDashboard from "@/pages/ClientDashboard";
import ClientLogin from "@/pages/ClientLogin";
import RemoveBgPlans from "@/pages/RemoveBgPlans";
import CriarSenha from "@/pages/CriarSenha";
import NotFound from "@/pages/not-found";
import PaymentPage from "@/pages/PaymentPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClientLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/services/:serviceId" component={AdminServiceDetails} />
      <Route path="/admin/removebg-tokens" component={AdminRemoveBgTokens} />
      <Route path="/payment" component={PaymentPage} />
      <Route path="/removebg/plans" component={RemoveBgPlans} />
      <Route path="/criar-senha" component={CriarSenha} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vectorpro-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
