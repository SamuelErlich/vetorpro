import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Download, 
  ImageOff, 
  AlertCircle, 
  ChevronLeft,
  Sparkles,
  CheckCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserService } from "@shared/schema";

export default function RemoveBgPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get user services
  const { data: userServicesData } = useQuery<UserService[]>({
    queryKey: ['/api/user-services'],
  });

  const userServices = userServicesData || [];
  const removeBgService = userServices.find(
    service => service.serviceId === "removebg-001"
  );

  const creditsAvailable = removeBgService?.creditsAvailable || 0;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione uma imagem",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo é 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setResultUrl(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Nenhum arquivo selecionado");

      const formData = new FormData();
      formData.append('image', selectedFile);

      setIsProcessing(true);
      const response = await apiRequest('/api/removebg/process', {
        method: 'POST',
        body: formData,
      });

      return response;
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data.processedImagePath) {
        setResultUrl(`/${data.processedImagePath}`);
        toast({
          title: "Sucesso!",
          description: "Fundo removido com sucesso",
        });
        // Invalidate queries to update credits
        queryClient.invalidateQueries({ queryKey: ['/api/user-services'] });
        queryClient.invalidateQueries({ queryKey: ['/api/removebg/usage'] });
      }
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        title: "Erro ao processar",
        description: error.message || "Não foi possível remover o fundo",
        variant: "destructive",
      });
    },
  });

  const handleProcess = () => {
    if (creditsAvailable <= 0) {
      toast({
        title: "Sem créditos",
        description: "Você não tem créditos disponíveis",
        variant: "destructive",
      });
      return;
    }

    processImageMutation.mutate();
  };

  if (!removeBgService || removeBgService.status !== "ATIVO") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">Serviço não disponível</p>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Você precisa ter o RemoveBG ativo para usar esta funcionalidade
            </p>
            <Button asChild>
              <Link href="/removebg/plans">
                Ver Planos
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/services/removebg">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <ImageOff className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">RemoveBG</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {creditsAvailable} créditos disponíveis
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Imagem Original</CardTitle>
              <CardDescription>
                Selecione uma imagem para remover o fundo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <div className="border-2 border-dashed rounded-lg p-8">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium mb-2">
                        Clique para selecionar uma imagem
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG ou WEBP até 10MB
                      </p>
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setResultUrl(null);
                      }}
                    >
                      Trocar Imagem
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleProcess}
                      disabled={isProcessing || creditsAvailable <= 0}
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Remover Fundo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result Section */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                Imagem com fundo removido
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-12 w-12 mb-4 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Removendo fundo...</p>
                  <Progress value={50} className="w-full mt-4" />
                </div>
              ) : resultUrl ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-checkerboard">
                    <img
                      src={resultUrl}
                      alt="Result"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" asChild>
                      <a href={resultUrl} download="removed-bg.png">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar PNG
                      </a>
                    </Button>
                    <Badge variant="outline" className="px-3">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                      Processado com sucesso
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    O resultado aparecerá aqui após o processamento
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cada imagem processada consome 1 crédito. A resolução máxima depende do seu plano.
            Você tem {creditsAvailable} créditos disponíveis.
          </AlertDescription>
        </Alert>
      </main>

      <style jsx>{`
        .bg-checkerboard {
          background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
            linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
            linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </div>
  );
}