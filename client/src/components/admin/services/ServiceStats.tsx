import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  DollarSign,
  Users,
  TrendingUp,
  CreditCard,
  Layers,
  CheckCircle,
  XCircle
} from "lucide-react";

interface StatsProps {
  services: any[];
  plans: any[];
  categories: any[];
  userServices?: any[];
}

export default function ServiceStats({
  services = [],
  plans = [],
  categories = [],
  userServices = [],
}: StatsProps) {
  // Calculate stats
  const activeServices = services.filter(s => s.ativo).length;
  const totalRevenue = userServices
    .filter(us => us.status === "ATIVO")
    .reduce((sum, us) => {
      const plan = plans.find(p => p.id === us.planId);
      if (plan) {
        return sum + parseFloat(plan.price);
      }
      const service = services.find(s => s.id === us.serviceId);
      return sum + (service ? parseFloat(service.preco) : 0);
    }, 0);
  
  const activeSubscriptions = userServices.filter(us => us.status === "ATIVO").length;
  const averageRevenue = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

  const stats = [
    {
      title: "Total de Serviços",
      value: services.length.toString(),
      subtitle: `${activeServices} ativos`,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Planos Disponíveis",
      value: plans.length.toString(),
      subtitle: `${plans.filter(p => p.isActive).length} ativos`,
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Categorias",
      value: categories.length.toString(),
      subtitle: `${categories.filter(c => c.isActive).length} ativas`,
      icon: Layers,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Receita Mensal",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(totalRevenue),
      subtitle: `${activeSubscriptions} assinaturas ativas`,
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  // Get top services by subscribers
  const serviceSubscribers = services.map(service => {
    const subscribers = userServices.filter(
      us => us.serviceId === service.id && us.status === "ATIVO"
    ).length;
    return { ...service, subscribers };
  }).sort((a, b) => b.subscribers - a.subscribers);

  const topServices = serviceSubscribers.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.subtitle}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Services */}
      {topServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Serviços por Assinantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topServices.map((service, index) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {service.nome}
                        <Badge 
                          variant={service.ativo ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {service.ativo ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {service.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(parseFloat(service.preco))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {service.subscribers}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      assinantes
                    </div>
                  </div>
                </div>
              ))}
              {topServices.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  Nenhum serviço com assinantes ainda
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}