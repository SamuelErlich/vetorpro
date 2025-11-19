import { memo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react";

interface PaymentRecord {
  month: string;
  status: "paid" | "pending" | "overdue";
  date?: string;
  amount: string;
}

interface PaymentCalendarProps {
  payments: PaymentRecord[];
}

const PaymentCalendar = memo(({ payments }: PaymentCalendarProps) => {
  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Pago
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Vencido
          </Badge>
        );
      default:
        return null;
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Histórico de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payments.map((payment, idx) => (
            <Card key={idx} className="hover-elevate" data-testid={`card-payment-${idx}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-base">{payment.month}</h3>
                  {getStatusBadge(payment.status)}
                </div>
                
                {payment.date && (
                  <p className="text-sm text-muted-foreground">
                    Data: {payment.date}
                  </p>
                )}
                
                <p className="text-lg font-semibold">
                  R$ {payment.amount}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

PaymentCalendar.displayName = "PaymentCalendar";

export default PaymentCalendar;
