import CredentialsCard from '../CredentialsCard';

export default function CredentialsCardExample() {
  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <CredentialsCard
        month="Janeiro 2025"
        credentials={[
          { label: "Usuário", value: "user@example.com" },
          { label: "Senha", value: "Senha@Segura123" },
          { label: "Chave API", value: "sk_live_51Abc123xyz789" }
        ]}
        isLocked={false}
      />
      
      <CredentialsCard
        month="Fevereiro 2025"
        credentials={[]}
        isLocked={true}
      />
    </div>
  );
}
