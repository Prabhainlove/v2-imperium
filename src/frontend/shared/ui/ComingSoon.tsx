interface Props { title: string; desc: string; }
export function ComingSoon({ title, desc }: Props) {
  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 40,
        boxShadow: "0 6px 24px rgba(217,140,110,.10)", textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64, margin: "0 auto 16px", borderRadius: 18,
          background: "#fde2d7", color: "#ee7b5a",
          display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800,
        }}>{title[0]}</div>
        <h1 style={{ fontFamily: "Inter Tight, Inter, sans-serif", fontSize: 28, fontWeight: 800, color: "#1f1d1b" }}>{title}</h1>
        <p style={{ color: "#7a716a", marginTop: 8, fontSize: 15 }}>{desc}</p>
        <div style={{ marginTop: 20, color: "#ee7b5a", fontWeight: 700, letterSpacing: ".1em", fontSize: 12 }}>COMING SOON</div>
      </div>
    </div>
  );
}
