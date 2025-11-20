import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Route, Switch } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ClientSidebar } from "@/components/ClientSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Grid3x3, ImageOff, Menu } from "lucide-react";
import { FirstLoginModal } from "@/components/FirstLoginModal";
import type { User as UserType, UserService } from "@shared/schema";

// Import page components
import DashboardHome from "./dashboard/DashboardHome";
import VectorizerService from "./services/VectorizerService";
import RemoveBgService from "./services/RemoveBgService";
import Services from "./dashboard/Services";
import PaymentsPage from "./dashboard/PaymentsPage";
import AccountSettings from "./dashboard/AccountSettings";

type AuthMeResponse = { user: UserType };

export default function ClientDashboardV2() {
  const [, setLocation] = useLocation();

  // Get current user
  const { data: userData, isLoading: userLoading } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
  });

  // Get user services
  const { data: userServicesData, isLoading: servicesLoading } = useQuery<UserService[]>({
    queryKey: ['/api/user-services'],
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/auth/logout', {
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.clear();
      setLocation('/');
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (userLoading || servicesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto mb-4 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const user = userData?.user;
  const userServices = userServicesData || [];

  // Build active services list for sidebar
  const activeServices = [];
  
  // Check for Vectorizer service
  const vectorizerService = userServices.find(
    service => service.serviceId === "vectorizer-001" && service.status === "ATIVO"
  );
  if (vectorizerService) {
    activeServices.push({
      id: "vectorizer",
      name: "Vectorizer",
      icon: Grid3x3,
      path: "/dashboard/services/vectorizer",
    });
  }

  // Check for RemoveBG service
  const removeBgService = userServices.find(
    service => service.serviceId === "removebg-001" && service.status === "ATIVO"
  );
  if (removeBgService) {
    const creditsAvailable = removeBgService.creditsAvailable || 0;
    activeServices.push({
      id: "removebg",
      name: "RemoveBG",
      icon: ImageOff,
      path: "/dashboard/services/removebg",
      badge: `${creditsAvailable} créditos`,
    });
  }

  // Custom sidebar width for better content display
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <ClientSidebar
          userEmail={user?.email}
          activeServices={activeServices}
          onLogout={handleLogout}
        />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top Header Bar */}
          <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            </div>
            <ThemeToggle />
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto bg-muted/30">
            <Switch>
              <Route path="/dashboard" component={DashboardHome} />
              <Route path="/dashboard/services/vectorizer" component={VectorizerService} />
              <Route path="/dashboard/services/removebg" component={RemoveBgService} />
              <Route path="/services" component={Services} />
              <Route path="/payments" component={PaymentsPage} />
              <Route path="/account" component={AccountSettings} />
              {/* Default route */}
              <Route component={DashboardHome} />
            </Switch>
          </main>
        </div>
      </div>

      {/* First Login Modal for RemoveBG Feature */}
      <FirstLoginModal />
    </SidebarProvider>
  );
}