import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  email: string;
}

interface Credential {
  id: string;
  userId: string;
  month: string;
  data: string;
}

interface CredentialFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  users: User[];
  credential?: Credential;
}

export default function CredentialFormDialog({ 
  open, 
  onClose, 
  onSubmit, 
  users,
  credential 
}: CredentialFormDialogProps) {
  const [month, setMonth] = useState(credential?.month || "");
  const [data, setData] = useState(credential?.data || "");

  useEffect(() => {
    if (credential) {
      setMonth(credential.month);
      setData(credential.data);
    } else {
      setMonth("");
      setData("");
    }
  }, [credential, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ userId: null, month, data });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {credential ? "Editar Credencial" : "Nova Credencial"}
          </DialogTitle>
          <DialogDescription>
            {credential 
              ? "Atualize as informações da credencial compartilhada" 
              : "Adicione uma nova credencial compartilhada. Todos os usuários com pagamento ativo poderão visualizar."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="month">Mês/Período</Label>
            <Input
              id="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="Ex: Janeiro 2025"
              required
              data-testid="input-credential-month"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Dados da Credencial (JSON)</Label>
            <Textarea
              id="data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder='{"usuario": "user@example.com", "senha": "senha123", "chave": "abc123"}'
              rows={6}
              required
              className="font-mono text-sm"
              data-testid="input-credential-data"
            />
            <p className="text-xs text-muted-foreground">
              Use formato JSON para armazenar múltiplos dados
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button type="submit" data-testid="button-save-credential">
              {credential ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
