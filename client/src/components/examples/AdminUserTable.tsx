import AdminUserTable from '../AdminUserTable';

export default function AdminUserTableExample() {
  const mockUsers = [
    { id: "1", email: "cliente1@example.com", status: "ATIVO" as const, lastPayment: "15/01/2025" },
    { id: "2", email: "cliente2@example.com", status: "INATIVO" as const, lastPayment: "15/12/2024" },
    { id: "3", email: "cliente3@example.com", status: "ATIVO" as const, lastPayment: "18/01/2025" },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <AdminUserTable
        users={mockUsers}
        onAdd={() => console.log('Add user')}
        onEdit={(id) => console.log('Edit user:', id)}
        onDelete={(id) => console.log('Delete user:', id)}
      />
    </div>
  );
}
