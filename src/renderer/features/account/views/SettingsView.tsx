import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";
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
  receiptFooter: string;
};

const initialForm: SettingsForm = {
  businessName: "",
  taxId: "",
  address: "",
  city: "",
  themeMode: "LIGHT",
  invoicePrefix: "FV",
  defaultTaxRate: 0.19,
  allowNegativeStock: false,
  receiptFooter: "",
};

export default function SettingsView() {
  const { themeMode, setThemeMode } = useAppThemeMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
          themeMode,
          invoicePrefix: response.settings.invoicePrefix || "FV",
          defaultTaxRate: Number(response.settings.defaultTaxRate ?? 0.19),
          allowNegativeStock: Boolean(response.settings.allowNegativeStock),
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

  useEffect(() => {
    setForm((current) => ({ ...current, themeMode }));
  }, [themeMode]);

  function updateField<K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await window.api.updateBusinessSettings({
        businessName: form.businessName.trim(),
        taxId: form.taxId.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
        defaultTaxRate: Number(form.defaultTaxRate || 0),
        allowNegativeStock: form.allowNegativeStock,
        receiptFooter: form.receiptFooter.trim(),
      });

      if (!response.success) {
        setMessage({
          type: "error",
          text: response.message || "No se pudo guardar la configuracion general.",
        });
        return;
      }

      setThemeMode(form.themeMode);
      setMessage({
        type: "success",
        text: "Configuracion general guardada correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la configuracion general.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Configuracion general</Typography>
          <HelpHint title="Define la apariencia general del sistema y los datos principales del negocio." />
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
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1fr 1fr" }} gap={2}>
          <Card sx={{ gridColumn: { xs: "auto", xl: "1 / span 2" } }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6">Tema del sistema</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Selecciona solo uno de los dos temas disponibles: claro u oscuro.
                  </Typography>
                </Box>

                <ToggleButtonGroup
                  exclusive
                  value={form.themeMode}
                  onChange={(_event, nextValue: "LIGHT" | "DARK" | null) => {
                    if (!nextValue) return;
                    updateField("themeMode", nextValue);
                    setThemeMode(nextValue);
                  }}
                  color="primary"
                  sx={{ alignSelf: "flex-start" }}
                >
                  <ToggleButton value="LIGHT">Claro</ToggleButton>
                  <ToggleButton value="DARK">Oscuro</ToggleButton>
                </ToggleButtonGroup>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
                  <Card
                    variant={form.themeMode === "LIGHT" ? "elevation" : "outlined"}
                    sx={{
                      background: "#fffdfa",
                      color: "#1f1a17",
                      borderColor: form.themeMode === "LIGHT" ? "#79bb37" : "rgba(31, 26, 23, 0.08)",
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography fontWeight={800}>Tema claro</Typography>
                        <Typography variant="body2" sx={{ color: "#6f675f" }}>
                          Fondo cálido, tarjetas claras y el mismo acento verde del sistema.
                        </Typography>
                        <Box sx={{ height: 12, borderRadius: 999, bgcolor: "#79bb37", width: "42%" }} />
                        <Box sx={{ height: 58, borderRadius: 3, bgcolor: "#f5efe8", border: "1px solid rgba(31, 26, 23, 0.08)" }} />
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card
                    variant={form.themeMode === "DARK" ? "elevation" : "outlined"}
                    sx={{
                      background: "#1b1714",
                      color: "#f7f2ea",
                      borderColor: form.themeMode === "DARK" ? "#8bd74b" : "rgba(247, 242, 234, 0.08)",
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography fontWeight={800}>Tema oscuro</Typography>
                        <Typography variant="body2" sx={{ color: "#bdb4a8" }}>
                          Base oscura con contraste suave y verde luminoso inspirado en la referencia.
                        </Typography>
                        <Box sx={{ height: 12, borderRadius: 999, bgcolor: "#8bd74b", width: "42%" }} />
                        <Box sx={{ height: 58, borderRadius: 3, bgcolor: "#120f0d", border: "1px solid rgba(247, 242, 234, 0.08)" }} />
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Datos del negocio</Typography>
                <TextField
                  label="Nombre del negocio"
                  value={form.businessName}
                  onChange={(event) => updateField("businessName", event.target.value)}
                  fullWidth
                />
                <TextField
                  label="NIT"
                  value={form.taxId}
                  onChange={(event) => updateField("taxId", event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Direccion"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Ciudad"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  fullWidth
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Factura e inventario</Typography>
                <TextField
                  label="Prefijo de factura"
                  value={form.invoicePrefix}
                  onChange={(event) => updateField("invoicePrefix", event.target.value.toUpperCase())}
                  helperText="Ejemplo: FV"
                />
                <TextField
                  label="IVA general"
                  type="number"
                  value={form.defaultTaxRate}
                  onChange={(event) => updateField("defaultTaxRate", Number(event.target.value))}
                  inputProps={{ min: 0, max: 1, step: 0.01 }}
                  helperText="Usa 0.19 para IVA del 19%"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.allowNegativeStock}
                      onChange={(event) => updateField("allowNegativeStock", event.target.checked)}
                    />
                  }
                  label="Permitir vender sin stock"
                />
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ gridColumn: { xs: "auto", xl: "1 / span 2" } }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Pie de factura</Typography>
                <TextField
                  label="Mensaje final"
                  multiline
                  minRows={4}
                  value={form.receiptFooter}
                  onChange={(event) => updateField("receiptFooter", event.target.value)}
                  helperText="Este texto aparecerá al final de la factura impresa."
                  fullWidth
                />
                <Box>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar configuracion"}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Stack>
  );
}
