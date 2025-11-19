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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, 
  Image, 
  Calendar, 
  Eye, 
  Sparkles, 
  FileImage, 
  Trash2,
  AlertCircle 
} from "lucide-react";
import { useRemoveBgUsage } from "@/hooks/useRemoveBg";
import ImageModal from "./ImageModal";
import type { RemoveBgUsage } from "@shared/schema";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const usage = usageData?.data || [];
  
  // Delete single image mutation
  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/removebg/usage/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Imagem excluída",
        description: "A imagem foi removida com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/removebg/usage"] });
      setDeleteAlertOpen(false);
      setItemToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a imagem. Tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("/api/removebg/usage/batch", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Imagens excluídas",
        description: `${data.deletedCount} imagens foram removidas com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/removebg/usage"] });
      setSelectedItems(new Set());
      setDeleteAlertOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir as imagens. Tente novamente.",
        variant: "destructive",
      });
    },
  });

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
  
  const toggleItemSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };
  
  const toggleSelectAll = () => {
    if (selectedItems.size === usage.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(usage.map((item) => item.id)));
    }
  };
  
  const handleDeleteSingle = (id: string) => {
    setItemToDelete(id);
    setIsBatchDelete(false);
    setDeleteAlertOpen(true);
  };
  
  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) return;
    setIsBatchDelete(true);
    setDeleteAlertOpen(true);
  };
  
  const confirmDelete = () => {
    if (isBatchDelete) {
      deleteBatchMutation.mutate(Array.from(selectedItems));
    } else if (itemToDelete) {
      deleteSingleMutation.mutate(itemToDelete);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl">Histórico de Uso - RemoveBG</DialogTitle>
                {usage.length > 0 && (
                  <Badge variant="secondary">
                    {usage.length} processamento{usage.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              
              {/* Selection controls */}
              {usage.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedItems.size === usage.length && usage.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.size > 0
                        ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? "s" : ""}`
                        : "Selecionar todos"}
                    </span>
                  </div>
                  
                  {selectedItems.size > 0 && (
                    <Button
                      onClick={handleDeleteSelected}
                      variant="destructive"
                      size="sm"
                      disabled={deleteBatchMutation.isPending}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir {selectedItems.size} selecionado{selectedItems.size !== 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
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
                      "hover:shadow-lg hover:scale-[1.02]",
                      selectedItems.has(item.id) && "ring-2 ring-primary"
                    )}
                    onClick={() => handleImageClick(item)}
                    data-testid={`card-history-item-${index}`}
                  >
                    {/* Checkbox Overlay */}
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border-2"
                        data-testid={`checkbox-item-${index}`}
                      />
                    </div>
                    
                    {/* Delete Button */}
                    <div className="absolute top-2 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingle(item.id);
                        }}
                        disabled={deleteSingleMutation.isPending}
                        data-testid={`button-delete-item-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
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
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Confirmar exclusão
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchDelete
                ? `Tem certeza de que deseja excluir ${selectedItems.size} imagem(ns) selecionada(s)? Esta ação não pode ser desfeita.`
                : "Tem certeza de que deseja excluir esta imagem? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteSingleMutation.isPending || deleteBatchMutation.isPending
                ? "Excluindo..."
                : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}