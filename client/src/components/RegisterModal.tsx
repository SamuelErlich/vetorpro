import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Sparkles, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RegisterModal({ open, onClose }: RegisterModalProps) {
  const [email, setEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const isSubmitting = useRef(false);

  const registerMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      setShowSuccess(true);
      
      // Fechar modal após 3 segundos
      setTimeout(() => {
        setShowSuccess(false);
        setEmail("");
        onClose();
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar",
        description: error.message || "Não foi possível criar sua conta",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent empty email submission
    if (!email.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent multiple submissions with ref guard
    if (isSubmitting.current) {
      return;
    }
    
    try {
      isSubmitting.current = true;
      await registerMutation.mutateAsync(email.trim());
    } catch (error) {
      // Error already handled by onError
    } finally {
      isSubmitting.current = false;
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEmail("");
      setShowSuccess(false);
      isSubmitting.current = false;
    }
  }, [open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay className="glassmorphism-overlay fixed inset-0" />
      <DialogContent 
        className="sm:max-w-md border-white/20 bg-card/95 backdrop-blur-xl shadow-2xl"
        data-testid="modal-register"
      >
        {!showSuccess ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-1.5 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  VectorPro
                </span>
              </div>
              <DialogTitle className="text-2xl font-semibold text-foreground">Criar Conta</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Digite seu email para criar uma conta no VectorPro
              </DialogDescription>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-background/50"
                    required
                    disabled={registerMutation.isPending}
                    data-testid="input-register-email"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={registerMutation.isPending}
                data-testid="button-register-submit"
              >
                {registerMutation.isPending ? "Registrando..." : "Registrar"}
              </Button>

              <button
                type="button"
                onClick={onClose}
                disabled={registerMutation.isPending}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                data-testid="button-back-to-login"
              >
                Voltar ao login
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 py-8 text-center">
            <div className="flex justify-center">
              <div className="bg-green-500/20 rounded-full p-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-foreground">
                Email Enviado!
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground max-w-sm mx-auto">
                Enviamos um link para criação de senha em seu email.
                Verifique sua caixa de entrada.
              </DialogDescription>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
