const {app, Tray, /*BrowserWindow,*/ TouchBar, shell} = require("electron");
const {TouchBarButton, TouchBarLabel} = TouchBar;
const request = require('request');
const numeral = require('numeral');
const refreshms = 300000;
//const spinner = ["⠿","⠷","⠶","⠦","⠤","⠄","⠀"];
const spinner = ["⦙","⫶","𝄈","ᐧ"," "];
let spinnerIndex = -1;

const tickerConfig = {
    btc: {
        q: "BTCUSD=X",  // <- For Yahoo    // "CURRENCY:BTCUSD",    // <- For Google
        i: "btc@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    dowjones: {
        q: "^DJI",      // <- For Yahoo     // "INDEXDJX:.DJI",     // <- For Google
        i: "dowjones@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    nasdaq: {
        q: "^IXIC",     // <- For Yahoo     // "INDEXNASDAQ:.IXIC", // <- For Google
        i: "nasdaq@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    cadusd: {
        q: "USDCAD=X",  // <- For Yahoo     // "CURRENCY:USDCAD",   // <- For Google
        i: "usdcad@2x.png"
    }
};

function createTicker(ticker){
    const tray = new Tray(ticker.i),
        touchBarButton = new TouchBarButton({icon: ticker.i}),
        touchBarLabel = new TouchBarLabel({label: ""}),
        data = {
            price: {f: "$,00.00"},
            change: {f: "$,0.00"},
            percent: {f: "0,0.00%"},
            amount: {f: "$,0.00"}
        };

    let showDiff = false,
        display = "price";

    tray.on('right-click', function handleClicked () {
        shell.openExternal("https://www.google.com/finance?q=" + ticker.q);
    });
    tray.on('click', function handleClicked () {
        if (display === "price") { display = "change"; }
        else if (display === "change") { display = "percent"; }
        else if (display === "percent") { ticker.s ? display = "amount" : display = "price" }
        else if (display === "amount") { display = "price"; }

        updateDisplay();
    });

    function fetchCurrentPrice() {
        for (let key in data) {
            if(data.hasOwnProperty(key) && !key.startsWith("old")) {
                data["old"+key] = JSON.parse(JSON.stringify(data[key]));
            }
        }

        // Using Google Finance (deprecated, but still seems to be working)
        /*
        request("http://www.google.com/finance/info?infotype=infoquoteall&q=" + ticker.q, function (error, response, body) {
            if (!error && response && response.statusCode === 200) {
                const finance = JSON.parse(body.replace("// [", "").replace("]",""));

                data.price.v = parseFloat(finance.l.replace(/,/,""));
                data.change.v = parseFloat(finance.c);
                data.percent.v = parseFloat(finance.cp) / 100.0;
                data.amount.v = data.price.v * ticker.s;

                showDiff = Math.abs(data.oldprice.v - data.price.v) > 0.01;
                updateDisplay();
                showDiff && setTimeout(() => (showDiff = !showDiff), (refreshms / 10));
            } else {
                tray.setTitle(`${spinner[spinnerIndex]}Error: ${(response && response.statusCode || "No Response")}`);
            }
        });
        */

        // Using Yahoo Finance (returns less data than google, but at least it's still working)
        request("https://query1.finance.yahoo.com/v8/finance/chart/" + ticker.q + "?range=1d&interval=5m", function (error, response, body) {
            if (!error && response && response.statusCode === 200) {
                const finance = JSON.parse(body);

                if (finance && finance.chart && finance.chart.result && finance.chart.result[0] &&
                    finance.chart.result[0].indicators && finance.chart.result[0].indicators.quote &&
                    finance.chart.result[0].indicators.quote[0] && finance.chart.result[0].indicators.quote[0].open) {

                    let opens = finance.chart.result[0].indicators.quote[0].open.filter(open => open);
                    let index = Math.max(0, opens.length - 1);
                    data.price.v = parseFloat(opens[index]) / parseFloat(ticker.d || 1.0);
                    data.change.v = 0;  // TODO: Figure out how to get change data from Yahoo
                    data.percent.v = 0; // TODO: Figure out how to get percent data from Yahoo
                    data.amount.v = data.price.v * ticker.s * parseFloat(ticker.d || 1.0);

                    showDiff = Math.abs(data.oldprice.v - data.price.v) > 0.01;
                    updateDisplay();
                    showDiff && setTimeout(() => (showDiff = !showDiff), (refreshms / 10));
                }
            } else {
                tray.setTitle(`${spinner[spinnerIndex]}Error: ${(response && response.statusCode || "No Response")}`);
            }
        });
    }

    function decimalToSuper(number) {
        let numberWithSuperDecimal = number.substring(0, number.indexOf("."));
        for (let i = number.indexOf("."); i < number.length; i++) {
            numberWithSuperDecimal += (number.charCodeAt(i) > 47 && number.charCodeAt(i) < 58 && "⁰¹²³⁴⁵⁶⁷⁸⁹"[number.charCodeAt(i) - 48] || number[i]);
        }
        return numberWithSuperDecimal;
    }

    function updateDisplay() {
        const text = decimalToSuper(numeral(data[display].v).format(data[display].f)) +
            (!showDiff ? "" :
                decimalToSuper(numeral(data[display].v - data["old" + display].v)
                    .format(" +" + data[display].f.replace(/[$%]/,""))
                    .replace(/\+/,"⤴").replace(/-/,"⤵")));

        tray.setTitle(spinner[spinnerIndex] + text);
        tray.setToolTip(text);
        touchBarLabel.label = spinner[spinnerIndex] + text;
    }

    return {
        tray: tray,
        touchBarButton: touchBarButton,
        touchBarLabel: touchBarLabel,
        updateDisplay: updateDisplay,
        fetchCurrentPrice: fetchCurrentPrice

    };
}

app.dock.hide();
app.on("ready", () => {
	process.title = "tray-ticker"; // Note, this doesn't seem to work. It's still just called 'Electron' in the activity monitor
    const tickers = [];
    for (let key in tickerConfig) {
        if (tickerConfig.hasOwnProperty(key)) {
            tickers.push(createTicker(tickerConfig[key]));
        }
    }
    /*
    const touchBar = new TouchBar(touchBarItems);
    const window = new BrowserWindow({width: 200, height: 200}); //frame: false, transparent: true, alwaysOnTop: true
    window.setTouchBar(touchBar);
    */

    function fetchPrice(delay) {
        setTimeout(() => {
            spinnerIndex = (++spinnerIndex) % spinner.length;
            fetchPrice(refreshms / spinner.length);
            tickers.forEach(ticker => spinnerIndex === 0 && ticker.fetchCurrentPrice() || ticker.updateDisplay());
        }, delay);
    }

    fetchPrice(0);
});


