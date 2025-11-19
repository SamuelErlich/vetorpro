import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface AdminUsersFiltersProps {
  onFiltersChange: (filters: {
    status?: string;
    search?: string;
    sort?: string;
  }) => void;
}

export default function AdminUsersFilters({ onFiltersChange }: AdminUsersFiltersProps) {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<string>("cadastro_desc");

  useEffect(() => {
    const debounce = setTimeout(() => {
      const filters: any = {};
      if (status !== "all") filters.status = status;
      if (search) filters.search = search;
      filters.sort = sort;
      onFiltersChange(filters);
    }, 300);

    return () => clearTimeout(debounce);
  }, [status, search, sort, onFiltersChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-users"
        />
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-status">
          <SelectValue placeholder="Filtrar status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="status-option-all">Todos</SelectItem>
          <SelectItem value="ATIVO" data-testid="status-option-ativo">ATIVO</SelectItem>
          <SelectItem value="INATIVO" data-testid="status-option-inativo">INATIVO</SelectItem>
          <SelectItem value="BLOQUEADO" data-testid="status-option-bloqueado">BLOQUEADO</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-sort">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cadastro_desc" data-testid="sort-option-cadastro-desc">Cadastro mais recente</SelectItem>
          <SelectItem value="cadastro_asc" data-testid="sort-option-cadastro-asc">Cadastro mais antigo</SelectItem>
          <SelectItem value="ultimoPagamento_desc" data-testid="sort-option-pagamento-desc">Pagamento mais recente</SelectItem>
          <SelectItem value="ultimoPagamento_asc" data-testid="sort-option-pagamento-asc">Pagamento mais antigo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
