import PaymentCalendar from '../PaymentCalendar';

export default function PaymentCalendarExample() {
  const mockPayments = [
    { month: "Janeiro 2025", status: "paid" as const, date: "15/01/2025", amount: "99,90" },
    { month: "Dezembro 2024", status: "paid" as const, date: "15/12/2024", amount: "99,90" },
    { month: "Novembro 2024", status: "paid" as const, date: "18/11/2024", amount: "99,90" },
    { month: "Outubro 2024", status: "overdue" as const, amount: "99,90" },
    { month: "Setembro 2024", status: "pending" as const, amount: "99,90" },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <PaymentCalendar payments={mockPayments} />
    </div>
  );
}
