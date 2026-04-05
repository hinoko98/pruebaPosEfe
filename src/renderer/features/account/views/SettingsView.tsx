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
import Typography from "@mui/material/Typography";
import FloatingAlert from "@/components/feedback/FloatingAlert";
import HelpHint from "@/components/ui/HelpHint";

type SettingsForm = {
  businessName: string;
  taxId: string;
  address: string;
  city: string;
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
  invoicePrefix: "FV",
  defaultTaxRate: 0.19,
  allowNegativeStock: false,
  receiptFooter: "",
};

export default function SettingsView() {
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
            text: response.message || "No se pudo cargar la configuración general.",
          });
          return;
        }

        setForm({
          businessName: response.settings.businessName || "",
          taxId: response.settings.taxId || "",
          address: response.settings.address || "",
          city: response.settings.city || "",
          invoicePrefix: response.settings.invoicePrefix || "FV",
          defaultTaxRate: Number(response.settings.defaultTaxRate ?? 0.19),
          allowNegativeStock: Boolean(response.settings.allowNegativeStock),
          receiptFooter: response.settings.receiptFooter || "",
        });
      } catch (error) {
        if (!active) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo cargar la configuración general.",
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
          text: response.message || "No se pudo guardar la configuración general.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "Configuración general guardada correctamente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la configuración general.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4">Configuración general</Typography>
          <HelpHint title="Define los datos del negocio, facturación e inventario que usa el POS en la operación diaria." />
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
                  label="Dirección"
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
                    {saving ? "Guardando..." : "Guardar configuración"}
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
