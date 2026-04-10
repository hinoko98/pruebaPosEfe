export const allIconNames = [
  "mingcute:add-line",
  "eva:search-fill",
  "solar:trash-bin-trash-bold",
  "ic:round-filter-list",
  "solar:check-circle-bold",
  "eva:more-vertical-fill",
  "solar:pen-bold",
] as const;

export type IconifyName = (typeof allIconNames)[number];

export function registerIcons() {
  return;
}
