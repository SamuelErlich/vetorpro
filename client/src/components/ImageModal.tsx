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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
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

        <div className="p-6">
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

              <TabsContent value="comparison" className="mt-0">
                <BeforeAfterSlider
                  beforeImage={originalImage}
                  afterImage={processedImage}
                  beforeLabel="Original"
                  afterLabel="Sem Fundo"
                  className="w-full max-h-[60vh]"
                />
              </TabsContent>

              <TabsContent value="original" className="mt-0">
                <div className="space-y-4">
                  <ImagePreview
                    src={originalImage}
                    alt="Original"
                    className="w-full max-h-[60vh]"
                    showZoomControls
                  />
                  <Button
                    onClick={() => handleDownload("original")}
                    className="w-full"
                    data-testid="button-download-original-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Original
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="processed" className="mt-0">
                <div className="space-y-4">
                  <ImagePreview
                    src={processedImage}
                    alt="Processada"
                    className="w-full max-h-[60vh]"
                    showZoomControls
                  />
                  <Button
                    onClick={() => handleDownload("processed")}
                    className="w-full"
                    data-testid="button-download-processed-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Processada
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              {processedImage ? (
                <>
                  <ImagePreview
                    src={processedImage}
                    alt="Processada"
                    className="w-full max-h-[60vh]"
                    showZoomControls
                  />
                  <Button
                    onClick={() => handleDownload("processed")}
                    className="w-full"
                    data-testid="button-download-single"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Imagem
                  </Button>
                </>
              ) : originalImage ? (
                <>
                  <ImagePreview
                    src={originalImage}
                    alt="Original"
                    className="w-full max-h-[60vh]"
                    showZoomControls
                  />
                  <Button
                    onClick={() => handleDownload("original")}
                    className="w-full"
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