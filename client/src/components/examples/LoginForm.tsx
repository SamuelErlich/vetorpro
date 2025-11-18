import LoginForm from '../LoginForm';

export default function LoginFormExample() {
  return (
    <LoginForm
      title="Login do Cliente"
      description="Acesse suas credenciais mensais"
      onSubmit={(email, password) => console.log('Login:', { email, password })}
      showForgotPassword={true}
    />
  );
}
