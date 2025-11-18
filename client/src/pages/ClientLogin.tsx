import { useLocation } from "wouter";
import LoginForm from "@/components/LoginForm";

export default function ClientLogin() {
  const [, setLocation] = useLocation();

  const handleLogin = (email: string, password: string) => {
    console.log('Client login:', { email, password });
    // todo: remove mock functionality - authenticate with backend
    setLocation('/dashboard');
  };

  return (
    <LoginForm
      title="Login do Cliente"
      description="Acesse suas credenciais mensais"
      onSubmit={handleLogin}
      showForgotPassword={true}
    />
  );
}
