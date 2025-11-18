import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Calendar } from "lucide-react";

interface PaymentStatusBannerProps {
  status: "ATIVO" | "INATIVO";
  lastPayment?: string;
  nextDue?: string;
  onPayClick: () => void;
}

export default function PaymentStatusBanner({ 
  status, 
  lastPayment, 
  nextDue, 
  onPayClick 
}: PaymentStatusBannerProps) {
  const isActive = status === "ATIVO";

  return (
    <Alert className={isActive ? "border-primary bg-primary/5" : "border-destructive bg-destructive/5"}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5">
          {isActive ? (
            <CheckCircle className="h-5 w-5 text-primary" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
        
        <div className="flex-1 space-y-2">
          <AlertTitle className="text-lg font-semibold">
            {isActive ? "Pagamento em Dia" : "Pagamento Pendente"}
          </AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            {lastPayment && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Último pagamento: {lastPayment}</span>
              </div>
            )}
            {nextDue && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Próximo vencimento: {nextDue}</span>
              </div>
            )}
          </AlertDescription>
        </div>

        {!isActive && (
          <Button 
            onClick={onPayClick}
            className="shrink-0"
            data-testid="button-pay-pix"
          >
            Pagar via PIX
          </Button>
        )}
      </div>
    </Alert>
  );
}
