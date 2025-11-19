import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  Loader2, 
  Image as ImageIcon,
  FileImage,
  Info,
  Sparkles,
  ArrowRight,
  Check
} from "lucide-react";
import { useRemoveBgProcess, useRemoveBgEstimate } from "@/hooks/useRemoveBg";
import { queryClient } from "@/lib/queryClient";
import ImagePreview from "./ImagePreview";
import BeforeAfterSlider from "./BeforeAfterSlider";
import { cn } from "@/lib/utils";

interface RemoveBgUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCredits: number;
}

export default function RemoveBgUploadModal({
  open,
  onOpenChange,
  availableCredits,
}: RemoveBgUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [originalImagePath, setOriginalImagePath] = useState<string | null>(null);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  
  const { toast } = useToast();
  const processMutation = useRemoveBgProcess();
  const estimateMutation = useRemoveBgEstimate();

  // Simulate processing progress
  useEffect(() => {
    if (processMutation.isPending) {
      setProgressValue(0);
      const interval = setInterval(() => {
        setProgressValue((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      return () => clearInterval(interval);
    } else if (processedImage) {
      setProgressValue(100);
    }
  }, [processMutation.isPending, processedImage]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
      });
      return;
    }

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
      });
      return;
    }

    setFile(selectedFile);
    setProcessedImage(null);
    setOriginalImagePath(null);
    setProgressValue(0);
    
    // Format file size
    const size = selectedFile.size;
    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    let formattedSize = size;
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    setFileSize(`${formattedSize.toFixed(2)} ${units[unitIndex]}`);
    
    // Create preview using URL.createObjectURL for better performance
    const objectUrl = URL.createObjectURL(selectedFile);
    setOriginalPreview(objectUrl);

    // Estimate credits
    const formData = new FormData();
    formData.append("image", selectedFile);
    
    try {
      const estimate = await estimateMutation.mutateAsync(formData);
      if (estimate?.data) {
        setEstimatedCredits(estimate.data.creditsNeeded);
      }
    } catch (error: any) {
      console.error("Error estimating credits:", error);
      // Don't show error toast for estimation, just continue
    }
  }, [toast, estimateMutation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    // Check if user has enough credits
    if (estimatedCredits && estimatedCredits > availableCredits) {
      toast({
        variant: "destructive",
        title: "Créditos insuficientes",
        description: `Você precisa de ${estimatedCredits} créditos, mas tem apenas ${availableCredits}.`,
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      const result = await processMutation.mutateAsync(formData);
      
      if (result?.data) {
        // Display processed image
        setProcessedImage(result.data.processedImagePath);
        setOriginalImagePath(result.data.originalImagePath);
        setProgressValue(100);
        
        toast({
          title: "Sucesso!",
          description: `Fundo removido. ${result.data.creditsUsed} crédito(s) usado(s).`,
        });
        
        // Invalidate credits query to refresh the display
        queryClient.invalidateQueries({ queryKey: ["/api/removebg/credits"] });
        queryClient.invalidateQueries({ queryKey: ["/api/removebg/usage"] });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || "Erro ao processar imagem";
      toast({
        variant: "destructive",
        title: "Erro ao processar",
        description: errorMessage,
      });
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    
    const link = document.createElement("a");
    link.href = processedImage;
    link.download = `sem-fundo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    // Clean up object URL if exists
    if (originalPreview) {
      URL.revokeObjectURL(originalPreview);
    }
    setFile(null);
    setOriginalPreview(null);
    setProcessedImage(null);
    setOriginalImagePath(null);
    setEstimatedCredits(null);
    setFileSize(null);
    setProgressValue(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Remover Fundo da Imagem</DialogTitle>
            <div className="flex items-center gap-2">
              {availableCredits !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {availableCredits} créditos disponíveis
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById("file-input")?.click()}
              data-testid="dropzone-removebg"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-base font-medium mb-2">
                Arraste uma imagem aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                PNG, JPG, JPEG (máx. 10MB)
              </p>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInputChange}
                data-testid="input-file-removebg"
              />
            </div>
          )}

          {/* Preview Area */}
          {file && (
            <div className="space-y-4">
              {/* File Info Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileImage className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{fileSize}</span>
                        {estimatedCredits !== null && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {estimatedCredits} crédito{estimatedCredits !== 1 ? "s" : ""} necessário{estimatedCredits !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {estimatedCredits !== null && availableCredits < estimatedCredits && (
                      <Badge variant="destructive" className="text-xs">
                        Créditos insuficientes
                      </Badge>
                    )}
                    {estimatedCredits !== null && availableCredits >= estimatedCredits && !processedImage && (
                      <Badge variant="secondary" className="text-xs">
                        Pronto para processar
                      </Badge>
                    )}
                    {processedImage && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Processado
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>

              {/* Image Display */}
              {processedImage ? (
                // After processing - show comparison view
                <Tabs defaultValue="comparison" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comparison">Comparação</TabsTrigger>
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="processed">Sem Fundo</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="comparison" className="mt-4">
                    <BeforeAfterSlider
                      beforeImage={originalImagePath || originalPreview || ""}
                      afterImage={processedImage}
                      beforeLabel="Original"
                      afterLabel="Sem Fundo"
                      className="w-full"
                      aspectRatio="video"
                    />
                  </TabsContent>
                  
                  <TabsContent value="original" className="mt-4">
                    <ImagePreview
                      src={originalImagePath || originalPreview || ""}
                      alt="Original"
                      className="w-full"
                      aspectRatio="video"
                      showZoomControls
                    />
                  </TabsContent>
                  
                  <TabsContent value="processed" className="mt-4">
                    <div className="relative">
                      {/* Checkered background for transparency */}
                      <div className="absolute inset-0 rounded-lg overflow-hidden">
                        <div 
                          className="w-full h-full opacity-10"
                          style={{
                            backgroundImage: `repeating-conic-gradient(#666 0% 25%, transparent 0% 50%)`,
                            backgroundSize: '20px 20px',
                          }}
                        />
                      </div>
                      <ImagePreview
                        src={processedImage}
                        alt="Sem Fundo"
                        className="w-full relative"
                        aspectRatio="video"
                        showZoomControls
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                // Before processing - show original preview with processing state
                <div className="relative">
                  {originalPreview && (
                    <ImagePreview
                      src={originalPreview}
                      alt="Original"
                      className="w-full"
                      aspectRatio="video"
                      showZoomControls={!processMutation.isPending}
                    />
                  )}
                  
                  {/* Processing Overlay */}
                  {processMutation.isPending && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center animate-in fade-in-0 duration-200">
                      <Card className="p-6 text-center space-y-4 max-w-xs">
                        <div className="flex justify-center">
                          <div className="relative">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <div className="absolute inset-0 animate-ping">
                              <Sparkles className="h-12 w-12 text-primary/30" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium mb-1">Removendo fundo...</p>
                          <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
                        </div>
                        <Progress value={progressValue} className="w-full" />
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!processedImage ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFile(null);
                        setOriginalPreview(null);
                        setEstimatedCredits(null);
                      }}
                      data-testid="button-change-image"
                    >
                      Trocar Imagem
                    </Button>
                    <Button
                      onClick={handleProcess}
                      disabled={processMutation.isPending || (estimatedCredits ? estimatedCredits > availableCredits : false)}
                      className="flex-1"
                      data-testid="button-process-removebg"
                    >
                      {processMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Processar Imagem
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFile(null);
                        setOriginalPreview(null);
                        setProcessedImage(null);
                        setEstimatedCredits(null);
                      }}
                      data-testid="button-process-another"
                    >
                      Processar Outra
                    </Button>
                    <Button
                      onClick={handleDownload}
                      className="flex-1"
                      data-testid="button-download-processed"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Imagem
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}