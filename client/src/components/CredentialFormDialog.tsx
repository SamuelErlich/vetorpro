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
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [chaveAPI, setChaveAPI] = useState("");
  const [originalData, setOriginalData] = useState<any>({});

  useEffect(() => {
    if (credential) {
      setMonth(credential.month);
      
      // Parse JSON para popular os campos individuais
      try {
        const parsed = JSON.parse(credential.data);
        setOriginalData(parsed); // Guardar JSON original para preservar outros campos
        setUsuario(parsed.usuario || "");
        setSenha(parsed.senha || "");
        setChaveAPI(parsed.chaveAPI || "");
      } catch (e) {
        // Se JSON inválido, limpar campos
        setOriginalData({});
        setUsuario("");
        setSenha("");
        setChaveAPI("");
      }
    } else {
      setMonth("");
      setOriginalData({});
      setUsuario("");
      setSenha("");
      setChaveAPI("");
    }
  }, [credential, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Fazer merge: preservar campos originais + atualizar os 3 campos editáveis
    const mergedData = {
      ...originalData, // Preservar campos que já existiam
    };
    
    // Adicionar campos apenas se não estiverem vazios
    if (usuario.trim()) mergedData.usuario = usuario.trim();
    if (senha.trim()) mergedData.senha = senha.trim();
    if (chaveAPI.trim()) mergedData.chaveAPI = chaveAPI.trim();
    
    const jsonData = JSON.stringify(mergedData);
    
    onSubmit({ userId: null, month, data: jsonData });
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
            <Label htmlFor="usuario">Usuário</Label>
            <Input
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ex: vectorizer@service.com"
              data-testid="input-credential-usuario"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="text"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Ex: Vectorizer@2025"
              data-testid="input-credential-senha"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chaveAPI">Chave API</Label>
            <Input
              id="chaveAPI"
              value={chaveAPI}
              onChange={(e) => setChaveAPI(e.target.value)}
              placeholder="Ex: vk_live_abc123xyz789"
              data-testid="input-credential-chaveapi"
            />
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
