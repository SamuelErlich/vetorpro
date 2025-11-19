import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  serviceName: string;
  serviceId: string;
}

export default function AddSubscriberModal({
  open,
  onClose,
  onSuccess,
  serviceName,
  serviceId
}: AddSubscriberModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [userNotFoundError, setUserNotFoundError] = useState(false);
  const [createUserStatus, setCreateUserStatus] = useState<"idle" | "success" | "error">("idle");
  const { toast } = useToast();

  // Mutation to add subscriber to service
  const addSubscriberMutation = useMutation({
    mutationFn: async ({ email, status }: { email: string; status: "ATIVO" | "INATIVO" }) => {
      return apiRequest(`/api/admin/services/${serviceId}/subscribe`, {
        method: "POST",
        body: JSON.stringify({ email, status }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", serviceId] });
      toast({
        title: "Assinante adicionado",
        description: "O usuário foi adicionado ao serviço com sucesso.",
      });
      handleClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      // Check if it's a 404 error (user not found)
      if (error?.status === 404 || error?.message?.includes("não encontrado") || error?.message?.includes("Usuário não encontrado")) {
        setUserNotFoundError(true);
      } else {
        toast({
          title: "Erro ao adicionar assinante",
          description: error.message || "Não foi possível adicionar o usuário ao serviço.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation to create and invite user
  const createUserMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/users/create-and-send-email', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          status: "PENDENTE" // New users start as PENDENTE
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setCreateUserStatus("success");
      
      if (response.emailSent) {
        toast({
          title: "Usuário criado com sucesso!",
          description: `Email enviado para ${email} com instruções para criar a senha. Após criar a senha, o usuário poderá ser adicionado ao serviço.`,
        });
      } else {
        toast({
          title: "Usuário criado (email não enviado)",
          description: response.warning || "Configure RESEND_API_KEY para enviar emails. O usuário foi criado mas precisa criar a senha manualmente.",
          variant: "default",
        });
      }

      // Close modal after a delay to show success message
      setTimeout(() => {
        handleClose();
      }, 3000);
    },
    onError: (error: any) => {
      setCreateUserStatus("error");
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Não foi possível criar o usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Reset error states
    setUserNotFoundError(false);
    setCreateUserStatus("idle");

    // Try to add the subscriber
    addSubscriberMutation.mutate({ email, status });
  };

  const handleCreateAndInvite = () => {
    if (!email) return;
    createUserMutation.mutate();
  };

  const handleClose = () => {
    setEmail("");
    setStatus("ATIVO");
    setUserNotFoundError(false);
    setCreateUserStatus("idle");
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Assinante</DialogTitle>
            <DialogDescription>
              Adicione um usuário ao serviço {serviceName}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Helper text explaining the requirement */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-medium">Como funciona</AlertTitle>
              <AlertDescription className="text-sm">
                Para adicionar um assinante, o usuário precisa estar cadastrado no sistema e ter criado sua senha. 
                Se o usuário ainda não existe, você pode criá-lo e enviar um convite.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setUserNotFoundError(false);
                  setCreateUserStatus("idle");
                }}
                required
                disabled={addSubscriberMutation.isPending || createUserMutation.isPending}
                data-testid="input-subscriber-email"
              />
              {/* Show helper text below the input */}
              <p className="text-sm text-muted-foreground">
                Digite o email do usuário que deseja adicionar ao serviço
              </p>
            </div>
            
            {/* Show error and create option when user is not found */}
            {userNotFoundError && createUserStatus === "idle" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Usuário não encontrado</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    O email <strong>{email}</strong> não está cadastrado no sistema.
                  </p>
                  <p className="text-sm">
                    Você precisa criar o usuário primeiro antes de adicioná-lo ao serviço.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={handleCreateAndInvite}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando usuário...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Criar usuário e enviar convite
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUserNotFoundError(false);
                        setEmail("");
                      }}
                    >
                      Tentar outro email
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Show success message when user is created */}
            {createUserStatus === "success" && (
              <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-700 dark:text-green-300">
                  Usuário criado com sucesso!
                </AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <p className="mb-2">
                    Um email foi enviado para <strong>{email}</strong> com instruções para criar a senha.
                  </p>
                  <p className="text-sm">
                    Após o usuário criar sua senha, você poderá adicioná-lo ao serviço {serviceName}.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Only show status selector if no error or after user is created */}
            {!userNotFoundError && createUserStatus !== "success" && (
              <div className="grid gap-2">
                <Label htmlFor="status">Status Inicial do Assinante</Label>
                <Select 
                  value={status} 
                  onValueChange={(value) => setStatus(value as "ATIVO" | "INATIVO")}
                  disabled={addSubscriberMutation.isPending || createUserMutation.isPending}
                >
                  <SelectTrigger id="status" data-testid="select-subscriber-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo - Acesso imediato ao serviço</SelectItem>
                    <SelectItem value="INATIVO">Inativo - Aguardando primeiro pagamento</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Define se o usuário terá acesso imediato ou precisará fazer o pagamento primeiro
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              disabled={addSubscriberMutation.isPending || createUserMutation.isPending}
            >
              {createUserStatus === "success" ? "Fechar" : "Cancelar"}
            </Button>
            {/* Only show Add button if no error and user not created yet */}
            {!userNotFoundError && createUserStatus === "idle" && (
              <Button 
                type="submit" 
                disabled={!email || addSubscriberMutation.isPending || createUserMutation.isPending}
              >
                {addSubscriberMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar Assinante
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}