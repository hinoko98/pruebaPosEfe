import ModuleScaffoldView from "@/app/components/ModuleScaffoldView";

export default function ReportsView() {
  return (
    <ModuleScaffoldView
      title="Reportes y analitica"
      subtitle="Concentra ventas, utilidad, caja, inventario, clientes y compras con filtros exportables."
      primaryAction="Exportar a Excel"
      secondaryAction="Imprimir reporte"
      metrics={[
        { label: "Ingresos mes", value: "$8.240.000", helper: "Ventas brutas" },
        { label: "Utilidad estimada", value: "$2.150.000", helper: "Margen acumulado" },
        { label: "Rotacion baja", value: "9", helper: "Productos sin salida" },
        { label: "Deuda clientes", value: "$860.000", helper: "Cartera vigente" },
      ]}
      filters={["Fecha inicial", "Fecha final", "Modulo", "Usuario"]}
      columns={[
        { key: "report", label: "Reporte" },
        { key: "scope", label: "Alcance" },
        { key: "updated", label: "Actualizado" },
        { key: "format", label: "Salida" },
      ]}
      rows={[
        { report: "Ventas por periodo", scope: "Dia / Semana / Mes", updated: "Hoy", format: "Pantalla / Excel / PDF" },
        { report: "Caja por turno", scope: "Sesion", updated: "Hoy", format: "Pantalla / PDF" },
        { report: "Inventario valorizado", scope: "Catalogo", updated: "Hoy", format: "Pantalla / Excel" },
      ]}
      notes={[
        "Conviene priorizar ventas, caja, utilidad, inventario valorizado y deuda clientes.",
        "Los reportes imprimibles deben usar filtros de fecha, usuario y caja cuando aplique.",
      ]}
    />
  );
}
