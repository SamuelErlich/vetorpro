import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentStatus: string;
  userEmail: string;
}

export default function EditStatusDialog({
  open,
  onOpenChange,
  userId,
  currentStatus,
  userEmail,
}: EditStatusDialogProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const { toast } = useToast();

  // Reset newStatus when dialog opens or currentStatus changes
  useEffect(() => {
    if (open) {
      setNewStatus(currentStatus);
    }
  }, [open, currentStatus]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Status atualizado com sucesso!" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (newStatus !== currentStatus) {
      updateStatusMutation.mutate(newStatus);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-status">
        <DialogHeader>
          <DialogTitle>Editar Status do Usuário</DialogTitle>
          <DialogDescription>
            Alterar o status de <strong>{userEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Novo Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status" data-testid="select-new-status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO" data-testid="new-status-option-ativo">ATIVO</SelectItem>
                <SelectItem value="INATIVO" data-testid="new-status-option-inativo">INATIVO</SelectItem>
                <SelectItem value="BLOQUEADO" data-testid="new-status-option-bloqueado">BLOQUEADO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-status"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateStatusMutation.isPending}
            data-testid="button-save-status"
          >
            {updateStatusMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
