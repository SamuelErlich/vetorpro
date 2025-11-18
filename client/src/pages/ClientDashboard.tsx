import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User, MessageCircle } from "lucide-react";
import CredentialsCard from "@/components/CredentialsCard";
import PaymentStatusBanner from "@/components/PaymentStatusBanner";
import PaymentCalendar from "@/components/PaymentCalendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as UserType, Credential, Payment } from "@shared/schema";

type AuthMeResponse = { user: UserType };
type CredentialsResponse = { credentials: Credential[]; locked: boolean };
type PaymentResponse = Omit<Payment, 'createdAt'> & { createdAt: string };

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get current user
  const { data: userData, isLoading: userLoading } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
  });

  // Get credentials
  const { data: credentialsData, isLoading: credentialsLoading } = useQuery<CredentialsResponse>({
    queryKey: ['/api/credentials'],
  });

  // Get payments
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<PaymentResponse[]>({
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
        id: cred.id,
        month: cred.month,
        items: Object.entries(data)
          .filter(([key]) => {
            // Remove only ChaveAPI field from display (case-insensitive)
            const lowerKey = key.toLowerCase();
            return lowerKey !== 'chaveapi';
          })
          .map(([key, value]) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value),
          })),
      };
    } catch {
      return {
        id: cred.id,
        month: cred.month,
        items: [{ label: "Dados", value: cred.data }],
      };
    }
  });

  // Get only the most recent credential (last in array)
  const currentCreds = parsedCredentials.length > 0 
    ? parsedCredentials[parsedCredentials.length - 1]
    : null;

  // Format payments for calendar
  const formattedPayments = payments.map((payment) => {
    const paymentStatus: "paid" | "pending" | "overdue" = 
      payment.status === 'paid' ? 'paid' : 
      payment.status === 'pending' ? 'pending' : 
      'overdue';
    
    return {
      month: new Date(payment.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      status: paymentStatus,
      date: payment.status === 'paid' ? new Date(payment.createdAt).toLocaleDateString('pt-BR') : undefined,
      amount: parseFloat(payment.amount).toFixed(2).replace('.', ','),
    };
  });

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
          status={(user?.status === "ATIVO" || user?.status === "INATIVO") ? user.status : "INATIVO"}
          lastPayment={user?.ultimoPagamento ? new Date(user.ultimoPagamento).toLocaleDateString('pt-BR') : undefined}
          nextDue={user?.ultimoPagamento ? new Date(new Date(user.ultimoPagamento).setMonth(new Date(user.ultimoPagamento).getMonth() + 1)).toLocaleDateString('pt-BR') : undefined}
          onPayClick={handlePayClick}
        />

        {credentialsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isLocked ? (
          <CredentialsCard
            month=""
            credentials={[]}
            isLocked={true}
          />
        ) : !currentCreds ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma credencial disponível
          </div>
        ) : (
          <CredentialsCard
            month={currentCreds.month}
            credentials={currentCreds.items}
            isLocked={false}
          />
        )}

        {paymentsLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : formattedPayments.length > 0 ? (
          <PaymentCalendar payments={formattedPayments} />
        ) : null}
      </main>

      {/* WhatsApp Support Button - Dashboard */}
      <Button
        size="lg"
        asChild
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all bg-[#25D366] hover:bg-[#20BA5A] text-white border-0"
        data-testid="button-whatsapp-support"
      >
        <a
          href="https://wa.me/5544936184613?text=Preciso%20de%20ajuda%20com%20meu%20acesso"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-whatsapp-support"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Suporte via WhatsApp</span>
        </a>
      </Button>
    </div>
  );
}
