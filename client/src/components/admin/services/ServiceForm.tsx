import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// Schema for service validation
const serviceSchema = z.object({
  nome: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome muito longo"),
  descricao: z.string()
    .max(500, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  preco: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Formato de preço inválido (ex: 19.90)"),
  ativo: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: string;
    nome: string;
    descricao: string | null;
    preco: string;
    ativo: boolean;
  } | null;
  onSubmit: (data: ServiceFormData) => Promise<void>;
}

export default function ServiceForm({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: ServiceFormProps) {
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      nome: initialData?.nome || "",
      descricao: initialData?.descricao || "",
      preco: initialData?.preco || "",
      ativo: initialData?.ativo ?? true,
    },
  });

  // Reset form when initialData changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        nome: initialData?.nome || "",
        descricao: initialData?.descricao || "",
        preco: initialData?.preco || "",
        ativo: initialData?.ativo ?? true,
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = async (data: ServiceFormData) => {
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
          <DialogDescription>
            Preencha as informações do serviço abaixo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Serviço</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: RemoveBG Pro"
                      {...field}
                      data-testid="input-service-name"
                    />
                  </FormControl>
                  <FormDescription>
                    Nome que será exibido para os usuários
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que este serviço oferece..."
                      className="resize-none h-20"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-service-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Breve descrição do serviço (opcional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="19.90"
                      {...field}
                      data-testid="input-service-price"
                    />
                  </FormControl>
                  <FormDescription>
                    Preço base do serviço em reais
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Serviço Ativo
                    </FormLabel>
                    <FormDescription>
                      Serviços inativos não aparecem para novos usuários
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-service-active"
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
                  : "Criar Serviço"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}