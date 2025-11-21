import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Package, 
  CreditCard, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  TrendingUp,
  Calendar,
  AlertCircle
} from "lucide-react";
import type { User as UserType, UserService, Payment } from "@shared/schema";

type AuthMeResponse = { user: UserType };
type PaymentResponse = Omit<Payment, 'createdAt'> & { createdAt: string };

export default function DashboardHome() {
  // Get current user
  const { data: userData } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
  });

  // Get user services
  const { data: userServicesData } = useQuery<UserService[]>({
    queryKey: ['/api/user-services'],
  });

  // Get payments
  const { data: paymentsData } = useQuery<PaymentResponse[]>({
    queryKey: ['/api/payments'],
  });

  const user = userData?.user;
  const userServices = userServicesData || [];
  const payments = paymentsData || [];

  // Count active services
  const activeServicesCount = userServices.filter(s => s.status === "ATIVO").length;
  const totalServicesCount = userServices.length;

  // Get last payment
  const lastPayment = payments
    .filter(p => p.status === 'paid')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Calculate next payment date (day 5 of next month)
  const nextPaymentDate = user?.nextPaymentDate 
    ? new Date(user.nextPaymentDate)
    : null;
  
  const daysUntilPayment = nextPaymentDate
    ? Math.ceil((nextPaymentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {user?.email?.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Aqui está um resumo da sua conta
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Serviços Ativos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeServicesCount}</div>
            <p className="text-xs text-muted-foreground">
              de {totalServicesCount} contratados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status da Conta
            </CardTitle>
            {user?.status === "ATIVO" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.status === "ATIVO" ? "Ativa" : 
               user?.status === "BLOQUEADO" ? "Bloqueada" : "Inativa"}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.status === "ATIVO" ? "Tudo em dia" : "Pagamento pendente"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximo Pagamento
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextPaymentDate ? (
              <>
                <div className="text-2xl font-bold">
                  {nextPaymentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {daysUntilPayment && daysUntilPayment > 0 
                    ? `em ${daysUntilPayment} dias` 
                    : daysUntilPayment === 0 
                    ? 'Vence hoje'
                    : 'Vencido'}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">
                  Nenhum serviço ativo
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Services Summary */}
      {userServices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Seus Serviços</CardTitle>
            <CardDescription>
              Gerencie e acesse seus serviços contratados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userServices
              // Filtrar apenas serviços conhecidos/válidos
              .filter(service => 
                service.serviceId === "vectorizer-001" || 
                service.serviceId === "removebg-001"
              )
              .map((service) => {
              const isVectorizer = service.serviceId === "vectorizer-001";
              const isRemoveBG = service.serviceId === "removebg-001";
              const serviceName = isVectorizer ? "Vectorizer" : "RemoveBG";
              const servicePath = isVectorizer 
                ? "/dashboard/services/vectorizer" 
                : "/dashboard/services/removebg";

              return (
                <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{serviceName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={service.status === "ATIVO" ? "default" : "secondary"}>
                          {service.status}
                        </Badge>
                        {isRemoveBG && service.creditsAvailable !== null && (
                          <span className="text-xs text-muted-foreground">
                            {service.creditsAvailable} créditos disponíveis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {service.status === "ATIVO" && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={servicePath}>
                        Acessar
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum serviço contratado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Explore nosso marketplace para começar
            </p>
            <Button asChild>
              <Link href="/marketplace">
                <TrendingUp className="h-4 w-4 mr-2" />
                Explorar Serviços
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Alert */}
      {user?.status !== "ATIVO" && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="font-medium">Pagamento pendente</p>
              <p className="text-sm text-muted-foreground">
                Regularize sua situação para continuar usando os serviços
              </p>
            </div>
            <Button variant="default" asChild>
              <Link href="/payment">
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar Agora
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}