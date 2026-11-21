import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { apiClient } from "../api/client";

export interface NewExpenseInput {
  amount: number;
  category: string;
  paymentMode: string;
  merchant?: string;
  notes?: string;
  spentAt: string; // YYYY-MM-DD
}

export function useCreateExpense(month: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewExpenseInput) => {
      const idempotencyKey = Crypto.randomUUID();
      const { data } = await apiClient.post("/expenses", {
        ...input,
        idempotencyKey,
      });
      return data;
    },
    retry: 3, // Automatically retries on transient network drops
    onSuccess: () => {
      // Immediately refresh charts and recent list
      queryClient.invalidateQueries({ queryKey: ["analytics", month] });
      queryClient.invalidateQueries({ queryKey: ["expenses", month] });
    },
  });
}
