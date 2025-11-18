import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import CredentialsCard from "@/components/CredentialsCard";
import PaymentStatusBanner from "@/components/PaymentStatusBanner";
import PaymentCalendar from "@/components/PaymentCalendar";

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  
  // todo: remove mock functionality
  const [userStatus, setUserStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  
  const mockUser = {
    email: "cliente@example.com",
    status: userStatus,
    lastPayment: "15/01/2025"
  };

  const mockCredentials = [
    { label: "Usuário", value: "user@example.com" },
    { label: "Senha", value: "Senha@Segura123" },
    { label: "Chave API", value: "sk_live_51Abc123xyz789" }
  ];

  const mockPayments = [
    { month: "Janeiro 2025", status: "paid" as const, date: "15/01/2025", amount: "99,90" },
    { month: "Dezembro 2024", status: "paid" as const, date: "15/12/2024", amount: "99,90" },
    { month: "Novembro 2024", status: "paid" as const, date: "18/11/2024", amount: "99,90" },
  ];

  const handleLogout = () => {
    console.log('Logout clicked');
    setLocation('/');
  };

  const handlePayClick = () => {
    console.log('Navigate to payment');
    setLocation('/payment');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard do Cliente</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{mockUser.email}</span>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        <PaymentStatusBanner
          status={mockUser.status}
          lastPayment={mockUser.lastPayment}
          nextDue="15/02/2025"
          onPayClick={handlePayClick}
        />

        <CredentialsCard
          month="Janeiro 2025"
          credentials={mockCredentials}
          isLocked={mockUser.status === "INATIVO"}
        />

        <PaymentCalendar payments={mockPayments} />
      </main>
    </div>
  );
}
