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
  "Cédula",
  "NIT",
  "Cédula de extranjería",
  "Pasaporte",
  "Tarjeta de identidad",
] as const;

type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
type CustomerRow = Awaited<ReturnType<typeof window.api.listCustomers>>["customers"][number];
type CustomerFormState = {
  firstName: string;
  lastName: string;
  documentType: TipoDocumento;
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(): CustomerFormState {
  return {
    firstName: "",
    lastName: "",
    documentType: "Cédula",
    documentNumber: "",
    phone: "",
    email: "",
    address: "",
    isActive: true,
  };
}

function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: name.trim(), lastName: "" };
  }

  const pivot = parts.length === 2 ? 1 : Math.ceil(parts.length / 2);
  return {
    firstName: parts.slice(0, pivot).join(" "),
    lastName: parts.slice(pivot).join(" "),
  };
}

function splitDocument(document: string | null) {
  if (!document) {
    return { documentType: "Cédula" as TipoDocumento, documentNumber: "" };
  }

  const foundType = TIPOS_DOCUMENTO.find((type) => document.startsWith(`${type}: `));
  if (!foundType) {
    return { documentType: "Cédula" as TipoDocumento, documentNumber: document };
  }

  return {
    documentType: foundType,
    documentNumber: document.slice(foundType.length + 2),
  };
}

function customerToForm(customer: CustomerRow): CustomerFormState {
  const nameParts = splitFullName(customer.name);
  const documentParts = splitDocument(customer.document);

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    documentType: documentParts.documentType,
    documentNumber: documentParts.documentNumber,
    phone: customer.phone || "",
    email: customer.email || "",
    address: customer.address || "",
    isActive: customer.isActive,
  };
}

function validateForm(form: CustomerFormState) {
  if (form.firstName.trim().length < 2) {
    return "Los nombres son obligatorios.";
  }
  if (form.phone && !/^\d{10}$/.test(form.phone)) {
    return "El teléfono debe tener 10 números.";
  }
  if (form.email && !EMAIL_REGEX.test(form.email)) {
    return "El correo no tiene un formato válido.";
  }
  return null;
}

export default function CustomersView() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof window.api.listCustomers>>["customers"]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    const response = await window.api.listCustomers();
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudieron cargar los clientes" });
      setLoading(false);
      return;
    }
    setCustomers(response.customers);
    setLoading(false);
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [customer.name, customer.document || "", customer.phone || "", customer.email || "", customer.createdBy || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [customers, search]);

  const activeCount = customers.filter((customer) => customer.isActive).length;
  const withSalesCount = customers.filter((customer) => customer.salesCount > 0).length;
  const canCreateCustomers = hasPermission(user, APP_PERMISSION_KEYS.customersCreate);
  const canEditCustomers = hasPermission(user, APP_PERMISSION_KEYS.customersEdit);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setForm(customerToForm(customer));
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
    setFormError(null);
  };

  const handleSave = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      isActive: form.isActive,
    };

    const response = editingCustomer
      ? await window.api.updateCustomer({ id: editingCustomer.id, ...payload })
      : await window.api.createCustomer(payload);

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo guardar el cliente" });
      return;
    }

    setFeedback({
      severity: "success",
      message: editingCustomer ? "Cliente actualizado correctamente." : "Cliente creado correctamente.",
    });
    closeDialog();
    await loadCustomers();
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">Clientes</Typography>
          <Typography variant="body2" color="text.secondary">
            Registro real de clientes con validación y trazabilidad de quién los creó.
          </Typography>
        </Box>

        {canCreateCustomers ? (
          <Button variant="contained" onClick={openCreate}>
            Nuevo cliente
          </Button>
        ) : null}
      </Box>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Clientes activos</Typography><Typography variant="h5">{activeCount}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Total clientes</Typography><Typography variant="h5">{customers.length}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="body2" color="text.secondary">Clientes con ventas</Typography><Typography variant="h5">{withSalesCount}</Typography></CardContent></Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Buscar cliente"
            placeholder="Nombre, documento, teléfono, correo o usuario"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <Alert severity="info">Cargando clientes...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Documento</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Registrado por</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography fontWeight={600}>{customer.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ventas relacionadas: {customer.salesCount}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{customer.document || "-"}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.email || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={customer.isActive ? "Activo" : "Inactivo"}
                          color={customer.isActive ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>{customer.createdBy || "Sin registro"}</TableCell>
                      <TableCell align="right">
                        {canEditCustomers ? (
                          <Button size="small" onClick={() => openEdit(customer)}>
                            Ver / editar
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Sin acciones</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No hay clientes para mostrar.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{editingCustomer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
              <TextField
                label="Nombres"
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                required
              />
              <TextField
                label="Apellidos"
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
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
                sx={{ gridColumn: { xs: "auto", md: "1 / span 1" } }}
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
