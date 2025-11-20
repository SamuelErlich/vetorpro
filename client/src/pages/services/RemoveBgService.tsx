import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ImageOff, 
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Download,
  Sparkles,
  Clock
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { UserService, RemoveBgPlan, RemoveBgUsage } from "@shared/schema";

type RemoveBgUsageResponse = RemoveBgUsage & { createdAt: string };

export default function RemoveBgService() {
  const [, setLocation] = useLocation();

  // Get user services
  const { data: userServicesData } = useQuery<UserService[]>({
    queryKey: ['/api/user-services'],
  });

  // Get RemoveBG plans
  const { data: plansData } = useQuery<RemoveBgPlan[]>({
    queryKey: ['/api/removebg/plans'],
  });

  // Get usage history
  const { data: usageData } = useQuery<RemoveBgUsageResponse[]>({
    queryKey: ['/api/removebg/usage'],
  });

  const userServices = userServicesData || [];
  const removeBgService = userServices.find(
    service => service.serviceId === "removebg-001"
  );

  const plans = plansData || [];
  const usage = usageData || [];

  // Find current plan
  const currentPlan = removeBgService?.planId 
    ? plans.find(p => p.id === removeBgService.planId)
    : null;

  const creditsAvailable = removeBgService?.creditsAvailable || 0;
  const totalCredits = currentPlan?.credits || 0;
  const creditsUsed = totalCredits - creditsAvailable;
  const creditsPercentage = totalCredits > 0 ? (creditsUsed / totalCredits) * 100 : 0;

  const handleRemoveBg = () => {
    setLocation('/removebg');
  };

  if (!removeBgService) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">Serviço não contratado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Você ainda não tem acesso ao RemoveBG
            </p>
            <Button asChild>
              <Link href="/removebg/plans">
                Ver Planos
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Service Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
            <ImageOff className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">RemoveBG</h1>
            <p className="text-muted-foreground">
              Remoção profissional de fundo de imagens
            </p>
          </div>
        </div>
        <Badge 
          variant={removeBgService.status === "ATIVO" ? "default" : "destructive"}
          className="mt-2"
        >
          {removeBgService.status}
        </Badge>
      </div>

      {/* Status Alert */}
      {removeBgService.status !== "ATIVO" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu acesso está {removeBgService.status.toLowerCase()}. 
            {removeBgService.status === "BLOQUEADO" && " Regularize seu pagamento para reativar."}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credits Card - Takes 2 columns on large screens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Créditos Disponíveis</CardTitle>
            <CardDescription>
              Use seus créditos para remover fundos de imagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Credits Display */}
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{creditsAvailable}</div>
              <p className="text-sm text-muted-foreground">
                de {totalCredits} créditos do plano {currentPlan?.name}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={100 - creditsPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{creditsUsed} usados</span>
                <span>{creditsAvailable} disponíveis</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button 
                className="w-full" 
                onClick={handleRemoveBg}
                disabled={removeBgService.status !== "ATIVO" || creditsAvailable === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Remover Fundo
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/removebg/plans">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Comprar Mais
                </Link>
              </Button>
            </div>

            {creditsAvailable === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Seus créditos acabaram. Compre um novo plano para continuar usando o serviço.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Plan Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Plano atual</p>
              <p className="font-semibold">{currentPlan?.name || "—"}</p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Valor pago</p>
              <p className="text-xl font-semibold">
                R$ {currentPlan?.price ? parseFloat(currentPlan.price).toFixed(2).replace('.', ',') : "0,00"}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Créditos do plano</p>
              <p className="font-medium">{totalCredits} créditos</p>
            </div>

            <Separator />

            <Button className="w-full" variant="outline" asChild>
              <Link href="/removebg/plans">
                <CreditCard className="h-4 w-4 mr-2" />
                Mudar Plano
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Usage Card */}
      {usage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uso Recente</CardTitle>
            <CardDescription>
              Últimas imagens processadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usage.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <ImageOff className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {item.resolutionMp} MP
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {item.creditsUsed} {item.creditsUsed === 1 ? 'crédito' : 'créditos'}
                    </span>
                    {item.imagePath && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a href={`/${item.imagePath}`} download target="_blank">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recursos do RemoveBG</CardTitle>
          <CardDescription>
            O que você pode fazer com seus créditos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Remoção automática de fundo</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Alta precisão com IA</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Suporte a HD e 4K</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Processamento rápido</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Download em PNG transparente</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Histórico de imagens</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}