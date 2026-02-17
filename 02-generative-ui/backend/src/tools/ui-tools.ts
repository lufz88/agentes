// ============================================================
// tools/ui-tools.ts — Tools que generan componentes UI
// ============================================================
// (ver docs/summary.md#generative-ui — "El patrón dual-return")
// CONCEPTO CLAVE: Estos tools retornan datos estructurados que
// el frontend interpreta como componentes React a renderizar.
//
// El LLM decide cuándo usar cada tool basándose en el intent
// del usuario. El resultado incluye tanto datos como metadata
// de componente UI.
// ============================================================

import type { ToolDefinition, UIAction } from "../types.js";

// ---- Tool: Mostrar datos de clima como tarjeta visual ----
export const weatherCardTool: ToolDefinition = {
  name: "show_weather_card",
  description:
    "Muestra una tarjeta visual con el clima de una ciudad. Úsalo cuando " +
    "el usuario pregunte por el clima. Genera un componente visual en la UI.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "Nombre de la ciudad" },
    },
    required: ["city"],
  },
  uiComponent: "weather_card",
};

export async function executeWeatherCard(args: { city: string }): Promise<{
  toolResult: string;
  uiAction: UIAction;
}> {
  // Simular datos de clima
  const data = {
    city: args.city,
    temperature: Math.round(Math.random() * 30 + 5),
    condition: ["☀️ Soleado", "☁️ Nublado", "🌧️ Lluvioso", "⛈️ Tormenta"][
      Math.floor(Math.random() * 4)
    ],
    humidity: Math.round(Math.random() * 60 + 30),
    wind: Math.round(Math.random() * 25 + 5),
    forecast: [
      { day: "Mañana", temp: Math.round(Math.random() * 30 + 5), icon: "☀️" },
      { day: "Pasado", temp: Math.round(Math.random() * 30 + 5), icon: "☁️" },
      { day: "Jueves", temp: Math.round(Math.random() * 30 + 5), icon: "🌧️" },
    ],
  };

  return {
    toolResult: JSON.stringify(data),
    uiAction: {
      type: "mount",
      componentId: `weather-${args.city.toLowerCase().replace(/\s/g, "-")}`,
      component: "weather_card",
      props: data,
    },
  };
}

// ---- Tool: Mostrar datos en un gráfico ----
export const chartTool: ToolDefinition = {
  name: "show_chart",
  description:
    "Muestra un gráfico interactivo con datos. Úsalo para visualizar " +
    "series de datos, comparaciones, tendencias, estadísticas.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Título del gráfico" },
      chart_type: {
        type: "string",
        description: "Tipo de gráfico",
        enum: ["bar", "line", "pie", "area"],
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Etiquetas del eje X o categorías",
      },
      values: {
        type: "array",
        items: { type: "number" },
        description: "Valores correspondientes a cada etiqueta",
      },
    },
    required: ["title", "chart_type", "labels", "values"],
  },
  uiComponent: "chart",
};

export async function executeChart(args: {
  title: string;
  chart_type: string;
  labels: string[];
  values: number[];
}): Promise<{ toolResult: string; uiAction: UIAction }> {
  return {
    toolResult: JSON.stringify({
      title: args.title,
      type: args.chart_type,
      dataPoints: args.labels.length,
    }),
    uiAction: {
      type: "mount",
      componentId: `chart-${Date.now()}`,
      component: "chart",
      props: {
        title: args.title,
        type: args.chart_type,
        data: {
          labels: args.labels,
          datasets: [{ label: args.title, data: args.values }],
        },
      },
    },
  };
}

// ---- Tool: Mostrar tabla de datos ----
export const dataTableTool: ToolDefinition = {
  name: "show_data_table",
  description:
    "Muestra una tabla interactiva con datos. Ideal para listas, " +
    "comparaciones, resultados de búsqueda, datos tabulares.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Título de la tabla" },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Nombres de las columnas",
      },
      rows: {
        type: "array",
        items: {
          type: "array",
          items: { type: "string" },
          description: "Valores de cada celda en la fila",
        },
        description: "Filas de datos (array de arrays de strings)",
      },
    },
    required: ["title", "columns", "rows"],
  },
  uiComponent: "data_table",
};

export async function executeDataTable(args: {
  title: string;
  columns: string[];
  rows: unknown[][];
}): Promise<{ toolResult: string; uiAction: UIAction }> {
  return {
    toolResult: JSON.stringify({
      title: args.title,
      columnCount: args.columns.length,
      rowCount: args.rows.length,
    }),
    uiAction: {
      type: "mount",
      componentId: `table-${Date.now()}`,
      component: "data_table",
      props: args,
    },
  };
}
