import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  user?: {
    id: string;
    email: string;
    status: string;
    discount?: number;
  };
}

export default function UserFormDialog({ open, onClose, onSubmit, user }: UserFormDialogProps) {
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(user?.status || "INATIVO");
  const [discount, setDiscount] = useState<number>(user?.discount || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let submitData;
    if (user) {
      // When editing: only send password if it's not empty, always send status and discount
      submitData = password.trim() 
        ? { password, status, discount }
        : { status, discount };
    } else {
      // When creating: send all fields
      submitData = { email, password, status, discount };
    }
    
    onSubmit(submitData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>
            {user ? "Atualize as informações do usuário" : "Adicione um novo usuário ao sistema"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@example.com"
                required
                data-testid="input-user-email"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Senha {user && "(deixe em branco para manter)"}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required={!user}
              data-testid="input-user-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" data-testid="select-user-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="INATIVO">Inativo</SelectItem>
                <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount">Desconto: {discount}%</Label>
            <Slider 
              id="discount"
              value={[discount]}
              onValueChange={(value) => setDiscount(value[0])}
              max={100}
              min={0}
              step={1}
              className="w-full"
              data-testid="slider-user-discount"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{discount}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button type="submit" data-testid="button-save-user">
              {user ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
