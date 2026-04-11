import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
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
import { buildSuggestedManagedCode, normalizePrefixedCode } from "@/lib/internal-code";
import { rolLabel } from "@/lib/display";

type UserRow = Awaited<ReturnType<typeof window.api.listUsers>>["users"][number];

type UserFormState = {
  internalCode: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  newPassword: string;
  roleProfileId: string;
  isActive: boolean;
};

const initialFormState: UserFormState = {
  internalCode: "",
  firstName: "",
  lastName: "",
  documentNumber: "",
  email: "",
  phone: "",
  address: "",
  birthDate: "",
  newPassword: "",
  roleProfileId: "",
  isActive: true,
};

function normalizeUsernamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function buildGeneratedUsername(firstName: string, lastName: string, documentNumber: string) {
  const documentDigits = documentNumber.replace(/\D/g, "");
  if (!firstName.trim() || !lastName.trim() || documentDigits.length < 3) {
    return "";
  }

  const firstPart = normalizeUsernamePart(firstName).slice(0, 3).padEnd(3, "x");
  const lastPart = normalizeUsernamePart(lastName).slice(0, 3).padEnd(3, "x");
  const documentPart = documentDigits.slice(-3).padStart(3, "0");

  return `${firstPart}${lastPart}${documentPart}`;
}

function formatOptionalValue(value?: string | null) {
  return value?.trim() ? value : "No registrado";
}

function toEditForm(user: UserRow): UserFormState {
  return {
    internalCode: user.internalCode ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    documentNumber: user.documentNumber ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    address: user.address ?? "",
    birthDate: user.birthDate ?? "",
    newPassword: "",
    roleProfileId: user.roleProfileId ?? "",
    isActive: user.isActive,
  };
}

function getDefaultRoleProfileId(
  roleProfiles: Awaited<ReturnType<typeof window.api.listRoleProfiles>>["roles"],
  baseRole: "ADMIN" | "EMPLOYEE" = "EMPLOYEE"
) {
  return (
    roleProfiles.find((entry) => entry.isSystem && entry.baseRole === baseRole && entry.isActive)?.id ??
    roleProfiles.find((entry) => entry.baseRole === baseRole && entry.isActive)?.id ??
    ""
  );
}

