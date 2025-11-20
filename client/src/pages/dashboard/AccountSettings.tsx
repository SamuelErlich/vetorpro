import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User,
  Mail,
  Shield,
  Key,
  AlertCircle,
  CheckCircle,
  Trash2,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

type AuthMeResponse = { user: UserType };

export default function AccountSettings() {
  const { toast } = useToast();

  // Get current user
  const { data: userData } = useQuery<AuthMeResponse>({
    queryKey: ['/api/auth/me'],
  });

  const user = userData?.user;

  // Update password mutation (placeholder - needs backend implementation)
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar senha",
        description: "Verifique sua senha atual e tente novamente",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações da Conta</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e segurança
        </p>
      </div>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
          <CardDescription>
            Suas informações básicas e status da conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user?.email || "—"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Status da Conta</Label>
              <div className="flex items-center gap-2">
                {user?.status === "ATIVO" ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-600">Ativa</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-600">
                      {user?.status === "BLOQUEADO" ? "Bloqueada" : "Inativa"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Tipo de Conta</Label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {user?.isAdmin === "true" ? "Administrador" : "Cliente"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Desconto</Label>
              <div className="flex items-center gap-2">
                {user?.discount && user.discount > 0 ? (
                  <Badge variant="default">
                    {user.discount}% de desconto
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Sem desconto aplicado</span>
                )}
              </div>
            </div>
          </div>

          {user?.ultimoPagamento && (
            <>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Último Pagamento</Label>
                  <span className="font-medium">
                    {new Date(user.ultimoPagamento).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Próximo Vencimento</Label>
                  <span className="font-medium">
                    {user.nextPaymentDate 
                      ? new Date(user.nextPaymentDate).toLocaleDateString('pt-BR')
                      : "—"}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>
            Altere sua senha de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const currentPassword = formData.get('current-password') as string;
            const newPassword = formData.get('new-password') as string;
            const confirmPassword = formData.get('confirm-password') as string;

            if (newPassword !== confirmPassword) {
              toast({
                title: "Senhas não coincidem",
                description: "A nova senha e a confirmação devem ser iguais",
                variant: "destructive",
              });
              return;
            }

            updatePasswordMutation.mutate({ currentPassword, newPassword });
          }}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                name="current-password"
                type="password"
                required
                placeholder="Digite sua senha atual"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  required
                  placeholder="Digite a nova senha"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  placeholder="Confirme a nova senha"
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updatePasswordMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600">Zona de Perigo</CardTitle>
          <CardDescription>
            Ações irreversíveis relacionadas à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ao excluir sua conta, todos os seus dados serão permanentemente removidos. 
              Esta ação não pode ser desfeita.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="destructive" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Conta
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Entre em contato com o suporte para solicitar a exclusão da conta
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}