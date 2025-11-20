import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminCredentialTable from "@/components/AdminCredentialTable";
import AdminPaymentTable from "@/components/AdminPaymentTable";
import AdminUsersFilters from "@/components/AdminUsersFilters";
import AdminUserTable from "@/components/AdminUserTable";
import CreateUserDialog from "@/components/CreateUserDialog";
import CredentialFormDialog from "@/components/CredentialFormDialog";
import EditStatusDialog from "@/components/EditStatusDialog";
import PaymentHistoryDrawer from "@/components/PaymentHistoryDrawer";
import AdminRemoveBgPanel from "@/components/AdminRemoveBgPanel";
import AdminRemoveBgUsage from "@/components/AdminRemoveBgUsage";
import AdminRemoveBgStats from "@/components/AdminRemoveBgStats";
import AdminServiceManagement from "./AdminServiceManagement";
import { ThemeToggle } from "@/components/ThemeToggle";
import UserFormDialog from "@/components/UserFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Credential, Payment, User as UserType, Service } from "@shared/schema";
import { CreditCard, Download, Key, LogOut, Users, Image, BarChart3, Settings, Package } from "lucide-react";

type AuthMeResponse = { user: UserType };
type PaymentWithUser = Payment & { userEmail: string };

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("services");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  
  // New states for filters and dialogs
  const [userFilters, setUserFilters] = useState<{
    status?: string;
    search?: string;
    sort?: string;
  }>({});
  const [editStatusDialogOpen, setEditStatusDialogOpen] = useState(false);
  const [editingStatusUser, setEditingStatusUser] = useState<UserType | null>(null);
  const [paymentHistoryDrawerOpen, setPaymentHistoryDrawerOpen] = useState(false);
  const [viewingPaymentsUser, setViewingPaymentsUser] = useState<UserType | null>(null);
  
  // RemoveBG states
  const [removeBgTab, setRemoveBgTab] = useState("subscriptions");
  const [viewingUsageUserId, setViewingUsageUserId] = useState<string | undefined>(undefined);

  // Check authentication
  const { data: currentUser, isLoading: authLoading } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!currentUser?.user || currentUser.user.isAdmin !== "true")) {
      setLocation('/admin/login');
    }
  }, [currentUser, authLoading, setLocation]);

  // Fetch data with filters
  const { data: usersData, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["admin-users", userFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userFilters.status) params.append("status", userFilters.status);
      if (userFilters.search) params.append("search", userFilters.search);
      if (userFilters.sort) params.append("sort", userFilters.sort);
      
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar usuários");
      return res.json();
    },
    enabled: !!currentUser?.user && currentUser.user.isAdmin === "true",
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<PaymentWithUser[]>({
    queryKey: ['/api/admin/payments'],
    enabled: !!currentUser?.user && currentUser.user.isAdmin === "true",
  });

  const { data: credentialsData, isLoading: credentialsLoading } = useQuery<Credential[]>({
    queryKey: ['/api/admin/credentials'],
    enabled: !!currentUser?.user && currentUser.user.isAdmin === "true",
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<(Service & { activeSubscribers?: number; totalSubscribers?: number })[]>({
    queryKey: ['/api/admin/services'],
    enabled: !!currentUser?.user && currentUser.user.isAdmin === "true",
  });

  // Mutations
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      setLocation('/admin/login');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Usuário criado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      apiRequest(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Usuário atualizado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Usuário deletado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCredentialMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/admin/credentials', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credentials'] });
      toast({ title: "Credencial criada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCredentialMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      apiRequest(`/api/admin/credentials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credentials'] });
      toast({ title: "Credencial atualizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/credentials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credentials'] });
      toast({ title: "Credencial deletada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar credencial",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments'] });
      toast({ title: "Pagamento excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir pagamento",
        description: error.message || error.error || "Erro ao excluir pagamento",
        variant: "destructive",
      });
    },
  });

  const menuItems = [
    { title: "Serviços", icon: Settings, id: "services" },
    { title: "Marketplace", icon: Package, id: "marketplace" },
    { title: "Usuários", icon: Users, id: "users" },
    { title: "Pagamentos", icon: CreditCard, id: "payments" },
    { title: "RemoveBG", icon: Image, id: "removebg" },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAddUser = () => {
    setCreateUserDialogOpen(true);
  };

  const handleEditUser = (userId: string) => {
    const user = usersData?.find((u: any) => u.id === userId);
    setEditingUser(user ?? null);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Tem certeza que deseja deletar este usuário?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSubmitUser = (data: any) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleAddCredential = () => {
    setEditingCredential(null);
    setCredentialDialogOpen(true);
  };

  const handleEditCredential = (credentialId: string) => {
    const credential = credentialsData?.find((c: any) => c.id === credentialId);
    setEditingCredential(credential ?? null);
    setCredentialDialogOpen(true);
  };

  const handleDeleteCredential = (credentialId: string) => {
    if (confirm("Tem certeza que deseja deletar esta credencial?")) {
      deleteCredentialMutation.mutate(credentialId);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    deletePaymentMutation.mutate(paymentId);
  };

  const handleSubmitCredential = (data: any) => {
    if (editingCredential) {
      updateCredentialMutation.mutate({ id: editingCredential.id, data });
    } else {
      createCredentialMutation.mutate(data);
    }
  };

  const handleFiltersChange = (filters: any) => {
    setUserFilters(filters);
  };

  const handleEditStatus = (userId: string) => {
    const user = usersData?.find((u: any) => u.id === userId);
    setEditingStatusUser(user ?? null);
    setEditStatusDialogOpen(true);
  };

  const handleViewPayments = (userId: string) => {
    const user = usersData?.find((u: any) => u.id === userId);
    setViewingPaymentsUser(user ?? null);
    setPaymentHistoryDrawerOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/admin/users/export");
      if (!res.ok) throw new Error("Erro ao exportar usuários");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usuarios-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Arquivo exportado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportPayments = async () => {
    try {
      const res = await fetch("/api/admin/payments/export");
      if (!res.ok) throw new Error("Erro ao exportar pagamentos");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagamentos-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Pagamentos exportados com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar pagamentos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Enrich credentials with user emails
  const enrichedCredentials = credentialsData?.map((cred: any) => {
    const user = usersData?.find((u: any) => u.id === cred.userId);
    return {
      ...cred,
      userEmail: user?.email || "Unknown",
    };
  }) || [];

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-semibold px-4 py-4">
                Admin Panel
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveTab(item.id)}
                        className={activeTab === item.id ? "bg-sidebar-accent" : ""}
                        data-testid={`link-${item.id}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {activeTab === "users" && (
                <>
                  {usersLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Gerenciar Usuários</CardTitle>
                              <CardDescription>
                                Gerencie os usuários e suas assinaturas
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleExportCSV} variant="outline" data-testid="button-export">
                                <Download className="h-4 w-4 mr-2" />
                                Exportar CSV
                              </Button>
                              <Button onClick={handleAddUser} data-testid="button-add-user">
                                <Users className="h-4 w-4 mr-2" />
                                Adicionar Usuário
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <AdminUsersFilters onFiltersChange={handleFiltersChange} />
                          <AdminUserTable
                            users={usersData || []}
                            onEdit={handleEditUser}
                            onDelete={handleDeleteUser}
                            onEditStatus={handleEditStatus}
                            onViewPayments={handleViewPayments}
                          />
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}

              {activeTab === "payments" && (
                <>
                  {paymentsLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Gerenciar Pagamentos</CardTitle>
                            <CardDescription>
                              Visualize e gerencie todos os pagamentos do sistema
                            </CardDescription>
                          </div>
                          <Button 
                            onClick={handleExportPayments} 
                            variant="outline" 
                            data-testid="button-export-payments"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Exportar para Excel
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <AdminPaymentTable 
                          payments={paymentsData?.map((p: any) => ({
                            ...p,
                            date: new Date(p.createdAt).toLocaleDateString('pt-BR'),
                            amount: (parseFloat(p.amount) / 100).toFixed(2).replace('.', ','),
                          })) || []} 
                          onDelete={handleDeletePayment}
                        />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {activeTab === "removebg" && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Gerenciar RemoveBG</h2>
                    <Button 
                      variant="outline" 
                      onClick={() => setLocation('/admin/removebg-tokens')}
                      data-testid="button-manage-tokens"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Gerenciar Tokens de API
                    </Button>
                  </div>

                  <Tabs value={removeBgTab} onValueChange={setRemoveBgTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
                        <Users className="h-4 w-4 mr-2" />
                        Assinaturas
                      </TabsTrigger>
                      <TabsTrigger value="usage" data-testid="tab-usage">
                        <Image className="h-4 w-4 mr-2" />
                        Histórico de Uso
                      </TabsTrigger>
                      <TabsTrigger value="stats" data-testid="tab-stats">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Estatísticas
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="subscriptions" className="mt-6">
                      <AdminRemoveBgPanel 
                        onViewUsageHistory={(userId) => {
                          setViewingUsageUserId(userId);
                          setRemoveBgTab("usage");
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="usage" className="mt-6">
                      <AdminRemoveBgUsage userId={viewingUsageUserId} />
                      {viewingUsageUserId && (
                        <Button
                          variant="outline"
                          onClick={() => setViewingUsageUserId(undefined)}
                          className="mt-4"
                          data-testid="button-clear-filter"
                        >
                          Limpar Filtro
                        </Button>
                      )}
                    </TabsContent>

                    <TabsContent value="stats" className="mt-6">
                      <AdminRemoveBgStats />
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {activeTab === "marketplace" && (
                <AdminServiceManagement />
              )}

              {activeTab === "services" && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Gerenciar Serviços</h2>
                  </div>

                  {servicesLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {servicesData?.map((service) => (
                        <Card 
                          key={service.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setLocation(`/admin/services/${service.id}`)}
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle>{service.nome}</CardTitle>
                              <Badge variant={service.ativo ? "default" : "secondary"}>
                                {service.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            <CardDescription>{service.descricao || "Sem descrição"}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Preço:</span>
                                <span className="font-medium">R$ {service.preco}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Assinantes Ativos:</span>
                                <span className="font-medium">{service.activeSubscribers || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total de Assinantes:</span>
                                <span className="font-medium">{service.totalSubscribers || 0}</span>
                              </div>
                            </div>
                            <Button 
                              className="w-full mt-4" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/admin/services/${service.id}`);
                              }}
                              data-testid={`button-manage-service-${service.id}`}
                            >
                              Gerenciar Serviço
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <CreateUserDialog
        open={createUserDialogOpen}
        onOpenChange={setCreateUserDialogOpen}
      />

      <UserFormDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSubmit={handleSubmitUser}
        user={editingUser ?? undefined}
      />

      <CredentialFormDialog
        open={credentialDialogOpen}
        onClose={() => setCredentialDialogOpen(false)}
        onSubmit={handleSubmitCredential}
        credential={editingCredential ?? undefined}
      />

      {editingStatusUser && (
        <EditStatusDialog
          open={editStatusDialogOpen}
          onOpenChange={setEditStatusDialogOpen}
          userId={editingStatusUser.id}
          currentStatus={editingStatusUser.status}
          userEmail={editingStatusUser.email}
        />
      )}

      {viewingPaymentsUser && (
        <PaymentHistoryDrawer
          open={paymentHistoryDrawerOpen}
          onOpenChange={setPaymentHistoryDrawerOpen}
          userId={viewingPaymentsUser.id}
          userEmail={viewingPaymentsUser.email}
        />
      )}
    </SidebarProvider>
  );
}
