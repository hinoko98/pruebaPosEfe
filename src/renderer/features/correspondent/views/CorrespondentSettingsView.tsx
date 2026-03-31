import { useEffect, useMemo, useState } from "react";

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

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import { CorrespondentModuleNav } from "@/features/correspondent/components/CorrespondentModuleNav";
import type { CorrespondentDirection, CorrespondentPlatform, CorrespondentType } from "@/features/correspondent/types";
import { formatDateTime } from "@/features/correspondent/utils";
import { useTablePagination } from "@/hooks/useTablePagination";

type FeedbackState = { severity: "success" | "error" | "info"; message: string } | null;

type PlatformFormState = {
  platformId?: string;
  name: string;
};

type TypeFormState = {
  typeId?: string;
  platformId: string;
  platformName: string;
  name: string;
  direction: "IN" | "OUT";
};

type DeleteTarget =
  | { kind: "platform"; id: string; label: string }
  | { kind: "type"; id: string; label: string };

const emptyPlatformForm: PlatformFormState = {
  name: "",
};

const emptyTypeForm: TypeFormState = {
  platformId: "",
  platformName: "",
  name: "",
  direction: "IN",
};

export default function CorrespondentSettingsView() {
  const [platforms, setPlatforms] = useState<CorrespondentPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [newPlatform, setNewPlatform] = useState<PlatformFormState>(emptyPlatformForm);
  const [newType, setNewType] = useState<TypeFormState>(emptyTypeForm);
  const [viewPlatform, setViewPlatform] = useState<CorrespondentPlatform | null>(null);
  const [editPlatform, setEditPlatform] = useState<PlatformFormState | null>(null);
  const [viewType, setViewType] = useState<{ platform: CorrespondentPlatform; type: CorrespondentType; index: number } | null>(null);
  const [editType, setEditType] = useState<TypeFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const sortedPlatforms = useMemo(
    () => [...platforms].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [platforms]
  );

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoading(true);
    try {
      const response = await window.api.getCorrespondentCatalog();
      if (!response.success) {
        throw new Error(response.message || "No se pudo cargar la configuracion");
      }

      setPlatforms(response.platforms);
      setNewType((current) => ({
        ...current,
        platformId: current.platformId || response.platforms[0]?.id || "",
        platformName: current.platformName || response.platforms[0]?.name || "",
      }));
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la configuracion",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlatform() {
    setSaving(true);
    try {
      const response = await window.api.createCorrespondentPlatform({
        name: newPlatform.name,
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo crear el corresponsal" });
        return;
      }

      setFeedback({ severity: "success", message: "Corresponsal creado correctamente." });
      setNewPlatform(emptyPlatformForm);
      await loadCatalog();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePlatform() {
    if (!editPlatform?.platformId) return;

    const currentPlatform = platforms.find((platform) => platform.id === editPlatform.platformId);
    if (!currentPlatform) return;

    setSaving(true);
    try {
      const response = await window.api.updateCorrespondentPlatform({
        platformId: editPlatform.platformId,
        name: editPlatform.name,
        requiresEvidence: currentPlatform.requiresEvidence,
        supportsOcr: currentPlatform.supportsOcr,
        supportsFileImport: currentPlatform.supportsFileImport,
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo actualizar el corresponsal" });
        return;
      }

      setFeedback({ severity: "success", message: "Corresponsal actualizado correctamente." });
      setEditPlatform(null);
      await loadCatalog();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateType() {
    setSaving(true);
    try {
      const response = await window.api.createCorrespondentTransactionType({
        platformId: newType.platformId,
        name: newType.name,
        direction: newType.direction,
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo crear el tipo" });
        return;
      }

      setFeedback({ severity: "success", message: "Tipo agregado correctamente." });
      setNewType((current) => ({ ...emptyTypeForm, platformId: current.platformId, platformName: current.platformName }));
      await loadCatalog();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateType() {
    if (!editType?.typeId) return;

    setSaving(true);
    try {
      const response = await window.api.updateCorrespondentTransactionType({
        typeId: editType.typeId,
        name: editType.name,
        direction: editType.direction,
      });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo actualizar el tipo" });
        return;
      }

      setFeedback({ severity: "success", message: "Tipo actualizado correctamente." });
      setEditType(null);
      await loadCatalog();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      const response =
        deleteTarget.kind === "platform"
          ? await window.api.deleteCorrespondentPlatform({ platformId: deleteTarget.id })
          : await window.api.deleteCorrespondentTransactionType({ typeId: deleteTarget.id });

      if (!response.success) {
        setFeedback({ severity: "error", message: response.message || "No se pudo eliminar" });
        return;
      }

      setFeedback({
        severity: "success",
        message: deleteTarget.kind === "platform" ? "Corresponsal eliminado correctamente." : "Tipo eliminado correctamente.",
      });
      setDeleteTarget(null);
      await loadCatalog();
    } finally {
      setSaving(false);
    }
  }

  function openPlatformEdit(platform: CorrespondentPlatform) {
    setEditPlatform({
      platformId: platform.id,
      name: platform.name,
    });
  }

  function openTypeEdit(platform: CorrespondentPlatform, type: CorrespondentType) {
    setEditType({
      typeId: type.id,
      platformId: platform.id,
      platformName: platform.name,
      name: type.name,
      direction: type.direction === "OUT" ? "OUT" : "IN",
    });
  }

  function renderDirection(direction: CorrespondentDirection) {
    if (direction === "OUT") return "Salida";
    return "Entrada";
  }

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
              <Typography variant="h5">Configuracion de corresponsales</Typography>
              <Typography variant="body2" color="text.secondary">
                Gestiona corresponsales y tipos desde tablas limpias. La auditoria completa queda dentro del boton ver.
              </Typography>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "repeat(2, 1fr)" }} gap={2}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">Nuevo corresponsal</Typography>
                    <TextField
                      label="Nombre del corresponsal"
                      value={newPlatform.name}
                      onChange={(event) => setNewPlatform({ name: event.target.value })}
                      fullWidth
                    />
                    <Button variant="contained" onClick={() => void handleCreatePlatform()} disabled={saving}>
                      {saving ? "Guardando..." : "Agregar corresponsal"}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">Nuevo tipo por corresponsal</Typography>
                    <TextField
                      select
                      label="Corresponsal"
                      value={newType.platformId}
                      onChange={(event) => {
                        const nextPlatform = sortedPlatforms.find((platform) => platform.id === event.target.value);
                        setNewType((current) => ({
                          ...current,
                          platformId: event.target.value,
                          platformName: nextPlatform?.name ?? "",
                        }));
                      }}
                      fullWidth
                    >
                      {sortedPlatforms.map((platform) => (
                        <MenuItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Nombre del tipo"
                      value={newType.name}
                      onChange={(event) => setNewType((current) => ({ ...current, name: event.target.value }))}
                      fullWidth
                    />
                    <TextField
                      select
                      label="Naturaleza"
                      value={newType.direction}
                      onChange={(event) =>
                        setNewType((current) => ({
                          ...current,
                          direction: event.target.value as "IN" | "OUT",
                        }))
                      }
                      fullWidth
                    >
                      <MenuItem value="IN">Entrada</MenuItem>
                      <MenuItem value="OUT">Salida</MenuItem>
                    </TextField>
                    <Button variant="contained" onClick={() => void handleCreateType()} disabled={saving || !newType.platformId}>
                      {saving ? "Guardando..." : "Agregar tipo"}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {sortedPlatforms.map((platform) => (
          <Card key={platform.id}>
            <CardContent>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
                  <Box>
                    <Typography variant="h6">{platform.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {platform.types.length} tipos configurados
                    </Typography>
                  </Box>

                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setViewPlatform(platform)}>
                      Ver
                    </Button>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openPlatformEdit(platform)}>
                      Editar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteTarget({ kind: "platform", id: platform.id, label: platform.name })}
                    >
                      Eliminar
                    </Button>
                  </Box>
                </Box>

                <PlatformTypesTable
                  platform={platform}
                  onViewType={(type, index) => setViewType({ platform, type, index })}
                  onEditType={(type) => openTypeEdit(platform, type)}
                  onDeleteType={(type) =>
                    setDeleteTarget({ kind: "type", id: type.id, label: `${platform.name} - ${type.name}` })
                  }
                  renderDirection={renderDirection}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={Boolean(viewPlatform)} onClose={() => setViewPlatform(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle del corresponsal</DialogTitle>
        <DialogContent>
          {viewPlatform ? (
            <Stack spacing={2} pt={1}>
              <TextField label="Nombre" value={viewPlatform.name} InputProps={{ readOnly: true }} />
              <TextField label="Codigo" value={viewPlatform.code} InputProps={{ readOnly: true }} />
              <TextField label="Creado el" value={formatDateTime(viewPlatform.createdAt)} InputProps={{ readOnly: true }} />
              <TextField label="Creado por" value={viewPlatform.createdBy ?? "No disponible"} InputProps={{ readOnly: true }} />
              <TextField label="Modificado el" value={formatDateTime(viewPlatform.updatedAt)} InputProps={{ readOnly: true }} />
              <TextField
                label="Modificado por"
                value={viewPlatform.updatedBy ?? viewPlatform.createdBy ?? "No disponible"}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPlatform(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editPlatform)} onClose={() => setEditPlatform(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar corresponsal</DialogTitle>
        <DialogContent>
          {editPlatform ? (
            <Stack spacing={2} pt={1}>
              <TextField
                label="Nombre"
                value={editPlatform.name}
                onChange={(event) =>
                  setEditPlatform((current) => (current ? { ...current, name: event.target.value } : current))
                }
                fullWidth
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPlatform(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleUpdatePlatform()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(viewType)} onClose={() => setViewType(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle del tipo</DialogTitle>
        <DialogContent>
          {viewType ? (
            <Stack spacing={2} pt={1}>
              <TextField label="Item #" value={String(viewType.index)} InputProps={{ readOnly: true }} />
              <TextField label="Corresponsal" value={viewType.platform.name} InputProps={{ readOnly: true }} />
              <TextField label="Tipo" value={viewType.type.name} InputProps={{ readOnly: true }} />
              <TextField label="Naturaleza" value={renderDirection(viewType.type.direction)} InputProps={{ readOnly: true }} />
              <TextField label="Creado el" value={formatDateTime(viewType.type.createdAt)} InputProps={{ readOnly: true }} />
              <TextField label="Creado por" value={viewType.type.createdBy ?? "No disponible"} InputProps={{ readOnly: true }} />
              <TextField label="Modificado el" value={formatDateTime(viewType.type.updatedAt)} InputProps={{ readOnly: true }} />
              <TextField
                label="Modificado por"
                value={viewType.type.updatedBy ?? viewType.type.createdBy ?? "No disponible"}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewType(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editType)} onClose={() => setEditType(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar tipo</DialogTitle>
        <DialogContent>
          {editType ? (
            <Stack spacing={2} pt={1}>
              <TextField label="Corresponsal" value={editType.platformName} InputProps={{ readOnly: true }} />
              <TextField
                label="Nombre del tipo"
                value={editType.name}
                onChange={(event) =>
                  setEditType((current) => (current ? { ...current, name: event.target.value } : current))
                }
                fullWidth
              />
              <TextField
                select
                label="Naturaleza"
                value={editType.direction}
                onChange={(event) =>
                  setEditType((current) =>
                    current ? { ...current, direction: event.target.value as "IN" | "OUT" } : current
                  )
                }
                fullWidth
              >
                <MenuItem value="IN">Entrada</MenuItem>
                <MenuItem value="OUT">Salida</MenuItem>
              </TextField>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditType(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleUpdateType()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Confirmar eliminacion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Vas a eliminar {deleteTarget?.label}. Esta accion lo ocultara del catalogo activo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={saving}>
            {saving ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function PlatformTypesTable({
  platform,
  onViewType,
  onEditType,
  onDeleteType,
  renderDirection,
}: {
  platform: CorrespondentPlatform;
  onViewType: (type: CorrespondentType, index: number) => void;
  onEditType: (type: CorrespondentType) => void;
  onDeleteType: (type: CorrespondentType) => void;
  renderDirection: (direction: CorrespondentDirection) => string;
}) {
  const pagination = useTablePagination(platform.types);

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={60}>#</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Naturaleza</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pagination.paginatedRows.map((type, index) => {
            const itemIndex = pagination.page * pagination.rowsPerPage + index + 1;
            return (
              <TableRow key={type.id} hover>
                <TableCell>{itemIndex}</TableCell>
                <TableCell>{type.name}</TableCell>
                <TableCell>{renderDirection(type.direction)}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => onViewType(type, itemIndex)}>
                    <VisibilityIcon />
                  </IconButton>
                  <IconButton onClick={() => onEditType(type)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => onDeleteType(type)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
          {platform.types.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                No hay tipos registrados para este corresponsal.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={platform.types.length}
        page={pagination.page}
        onPageChange={pagination.handleChangePage}
        rowsPerPage={pagination.rowsPerPage}
        onRowsPerPageChange={pagination.handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 15]}
        labelRowsPerPage="Filas"
      />
    </Box>
  );
}