export function UserView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [roleProfiles, setRoleProfiles] = useState<Awaited<ReturnType<typeof window.api.listRoleProfiles>>["roles"]>([]);
  const [form, setForm] = useState<UserFormState>(initialFormState);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);

  const generatedUsername = useMemo(
    () => buildGeneratedUsername(form.firstName, form.lastName, form.documentNumber),
    [form.documentNumber, form.firstName, form.lastName]
  );

  const loadUsers = async () => {
    setLoading(true);
    const response = await window.api.listUsers();
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudieron cargar los usuarios" });
      setLoading(false);
      return;
    }
    setUsers(response.users);
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      const response = await window.api.listRoleProfiles();
      if (response.success) {
        setRoleProfiles(response.roles);
      }
    };

    void loadRoles();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((row) =>
      [
        row.name || "",
        row.internalCode || "",
        row.firstName || "",
        row.lastName || "",
        row.username,
        row.documentNumber || "",
        row.email || "",
        row.phone || "",
        row.address || "",
        rolLabel(row.role),
        row.isActive ? "activo" : "inactivo",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, users]);

  const adminCount = users.filter((row) => row.role === "ADMIN").length;
  const employeeCount = users.filter((row) => row.role === "EMPLOYEE").length;
  const activeCount = users.filter((row) => row.isActive).length;
  const availableRoleProfiles = roleProfiles.filter((entry) => entry.isActive);
  const canCreateUsers = hasPermission(user, APP_PERMISSION_KEYS.usersCreate);
  const canEditUsers = hasPermission(user, APP_PERMISSION_KEYS.usersEdit);
  const canViewRoles = hasPermission(user, APP_PERMISSION_KEYS.rolesView);
  const usersPagination = useTablePagination(filteredUsers);

  const updateForm = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setForm(initialFormState);
  };

  const openCreateDialog = () => {
    setForm({
      ...initialFormState,
      internalCode: buildSuggestedManagedCode(users.map((entry) => entry.internalCode), "USR", 4),
      roleProfileId: getDefaultRoleProfileId(roleProfiles, "EMPLOYEE"),
    });
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    resetForm();
  };

  const openEditDialog = (user: UserRow) => {
    setEditingUser(user);
    setForm(toEditForm(user));
  };

  const closeEditDialog = () => {
    setEditingUser(null);
    resetForm();
  };

  const handleCreate = async () => {
    const response = await window.api.createUser({
      internalCode: form.internalCode || null,
      firstName: form.firstName,
      lastName: form.lastName,
      documentNumber: form.documentNumber,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      birthDate: form.birthDate || null,
      newPassword: form.newPassword,
      roleProfileId: form.roleProfileId || null,
      isActive: form.isActive,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo crear el usuario" });
      return;
    }

    setFeedback({
      severity: "success",
      message: `Usuario creado correctamente. Acceso generado: ${response.username || generatedUsername}.`,
    });
    closeCreateDialog();
    await loadUsers();
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    const response = await window.api.updateUser({
      id: editingUser.id,
      internalCode: form.internalCode || null,
      firstName: form.firstName,
      lastName: form.lastName,
      documentNumber: form.documentNumber,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      birthDate: form.birthDate || null,
      newPassword: form.newPassword,
      roleProfileId: form.roleProfileId || null,
      isActive: form.isActive,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo actualizar el usuario" });
      return;
    }

    setFeedback({
      severity: "success",
      message: `Usuario actualizado correctamente. Acceso vigente: ${response.username || generatedUsername}.`,
    });
    closeEditDialog();
    await loadUsers();
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

  const renderUserForm = (isEdit = false) => (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        label="Codigo interno"
        value={form.internalCode}
        onChange={(event) => updateForm("internalCode", normalizePrefixedCode(event.target.value, "USR"))}
        helperText="Visible en tabla y busqueda. Si lo dejas vacio, el sistema genera uno."
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
        <TextField
          label="Nombre"
          value={form.firstName}
          onChange={(event) => updateForm("firstName", event.target.value)}
          required
        />
        <TextField
          label="Apellido"
          value={form.lastName}
          onChange={(event) => updateForm("lastName", event.target.value)}
          required
        />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
        <TextField
          label="Cedula"
          value={form.documentNumber}
          onChange={(event) => updateForm("documentNumber", event.target.value.replace(/\D/g, ""))}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          required
        />
        <TextField
          label="Correo"
          type="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
        />
      </Box>

      <TextField
        label="Telefono"
        value={form.phone}
        onChange={(event) => updateForm("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
        inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
        helperText="Opcional. Usa 10 digitos."
      />

      <TextField
        label="Direccion"
        value={form.address}
        onChange={(event) => updateForm("address", event.target.value)}
        multiline
        minRows={2}
      />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
        <TextField
          label="Fecha de nacimiento"
          type="date"
          value={form.birthDate}
          onChange={(event) => updateForm("birthDate", event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Usuario generado"
          value={generatedUsername || "Completa nombre, apellido y cedula"}
          helperText="Se forma con las 3 primeras letras del nombre, las 3 del apellido y los ultimos 3 digitos de la cedula."
          disabled
        />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
        <TextField
          label={isEdit ? "Nueva contrasena (opcional)" : "Contrasena"}
          type="password"
          value={form.newPassword}
          onChange={(event) => updateForm("newPassword", event.target.value)}
          required={!isEdit}
        />
        <TextField
          select
          label="Rol y permisos"
        value={form.roleProfileId}
        onChange={(event) => updateForm("roleProfileId", event.target.value)}
        helperText="Administrador y Empleado tambien salen como perfiles del sistema."
        required
        >
          {availableRoleProfiles.map((entry) => (
            <MenuItem key={entry.id} value={entry.id}>
              {entry.name}
              {entry.isSystem ? " (sistema)" : ""}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={form.isActive}
            onChange={(_, checked) => updateForm("isActive", checked)}
          />
        }
        label={form.isActive ? "Usuario activo" : "Usuario inactivo"}
      />
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Usuarios</Typography>
          <HelpHint title="Administra empleados y administradores con código interno, rol, estado y trazabilidad de acceso." />
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {canViewRoles ? (
            <Button variant="outlined" onClick={() => navigate("/admin/roles?role=ADMIN")}>
              Ver roles
            </Button>
          ) : null}
          {canCreateUsers ? (
            <Button variant="contained" onClick={openCreateDialog}>
              Crear usuario
            </Button>
          ) : null}
        </Stack>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Usuarios activos</Typography>
            <Typography variant="h5">{activeCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Administradores</Typography>
            <Typography variant="h5">{adminCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Empleados</Typography>
            <Typography variant="h5">{employeeCount}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Buscar usuario"
            placeholder="Codigo, nombre, usuario, cedula, correo, telefono o rol"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <Alert severity="info">Cargando usuarios...</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Codigo</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Cedula</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Perfil</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Sesiones</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersPagination.paginatedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.name || "Sin nombre"}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={row.internalCode || "Sin codigo"} variant="outlined" />
                          {row.internalCode ? (
                            <IconButton onClick={() => void handleCopyCode(row.internalCode)} size="small">
                              <ContentCopyOutlinedIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{row.documentNumber || "No registrada"}</TableCell>
                      <TableCell>{row.email || "No registrado"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={rolLabel(row.role)} color={row.role === "ADMIN" ? "primary" : "default"} />
                      </TableCell>
                      <TableCell>{row.roleProfileName || "Sin perfil"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.isActive ? "Activo" : "Inactivo"} color={row.isActive ? "success" : "default"} />
                      </TableCell>
                      <TableCell align="right">{row.salesCount}</TableCell>
                      <TableCell align="right">{row.sessionsCount}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver detalle">
                          <IconButton onClick={() => setDetailUser(row)} size="small">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar usuario">
                          <span>
                            <IconButton onClick={() => openEditDialog(row)} size="small" disabled={!canEditUsers}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">No hay usuarios para mostrar.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredUsers.length}
                page={usersPagination.page}
                onPageChange={usersPagination.handleChangePage}
                rowsPerPage={usersPagination.rowsPerPage}
                onRowsPerPageChange={usersPagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15]}
                labelRowsPerPage="Filas"
              />
            </Box>
          )}
        </Stack>
      </Card>

      <Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="md">
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent>{renderUserForm()}</DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleCreate()}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingUser)} onClose={closeEditDialog} fullWidth maxWidth="md">
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent>{renderUserForm(true)}</DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleUpdate()}>Guardar cambios</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailUser)} onClose={() => setDetailUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle del usuario</DialogTitle>
        <DialogContent>
          {detailUser ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Nombre completo" value={detailUser.name || "Sin nombre"} disabled />
                <TextField label="Usuario" value={detailUser.username} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Codigo interno" value={detailUser.internalCode || "Sin codigo"} disabled />
                <TextField label="Cedula" value={formatOptionalValue(detailUser.documentNumber)} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Correo" value={formatOptionalValue(detailUser.email)} disabled />
                <TextField label="Telefono" value={formatOptionalValue(detailUser.phone)} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Direccion" value={formatOptionalValue(detailUser.address)} disabled multiline minRows={2} />
                <TextField label="Fecha de registro" value={new Date(detailUser.createdAt).toLocaleString("es-CO")} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Fecha de nacimiento" value={formatOptionalValue(detailUser.birthDate)} disabled />
                <TextField label="Perfil de rol" value={detailUser.roleProfileName || "Sin perfil"} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Rol" value={rolLabel(detailUser.role)} disabled />
                <TextField label="Estado" value={detailUser.isActive ? "Activo" : "Inactivo"} disabled />
              </Box>

              <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                <TextField label="Ventas registradas" value={String(detailUser.salesCount)} disabled />
                <TextField label="Sesiones registradas" value={String(detailUser.sessionsCount)} disabled />
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailUser(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default UserView;
