import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Monitor, CreditCard, Copy, ExternalLink, Clock } from "lucide-react";
import type { UserService, Payment } from "@shared/schema";
import { MONTHLY_PAYMENT_AMOUNT } from "@shared/constants";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface VectorizerCardProps {
  userService: UserService | null;
  credentials: Array<{ label: string; value: string }> | null;
  onPayClick: () => void;
  isLocked: boolean;
}

export default function VectorizerCard({ userService, credentials, onPayClick, isLocked }: VectorizerCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Query for pending payments for this specific service
  const { data: paymentsData } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
    enabled: !!userService,
  });
  
  // Find pending payment for Vectorizer service
  const pendingPayment = paymentsData?.find(
    payment => payment.serviceId === "vectorizer-001" && payment.status === "pending"
  );
  
  // Access control based on UserServices.status
  // ATIVO: Show credentials and access button
  // INATIVO: Show subscribe button (and pending payment if exists)
  const isActive = userService?.status === "ATIVO";
  const price = MONTHLY_PAYMENT_AMOUNT.toFixed(2).replace('.', ',');
  
  const handlePayNow = () => {
    if (pendingPayment) {
      // Navigate to payment page with the pending payment
      setLocation(`/payment?txid=${pendingPayment.txid}`);
    } else {
      onPayClick();
    }
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    toast({
      description: `${label} copiado!`,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleVectorizerLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("/api/vectorizer/autologin", {
        method: "GET",
      });

      if (response.success) {
        // Copiar senha para o clipboard
        await navigator.clipboard.writeText(response.senha);
        
        // Abrir o link em nova aba
        window.open(response.url, "_blank", "noopener,noreferrer");
        
        toast({
          title: "Sucesso!",
          description: "Email preenchido e senha copiada. Cole a senha no campo correspondente.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Erro",
          description: response.error || "Não foi possível fazer o login automático",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível fazer o login automático",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Vectorizer - Auto Login</CardTitle>
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
            {isActive ? "Ativo" : "Não Assinado"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Valor:</span>
            <span className="font-semibold text-primary">R$ {price}/mês</span>
          </div>
          
          {/* Show subscribe button only when service is INATIVO */}
          {!isActive && !pendingPayment && (
            <Button 
              onClick={onPayClick}
              data-testid="button-subscribe-vectorizer"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar
            </Button>
          )}
          
          {/* Show pending payment button when there's a pending payment */}
          {!isActive && pendingPayment && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Pagamento Pendente
              </Badge>
              <Button 
                onClick={handlePayNow}
                size="sm"
                variant="default"
                data-testid="button-pay-pending-vectorizer"
              >
                Pagar agora
              </Button>
            </div>
          )}
        </div>

        {/* Show credentials only when service is active */}
        {isActive && credentials && credentials.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Credenciais - {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
            <div className="space-y-2">
              {credentials.map((cred, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{cred.label}</p>
                    <p className="font-mono text-sm mt-1">{cred.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(cred.value, cred.label)}
                    data-testid={`button-copy-${cred.label.toLowerCase()}`}
                  >
                    {copiedField === cred.label ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    className="w-full"
                    variant="default"
                    data-testid="button-enter-vectorizer"
                    onClick={handleVectorizerLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        Abrindo Vectorizer...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Entrar no Vectorizer (1 Clique)
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>O email será preenchido automaticamente</p>
                  <p>e a senha será copiada para você colar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Show locked message if user has active status but payment is overdue */}
        {isActive && isLocked && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              Suas credenciais estão temporariamente bloqueadas devido a pagamento pendente.
              Realize o pagamento para liberar o acesso.
            </p>
          </div>
        )}

        {!isActive && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Assinatura mensal com renovação automática no dia 5 de cada mês.
              Faça login automático no Vectorizer sem precisar de credenciais.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}