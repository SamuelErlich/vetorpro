import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Info, Users, Key, Activity, ArrowLeft, Edit2, Save, X, Plus, Trash, ToggleLeft, ToggleRight, UserPlus, CreditCard, Zap } from "lucide-react";
import { useState } from "react";
import type { Service, UserService, Credential, User, RemoveBgPlan } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInsertSchema } from "drizzle-zod";
import { credentials } from "@shared/schema";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const insertCredentialSchema = createInsertSchema(credentials).omit({
  id: true,
}).extend({
  data: z.string().min(1, "Dados são obrigatórios"),
  month: z.string().min(1, "Mês é obrigatório"),
});

interface ServiceWithSubscribers extends Service {
  subscribers?: UserServiceWithUser[];
}

interface UserServiceWithUser extends UserService {
  user?: User;
  plan?: RemoveBgPlan;
}

interface RemoveBgUsage {
  id: string;
  userId: string;
  fileName: string;
  creditsUsed: number;
  createdAt: Date;
  user?: User;
}

export default function ServiceDetails() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const serviceId = params.serviceId;
  const { toast } = useToast();
  const [editingService, setEditingService] = useState(false);
  const [editedService, setEditedService] = useState<Partial<Service>>({});
  const [editingUserPlans, setEditingUserPlans] = useState<Record<string, { planId: string | null; credits: number }>>({});

  // Fetch service details
  const { data: service, isLoading: serviceLoading } = useQuery<ServiceWithSubscribers>({
    queryKey: ["/api/admin/services", serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch service");
      return response.json();
    },
    enabled: !!serviceId,
  });

  // Fetch credentials for this service
  const { data: credentials } = useQuery<Credential[]>({
    queryKey: ["/api/admin/services", serviceId, "credentials"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/services/${serviceId}/credentials`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch credentials");
      return response.json();
    },
    enabled: !!serviceId,
  });

  // Fetch RemoveBG usage if it's RemoveBG service
  const { data: removeBgUsage } = useQuery<RemoveBgUsage[]>({
    queryKey: ["/api/admin/services", serviceId, "usage"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/services/${serviceId}/usage`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch usage");
      return response.json();
    },
    enabled: serviceId === "removebg-001",
  });

  // Fetch RemoveBG plans if it's RemoveBG service
  const { data: removeBgPlans } = useQuery<RemoveBgPlan[]>({
    queryKey: ["/api/removebg/plans"],
    queryFn: async () => {
      const response = await fetch("/api/removebg/plans", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      const result = await response.json();
      // Extract plans from the data property
      return result.data || [];
    },
    enabled: serviceId === "removebg-001",
  });

  // Update service mutation
  const updateServiceMutation = useMutation({
    mutationFn: async (updates: Partial<Service>) => {
      return apiRequest(`/api/admin/services/${serviceId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      toast({
        title: "Serviço atualizado",
        description: "As informações do serviço foram atualizadas com sucesso.",
      });
      setEditingService(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o serviço.",
        variant: "destructive",
      });
    },
  });

  // Toggle user service status mutation
  const toggleUserServiceMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      return apiRequest(`/api/admin/services/${serviceId}/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      toast({
        title: "Status atualizado",
        description: "O status do usuário foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o status do usuário.",
        variant: "destructive",
      });
    },
  });

  // Update user plan mutation (for RemoveBG)
  const updateUserPlanMutation = useMutation({
    mutationFn: async ({ userId, planId, credits }: { userId: string; planId: string | null; credits: number }) => {
      return apiRequest(`/api/admin/services/${serviceId}/users/${userId}/plan`, {
        method: "PUT",
        body: JSON.stringify({ planId, credits }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      setEditingUserPlans({});
      toast({
        title: "Plano atualizado",
        description: "O plano e créditos foram atualizados com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message || "Não foi possível atualizar o plano do usuário.",
        variant: "destructive",
      });
    },
  });


  // Create credential form
  const form = useForm<z.infer<typeof insertCredentialSchema>>({
    resolver: zodResolver(insertCredentialSchema),
    defaultValues: {
      serviceId: serviceId,
      userId: null,
      month: new Date().toISOString().slice(0, 7),
      data: "",
    },
  });

  const createCredentialMutation = useMutation({
    mutationFn: async (values: z.infer<typeof insertCredentialSchema>) => {
      return apiRequest("/api/admin/credentials", {
        method: "POST",
        body: JSON.stringify({ ...values, serviceId }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId, "credentials"] });
      toast({
        title: "Credencial criada",
        description: "A credencial foi criada com sucesso.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar",
        description: error.message || "Não foi possível criar a credencial.",
        variant: "destructive",
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      return apiRequest(`/api/admin/credentials/${credentialId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId, "credentials"] });
      toast({
        title: "Credencial excluída",
        description: "A credencial foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir a credencial.",
        variant: "destructive",
      });
    },
  });

  if (serviceLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Serviço não encontrado</p>
            <Button onClick={() => setLocation("/admin")} className="mt-4">
              Voltar ao Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubscribers = service.subscribers?.filter(s => s.status === "ATIVO").length || 0;
  const totalSubscribers = service.subscribers?.length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{service.nome}</h1>
              <p className="text-muted-foreground">Gerenciar serviço</p>
            </div>
          </div>
          <Badge variant={service.ativo ? "default" : "secondary"}>
            {service.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assinantes ({activeSubscribers})
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Credenciais
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Uso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Informações do Serviço</CardTitle>
                  {!editingService ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingService(true);
                        setEditedService(service);
                      }}
                      data-testid="button-edit-service"
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateServiceMutation.mutate(editedService)}
                        data-testid="button-save-service"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingService(false)}
                        data-testid="button-cancel-edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  {editingService ? (
                    <Input
                      value={editedService.nome || ""}
                      onChange={(e) => setEditedService({ ...editedService, nome: e.target.value })}
                      data-testid="input-service-name"
                    />
                  ) : (
                    <p className="text-lg">{service.nome}</p>
                  )}
                </div>

                <div>
                  <Label>Descrição</Label>
                  {editingService ? (
                    <Textarea
                      value={editedService.descricao || ""}
                      onChange={(e) => setEditedService({ ...editedService, descricao: e.target.value })}
                      data-testid="input-service-description"
                    />
                  ) : (
                    <p className="text-muted-foreground">{service.descricao || "Sem descrição"}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Preço</Label>
                    {editingService ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedService.preco || ""}
                        onChange={(e) => setEditedService({ ...editedService, preco: e.target.value })}
                        data-testid="input-service-price"
                      />
                    ) : (
                      <p className="text-lg font-semibold">R$ {service.preco}</p>
                    )}
                  </div>

                  <div>
                    <Label>Status</Label>
                    {editingService ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <Switch
                          checked={editedService.ativo || false}
                          onCheckedChange={(checked) => setEditedService({ ...editedService, ativo: checked })}
                          data-testid="switch-service-active"
                        />
                        <Label>{editedService.ativo ? "Ativo" : "Inativo"}</Label>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Badge variant={service.ativo ? "default" : "secondary"}>
                          {service.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>ID do Serviço</Label>
                  <p className="text-sm text-muted-foreground font-mono">{service.id}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Assinantes do Serviço</CardTitle>
                    <CardDescription>
                      {activeSubscribers} assinantes ativos de {totalSubscribers} total
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {service.subscribers && service.subscribers.length > 0 ? (
                    service.subscribers.map((subscriber) => {
                      const isEditing = !!editingUserPlans[subscriber.userId];
                      const editingPlan = editingUserPlans[subscriber.userId];
                      const plansArray = Array.isArray(removeBgPlans) ? removeBgPlans : [];
                      const currentPlan = plansArray.find(p => p.id === subscriber.planId);
                      
                      return (
                        <div
                          key={subscriber.id}
                          className="p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-medium">{subscriber.user?.email}</p>
                                <Badge variant={
                                  subscriber.status === "ATIVO" ? "default" : 
                                  subscriber.status === "INATIVO" ? "secondary" : 
                                  "destructive"
                                }>
                                  {subscriber.status}
                                </Badge>
                              </div>
                              
                              {/* RemoveBG specific fields */}
                              {serviceId === "removebg-001" ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-sm text-muted-foreground">Plano Atual</Label>
                                      {isEditing ? (
                                        <Select
                                          value={editingPlan?.planId || ""}
                                          onValueChange={(value) => setEditingUserPlans(prev => ({
                                            ...prev,
                                            [subscriber.userId]: {
                                              ...prev[subscriber.userId],
                                              planId: value || null,
                                              credits: plansArray.find(p => p.id === value)?.credits || prev[subscriber.userId]?.credits || 0
                                            }
                                          }))}
                                        >
                                          <SelectTrigger className="w-full mt-1" data-testid={`select-plan-${subscriber.userId}`}>
                                            <SelectValue placeholder="Selecione um plano" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="">Sem plano</SelectItem>
                                            {plansArray.map(plan => (
                                              <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name} - R${plan.price} ({plan.credits} créditos)
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <div className="flex items-center gap-2 mt-1">
                                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-medium">
                                            {currentPlan ? `${currentPlan.name} - R$${currentPlan.price}` : "Sem plano"}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div>
                                      <Label className="text-sm text-muted-foreground">Créditos Disponíveis</Label>
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          min="0"
                                          className="mt-1"
                                          value={editingPlan?.credits || subscriber.creditsAvailable || 0}
                                          onChange={(e) => setEditingUserPlans(prev => ({
                                            ...prev,
                                            [subscriber.userId]: {
                                              ...prev[subscriber.userId],
                                              credits: parseInt(e.target.value) || 0
                                            }
                                          }))}
                                          data-testid={`input-credits-${subscriber.userId}`}
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 mt-1">
                                          <Zap className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-medium">{subscriber.creditsAvailable || 0}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-4 text-sm text-muted-foreground">
                                    {subscriber.ultimoPagamento && (
                                      <span>Último pagamento: {new Date(subscriber.ultimoPagamento).toLocaleDateString()}</span>
                                    )}
                                    {subscriber.proximoPagamento && (
                                      <span>Próximo pagamento: {new Date(subscriber.proximoPagamento).toLocaleDateString()}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // Non-RemoveBG service display
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  {subscriber.ultimoPagamento && (
                                    <span>Último pagamento: {new Date(subscriber.ultimoPagamento).toLocaleDateString()}</span>
                                  )}
                                  {subscriber.proximoPagamento && (
                                    <span>Próximo pagamento: {new Date(subscriber.proximoPagamento).toLocaleDateString()}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2">
                              {serviceId === "removebg-001" && (
                                <>
                                  {isEditing ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          const plan = editingUserPlans[subscriber.userId];
                                          updateUserPlanMutation.mutate({
                                            userId: subscriber.userId,
                                            planId: plan.planId,
                                            credits: plan.credits
                                          });
                                        }}
                                        data-testid={`button-save-plan-${subscriber.userId}`}
                                      >
                                        <Save className="mr-2 h-4 w-4" />
                                        Salvar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingUserPlans(prev => {
                                          const next = { ...prev };
                                          delete next[subscriber.userId];
                                          return next;
                                        })}
                                        data-testid={`button-cancel-plan-${subscriber.userId}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingUserPlans(prev => ({
                                        ...prev,
                                        [subscriber.userId]: {
                                          planId: subscriber.planId,
                                          credits: subscriber.creditsAvailable || 0
                                        }
                                      }))}
                                      data-testid={`button-edit-plan-${subscriber.userId}`}
                                    >
                                      <Edit2 className="mr-2 h-4 w-4" />
                                      Editar Plano
                                    </Button>
                                  )}
                                </>
                              )}
                              
                              <Button
                                variant={subscriber.status === "ATIVO" ? "destructive" : "default"}
                                size="sm"
                                onClick={() => toggleUserServiceMutation.mutate({
                                  userId: subscriber.userId,
                                  newStatus: subscriber.status === "ATIVO" ? "INATIVO" : "ATIVO"
                                })}
                                data-testid={`button-toggle-user-${subscriber.userId}`}
                              >
                                {subscriber.status === "ATIVO" ? (
                                  <>
                                    <ToggleLeft className="mr-2 h-4 w-4" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <ToggleRight className="mr-2 h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum assinante encontrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Credenciais Compartilhadas</CardTitle>
                    <CardDescription>
                      Credenciais disponíveis para todos os assinantes ativos
                    </CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-credential">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Credencial
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Nova Credencial</DialogTitle>
                        <DialogDescription>
                          Adicione uma nova credencial para este serviço
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit((values) => createCredentialMutation.mutate(values))} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="month"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mês</FormLabel>
                                <FormControl>
                                  <Input type="month" {...field} data-testid="input-credential-month" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="data"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dados da Credencial (JSON)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    placeholder='{"username": "user", "password": "pass"}'
                                    data-testid="input-credential-data"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" data-testid="button-submit-credential">
                              Criar Credencial
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {credentials && credentials.length > 0 ? (
                    credentials.map((credential) => (
                      <div
                        key={credential.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">Mês: {credential.month}</p>
                          <pre className="text-sm text-muted-foreground">{credential.data}</pre>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCredentialMutation.mutate(credential.id)}
                          data-testid={`button-delete-credential-${credential.id}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma credencial encontrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Uso do Serviço</CardTitle>
                <CardDescription>
                  {serviceId === "removebg-001" ? "Histórico de uso do RemoveBG" : "Informações de uso do serviço"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {serviceId === "removebg-001" ? (
                  <div className="space-y-2">
                    {removeBgUsage && removeBgUsage.length > 0 ? (
                      removeBgUsage.map((usage) => (
                        <div
                          key={usage.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{usage.user?.email || usage.userId}</p>
                            <div className="text-sm text-muted-foreground">
                              <span>{usage.fileName}</span>
                              <span className="mx-2">•</span>
                              <span>{usage.creditsUsed} créditos</span>
                              <span className="mx-2">•</span>
                              <span>{new Date(usage.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum uso registrado
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Este serviço não possui dados de uso individual
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}