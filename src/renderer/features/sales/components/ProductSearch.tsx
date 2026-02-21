// src/renderer/features/sales/components/ProductSearch.tsx
import { useMemo, useRef } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";

import type { Product } from "../types";

export default function ProductSearch({
  value,
  onChange,
  products,
  onPick,
  onScan,
}: {
  value: string;
  onChange: (v: string) => void;
  products: Product[];
  onPick: (p: Product) => void;
  onScan: (barcode: string) => void;
}) {
  const scanRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q))
      .slice(0, 20);
  }, [value, products]);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label="Lector listo"
          variant="outlined"
          onClick={() => scanRef.current?.focus()}
        />
        <input
          ref={scanRef}
          style={{ position: "absolute", left: -9999, width: 1, height: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const barcode = (e.currentTarget.value ?? "").trim();
              if (barcode) onScan(barcode);
              e.currentTarget.value = "";
            }
          }}
        />
      </Stack>

      <Autocomplete
        options={options}
        getOptionLabel={(p) => p.name}
        onChange={(_, p) => {
          if (p) onPick(p);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Buscar producto"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Nombre o código…"
          />
        )}
      />
    </Stack>
  );
}