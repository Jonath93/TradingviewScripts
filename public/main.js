

document.addEventListener("DOMContentLoaded", function () {
  let symbol = "BTC-USD";
  let interval = "15";
  let dataFeed = new UniversalDatafeed("crypto", symbol);
  let ChartCreates = [];




  //cripto Chart widget
  const drp_cripto = document.getElementById("drp_criptp");
  const drp_Time = document.getElementById("drp_time");

  let cryptoWidget = new TradingView.widget({
    container: "chart_cripto",
    library_path: "/charting_library/",
    symbol: symbol,  // ⚡️ aquí ya tu símbolo real
    interval: interval,      // carga inicial en 15m
    autosize: true,
    datafeed: dataFeed,
    locale: "en",
    supportOrderBrackets: true,
    disabled_features: [
      "header_symbol_search",
      "header_compare",
      "timeframes_toolbar",
      "use_localstorage_for_settings",
      "create_study_template",
      "save_chart_properties_to_local_storage",
      "study_templates",
      "header_resolutions"

    ],
    overrides: {
      "paneProperties.legendProperties.showSeriesTitle": false,
      "paneProperties.legendProperties.showLegend": true, // mantiene los valores OHLC visibles
      "symbolWatermarkProperties.color": "rgba(0,0,0,0)",
    },
    enabled_features: ["study_templates"],
    // Configuración de la barra lateral (si aplica)
    drawings_access: {
      type: 'black', // 'black' o 'white'
      tools: [
        {
          name: "Chart.LineTool.RiskReward.Reverse", // Herramienta de Posición Corta Inversa
          visible: true,
        },
        // ... otras herramientas
      ]
    },
    time_frames: [
      { text: "2M", resolution: "15", description: "Últimos 2 meses" }
    ],

  });
  cryptoWidget.onChartReady(() => {
    const chart = cryptoWidget.activeChart();

    // 🔍 Buscar y eliminar el estudio de volumen
    chart.getAllStudies().forEach(study => {
      if (study.name.toLowerCase().includes("volume")) {
        chart.removeEntity(study.id); // quita el estudio de volumen
      }
    });

  });

  function ChargeNewWidget() {
    let selectedSymbol = drp_cripto.value;
    let time = drp_Time.value;
    dataFeed = new UniversalDatafeed("crypto", selectedSymbol);
    symbol = selectedSymbol
    interval = time

    cryptoWidget = new TradingView.widget({
      container: "chart_cripto",
      library_path: "/charting_library/",
      symbol: symbol,  // ⚡️ aquí ya tu símbolo real
      interval: interval,      // carga inicial en 15m
      autosize: true,
      datafeed: dataFeed,
      locale: "en",
      supportOrderBrackets: true,
      disabled_features: [
        "header_symbol_search",
        "header_compare",
        "timeframes_toolbar",
        "use_localstorage_for_settings",
        "create_study_template",
        "save_chart_properties_to_local_storage",
        "study_templates",
        "header_resolutions",
        "volume_force_overlay",
        "show_volume_force_overlay",
      ],
      overrides: {
        "paneProperties.legendProperties.showSeriesTitle": false,
        "paneProperties.legendProperties.showLegend": true, // mantiene los valores OHLC visibles
        "symbolWatermarkProperties.color": "rgba(0,0,0,0)",
      },
      enabled_features: [],
      drawings_access: {
        type: 'black',
        tools: [
          {
            name: "Chart.LineTool.RiskReward.Reverse",
            visible: true,
          },
        ]
      },
      time_frames: [
        { text: "2M", resolution: "60", description: "Últimos 2 meses" }
      ],

    });

    cryptoWidget.onChartReady(() => {
      const chart = cryptoWidget.activeChart();

      // 🔍 Buscar y eliminar el estudio de volumen
      chart.getAllStudies().forEach(study => {
        if (study.name.toLowerCase().includes("volume")) {
          chart.removeEntity(study.id); // quita el estudio de volumen
        }
      });

    });
  }

  //change symbol 
  drp_cripto.addEventListener("change", function () {
    ChargeNewWidget()


  });



  drp_Time.addEventListener("change", function () {
    ChargeNewWidget()
  });
  // Evaluar cada 4 segundos
  setInterval(() => {
    const chart = cryptoWidget.activeChart();
    const ResultScanner = dataFeed.GetResultScanner()

    if (ResultScanner) {
      if (Object.keys(ResultScanner).length !== 0) {
        dibujarSetup(chart, ResultScanner);

      }

    } else {
      CleanChartsHelper(chart);
    }



  }, 5000);

  //funcions 
  function dibujarSetup(chart, setup) {
    CleanChartsHelper(chart);
    const { fibs, ob, fvg, labels } = setup;
    crearLinea(chart, fibs.fib0, "#66cc00", "TP2", fibs.time);
    crearLinea(chart, fibs.fib35, "#66cc00", "TP1", fibs.time);
    crearLinea(chart, fibs.fib60, "#0099ff", "PE", fibs.time);
    crearLinea(chart, fibs.fib95, "#ff0000", "SL", fibs.time);
    crearLinea(chart, fibs.fib100, "#999999", "100%", fibs.time, true);

    crearLabel(chart, fibs.fib0, `TP2:${redondear2Decimales(labels.TP2)} \npips:${extraerTresDigitos(labels.TP2Pips.toString())}`, "#66cc00", fibs.time);
    crearLabel(chart, fibs.fib35, `TP1:${redondear2Decimales(labels.TP1)}`, "#66cc00", fibs.time);
    crearLabel(chart, fibs.fib60, `PE:${redondear2Decimales(labels.PE)}`, "#0099ff", fibs.time);
    crearLabel(chart, fibs.fib95, `SL:${redondear2Decimales(labels.SL)} \npips:${extraerTresDigitos(labels.SLPips.toString())}`, "#ff0000", fibs.time);

    if (ob) {
      crearCaja(chart, ob.top, ob.bottom, "#ff3333", 0.4, ob.time);
    }
    if (fvg) {
      crearCaja(chart, fvg.top, fvg.bottom, "#ffff00", 0.4, fvg.time);
    }
  }



  // === Helpers gráficos ===
  function crearLinea(chart, price, color, name, time, dotted = false) {
    const visible = chart.getVisibleRange();
    if (!visible) return;
    const now = Math.floor(time / 1000);
    const leftTime = visible.to;
    const shape = chart.createMultipointShape(
      [
        { time: now, price },
        { time: leftTime, price }
      ],
      {
        shape: "trend_line",
        overrides: {
          linecolor: color,
          linestyle: dotted ? 2 : 0,
          linewidth: 2,

        }
      }
    ).then(id => {
      ChartCreates.push(id); // aquí sí tienes el ID real
    });
  }


  function crearLabel(chart, price, text, color = "#ffffff", time) {
    const visible = chart.getVisibleRange();
    if (!visible) return;
    const leftTime = visible.to + 16000;

    const now = Math.floor(time / 1000);
    chart.createMultipointShape(
      [{ time: leftTime, price }],
      {
        shape: "comment",
        text: text,
        overrides: {
          color: "#fff",
          backgroundColor: color,  // fondo rojo (puedes cambiar tono)
          fontsize: 12,
          bold: true,
          borderColor: color
        }
      }
    ).then(id => {
      ChartCreates.push(id); // aquí sí tienes el ID real
    });
  }

  function crearCaja(chart, top, bottom, color, opacity = 0.3, time) {
    const now = Math.floor(time / 1000);
    chart.createMultipointShape(
      [
        { time: now, price: top },
        { time: now + 26000, price: bottom }
      ],
      {
        shape: "rectangle",
        overrides: {
          color: color,           // borde
          backgroundColor: color, // relleno
          transparency: (1 - opacity) * 100
        }
      }
    ).then(id => {
      ChartCreates.push(id); // aquí sí tienes el ID real
    });
  }

  function extraerTresDigitos(numStr) {
    // Asegura que sea número válido
    const num = Number(numStr);
    if (isNaN(num)) return null;

    // Caso 1: número menor a 1 (tiene decimales relevantes)
    if (num < 1 && num > 0) {
      return Math.floor(num * 10000); // multiplica por 10000 para captar "0.0236" → 236
    }

    // Caso 2: número mayor o igual a 1
    return Math.floor(num / Math.pow(10, Math.floor(Math.log10(num)) - 2));
  }

  function redondear2Decimales(valor) {
    // Convierte el valor a número, redondea y elimina ceros innecesarios
    return parseFloat(parseFloat(valor).toFixed(2));
  }
  function CleanChartsHelper(chart) {
    ChartCreates.forEach(id => chart.removeEntity(id));
    ChartCreates = []; // limpia la lista
  }
});