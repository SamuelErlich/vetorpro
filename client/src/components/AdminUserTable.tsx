import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Edit, History, Settings, Trash2, UserPlus } from "lucide-react";

interface User {
  id: string;
  email: string;
  status: "ATIVO" | "PENDENTE" | "INATIVO" | "BLOQUEADO";
  lastPayment?: string;
  discount?: number;
}

interface AdminUserTableProps {
  users: User[];
  onEdit: (userId: string) => void;
  onDelete: (userId: string) => void;
  onEditStatus?: (userId: string) => void;
  onViewPayments?: (userId: string) => void;
}

const AdminUserTable = memo(({ 
  users, 
  onEdit, 
  onDelete, 
  onEditStatus, 
  onViewPayments 
}: AdminUserTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Gerenciar Usuários</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desconto</TableHead>
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
                  <TableCell>
                    {user.discount ? (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                        {user.discount}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0%</span>
                    )}
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
});

AdminUserTable.displayName = "AdminUserTable";

export default AdminUserTable;
