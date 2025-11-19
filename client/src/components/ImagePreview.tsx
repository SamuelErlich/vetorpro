import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  showZoomControls?: boolean;
  aspectRatio?: "square" | "video" | "portrait" | string;
}

export default function ImagePreview({
  src,
  alt = "Preview",
  className,
  onLoad,
  onError,
  showZoomControls = false,
  aspectRatio,
}: ImagePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setZoom(1);
    setRotation(0);
  }, [src]);

  const handleImageLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
    onError?.();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "square":
        return "aspect-square";
      case "video":
        return "aspect-video";
      case "portrait":
        return "aspect-[3/4]";
      default:
        return aspectRatio ? `aspect-[${aspectRatio}]` : "";
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/30",
        getAspectRatioClass(),
        className
      )}
    >
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando imagem...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2 p-4">
            <p className="text-sm font-medium text-destructive">
              Erro ao carregar imagem
            </p>
            <p className="text-xs text-muted-foreground">
              Verifique se o arquivo é válido
            </p>
          </div>
        </div>
      )}

      {/* Image */}
      {!error && (
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              "max-w-full max-h-full object-contain transition-all duration-300 ease-in-out",
              loading && "opacity-0",
              !loading && "opacity-100 animate-in fade-in-0 zoom-in-95 duration-300"
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}
            data-testid="image-preview"
          />
        </div>
      )}

      {/* Zoom Controls */}
      {showZoomControls && !loading && !error && (
        <div className="absolute bottom-2 right-2 flex gap-1 bg-background/95 backdrop-blur-sm rounded-md p-1 shadow-lg">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleRotate}
            data-testid="button-rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          {(zoom !== 1 || rotation !== 0) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleReset}
              data-testid="button-reset-transform"
            >
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}