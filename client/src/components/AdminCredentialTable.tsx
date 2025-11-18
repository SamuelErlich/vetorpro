import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, Plus, Search } from "lucide-react";

interface Credential {
  id: string;
  userId: string;
  month: string;
  data: string;
  userEmail?: string;
}

interface User {
  id: string;
  email: string;
}

interface AdminCredentialTableProps {
  credentials: Credential[];
  users: User[];
  onAdd: () => void;
  onEdit: (credentialId: string) => void;
  onDelete: (credentialId: string) => void;
}

export default function AdminCredentialTable({ 
  credentials, 
  users,
  onAdd, 
  onEdit, 
  onDelete 
}: AdminCredentialTableProps) {
  const [search, setSearch] = useState("");

  const filteredCredentials = credentials.filter(cred => {
    const matchesSearch = cred.month.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-2xl">Gerenciar Credenciais</CardTitle>
          <Button onClick={onAdd} data-testid="button-add-credential">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Credencial
          </Button>
        </div>
        <div className="flex gap-4 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mês..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-credentials"
            />
          </div>
          <div className="text-sm text-muted-foreground flex items-center px-3 bg-muted rounded-md">
            Credenciais compartilhadas - visíveis para todos os usuários ativos
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês/Período</TableHead>
                <TableHead>Dados da Credencial</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCredentials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhuma credencial encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCredentials.map((credential) => (
                  <TableRow key={credential.id} className="h-14" data-testid={`row-credential-${credential.id}`}>
                    <TableCell className="font-medium">{credential.month}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-sm">
                      {credential.data}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEdit(credential.id)}
                          data-testid={`button-edit-${credential.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(credential.id)}
                          data-testid={`button-delete-${credential.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
