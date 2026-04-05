import type { ScrollbarProps } from './types';
import Box from "@mui/material/Box";

export function Scrollbar({
  sx,
  children,
  className,
  fillContent = true,
  ...other
}: ScrollbarProps) {
  return (
    <Box
      className={className}
      sx={[
        {
          minWidth: 0,
          minHeight: 0,
          flexGrow: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          ...(fillContent && {
            "& > *": {
              minHeight: "100%",
            },
          }),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...other}
    >
      {children}
    </Box>
  );
}
