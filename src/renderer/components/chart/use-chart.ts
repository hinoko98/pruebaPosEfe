import type { ChartOptions } from "./types";

export function useChart(updatedOptions?: ChartOptions): ChartOptions {
  return updatedOptions ?? {};
}
