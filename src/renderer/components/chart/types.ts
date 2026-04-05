import type { Theme, SxProps } from "@mui/material/styles";

export type ChartType =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "radialBar"
  | "polarArea"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "radar";

export type ChartSeries = unknown;
export type ChartOptions = Record<string, unknown>;

export type ChartProps = React.ComponentProps<"div"> & {
  type?: ChartType;
  series?: ChartSeries;
  options?: ChartOptions;
  sx?: SxProps<Theme>;
  slotProps?: {
    loading?: SxProps<Theme>;
  };
};
