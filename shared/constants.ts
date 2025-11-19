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
  { id: 'removebg-starter', name: 'Starter', credits: 50, price: 'R$ 19,00' },
  { id: 'removebg-professional', name: 'Professional', credits: 200, price: 'R$ 49,00' },
  { id: 'removebg-business', name: 'Business', credits: 500, price: 'R$ 99,00' },
] as const;
