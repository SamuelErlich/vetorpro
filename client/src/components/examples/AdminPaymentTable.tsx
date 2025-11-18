import AdminPaymentTable from '../AdminPaymentTable';

export default function AdminPaymentTableExample() {
  const mockPayments = [
    { id: "1", userEmail: "cliente1@example.com", date: "15/01/2025", amount: "99,90", status: "paid" as const, txid: "ABC123XYZ" },
    { id: "2", userEmail: "cliente2@example.com", date: "14/01/2025", amount: "99,90", status: "pending" as const },
    { id: "3", userEmail: "cliente3@example.com", date: "18/01/2025", amount: "99,90", status: "paid" as const, txid: "DEF456UVW" },
    { id: "4", userEmail: "cliente4@example.com", date: "10/01/2025", amount: "99,90", status: "failed" as const },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <AdminPaymentTable payments={mockPayments} />
    </div>
  );
}
