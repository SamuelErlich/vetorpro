import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { useRemoveBgProcess, useRemoveBgEstimate } from "@/hooks/useRemoveBg";
import { queryClient } from "@/lib/queryClient";

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
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const { toast } = useToast();
  const processMutation = useRemoveBgProcess();
  const estimateMutation = useRemoveBgEstimate();

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
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);

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
    setFile(null);
    setOriginalPreview(null);
    setProcessedImage(null);
    setEstimatedCredits(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Remover Fundo da Imagem</DialogTitle>
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
              {/* File Info */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                {estimatedCredits !== null && (
                  <Badge variant="secondary">
                    {estimatedCredits} crédito(s) necessário(s)
                  </Badge>
                )}
              </div>

              {/* Images */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Original</p>
                  {originalPreview && (
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={originalPreview}
                        alt="Original"
                        className="w-full h-auto"
                        data-testid="preview-original"
                      />
                    </div>
                  )}
                </div>

                {/* Processed */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sem Fundo</p>
                  <div className="border rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center bg-muted/20">
                    {processMutation.isPending && (
                      <div className="text-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">Processando...</p>
                        <Progress value={50} className="w-32" />
                      </div>
                    )}
                    {processedImage && (
                      <img
                        src={processedImage}
                        alt="Processada"
                        className="w-full h-auto"
                        data-testid="preview-processed"
                      />
                    )}
                    {!processMutation.isPending && !processedImage && (
                      <p className="text-sm text-muted-foreground">
                        Clique em processar para remover o fundo
                      </p>
                    )}
                  </div>
                </div>
              </div>

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