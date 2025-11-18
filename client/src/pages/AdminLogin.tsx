import { useLocation } from "wouter";
import LoginForm from "@/components/LoginForm";

export default function AdminLogin() {
  const [, setLocation] = useLocation();

  const handleLogin = (email: string, password: string) => {
    console.log('Admin login:', { email, password });
    // todo: remove mock functionality - authenticate with backend
    setLocation('/admin');
  };

  return (
    <LoginForm
      title="Login Admin"
      description="Acesso ao painel administrativo"
      onSubmit={handleLogin}
      showForgotPassword={false}
    />
  );
}
