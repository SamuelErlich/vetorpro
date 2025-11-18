import PaymentStatusBanner from '../PaymentStatusBanner';

export default function PaymentStatusBannerExample() {
  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <PaymentStatusBanner
        status="ATIVO"
        lastPayment="15/01/2025"
        nextDue="15/02/2025"
        onPayClick={() => console.log('Pay clicked')}
      />
      
      <PaymentStatusBanner
        status="INATIVO"
        lastPayment="15/12/2024"
        nextDue="15/01/2025"
        onPayClick={() => console.log('Pay clicked')}
      />
    </div>
  );
}
