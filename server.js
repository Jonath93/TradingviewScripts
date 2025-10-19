import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // npm install node-fetch


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Encabezado CSP completo (TradingView necesita blob:, data:, etc.)
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'self' https: data: blob:",
            "script-src 'self' https: 'unsafe-inline' 'unsafe-eval' blob:",
            "style-src 'self' https: 'unsafe-inline'",
            "img-src * data: blob:",
            "connect-src * data: blob:",
            "font-src * data:",
            "frame-src * blob:",
            "worker-src * blob:",
            "child-src blob:"
        ].join("; ")
    );
    next();
});

app.get("/api/coinbase/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { start, end, granularity } = req.query;

    const url = `https://api.coinbase.com/api/v3/brokerage/market/products/${symbol}/candles?start=${start}&end=${end}&granularity=${granularity}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

        // Verificamos si realmente devolvió JSON o HTML
        if (text.trim().startsWith("<")) {
            console.error("⚠️ Coinbase devolvió HTML, no JSON:", text.slice(0, 100));
            return res.status(502).json({ error: "Coinbase devolvió HTML en lugar de JSON" });
        }

        const data = JSON.parse(text);
        res.json(data);
    } catch (err) {
        console.error("❌ Error al obtener datos de Coinbase:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});
// ✅ Servir archivos estáticos (tu carpeta /public)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Fallback universal — sin usar '*' ni patrones
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Servidor iniciado en http://localhost:${port}`);
});
