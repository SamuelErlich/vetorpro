import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Maximize2, X, Info } from "lucide-react";
import ImagePreview from "./ImagePreview";
import BeforeAfterSlider from "./BeforeAfterSlider";
import { cn } from "@/lib/utils";

interface ImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalImage?: string | null;
  processedImage?: string | null;
  metadata?: {
    date?: string;
    creditsUsed?: number;
    resolution?: string;
    fileName?: string;
  };
  title?: string;
  showComparison?: boolean;
  onDownload?: (type: "original" | "processed") => void;
}

export default function ImageModal({
  open,
  onOpenChange,
  originalImage,
  processedImage,
  metadata,
  title = "Visualizar Imagem",
  showComparison = true,
  onDownload,
}: ImageModalProps) {
  const hasBothImages = originalImage && processedImage;
  const defaultTab = hasBothImages && showComparison ? "comparison" : processedImage ? "processed" : "original";

  const handleDownload = (type: "original" | "processed") => {
    if (onDownload) {
      onDownload(type);
    } else {
      // Default download behavior
      const link = document.createElement("a");
      link.href = (type === "original" ? originalImage : processedImage) || "";
      link.download = `${type === "original" ? "original" : "processada"}_${Date.now()}.${type === "original" ? "jpg" : "png"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Metadata */}
          {metadata && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {metadata.fileName && (
                <Badge variant="outline" className="text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  {metadata.fileName}
                </Badge>
              )}
              {metadata.date && (
                <Badge variant="secondary" className="text-xs">
                  {metadata.date}
                </Badge>
              )}
              {metadata.resolution && (
                <Badge variant="secondary" className="text-xs">
                  {metadata.resolution} MP
                </Badge>
              )}
              {metadata.creditsUsed !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {metadata.creditsUsed} crédito(s)
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
          {hasBothImages && showComparison ? (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="comparison" data-testid="tab-comparison">
                  Comparação
                </TabsTrigger>
                <TabsTrigger value="original" data-testid="tab-original">
                  Original
                </TabsTrigger>
                <TabsTrigger value="processed" data-testid="tab-processed">
                  Processada
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comparison" className="mt-0 flex flex-col">
                <div className="flex-1 min-h-0 mb-4">
                  <BeforeAfterSlider
                    beforeImage={originalImage}
                    afterImage={processedImage}
                    beforeLabel="Original"
                    afterLabel="Sem Fundo"
                    className="w-full h-full max-h-[50vh]"
                  />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => handleDownload("original")}
                    className="flex-1"
                    variant="outline"
                    data-testid="button-download-original-comp"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Original
                  </Button>
                  <Button
                    onClick={() => handleDownload("processed")}
                    className="flex-1"
                    data-testid="button-download-processed-comp"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Sem Fundo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="original" className="mt-0 flex flex-col">
                <div className="flex-1 min-h-0 mb-4">
                  <ImagePreview
                    src={originalImage}
                    alt="Original"
                    className="w-full h-full max-h-[50vh]"
                    showZoomControls
                  />
                </div>
                <Button
                  onClick={() => handleDownload("original")}
                  className="w-full flex-shrink-0"
                  data-testid="button-download-original-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Original
                </Button>
              </TabsContent>

              <TabsContent value="processed" className="mt-0 flex flex-col">
                <div className="flex-1 min-h-0 mb-4">
                  <ImagePreview
                    src={processedImage}
                    alt="Processada"
                    className="w-full h-full max-h-[50vh]"
                    showZoomControls
                  />
                </div>
                <Button
                  onClick={() => handleDownload("processed")}
                  className="w-full flex-shrink-0"
                  data-testid="button-download-processed-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Sem Fundo
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col h-full">
              {processedImage ? (
                <>
                  <div className="flex-1 min-h-0 mb-4">
                    <ImagePreview
                      src={processedImage}
                      alt="Processada"
                      className="w-full h-full max-h-[50vh]"
                      showZoomControls
                    />
                  </div>
                  <Button
                    onClick={() => handleDownload("processed")}
                    className="w-full flex-shrink-0"
                    data-testid="button-download-single"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Imagem
                  </Button>
                </>
              ) : originalImage ? (
                <>
                  <div className="flex-1 min-h-0 mb-4">
                    <ImagePreview
                      src={originalImage}
                      alt="Original"
                      className="w-full h-full max-h-[50vh]"
                      showZoomControls
                    />
                  </div>
                  <Button
                    onClick={() => handleDownload("original")}
                    className="w-full flex-shrink-0"
                    data-testid="button-download-single"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Imagem
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Nenhuma imagem disponível</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}