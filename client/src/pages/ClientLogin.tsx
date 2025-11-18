import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import LoginForm from "@/components/LoginForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check if already logged in
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (userData?.user && userData.user.isAdmin !== "true") {
      setLocation('/dashboard');
    }
  }, [userData, setLocation]);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Credenciais inválidas",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (email: string, password: string) => {
    loginMutation.mutate({ email, password });
  };

  return (
    <>
      <LoginForm
        title="Login do Cliente"
        description="Acesse suas credenciais mensais"
        onSubmit={handleLogin}
        showForgotPassword={true}
      />
      
      {/* WhatsApp Contact Button */}
      <Button
        size="lg"
        asChild
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all bg-[#25D366] hover:bg-[#20BA5A] text-white border-0"
        data-testid="button-whatsapp"
      >
        <a
          href="https://wa.me/5544936184613"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-whatsapp"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Contato via WhatsApp</span>
        </a>
      </Button>
    </>
  );
}
