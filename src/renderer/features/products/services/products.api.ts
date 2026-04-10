export type CategoryOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type SubcategoryOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type SubcategoryMap = Record<string, SubcategoryOption[]>;

function roundMoney(value: number) {
  return Math.round(value);
}

export function calculateSalePrice(cost: number, marginPercent = 0, hasTax = false, taxRate = 0) {
  const basePrice = Number(cost || 0) * (1 + Number(marginPercent || 0) / 100);
  const total = hasTax ? basePrice * (1 + Number(taxRate || 0)) : basePrice;
  return roundMoney(total);
}

export function calculateMarginFromPrice(cost: number, salePrice: number, hasTax = false, taxRate = 0) {
  const normalizedCost = Number(cost || 0);
  const normalizedSalePrice = Number(salePrice || 0);

  if (normalizedCost <= 0 || normalizedSalePrice <= 0) {
    return 0;
  }

  const baseWithoutTax =
    hasTax && Number(taxRate || 0) > 0
      ? normalizedSalePrice / (1 + Number(taxRate || 0))
      : normalizedSalePrice;

  return Number((((baseWithoutTax - normalizedCost) / normalizedCost) * 100).toFixed(2));
}
