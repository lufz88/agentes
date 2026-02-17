// ============================================================
// components/Chart.tsx — Gráfico simple generado por el agente
// ============================================================
// Implementación ligera sin librerías externas (para aprendizaje).
// En producción usarías Recharts, Chart.js, etc.
// ============================================================

interface ChartProps {
  title: string;
  type: "bar" | "line" | "pie" | "area";
  data: {
    labels: string[];
    datasets: Array<{ label: string; data: number[] }>;
  };
}

export function Chart(props: ChartProps) {
  const { title, data } = props;
  const values = data.datasets[0]?.data ?? [];
  const max = Math.max(...values, 1);

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>{title}</h4>
      <div style={styles.chart}>
        {data.labels.map((label, i) => (
          <div key={label} style={styles.barGroup}>
            <div style={styles.barContainer}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(values[i] / max) * 100}%`,
                  background: COLORS[i % COLORS.length],
                }}
              >
                <span style={styles.value}>{values[i]}</span>
              </div>
            </div>
            <span style={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4fd1c5", "#fc8181", "#f6ad55"];

const styles: Record<string, React.CSSProperties> = {
  container: { borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", overflow: "hidden" },
  title: { margin: 0, padding: "12px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 14, color: "#4a5568" },
  chart: { display: "flex", alignItems: "flex-end", gap: 8, padding: 16, height: 200 },
  barGroup: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 8 },
  barContainer: { width: "100%", height: 160, display: "flex", alignItems: "flex-end" },
  bar: { width: "100%", borderRadius: "6px 6px 0 0", minHeight: 4, display: "flex", justifyContent: "center", paddingTop: 4, transition: "height 0.5s ease" },
  value: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  label: { fontSize: 11, color: "#718096", textAlign: "center" },
};
