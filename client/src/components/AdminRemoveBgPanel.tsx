import { useState } from "react";
import { useAdminRemoveBgSubscriptions } from "@/hooks/useAdminRemoveBg";
import AdminCreditAdjustModal from "@/components/AdminCreditAdjustModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings, History } from "lucide-react";

export default function AdminRemoveBgPanel({ onViewUsageHistory }: { 
  onViewUsageHistory?: (userId: string) => void;
}) {
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    userId: string;
    userEmail: string;
    currentCredits: number;
  } | null>(null);

  const { data, isLoading } = useAdminRemoveBgSubscriptions();
  const subscriptions = data?.data || [];

  const handleAdjustCredits = (userId: string, userEmail: string, currentCredits: number) => {
    setSelectedUser({ userId, userEmail, currentCredits });
    setCreditModalOpen(true);
  };

  const handleViewHistory = (userId: string) => {
    if (onViewUsageHistory) {
      onViewUsageHistory(userId);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ATIVO":
        return <Badge variant="default">Ativo</Badge>;
      case "INATIVO":
        return <Badge variant="secondary">Inativo</Badge>;
      case "PENDENTE":
        return <Badge variant="outline">Pendente</Badge>;
      case "BLOQUEADO":
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas RemoveBG</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {subscriptions.length === 0
                ? "Nenhuma assinatura RemoveBG encontrada."
                : `Total de ${subscriptions.length} assinatura(s)`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Email do Usuário</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Créditos Disponíveis</TableHead>
                <TableHead className="text-right">Usado Este Mês</TableHead>
                <TableHead className="text-right">Total Usado</TableHead>
                <TableHead className="text-center">Último Pagamento</TableHead>
                <TableHead className="text-center">Próximo Pagamento</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma assinatura encontrada
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription) => (
                  <TableRow key={subscription.id} data-testid={`row-subscription-${subscription.id}`}>
                    <TableCell className="font-medium">
                      {subscription.userEmail}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(subscription.status)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {subscription.creditsAvailable}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {subscription.creditsUsedThisMonth}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {subscription.totalCreditsUsed}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatDate(subscription.lastPayment)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatDate(subscription.nextPayment)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjustCredits(
                            subscription.userId,
                            subscription.userEmail,
                            subscription.creditsAvailable
                          )}
                          data-testid={`button-adjust-credits-${subscription.userId}`}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Ajustar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewHistory(subscription.userId)}
                          data-testid={`button-view-history-${subscription.userId}`}
                        >
                          <History className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credit Adjustment Modal */}
      {selectedUser && (
        <AdminCreditAdjustModal
          open={creditModalOpen}
          onOpenChange={setCreditModalOpen}
          userId={selectedUser.userId}
          userEmail={selectedUser.userEmail}
          currentCredits={selectedUser.currentCredits}
        />
      )}
    </>
  );
}