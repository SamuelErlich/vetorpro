// Service IDs
export const DEFAULT_SERVICE_ID = "vectorizer-001";
export const REMOVEBG_SERVICE_ID = "removebg-001";

// Service names
export const SERVICE_NAMES = {
  VECTORIZER: "Vectorizer",
  REMOVEBG: "RemoveBG",
} as const;

// Payment constants
export const MONTHLY_PAYMENT_AMOUNT = 17.50;
export const PAYMENT_DUE_DAY = 5;

// RemoveBG Plans
export const REMOVEBG_PLANS = [
  { id: 'removebg-start', name: 'Start', credits: 30, price: 'R$ 14,90' },
  { id: 'removebg-pro', name: 'Pro', credits: 120, price: 'R$ 34,90' },
  { id: 'removebg-studio', name: 'Studio', credits: 300, price: 'R$ 69,90' },
] as const;
