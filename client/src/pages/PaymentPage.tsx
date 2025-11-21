import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Copy, Loader2, Calendar } from "lucide-react";

type PaymentStatusResponse = { 
  status: string;
  amount: string;
  createdAt: string;
};

export default function PaymentPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const [pixData, setPixData] = useState<any>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  
  // Get service and amount from URL parameters
  const params = new URLSearchParams(searchParams);
  const serviceId = params.get('service') || 'vectorizer-001';
  const planId = params.get('plan');
  const amount = parseFloat(params.get('amount') || '17.50');

  const generatePixMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/payments/pix', {
        method: 'POST',
        body: JSON.stringify({ 
          amount, 
          serviceId,
          planId 
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data) => {
      setPixData(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar PIX",
        description: error.message || "Não foi possível gerar o código PIX. Tente novamente.",
        variant: "destructive",
      });
      setLocation('/dashboard');
    },
  });

  // Poll payment status every 3 seconds
  const { data: paymentStatus } = useQuery<PaymentStatusResponse>({
    queryKey: ['/api/payments/status', pixData?.txid],
    enabled: !!pixData?.txid && !paymentConfirmed,
    refetchInterval: 3000,
  });

  useEffect(() => {
    generatePixMutation.mutate();
  }, []);

  useEffect(() => {
    if (paymentStatus?.status === 'paid' && !paymentConfirmed) {
      setPaymentConfirmed(true);
      toast({
        title: "Pagamento Confirmado! 🎉",
        description: "Seu acesso foi liberado. Redirecionando...",
      });
      
      // Invalidate ALL dashboard queries to ensure fresh data
      const refreshDashboardData = async () => {
        // Wait for all invalidations to complete before redirecting
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/credentials'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/payments'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/user-services'] }) // CRITICAL: This was missing!
        ]);
        
        // Small delay to ensure backend has processed the webhook
        setTimeout(() => {
          setLocation('/dashboard');
        }, 1500);
      };
      
      refreshDashboardData();
    }
  }, [paymentStatus, paymentConfirmed]);

  const handleReturn = () => {
    setLocation('/dashboard');
  };

  const handleCopyPixCode = async () => {
    if (!pixData?.qrCode) return;
    
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      toast({
        title: "Copiado!",
        description: "Código PIX copiado para a área de transferência",
      });
    } catch (error) {
      // Fallback for non-secure contexts or clipboard API not available
      const textArea = document.createElement("textarea");
      textArea.value = pixData.qrCode;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Copiado!",
          description: "Código PIX copiado para a área de transferência",
        });
      } catch (err) {
        toast({
          title: "Erro ao copiar",
          description: "Por favor, copie o código manualmente",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  if (!pixData || generatePixMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl space-y-6">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-64 w-64 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl" data-testid="card-payment">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Pagamento via PIX</CardTitle>
          <CardDescription className="text-center">
            {pixData?.isDemoMode && pixData?.maintenanceMessage ? (
              pixData.maintenanceMessage
            ) : (
              "Escaneie o QR Code ou copie o código PIX para realizar o pagamento"
            )}
          </CardDescription>
          
          {/* Demo Mode Warning */}
          {pixData?.isDemoMode && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center font-medium">
                {pixData.maintenanceMessage || "⚠️ Sistema PIX em manutenção"}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 text-center mt-2">
                Os pagamentos reais estão temporariamente desabilitados. Entre em contato com o suporte para mais informações.
              </p>
            </div>
          )}
          
          {/* Monthly Plan Information with Discount */}
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <p className="text-center text-sm font-medium text-primary">
                  Plano Mensal
                </p>
              </div>
              {pixData?.discount > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="line-through text-muted-foreground">R$ {pixData.originalAmount?.toFixed(2).replace('.', ',')}</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700">
                      {pixData.discount}% OFF
                    </Badge>
                  </div>
                  <p className="text-xl font-bold text-primary text-center">
                    R$ {pixData.amount?.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 text-center">
                    Economia de R$ {pixData.discountAmount?.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-bold text-primary">
                  R$ {pixData?.amount?.toFixed(2).replace('.', ',') || '17,50'}/mês
                </p>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Acesso liberado imediatamente após confirmação do pagamento
            </p>
          </div>

          {pixData?.txid && !paymentConfirmed && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            {pixData.qrCodeBase64 ? (
              <img 
                src={pixData.qrCodeBase64} 
                alt="QR Code PIX" 
                className="w-64 h-64 border-4 border-primary rounded-lg"
                data-testid="img-qrcode"
              />
            ) : (
              <div className="w-64 h-64 bg-muted flex items-center justify-center rounded-lg border-4 border-primary">
                <p className="text-sm text-muted-foreground">QR Code não disponível</p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="text-3xl font-bold text-primary" data-testid="text-amount">
              R$ {pixData.amount?.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* PIX Copy-Paste Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Código PIX (Copia e Cola)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pixData.qrCode || ''}
                readOnly
                className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate"
                data-testid="input-pixcode"
              />
              <Button 
                onClick={handleCopyPixCode}
                variant="outline"
                size="icon"
                data-testid="button-copy-pixcode"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm">Abra o app do seu banco</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm">Escolha pagar com PIX</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm">Escaneie o QR Code ou cole o código</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm">Confirme o pagamento e seu acesso será liberado automaticamente</p>
            </div>
          </div>

          {/* Return Button */}
          <Button 
            onClick={handleReturn} 
            variant="outline" 
            className="w-full"
            data-testid="button-return"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
