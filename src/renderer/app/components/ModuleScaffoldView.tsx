import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export type ModuleMetric = {
  label: string;
  value: string;
  helper?: string;
};

export type ModuleColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

export type ModuleRow = Record<string, string | number>;

export type ModuleField = {
  label: string;
  value: string;
  required?: boolean;
  helper?: string;
};

export default function ModuleScaffoldView({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  metrics,
  filters,
  columns,
  rows,
  formTitle,
  formFields,
  notes,
}: {
  title: string;
  subtitle: string;
  primaryAction?: string;
  secondaryAction?: string;
  metrics?: ModuleMetric[];
  filters?: string[];
  columns: ModuleColumn[];
  rows: ModuleRow[];
  formTitle?: string;
  formFields?: ModuleField[];
  notes?: string[];
}) {
  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {secondaryAction ? <Button variant="outlined">{secondaryAction}</Button> : null}
          {primaryAction ? <Button variant="contained">{primaryAction}</Button> : null}
        </Stack>
      </Box>

      {metrics?.length ? (
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: `repeat(${Math.min(metrics.length, 4)}, 1fr)` }} gap={2}>
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {metric.value}
                </Typography>
                {metric.helper ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {metric.helper}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: formFields?.length ? "1.4fr 1fr" : "1fr" }} gap={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              {filters?.length ? (
                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: `repeat(${Math.min(filters.length, 4)}, 1fr)` }} gap={2}>
                  {filters.map((filter) => (
                    <TextField key={filter} label={filter} placeholder={`Filtrar por ${filter.toLowerCase()}`} />
                  ))}
                </Box>
              ) : null}

              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {columns.map((column) => (
                        <TableCell key={column.key} align={column.align ?? "left"}>
                          {column.label}
                        </TableCell>
                      ))}
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={index} hover>
                        {columns.map((column) => (
                          <TableCell key={column.key} align={column.align ?? "left"}>
                            {String(row[column.key] ?? "")}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Chip label="Ver" size="small" />
                            <Chip label="Editar" size="small" color="primary" variant="outlined" />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {formFields?.length ? (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">{formTitle || "Formulario"}</Typography>
                {formFields.map((field) => (
                  <TextField
                    key={field.label}
                    label={field.label}
                    defaultValue={field.value}
                    required={field.required}
                    helperText={field.helper}
                    fullWidth
                  />
                ))}
                <Button variant="contained">Guardar</Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Box>

      {notes?.length ? (
        <Stack spacing={1}>
          {notes.map((note) => (
            <Alert key={note} severity="info">
              {note}
            </Alert>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
