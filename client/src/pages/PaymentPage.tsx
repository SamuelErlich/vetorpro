import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import PixPaymentCard from "@/components/PixPaymentCard";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pixData, setPixData] = useState<any>(null);

  const generatePixMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/payments/pix', {
        method: 'POST',
        body: JSON.stringify({ amount: 99.90 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data) => {
      setPixData(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar PIX",
        description: error.message,
        variant: "destructive",
      });
      setLocation('/dashboard');
    },
  });

  useEffect(() => {
    generatePixMutation.mutate();
  }, []);

  const handleReturn = () => {
    setLocation('/dashboard');
  };

  if (!pixData || generatePixMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl space-y-6">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-64 w-64 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <PixPaymentCard
      qrCode={pixData.qrCode}
      pixCode={pixData.pixCode}
      amount="99,90"
      onReturn={handleReturn}
    />
  );
}
