import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Trash2 } from "lucide-react";
import { useState } from "react";

interface Payment {
  id: string;
  userEmail: string;
  date: string;
  amount: string;
  status: "paid" | "pending" | "failed";
  txid?: string;
}

interface AdminPaymentTableProps {
  payments: Payment[];
  onDelete?: (id: string) => void;
}

export default function AdminPaymentTable({ payments, onDelete }: AdminPaymentTableProps) {
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const filteredPayments = payments.filter(payment => 
    payment.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    payment.txid?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Pago
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            Pendente
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return null;
    }
  };

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (paymentToDelete && onDelete) {
      onDelete(paymentToDelete.id);
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-2xl">Monitor de Pagamentos</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou TxID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-payments"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TxID</TableHead>
                {onDelete && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id} className="h-14" data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-medium">{payment.userEmail}</TableCell>
                  <TableCell>{payment.date}</TableCell>
                  <TableCell className="font-semibold">R$ {payment.amount}</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {payment.txid || "-"}
                  </TableCell>
                  {onDelete && (
                    <TableCell className="text-right">
                      {(payment.status === "pending" || payment.status === "failed") && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleDeleteClick(payment)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          data-testid={`button-delete-payment-${payment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Pagamento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este pagamento pendente?
            {paymentToDelete && (
              <div className="mt-2 p-2 bg-muted rounded-md">
                <p className="text-sm">
                  <strong>Usuário:</strong> {paymentToDelete.userEmail}
                </p>
                <p className="text-sm">
                  <strong>Valor:</strong> R$ {paymentToDelete.amount}
                </p>
                <p className="text-sm">
                  <strong>Data:</strong> {paymentToDelete.date}
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirmDelete}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
