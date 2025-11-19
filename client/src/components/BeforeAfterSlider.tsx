import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Grip } from "lucide-react";
import ImagePreview from "./ImagePreview";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "portrait" | string;
  initialPosition?: number;
}

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Original",
  afterLabel = "Processada",
  className,
  aspectRatio = "video",
  initialPosition = 50,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState({ before: false, after: false });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, percentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, percentage)));
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
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

  const allImagesLoaded = imagesLoaded.before && imagesLoaded.after;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/30 select-none cursor-col-resize",
        getAspectRatioClass(),
        className
      )}
      onClick={handleContainerClick}
      data-testid="before-after-slider"
    >
      {/* After Image (Background) */}
      <div className="absolute inset-0">
        <ImagePreview
          src={afterImage}
          alt={afterLabel}
          className="w-full h-full"
          onLoad={() => setImagesLoaded(prev => ({ ...prev, after: true }))}
        />
        {allImagesLoaded && (
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium animate-in fade-in-0 duration-300">
            {afterLabel}
          </div>
        )}
      </div>

      {/* Before Image (Foreground - clipped) */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
        }}
      >
        <ImagePreview
          src={beforeImage}
          alt={beforeLabel}
          className="w-full h-full"
          onLoad={() => setImagesLoaded(prev => ({ ...prev, before: true }))}
        />
        {allImagesLoaded && (
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium animate-in fade-in-0 duration-300">
            {beforeLabel}
          </div>
        )}
      </div>

      {/* Slider Handle */}
      {allImagesLoaded && (
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary animate-in fade-in-0 zoom-in-95 duration-300"
          style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
        >
          {/* Slider Button */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-primary rounded-full shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform hover:scale-110"
            onMouseDown={handleSliderMouseDown}
            onTouchStart={handleSliderTouchStart}
            data-testid="slider-handle"
          >
            <Grip className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Instructions (shown on hover) */}
      {allImagesLoaded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md text-xs text-muted-foreground opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          Arraste para comparar
        </div>
      )}
    </div>
  );
}