import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search } from "lucide-react";
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
}

export default function AdminPaymentTable({ payments }: AdminPaymentTableProps) {
  const [search, setSearch] = useState("");

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

  return (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
