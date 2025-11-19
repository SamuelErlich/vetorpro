import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Payment } from "@shared/schema";

interface PaymentHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

type PaymentResponse = Omit<Payment, "createdAt"> & { createdAt: string };

export default function PaymentHistoryDrawer({
  open,
  onOpenChange,
  userId,
  userEmail,
}: PaymentHistoryDrawerProps) {
  const { data: payments, isLoading } = useQuery<PaymentResponse[]>({
    queryKey: ["admin-user-payments", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments/user/${userId}`);
      if (!res.ok) throw new Error("Erro ao buscar pagamentos");
      return res.json();
    },
    enabled: open,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" data-testid={`badge-status-paid`}>Pago</Badge>;
      case "pending":
        return <Badge variant="secondary" data-testid={`badge-status-pending`}>Pendente</Badge>;
      default:
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Falhou</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto" data-testid="drawer-payment-history">
        <SheetHeader>
          <SheetTitle>Histórico de Pagamentos</SheetTitle>
          <SheetDescription>{userEmail}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum pagamento encontrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>TXID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell data-testid={`cell-date-${payment.id}`}>
                        {new Date(payment.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell data-testid={`cell-amount-${payment.id}`}>
                        R$ {(parseFloat(payment.amount) / 100).toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`cell-txid-${payment.id}`}>
                        {payment.txid || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
