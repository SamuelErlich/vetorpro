import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ImageOff } from "lucide-react";

export function FirstLoginModal() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Check if this is the user's first login
    const hasSeenRemoveBgModal = localStorage.getItem("hasSeenRemoveBgModal");
    const isFirstLogin = sessionStorage.getItem("isFirstLogin");
    
    // Show modal only if it's the first login and user hasn't seen it before
    if (isFirstLogin === "true" && !hasSeenRemoveBgModal) {
      setOpen(true);
      // Mark as seen immediately to prevent multiple triggers
      localStorage.setItem("hasSeenRemoveBgModal", "true");
      // Clear the first login flag
      sessionStorage.removeItem("isFirstLogin");
    }
  }, []);

  const handleViewNow = () => {
    setOpen(false);
    navigate("/removebg/plans");
  };

  const handleViewLater = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-first-login">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Novidade no VectorPro!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-primary/10 p-4">
                <ImageOff className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-foreground">
                  RemoveBG - Remover Fundo de Imagens
                </p>
                <p className="text-sm text-muted-foreground">
                  Remova fundos de imagens automaticamente com alta qualidade usando inteligência artificial.
                </p>
                <div className="flex flex-col gap-1 pt-2">
                  <p className="text-sm font-medium">✨ Resultados profissionais em segundos</p>
                  <p className="text-sm font-medium">🎯 Ideal para e-commerce e design</p>
                  <p className="text-sm font-medium">💳 Planos a partir de R$ 14,90</p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button 
            variant="default" 
            className="flex-1" 
            onClick={handleViewNow}
            data-testid="button-view-now"
          >
            Ver Agora
          </Button>
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={handleViewLater}
            data-testid="button-view-later"
          >
            Ver Depois
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}