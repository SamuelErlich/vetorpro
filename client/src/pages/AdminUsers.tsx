import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Search, UserPlus, Edit, Settings, CreditCard, Calendar, Package, Filter, X } from "lucide-react";
import CreateUserDialog from "@/components/CreateUserDialog";
import type { User, UserService, Service } from "@shared/schema";

type UserWithServices = User & {
  services: (UserService & { service: Service })[];
  computedStatus: "ATIVO" | "INATIVO" | "BLOQUEADO";
  totalServices: number;
  activeServices: number;
  lastPayment?: string | null;
};

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // State for filters and UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editingService, setEditingService] = useState<{ userId: string; serviceId: string; userService: UserService } | null>(null);
  
  // Check authentication
  const { data: currentUser, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!currentUser?.user || currentUser.user.isAdmin !== "true")) {
      setLocation('/admin/login');
    }
  }, [currentUser, authLoading, setLocation]);

  // Fetch users with services
  const { data: users, isLoading: usersLoading } = useQuery<UserWithServices[]>({
    queryKey: ['/api/admin/users', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search) params.append("search", search);
      params.append("sort", "cadastro_desc");
      
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!currentUser?.user && currentUser.user.isAdmin === "true",
  });

  // Mutation for updating user service
  const updateUserServiceMutation = useMutation({
    mutationFn: async ({ userId, serviceId, updates }: { userId: string; serviceId: string; updates: any }) => {
      return apiRequest(`/api/admin/users/${userId}/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Serviço atualizado com sucesso!" });
      setEditingService(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for creating user
  const createUserMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Usuário criado com sucesso!" });
      setCreateUserOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRowExpansion = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "ATIVO":
        return "secondary";
      case "BLOQUEADO":
        return "destructive";
      case "INATIVO":
        return "outline";
      default:
        return "default";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ATIVO":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "BLOQUEADO":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "INATIVO":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "";
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  if (authLoading || usersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Gerenciar Usuários</CardTitle>
              <CardDescription>
                Visualize e gerencie usuários e suas assinaturas de serviços
              </CardDescription>
            </div>
            <Button onClick={() => setCreateUserOpen(true)} data-testid="button-add-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ATIVO">ATIVO</SelectItem>
                <SelectItem value="INATIVO">INATIVO</SelectItem>
                <SelectItem value="BLOQUEADO">BLOQUEADO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Status Global</TableHead>
                  <TableHead>Último Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <>
                    <TableRow 
                      key={user.id} 
                      className="h-14 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleRowExpansion(user.id)}
                      data-testid={`row-user-${user.id}`}
                    >
                      <TableCell>
                        {expandedRows.has(user.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {user.activeServices}/{user.totalServices} ativos
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(user.computedStatus)}
                          className={getStatusBadgeClass(user.computedStatus)}
                        >
                          {user.computedStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.lastPayment)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/admin/user/${user.id}`);
                          }}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row - Service Details */}
                    {expandedRows.has(user.id) && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0 bg-muted/20">
                          <div className="p-6">
                            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              Serviços Assinados
                            </h4>
                            {user.services.length > 0 ? (
                              <div className="rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Serviço</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Último Pagamento</TableHead>
                                      <TableHead>Próximo Pagamento</TableHead>
                                      <TableHead>Créditos</TableHead>
                                      <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.services.map((userService) => (
                                      <TableRow key={userService.id}>
                                        <TableCell className="font-medium">
                                          {userService.service.nome}
                                        </TableCell>
                                        <TableCell>
                                          <Badge 
                                            variant={getStatusBadgeVariant(userService.status)}
                                            className={getStatusBadgeClass(userService.status)}
                                          >
                                            {userService.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {formatDate(userService.ultimoPagamento)}
                                        </TableCell>
                                        <TableCell>
                                          {formatDate(userService.proximoPagamento)}
                                        </TableCell>
                                        <TableCell>
                                          {userService.creditsAvailable !== null ? (
                                            <div className="flex items-center gap-1">
                                              <CreditCard className="h-3 w-3" />
                                              {userService.creditsAvailable}
                                            </div>
                                          ) : (
                                            "-"
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingService({
                                                userId: user.id,
                                                serviceId: userService.serviceId,
                                                userService
                                              });
                                            }}
                                            data-testid={`button-edit-service-${userService.id}`}
                                          >
                                            <Settings className="h-3 w-3 mr-1" />
                                            Gerenciar
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Este usuário não possui serviços ativos
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>

          {(!users || users.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSubmit={(data) => createUserMutation.mutate(data)}
      />

      {/* Edit Service Dialog */}
      <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Serviço</DialogTitle>
            <DialogDescription>
              Atualize o status ou créditos do serviço para este usuário
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingService.userService.status}
                  onValueChange={(value) => {
                    setEditingService({
                      ...editingService,
                      userService: {
                        ...editingService.userService,
                        status: value as "ATIVO" | "INATIVO" | "BLOQUEADO"
                      }
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">ATIVO</SelectItem>
                    <SelectItem value="INATIVO">INATIVO</SelectItem>
                    <SelectItem value="BLOQUEADO">BLOQUEADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingService.userService.creditsAvailable !== null && (
                <div className="space-y-2">
                  <Label>Créditos Disponíveis</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingService.userService.creditsAvailable}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0) {
                        setEditingService({
                          ...editingService,
                          userService: {
                            ...editingService.userService,
                            creditsAvailable: value
                          }
                        });
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingService(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    updateUserServiceMutation.mutate({
                      userId: editingService.userId,
                      serviceId: editingService.serviceId,
                      updates: {
                        status: editingService.userService.status,
                        creditsAvailable: editingService.userService.creditsAvailable
                      }
                    });
                  }}
                  disabled={updateUserServiceMutation.isPending}
                >
                  {updateUserServiceMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}