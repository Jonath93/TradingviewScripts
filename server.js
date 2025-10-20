import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // npm install node-fetch


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const token = "889fe42af8e9749df29c56944cd6d831-8a11568b42d21e64a2a0ea8f27a9c1e5";

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
app.get("/api/oanda/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { start, end, granularity } = req.query;

    const url = `https://api-fxpractice.oanda.com/v3/instruments/${symbol}/candles?granularity=${granularity}&from=${start}&to=${end}`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
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


// ✅ Rutas específicas primero
app.get("/forex", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "forex.html"));
});

app.get("/xauusd", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "xauusd.html"));
});

// ✅ Fallback general AL FINAL
app.get((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Servidor iniciado en http://localhost:${port}`);
});
