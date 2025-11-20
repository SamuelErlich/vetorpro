import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Package,
  DollarSign,
  Layers,
} from "lucide-react";

// Import the smaller components
import ServiceForm from "@/components/admin/services/ServiceForm";
import PlanForm from "@/components/admin/services/PlanForm";
import CategoryForm from "@/components/admin/services/CategoryForm";
import ServiceTable from "@/components/admin/services/ServiceTable";
import PlanTable from "@/components/admin/services/PlanTable";
import CategoryTable from "@/components/admin/services/CategoryTable";
import ServiceStats from "@/components/admin/services/ServiceStats";

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
  credits?: number;
  maxUsers?: number;
  storageLimit?: number;
  apiCallsLimit?: number;
  isActive: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

/**
 * Refactored Admin Service Management Component
 * 
 * This component manages services, plans, and categories using smaller,
 * reusable components with proper form validation using react-hook-form and Zod.
 */
export default function AdminServiceManagementV2() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("services");
  
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

  // ========== QUERIES ==========
  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery<ServicePlan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: userServices = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/user-services"],
  });

  // ========== MUTATIONS ==========
  
  // Service mutations
  const createServiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({
        title: "Serviço criado",
        description: "O serviço foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar o serviço.",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => 
      apiRequest(`/api/admin/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({
        title: "Serviço atualizado",
        description: "O serviço foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o serviço.",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/services/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o serviço.",
      });
    },
  });

  // Plan mutations
  const createPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({
        title: "Plano criado",
        description: "O plano foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar o plano.",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => 
      apiRequest(`/api/admin/plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({
        title: "Plano atualizado",
        description: "O plano foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o plano.",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/plans/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({
        title: "Plano excluído",
        description: "O plano foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o plano.",
      });
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Categoria criada",
        description: "A categoria foi criada com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar a categoria.",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => 
      apiRequest(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Categoria atualizada",
        description: "A categoria foi atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar a categoria.",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/categories/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a categoria.",
      });
    },
  });

  // ========== HANDLERS ==========
  
  // Service handlers
  const handleServiceSubmit = async (data: any) => {
    if (editingService) {
      await updateServiceMutation.mutateAsync({ id: editingService.id, ...data });
    } else {
      await createServiceMutation.mutateAsync(data);
    }
  };

  const handleServiceEdit = (service: Service) => {
    setEditingService(service);
    setServiceDialogOpen(true);
  };

  const handleServiceDelete = (service: Service) => {
    setItemToDelete({ type: "service", id: service.id, name: service.nome });
    setDeleteDialogOpen(true);
  };

  const handleServiceToggleStatus = async (service: Service) => {
    await updateServiceMutation.mutateAsync({
      id: service.id,
      ativo: !service.ativo,
    });
  };

  // Plan handlers
  const handlePlanSubmit = async (data: any) => {
    if (editingPlan) {
      await updatePlanMutation.mutateAsync({ id: editingPlan.id, ...data });
    } else {
      await createPlanMutation.mutateAsync(data);
    }
  };

  const handlePlanEdit = (plan: ServicePlan) => {
    setEditingPlan(plan);
    setPlanDialogOpen(true);
  };

  const handlePlanDelete = (plan: ServicePlan) => {
    setItemToDelete({ type: "plan", id: plan.id, name: plan.name });
    setDeleteDialogOpen(true);
  };

  // Category handlers
  const handleCategorySubmit = async (data: any) => {
    if (editingCategory) {
      await updateCategoryMutation.mutateAsync({ id: editingCategory.id, ...data });
    } else {
      await createCategoryMutation.mutateAsync(data);
    }
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleCategoryDelete = (category: Category) => {
    setItemToDelete({ type: "category", id: category.id, name: category.name });
    setDeleteDialogOpen(true);
  };

  const handleCategoryReorder = async (category: Category, direction: "up" | "down") => {
    const newOrder = direction === "up" ? category.displayOrder - 1 : category.displayOrder + 1;
    await updateCategoryMutation.mutateAsync({
      id: category.id,
      displayOrder: newOrder,
    });
  };

  // Delete confirmation handler
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "service") {
        await deleteServiceMutation.mutateAsync(itemToDelete.id);
      } else if (itemToDelete.type === "plan") {
        await deletePlanMutation.mutateAsync(itemToDelete.id);
      } else if (itemToDelete.type === "category") {
        await deleteCategoryMutation.mutateAsync(itemToDelete.id);
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const isLoading = loadingServices || loadingPlans || loadingCategories;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Serviços</h1>
        <p className="text-muted-foreground">
          Gerencie serviços, planos e categorias da plataforma
        </p>
      </div>

      {/* Stats */}
      <ServiceStats
        services={services}
        plans={plans}
        categories={categories}
        userServices={userServices}
      />

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Serviços</CardTitle>
          <CardDescription>
            Adicione e configure serviços, planos de assinatura e categorias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="services" className="gap-2">
                <Package className="h-4 w-4" />
                Serviços
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Planos
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-2">
                <Layers className="h-4 w-4" />
                Categorias
              </TabsTrigger>
            </TabsList>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Serviços Disponíveis</h3>
                <Button
                  onClick={() => {
                    setEditingService(null);
                    setServiceDialogOpen(true);
                  }}
                  data-testid="button-new-service"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Serviço
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando serviços...
                </div>
              ) : (
                <ServiceTable
                  services={services}
                  onEdit={handleServiceEdit}
                  onDelete={handleServiceDelete}
                  onToggleStatus={handleServiceToggleStatus}
                />
              )}
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent value="plans" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Planos de Assinatura</h3>
                <Button
                  onClick={() => {
                    setEditingPlan(null);
                    setPlanDialogOpen(true);
                  }}
                  data-testid="button-new-plan"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Plano
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando planos...
                </div>
              ) : (
                <PlanTable
                  plans={plans}
                  services={services}
                  onEdit={handlePlanEdit}
                  onDelete={handlePlanDelete}
                />
              )}
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Categorias de Serviços</h3>
                <Button
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryDialogOpen(true);
                  }}
                  data-testid="button-new-category"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Categoria
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando categorias...
                </div>
              ) : (
                <CategoryTable
                  categories={categories}
                  onEdit={handleCategoryEdit}
                  onDelete={handleCategoryDelete}
                  onReorder={handleCategoryReorder}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Forms */}
      <ServiceForm
        open={serviceDialogOpen}
        onOpenChange={(open) => {
          setServiceDialogOpen(open);
          if (!open) setEditingService(null);
        }}
        initialData={editingService}
        onSubmit={handleServiceSubmit}
      />

      <PlanForm
        open={planDialogOpen}
        onOpenChange={(open) => {
          setPlanDialogOpen(open);
          if (!open) setEditingPlan(null);
        }}
        initialData={editingPlan}
        onSubmit={handlePlanSubmit}
      />

      <CategoryForm
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        initialData={editingCategory}
        onSubmit={handleCategorySubmit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              {itemToDelete?.type === "service" && "o serviço"}
              {itemToDelete?.type === "plan" && "o plano"}
              {itemToDelete?.type === "category" && "a categoria"}{" "}
              <span className="font-semibold">{itemToDelete?.name}</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setItemToDelete(null)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}