import { useAdminRemoveBgStats } from "@/hooks/useAdminRemoveBg";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { CreditCard, Users, Image, TrendingUp } from "lucide-react";

export default function AdminRemoveBgStats() {
  const { data: stats, isLoading } = useAdminRemoveBgStats();

  const formatChartDate = (date: string) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (isLoading) {
    return (
      <div className="grid gap-6">
        {/* Stats Cards Loading */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Charts Loading */}
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Não foi possível carregar as estatísticas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Credits Consumed */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Créditos Consumidos (Mês)
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-credits">
              {stats.totalCreditsConsumed}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Total Images Processed */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Imagens Processadas (Mês)
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-images">
              {stats.totalImagesProcessed}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Average Credits per User */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Média por Usuário
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-average-credits">
              {stats.averageCreditsPerUser}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Unique Users */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários Únicos (Mês)
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-unique-users">
              {stats.uniqueUsers}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Users Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Usuários</CardTitle>
            <CardDescription>
              Usuários que mais consumiram créditos este mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum uso registrado este mês
              </p>
            ) : (
              <div className="space-y-4">
                {stats.topUsers.map((user, index) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between"
                    data-testid={`top-user-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {user.userId.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{user.creditsUsed}</p>
                      <p className="text-xs text-muted-foreground">créditos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Uso Diário</CardTitle>
            <CardDescription>
              Créditos consumidos por dia neste mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.dailyUsage.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum uso registrado este mês
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={stats.dailyUsage.map(d => ({
                    ...d,
                    formattedDate: formatChartDate(d.date),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="formattedDate" 
                    tick={{ fontSize: 12 }}
                    interval={Math.ceil(stats.dailyUsage.length / 10)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => `${value} créditos`}
                    labelFormatter={(label: string) => `Data: ${label}`}
                  />
                  <Bar 
                    dataKey="credits" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}