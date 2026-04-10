import { useEffect, useMemo, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
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
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useTablePagination } from "@/hooks/useTablePagination";

type PurchaseRow = Awaited<ReturnType<typeof window.api.listPurchases>>["purchases"][number];
type CorrespondentPlatform = Awaited<ReturnType<typeof window.api.getCorrespondentCatalog>>["platforms"][number];

type PurchaseFormRow = {
  lineId: string;
  productId: string;
  qty: string;
  cost: string;
  taxRate: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function purchaseStatusLabel(status: PurchaseRow["status"]) {
  if (status === "PAID") return "Pagada";
  if (status === "PARTIALLY_PAID") return "Pago parcial";
  if (status === "DRAFT") return "Borrador";
  if (status === "CANCELLED") return "Cancelada";
  return "Recibida";
}

function emptyPurchaseRow(): PurchaseFormRow {
  return {
    lineId: crypto.randomUUID(),
    productId: "",
    qty: "1",
    cost: "0",
    taxRate: "0.19",
  };
}

function numberValue(value: string) {
  return Number(String(value || 0).replace(",", "."));
}

export default function PurchasesView() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Awaited<ReturnType<typeof window.api.listPurchases>>["purchases"]>([]);
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof window.api.listSuppliers>>["suppliers"]>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof window.api.listProductsAdmin>>["products"]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Awaited<ReturnType<typeof window.api.getPurchaseDetail>>["purchase"] | null>(null);
  const [correspondentPlatforms, setCorrespondentPlatforms] = useState<CorrespondentPlatform[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMedium, setPaymentMedium] = useState<"CASH" | "TRANSFER" | "CORRESPONDENT">("CASH");
  const [paymentPlatformId, setPaymentPlatformId] = useState("");
  const [rows, setRows] = useState<PurchaseFormRow[]>([emptyPurchaseRow()]);
  const canCreatePurchases = hasPermission(user, APP_PERMISSION_KEYS.purchasesCreate);
  const canViewPurchaseDetails = hasPermission(user, APP_PERMISSION_KEYS.purchasesDetails);

  const loadData = async () => {
    setLoading(true);
    const [purchasesResponse, suppliersResponse, productsResponse, correspondentResponse] = await Promise.all([
      window.api.listPurchases(),
      window.api.listSuppliers(),
      window.api.listProductsAdmin(),
      window.api.getCorrespondentCatalog(),
    ]);

    if (!purchasesResponse.success) {
      setFeedback({ severity: "error", message: purchasesResponse.message || "No se pudieron cargar las compras" });
      setLoading(false);
      return;
    }

    if (!suppliersResponse.success || !productsResponse.success || !correspondentResponse.success) {
      setFeedback({ severity: "error", message: "No se pudieron cargar proveedores o productos para compras." });
      setLoading(false);
      return;
    }

    setPurchases(purchasesResponse.purchases);
    setSuppliers(suppliersResponse.suppliers.filter((supplier) => supplier.isActive));
    setProducts(productsResponse.products.filter((product) => product.isActive));
    setCorrespondentPlatforms(correspondentResponse.platforms);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return purchases;

    return purchases.filter((purchase) =>
      [purchase.number, purchase.supplier, purchaseStatusLabel(purchase.status), purchase.createdBy || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [purchases, search]);

  const totals = useMemo(() => {
    return filteredPurchases.reduce(
      (acc, purchase) => {
        acc.total += purchase.total;
        acc.balance += purchase.balance;
        acc.count += 1;
        return acc;
      },
      { total: 0, balance: 0, count: 0 }
    );
  }, [filteredPurchases]);

  const draftTotals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const qty = numberValue(row.qty);
        const cost = numberValue(row.cost);
        const taxRate = numberValue(row.taxRate);
        const subtotal = Math.round(qty * cost);
        const tax = Math.round(subtotal * taxRate);
        acc.subtotal += subtotal;
        acc.tax += tax;
        return acc;
      },
      { subtotal: 0, tax: 0 }
    );
  }, [rows]);
  const purchasesPagination = useTablePagination(filteredPurchases);
  const draftRowsPagination = useTablePagination(rows);
  const detailItemsPagination = useTablePagination(selectedPurchase?.items ?? []);

  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyPurchaseRow()]);
  };

  const handleRowChange = (lineId: string, patch: Partial<PurchaseFormRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.lineId !== lineId) return row;
        const next = { ...row, ...patch };
        if (patch.productId) {
          const product = products.find((entry) => entry.id === patch.productId);
          if (product) {
            next.cost = String(product.cost || 0);
            next.taxRate = String(product.hasTax ? product.taxRate || 0.19 : 0);
          }
        }
        return next;
      })
    );
  };

  const handleRemoveRow = (lineId: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.lineId !== lineId)));
  };

  const resetForm = () => {
    setSupplierId("");
    setPurchasedAt(new Date().toISOString().slice(0, 10));
    setNote("");
    setMarkAsPaid(false);
    setPaymentMedium("CASH");
    setPaymentPlatformId("");
    setRows([emptyPurchaseRow()]);
  };

  const handleCreatePurchase = async () => {
    if (!supplierId) {
      setFeedback({ severity: "error", message: "Selecciona un proveedor para registrar la compra." });
      return;
    }

    const normalizedRows = rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        qty: Number(row.qty),
        cost: numberValue(row.cost),
        taxRate: numberValue(row.taxRate),
      }));

    if (normalizedRows.length === 0) {
      setFeedback({ severity: "error", message: "Agrega al menos un producto a la compra." });
      return;
    }

    if (normalizedRows.some((row) => row.qty <= 0 || row.cost <= 0)) {
      setFeedback({ severity: "error", message: "Cada producto debe tener cantidad y costo mayores a cero." });
      return;
    }

    if (markAsPaid && paymentMedium === "CORRESPONDENT" && !paymentPlatformId) {
      setFeedback({ severity: "error", message: "Selecciona el corresponsal desde el que salio el pago." });
      return;
    }

    const response = await window.api.createPurchase({
      supplierId,
      purchasedAt: new Date(`${purchasedAt}T12:00:00`).toISOString(),
      note: note.trim() || null,
      markAsPaid,
      paymentMedium,
      paymentPlatformId: paymentMedium === "CORRESPONDENT" ? paymentPlatformId || null : null,
      items: normalizedRows,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo registrar la compra" });
      return;
    }

    setFeedback({ severity: "success", message: "Compra registrada y surtido ingresado al inventario." });
    setCreateOpen(false);
    resetForm();
    await loadData();
  };

  const handleOpenDetail = async (id: string) => {
    const response = await window.api.getPurchaseDetail(id);
    if (!response.success || !response.purchase) {
      setFeedback({ severity: "error", message: response.message || "No se pudo cargar el detalle de la compra" });
      return;
    }

    setSelectedPurchase(response.purchase);
    setDetailOpen(true);
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Compras</Typography>
          <HelpHint title="Registra compras a proveedores, alimenta inventario y controla saldos pendientes de cada factura." />
        </Box>

        {canCreatePurchases ? (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            Nueva compra
          </Button>
        ) : null}
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Compras listadas</Typography><Typography variant="h5">{totals.count}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Total comprado</Typography><Typography variant="h5">{currency(totals.total)}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Saldo pendiente</Typography><Typography variant="h5">{currency(totals.balance)}</Typography></CardContent></Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Buscar compra"
            placeholder="Número, proveedor, estado o usuario"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <Alert severity="info">Cargando compras...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Compra</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Registrado por</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchasesPagination.paginatedRows.map((purchase) => (
                    <TableRow key={purchase.id} hover>
                      <TableCell>{purchase.number}</TableCell>
                      <TableCell>{purchase.supplier}</TableCell>
                      <TableCell>{new Date(purchase.purchasedAt).toLocaleDateString("es-CO")}</TableCell>
                      <TableCell>{purchaseStatusLabel(purchase.status)}</TableCell>
                      <TableCell align="right">{purchase.itemsCount}</TableCell>
                      <TableCell align="right">{currency(purchase.total)}</TableCell>
                      <TableCell align="right">{currency(purchase.balance)}</TableCell>
                      <TableCell>{purchase.createdBy || "Sin registro"}</TableCell>
                      <TableCell align="right">
                        {canViewPurchaseDetails ? (
                          <IconButton color="primary" onClick={() => void handleOpenDetail(purchase.id)}>
                            <VisibilityOutlinedIcon />
                          </IconButton>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Sin acciones</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No hay compras para mostrar.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredPurchases.length}
                page={purchasesPagination.page}
                onPageChange={purchasesPagination.handleChangePage}
                rowsPerPage={purchasesPagination.rowsPerPage}
                onRowsPerPageChange={purchasesPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Nueva compra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1.2fr 0.8fr" }} gap={2}>
              <TextField
                select
                label="Proveedor"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Fecha de compra"
                type="date"
                value={purchasedAt}
                onChange={(event) => setPurchasedAt(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <TextField
              label="Observación"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              multiline
              minRows={2}
            />

            <FormControlLabel
              control={<Checkbox checked={markAsPaid} onChange={(event) => setMarkAsPaid(event.target.checked)} />}
              label="Marcar compra como pagada"
            />

            {markAsPaid ? (
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: paymentMedium === "CORRESPONDENT" ? "1fr 1fr" : "1fr" }} gap={2}>
                <TextField
                  select
                  label="Medio desde el que sale el dinero"
                  value={paymentMedium}
                  onChange={(event) => {
                    const nextValue = event.target.value as "CASH" | "TRANSFER" | "CORRESPONDENT";
                    setPaymentMedium(nextValue);
                    if (nextValue !== "CORRESPONDENT") setPaymentPlatformId("");
                  }}
                >
                  <MenuItem value="CASH">Efectivo</MenuItem>
                  <MenuItem value="TRANSFER">Transferencias</MenuItem>
                  <MenuItem value="CORRESPONDENT">Corresponsal</MenuItem>
                </TextField>
                {paymentMedium === "CORRESPONDENT" ? (
                  <TextField
                    select
                    label="Plataforma corresponsal"
                    value={paymentPlatformId}
                    onChange={(event) => setPaymentPlatformId(event.target.value)}
                  >
                    {correspondentPlatforms.map((platform) => (
                      <MenuItem key={platform.id} value={platform.id}>
                        {platform.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
              </Box>
            ) : null}

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Costo unitario</TableCell>
                    <TableCell align="right">IVA</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {draftRowsPagination.paginatedRows.map((row) => {
                    const subtotal = Math.round(numberValue(row.qty) * numberValue(row.cost));
                    return (
                      <TableRow key={row.lineId}>
                        <TableCell sx={{ minWidth: 240 }}>
                          <TextField
                            select
                            size="small"
                            value={row.productId}
                            onChange={(event) => handleRowChange(row.lineId, { productId: event.target.value })}
                            fullWidth
                          >
                            {products.map((product) => (
                              <MenuItem key={product.id} value={product.id}>
                                {product.name}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 1 }}
                            value={row.qty}
                            onChange={(event) => handleRowChange(row.lineId, { qty: event.target.value })}
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: "0.01" }}
                            value={row.cost}
                            onChange={(event) => handleRowChange(row.lineId, { cost: event.target.value })}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: "0.01" }}
                            value={row.taxRate}
                            onChange={(event) => handleRowChange(row.lineId, { taxRate: event.target.value })}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="right">{currency(subtotal)}</TableCell>
                        <TableCell align="right">
                          <IconButton color="error" onClick={() => handleRemoveRow(row.lineId)}>
                            <DeleteOutlineIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={rows.length}
                page={draftRowsPagination.page}
                onPageChange={draftRowsPagination.handleChangePage}
                rowsPerPage={draftRowsPagination.rowsPerPage}
                onRowsPerPageChange={draftRowsPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>

            <Button variant="outlined" onClick={handleAddRow}>
              Agregar producto
            </Button>

            <Box display="flex" justifyContent="flex-end">
              <Card variant="outlined" sx={{ minWidth: 280 }}>
                <CardContent>
                  <Stack spacing={1}>
                    <SummaryRow label="Subtotal" value={currency(draftTotals.subtotal)} />
                    <SummaryRow label="IVA" value={currency(draftTotals.tax)} />
                    <SummaryRow label="Total" value={currency(draftTotals.subtotal + draftTotals.tax)} strong />
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleCreatePurchase()}>
            Guardar compra
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Detalle de compra</DialogTitle>
        <DialogContent>
          {selectedPurchase ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
                <DetailCard label="Compra" value={selectedPurchase.number} />
                <DetailCard label="Proveedor" value={selectedPurchase.supplier} />
                <DetailCard label="Fecha" value={new Date(selectedPurchase.purchasedAt).toLocaleString("es-CO")} />
                <DetailCard label="Estado" value={purchaseStatusLabel(selectedPurchase.status)} />
                <DetailCard label="Registrado por" value={selectedPurchase.createdBy || "Sin registro"} />
                <DetailCard label="Saldo" value={currency(selectedPurchase.balance)} />
              </Box>

              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Cantidad</TableCell>
                      <TableCell align="right">Costo</TableCell>
                      <TableCell align="right">IVA</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailItemsPagination.paginatedRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.productSku || "-"}</TableCell>
                        <TableCell align="right">{item.qty}</TableCell>
                        <TableCell align="right">{currency(item.cost)}</TableCell>
                        <TableCell align="right">{Math.round(item.taxRate * 100)}%</TableCell>
                        <TableCell align="right">{currency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={selectedPurchase.items.length}
                  page={detailItemsPagination.page}
                  onPageChange={detailItemsPagination.handleChangePage}
                  rowsPerPage={detailItemsPagination.rowsPerPage}
                  onRowsPerPageChange={detailItemsPagination.handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 15]}
                  labelRowsPerPage="Filas"
                />
              </Box>

              {selectedPurchase.note ? (
                <Alert severity="info">{selectedPurchase.note}</Alert>
              ) : null}

              <Box display="flex" justifyContent="flex-end">
                <Card variant="outlined" sx={{ minWidth: 280 }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <SummaryRow label="Subtotal" value={currency(selectedPurchase.subtotal)} />
                      <SummaryRow label="IVA" value={currency(selectedPurchase.tax)} />
                      <SummaryRow label="Total" value={currency(selectedPurchase.total)} strong />
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2}>
      <Typography variant="body2" color={strong ? "text.primary" : "text.secondary"} fontWeight={strong ? 700 : 500}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 700 : 600}>
        {value}
      </Typography>
    </Box>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="subtitle1" fontWeight={700}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
