import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, Search, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  ativo: boolean;
  createdAt: string;
}

interface ServiceTableProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleStatus: (service: Service) => void;
}

export default function ServiceTable({
  services,
  onEdit,
  onDelete,
  onToggleStatus,
}: ServiceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServices = services.filter(service =>
    service.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviços..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-services"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[120px]">Preço</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[120px]">Criado em</TableHead>
              <TableHead className="text-right w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {searchQuery ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">
                    {service.nome}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {service.descricao || "Sem descrição"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {formatPrice(service.preco)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={service.ativo ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {service.ativo ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          Inativo
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(service.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          data-testid={`button-service-menu-${service.id}`}
                        >
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onEdit(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleStatus(service)}
                          data-testid={`button-toggle-service-${service.id}`}
                        >
                          {service.ativo ? (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(service)}
                          className="text-destructive"
                          data-testid={`button-delete-service-${service.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}