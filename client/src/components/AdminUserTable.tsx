import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Edit, Trash2, UserPlus, History, Settings } from "lucide-react";

interface User {
  id: string;
  email: string;
  status: "ATIVO" | "PENDENTE" | "INATIVO" | "BLOQUEADO";
  lastPayment?: string;
}

interface AdminUserTableProps {
  users: User[];
  onAdd: () => void;
  onEdit: (userId: string) => void;
  onDelete: (userId: string) => void;
  onEditStatus?: (userId: string) => void;
  onViewPayments?: (userId: string) => void;
}

export default function AdminUserTable({ 
  users, 
  onAdd, 
  onEdit, 
  onDelete, 
  onEditStatus, 
  onViewPayments 
}: AdminUserTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-2xl">Gerenciar Usuários</CardTitle>
          <Button onClick={onAdd} data-testid="button-add-user">
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Usuário
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="h-14" data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        user.status === "ATIVO" ? "secondary" : 
                        user.status === "PENDENTE" ? "outline" : 
                        "destructive"
                      }
                      className={
                        user.status === "ATIVO" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                          : user.status === "PENDENTE"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700"
                          : ""
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastPayment || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onEditStatus && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEditStatus(user.id)}
                          data-testid={`button-edit-status-${user.id}`}
                          title="Editar Status"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                      {onViewPayments && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onViewPayments(user.id)}
                          data-testid={`button-view-payments-${user.id}`}
                          title="Ver Pagamentos"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(user.id)}
                        data-testid={`button-edit-${user.id}`}
                        title="Editar Usuário"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(user.id)}
                        data-testid={`button-delete-${user.id}`}
                        title="Deletar Usuário"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
