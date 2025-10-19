class UniversalDatafeed {
    constructor(type = "crypto", symbol = "BTC-USD") {
        this.token = "889fe42af8e9749df29c56944cd6d831-8a11568b42d21e64a2a0ea8f27a9c1e5";
        this.baseUrlOANDA = "https://api-fxpractice.oanda.com";
        this.type = type; // "crypto" o "forex"
        this.ticker = symbol;
        this.socket = null;
        this.socketForex = null;
        this.lastBar = {};
        this.subscribers = {};
        this.dataCurrent = { result: {}, symbol: "" };
        this.scanner = (type == "crypto") ? new RetrocesoScanner({ swingLen: 15, emaLen: 50 }) : new RetrocesoScannerForex({ swingLen: 15, emaLen: 50 });
        this.loadingHistory = false;
        this.barsSaved = [];
        this.resultScanner = {};
    }

    // Responde qué soporta el feed
    onReady(cb) {
        setTimeout(() => cb({
            supported_resolutions: ["1", "5", "15", "30", "60", "D"],
            supports_time: true,
            supports_marks: false,
        }), 0);
    }

    // Resuelve el símbolo
    resolveSymbol(symbolName, onSymbolResolvedCallback) {
        const symbol = {
            name: symbolName,
            ticker: symbolName,
            description: "",
            type: (this.type == "crypto") ? "crypto" : "commodity",
            session: "24x7",
            timezone: "Etc/UTC",
            exchange: "",
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            supported_resolutions: []
        };
        setTimeout(() => onSymbolResolvedCallback(symbol), 0);
    }

    // Consulta barras históricas
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        try {
            this.RetrocesoScanner = {};
            this.ticker = symbolInfo.ticker;
            //first clean method
            const key = symbolInfo.ticker + resolution;
            const from = Math.floor(periodParams.from);
            const to = Math.floor(periodParams.to);


            this.lastBar[key] = null;
            this.lastRequest = null;
            let allBars = [];
            if (this.type == "crypto") {
                allBars = await this.CryptoApiGetBars(from, to, resolution)
            } else {
                allBars = await this.ForexApiGetBars(from, to, resolution)
            }




            const uniqueBars = Array.from(new Map(allBars.map(b => [b.time, b])).values())
                .sort((a, b) => a.time - b.time)
                .filter(b => b.time <= Date.now());

            if (!this.barsSaved) this.barsSaved = [];

            if (this.barsSaved.length === 0) {
                this.barsSaved = uniqueBars;
            } else {
                const merged = [...this.barsSaved, ...uniqueBars];
                this.barsSaved = Array.from(new Map(merged.map(b => [b.time, b])).values())
                    .sort((a, b) => a.time - b.time);
            }



            this.lastBar[key] = this.barsSaved.at(-1);
            this.lastRequest = { key, from, to, data: allBars };

            // Si el scanner existe, actualízalo con las barras
            if (this.scanner?.fillbars) {
                this.resultScanner = this.scanner.fillbars(this.barsSaved);

            }


            onHistoryCallback(this.barsSaved, { noData: allBars.length === 0 });


        } catch (err) {
            onErrorCallback(err);
        }
    }

    // Suscripción en tiempo real
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const key = symbolInfo.ticker + resolution;
        this.subscribers[key] = { onRealtimeCallback, resolution, symbolInfo };

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return;
        }
        //test ws://localhost:3000"
        const WS_URL = (this.type === "crypto") ? "wss://advanced-trade-ws.coinbase.com" : "ws://scannerapi-production.up.railway.app";
        this.socket = new WebSocket(WS_URL);


        if (this.type === "crypto") {

            this.CryptoWebSocketInit(symbolInfo, resolution, onRealtimeCallback, subscriberUID);

        } else {
            this.ForexWebSocketInit(symbolInfo, resolution, onRealtimeCallback, subscriberUID);
        }
    }
    CryptoWebSocketInit(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        this.socket.onopen = () => {
            const candleSub = {
                type: "subscribe",
                product_ids: [this.ticker],
                channel: "candles", // o "level2", "candles", etc.
            };
            const tickerSub = {
                type: "subscribe",
                channel: "ticker",
                product_ids: [this.ticker]
            };
            this.socket.send(JSON.stringify(candleSub));
            this.socket.send(JSON.stringify(tickerSub));

        };

        this.socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        this.socket.onclose = (event) => {
            console.log("WebSocket cerrado:", event.code, event.reason);
            setTimeout(() => this.subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID), 3000);
        };

        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (!msg.channel || !msg.events) return;

                Object.keys(this.subscribers).forEach(key => {
                    const sub = this.subscribers[key];

                    let resultScanner = {};


                    if (msg.channel === "candles" && msg.events.length > 0) {
                        const evt = msg.events[0];
                        if (evt.candles && evt.candles.length > 0) {
                            const c = evt.candles[0];

                            const bar = {
                                time: c.start * 1000,
                                open: parseFloat(c.open),
                                high: parseFloat(c.high),
                                low: parseFloat(c.low),
                                close: parseFloat(c.close),
                                volume: parseFloat(c.volume),
                            };
                            const prevBar = this.lastBar[key];
                            if (prevBar && bar.time <= prevBar.time) {
                                return;
                            }
                            this.lastBar[key] = bar;
                            resultScanner = this.scanner.CreateNewBar(this.lastBar[key]);

                        }
                    }
                    if (msg.channel === "ticker" && msg.events.length > 0) {
                        const tickEvent = msg.events[0].tickers?.[0];
                        const price = parseFloat(tickEvent.price);
                        this.lastBar[key].high = Math.max(this.lastBar[key].high, parseFloat(price));
                        this.lastBar[key].low = Math.min(this.lastBar[key].low, parseFloat(price));
                        this.lastBar[key].close = parseFloat(price);
                        this.lastBar[key].volume += 0.0001 || 0;
                        resultScanner = this.scanner.updateBars(this.lastBar[key]);

                    }

                    this.resultScanner = resultScanner;




                    sub.onRealtimeCallback(this.lastBar[key]);
                });



            } catch (error) {
                console.error("Error procesando mensaje:", error);
            }
        };
    }
    async ForexWebSocketInit(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        this.socket.onopen = () => {
            // Envía el instrumento al backend Node.js
            const instrument = { instrument: this.ticker };
            this.socket.send(JSON.stringify(instrument));
        };

        this.socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        this.socket.onclose = (event) => {
            console.log("WebSocket cerrado:", event.code, event.reason);
            setTimeout(() => this.subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID), 3000);
        };

        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type !== "PRICE") return;
                const key = symbolInfo.ticker + resolution;
                const sub = this.subscribers[key];
                if (!sub) return;

                const bid = parseFloat(msg.bid);
                const ask = parseFloat(msg.ask);
                const price = (bid + ask) / 2;
                const ts = new Date(msg.time).getTime();

                // Definir duración de la vela según resolución
                const secondsPerCandle = {
                    "1": 60,
                    "5": 300,
                    "15": 900,
                    "30": 1800,
                    "60": 3600,
                    "240": 14400,
                    "D": 86400
                }[resolution] || 60;

                const barStartTime = Math.floor(ts / (secondsPerCandle * 1000)) * (secondsPerCandle * 1000);
                const prevBar = this.lastBar[key];
                let resultScanner = {};

                // Si no hay vela previa o cambió de periodo → nueva vela
                if (!prevBar || ts >= prevBar.time + secondsPerCandle * 1000) {
                    const newBar = {
                        time: barStartTime,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: 0
                    };
                    this.lastBar[key] = newBar;
                    resultScanner = this.scanner.CreateNewBar(newBar);
                } else {
                    // Actualizar vela actual
                    prevBar.high = Math.max(prevBar.high, price);
                    prevBar.low = Math.min(prevBar.low, price);
                    prevBar.close = price;
                    prevBar.volume += 0.0001 || 0;
                    resultScanner = this.scanner.updateBars(prevBar);
                }

                // Guardar datos en localStorage (si usas persistencia)
                this.resultScanner = resultScanner;



                // Notificar al gráfico / TradingView
                sub.onRealtimeCallback(this.lastBar[key]);
            } catch (error) {
                console.error("Error procesando mensaje:", error);
            }
        };
    }


    async CryptoApiGetBars(from, to, resolution) {
        let allBars = [];
        let currentFrom = from;

        let granularity;
        let secondsPerCandle;

        const MAX_CANDLES = 350;

        switch (resolution) {
            case "1": granularity = "ONE_MINUTE"; secondsPerCandle = 60; break;
            case "5": granularity = "FIVE_MINUTE"; secondsPerCandle = 300; break;
            case "15": granularity = "FIFTEEN_MINUTE"; secondsPerCandle = 900; break;
            case "60": granularity = "ONE_HOUR"; secondsPerCandle = 3600; break;
            case "240": granularity = "SIX_HOUR"; secondsPerCandle = 21600; break;
            case "D":
            case "1D": granularity = "ONE_DAY"; secondsPerCandle = 86400; break;
            default: granularity = "FIVE_MINUTE"; secondsPerCandle = 300;
        }

        const maxRange = secondsPerCandle * MAX_CANDLES;

        while (currentFrom < to) {
            const currentTo = Math.min(currentFrom + maxRange, to);

            const url = `/api/coinbase/${this.ticker}?start=${currentFrom}&end=${currentTo}&granularity=${granularity}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.candles && data.candles.length > 0) {
                // Coinbase entrega DESCENDENTE → debemos invertirlo
                const ordered = data.candles.sort((a, b) => a.start - b.start);

                const bars = ordered.map(c => ({
                    time: c.start * 1000, // en ms
                    open: parseFloat(c.open),
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close),
                    volume: parseFloat(c.volume),
                }));

                allBars = allBars.concat(bars);
            }

            currentFrom = currentTo;
            await new Promise(r => setTimeout(r, 200));
        }
        return allBars;
    }
    async ForexApiGetBars(from, to, resolution) {
        let allbars = [];
        let granularity;

        const now = Math.floor(Date.now() / 1000);
        if (to > now) to = now;

        let fromDateFormat = new Date(from * 1000).toISOString();
        let toDateFormat = new Date(to * 1000).toISOString();
        switch (resolution) {
            case "1": granularity = "M1"; break;
            case "5": granularity = "M5"; break;
            case "15": granularity = "M15"; break;
            case "60": granularity = "H1"; break;
            case "240": granularity = "H6"; break;
            case "D":
            case "1D": granularity = "D"; break;
            default: granularity = "M5";
        }
        const url = `${this.baseUrlOANDA}/v3/instruments/${this.ticker}/candles?granularity=${granularity}&from=${fromDateFormat}&to=${toDateFormat}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();
        allbars = data.candles.map(x => ({
            time: new Date(x.time.replace("000000000", "000")).getTime(),// en ms
            open: parseFloat(x.mid.o),
            high: parseFloat(x.mid.h),
            low: parseFloat(x.mid.l),
            close: parseFloat(x.mid.c),
            volume: parseFloat(x.volume),
        }))
        return allbars
    }

    unsubscribeBars(subscriberUID) {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            delete this.subscribers[subscriberUID];
        }
    }
    GetResultScanner() {
        return this.resultScanner;
    }
    getAllBars() {
        return this.lastBar;
    }
}

window.UniversalDatafeed = UniversalDatafeed;
