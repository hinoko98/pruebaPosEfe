import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { useAppThemeMode } from "@/theme/AppThemeProvider";

type SettingsForm = {
  businessName: string;
  taxId: string;
  address: string;
  city: string;
  themeMode: "LIGHT" | "DARK";
  invoicePrefix: string;
  defaultTaxRate: number;
  allowNegativeStock: boolean;
  defaultReceiptTemplate: "NORMAL" | "THERMAL_80" | "THERMAL_50";
  receiptFooter: string;
};

type SavingSection = "theme" | "business" | "billing" | "inventory" | null;

const initialForm: SettingsForm = {
  businessName: "",
  taxId: "",
  address: "",
  city: "",
  themeMode: "LIGHT",
  invoicePrefix: "FV",
  defaultTaxRate: 0.19,
  allowNegativeStock: false,
  defaultReceiptTemplate: "NORMAL",
  receiptFooter: "",
};

export default function SettingsView() {
  const { user } = useAuth();
  const { setThemeMode } = useAppThemeMode();
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SavingSection>(null);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canEditTheme = hasPermission(user, APP_PERMISSION_KEYS.settingsTheme);
  const canEditBusiness = hasPermission(user, APP_PERMISSION_KEYS.settingsBusiness);
  const canEditBilling = hasPermission(user, APP_PERMISSION_KEYS.settingsBilling);
  const canEditInventory = hasPermission(user, APP_PERMISSION_KEYS.settingsInventory);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setMessage(null);

      try {
        const response = await window.api.getBusinessSettings();
        if (!active) return;

        if (!response.success || !response.settings) {
          setMessage({
            type: "error",
            text: response.message || "No se pudo cargar la configuracion general.",
          });
          return;
        }

        setForm({
          businessName: response.settings.businessName || "",
          taxId: response.settings.taxId || "",
          address: response.settings.address || "",
          city: response.settings.city || "",
          themeMode: response.settings.themeMode === "DARK" ? "DARK" : "LIGHT",
          invoicePrefix: response.settings.invoicePrefix || "FV",
          defaultTaxRate: Number(response.settings.defaultTaxRate ?? 0.19),
          allowNegativeStock: Boolean(response.settings.allowNegativeStock),
          defaultReceiptTemplate: response.settings.defaultReceiptTemplate || "NORMAL",
          receiptFooter: response.settings.receiptFooter || "",
        });
      } catch (error) {
        if (!active) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo cargar la configuracion general.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTheme() {
    setSavingSection("theme");
    setMessage(null);

    try {
      const response = await window.api.updateSystemThemeSettings({
        themeMode: form.themeMode,
      });

      if (!response.success) {
        setMessage({
          type: "error",
          text: response.message || "No se pudo guardar el tema.",
        });
        return;
      }

      setThemeMode(form.themeMode);
      setMessage({
        type: "success",
        text: "Tema del sistema actualizado correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar el tema.",
      });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveBusiness() {
    setSavingSection("business");
    setMessage(null);

    try {
      const response = await window.api.updateBusinessIdentitySettings({
        businessName: form.businessName.trim(),
        taxId: form.taxId.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
      });

      if (!response.success) {
        setMessage({
          type: "error",
          text: response.message || "No se pudieron guardar los datos del negocio.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "Datos del negocio guardados correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudieron guardar los datos del negocio.",
      });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveBilling() {
    setSavingSection("billing");
    setMessage(null);

    try {
      const response = await window.api.updateBillingSettings({
        invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
        defaultReceiptTemplate: form.defaultReceiptTemplate,
        receiptFooter: form.receiptFooter.trim(),
      });

      if (!response.success) {
        setMessage({
          type: "error",
          text: response.message || "No se pudo guardar la configuracion de factura.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "Factura e impresion guardadas correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la configuracion de factura.",
      });
    } finally {
      setSavingSection(null);
    }
  }

  async function saveInventory() {
    setSavingSection("inventory");
    setMessage(null);

    try {
      const response = await window.api.updateInventorySettings({
        defaultTaxRate: Number(form.defaultTaxRate || 0),
        allowNegativeStock: form.allowNegativeStock,
      });

      if (!response.success) {
        setMessage({
          type: "error",
          text: response.message || "No se pudo guardar la configuracion operativa.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "Inventario y operacion guardados correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la configuracion operativa.",
      });
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Configuracion general</Typography>
          <HelpHint title="Cada bloque se guarda por separado y respeta los permisos del rol asignado a esta interfaz." />
        </Box>
      </Box>

      <FloatingAlert
        feedback={message ? { severity: message.type, message: message.text } : null}
        onClose={() => setMessage(null)}
      />

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <>
          {!canEditTheme && !canEditBusiness && !canEditBilling && !canEditInventory ? (
            <Alert severity="info">
              Tienes acceso a esta interfaz, pero este rol no tiene permisos de edicion sobre los bloques disponibles.
            </Alert>
          ) : null}

          <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1fr 1fr" }} gap={2}>
            <Card>
              <CardContent>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="h6">Tema del sistema</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Solo quedan dos opciones de apariencia: claro y oscuro.
                    </Typography>
                  </Box>

                  <ToggleButtonGroup
                    exclusive
                    value={form.themeMode}
                    onChange={(_event, nextValue: "LIGHT" | "DARK" | null) => {
                      if (!nextValue) return;
                      updateField("themeMode", nextValue);
                    }}
                    color="primary"
                    disabled={!canEditTheme}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    <ToggleButton value="LIGHT">Claro</ToggleButton>
                    <ToggleButton value="DARK">Oscuro</ToggleButton>
                  </ToggleButtonGroup>

                  <Box>
                    <Button
                      variant="contained"
                      onClick={() => void saveTheme()}
                      disabled={!canEditTheme || savingSection === "theme"}
                    >
                      {savingSection === "theme" ? "Guardando..." : "Guardar tema"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">Datos del negocio</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nombre comercial, NIT y ubicacion principal.
                    </Typography>
                  </Box>

                  <TextField
                    label="Nombre del negocio"
                    value={form.businessName}
                    onChange={(event) => updateField("businessName", event.target.value)}
                    fullWidth
                    disabled={!canEditBusiness}
                  />
                  <TextField
                    label="NIT"
                    value={form.taxId}
                    onChange={(event) => updateField("taxId", event.target.value)}
                    fullWidth
                    disabled={!canEditBusiness}
                  />
                  <TextField
                    label="Direccion"
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    fullWidth
                    disabled={!canEditBusiness}
                  />
                  <TextField
                    label="Ciudad"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    fullWidth
                    disabled={!canEditBusiness}
                  />

                  <Box>
                    <Button
                      variant="contained"
                      onClick={() => void saveBusiness()}
                      disabled={!canEditBusiness || savingSection === "business"}
                    >
                      {savingSection === "business" ? "Guardando..." : "Guardar negocio"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">Factura e impresion</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Prefijo, pie de factura y formato de impresion predeterminado.
                    </Typography>
                  </Box>

                  <TextField
                    label="Prefijo de factura"
                    value={form.invoicePrefix}
                    onChange={(event) => updateField("invoicePrefix", event.target.value.toUpperCase())}
                    helperText="Ejemplo: FV"
                    disabled={!canEditBilling}
                  />
                  <TextField
                    select
                    label="Formato predeterminado"
                    value={form.defaultReceiptTemplate}
                    onChange={(event) =>
                      updateField("defaultReceiptTemplate", event.target.value as SettingsForm["defaultReceiptTemplate"])
                    }
                    disabled={!canEditBilling}
                  >
                    <MenuItem value="NORMAL">Impresora normal</MenuItem>
                    <MenuItem value="THERMAL_80">Termica 80 mm</MenuItem>
                    <MenuItem value="THERMAL_50">Termica 50 mm</MenuItem>
                  </TextField>
                  <TextField
                    label="Pie de factura"
                    multiline
                    minRows={4}
                    value={form.receiptFooter}
                    onChange={(event) => updateField("receiptFooter", event.target.value)}
                    helperText="Se usa como texto final en la factura impresa."
                    fullWidth
                    disabled={!canEditBilling}
                  />

                  <Box>
                    <Button
                      variant="contained"
                      onClick={() => void saveBilling()}
                      disabled={!canEditBilling || savingSection === "billing"}
                    >
                      {savingSection === "billing" ? "Guardando..." : "Guardar factura"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">Inventario y operacion</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reglas generales para impuestos base y manejo de stock.
                    </Typography>
                  </Box>

                  <TextField
                    label="IVA general"
                    type="number"
                    value={form.defaultTaxRate}
                    onChange={(event) => updateField("defaultTaxRate", Number(event.target.value))}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    helperText="Usa 0.19 para IVA del 19%"
                    disabled={!canEditInventory}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.allowNegativeStock}
                        onChange={(event) => updateField("allowNegativeStock", event.target.checked)}
                        disabled={!canEditInventory}
                      />
                    }
                    label="Permitir vender sin stock"
                  />

                  <Box>
                    <Button
                      variant="contained"
                      onClick={() => void saveInventory()}
                      disabled={!canEditInventory || savingSection === "inventory"}
                    >
                      {savingSection === "inventory" ? "Guardando..." : "Guardar inventario"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Stack>
  );
}
