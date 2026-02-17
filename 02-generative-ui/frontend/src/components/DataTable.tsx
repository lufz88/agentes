// ============================================================
// components/DataTable.tsx — Tabla generada por el agente
// ============================================================

interface DataTableProps {
  title: string;
  columns: string[];
  rows: unknown[][];
}

export function DataTable(props: DataTableProps) {
  return (
    <div style={styles.container}>
      <h4 style={styles.title}>{props.title}</h4>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {props.columns.map((col) => (
                <th key={col} style={styles.th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, i) => (
              <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                {row.map((cell, j) => (
                  <td key={j} style={styles.td}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", background: "#fff" },
  title: { margin: 0, padding: "12px 16px", background: "#f7fafc", borderBottom: "1px solid #e2e8f0", fontSize: 14, color: "#4a5568" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 16px", background: "#edf2f7", color: "#4a5568", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" },
  td: { padding: "10px 16px", color: "#2d3748" },
  rowEven: { background: "#fff" },
  rowOdd: { background: "#f7fafc" },
};
