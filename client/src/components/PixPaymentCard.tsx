import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2 } from "lucide-react";

interface PixPaymentCardProps {
  qrCode: string;
  pixCode: string;
  amount: string;
  onReturn: () => void;
}

export default function PixPaymentCard({ qrCode, pixCode, amount, onReturn }: PixPaymentCardProps) {
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    console.log('PIX code copied');
  };

  const handleCheckPayment = () => {
    setWaiting(true);
    console.log('Checking payment status...');
    setTimeout(() => {
      setWaiting(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-semibold">Pagamento via PIX</CardTitle>
          <CardDescription className="text-lg">
            Valor: <span className="font-semibold text-foreground">R$ {amount}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center p-6 bg-muted rounded-lg">
            <img 
              src={qrCode} 
              alt="QR Code PIX" 
              className="w-64 h-64 border-4 border-background rounded-lg"
              data-testid="img-qr-code"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Código PIX Copia e Cola:</h3>
              <div className="flex gap-2">
                <div className="flex-1 p-4 bg-muted rounded-md overflow-x-auto">
                  <code className="text-sm font-mono break-all" data-testid="text-pix-code">
                    {pixCode}
                  </code>
                </div>
                <Button
                  onClick={handleCopy}
                  variant={copied ? "secondary" : "default"}
                  className="shrink-0"
                  data-testid="button-copy-pix"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">1</span>
                Abra o app do seu banco
              </h3>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">2</span>
                Escolha pagar com PIX QR Code ou Copia e Cola
              </h3>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">3</span>
                Escaneie o código ou cole o código acima
              </h3>
            </div>

            {waiting && (
              <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Aguardando confirmação do pagamento...</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleCheckPayment}
                variant="default"
                className="flex-1"
                disabled={waiting}
                data-testid="button-check-payment"
              >
                {waiting ? 'Verificando...' : 'Verificar Pagamento'}
              </Button>
              <Button
                onClick={onReturn}
                variant="outline"
                data-testid="button-return-dashboard"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
