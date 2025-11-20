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

// Schema for category validation
const categorySchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome muito longo"),
  description: z.string()
    .max(200, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  icon: z.string()
    .max(50, "Nome do ícone muito longo")
    .optional()
    .or(z.literal("")),
  displayOrder: z.string()
    .regex(/^\d*$/, "Deve ser um número"),
  isActive: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: string;
    name: string;
    description: string | null;
    icon: string | null;
    displayOrder: number;
    isActive: boolean;
  } | null;
  onSubmit: (data: any) => Promise<void>;
}

export default function CategoryForm({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      icon: initialData?.icon || "",
      displayOrder: initialData?.displayOrder?.toString() || "0",
      isActive: initialData?.isActive ?? true,
    },
  });

  // Reset form when initialData changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData?.name || "",
        description: initialData?.description || "",
        icon: initialData?.icon || "",
        displayOrder: initialData?.displayOrder?.toString() || "0",
        isActive: initialData?.isActive ?? true,
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      const processedData = {
        ...data,
        displayOrder: data.displayOrder === "" ? 0 : parseInt(data.displayOrder),
      };
      await onSubmit(processedData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Editar Categoria" : "Nova Categoria"}
          </DialogTitle>
          <DialogDescription>
            Configure os detalhes da categoria de serviços.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Categoria</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Ferramentas de Imagem"
                      {...field}
                      data-testid="input-category-name"
                    />
                  </FormControl>
                  <FormDescription>
                    Nome exibido para organizar serviços
                  </FormDescription>
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
                      placeholder="Breve descrição da categoria..."
                      className="resize-none h-20"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-category-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Descrição opcional da categoria
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ícone (Lucide)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: ImageIcon"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-category-icon"
                      />
                    </FormControl>
                    <FormDescription>
                      Nome do ícone Lucide
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="0"
                        {...field}
                        data-testid="input-category-order"
                      />
                    </FormControl>
                    <FormDescription>
                      Posição na lista (menor primeiro)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Categoria Ativa
                    </FormLabel>
                    <FormDescription>
                      Categorias inativas não são exibidas
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-category-active"
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
                  : "Criar Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}