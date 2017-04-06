const {app, Tray, /*BrowserWindow,*/ TouchBar, shell} = require("electron");
const {TouchBarButton, TouchBarLabel} = TouchBar;
const request = require('request');
const numeral = require('numeral');
//const spinner = ["⠿","⠷","⠶","⠦","⠤","⠄","⠀"];
const spinner = ["⦙","⫶","𝄈","ᐧ"," "];
const refreshms = 300000;

const tickerConfig = {
    btc: {
        q: "CURRENCY:BTCUSD",
        i: "btc@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    dowjones: {
        q: "INDEXDJX:.DJI",
        i: "dowjones@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    nasdaq: {
        q: "INDEXNASDAQ:.IXIC",
        i: "nasdaq@2x.png",
        s: 1				// <<- Enter number of 'shares' you own here
    },
    cadusd: {
        q: "CURRENCY:USDCAD",
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

    function fetchCurrentPrice(spinnerIndex) {
        for (let key in data) {
            if(data.hasOwnProperty(key) && !key.startsWith("old")) {
                data["old"+key] = JSON.parse(JSON.stringify(data[key]));
            }
        }

        // Using Google Finance (deprecated, but still seems to be working)
        request("http://www.google.com/finance/info?infotype=infoquoteall&q=" + ticker.q, function (error, response, body) {
            if (!error && response && response.statusCode === 200) {
                const finance = JSON.parse(body.replace("// [", "").replace("]",""));

                data.price.v = parseFloat(finance.l.replace(/,/,""));
                data.change.v = parseFloat(finance.c);
                data.percent.v = parseFloat(finance.cp) / 100.0;
                data.amount.v = data.price.v * ticker.s;

                showDiff = Math.abs(data.oldprice.v - data.price.v) > 0.01;
                updateDisplay(spinnerIndex);
                showDiff && setTimeout(() => (showDiff = !showDiff), (refreshms / 10));
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

    function updateDisplay(spinnerIndex) {
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

    let spinnerIndex = -1;
    function fetchPrice(delay) {
        setTimeout(() => {
            spinnerIndex = (++spinnerIndex) % spinner.length;
            fetchPrice(refreshms / spinner.length);
            tickers.forEach(ticker => spinnerIndex === 0 && ticker.fetchCurrentPrice(spinnerIndex) || ticker.updateDisplay(spinnerIndex));
        }, delay);
    }

    fetchPrice(0);
});


