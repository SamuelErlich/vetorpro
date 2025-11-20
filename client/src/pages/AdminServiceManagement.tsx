import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Package,
  DollarSign,
  Users,
  Settings,
  Layers,
  CheckCircle,
  XCircle,
  Archive,
  CreditCard
} from "lucide-react";

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  ativo: boolean;
  createdAt: string;
}

interface ServicePlan {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  price: string;
  billingCycle: string;
  features: Record<string, any>;
  isActive: boolean;
  maxUsers?: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export default function AdminServiceManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("services");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Editing states
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);

  // Form states
  const [serviceForm, setServiceForm] = useState({
    nome: "",
    descricao: "",
    preco: "",
    ativo: true
  });

  const [planForm, setPlanForm] = useState({
    serviceId: "",
    name: "",
    description: "",
    price: "",
    billingCycle: "monthly",
    features: "",
    maxUsers: "",
    isActive: true
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "",
    displayOrder: 0,
    isActive: true
  });

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
    queryFn: async () => {
      const response = await fetch("/api/admin/services", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch services");
      return response.json();
    }
  });

  // Fetch service plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<ServicePlan[]>({
    queryKey: ["/api/admin/service-plans"],
    queryFn: async () => {
      const response = await fetch("/api/admin/service-plans", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    }
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
    queryFn: async () => {
      const response = await fetch("/api/admin/categories", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    }
  });

  // Create/Update Service
  const serviceMutation = useMutation({
    mutationFn: async (data: typeof serviceForm & { id?: string }) => {
      const url = data.id 
        ? `/api/admin/services/${data.id}`
        : "/api/admin/services";
      
      return apiRequest(url, {
        method: data.id ? "PUT" : "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/services"] });
      toast({
        title: editingService ? "Serviço atualizado" : "Serviço criado",
        description: `O serviço foi ${editingService ? 'atualizado' : 'criado'} com sucesso.`
      });
      handleCloseServiceDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar serviço",
        description: error.message || "Não foi possível salvar o serviço.",
        variant: "destructive"
      });
    }
  });

  // Create/Update Plan
  const planMutation = useMutation({
    mutationFn: async (data: typeof planForm & { id?: string }) => {
      const url = data.id 
        ? `/api/admin/service-plans/${data.id}`
        : "/api/admin/service-plans";
      
      // Process features - backend expects a JSON string
      let features = "";
      try {
        if (data.features) {
          // Try to parse as JSON to validate it
          const parsed = JSON.parse(data.features);
          features = data.features; // If valid JSON, send as is
        }
      } catch (e) {
        // If not valid JSON, treat as line-separated list
        if (data.features) {
          const featureList = data.features.split('\n')
            .filter(f => f.trim())
            .map(f => f.trim());
          features = JSON.stringify(featureList);
        }
      }
      
      const payload = {
        ...data,
        features: features || undefined,
        maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined
      };
      
      return apiRequest(url, {
        method: data.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-plans"] });
      toast({
        title: editingPlan ? "Plano atualizado" : "Plano criado",
        description: `O plano foi ${editingPlan ? 'atualizado' : 'criado'} com sucesso.`
      });
      handleClosePlanDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar plano",
        description: error.message || "Não foi possível salvar o plano.",
        variant: "destructive"
      });
    }
  });

  // Create/Update Category
  const categoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm & { id?: string }) => {
      const url = data.id 
        ? `/api/admin/categories/${data.id}`
        : "/api/admin/categories";
      
      return apiRequest(url, {
        method: data.id ? "PUT" : "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/categories"] });
      toast({
        title: editingCategory ? "Categoria atualizada" : "Categoria criada",
        description: `A categoria foi ${editingCategory ? 'atualizada' : 'criada'} com sucesso.`
      });
      handleCloseCategoryDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar categoria",
        description: error.message || "Não foi possível salvar a categoria.",
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const endpoint = type === "service" 
        ? `/api/admin/services/${id}`
        : type === "plan"
        ? `/api/admin/service-plans/${id}`
        : `/api/admin/categories/${id}`;
      
      return apiRequest(endpoint, {
        method: "DELETE"
      });
    },
    onSuccess: (_, variables) => {
      const queryKey = variables.type === "service"
        ? ["/api/admin/services"]
        : variables.type === "plan"
        ? ["/api/admin/service-plans"]
        : ["/api/admin/categories"];
      
      queryClient.invalidateQueries({ queryKey });
      
      if (variables.type === "service" || variables.type === "category") {
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace/services"] });
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace/categories"] });
      }
      
      toast({
        title: "Item excluído",
        description: "O item foi excluído com sucesso."
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o item.",
        variant: "destructive"
      });
    }
  });

  // Filter functions
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        service.nome.toLowerCase().includes(query) ||
        service.descricao?.toLowerCase().includes(query)
      );
    });
  }, [services, searchQuery]);

  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        plan.name.toLowerCase().includes(query) ||
        plan.description?.toLowerCase().includes(query)
      );
    });
  }, [plans, searchQuery]);

  const filteredCategories = useMemo(() => {
    return categories.filter(category => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        category.name.toLowerCase().includes(query) ||
        category.description?.toLowerCase().includes(query)
      );
    });
  }, [categories, searchQuery]);

  // Dialog handlers
  const handleOpenServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        nome: service.nome,
        descricao: service.descricao || "",
        preco: service.preco,
        ativo: service.ativo
      });
    } else {
      setEditingService(null);
      setServiceForm({
        nome: "",
        descricao: "",
        preco: "",
        ativo: true
      });
    }
    setServiceDialogOpen(true);
  };

  const handleCloseServiceDialog = () => {
    setServiceDialogOpen(false);
    setEditingService(null);
    setServiceForm({
      nome: "",
      descricao: "",
      preco: "",
      ativo: true
    });
  };

  const handleOpenPlanDialog = (plan?: ServicePlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        serviceId: plan.serviceId,
        name: plan.name,
        description: plan.description || "",
        price: plan.price,
        billingCycle: plan.billingCycle,
        features: typeof plan.features === 'object' ? JSON.stringify(plan.features, null, 2) : "",
        maxUsers: plan.maxUsers?.toString() || "",
        isActive: plan.isActive
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        serviceId: services[0]?.id || "",
        name: "",
        description: "",
        price: "",
        billingCycle: "monthly",
        features: "",
        maxUsers: "",
        isActive: true
      });
    }
    setPlanDialogOpen(true);
  };

  const handleClosePlanDialog = () => {
    setPlanDialogOpen(false);
    setEditingPlan(null);
    setPlanForm({
      serviceId: "",
      name: "",
      description: "",
      price: "",
      billingCycle: "monthly",
      features: "",
      maxUsers: "",
      isActive: true
    });
  };

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || "",
        icon: category.icon || "",
        displayOrder: category.displayOrder,
        isActive: category.isActive
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        description: "",
        icon: "",
        displayOrder: categories.length,
        isActive: true
      });
    }
    setCategoryDialogOpen(true);
  };

  const handleCloseCategoryDialog = () => {
    setCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      icon: "",
      displayOrder: 0,
      isActive: true
    });
  };

  const handleDelete = (type: string, id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const handleSaveService = () => {
    const data = editingService 
      ? { ...serviceForm, id: editingService.id }
      : serviceForm;
    serviceMutation.mutate(data);
  };

  const handleSavePlan = () => {
    const data = editingPlan 
      ? { ...planForm, id: editingPlan.id }
      : planForm;
    planMutation.mutate(data);
  };

  const handleSaveCategory = () => {
    const data = editingCategory 
      ? { ...categoryForm, id: editingCategory.id }
      : categoryForm;
    categoryMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gerenciar Serviços e Planos</h2>
        <p className="text-muted-foreground">
          Configure serviços, planos de preços e categorias do marketplace
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-admin-services"
          placeholder="Buscar serviços, planos ou categorias..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="services">
            <Package className="h-4 w-4 mr-2" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Layers className="h-4 w-4 mr-2" />
            Categorias
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Serviços</CardTitle>
                  <CardDescription>
                    Gerencie os serviços disponíveis no marketplace
                  </CardDescription>
                </div>
                <Button 
                  data-testid="button-add-service"
                  onClick={() => handleOpenServiceDialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Serviço
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum serviço encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((service) => (
                      <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                        <TableCell className="font-medium">{service.nome}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {service.descricao || "-"}
                        </TableCell>
                        <TableCell>R$ {service.preco}</TableCell>
                        <TableCell>
                          <Badge variant={service.ativo ? "default" : "secondary"}>
                            {service.ativo ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Inativo
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(service.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            data-testid={`button-edit-service-${service.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenServiceDialog(service)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            data-testid={`button-delete-service-${service.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("service", service.id, service.nome)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Planos de Serviço</CardTitle>
                  <CardDescription>
                    Configure os planos e preços para cada serviço
                  </CardDescription>
                </div>
                <Button 
                  data-testid="button-add-plan"
                  onClick={() => handleOpenPlanDialog()}
                  disabled={services.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Plano
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max. Usuários</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plansLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPlans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum plano encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlans.map((plan) => {
                      const service = services.find(s => s.id === plan.serviceId);
                      return (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell>{service?.nome || plan.serviceId}</TableCell>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>R$ {plan.price}</TableCell>
                          <TableCell>
                            {plan.billingCycle === "monthly" ? "Mensal" : 
                             plan.billingCycle === "annual" ? "Anual" : 
                             plan.billingCycle}
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.isActive ? "default" : "secondary"}>
                              {plan.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{plan.maxUsers || "Ilimitado"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              data-testid={`button-edit-plan-${plan.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPlanDialog(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              data-testid={`button-delete-plan-${plan.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete("plan", plan.id, plan.name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categorias</CardTitle>
                  <CardDescription>
                    Organize os serviços em categorias no marketplace
                  </CardDescription>
                </div>
                <Button 
                  data-testid="button-add-category"
                  onClick={() => handleOpenCategoryDialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ícone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma categoria encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((category) => (
                        <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                          <TableCell>{category.displayOrder}</TableCell>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {category.description || "-"}
                          </TableCell>
                          <TableCell>{category.icon || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={category.isActive ? "default" : "secondary"}>
                              {category.isActive ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              data-testid={`button-edit-category-${category.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCategoryDialog(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              data-testid={`button-delete-category-${category.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete("category", category.id, category.name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
            <DialogDescription>
              {editingService 
                ? "Atualize as informações do serviço"
                : "Adicione um novo serviço ao marketplace"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="service-name">Nome do Serviço</Label>
              <Input
                id="service-name"
                data-testid="input-service-name"
                value={serviceForm.nome}
                onChange={(e) => setServiceForm({ ...serviceForm, nome: e.target.value })}
                placeholder="Ex: Vectorizer Pro"
              />
            </div>
            <div>
              <Label htmlFor="service-description">Descrição</Label>
              <Textarea
                id="service-description"
                data-testid="input-service-description"
                value={serviceForm.descricao}
                onChange={(e) => setServiceForm({ ...serviceForm, descricao: e.target.value })}
                placeholder="Descreva o serviço..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="service-price">Preço (R$)</Label>
              <Input
                id="service-price"
                data-testid="input-service-price"
                value={serviceForm.preco}
                onChange={(e) => setServiceForm({ ...serviceForm, preco: e.target.value })}
                placeholder="17,50"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="service-active"
                checked={serviceForm.ativo}
                onCheckedChange={(checked) => setServiceForm({ ...serviceForm, ativo: checked })}
              />
              <Label htmlFor="service-active">Serviço Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseServiceDialog}>
              Cancelar
            </Button>
            <Button 
              data-testid="button-save-service"
              onClick={handleSaveService}
              disabled={serviceMutation.isPending || !serviceForm.nome || !serviceForm.preco}
            >
              {serviceMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan 
                ? "Atualize as informações do plano"
                : "Configure um novo plano de serviço"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan-service">Serviço</Label>
              <Select
                value={planForm.serviceId}
                onValueChange={(value) => setPlanForm({ ...planForm, serviceId: value })}
              >
                <SelectTrigger id="plan-service" data-testid="select-plan-service">
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="plan-name">Nome do Plano</Label>
              <Input
                id="plan-name"
                data-testid="input-plan-name"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="Ex: Plano Básico"
              />
            </div>
            <div>
              <Label htmlFor="plan-description">Descrição</Label>
              <Textarea
                id="plan-description"
                data-testid="input-plan-description"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Descreva o plano..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price">Preço (R$)</Label>
                <Input
                  id="plan-price"
                  data-testid="input-plan-price"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  placeholder="29,90"
                />
              </div>
              <div>
                <Label htmlFor="plan-cycle">Ciclo de Cobrança</Label>
                <Select
                  value={planForm.billingCycle}
                  onValueChange={(value) => setPlanForm({ ...planForm, billingCycle: value })}
                >
                  <SelectTrigger id="plan-cycle" data-testid="select-plan-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="plan-features">
                Recursos (um por linha ou JSON)
              </Label>
              <Textarea
                id="plan-features"
                data-testid="input-plan-features"
                value={planForm.features}
                onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                placeholder="Recurso 1&#10;Recurso 2&#10;Recurso 3"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="plan-maxusers">Máximo de Usuários (opcional)</Label>
              <Input
                id="plan-maxusers"
                data-testid="input-plan-maxusers"
                type="number"
                value={planForm.maxUsers}
                onChange={(e) => setPlanForm({ ...planForm, maxUsers: e.target.value })}
                placeholder="Deixe vazio para ilimitado"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="plan-active"
                checked={planForm.isActive}
                onCheckedChange={(checked) => setPlanForm({ ...planForm, isActive: checked })}
              />
              <Label htmlFor="plan-active">Plano Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePlanDialog}>
              Cancelar
            </Button>
            <Button 
              data-testid="button-save-plan"
              onClick={handleSavePlan}
              disabled={planMutation.isPending || !planForm.serviceId || !planForm.name || !planForm.price}
            >
              {planMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? "Atualize as informações da categoria"
                : "Adicione uma nova categoria ao marketplace"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nome da Categoria</Label>
              <Input
                id="category-name"
                data-testid="input-category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Ex: Produtividade"
              />
            </div>
            <div>
              <Label htmlFor="category-description">Descrição</Label>
              <Textarea
                id="category-description"
                data-testid="input-category-description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Descreva a categoria..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category-icon">Ícone (opcional)</Label>
                <Input
                  id="category-icon"
                  data-testid="input-category-icon"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="Ex: Zap"
                />
              </div>
              <div>
                <Label htmlFor="category-order">Ordem de Exibição</Label>
                <Input
                  id="category-order"
                  data-testid="input-category-order"
                  type="number"
                  value={categoryForm.displayOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="category-active"
                checked={categoryForm.isActive}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isActive: checked })}
              />
              <Label htmlFor="category-active">Categoria Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCategoryDialog}>
              Cancelar
            </Button>
            <Button 
              data-testid="button-save-category"
              onClick={handleSaveCategory}
              disabled={categoryMutation.isPending || !categoryForm.name}
            >
              {categoryMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{itemToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => {
                if (itemToDelete) {
                  deleteMutation.mutate({
                    type: itemToDelete.type,
                    id: itemToDelete.id
                  });
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}