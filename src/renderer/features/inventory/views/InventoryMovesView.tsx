import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { useTablePagination } from "@/hooks/useTablePagination";
import { tipoMovimientoInventarioLabel } from "@/lib/display";

type InventoryMove = Awaited<ReturnType<typeof window.api.listInventoryMoves>>["moves"][number];

const MOVEMENT_TYPES: InventoryMove["type"][] = [
  "PURCHASE_IN",
  "SALE_OUT",
  "RETURN_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE_OUT",
  "LOSS_OUT",
  "MANUAL_IN",
  "MANUAL_OUT",
];

function monthKey(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function InventoryMovesView() {
  const [moves, setMoves] = useState<Awaited<ReturnType<typeof window.api.listInventoryMoves>>["moves"]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedMove, setSelectedMove] = useState<InventoryMove | null>(null);

  useEffect(() => {
    let active = true;

    window.api
      .listInventoryMoves()
      .then((response) => {
        if (!active) return;
        if (!response.success) {
          setFeedback(response.message || "No se pudieron cargar los movimientos");
          return;
        }
        setMoves(response.moves);
      })
      .catch(() => {
        if (!active) return;
        setFeedback("No se pudieron cargar los movimientos");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredMoves = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return moves.filter((move) => {
      const matchesSearch =
        !query ||
        [
          move.productName,
          move.productSku,
          tipoMovimientoInventarioLabel(move.type),
          move.referenceType || "",
          move.note || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesMonth = !monthFilter || monthKey(move.createdAt) === monthFilter;
      const matchesType = !typeFilter || move.type === typeFilter;

      return matchesSearch && matchesMonth && matchesType;
    });
  }, [moves, productSearch, monthFilter, typeFilter]);

  const adjustmentsToday = moves.filter((move) => {
    const sameDay = new Date(move.createdAt).toDateString() === new Date().toDateString();
    return sameDay && move.type.includes("ADJUSTMENT");
  }).length;
  const movesPagination = useTablePagination(filteredMoves);

  return (
    <Stack spacing={3}>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Movimientos de inventario</Typography>
          <HelpHint title="Kardex operativo con fecha, producto, referencia y tipo de ajuste para rastrear entradas y salidas reales." />
        </Box>
      </Box>

      <FloatingAlert
        feedback={feedback ? { severity: "error", message: feedback } : null}
        onClose={() => setFeedback(null)}
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Movimientos cargados</Typography><Typography variant="h5">{moves.length}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Movimientos filtrados</Typography><Typography variant="h5">{filteredMoves.length}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Ajustes de hoy</Typography><Typography variant="h5">{adjustmentsToday}</Typography></CardContent></Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1.4fr 0.8fr 1fr" }} gap={2}>
            <TextField
              label="Buscar por producto o referencia"
              placeholder="Nombre, SKU, tipo o nota"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            <TextField
              label="Mes"
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Tipo de movimiento"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {MOVEMENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {tipoMovimientoInventarioLabel(type)}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {loading ? (
            <Alert severity="info">Cargando movimientos...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Hora</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Antes</TableCell>
                    <TableCell align="right">Después</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movesPagination.paginatedRows.map((move) => {
                    const date = new Date(move.createdAt);
                    return (
                      <TableRow key={move.id} hover>
                        <TableCell>{date.toLocaleDateString("es-CO")}</TableCell>
                        <TableCell>{date.toLocaleTimeString("es-CO")}</TableCell>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography fontWeight={600}>{move.productName}</Typography>
                            <Typography variant="caption" color="text.secondary">{move.productSku}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={tipoMovimientoInventarioLabel(move.type)} variant="outlined" /></TableCell>
                        <TableCell align="right">{move.qty}</TableCell>
                        <TableCell align="right">{move.stockBefore}</TableCell>
                        <TableCell align="right">{move.stockAfter}</TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setSelectedMove(move)}>
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredMoves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">No hay movimientos para mostrar con esos filtros.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredMoves.length}
                page={movesPagination.page}
                onPageChange={movesPagination.handleChangePage}
                rowsPerPage={movesPagination.rowsPerPage}
                onRowsPerPageChange={movesPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={Boolean(selectedMove)} onClose={() => setSelectedMove(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle del movimiento</DialogTitle>
        <DialogContent>
          {selectedMove ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <DetailRow label="Producto" value={selectedMove.productName} />
              <DetailRow label="SKU" value={selectedMove.productSku} />
              <DetailRow label="Tipo" value={tipoMovimientoInventarioLabel(selectedMove.type)} />
              <DetailRow label="Fecha" value={new Date(selectedMove.createdAt).toLocaleDateString("es-CO")} />
              <DetailRow label="Hora" value={new Date(selectedMove.createdAt).toLocaleTimeString("es-CO")} />
              <DetailRow label="Cantidad" value={String(selectedMove.qty)} />
              <DetailRow label="Stock antes" value={String(selectedMove.stockBefore)} />
              <DetailRow label="Stock después" value={String(selectedMove.stockAfter)} />
              <DetailRow label="Tipo de referencia" value={selectedMove.referenceType || "-"} />
              <DetailRow label="Id de referencia" value={selectedMove.referenceId || "-"} />
              <DetailRow label="Detalle" value={selectedMove.note || "-"} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMove(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right">{value}</Typography>
    </Box>
  );
}
