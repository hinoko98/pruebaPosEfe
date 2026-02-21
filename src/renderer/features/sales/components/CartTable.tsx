// src/renderer/features/sales/components/CartTable.tsx
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import DeleteIcon from "@mui/icons-material/Delete";
import type { CartItem } from "../types";

export default function CartTable({
  items,
  onQty,
  onRemove,
}: {
  items: CartItem[];
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}) {
  if (items.length === 0) {
    return <Typography color="text.secondary">Carrito vacío.</Typography>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Producto</TableCell>
          <TableCell align="right">Precio</TableCell>
          <TableCell align="right">Cant.</TableCell>
          <TableCell align="right">Total</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.lineId}>
            <TableCell>{i.name}</TableCell>
            <TableCell align="right">{i.price}</TableCell>
            <TableCell align="right" sx={{ width: 110 }}>
              <TextField
                size="small"
                type="number"
                value={i.qty}
                inputProps={{ min: 1 }}
                onChange={(e) => onQty(i.lineId, Number(e.target.value))}
              />
            </TableCell>
            <TableCell align="right">{i.price * i.qty}</TableCell>
            <TableCell align="right">
              <IconButton onClick={() => onRemove(i.lineId)} size="small">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}