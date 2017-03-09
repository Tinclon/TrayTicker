const {app, Tray, shell} = require("electron");
const request = require('request');
const numeral = require('numeral');
const spinner = ["⠿","⠷","⠶","⠦","⠤","⠄","⠀"];
const refreshms = 300000;

const tickers = {
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
        data = {
            price: {f: "$,00.00"},
            change: {f: "$,0.00"},
            percent: {f: "0,0.00%"},
            amount: {f: "$,0.00"}
        };

    let spinnerIndex = -1,
        showDiff = false,
        display = "price";

    tray.on('right-click', function handleClicked () {
        shell.openExternal("https://www.google.com/finance?q=" + ticker.q);
    });
    tray.on('click', function handleClicked () {
        if (display === "price") { display = "change"; }
        else if (display === "change") { display = "percent"; }
        else if (display === "percent") { ticker.s ? display = "amount" : display = "price" }
        else if (display === "amount") { display = "price"; }

        setDisplayValues();
    });

    function setCurrentPrice() {
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
                setDisplayValues();
                if(showDiff) {
                    setTimeout(() => { setDisplayValues(); }, 30000);
                }
            } else {
                tray.setTitle(spinner[spinnerIndex] + "Error: " + (response && response.statusCode || "No Response"));
                console.log("Error: " + (response && response.statusCode || "No Response: " + error));
            }
        });
    }

    function setDisplayValues() {
        const text = numeral(data[display].v).format(data[display].f) +
            (!showDiff ? "" :
                numeral(data[display].v - data["old" + display].v)
                    .format(" +" + data[display].f.replace(/[$%]/,""))
                    .replace(/\+/,"⤴").replace(/-/,"⤵"));

        tray.setTitle(spinner[spinnerIndex] + text);
        tray.setToolTip(text);
    }

    function fetchPrice(delay) {
        setTimeout(() => {
            spinnerIndex = (spinnerIndex + 1)%spinner.length;
            if (spinnerIndex === 0) {
                setCurrentPrice();
            } else {
                setDisplayValues();
            }
            fetchPrice(refreshms / spinner.length);
        }, delay);
    }

    fetchPrice(0);
}

app.dock.hide();
app.on("ready", () => {
    for (let key in tickers) {
        if (tickers.hasOwnProperty(key)) {
            createTicker(tickers[key]);
        }
    }
});


