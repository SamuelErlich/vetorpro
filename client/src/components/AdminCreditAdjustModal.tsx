import { useState } from "react";
import { useAdminAdjustCredits } from "@/hooks/useAdminRemoveBg";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard } from "lucide-react";

interface AdminCreditAdjustModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  currentCredits: number;
}

export default function AdminCreditAdjustModal({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentCredits,
}: AdminCreditAdjustModalProps) {
  const [credits, setCredits] = useState(currentCredits.toString());
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  
  const adjustCreditsMutation = useAdminAdjustCredits();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const creditValue = parseInt(credits);
    if (isNaN(creditValue) || creditValue < 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, insira um valor válido para os créditos",
      });
      return;
    }

    try {
      await adjustCreditsMutation.mutateAsync({
        userId,
        credits: creditValue,
        reason: reason.trim() || undefined,
      });

      toast({
        title: "Créditos Ajustados",
        description: `Créditos do usuário ${userEmail} foram ajustados para ${creditValue}`,
      });

      onOpenChange(false);
      // Reset form
      setCredits(currentCredits.toString());
      setReason("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao Ajustar Créditos",
        description: error.message || "Não foi possível ajustar os créditos",
      });
    }
  };

  const handleCancel = () => {
    setCredits(currentCredits.toString());
    setReason("");
    onOpenChange(false);
  };

  const creditDifference = parseInt(credits) - currentCredits;
  const isValidCredit = !isNaN(parseInt(credits)) && parseInt(credits) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ajustar Créditos RemoveBG
          </DialogTitle>
          <DialogDescription>
            Ajuste os créditos disponíveis para o usuário {userEmail}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Credits Display */}
          <div className="bg-muted rounded-md p-3">
            <div className="text-sm text-muted-foreground">Créditos Atuais</div>
            <div className="text-2xl font-bold">{currentCredits}</div>
          </div>

          {/* New Credits Input */}
          <div className="space-y-2">
            <Label htmlFor="credits">Novos Créditos</Label>
            <Input
              id="credits"
              type="number"
              min="0"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="Digite o novo valor de créditos"
              data-testid="input-new-credits"
            />
            {isValidCredit && creditDifference !== 0 && (
              <p className="text-sm text-muted-foreground">
                {creditDifference > 0 ? (
                  <span className="text-green-600">
                    +{creditDifference} créditos serão adicionados
                  </span>
                ) : (
                  <span className="text-red-600">
                    {Math.abs(creditDifference)} créditos serão removidos
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Ajuste (Opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Compensação por problema técnico, teste manual, etc."
              rows={3}
              data-testid="input-reason"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={adjustCreditsMutation.isPending}
              data-testid="button-cancel-adjust"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValidCredit || creditDifference === 0 || adjustCreditsMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              {adjustCreditsMutation.isPending ? "Ajustando..." : "Confirmar Ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}