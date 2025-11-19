import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, AlertCircle, Clock } from "lucide-react";

interface PaymentButtonProps {
  status: "ATIVO" | "INATIVO" | "BLOQUEADO";
  onPayClick: () => void;
}

export default function PaymentButton({ status, onPayClick }: PaymentButtonProps) {
  const today = new Date();
  const day = today.getDate();

  const showButton =
    status === "INATIVO" ||
    status === "BLOQUEADO" ||
    (status === "ATIVO" && day >= 3 && day <= 5);

  if (!showButton) {
    return null;
  }

  const isNearDueDate = status === "ATIVO" && day >= 3 && day <= 5;

  const getMessage = () => {
    if (status === "INATIVO") {
      return {
        icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
        title: "Acesso Inativo",
        description: "Seu acesso ainda não foi ativado. Realize o pagamento para usar o serviço.",
        variant: "default" as const,
      };
    }
    
    if (status === "BLOQUEADO") {
      return {
        icon: <AlertCircle className="h-5 w-5 text-destructive" />,
        title: "Assinatura Bloqueada",
        description: "Sua assinatura está bloqueada por falta de pagamento.",
        variant: "destructive" as const,
      };
    }
    
    return {
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      title: "Vencimento Próximo",
      description: "Sua assinatura vence dia 5. Você pode antecipar o pagamento.",
      variant: "default" as const,
    };
  };

  const message = getMessage();

  let buttonClasses = "w-full sm:w-auto";
  if (isNearDueDate) {
    buttonClasses += " animate-pulse ring-2 ring-amber-400 shadow-lg shadow-amber-400/30";
  }

  return (
    <Card className={`border-2 ${
      status === "BLOQUEADO" 
        ? "border-destructive/50 bg-destructive/5" 
        : isNearDueDate
        ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20"
        : "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10"
    }`}>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {message.icon}
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base">{message.title}</h3>
              <p className="text-sm text-muted-foreground">
                {message.description}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  Valor: <span className="text-primary">R$ 17,50</span>
                </span>
              </div>
            </div>
          </div>
          
          <Button
            onClick={onPayClick}
            className={buttonClasses}
            variant={status === "BLOQUEADO" ? "destructive" : "default"}
            size="lg"
            data-testid="button-pay-subscription"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Pagar Assinatura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
