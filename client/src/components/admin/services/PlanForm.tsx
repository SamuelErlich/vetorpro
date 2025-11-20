import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// Schema for plan validation
const planSchema = z.object({
  serviceId: z.string().min(1, "Selecione um serviço"),
  name: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome muito longo"),
  description: z.string()
    .max(500, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Formato de preço inválido (ex: 29.90)"),
  billingCycle: z.enum(["monthly", "quarterly", "yearly", "once"]),
  features: z.string(),
  maxUsers: z.string()
    .regex(/^\d*$/, "Deve ser um número")
    .optional()
    .or(z.literal("")),
  credits: z.string()
    .regex(/^\d*$/, "Deve ser um número")
    .optional()
    .or(z.literal("")),
  storageLimit: z.string()
    .regex(/^\d*$/, "Deve ser um número em MB")
    .optional()
    .or(z.literal("")),
  apiCallsLimit: z.string()
    .regex(/^\d*$/, "Deve ser um número")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface PlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: string;
    serviceId: string;
    name: string;
    description: string | null;
    price: string;
    billingCycle: string;
    features: Record<string, any>;
    maxUsers?: number;
    credits?: number;
    storageLimit?: number;
    apiCallsLimit?: number;
    isActive: boolean;
  } | null;
  onSubmit: (data: any) => Promise<void>;
}

export default function PlanForm({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: PlanFormProps) {
  // Fetch available services
  const { data: services = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/services'],
  });

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      serviceId: initialData?.serviceId || "",
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || "",
      billingCycle: (initialData?.billingCycle as any) || "monthly",
      features: initialData?.features ? JSON.stringify(initialData.features, null, 2) : "{}",
      maxUsers: initialData?.maxUsers?.toString() || "",
      credits: initialData?.credits?.toString() || "",
      storageLimit: initialData?.storageLimit?.toString() || "",
      apiCallsLimit: initialData?.apiCallsLimit?.toString() || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  // Reset form when initialData changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        serviceId: initialData?.serviceId || "",
        name: initialData?.name || "",
        description: initialData?.description || "",
        price: initialData?.price || "",
        billingCycle: (initialData?.billingCycle as any) || "monthly",
        features: initialData?.features ? JSON.stringify(initialData.features, null, 2) : "{}",
        maxUsers: initialData?.maxUsers?.toString() || "",
        credits: initialData?.credits?.toString() || "",
        storageLimit: initialData?.storageLimit?.toString() || "",
        apiCallsLimit: initialData?.apiCallsLimit?.toString() || "",
        isActive: initialData?.isActive ?? true,
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = async (data: PlanFormData) => {
    try {
      // Parse features JSON and convert numeric strings
      const processedData = {
        ...data,
        features: JSON.parse(data.features || "{}"),
        maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
        credits: data.credits ? parseInt(data.credits) : undefined,
        storageLimit: data.storageLimit ? parseInt(data.storageLimit) : undefined,
        apiCallsLimit: data.apiCallsLimit ? parseInt(data.apiCallsLimit) : undefined,
      };
      
      await onSubmit(processedData);
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      if (error.message.includes("JSON")) {
        form.setError("features", {
          message: "JSON inválido. Verifique o formato.",
        });
      }
    }
  };

  const billingCycles = [
    { value: "monthly", label: "Mensal" },
    { value: "quarterly", label: "Trimestral" },
    { value: "yearly", label: "Anual" },
    { value: "once", label: "Único" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Editar Plano" : "Novo Plano"}
          </DialogTitle>
          <DialogDescription>
            Configure os detalhes do plano de assinatura.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select
                    disabled={!!initialData?.id}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-plan-service">
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services?.map((service: any) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Serviço ao qual este plano pertence
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Plano</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Plano Pro"
                      {...field}
                      data-testid="input-plan-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os benefícios deste plano..."
                      className="resize-none h-20"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-plan-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="29.90"
                        {...field}
                        data-testid="input-plan-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciclo de Cobrança</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-plan-billing">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {billingCycles.map((cycle) => (
                          <SelectItem key={cycle.value} value={cycle.value}>
                            {cycle.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="credits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Créditos</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="100"
                        {...field}
                        data-testid="input-plan-credits"
                      />
                    </FormControl>
                    <FormDescription>
                      Créditos incluídos (opcional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máx. Usuários</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="5"
                        {...field}
                        data-testid="input-plan-max-users"
                      />
                    </FormControl>
                    <FormDescription>
                      Limite de usuários (opcional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="storageLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Armazenamento (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="1000"
                        {...field}
                        data-testid="input-plan-storage"
                      />
                    </FormControl>
                    <FormDescription>
                      Limite em MB (opcional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiCallsLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chamadas API</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="10000"
                        {...field}
                        data-testid="input-plan-api-calls"
                      />
                    </FormControl>
                    <FormDescription>
                      Limite mensal (opcional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recursos (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='{"feature1": true, "feature2": "value"}'
                      className="resize-none h-24 font-mono text-sm"
                      {...field}
                      data-testid="textarea-plan-features"
                    />
                  </FormControl>
                  <FormDescription>
                    Recursos adicionais em formato JSON
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Plano Ativo
                    </FormLabel>
                    <FormDescription>
                      Planos inativos não aparecem para seleção
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-plan-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting}
                data-testid="button-submit"
              >
                {form.formState.isSubmitting
                  ? "Salvando..."
                  : initialData?.id
                  ? "Salvar Alterações"
                  : "Criar Plano"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}