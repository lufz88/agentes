// ============================================================
// components/DynamicComponent.tsx — Renderizador dinámico
// ============================================================
// (ver docs/summary.md#generative-ui — "Component Registry")
// CONCEPTO CLAVE: Este componente es el "renderer" de Generative UI.
// Recibe el tipo y props de un componente y lo renderiza.
//
// Es el equivalente a un "component factory" que mapea
// strings (del agente) a componentes React reales.
// ============================================================

import type { MountedComponent } from "../store/agent-store.js";
import { WeatherCard } from "./WeatherCard.js";
import { Chart } from "./Chart.js";
import { DataTable } from "./DataTable.js";

/** Mapa de tipos de componente a componentes React */
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  weather_card: WeatherCard,
  chart: Chart,
  data_table: DataTable,
};

interface DynamicComponentProps {
  mounted: MountedComponent;
}

export function DynamicComponent({ mounted }: DynamicComponentProps) {
  const Component = COMPONENT_REGISTRY[mounted.component];

  if (!Component) {
    return (
      <div style={{ padding: 16, background: "#fff3cd", borderRadius: 8, color: "#856404" }}>
        ⚠️ Componente desconocido: <code>{mounted.component}</code>
      </div>
    );
  }

  return (
    <div style={{ margin: "8px 0", animation: "fadeIn 0.3s ease" }}>
      <Component {...mounted.props} />
    </div>
  );
}
