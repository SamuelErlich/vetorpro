import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import LoginForm from "@/components/LoginForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

type AuthMeResponse = { user: UserType };

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check if already logged in
  const { data: userData } = useQuery<AuthMeResponse>({
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
      // Always redirect to client dashboard from client login
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
    <LoginForm
      title="Login do Cliente"
      description="Acesse suas credenciais mensais"
      onSubmit={handleLogin}
      showForgotPassword={true}
      showRegister={true}
      whatsappMessage="Preciso de acesso ao vectorizer"
    />
  );
}
