import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import FloatingAlert from "@/components/feedback/FloatingAlert";

export default function ProfileView() {
  const { user, login } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setUsername(user.username ?? "");
  }, [user]);

  const canSave = useMemo(() => {
    return username.trim().length > 0 && name.trim().length > 0;
  }, [username, name]);

  const handleSave = async () => {
    setMsg(null);
    if (!user) return;

    try {
      setSaving(true);

      // TODO: cuando tengas IPC:
      // const res = await window.api.account.updateProfile({ name, email });
      // if (!res.success) throw new Error(res.message);

      // Por ahora actualiza local (UI)
      login({
        ...user,
        name: name.trim(),
        username: username.trim(),
        // El tipo AuthUser actual no expone email, asi que se mantiene solo en la UI local.
      });

      setMsg({ type: "success", text: "Perfil actualizado." });
    } catch (error) {
      setMsg({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo actualizar el perfil.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Mi perfil
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Actualiza tu información básica. (Por ahora esto es UI; luego conectamos a la DB.)
      </Typography>

      <Card sx={{ mt: 2, borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <FloatingAlert
              feedback={msg ? { severity: msg.type, message: msg.text } : null}
              onClose={() => setMsg(null)}
            />

            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoComplete="name"
            />

            <TextField
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoComplete="username"
              helperText="Idealmente no cambies esto sin una regla de negocio. Puedes bloquearlo después."
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                Guardar cambios
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
