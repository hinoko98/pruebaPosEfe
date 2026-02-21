// src/renderer/features/sales/views/PosView.tsx
import { useMemo, useState } from "react";
import Grid from '@mui/material/Grid';
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

import type { CartItem, Product, Payment } from "../types";
import PosHeader from "@/features/sales/components/PosHeader";
import ProductSearch from "@/features/sales//components/ProductSearch";
import CartTable from "@/features/sales//components/CartTable";
import TotalsCard from "@/features/sales//components/TotalsCard";
import PaymentPanel from "@/features/sales//components/PaymentPanel";

const mockProducts: Product[] = [
  { id: "p1", barcode: "7701234567890", name: "Galletas", price: 2500, taxRate: 0.19 },
  { id: "p2", barcode: "7700000000001", name: "Coca-Cola 400ml", price: 3500, taxRate: 0.19 },
  { id: "p3", barcode: "7700000000002", name: "Arroz 1kg", price: 5200, taxRate: 0.0 },
];

function money(n: number) {
  return Math.round(n);
}

export default function PosView() {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([{ method: "CASH", amount: 0 }]);

  const addProductToCart = (p: Product, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [
        ...prev,
        {
          lineId: crypto.randomUUID(),
          productId: p.id,
          name: p.name,
          price: p.price,
          qty,
          taxRate: p.taxRate ?? 0,
        },
      ];
    });
  };

  const updateQty = (lineId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.lineId === lineId ? { ...i, qty: Math.max(1, qty) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeLine = (lineId: string) => setCart((prev) => prev.filter((i) => i.lineId !== lineId));

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const tax = cart.reduce((acc, i) => acc + i.price * i.qty * (i.taxRate ?? 0), 0);
    const total = subtotal + tax;
    const paid = payments.reduce((acc, p) => acc + p.amount, 0);
    const due = total - paid;
    return {
      subtotal: money(subtotal),
      tax: money(tax),
      total: money(total),
      paid: money(paid),
      due: money(due),
    };
  }, [cart, payments]);

  const onScanBarcode = (barcode: string) => {
    const p = mockProducts.find((x) => x.barcode === barcode);
    if (p) addProductToCart(p, 1);
    // si no existe: luego mostrar modal “producto no encontrado”
  };

  const finalizeSale = async () => {
    // aquí después llamas a IPC: window.api.sales.create(...)
    // y haces transacción: venta + items + pagos + movimiento inventario + caja
    console.log("VENTA", { cart, payments, totals });
    setCart([]);
    setPayments([{ method: "CASH", amount: 0 }]);
    setQuery("");
  };

  return (
    <Stack spacing={2}>
      <PosHeader title="Facturar" />

      <Grid container spacing={2}>
        {/* Columna izquierda: búsqueda + carrito */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <ProductSearch
                value={query}
                onChange={setQuery}
                products={mockProducts}
                onPick={(p) => addProductToCart(p)}
                onScan={onScanBarcode}
              />
              <Divider />
              <CartTable items={cart} onQty={updateQty} onRemove={removeLine} />
            </Stack>
          </Paper>
        </Grid>

        {/* Columna derecha: totales + pagos */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <TotalsCard totals={totals} />
            <PaymentPanel
              payments={payments}
              onChange={setPayments}
              total={totals.total}
              onFinalize={finalizeSale}
              disabledFinalize={cart.length === 0 || totals.due > 0}
            />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}