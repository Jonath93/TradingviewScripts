import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // npm install node-fetch
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const token = process.env.TOKEN;

// 🌍 Lista de dominios permitidos (separados por coma en .env)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

//
// 🔒 CORS CONFIG — solo permite los orígenes del .env
//
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Postman o peticiones internas
        if (ALLOWED_ORIGINS.some((url) => origin.startsWith(url))) {
            callback(null, true);
        } else {
            console.warn("🚫 CORS bloqueado para origen:", origin);
            callback(new Error("No permitido por CORS"));
        }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-access-key", "Authorization"],
    credentials: true,
};
app.use(cors(corsOptions));

//
// 🧩 CSP + protección iframe
//
app.use((req, res, next) => {
    const frameAncestors = ALLOWED_ORIGINS.length
        ? ALLOWED_ORIGINS.join(" ")
        : "'none'"; // si no hay orígenes, bloquea todos los iframes

    res.setHeader(
        "Content-Security-Policy",
        [
            // ⚙️ Seguridad general + TradingView (blob: necesario)
            "default-src 'self' https: data: blob:",
            "script-src 'self' https: 'unsafe-inline' 'unsafe-eval' blob:",
            "style-src 'self' https: 'unsafe-inline'",
            "img-src * data: blob:",
            "connect-src * data: blob:",
            "font-src * data:",
            "frame-src * blob:",
            "worker-src * blob:",
            "child-src blob:",
            // 🔒 Protección iframe (solo tus dominios pueden embeber)
            `frame-ancestors ${frameAncestors}`,
        ].join("; ")
    );

    // Para navegadores antiguos, refuerzo adicional
    if (ALLOWED_ORIGINS.length > 0) {
        res.setHeader("X-Frame-Options", `ALLOW-FROM ${ALLOWED_ORIGINS[0]}`);
    } else {
        res.setHeader("X-Frame-Options", "DENY");
    }

    next();
});

//
// 📊 API Coinbase
//
app.get("/api/coinbase/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { start, end, granularity } = req.query;
    const url = `https://api.coinbase.com/api/v3/brokerage/market/products/${symbol}/candles?start=${start}&end=${end}&granularity=${granularity}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

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

//
// 💹 API OANDA
//
app.get("/api/oanda/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { start, end, granularity } = req.query;
    const url = `https://api-fxpractice.oanda.com/v3/instruments/${symbol}/candles?granularity=${granularity}&from=${start}&to=${end}`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const text = await response.text();

        if (text.trim().startsWith("<")) {
            console.error("⚠️ OANDA devolvió HTML, no JSON:", text.slice(0, 100));
            return res.status(502).json({ error: "OANDA devolvió HTML en lugar de JSON" });
        }

        const data = JSON.parse(text);
        res.json(data);
    } catch (err) {
        console.error("❌ Error al obtener datos de OANDA:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

//
// 📂 Archivos estáticos
//
app.use(express.static(path.join(__dirname, "public")));

//
// 📄 Rutas HTML
//
app.get("/forex", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "forex.html"));
});

app.get("/xauusd", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "xauusd.html"));
});

//
// 🌐 Fallback (para SPA o rutas no definidas)
//
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

//
// 🚀 Servidor
//
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Servidor iniciado en http://localhost:${port}`);
});
