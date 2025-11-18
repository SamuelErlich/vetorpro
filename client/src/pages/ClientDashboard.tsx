import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import CredentialsCard from "@/components/CredentialsCard";
import PaymentStatusBanner from "@/components/PaymentStatusBanner";
import PaymentCalendar from "@/components/PaymentCalendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get current user
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  // Get credentials
  const { data: credentialsData, isLoading: credentialsLoading } = useQuery({
    queryKey: ['/api/credentials'],
  });

  // Get payments
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['/api/payments'],
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

  const handlePayClick = () => {
    setLocation('/payment');
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const user = userData?.user;
  const credentials = credentialsData?.credentials || [];
  const isLocked = credentialsData?.locked || false;
  const payments = paymentsData || [];

  // Parse credentials data
  const parsedCredentials = credentials.map((cred: any) => {
    try {
      const data = JSON.parse(cred.data);
      return {
        month: cred.month,
        items: Object.entries(data).map(([key, value]) => ({
          label: key.charAt(0).toUpperCase() + key.slice(1),
          value: String(value),
        })),
      };
    } catch {
      return {
        month: cred.month,
        items: [{ label: "Dados", value: cred.data }],
      };
    }
  });

  // Get current month credentials
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const currentCreds = parsedCredentials[0] || { month: currentMonth, items: [] };

  // Format payments for calendar
  const formattedPayments = payments.map((payment: any) => ({
    month: new Date(payment.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    status: payment.status === 'paid' ? 'paid' : payment.status === 'pending' ? 'pending' : 'overdue',
    date: payment.status === 'paid' ? new Date(payment.createdAt).toLocaleDateString('pt-BR') : undefined,
    amount: parseFloat(payment.amount).toFixed(2).replace('.', ','),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard do Cliente</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        <PaymentStatusBanner
          status={user?.status || "INATIVO"}
          lastPayment={user?.ultimoPagamento ? new Date(user.ultimoPagamento).toLocaleDateString('pt-BR') : undefined}
          nextDue={user?.ultimoPagamento ? new Date(new Date(user.ultimoPagamento).setMonth(new Date(user.ultimoPagamento).getMonth() + 1)).toLocaleDateString('pt-BR') : undefined}
          onPayClick={handlePayClick}
        />

        {credentialsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <CredentialsCard
            month={currentCreds.month}
            credentials={currentCreds.items}
            isLocked={isLocked}
          />
        )}

        {paymentsLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : formattedPayments.length > 0 ? (
          <PaymentCalendar payments={formattedPayments} />
        ) : null}
      </main>
    </div>
  );
}
