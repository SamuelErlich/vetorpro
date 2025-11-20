import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  FileText,
  TrendingUp
} from "lucide-react";
import { Link } from "wouter";
import PaymentCalendar from "@/components/PaymentCalendar";
import type { Payment, User as UserType } from "@shared/schema";

type PaymentResponse = Omit<Payment, 'createdAt'> & { createdAt: string };
type AuthMeResponse = { user: UserType };

export default function PaymentsPage() {
  // Get current user
  const { data: userData } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
  });

  // Get payments
  const { data: paymentsData, isLoading } = useQuery<PaymentResponse[]>({
    queryKey: ['/api/payments'],
  });

  const user = userData?.user;
  const payments = paymentsData || [];

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
      amount: (parseFloat(payment.amount) / 100).toFixed(2).replace('.', ','),
    };
  });

  // Calculate stats
  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((acc, p) => acc + parseFloat(p.amount), 0) / 100;

  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const paidPayments = payments.filter(p => p.status === 'paid').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground">
          Gerencie seus pagamentos e histórico de transações
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pago
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalPaid.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">
              em {paidPayments} pagamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximo Vencimento
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.nextPaymentDate 
                ? new Date(user.nextPaymentDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Dia 5 de cada mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status Atual
            </CardTitle>
            {user?.status === "ATIVO" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.status === "ATIVO" ? "Em Dia" : "Pendente"}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingPayments > 0 ? `${pendingPayments} pagamento(s) pendente(s)` : "Tudo quitado"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Action */}
      {user?.status !== "ATIVO" && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardContent className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-4">
              <CreditCard className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Pagamento Pendente</p>
                <p className="text-sm text-muted-foreground">
                  Regularize sua situação para manter o acesso aos serviços
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/payment">
                Pagar Agora
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Calendar */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto mb-4 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          </CardContent>
        </Card>
      ) : formattedPayments.length > 0 ? (
        <PaymentCalendar payments={formattedPayments} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum pagamento registrado</p>
            <p className="text-sm text-muted-foreground">
              Seus pagamentos aparecerão aqui após a primeira transação
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
            <CardDescription>
              Últimos pagamentos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {payment.status === 'paid' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : payment.status === 'pending' ? (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        R$ {(parseFloat(payment.amount) / 100).toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={payment.status === 'paid' ? "default" : "secondary"}>
                      {payment.status === 'paid' ? 'Pago' : 
                       payment.status === 'pending' ? 'Pendente' : 'Cancelado'}
                    </Badge>
                    {payment.status === 'paid' && (
                      <Button size="sm" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}