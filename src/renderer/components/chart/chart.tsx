import { mergeClasses } from "@/lib/classnames";

import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";

import { chartClasses } from "./classes";
import { ChartLoading } from "./components";

import type { ChartProps } from "./types";

export function Chart({ type, series, options, slotProps, className, sx, ...other }: ChartProps) {
  return (
    <ChartRoot
      dir="ltr"
      className={mergeClasses([chartClasses.root, className])}
      sx={sx}
      {...other}
    >
      <ChartLoading type={type} sx={slotProps?.loading} />
      <Box
        sx={{
          inset: 0,
          display: "flex",
          gap: 1,
          p: 2,
          position: "absolute",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <Box
            key={index}
            sx={(theme) => ({
              width: "100%",
              maxWidth: 28,
              borderRadius: 999,
              height: `${38 + ((index * 17) % 72)}%`,
              bgcolor: theme.palette.primary.main,
              opacity: 0.12 + index * 0.05,
            })}
          />
        ))}
      </Box>
    </ChartRoot>
  );
}

const ChartRoot = styled("div")(({ theme }) => ({
  width: "100%",
  flexShrink: 0,
  minHeight: 240,
  overflow: "hidden",
  position: "relative",
  borderRadius:
    typeof theme.shape.borderRadius === "number" ? theme.shape.borderRadius * 1.5 : theme.shape.borderRadius,
}));
