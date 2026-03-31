import { useCallback, useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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

import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { alpha } from "@mui/material/styles";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import { CorrespondentModuleNav } from "@/features/correspondent/components/CorrespondentModuleNav";
import type {
  CorrespondentPlatform,
  CorrespondentTransactionDetail,
  CorrespondentTransactionItem,
} from "@/features/correspondent/types";
import { useTablePagination } from "@/hooks/useTablePagination";
import {
  auditActionLabel,
  buildRange,
  formatCurrency,
  formatDate,
  formatTime,
  toDateInputValue,
  toDateTimeInputValue,
  transactionLabel,
} from "@/features/correspondent/utils";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;
type RangeType = "day" | "week" | "month";

export default function CorrespondentHistoryView() {
  const [catalog, setCatalog] = useState<CorrespondentPlatform[]>([]);
  const [transactions, setTransactions] = useState<CorrespondentTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [range, setRange] = useState<RangeType>("day");
  const [anchorDate, setAnchorDate] = useState(toDateInputValue());
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CorrespondentTransactionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");
  const [editTypeId, setEditTypeId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPerformedAt, setEditPerformedAt] = useState("");

  const editPlatform = useMemo(
    () => catalog.find((platform) => platform.id === editPlatformId) ?? null,
    [catalog, editPlatformId]
  );

  const loadTransactions = useCallback(async () => {
    const selectedPlatformId = platformFilter === "ALL" ? undefined : platformFilter;
    const { dateFrom, dateTo } = buildRange(range, anchorDate);

    const response = await window.api.listCorrespondentTransactions({
      platformId: selectedPlatformId,
      search: search || undefined,
      dateFrom,
      dateTo,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo cargar el historial" });
      return;
    }

    setTransactions(response.transactions);
  }, [anchorDate, platformFilter, range, search]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const catalogResponse = await window.api.getCorrespondentCatalog();
      if (!catalogResponse.success) {
        throw new Error(catalogResponse.message || "No se pudo cargar el catalogo");
      }
      setCatalog(catalogResponse.platforms);
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el historial",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function openDetail(transactionId: string) {
    const response = await window.api.getCorrespondentTransactionDetail({ transactionId });
    if (!response.success || !response.transaction) {
      setFeedback({ severity: "error", message: response.message || "No se pudo cargar el detalle" });
      return;
    }

    setDetail(response.transaction);
    setDetailOpen(true);
  }

  function openEdit(transaction: CorrespondentTransactionItem) {
    setEditTransactionId(transaction.id);
    setEditPlatformId(transaction.platformId);
    setEditTypeId(transaction.typeId);
    setEditAmount(String(transaction.amount));
    setEditPerformedAt(toDateTimeInputValue(transaction.performedAt));
    setEditOpen(true);
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      const response = await window.api.updateCorrespondentTransaction({
        transactionId: editTransactionId,
        typeId: editTypeId,
        amount: Number(editAmount),
        performedAt: new Date(editPerformedAt).toISOString(),
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo actualizar" });
        return;
      }

      setFeedback({ severity: "success", message: "La transaccion fue actualizada." });
      setEditOpen(false);
      await loadTransactions();
      if (detail?.id === editTransactionId) {
        await openDetail(editTransactionId);
      }
    } finally {
      setSaving(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return transactions;

    return transactions.filter((transaction) => {
      const raw = [
        transaction.platform,
        transaction.type,
        transaction.registeredBy,
        transaction.externalReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return raw.includes(normalizedSearch);
    });
  }, [search, transactions]);
  const transactionsPagination = useTablePagination(filteredTransactions);

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight={420}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <CorrespondentModuleNav />

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5">Historial de transacciones</Typography>
              <Typography variant="body2" color="text.secondary">
                Consulta el historial por corresponsal y por rango diario, semanal o mensual.
              </Typography>
            </Box>

            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant={platformFilter === "ALL" ? "contained" : "outlined"}
                onClick={() => setPlatformFilter("ALL")}
              >
                Todos
              </Button>
              {catalog.map((platform) => (
                <Button
                  key={platform.id}
                  variant={platformFilter === platform.id ? "contained" : "outlined"}
                  onClick={() => setPlatformFilter(platform.id)}
                  sx={(theme) => ({
                    borderRadius: 999,
                    px: 2,
                    color:
                      platformFilter === platform.id
                        ? theme.palette.common.white
                        : theme.palette.text.primary,
                    background:
                      platformFilter === platform.id
                        ? "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)"
                        : alpha(theme.palette.primary.main, 0.06),
                    borderColor: alpha(theme.palette.primary.main, 0.14),
                  })}
                >
                  {platform.name}
                </Button>
              ))}
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
              <TextField
                select
                label="Rango"
                value={range}
                onChange={(event) => setRange(event.target.value as RangeType)}
              >
                <MenuItem value="day">Diario</MenuItem>
                <MenuItem value="week">Semanal</MenuItem>
                <MenuItem value="month">Mensual</MenuItem>
              </TextField>
              <TextField
                label="Fecha base"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Buscar"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tipo, referencia, usuario"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>No. transaccion</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Hora</TableCell>
                  <TableCell>Corresponsal</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactionsPagination.paginatedRows.map((transaction) => (
                  <TableRow key={transaction.id} hover>
                    <TableCell>{transactionLabel(transaction.id)}</TableCell>
                    <TableCell>{formatDate(transaction.performedAt)}</TableCell>
                    <TableCell>{formatTime(transaction.performedAt)}</TableCell>
                    <TableCell>{transaction.platform}</TableCell>
                    <TableCell>{transaction.type}</TableCell>
                    <TableCell align="right">{formatCurrency(transaction.amount)}</TableCell>
                    <TableCell>{transaction.registeredBy}</TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => void openDetail(transaction.id)}>
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => openEdit(transaction)}
                        disabled={Boolean(transaction.closureId) || transaction.status === "VOIDED"}
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No hay transacciones para ese filtro.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredTransactions.length}
              page={transactionsPagination.page}
              onPageChange={transactionsPagination.handleChangePage}
              rowsPerPage={transactionsPagination.rowsPerPage}
              onRowsPerPageChange={transactionsPagination.handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 15]}
              labelRowsPerPage="Filas"
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Detalle de transaccion</DialogTitle>
        <DialogContent>
          {detail ? (
            <Stack spacing={2} pt={1}>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="No. transaccion" value={transactionLabel(detail.id)} InputProps={{ readOnly: true }} />
                <TextField label="Corresponsal" value={detail.platform} InputProps={{ readOnly: true }} />
                <TextField label="Tipo" value={detail.type} InputProps={{ readOnly: true }} />
                <TextField label="Valor" value={formatCurrency(detail.amount)} InputProps={{ readOnly: true }} />
                <TextField label="Fecha" value={formatDate(detail.performedAt)} InputProps={{ readOnly: true }} />
                <TextField label="Hora" value={formatTime(detail.performedAt)} InputProps={{ readOnly: true }} />
                <TextField label="Realizada por" value={detail.registeredBy} InputProps={{ readOnly: true }} />
                <TextField label="Ultima actualizacion" value={formatDate(detail.updatedAt)} InputProps={{ readOnly: true }} />
              </Box>

              <Box>
                <Typography variant="subtitle1">Auditoria</Typography>
                {detail.auditTrail.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay eventos registrados.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {detail.auditTrail.map((entry) => (
                      <Card key={entry.id} variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2">
                            {auditActionLabel(entry.action)} | {entry.user ?? "Sistema"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(entry.createdAt)} a las {formatTime(entry.createdAt)}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar transaccion</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <TextField
              select
              label="Tipo"
              value={editTypeId}
              onChange={(event) => setEditTypeId(event.target.value)}
              fullWidth
            >
              {(editPlatform?.types ?? []).map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Valor"
              type="number"
              value={editAmount}
              onChange={(event) => setEditAmount(event.target.value)}
              fullWidth
            />
            <TextField
              label="Fecha y hora"
              type="datetime-local"
              value={editPerformedAt}
              onChange={(event) => setEditPerformedAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleUpdate()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
