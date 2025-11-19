import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Key, Plus, Power, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const addTokenSchema = z.object({
  label: z.string().min(1, "Label é obrigatório").max(100, "Label muito longo"),
  apiKey: z.string().min(10, "API Key é obrigatória"),
});

type AddTokenFormData = z.infer<typeof addTokenSchema>;

interface RemoveBgApiKey {
  id: string;
  label: string;
  maskedApiKey: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: string;
}

export default function AdminRemoveBgTokens() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<RemoveBgApiKey | null>(null);

  // Fetch tokens
  const { data: tokens, isLoading } = useQuery<RemoveBgApiKey[]>({
    queryKey: ["/api/admin/removebg-tokens"],
  });

  // Form for adding new token
  const form = useForm<AddTokenFormData>({
    resolver: zodResolver(addTokenSchema),
    defaultValues: {
      label: "",
      apiKey: "",
    },
  });

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: (data: AddTokenFormData) =>
      apiRequest("/api/admin/removebg-tokens", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg-tokens"] });
      toast({
        title: "Token criado",
        description: "O token foi adicionado com sucesso.",
      });
      setAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar token",
        description: error.message || "Não foi possível adicionar o token.",
        variant: "destructive",
      });
    },
  });

  // Activate token mutation
  const activateTokenMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/removebg-tokens/${id}/activate`, {
        method: "PUT",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg-tokens"] });
      toast({
        title: "Token ativado",
        description: "O token foi ativado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar token",
        description: error.message || "Não foi possível ativar o token.",
        variant: "destructive",
      });
    },
  });

  // Delete token mutation
  const deleteTokenMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/removebg-tokens/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg-tokens"] });
      toast({
        title: "Token removido",
        description: "O token foi removido com sucesso.",
      });
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover token",
        description: error.message || "Não foi possível remover o token.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (token: RemoveBgApiKey) => {
    setTokenToDelete(token);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tokenToDelete) {
      deleteTokenMutation.mutate(tokenToDelete.id);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">RemoveBG API Tokens</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os tokens de API para o serviço RemoveBG
            </p>
          </div>
        </div>
        <Button 
          onClick={() => setAddDialogOpen(true)}
          data-testid="button-add-token"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Token
        </Button>
      </div>

      {/* Tokens List */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens Cadastrados</CardTitle>
          <CardDescription>
            Tokens de API para autenticação com o serviço RemoveBG
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : tokens && tokens.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        {token.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {token.maskedApiKey}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.isActive ? "default" : "secondary"}>
                        {token.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(token.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {token.lastUsedAt
                        ? format(new Date(token.lastUsedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!token.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateTokenMutation.mutate(token.id)}
                            disabled={activateTokenMutation.isPending}
                            data-testid={`button-activate-${token.id}`}
                          >
                            <Power className="h-3 w-3 mr-1" />
                            Ativar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(token)}
                          disabled={deleteTokenMutation.isPending}
                          data-testid={`button-delete-${token.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum token cadastrado ainda
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Token Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Token RemoveBG</DialogTitle>
            <DialogDescription>
              Adicione um novo token de API para o serviço RemoveBG
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createTokenMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Token Principal"
                        data-testid="input-token-label"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Insira sua API Key do RemoveBG"
                        data-testid="input-token-apikey"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                  data-testid="button-cancel-add"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createTokenMutation.isPending}
                  data-testid="button-confirm-add"
                >
                  {createTokenMutation.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o token "{tokenToDelete?.label}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}