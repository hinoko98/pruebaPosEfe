import { useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import FloatingAlert from "@/components/feedback/FloatingAlert";
import { useAuth } from "@/features/auth/hooks/useAuth";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialProfileForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: "",
};

const initialPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfileView() {
  const { user, login } = useAuth();
  const [form, setForm] = useState<ProfileFormState>(initialProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm);
  const [profileMeta, setProfileMeta] = useState<{
    username: string;
    email: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      const response = await window.api.getOwnProfile();

      if (!active) return;

      if (!response.success || !response.profile) {
        setFeedback({
          severity: "error",
          message: response.message || "No se pudo cargar tu perfil.",
        });
        setLoading(false);
        return;
      }

      setForm({
        firstName: response.profile.firstName ?? "",
        lastName: response.profile.lastName ?? "",
        email: response.profile.email ?? "",
        phone: response.profile.phone ?? "",
        birthDate: response.profile.birthDate ?? "",
      });
      setProfileMeta({
        username: response.profile.username,
        email: response.profile.email ?? "",
      });
      setLoading(false);
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const canSaveProfile = useMemo(() => {
    return form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2;
  }, [form.firstName, form.lastName]);

  const canSubmitPassword = useMemo(() => {
    return (
      passwordForm.currentPassword.trim().length > 0 &&
      passwordForm.newPassword.length >= 6 &&
      passwordForm.confirmPassword.length >= 6
    );
  }, [passwordForm]);

  const updateForm = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePasswordForm = <K extends keyof PasswordFormState>(key: K, value: PasswordFormState[K]) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfile = async () => {
    setFeedback(null);
    setSaving(true);

    try {
      const response = await window.api.updateOwnProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        phone: form.phone || null,
        birthDate: form.birthDate || null,
      });

      if (!response.success) {
        throw new Error(response.message || "No se pudo actualizar tu perfil.");
      }

      if (response.user) {
        login(response.user);
      }

      setProfileMeta((current) =>
        current
          ? {
              ...current,
              email: form.email.trim(),
            }
          : current
      );

      setFeedback({ severity: "success", message: "Perfil actualizado correctamente." });
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo actualizar tu perfil.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setFeedback(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback({
        severity: "error",
        message: "La confirmacion de la contrasena no coincide.",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const response = await window.api.changeOwnPassword(passwordForm);

      if (!response.success) {
        throw new Error(response.message || "No se pudo cambiar la contrasena.");
      }

      setPasswordModalOpen(false);
      setPasswordForm(initialPasswordForm);
      setFeedback({ severity: "success", message: "Contrasena actualizada correctamente." });
    } catch (error) {
      setFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "No se pudo cambiar la contrasena.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Mi perfil
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra tus datos personales y la seguridad de tu cuenta desde un solo lugar.
        </Typography>
      </Box>

      <FloatingAlert feedback={feedback} onClose={() => setFeedback(null)} />

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Datos personales
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Actualiza el nombre, apellido, correo, telefono y fecha de nacimiento del usuario actual.
              </Typography>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
              <TextField
                label="Nombre"
                value={form.firstName}
                onChange={(event) => updateForm("firstName", event.target.value)}
                disabled={loading}
                required
              />
              <TextField
                label="Apellido"
                value={form.lastName}
                onChange={(event) => updateForm("lastName", event.target.value)}
                disabled={loading}
                required
              />
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
              <TextField
                label="Correo"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                disabled={loading}
              />
              <TextField
                label="Telefono"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
                helperText="Opcional. Debe tener 10 digitos."
                disabled={loading}
              />
              <TextField
                label="Fecha de nacimiento"
                type="date"
                value={form.birthDate}
                onChange={(event) => updateForm("birthDate", event.target.value)}
                InputLabelProps={{ shrink: true }}
                disabled={loading}
              />
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
              <TextField label="Usuario" value={profileMeta?.username ?? user?.username ?? ""} disabled />
              <TextField label="Correo actual" value={profileMeta?.email || "No registrado"} disabled />
            </Box>

            <Box display="flex" justifyContent="flex-end">
              <Button variant="contained" onClick={() => void handleSaveProfile()} disabled={!canSaveProfile || saving || loading}>
                Guardar cambios
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              gap={2}
              flexDirection={{ xs: "column", sm: "row" }}
            >
              <Box>
                <Typography fontWeight={600}>Cambiar contrasena</Typography>
                <Typography variant="body2" color="text.secondary">
                  Debes ingresar tu contrasena actual y confirmar la nueva.
                </Typography>
              </Box>
              <Button variant="outlined" onClick={() => setPasswordModalOpen(true)}>
                Cambiar contrasena
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cambiar contrasena</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Contrasena actual"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => updatePasswordForm("currentPassword", event.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label="Nueva contrasena"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => updatePasswordForm("newPassword", event.target.value)}
              helperText="Minimo 6 caracteres."
              autoComplete="new-password"
            />
            <TextField
              label="Confirmar nueva contrasena"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => updatePasswordForm("confirmPassword", event.target.value)}
              autoComplete="new-password"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordModalOpen(false);
              setPasswordForm(initialPasswordForm);
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleChangePassword()} disabled={!canSubmitPassword || changingPassword}>
            Guardar contrasena
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
