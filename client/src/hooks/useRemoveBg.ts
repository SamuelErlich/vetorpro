import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RemoveBgUsage, RemoveBgPlan } from "@shared/schema";

interface RemoveBgCreditsResponse {
  success: boolean;
  credits: number;
}

interface RemoveBgUsageResponse {
  success: boolean;
  data: RemoveBgUsage[];
}

interface RemoveBgPlansResponse {
  success: boolean;
  data: RemoveBgPlan[];
}

interface RemoveBgEstimateResponse {
  success: boolean;
  data: {
    resolutionMp: number;
    creditsNeeded: number;
  };
}

interface RemoveBgProcessResponse {
  success: boolean;
  data: {
    processedImagePath: string;
    originalImagePath: string;
    creditsUsed: number;
    resolutionMp: number;
  };
}

/**
 * Hook to fetch user's available RemoveBG credits
 */
export function useRemoveBgCredits(options?: { enabled?: boolean }) {
  return useQuery<RemoveBgCreditsResponse>({
    queryKey: ["/api/removebg/credits"],
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch user's RemoveBG usage history
 */
export function useRemoveBgUsage(options?: { enabled?: boolean }) {
  return useQuery<RemoveBgUsageResponse>({
    queryKey: ["/api/removebg/usage"],
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch available RemoveBG plans
 */
export function useRemoveBgPlans(options?: { enabled?: boolean }) {
  return useQuery<RemoveBgPlansResponse>({
    queryKey: ["/api/removebg/plans"],
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to estimate credits needed for an image
 */
export function useRemoveBgEstimate() {
  return useMutation<RemoveBgEstimateResponse, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("/api/removebg/estimate", {
        method: "POST",
        body: formData,
      });
      return response;
    },
  });
}

/**
 * Hook to process image and remove background
 */
export function useRemoveBgProcess() {
  return useMutation<RemoveBgProcessResponse, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("/api/removebg/process", {
        method: "POST",
        body: formData,
      });
      return response;
    },
  });
}