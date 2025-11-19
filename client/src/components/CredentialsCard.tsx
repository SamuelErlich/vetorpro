import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Lock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CredentialItem {
  label: string;
  value: string;
}

interface CredentialsCardProps {
  month: string;
  credentials: CredentialItem[];
  isLocked: boolean;
}

export default function CredentialsCard({ month, credentials, isLocked }: CredentialsCardProps) {
  const { toast } = useToast();
  const [isLoadingVectorizer, setIsLoadingVectorizer] = useState(false);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  const handleVectorizerLogin = async () => {
    setIsLoadingVectorizer(true);
    try {
      const response = await fetch('/api/vectorizer/autologin', {
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        toast({
          variant: "destructive",
          title: "Erro ao acessar Vectorizer",
          description: data.error || "Não foi possível gerar o link de acesso",
        });
        return;
      }

      // Copy ONLY password to clipboard (email is pre-filled by SSO URL)
      await navigator.clipboard.writeText(data.senha);

      // Open Vectorizer SSO URL in new tab (email already pre-filled)
      window.open(data.url, '_blank');
      
      toast({
        title: "✅ Senha copiada!",
        description: "Cole no campo de senha do Vectorizer (email já está preenchido)",
        duration: 5000,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível conectar ao servidor",
      });
    } finally {
      setIsLoadingVectorizer(false);
    }
  };

  if (isLocked) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Credenciais - {month}</CardTitle>
            <Badge variant="destructive">Bloqueado</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Lock className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Acesso Bloqueado</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Suas credenciais estão ocultas devido ao pagamento pendente. 
                Realize o pagamento para ter acesso novamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Credenciais - {month}</CardTitle>
          <Badge variant="secondary">Ativo</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {credentials.map((cred, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 p-4 rounded-md bg-muted/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">{cred.label}</p>
                <p className="font-mono text-base" data-testid={`text-credential-${idx}`}>{cred.value}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleCopy(cred.value)}
                data-testid={`button-copy-${idx}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleVectorizerLogin}
                    disabled={isLoadingVectorizer}
                    className="w-full"
                    data-testid="button-vectorizer-autologin"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {isLoadingVectorizer ? "Conectando..." : "Entrar no Vectorizer (1 Clique)"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copia sua senha e abre o Vectorizer (email já preenchido)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
