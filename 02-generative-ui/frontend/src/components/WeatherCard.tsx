// ============================================================
// components/WeatherCard.tsx — Componente generado por el agente
// ============================================================

interface WeatherCardProps {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  wind: number;
  forecast?: Array<{ day: string; temp: number; icon: string }>;
}

export function WeatherCard(props: WeatherCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.city}>{props.city}</h3>
        <span style={styles.condition}>{props.condition}</span>
      </div>
      <div style={styles.temp}>{props.temperature}°C</div>
      <div style={styles.details}>
        <span>💧 {props.humidity}%</span>
        <span>💨 {props.wind} km/h</span>
      </div>
      {props.forecast && (
        <div style={styles.forecast}>
          {props.forecast.map((f) => (
            <div key={f.day} style={styles.forecastDay}>
              <span>{f.icon}</span>
              <span style={styles.forecastTemp}>{f.temp}°</span>
              <span style={styles.forecastLabel}>{f.day}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderRadius: 16,
    padding: 24,
    color: "white",
    minWidth: 280,
    boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  city: { margin: 0, fontSize: 20 },
  condition: { fontSize: 14, opacity: 0.9 },
  temp: { fontSize: 48, fontWeight: "bold", margin: "8px 0" },
  details: { display: "flex", gap: 16, fontSize: 14, opacity: 0.9 },
  forecast: { display: "flex", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.3)" },
  forecastDay: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  forecastTemp: { fontWeight: "bold" },
  forecastLabel: { fontSize: 12, opacity: 0.8 },
};
