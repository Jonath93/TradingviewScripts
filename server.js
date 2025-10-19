const express = require('express');
const path = require('path');
const app = express();

// ✅ Añade tu CSP aquí
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
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
        ].join('; ')
    );
    next();
});

// sirve estáticos (ajusta la carpeta)
app.use(express.static(path.join(__dirname, 'public')));

// fallback
app.get('/*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
