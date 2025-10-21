import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 🔑 Variables de entorno
const token = process.env.TOKEN;
const ACCESS_KEY = process.env.ACCESS_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// 🧩 Configuración CORS
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Permitir Postman o local
        if (ALLOWED_ORIGINS.some(url => origin.startsWith(url))) {
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

// 🛡️ Seguridad y cabeceras CSP
app.use((req, res, next) => {
    const frameAncestors = ALLOWED_ORIGINS.length
        ? ALLOWED_ORIGINS.join(" ")
        : "'none'";

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
            "child-src blob:",
            `frame-ancestors ${frameAncestors}`,
        ].join("; ")
    );

    // 🚫 Eliminar X-Frame-Options (causa conflicto con CSP)
    res.removeHeader("X-Frame-Options");
    next();
});

// 🔐 Validación de ACCESS_KEY
app.use("/api", (req, res, next) => {
    const clientKey = req.query.key || req.get("x-access-key");

    if (!clientKey) {
        return res.status(401).json({ error: "Falta encabezado o parámetro x-access-key" });
    }

    if (clientKey !== ACCESS_KEY) {
        console.warn("🚫 ACCESS_KEY inválida desde:", req.get("origin") || "desconocido");
        return res.status(403).json({ error: "Acceso denegado: clave incorrecta" });
    }

    next();
});

// 🌐 Ruta: Coinbase
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

// 🌐 Ruta: OANDA
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

// 📂 Archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// 📄 Páginas HTML específicas
app.get("/forex", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "forex.html"));
});

app.get("/xauusd", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "xauusd.html"));
});

// 🏠 Fallback general
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Iniciar servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Servidor iniciado en http://localhost:${port}`);
});
