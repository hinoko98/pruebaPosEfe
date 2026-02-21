import { useState } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";

export default function SettingsView() {
  const [compactMode, setCompactMode] = useState(false);
  const [soundOnScan, setSoundOnScan] = useState(true);
  const [defaultPrinter, setDefaultPrinter] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setMsg(null);
    try {
      // TODO: Persistir (electron-store o DB)
      // await window.api.settings.save({ compactMode, soundOnScan, defaultPrinter })

      setMsg({ type: "success", text: "Configuración guardada." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "No se pudo guardar." });
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Configuraciones
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Preferencias de uso (usuario/caja). Luego lo conectamos a persistencia local.
      </Typography>

      <Card sx={{ mt: 2, borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            {msg ? <Alert severity={msg.type}>{msg.text}</Alert> : null}

            <FormControlLabel
              control={
                <Switch
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                />
              }
              label="Modo compacto (POS)"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={soundOnScan}
                  onChange={(e) => setSoundOnScan(e.target.checked)}
                />
              }
              label="Sonido al escanear código"
            />

            <TextField
              label="Impresora por defecto (opcional)"
              value={defaultPrinter}
              onChange={(e) => setDefaultPrinter(e.target.value)}
              fullWidth
              placeholder="Ej: 58mm-USB / EPSON-TM / etc."
              helperText="Luego lo conectamos con el módulo de impresión."
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}>
              <Button variant="contained" onClick={handleSave}>
                Guardar
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
