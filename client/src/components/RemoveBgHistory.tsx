import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Image, Calendar, Eye, Sparkles, FileImage } from "lucide-react";
import { useRemoveBgUsage } from "@/hooks/useRemoveBg";
import ImageModal from "./ImageModal";
import type { RemoveBgUsage } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RemoveBgHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoveBgHistory({ open, onOpenChange }: RemoveBgHistoryProps) {
  const { data: usageData, isLoading } = useRemoveBgUsage({
    enabled: open,
  });
  const [selectedImage, setSelectedImage] = useState<RemoveBgUsage | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const usage = usageData?.data || [];

  useEffect(() => {
    // Setup Intersection Observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !loadedImages.has(src)) {
              img.src = src;
              setLoadedImages((prev) => new Set(prev).add(src));
            }
          }
        });
      },
      { rootMargin: "50px" }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadedImages]);

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

  const formatShortDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  const getImageName = (path: string) => {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];
    // Extract timestamp from filename for display
    const match = filename.match(/_(\d+)\./);
    if (match) {
      const timestamp = parseInt(match[1]);
      const date = new Date(timestamp);
      return `Imagem_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
    }
    return filename;
  };

  const handleImageClick = (item: RemoveBgUsage) => {
    setSelectedImage(item);
    setImageModalOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Histórico de Uso - RemoveBG</DialogTitle>
              {usage.length > 0 && (
                <Badge variant="secondary">
                  {usage.length} processamento{usage.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            {isLoading ? (
              // Loading skeleton grid
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <CardContent className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : usage.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-20">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <FileImage className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum processamento ainda</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Suas imagens processadas aparecerão aqui. Comece removendo o fundo de uma imagem!
                </p>
              </div>
            ) : (
              // Gallery grid
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {usage.map((item: RemoveBgUsage, index: number) => (
                  <Card
                    key={item.id}
                    className={cn(
                      "group overflow-hidden cursor-pointer transition-all duration-200",
                      "hover:shadow-lg hover:scale-[1.02]"
                    )}
                    onClick={() => handleImageClick(item)}
                    data-testid={`card-history-item-${index}`}
                  >
                    {/* Image Thumbnail */}
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      {/* Background checkerboard pattern for transparent images */}
                      <div 
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage: `repeating-conic-gradient(#666 0% 25%, transparent 0% 50%)`,
                          backgroundSize: '20px 20px',
                        }}
                      />
                      
                      {/* Processed Image Thumbnail */}
                      {item.imagePath && (
                        <img
                          data-src={item.imagePath}
                          alt="Processada"
                          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0"
                          loading="lazy"
                          onLoad={(e) => {
                            e.currentTarget.classList.remove("opacity-0");
                          }}
                          ref={(img) => {
                            if (img && observerRef.current) {
                              observerRef.current.observe(img);
                            }
                          }}
                        />
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageClick(item);
                            }}
                            data-testid={`button-view-${index}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {item.imagePath && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item.imagePath!, "processed");
                              }}
                              data-testid={`button-quick-download-${index}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Credits Badge */}
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 right-2 text-xs opacity-90"
                      >
                        {item.creditsUsed} crédito{item.creditsUsed !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Card Info */}
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate">
                          {getImageName(item.imagePath || "")}
                        </p>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {parseFloat(item.resolutionMp).toFixed(1)} MP
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatShortDate(item.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
            fileName: getImageName(selectedImage.imagePath || ""),
          }}
          title="Detalhes do Processamento"
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