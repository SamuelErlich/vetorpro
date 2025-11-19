import { useState } from "react";
import { useAdminRemoveBgUsage } from "@/hooks/useAdminRemoveBg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, Image } from "lucide-react";

interface AdminRemoveBgUsageProps {
  userId?: string;
}

export default function AdminRemoveBgUsage({ userId }: AdminRemoveBgUsageProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;
  const offset = (currentPage - 1) * limit;

  const { data, isLoading } = useAdminRemoveBgUsage({
    userId,
    limit,
    offset,
  });

  const usage = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getImageName = (path: string | null) => {
    if (!path) return "N/A";
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  const handleDownload = (imagePath: string | null) => {
    if (!imagePath) return;
    
    const link = document.createElement("a");
    link.href = imagePath;
    link.download = getImageName(imagePath);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewImage = (imagePath: string | null) => {
    if (!imagePath) return;
    window.open(imagePath, "_blank");
  };

  const getCreditsColor = (credits: number) => {
    if (credits <= 1) return "text-green-600";
    if (credits <= 2) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {userId ? "Histórico de Uso do Usuário" : "Histórico de Uso Geral"}
          </CardTitle>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              Total: {total} registro(s)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>
            {usage.length === 0
              ? "Nenhum uso encontrado."
              : `Mostrando ${usage.length} de ${total} registros`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Imagem</TableHead>
              <TableHead className="text-center">Resolução (MP)</TableHead>
              <TableHead className="text-center">Créditos</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : usage.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              usage.map((item) => (
                <TableRow key={item.id} data-testid={`row-usage-${item.id}`}>
                  <TableCell className="text-sm">
                    {formatDate(item.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.userEmail}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-mono text-xs">
                      {getImageName(item.imagePath)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {item.resolutionMp} MP
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="secondary"
                      className={getCreditsColor(item.creditsUsed)}
                    >
                      {item.creditsUsed}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      {item.imagePath && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewImage(item.imagePath)}
                            data-testid={`button-view-${item.id}`}
                            title="Ver imagem"
                          >
                            <Image className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(item.imagePath)}
                            data-testid={`button-download-${item.id}`}
                            title="Baixar imagem"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}