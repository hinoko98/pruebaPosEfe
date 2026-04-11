import { useEffect, useMemo, useState } from "react";

import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { copyText } from "@/lib/clipboard";

type SupplierRow = Awaited<ReturnType<typeof window.api.listSuppliers>>["suppliers"][number];
type SupplierDocumentType = NonNullable<Parameters<typeof window.api.createSupplier>[0]["documentType"]>;
type DialogMode = "create" | "view" | "edit";

type SupplierFormState = {
  internalCode: string;
  name: string;
  contactName: string;
  documentType: SupplierDocumentType;
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
};

const DOCUMENT_TYPES: SupplierDocumentType[] = [
  "NIT",
  "Cédula",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(): SupplierFormState {
  return {
    internalCode: "",
    name: "",
    contactName: "",
    documentType: "NIT",
    documentNumber: "",
    phone: "",
    email: "",
    address: "",
    isActive: true,
  };
}

function splitDocument(document: string | null) {
  if (!document) {
    return { documentType: "NIT" as SupplierDocumentType, documentNumber: "" };
  }

  const foundType = DOCUMENT_TYPES.find((type) => document.startsWith(`${type}: `));
  if (!foundType) {
    return { documentType: "NIT" as SupplierDocumentType, documentNumber: document };
  }

  return {
    documentType: foundType,
    documentNumber: document.slice(foundType.length + 2),
  };
}

function supplierToForm(supplier: SupplierRow): SupplierFormState {
  const documentParts = splitDocument(supplier.document);

  return {
    internalCode: supplier.internalCode || "",
    name: supplier.name,
    contactName: supplier.contactName || "",
    documentType: documentParts.documentType,
    documentNumber: documentParts.documentNumber,
    phone: supplier.phone || "",
    email: supplier.email || "",
    address: supplier.address || "",
    isActive: supplier.isActive,
  };
}

function validateForm(form: SupplierFormState) {
  if (form.name.trim().length < 2) return "El nombre del proveedor es obligatorio.";
  if (form.phone && !/^\d{10}$/.test(form.phone)) return "El telefono debe tener 10 numeros.";
  if (form.email && !EMAIL_REGEX.test(form.email)) return "El correo no tiene un formato valido.";
  return null;
}

export default function SuppliersView() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    const response = await window.api.listSuppliers();
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudieron cargar los proveedores" });
      setLoading(false);
      return;
    }

    setSuppliers(response.suppliers);
    setLoading(false);
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.internalCode || "",
        supplier.document || "",
        supplier.phone || "",
        supplier.email || "",
        supplier.contactName || "",
        supplier.createdBy || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [suppliers, search]);

  const activeCount = suppliers.filter((supplier) => supplier.isActive).length;
  const withPurchasesCount = suppliers.filter((supplier) => supplier.purchasesCount > 0).length;
  const canViewSuppliers = hasPermission(user, APP_PERMISSION_KEYS.suppliersView);
  const canEditSuppliers = hasPermission(user, APP_PERMISSION_KEYS.suppliersEdit);
  const canCreateSuppliers = hasPermission(user, APP_PERMISSION_KEYS.suppliersCreate);
  const suppliersPagination = useTablePagination(filteredSuppliers);

  const isCreateMode = dialogMode === "create";
  const isViewMode = dialogMode === "view";
  const isEditMode = dialogMode === "edit";

  const openCreate = () => {
    setDialogMode("create");
    setSelectedSupplier(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openView = (supplier: SupplierRow) => {
    setDialogMode("view");
    setSelectedSupplier(supplier);
    setForm(supplierToForm(supplier));
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (supplier: SupplierRow) => {
    setDialogMode("edit");
    setSelectedSupplier(supplier);
    setForm(supplierToForm(supplier));
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedSupplier(null);
    setFormError(null);
  };

  const handleCopyCode = async (value: string | null) => {
    if (!value) return;

    try {
      await copyText(value);
      setFeedback({ severity: "success", message: `Codigo ${value} copiado.` });
    } catch {
      setFeedback({ severity: "error", message: "No se pudo copiar el codigo." });
    }
  };

  const handleSave = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const basePayload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
    };

    const response =
      isEditMode && selectedSupplier
        ? await window.api.updateSupplier({ id: selectedSupplier.id, ...basePayload, isActive: form.isActive })
        : await window.api.createSupplier(basePayload);

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo guardar el proveedor" });
      return;
    }

    setFeedback({
      severity: "success",
      message: isEditMode ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.",
    });
    closeDialog();
    await loadSuppliers();
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Proveedores</Typography>
          <HelpHint title="Centraliza proveedores, codigos internos y datos de contacto para compras y control administrativo." />
        </Box>

        {canCreateSuppliers ? (
          <Button variant="contained" onClick={openCreate}>
            Nuevo proveedor
          </Button>
        ) : null}
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />
      <FloatingAlert
        feedback={formError ? { severity: "error", message: formError } : null}
        onClose={() => setFormError(null)}
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Proveedores activos
            </Typography>
            <Typography variant="h5">{activeCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Total proveedores
            </Typography>
            <Typography variant="h5">{suppliers.length}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Con compras registradas
            </Typography>
            <Typography variant="h5">{withPurchasesCount}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Buscar proveedor"
            placeholder="Codigo, nombre, documento, contacto, telefono o correo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <Alert severity="info">Cargando proveedores...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>Documento</TableCell>
                    <TableCell>Telefono</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Registrado por</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suppliersPagination.paginatedRows.map((supplier) => (
                    <TableRow key={supplier.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography fontWeight={600}>{supplier.name}</Typography>
                          <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                            <Chip size="small" label={supplier.internalCode || "Sin codigo"} variant="outlined" />
                            {supplier.internalCode ? (
                              <Button
                                size="small"
                                startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
                                onClick={() => void handleCopyCode(supplier.internalCode)}
                              >
                                Copiar
                              </Button>
                            ) : null}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Contacto: {supplier.contactName || "No definido"}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{supplier.document || "-"}</TableCell>
                      <TableCell>{supplier.phone || "-"}</TableCell>
                      <TableCell>{supplier.email || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={supplier.isActive ? "Activo" : "Inactivo"}
                          color={supplier.isActive ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>{supplier.createdBy || "Sin registro"}</TableCell>
                      <TableCell align="right">
                        <Box display="inline-flex" alignItems="center" gap={0.5}>
                          {(canViewSuppliers || canEditSuppliers) ? (
                            <Tooltip title="Ver proveedor">
                              <IconButton size="small" onClick={() => openView(supplier)}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          {canEditSuppliers ? (
                            <Tooltip title="Editar proveedor">
                              <IconButton size="small" onClick={() => openEdit(supplier)}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          {!canViewSuppliers && !canEditSuppliers ? (
                            <Typography variant="body2" color="text.secondary">
                              Sin acciones
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No hay proveedores para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredSuppliers.length}
                page={suppliersPagination.page}
                onPageChange={suppliersPagination.handleChangePage}
                rowsPerPage={suppliersPagination.rowsPerPage}
                onRowsPerPageChange={suppliersPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {isCreateMode ? "Nuevo proveedor" : isEditMode ? "Editar proveedor" : "Ver proveedor"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
              {!isCreateMode ? (
                <TextField
                  label="Codigo interno"
                  value={form.internalCode || "Generado automaticamente"}
                  InputProps={{ readOnly: true }}
                />
              ) : null}
              <TextField
                label="Nombre comercial"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                disabled={isViewMode}
              />
              <TextField
                label="Contacto"
                value={form.contactName}
                onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                disabled={isViewMode}
              />
              <TextField
                select
                label="Tipo de documento"
                value={form.documentType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, documentType: event.target.value as SupplierDocumentType }))
                }
                disabled={isViewMode}
              >
                {DOCUMENT_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Documento"
                value={form.documentNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, documentNumber: event.target.value }))}
                disabled={isViewMode}
              />
              <TextField
                label="Telefono"
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                helperText="Debe tener 10 numeros"
                disabled={isViewMode}
              />
              <TextField
                label="Correo"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
                disabled={isViewMode}
              />
              <TextField
                label="Direccion"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                disabled={isViewMode}
              />
              {isEditMode ? (
                <TextField
                  select
                  label="Estado"
                  value={form.isActive ? "ACTIVO" : "INACTIVO"}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === "ACTIVO" }))}
                >
                  <MenuItem value="ACTIVO">Activo</MenuItem>
                  <MenuItem value="INACTIVO">Inactivo</MenuItem>
                </TextField>
              ) : null}
              {isViewMode ? (
                <TextField
                  label="Estado"
                  value={form.isActive ? "Activo" : "Inactivo"}
                  InputProps={{ readOnly: true }}
                />
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{isViewMode ? "Cerrar" : "Cancelar"}</Button>
          {!isViewMode ? (
            <Button variant="contained" onClick={() => void handleSave()}>
              Guardar
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
