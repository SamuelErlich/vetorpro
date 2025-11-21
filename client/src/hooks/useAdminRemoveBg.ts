import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RemoveBgUsage } from "@shared/schema";

interface RemoveBgUsageWithUser extends RemoveBgUsage {
  userEmail: string;
}

interface RemoveBgSubscription {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  creditsAvailable: number;
  creditsUsedThisMonth: number;
  totalCreditsUsed: number;
  lastPayment: Date | null;
  nextPayment: Date | null;
  createdAt: Date;
}

interface RemoveBgStats {
  totalCreditsConsumed: number;
  totalImagesProcessed: number;
  averageCreditsPerUser: number;
  uniqueUsers: number;
  topUsers: Array<{
    userId: string;
    email: string;
    creditsUsed: number;
  }>;
  dailyUsage: Array<{
    date: string;
    credits: number;
  }>;
}

interface UsageResponse {
  data: RemoveBgUsageWithUser[];
  total: number;
  limit: number;
  offset: number;
}

interface SubscriptionsResponse {
  data: RemoveBgSubscription[];
}

// Hook to fetch all RemoveBG usage
export function useAdminRemoveBgUsage(options?: {
  userId?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.userId) params.append("userId", options.userId);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  return useQuery<UsageResponse>({
    queryKey: ["/api/admin/removebg/usage", params.toString()],
    queryFn: async () => {
      const url = `/api/admin/removebg/usage${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao buscar uso do RemoveBG");
      return res.json();
    },
    enabled: options?.enabled !== false,
  });
}

// Hook to fetch all RemoveBG subscriptions
export function useAdminRemoveBgSubscriptions(options?: { enabled?: boolean }) {
  return useQuery<SubscriptionsResponse>({
    queryKey: ["/api/admin/removebg/subscriptions"],
    enabled: options?.enabled !== false,
  });
}

// Hook to adjust user credits
export function useAdminAdjustCredits() {
  return useMutation({
    mutationFn: async ({ userId, credits, reason }: { 
      userId: string; 
      credits: number; 
      reason?: string;
    }) => {
      const response = await apiRequest(`/api/admin/removebg/credits/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, reason }),
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg/usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removebg/stats"] });
      // Also invalidate user credits to refresh in client dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/removebg/credits"] });
    },
  });
}

// Hook to fetch RemoveBG statistics
export function useAdminRemoveBgStats(options?: { enabled?: boolean }) {
  return useQuery<RemoveBgStats>({
    queryKey: ["/api/admin/removebg/stats"],
    enabled: options?.enabled !== false,
  });
}