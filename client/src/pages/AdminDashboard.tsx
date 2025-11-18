import { useState } from "react";
import { useLocation } from "wouter";
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
import { Users, CreditCard, Key, LogOut, Menu } from "lucide-react";
import AdminUserTable from "@/components/AdminUserTable";
import AdminPaymentTable from "@/components/AdminPaymentTable";
import UserFormDialog from "@/components/UserFormDialog";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // todo: remove mock functionality
  const mockUsers = [
    { id: "1", email: "cliente1@example.com", status: "ATIVO" as const, lastPayment: "15/01/2025" },
    { id: "2", email: "cliente2@example.com", status: "INATIVO" as const, lastPayment: "15/12/2024" },
    { id: "3", email: "cliente3@example.com", status: "ATIVO" as const, lastPayment: "18/01/2025" },
  ];

  const mockPayments = [
    { id: "1", userEmail: "cliente1@example.com", date: "15/01/2025", amount: "99,90", status: "paid" as const, txid: "ABC123XYZ" },
    { id: "2", userEmail: "cliente2@example.com", date: "14/01/2025", amount: "99,90", status: "pending" as const },
    { id: "3", userEmail: "cliente3@example.com", date: "18/01/2025", amount: "99,90", status: "paid" as const, txid: "DEF456UVW" },
  ];

  const menuItems = [
    { title: "Usuários", icon: Users, id: "users" },
    { title: "Pagamentos", icon: CreditCard, id: "payments" },
    { title: "Credenciais", icon: Key, id: "credentials" },
  ];

  const handleLogout = () => {
    console.log('Admin logout');
    setLocation('/admin/login');
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    console.log('Delete user:', userId);
  };

  const handleSubmitUser = (data: any) => {
    console.log('Submit user:', data);
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

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
                <AdminUserTable
                  users={mockUsers}
                  onAdd={handleAddUser}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                />
              )}

              {activeTab === "payments" && (
                <AdminPaymentTable payments={mockPayments} />
              )}

              {activeTab === "credentials" && (
                <div className="text-center py-12 text-muted-foreground">
                  Gerenciamento de credenciais em desenvolvimento
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmitUser}
        user={editingUser}
      />
    </SidebarProvider>
  );
}
