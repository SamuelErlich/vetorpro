import PixPaymentCard from '../PixPaymentCard';

export default function PixPaymentCardExample() {
  return (
    <PixPaymentCard
      qrCode="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540599.905802BR5925NOME DO BENEFICIARIO6014CIDADE6304ABCD"
      pixCode="00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540599.905802BR5925NOME DO BENEFICIARIO6014CIDADE6304ABCD"
      amount="99,90"
      onReturn={() => console.log('Return to dashboard')}
    />
  );
}
