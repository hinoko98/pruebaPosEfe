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
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";

const TIPOS_DOCUMENTO = [
  "NIT",
  "Cédula",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad",
] as const;

type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
type SupplierRow = Awaited<ReturnType<typeof window.api.listSuppliers>>["suppliers"][number];
type SupplierFormState = {
  name: string;
  contactName: string;
  documentType: TipoDocumento;
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(): SupplierFormState {
  return {
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
    return { documentType: "NIT" as TipoDocumento, documentNumber: "" };
  }

  const foundType = TIPOS_DOCUMENTO.find((type) => document.startsWith(`${type}: `));
  if (!foundType) {
    return { documentType: "NIT" as TipoDocumento, documentNumber: document };
  }

  return {
    documentType: foundType,
    documentNumber: document.slice(foundType.length + 2),
  };
}

function supplierToForm(supplier: SupplierRow): SupplierFormState {
  const documentParts = splitDocument(supplier.document);

  return {
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
  if (form.name.trim().length < 2) {
    return "El nombre del proveedor es obligatorio.";
  }
  if (form.phone && !/^\d{10}$/.test(form.phone)) {
    return "El teléfono debe tener 10 números.";
  }
  if (form.email && !EMAIL_REGEX.test(form.email)) {
    return "El correo no tiene un formato válido.";
  }
  return null;
}

export default function SuppliersView() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof window.api.listSuppliers>>["suppliers"]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
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
  const canCreateSuppliers = hasPermission(user, APP_PERMISSION_KEYS.suppliersCreate);
  const canEditSuppliers = hasPermission(user, APP_PERMISSION_KEYS.suppliersEdit);

  const openCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (supplier: SupplierRow) => {
    setEditingSupplier(supplier);
    setForm(supplierToForm(supplier));
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSupplier(null);
    setFormError(null);
  };

  const handleSave = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      isActive: form.isActive,
    };

    const response = editingSupplier
      ? await window.api.updateSupplier({ id: editingSupplier.id, ...payload })
      : await window.api.createSupplier(payload);

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo guardar el proveedor" });
      return;
    }

    setFeedback({
      severity: "success",
      message: editingSupplier ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.",
    });
    closeDialog();
    await loadSuppliers();
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">Proveedores</Typography>
          <Typography variant="body2" color="text.secondary">
            Directorio real de proveedores con creación por modal y usuario responsable.
          </Typography>
        </Box>

        {canCreateSuppliers ? (
          <Button variant="contained" onClick={openCreate}>
            Nuevo proveedor
          </Button>
        ) : null}
      </Box>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Proveedores activos</Typography><Typography variant="h5">{activeCount}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Total proveedores</Typography><Typography variant="h5">{suppliers.length}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Con compras registradas</Typography><Typography variant="h5">{withPurchasesCount}</Typography></CardContent></Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Buscar proveedor"
            placeholder="Nombre, documento, contacto, teléfono o correo"
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
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Registrado por</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography fontWeight={600}>{supplier.name}</Typography>
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
                        {canEditSuppliers ? (
                          <Button size="small" onClick={() => openEdit(supplier)}>
                            Ver / editar
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Sin acciones</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No hay proveedores para mostrar.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{editingSupplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
              <TextField
                label="Nombre comercial"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <TextField
                label="Contacto"
                value={form.contactName}
                onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
              />
              <TextField
                select
                label="Tipo de documento"
                value={form.documentType}
                onChange={(event) => setForm((prev) => ({ ...prev, documentType: event.target.value as TipoDocumento }))}
              >
                {TIPOS_DOCUMENTO.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Documento"
                value={form.documentNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, documentNumber: event.target.value }))}
              />
              <TextField
                label="Teléfono"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                helperText="Debe tener 10 números"
              />
              <TextField
                label="Correo"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
              />
              <TextField
                label="Dirección"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
              <TextField
                select
                label="Estado"
                value={form.isActive ? "ACTIVO" : "INACTIVO"}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === "ACTIVO" }))}
              >
                <MenuItem value="ACTIVO">Activo</MenuItem>
                <MenuItem value="INACTIVO">Inactivo</MenuItem>
              </TextField>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSave()}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
