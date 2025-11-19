import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Image, 
  Upload, 
  History, 
  CreditCard, 
  Eye, 
  Download,
  Sparkles,
  Clock
} from "lucide-react";
import { useRemoveBgCredits, useRemoveBgUsage } from "@/hooks/useRemoveBg";
import RemoveBgUploadModal from "./RemoveBgUploadModal";
import RemoveBgHistory from "./RemoveBgHistory";
import BeforeAfterSlider from "./BeforeAfterSlider";
import ImagePreview from "./ImagePreview";
import ImageModal from "./ImageModal";
import type { UserService, RemoveBgUsage } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RemoveBgCardProps {
  userService: UserService | null;
  onSubscribe?: () => void;
}

export default function RemoveBgCard({ userService, onSubscribe }: RemoveBgCardProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<RemoveBgUsage | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  
  const isActive = userService?.status === "ATIVO";
  
  const { data: creditsData, isLoading: creditsLoading } = useRemoveBgCredits({
    enabled: isActive,
  });

  const { data: usageData, isLoading: usageLoading } = useRemoveBgUsage({
    enabled: isActive,
  });

  const credits = creditsData?.credits ?? 0;
  const usage = usageData?.data || [];
  const lastProcessed = usage.length > 0 ? usage[0] : null;

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

  const handleDownload = (imagePath: string, type: "original" | "processed") => {
    const link = document.createElement("a");
    link.href = imagePath;
    link.download = `${type === "original" ? "original" : "sem-fundo"}_${Date.now()}.${type === "original" ? "jpg" : "png"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Active service - show full UI
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">RemoveBG - Remover Fundo</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Ativo</Badge>
              {credits > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {credits} créditos
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="recent">Última Imagem</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
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
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>

              {/* Info about credit usage */}
              <Card className="p-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium mb-2">Consumo de Créditos:</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">1 crédito</Badge>
                    <span>Até 2MP (1920×1080)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">2 créditos</Badge>
                    <span>2-5MP (2560×1920)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">3 créditos</Badge>
                    <span>Acima de 5MP (4K+)</span>
                  </div>
                </div>
              </Card>

              {/* Stats */}
              {usage.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Total Processado</span>
                    </div>
                    <p className="text-lg font-semibold">{usage.length}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Última Atividade</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {lastProcessed ? new Date(lastProcessed.createdAt).toLocaleDateString("pt-BR") : "-"}
                    </p>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              {usageLoading ? (
                <div className="aspect-video rounded-lg bg-muted animate-pulse" />
              ) : lastProcessed ? (
                <div className="space-y-4">
                  {/* Last Processed Image Preview */}
                  <BeforeAfterSlider
                    beforeImage={lastProcessed.originalImagePath || ""}
                    afterImage={lastProcessed.imagePath || ""}
                    beforeLabel="Original"
                    afterLabel="Sem Fundo"
                    className="w-full"
                    aspectRatio="video"
                  />
                  
                  {/* Image Info */}
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Processado em</p>
                        <p className="text-sm font-medium">{formatDate(lastProcessed.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {lastProcessed.resolutionMp} MP
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {lastProcessed.creditsUsed} crédito{lastProcessed.creditsUsed !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>
                  </Card>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedImage(lastProcessed);
                        setImageModalOpen(true);
                      }}
                      data-testid="button-view-fullsize"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Ampliado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(lastProcessed.imagePath!, "processed")}
                      data-testid="button-download-recent"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-3">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">Nenhuma imagem processada</p>
                  <p className="text-xs text-muted-foreground">
                    Suas imagens processadas aparecerão aqui
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
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

      {/* Full-size Image Modal */}
      {selectedImage && (
        <ImageModal
          open={imageModalOpen}
          onOpenChange={setImageModalOpen}
          originalImage={selectedImage.originalImagePath}
          processedImage={selectedImage.imagePath}
          metadata={{
            date: formatDate(selectedImage.createdAt),
            creditsUsed: selectedImage.creditsUsed,
            resolution: selectedImage.resolutionMp,
          }}
          title="Visualizar Imagem"
          onDownload={(type) => {
            const path = type === "original" 
              ? selectedImage.originalImagePath 
              : selectedImage.imagePath;
            if (path) handleDownload(path, type);
          }}
        />
      )}
    </>
  );
}