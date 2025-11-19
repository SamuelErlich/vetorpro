import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Image, Upload, History, CreditCard } from "lucide-react";
import { useRemoveBgCredits } from "@/hooks/useRemoveBg";
import RemoveBgUploadModal from "./RemoveBgUploadModal";
import RemoveBgHistory from "./RemoveBgHistory";
import type { UserService } from "@shared/schema";

interface RemoveBgCardProps {
  userService: UserService | null;
  onSubscribe?: () => void;
}

export default function RemoveBgCard({ userService, onSubscribe }: RemoveBgCardProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  
  const isActive = userService?.status === "ATIVO";
  
  const { data: creditsData, isLoading: creditsLoading } = useRemoveBgCredits({
    enabled: isActive,
  });

  const credits = creditsData?.credits ?? 0;

  if (!userService) {
    // User doesn't have RemoveBG service - show subscription prompt
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">RemoveBG - Remover Fundo</CardTitle>
            <Badge variant="secondary">Não Assinado</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Image className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Serviço não ativado</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Remova o fundo de suas imagens com inteligência artificial.
                Asine agora para começar a usar!
              </p>
            </div>
            <Button onClick={onSubscribe} data-testid="button-subscribe-removebg">
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar RemoveBG
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isActive) {
    // User has service but it's not active
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">RemoveBG - Remover Fundo</CardTitle>
            <Badge variant="destructive">Inativo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Image className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Serviço Inativo</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Seu serviço RemoveBG está inativo. Entre em contato com o suporte
                ou aguarde a ativação do pagamento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active service - show full UI
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">RemoveBG - Remover Fundo</CardTitle>
            <Badge variant="secondary">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Credits Display */}
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">Créditos Disponíveis</p>
                {creditsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-removebg-credits">{credits}</p>
                )}
              </div>
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>

            {/* Info about credit usage */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Até 2MP: 1 crédito</p>
              <p>• 2-5MP: 2 créditos</p>
              <p>• Acima de 5MP: 3 créditos</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                onClick={() => setUploadModalOpen(true)}
                disabled={credits === 0}
                data-testid="button-removebg-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                {credits === 0 ? "Sem Créditos" : "Remover Fundo"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setHistoryModalOpen(true)}
                data-testid="button-removebg-history"
              >
                <History className="h-4 w-4 mr-2" />
                Histórico
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <RemoveBgUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        availableCredits={credits}
      />
      
      <RemoveBgHistory
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </>
  );
}