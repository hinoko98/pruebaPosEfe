import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import type { AlertColor } from "@mui/material/Alert";

export type FloatingFeedback = {
  severity: AlertColor;
  message: string;
} | null;

export default function FloatingAlert({
  feedback,
  onClose,
  autoHideDuration = 3500,
}: {
  feedback: FloatingFeedback;
  onClose: () => void;
  autoHideDuration?: number;
}) {
  return (
    <Snackbar
      open={Boolean(feedback)}
      autoHideDuration={autoHideDuration}
      onClose={(_event, reason) => {
        if (reason === "clickaway") return;
        onClose();
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      {feedback ? (
        <Alert onClose={onClose} severity={feedback.severity} variant="filled" sx={{ width: "100%" }}>
          {feedback.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
