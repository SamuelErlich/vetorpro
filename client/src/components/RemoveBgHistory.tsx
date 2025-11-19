import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Image } from "lucide-react";
import { useRemoveBgUsage } from "@/hooks/useRemoveBg";
import type { RemoveBgUsage } from "@shared/schema";

interface RemoveBgHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoveBgHistory({ open, onOpenChange }: RemoveBgHistoryProps) {
  const { data: usageData, isLoading } = useRemoveBgUsage({
    enabled: open,
  });

  const usage = usageData?.data || [];

  const handleDownload = (imagePath: string, index: number) => {
    const link = document.createElement("a");
    link.href = imagePath;
    link.download = `processada-${index + 1}.png`;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico de Uso - RemoveBG</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Table>
            <TableCaption>
              {usage.length === 0
                ? "Nenhum processamento realizado ainda."
                : `Total de ${usage.length} processamento(s)`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Imagem</TableHead>
                <TableHead className="text-right">Resolução (MP)</TableHead>
                <TableHead className="text-right">Créditos Usados</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-8 w-20 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : usage.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Image className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Nenhum processamento realizado ainda
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                usage.map((item: RemoveBgUsage, index: number) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{getImageName(item.imagePath || "")}</TableCell>
                    <TableCell className="text-right">
                      {parseFloat(item.resolutionMp).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{item.creditsUsed}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        {item.originalImagePath && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(item.originalImagePath || "", "_blank")}
                            data-testid={`button-view-original-${index}`}
                          >
                            Original
                          </Button>
                        )}
                        {item.imagePath && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(item.imagePath!, index)}
                            data-testid={`button-download-${index}`}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}