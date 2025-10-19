class RetrocesoScanner {
    constructor({ swingLen = 10, emaLen = 50, extendBars = 200, labelOffsetBars = 4 } = {}) {
        this.swingLen = swingLen
        this.emaLen = emaLen
        this.extendBars = extendBars
        this.labelOffsetBars = labelOffsetBars

        //gobal variables
        this.bars = [];
        this.totalBars = [];
        this.emaValues = [];

        // Fibos
        this.fib0_ = null;
        this.fib35_ = null;
        this.fib60_ = null;
        this.fib95_ = null;
        this.fib100_ = null;
        this.fib40_ = null;

        // Estado del setup
        this.setupActivo = false;
        this.esperando40 = false;
        this.esAlcista = false;

        // OB/FVG
        this.obEncontrado_ = false;
        this.obTop_ = null;
        this.obBottom_ = null;
        this.obTime = null;
        this.fvgEncontrado_ = false;
        this.fvgTop_ = null;
        this.fvgBottom_ = null;
        this.fvgTime = null;
        this.result = null;
        this.count = 0;
    }
    clean() {
        this.result = null;
    }
    CalculateEMA(data, length, pricescale = 100) {
        if (!data || data.length < length) return [];

        const alpha = 2 / (length + 1);
        const emaArray = new Array(data.length).fill(null);

        let ema = data.slice(0, length).reduce((a, b) => a + b, 0) / length;
        emaArray[length - 1] = Math.round(ema * pricescale) / pricescale;

        for (let i = length; i < data.length; i++) {
            ema = alpha * data[i] + (1 - alpha) * ema;
            emaArray[i] = Math.round(ema * pricescale) / pricescale;
        }

        return emaArray;
    }
    GetLowValue(len) {

        const barsSlice = this.bars.slice(-len).map(x => x.low);
        return barsSlice.sort((a, b) => a - b);
    }
    GetHighValue(len) {

        const barsSlice = this.bars.slice(-len).map(x => x.high);
        return barsSlice.sort((a, b) => b - a);
    }
    ta_highest_series(source, length) {
        const result = [];

        for (let i = 0; i < source.length; i++) {
            if (i < length - 1) {
                result.push(null);
            } else {
                const slice = source.slice(i - length + 1, i + 1);
                result.push(Math.max(...slice));
            }
        }

        return result;
    }
    ta_lowest_series(source, length) {
        const result = [];

        for (let i = 0; i < source.length; i++) {
            if (i < length - 1) {
                result.push(null); // aún no hay suficientes datos
            } else {
                const slice = source.slice(i - length + 1, i + 1);
                result.push(Math.min(...slice));
            }
        }

        return result;
    }
    EvaluaterBar(bar) {
        if (this.bars.length < 20) {
            return null; // No hay suficientes barras para evaluar
        }
        //Swing High/Low
        let lowestBar = this.ta_lowest_series(this.bars.map(x => x.low), this.swingLen)
        let highestBar = this.ta_highest_series(this.bars.map(x => x.high), this.swingLen);

        let closesBar = this.bars.map(b => b.close);
        let emaValArray = this.CalculateEMA(closesBar, this.emaLen)
        //Persistencia: mantener hasta 0% (TP2) o 95% (SL)
        if (this.setupActivo) {
            if (this.esAlcista) {
                if (bar.high >= this.fib0_ || bar.low <= this.fib95_) {
                    this.setupActivo = false;
                    this.clean();
                }
                //funcion cleanUp
            } else {
                if (bar.low <= this.fib0_ || bar.high >= this.fib95_) {

                    this.setupActivo = false;
                    this.clean();
                }
            }
        }
        //Filtro Ema
        let bullBreak = bar.high > highestBar[highestBar.length - 2];

        let bearBreak = bar.low < lowestBar[lowestBar.length - 2];
        let alcistaPermitido = bar.close > emaValArray[emaValArray.length - 1];

        let bajistaPermitido = bar.close < emaValArray[emaValArray.length - 1];

        // ===== Rompimiento alcista → preparar (arriba de EMA y FUERA del 60%)
        if (!this.setupActivo && bullBreak && alcistaPermitido) {
            this.fib0_ = bar.high;
            this.fib100_ = lowestBar[lowestBar.length - 1];
            let rng = this.fib0_ - this.fib100_;

            this.fib35_ = this.fib0_ - rng * 0.35;
            this.fib60_ = this.fib0_ - rng * 0.60;
            this.fib95_ = this.fib0_ - rng * 0.95;
            this.fib40_ = this.fib0_ - rng * 0.40;

            this.obEncontrado_ = false;
            this.obTop_ = null;
            this.obBottom_ = null;
            this.fvgEncontrado_ = false;
            this.fvgTop_ = null;
            this.fvgBottom_ = null;

            // === Buscar OB alcista ===
            for (let i = 1; i <= this.swingLen; i++) {
                const index = this.bars.length - 1 - i;
                const bar = this.bars[index];
                if (!bar) continue;

                if (
                    bar.close < bar.open &&     // vela roja
                    bar.high <= this.fib60_ &&
                    bar.low >= this.fib100_
                ) {

                    this.obEncontrado_ = true;
                    this.obTop_ = bar.high;
                    this.obBottom_ = bar.low;
                    this.obTime = bar.time;

                    break;
                }
            }

            // === Buscar FVG alcista ===
            for (let i = 1; i <= this.swingLen; i++) {
                const index = this.bars.length - 1 - i;
                const bar = this.bars[index];
                const bar2 = this.bars[index - 2];
                if (!bar || !bar2) continue;

                if (
                    bar.low > bar2.high &&      // gap alcista
                    bar.high <= this.fib60_ &&
                    bar.low >= this.fib100_
                ) {

                    this.fvgEncontrado_ = true;
                    this.fvgTop_ = bar.high;
                    this.fvgBottom_ = bar.low;
                    this.fvgTime = bar.time;

                    break;
                }
            }
            this.esperando40 = true;
            this.esAlcista = true;
        }
        // ===== Confirmar 40% alcista — SIEMPRE desde 0–40
        if (this.esperando40 && this.esAlcista && !this.setupActivo) {
            if (this.bars[this.bars.length - 2].close > this.fib40_ && bar.low <= this.fib40_) {
                if (this.obEncontrado_ || this.fvgEncontrado_) {
                    this.clean();
                    this.setupActivo = true;
                    this.esperando40 = false;

                    let slPts = Math.abs(this.fib60_ - this.fib95_);
                    let tp2Pts = Math.abs(this.fib60_ - this.fib0_);
                    let slPips = slPts / 0.01;
                    let tp2Pips = tp2Pts / 0.01;
                    let time = this.findTimeofLowestNumber(this.fib100_);

                    this.result = {
                        type: "long",
                        fibs: {
                            fib0: this.fib0_,
                            fib35: this.fib35_,
                            fib60: this.fib60_,
                            fib95: this.fib95_,
                            fib100: this.fib100_,
                            fib40: this.fib40_,
                            time
                        },
                        ob: this.obEncontrado_ ? { top: this.obTop_, bottom: this.obBottom_, time: this.obTime } : null,
                        fvg: this.fvgEncontrado_ ? { top: this.fvgTop_, bottom: this.fvgBottom_, time: this.fvgTime } : null,
                        labels: {
                            TP2: this.fib0_,
                            TP1: this.fib35_,
                            PE: this.fib60_,
                            SL: this.fib95_,
                            TP2Pips: tp2Pips,
                            SLPips: slPips
                        }
                    };
                }


            }
        }
        // ===== Rompimiento bajista → preparar (abajo de EMA y FUERA del 60%)
        if (!this.setupActivo && bearBreak && bajistaPermitido) {
            this.fib0_ = bar.low;
            this.fib100_ = highestBar[highestBar.length - 1];
            let rng = this.fib100_ - this.fib0_;

            this.fib35_ = this.fib0_ + rng * 0.35;
            this.fib60_ = this.fib0_ + rng * 0.60;
            this.fib95_ = this.fib0_ + rng * 0.95;
            this.fib40_ = this.fib0_ + rng * 0.40;

            if (bar.close < this.fib60_) {
                this.obEncontrado_ = false;
                this.obTop_ = null;
                this.obBottom_ = null;
                this.fvgEncontrado_ = false;
                this.fvgTop_ = null;
                this.fvgBottom_ = null;
                // === Buscar OB bajista ===
                for (let i = 1; i <= this.swingLen; i++) {
                    const index = this.bars.length - 1 - i;
                    const bar = this.bars[index];
                    if (!bar) continue;

                    if (
                        bar.close > bar.open &&     // vela verde
                        bar.low >= this.fib60_ &&   // dentro del rango fibo bajista
                        bar.high <= this.fib100_
                    ) {

                        this.obEncontrado_ = true;
                        this.obTop_ = bar.high;
                        this.obBottom_ = bar.low;
                        this.obTime = bar.time;
                        break; // detenerse al primer OB válido
                    }
                }

                // === Buscar FVG bajista ===
                for (let i = 1; i <= this.swingLen; i++) {
                    const index = this.bars.length - 1 - i;
                    const bar = this.bars[index];
                    const bar2 = this.bars[index - 2];
                    if (!bar || !bar2) continue;

                    if (
                        bar.high < bar2.low &&      // gap bajista
                        bar.low >= this.fib60_ &&   // dentro del rango fibo
                        bar.high <= this.fib100_
                    ) {

                        this.fvgEncontrado_ = true;
                        this.fvgTop_ = bar.high;
                        this.fvgBottom_ = bar.low;
                        this.fvgTime = bar.time;
                        break; // detenerse al primer FVG válido
                    }
                }
                this.esperando40 = true;
                this.esAlcista = false;
            }
        }
        //===== Confirmar 40% bajista — SIEMPRE desde 0–40
        if (this.esperando40 && !this.esAlcista && !this.setupActivo) {
            if (this.bars[this.bars.length - 2].close < this.fib40_ && bar.high >= this.fib40_) {
                if (this.obEncontrado_ || this.fvgEncontrado_) {
                    this.clean();
                    this.setupActivo = true;
                    this.esperando40 = false;
                    let slPts = Math.abs(this.fib60_ - this.fib95_);
                    let tp2Pts = Math.abs(this.fib60_ - this.fib0_);
                    let slPips = slPts / 0.01;
                    let tp2Pips = tp2Pts / 0.01;
                    let time = this.findTimeofHigestNumer(this.fib100_);

                    this.result = {
                        type: "short",
                        fibs: {
                            fib0: this.fib0_,
                            fib35: this.fib35_,
                            fib60: this.fib60_,
                            fib95: this.fib95_,
                            fib100: this.fib100_,
                            fib40: this.fib40_,
                            time
                        },
                        ob: this.obEncontrado_ ? { top: this.obTop_, bottom: this.obBottom_, time: this.obTime } : null,
                        fvg: this.fvgEncontrado_ ? { top: this.fvgTop_, bottom: this.fvgBottom_, time: this.fvgTime } : null,
                        labels: {
                            TP2: this.fib0_,
                            TP1: this.fib35_,
                            PE: this.fib60_,
                            SL: this.fib95_,
                            TP2Pips: tp2Pips,
                            SLPips: slPips
                        }
                    };
                }
            }
        }

        return this.result;

    }
    fillbars(bars) {
        this.bars = [];

        for (let i = 0; i < bars.length; i++) {
            this.bars.push(bars[i]);
            this.EvaluaterBar(bars[i]);

        }
        return this.result;
    }
    updateBars(bar) {
        this.bars[this.bars.length - 1] = bar;

        return this.EvaluaterBar(bar);
    }
    CreateNewBar(bar) {
        this.bars.push(bar);

        return this.EvaluaterBar(bar);
    }
    findTimeofHigestNumer(highVal) {
        if (!this.bars || this.bars.length === 0) return null;

        let closestBar = this.bars[this.bars.length - 1];
        let minDiff = Math.abs(closestBar.high - highVal);

        // 🔁 Recorre desde el final hacia el inicio
        for (let i = this.bars.length - 2; i >= 0; i--) {
            const diff = Math.abs(this.bars[i].high - highVal);
            if (diff < minDiff) {
                minDiff = diff;
                closestBar = this.bars[i];
            }
        }

        return closestBar.time;
    }
    findTimeofLowestNumber(lowVal) {
        if (!this.bars || this.bars.length === 0) return null;

        // Empezamos desde la última barra
        let closestBar = this.bars[this.bars.length - 1];
        let minDiff = Math.abs(closestBar.low - lowVal);

        // 🔁 Recorre desde el final hacia el inicio
        for (let i = this.bars.length - 2; i >= 0; i--) {
            const diff = Math.abs(this.bars[i].low - lowVal);
            if (diff < minDiff) {
                minDiff = diff;
                closestBar = this.bars[i];
            }
        }

        return closestBar.time;
    }


}