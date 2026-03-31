import ModuleScaffoldView from "@/app/components/ModuleScaffoldView";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";

export default function CashView() {
  const { user } = useAuth();
  const canOpenCash = hasPermission(user, APP_PERMISSION_KEYS.cashOpen);
  const canCloseCash = hasPermission(user, APP_PERMISSION_KEYS.cashClose);

  return (
    <ModuleScaffoldView
      title="Caja y turnos"
      subtitle="Controla apertura, cierre, arqueos y movimientos manuales de caja."
      primaryAction="Cerrar caja"
      secondaryAction="Registrar egreso"
      showPrimaryAction={canCloseCash}
      showSecondaryAction={canOpenCash || canCloseCash}
      metrics={[
        { label: "Sesion activa", value: "Caja principal", helper: "Abierta por admin" },
        { label: "Esperado", value: "$365.000", helper: "Acumulado del turno" },
        { label: "Diferencia", value: "$0", helper: "Sin novedad" },
      ]}
      filters={["Fecha", "Turno", "Tipo", "Usuario"]}
      columns={[
        { key: "type", label: "Movimiento" },
        { key: "detail", label: "Detalle" },
        { key: "user", label: "Usuario" },
        { key: "amount", label: "Valor", align: "right" },
      ]}
      rows={[
        { type: "Apertura", detail: "Fondo inicial", user: "admin", amount: "$100.000" },
        { type: "Venta", detail: "Factura FV-000124", user: "admin", amount: "$18.400" },
        { type: "Egreso", detail: "Pago domiciliario", user: "admin", amount: "$12.000" },
      ]}
      formTitle="Arqueo rapido"
      formFields={[
        { label: "Efectivo contado", value: "$365.000", required: true, helper: "Debe coincidir con el esperado o justificar diferencia." },
        { label: "Tarjeta", value: "$80.000" },
        { label: "Transferencia", value: "$45.000" },
        { label: "Observacion", value: "" },
      ]}
      notes={[
        "La apertura y cierre deben bloquearse si ya existe una sesion activa en la misma caja.",
        "Si la diferencia supera el umbral configurado, el sistema debe exigir motivo y autorizacion.",
      ]}
    />
  );
}
