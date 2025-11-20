import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Grid3x3, 
  Key, 
  Calendar, 
  CreditCard,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { UserService, Credential } from "@shared/schema";

type CredentialsResponse = { credentials: Credential[]; locked: boolean };

export default function VectorizerService() {
  const { toast } = useToast();
  const [showSensitive, setShowSensitive] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Get user services
  const { data: userServicesData } = useQuery<UserService[]>({
    queryKey: ['/api/user-services'],
  });

  // Get credentials
  const { data: credentialsData } = useQuery<CredentialsResponse>({
    queryKey: ['/api/credentials'],
  });

  const userServices = userServicesData || [];
  const vectorizerService = userServices.find(
    service => service.serviceId === "vectorizer-001"
  );

  // Check if service is active
  const hasActiveAccess = vectorizerService?.status === "ATIVO";

  const credentials = credentialsData?.credentials || [];
  const isLocked = credentialsData?.locked || false || !hasActiveAccess; // Also lock if service not active

  // Parse credentials data for Vectorizer only
  const vectorizerCredentials = credentials
    .filter((cred: any) => cred.serviceId === "vectorizer-001")
    .map((cred: any) => {
      try {
        const data = JSON.parse(cred.data);
        return {
          id: cred.id,
          month: cred.month,
          items: Object.entries(data).map(([key, value]) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value),
            isSensitive: key.toLowerCase().includes('senha') || 
                        key.toLowerCase().includes('password') ||
                        key.toLowerCase().includes('chaveapi') ||
                        key.toLowerCase().includes('token'),
          })),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Get most recent credentials - only if service is active
  const currentCredentials = hasActiveAccess ? vectorizerCredentials[vectorizerCredentials.length - 1] : null;

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      toast({
        title: "Copiado!",
        description: "Credencial copiada para a área de transferência",
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a credencial",
        variant: "destructive",
      });
    }
  };

  if (!vectorizerService) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">Serviço não contratado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Você ainda não tem acesso ao Vectorizer
            </p>
            <Button asChild>
              <Link href="/marketplace">
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
            <Grid3x3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vectorizer</h1>
            <p className="text-muted-foreground">
              Serviço de vetorização profissional
            </p>
          </div>
        </div>
        <Badge 
          variant={vectorizerService.status === "ATIVO" ? "default" : "destructive"}
          className="mt-2"
        >
          {vectorizerService.status}
        </Badge>
      </div>

      {/* Status Alert */}
      {vectorizerService.status !== "ATIVO" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu acesso está {vectorizerService.status.toLowerCase()}. 
            {vectorizerService.status === "BLOQUEADO" && " Regularize seu pagamento para reativar."}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credentials Card - Takes 2 columns on large screens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Credenciais de Acesso</CardTitle>
                <CardDescription>
                  Use estas credenciais para acessar o serviço
                </CardDescription>
              </div>
              {currentCredentials && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSensitive(!showSensitive)}
                  disabled={isLocked}
                >
                  {showSensitive ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Mostrar
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasActiveAccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Lock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium mb-2">Serviço {vectorizerService.status === "INATIVO" ? "Inativo" : "Bloqueado"}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {vectorizerService.status === "INATIVO" 
                    ? "Faça uma assinatura para acessar as credenciais deste serviço"
                    : "Regularize seu pagamento para reativar o acesso"}
                </p>
                <Button asChild>
                  <Link href={vectorizerService.status === "INATIVO" ? "/services" : "/payment"}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {vectorizerService.status === "INATIVO" ? "Assinar Agora" : "Pagar Agora"}
                  </Link>
                </Button>
              </div>
            ) : currentCredentials ? (
              <div className="space-y-4">
                {currentCredentials.items
                  .filter((item: any) => !item.key.toLowerCase().includes('chaveapi'))
                  .map((item: any) => (
                    <div key={item.key} className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        {item.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 font-mono text-sm p-3 bg-muted rounded-md">
                          {item.isSensitive && !showSensitive
                            ? "••••••••••••"
                            : item.value}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(item.value, item.key)}
                          disabled={isLocked}
                        >
                          {copiedField === item.key ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  Período: {currentCredentials.month}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Key className="h-12 w-12 text-muted-foreground/50 mb-4 mx-auto" />
                <p className="font-medium mb-2">Nenhuma credencial disponível</p>
                <p className="text-sm text-muted-foreground">
                  As credenciais serão disponibilizadas após o pagamento
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Valor mensal</p>
              <p className="text-xl font-semibold">R$ 17,50</p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Próximo vencimento</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">
                  {vectorizerService.proximoPagamento
                    ? new Date(vectorizerService.proximoPagamento).toLocaleDateString('pt-BR')
                    : "—"}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Último pagamento</p>
              <p className="font-medium">
                {vectorizerService.ultimoPagamento
                  ? new Date(vectorizerService.ultimoPagamento).toLocaleDateString('pt-BR')
                  : "—"}
              </p>
            </div>

            {vectorizerService.status !== "ATIVO" && (
              <>
                <Separator />
                <Button className="w-full" asChild>
                  <Link href="/payment">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Renovar Agora
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recursos Incluídos</CardTitle>
          <CardDescription>
            O que está disponível no seu plano Vectorizer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Vetorização ilimitada</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Alta qualidade de conversão</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Suporte para múltiplos formatos</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Acesso via API</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Processamento em lote</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Suporte prioritário</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}