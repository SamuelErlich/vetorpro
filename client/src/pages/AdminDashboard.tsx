import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Users, CreditCard, Key, LogOut } from "lucide-react";
import AdminUserTable from "@/components/AdminUserTable";
import AdminPaymentTable from "@/components/AdminPaymentTable";
import AdminCredentialTable from "@/components/AdminCredentialTable";
import UserFormDialog from "@/components/UserFormDialog";
import CreateUserDialog from "@/components/CreateUserDialog";
import CredentialFormDialog from "@/components/CredentialFormDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as UserType, Credential, Payment } from "@shared/schema";

type AuthMeResponse = { user: UserType };
type PaymentWithUser = Payment & { userEmail: string };

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingCredential, setEditingCredential] = useState<any>(null);

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

  // Fetch data
  const { data: usersData, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
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
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
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

  const menuItems = [
    { title: "Usuários", icon: Users, id: "users" },
    { title: "Credenciais", icon: Key, id: "credentials" },
    { title: "Pagamentos", icon: CreditCard, id: "payments" },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAddUser = () => {
    setCreateUserDialogOpen(true);
  };

  const handleEditUser = (userId: string) => {
    const user = usersData?.find((u: any) => u.id === userId);
    setEditingUser(user);
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
    setEditingCredential(credential);
    setCredentialDialogOpen(true);
  };

  const handleDeleteCredential = (credentialId: string) => {
    if (confirm("Tem certeza que deseja deletar esta credencial?")) {
      deleteCredentialMutation.mutate(credentialId);
    }
  };

  const handleSubmitCredential = (data: any) => {
    if (editingCredential) {
      updateCredentialMutation.mutate({ id: editingCredential.id, data });
    } else {
      createCredentialMutation.mutate(data);
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
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {activeTab === "users" && (
                <>
                  {usersLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <AdminUserTable
                      users={usersData?.map((u: any) => ({
                        ...u,
                        lastPayment: u.ultimoPagamento 
                          ? new Date(u.ultimoPagamento).toLocaleDateString('pt-BR')
                          : undefined,
                      })) || []}
                      onAdd={handleAddUser}
                      onEdit={handleEditUser}
                      onDelete={handleDeleteUser}
                    />
                  )}
                </>
              )}

              {activeTab === "credentials" && (
                <>
                  {credentialsLoading || usersLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <AdminCredentialTable
                      credentials={enrichedCredentials}
                      users={usersData || []}
                      onAdd={handleAddCredential}
                      onEdit={handleEditCredential}
                      onDelete={handleDeleteCredential}
                    />
                  )}
                </>
              )}

              {activeTab === "payments" && (
                <>
                  {paymentsLoading ? (
                    <Skeleton className="h-96 w-full" />
                  ) : (
                    <AdminPaymentTable 
                      payments={paymentsData?.map((p: any) => ({
                        ...p,
                        date: new Date(p.createdAt).toLocaleDateString('pt-BR'),
                        amount: (parseFloat(p.amount) / 100).toFixed(2).replace('.', ','),
                      })) || []} 
                    />
                  )}
                </>
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
        user={editingUser}
      />

      <CredentialFormDialog
        open={credentialDialogOpen}
        onClose={() => setCredentialDialogOpen(false)}
        onSubmit={handleSubmitCredential}
        credential={editingCredential}
      />
    </SidebarProvider>
  );
}
