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
import { 
  Edit, 
  Trash2, 
  Search, 
  MoreHorizontal, 
  CreditCard,
  Users,
  HardDrive,
  Zap
} from "lucide-react";

interface ServicePlan {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  price: string;
  billingCycle: string;
  features: Record<string, any>;
  credits?: number;
  maxUsers?: number;
  storageLimit?: number;
  apiCallsLimit?: number;
  isActive: boolean;
  createdAt: string;
}

interface PlanTableProps {
  plans: ServicePlan[];
  services: any[];
  onEdit: (plan: ServicePlan) => void;
  onDelete: (plan: ServicePlan) => void;
}

export default function PlanTable({
  plans,
  services,
  onEdit,
  onDelete,
}: PlanTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    return service?.nome || "Serviço não encontrado";
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  const getBillingCycleLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      monthly: "Mensal",
      quarterly: "Trimestral",
      yearly: "Anual",
      once: "Único",
    };
    return labels[cycle] || cycle;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar planos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-plans"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Recursos</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {searchQuery ? "Nenhum plano encontrado" : "Nenhum plano cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.name}</div>
                      {plan.description && (
                        <div className="text-sm text-muted-foreground">
                          {plan.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getServiceName(plan.serviceId)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {formatPrice(plan.price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getBillingCycleLabel(plan.billingCycle)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.credits && (
                        <Badge variant="outline" className="gap-1">
                          <CreditCard className="h-3 w-3" />
                          {plan.credits} créditos
                        </Badge>
                      )}
                      {plan.maxUsers && (
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {plan.maxUsers} usuários
                        </Badge>
                      )}
                      {plan.storageLimit && (
                        <Badge variant="outline" className="gap-1">
                          <HardDrive className="h-3 w-3" />
                          {plan.storageLimit} MB
                        </Badge>
                      )}
                      {plan.apiCallsLimit && (
                        <Badge variant="outline" className="gap-1">
                          <Zap className="h-3 w-3" />
                          {plan.apiCallsLimit} API
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                      {plan.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          data-testid={`button-plan-menu-${plan.id}`}
                        >
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onEdit(plan)}
                          data-testid={`button-edit-plan-${plan.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(plan)}
                          className="text-destructive"
                          data-testid={`button-delete-plan-${plan.id}`}
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