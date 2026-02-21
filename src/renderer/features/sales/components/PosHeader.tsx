// src/renderer/features/sales/components/PosHeader.tsx
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function PosHeader({ title }: { title: string }) {
  return (
    <Stack>
      <Typography variant="h6" fontWeight={800}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Escanea productos o búscalos por nombre.
      </Typography>
    </Stack>
  );
}