export function metodoPagoLabel(value: "CASH" | "CARD" | "TRANSFER") {
  if (value === "CARD") return "Transferencia";
  if (value === "TRANSFER") return "Transferencia";
  return "Efectivo";
}

export function estadoVentaLabel(
  value: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT"
) {
  if (value === "CANCELLED") return "Anulada";
  if (value === "PARTIALLY_RETURNED") return "Devuelta parcial";
  if (value === "RETURNED") return "Devuelta";
  if (value === "CREDIT") return "Crédito";
  return "Completada";
}

export function rolLabel(value: "ADMIN" | "EMPLOYEE") {
  return value === "ADMIN" ? "Administrador" : "Empleado";
}

export function tipoMovimientoInventarioLabel(
  value:
    | "PURCHASE_IN"
    | "SALE_OUT"
    | "RETURN_IN"
    | "ADJUSTMENT_IN"
    | "ADJUSTMENT_OUT"
    | "DAMAGE_OUT"
    | "LOSS_OUT"
    | "MANUAL_IN"
    | "MANUAL_OUT"
) {
  if (value === "PURCHASE_IN") return "Entrada por compra";
  if (value === "SALE_OUT") return "Salida por venta";
  if (value === "RETURN_IN") return "Devolución";
  if (value === "ADJUSTMENT_IN") return "Ajuste de entrada";
  if (value === "ADJUSTMENT_OUT") return "Ajuste de salida";
  if (value === "DAMAGE_OUT") return "Salida por daño";
  if (value === "LOSS_OUT") return "Salida por pérdida";
  if (value === "MANUAL_OUT") return "Salida manual";
  return "Entrada manual";
}
