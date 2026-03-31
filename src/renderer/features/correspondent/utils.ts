export function formatCurrency(value: number) {
  return "$" + Math.round(value || 0).toLocaleString("es-CO");
}

export function formatDate(dateLike: string) {
  return new Date(dateLike).toLocaleDateString("es-CO");
}

export function formatTime(dateLike: string) {
  return new Date(dateLike).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(dateLike: string) {
  return `${formatDate(dateLike)} ${formatTime(dateLike)}`;
}

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeInputValue(dateLike: string | Date) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function buildRange(range: "day" | "week" | "month", dateInput: string) {
  const base = new Date(`${dateInput}T00:00:00`);
  const from = new Date(base);
  const to = new Date(base);

  if (range === "week") {
    const day = from.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from.setDate(from.getDate() - diff);
  } else if (range === "month") {
    from.setDate(1);
  }

  if (range === "day") {
    to.setDate(from.getDate() + 1);
  } else if (range === "week") {
    to.setDate(from.getDate() + 7);
  } else {
    to.setMonth(from.getMonth() + 1);
    to.setDate(1);
  }

  return {
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
  };
}

export function transactionLabel(id: string) {
  return `TRX-${id.slice(0, 8).toUpperCase()}`;
}

export function auditActionLabel(action: string) {
  const map: Record<string, string> = {
    create_transaction: "Registro",
    update_transaction: "Edicion",
    create_closure: "Cuadre",
    create_platform: "Nuevo corresponsal",
    create_transaction_type: "Nuevo tipo",
  };

  return map[action] ?? action;
}
