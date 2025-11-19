import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, CreditCard, Image } from "lucide-react";
import { REMOVEBG_PLANS } from "@shared/constants";

export default function RemoveBgPlans() {
  const [, setLocation] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: userService } = useQuery({
    queryKey: ['/api/user-services'],
    select: (services: any[]) => services?.find(s => s.serviceId === "removebg-001"),
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    // Find the plan details
    const plan = REMOVEBG_PLANS.find(p => p.id === planId);
    if (plan) {
      // Navigate to payment page with plan information
      const amount = plan.price.replace('R$ ', '').replace(',', '.');
      setLocation(`/payment?service=removebg-001&plan=${planId}&amount=${amount}`);
    }
  };

  const handleReturn = () => {
    setLocation('/dashboard');
  };

  // If user already has an active subscription, redirect to dashboard
  if (userService?.status === "ATIVO") {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button 
            variant="ghost" 
            onClick={handleReturn}
            className="mr-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-xl font-semibold">Escolha seu Plano RemoveBG</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Remova o fundo de suas imagens</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Utilize inteligência artificial avançada para remover fundos de imagens automaticamente.
            Escolha o plano ideal para suas necessidades.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {REMOVEBG_PLANS.map((plan) => {
            const isPopular = plan.id === 'removebg-pro';
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isPopular ? 'border-primary ring-2 ring-primary' : ''}`}
                data-testid={`card-plan-${plan.id}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="font-semibold">{plan.credits} créditos por mês</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>Alta qualidade de recorte</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>Processamento rápido</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>Download em alta resolução</span>
                    </div>
                    {plan.id === 'removebg-studio' && (
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Suporte prioritário</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Aproximadamente {(plan.credits / 30).toFixed(1)} imagens por dia</p>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    variant={isPopular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                    data-testid={`button-select-${plan.id}`}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Escolher {plan.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Como funciona?</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Escolha o plano ideal para suas necessidades</li>
              <li>2. Realize o pagamento via PIX (aprovação instantânea)</li>
              <li>3. Seus créditos são liberados imediatamente</li>
              <li>4. Use os créditos para remover fundos de suas imagens</li>
              <li>5. Renovação automática todo dia 5 de cada mês</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}