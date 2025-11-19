import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";

interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (email: string, status: "ATIVO" | "INATIVO") => void;
  serviceName: string;
  isLoading?: boolean;
}

export default function AddSubscriberModal({
  open,
  onClose,
  onConfirm,
  serviceName,
  isLoading = false
}: AddSubscriberModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onConfirm(email, status);
    }
  };

  const handleClose = () => {
    setEmail("");
    setStatus("ATIVO");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Assinante</DialogTitle>
            <DialogDescription>
              Adicione um usuário manualmente ao serviço {serviceName}.
              O usuário precisa já estar cadastrado no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-subscriber-email"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="status">Status Inicial</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as "ATIVO" | "INATIVO")}>
                <SelectTrigger id="status" data-testid="select-subscriber-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo - Acesso liberado</SelectItem>
                  <SelectItem value="INATIVO">Inativo - Aguardando pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!email || isLoading}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Assinante
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}