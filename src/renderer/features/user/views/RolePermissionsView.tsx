import { useEffect, useMemo, useState } from "react";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import Alert from "@mui/material/Alert";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import {
  flattenRolePermissionCatalog,
  getRoleDefinition,
  ROLE_DEFINITIONS,
  type AppRoleKey,
} from "../roles.catalog";

type RoleProfile = Awaited<ReturnType<typeof window.api.listRoleProfiles>>["roles"][number];
type RoleDraft = {
  id?: string;
  name: string;
  description: string;
  baseRole: AppRoleKey;
  isActive: boolean;
  permissionKeys: string[];
};

const emptyDraft: RoleDraft = {
  name: "",
  description: "",
  baseRole: "EMPLOYEE",
  isActive: true,
  permissionKeys: [],
};

export function RolePermissionsView() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [activeSection, setActiveSection] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [draftRole, setDraftRole] = useState<RoleDraft | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<RoleDraft>(emptyDraft);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const loadRoles = async (preferredRoleId?: string) => {
    setLoading(true);
    const response = await window.api.listRoleProfiles();
    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudieron cargar los roles" });
      setLoading(false);
      return;
    }

    setRoles(response.roles);
    const nextSelected =
      preferredRoleId && response.roles.some((role) => role.id === preferredRoleId)
        ? preferredRoleId
        : response.roles[0]?.id ?? "";
    setSelectedRoleId(nextSelected);
    setLoading(false);
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
  const selectedDefinition = getRoleDefinition((selectedRole?.baseRole as AppRoleKey | undefined) ?? "ADMIN");
  const permissionCatalog = useMemo(() => flattenRolePermissionCatalog(selectedDefinition), [selectedDefinition]);

  const effectivePermissionKeys = useMemo(() => {
    if (editMode && draftRole) return draftRole.permissionKeys;
    return selectedRole?.permissionKeys ?? [];
  }, [draftRole, editMode, selectedRole]);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const allowedPermissionKeys = new Set(effectivePermissionKeys);
    const visibleCatalog = permissionCatalog.filter((item) =>
      !normalizedQuery
        ? true
        : [item.sectionTitle, item.groupTitle, item.label].join(" ").toLowerCase().includes(normalizedQuery)
    );

    return selectedDefinition.sections
      .map((section) => ({
        ...section,
        groups: section.groups
          .map((group) => ({
            ...group,
            permissions: visibleCatalog.filter(
              (item) => item.sectionTitle === section.title && item.groupTitle === group.title
            ),
          }))
          .filter((group) => group.permissions.length > 0),
      }))
      .filter((section) => section.groups.length > 0)
      .map((section) => ({
        ...section,
        groups: section.groups.map((group) => ({
          ...group,
          permissions: group.permissions.map((permission) => ({
            ...permission,
            checked: allowedPermissionKeys.has(permission.key),
          })),
        })),
      }));
  }, [effectivePermissionKeys, permissionCatalog, query, selectedDefinition.sections]);

  useEffect(() => {
    if (activeSection >= filteredSections.length) {
      setActiveSection(0);
    }
  }, [activeSection, filteredSections.length]);

  const activeSectionData = filteredSections[activeSection] ?? filteredSections[0] ?? null;
  const canManageRoles = hasPermission(user, APP_PERMISSION_KEYS.rolesManage);

  const startEditing = () => {
    if (!selectedRole) return;
    setDraftRole({
      id: selectedRole.id,
      name: selectedRole.name,
      description: selectedRole.description ?? "",
      baseRole: selectedRole.baseRole as AppRoleKey,
      isActive: selectedRole.isActive,
      permissionKeys: selectedRole.permissionKeys,
    });
    setEditMode(true);
  };

  const cancelEditing = () => {
    setEditMode(false);
    setDraftRole(null);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreateDraft(emptyDraft);
  };

  const toggleDraftPermission = (permissionKey: string) => {
    if (!draftRole) return;
    const exists = draftRole.permissionKeys.includes(permissionKey);
    setDraftRole({
      ...draftRole,
      permissionKeys: exists
        ? draftRole.permissionKeys.filter((item) => item !== permissionKey)
        : [...draftRole.permissionKeys, permissionKey],
    });
  };

  const toggleEditGroupPermissions = (
    group: { permissions: Array<{ key: string }> },
    checked: boolean
  ) => {
    if (!draftRole) return;
    const groupKeys = group.permissions.map((permission) => permission.key);
    const nextPermissionKeys = checked
      ? Array.from(new Set([...draftRole.permissionKeys, ...groupKeys]))
      : draftRole.permissionKeys.filter((permissionKey) => !groupKeys.includes(permissionKey));

    setDraftRole({
      ...draftRole,
      permissionKeys: nextPermissionKeys,
    });
  };

  const toggleCreateGroupPermissions = (
    group: { permissions: Array<{ key: string }> },
    checked: boolean
  ) => {
    const groupKeys = group.permissions.map((permission) => permission.key);
    setCreateDraft((prev) => ({
      ...prev,
      permissionKeys: checked
        ? Array.from(new Set([...prev.permissionKeys, ...groupKeys]))
        : prev.permissionKeys.filter((permissionKey) => !groupKeys.includes(permissionKey)),
    }));
  };

  const saveRoleChanges = async () => {
    if (!draftRole?.id) return;

    const response = await window.api.updateRoleProfile({
      id: draftRole.id,
      name: draftRole.name,
      description: draftRole.description || null,
      permissionKeys: draftRole.permissionKeys,
      isActive: draftRole.isActive,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo guardar el rol" });
      return;
    }

    setFeedback({ severity: "success", message: "Rol actualizado correctamente." });
    setEditMode(false);
    setDraftRole(null);
    await loadRoles(draftRole.id);
  };

  const openCreateDialog = (source?: RoleProfile) => {
    if (source) {
      setCreateDraft({
        name: `${source.name} copia`,
        description: source.description ?? "",
        baseRole: source.baseRole as AppRoleKey,
        isActive: source.isActive,
        permissionKeys: source.permissionKeys,
      });
    } else {
      const baseRole: AppRoleKey = "EMPLOYEE";
      setCreateDraft({
        ...emptyDraft,
        baseRole,
        permissionKeys: flattenRolePermissionCatalog(getRoleDefinition(baseRole)).map((item) => item.key),
      });
    }
    setCreateOpen(true);
  };

  const createCatalog = useMemo(
    () => flattenRolePermissionCatalog(getRoleDefinition(createDraft.baseRole)),
    [createDraft.baseRole]
  );

  const createSections = useMemo(() => {
    const allowed = new Set(createDraft.permissionKeys);
    return getRoleDefinition(createDraft.baseRole).sections.map((section) => ({
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        permissions: createCatalog.filter(
          (item) => item.sectionTitle === section.title && item.groupTitle === group.title
        ),
      })),
      selectedCount: createCatalog.filter(
        (item) => item.sectionTitle === section.title && allowed.has(item.key)
      ).length,
    }));
  }, [createCatalog, createDraft.baseRole, createDraft.permissionKeys]);

  const saveNewRole = async () => {
    const response = await window.api.createRoleProfile({
      name: createDraft.name,
      description: createDraft.description || null,
      baseRole: createDraft.baseRole,
      permissionKeys: createDraft.permissionKeys,
      isActive: createDraft.isActive,
    });

    if (!response.success) {
      setFeedback({ severity: "error", message: response.message || "No se pudo crear el rol" });
      return;
    }

    setFeedback({ severity: "success", message: "Rol creado correctamente." });
    closeCreateDialog();
    await loadRoles(response.roleId);
  };

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Permisos del rol
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Administra perfiles de rol, sus permisos y la estructura base de acceso del sistema.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {canManageRoles ? (
            <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => openCreateDialog()}>
              Nuevo rol
            </Button>
          ) : null}
          {canManageRoles ? (
            <Button
              variant="outlined"
              startIcon={<ContentCopyOutlinedIcon />}
              onClick={() => selectedRole && openCreateDialog(selectedRole)}
              disabled={!selectedRole}
            >
              Duplicar
            </Button>
          ) : null}
          {editMode ? (
            <>
              <Button variant="outlined" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => void saveRoleChanges()}>
                Guardar
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<EditOutlinedIcon />}
              onClick={startEditing}
              disabled={!selectedRole || !canManageRoles}
            >
              Editar
            </Button>
          )}
        </Stack>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {loading ? (
        <Alert severity="info">Cargando roles y permisos...</Alert>
      ) : selectedRole ? (
        <>
          <Card>
            <CardContent>
              <Stack spacing={2.5}>
                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "320px 1fr" }} gap={2}>
                  <TextField
                    select
                    label="Nombre del rol"
                    value={selectedRole.id}
                    onChange={(event) => {
                      setSelectedRoleId(event.target.value);
                      cancelEditing();
                    }}
                  >
                    {roles.map((entry) => (
                      <MenuItem key={entry.id} value={entry.id}>
                        {entry.name}
                        {entry.isSystem ? " (sistema)" : ""}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Buscar permiso"
                    placeholder="Buscar por modulo, grupo o permiso"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </Box>

                {editMode && draftRole ? (
                  <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1.5fr 1fr 1fr" }} gap={2}>
                    <TextField
                      label="Nombre del rol"
                      value={draftRole.name}
                      onChange={(event) => setDraftRole({ ...draftRole, name: event.target.value })}
                    />
                    <TextField
                      label="Descripcion"
                      value={draftRole.description}
                      onChange={(event) => setDraftRole({ ...draftRole, description: event.target.value })}
                    />
                    <TextField
                      select
                      label="Estado"
                      value={draftRole.isActive ? "ACTIVE" : "INACTIVE"}
                      onChange={(event) =>
                        setDraftRole({ ...draftRole, isActive: event.target.value === "ACTIVE" })
                      }
                    >
                      <MenuItem value="ACTIVE">Activo</MenuItem>
                      <MenuItem value="INACTIVE">Inactivo</MenuItem>
                    </TextField>
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Tabs
                value={Math.min(activeSection, Math.max(filteredSections.length - 1, 0))}
                onChange={(_, value) => setActiveSection(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {filteredSections.map((section) => (
                  <Tab key={section.title} label={section.title} />
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {activeSectionData ? (
            <Stack spacing={2}>
              {activeSectionData.groups.map((group) => (
                <Accordion key={group.title} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
                      <Typography fontWeight={800}>{group.title}</Typography>
                      <Box display="flex" alignItems="center" gap={1} onClick={(event) => event.stopPropagation()}>
                        <Chip
                          size="small"
                          label={`${group.permissions.filter((permission) => permission.checked).length}/${group.permissions.length}`}
                        />
                        <Checkbox
                          checked={group.permissions.every((permission) => permission.checked)}
                          onChange={(_, checked) => toggleEditGroupPermissions(group, checked)}
                          disabled={!editMode}
                        />
                        <Typography variant="body2" fontWeight={700}>
                          Seleccionar todos
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={1}>
                      {group.permissions.map((permission) => (
                        <Box
                          key={permission.key}
                          display="flex"
                          alignItems="center"
                          gap={1}
                          sx={{
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 2,
                            bgcolor: permission.checked ? "#eefbf3" : "#f8fafc",
                            border: permission.checked ? "1px solid #b7ebc6" : "1px solid #e2e8f0",
                          }}
                        >
                          <Checkbox
                            checked={permission.checked}
                            onChange={() => toggleDraftPermission(permission.key)}
                            disabled={!editMode}
                          />
                          <Typography variant="body2">{permission.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          ) : (
            <Alert severity="warning">No encontramos permisos que coincidan con la busqueda actual.</Alert>
          )}
        </>
      ) : (
        <Alert severity="warning">Todavia no hay roles disponibles.</Alert>
      )}

      <Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="md">
        <DialogTitle>Crear nuevo rol</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
              <TextField
                label="Nombre del rol"
                value={createDraft.name}
                onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })}
              />
              <TextField
                select
                label="Rol base"
                value={createDraft.baseRole}
                onChange={(event) => {
                  const baseRole = event.target.value as AppRoleKey;
                  setCreateDraft({
                    ...createDraft,
                    baseRole,
                    permissionKeys: flattenRolePermissionCatalog(getRoleDefinition(baseRole)).map((item) => item.key),
                  });
                }}
              >
                {ROLE_DEFINITIONS.map((entry) => (
                  <MenuItem key={entry.key} value={entry.key}>
                    {entry.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1.6fr 0.8fr" }} gap={2}>
              <TextField
                label="Descripcion"
                value={createDraft.description}
                onChange={(event) => setCreateDraft({ ...createDraft, description: event.target.value })}
                multiline
                minRows={2}
              />
              <TextField
                select
                label="Estado"
                value={createDraft.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, isActive: event.target.value === "ACTIVE" }))
                }
              >
                <MenuItem value="ACTIVE">Activo</MenuItem>
                <MenuItem value="INACTIVE">Inactivo</MenuItem>
              </TextField>
            </Box>

            {createSections.map((section) => (
              <Accordion key={section.title} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
                    <Typography fontWeight={800}>{section.title}</Typography>
                    <Chip size="small" label={`${section.selectedCount} permisos`} />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {section.groups.map((group) => (
                      <Box key={group.title}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} sx={{ mb: 1 }}>
                          <Typography fontWeight={700}>{group.title}</Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Checkbox
                              checked={group.permissions.every((permission) =>
                                createDraft.permissionKeys.includes(permission.key)
                              )}
                              onChange={(_, checked) => toggleCreateGroupPermissions(group, checked)}
                            />
                            <Typography variant="body2" fontWeight={700}>
                              Seleccionar todos
                            </Typography>
                          </Box>
                        </Box>
                        <Box
                          display="grid"
                          gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
                          gap={1}
                        >
                          {group.permissions.map((permission) => (
                            <Box
                              key={permission.key}
                              display="flex"
                              alignItems="center"
                              gap={1}
                              sx={{
                                px: 1.25,
                                py: 0.75,
                                borderRadius: 2,
                                bgcolor: "#f8fafc",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <Checkbox
                                checked={createDraft.permissionKeys.includes(permission.key)}
                                onChange={() =>
                                  setCreateDraft((prev) => ({
                                    ...prev,
                                    permissionKeys: prev.permissionKeys.includes(permission.key)
                                      ? prev.permissionKeys.filter((item) => item !== permission.key)
                                      : [...prev.permissionKeys, permission.key],
                                  }))
                                }
                              />
                              <Typography variant="body2">{permission.label}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void saveNewRole()}
            disabled={!createDraft.name.trim() || createDraft.permissionKeys.length === 0}
          >
            Crear rol
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
