// server.js
// where your node app starts

// init project
const https = require('https');
const express = require('express');
const contentful = require('contentful-management');
const chalk = require('chalk');
const Table = require('cli-table2');
const moment = require('moment');
// setup a new database
// persisted using async file storage
// Security note: the database is saved to the file `db.json` on the local filesystem.
// It's deliberately placed in the `.data` directory which doesn't get copied if someone remixes the project.
const app = express();

// contentful configuration
const SPACE_ID = process.env.SPACE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN;
const COINMARKETCAP_KEY = 'b606f249-ad00-49f5-8a21-2dcb8fe903ac';
const contentTypeId = 'coins';
const staleTimeLimitMinutes = 1;

const client = contentful.createClient({
  accessToken: PERSONAL_ACCESS_TOKEN
})

const idForName = function (name) {
  client.getSpace(SPACE_ID)
    .then((space) => space.getEntries())
    .then((result) => {
      const items = result.items.filter(item => item.fields.data['en-US'].name === name);
      const firstItemId = items[0].sys.id;
      return firstItemId;
    })
    .catch((error) => false);
}

const sendError = function (response, errObj) {
  const errorMsg = !!errObj.message ? errObj.message : 'An error occurred';
  response.send({result: errorMsg});
}

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/latestQuotes", function (request, response) {
  var optionsget = {
    host : 'pro-api.coinmarketcap.com', 
    path : "/v1/cryptocurrency/quotes/latest?id=1720",
    method : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-CMC_PRO_API_KEY': COINMARKETCAP_KEY
    }
  };
  var reqGet = https.request(optionsget, function(resp) {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        let jsonData = JSON.parse(data);
        // let deltaOneHour = jsonData.data['1720'].quote['USD'].percent_change_1h
        // return response.send(JSON.stringify(parseFloat(deltaOneHour)));
        return response.send(jsonData);
      });
  });

  reqGet.end();
  reqGet.on('error', function(e) {
    response.send({ err: e });
  });
});

app.get("/iotaGains", function (request, response) {
  https.get(`https://chrome-coin-alert.glitch.me/latestQuotes`, (resp) => {
    let data = '';
    
    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
        let jsonData = JSON.parse(data);
        let deltaOneHour = jsonData.data['1720'].quote['USD'].percent_change_1h
        return response.send(JSON.stringify(parseFloat(deltaOneHour)));
    });
  }).on("error", (err) => {
    response.send({ err: err });
  });
});

app.get("/oneFromName", function (request, response) {
  const name = request.query.name;
  if (!!!name) response.send({err: "name required"});
  https.get(`https://chrome-coin-alert.glitch.me/idForName?name=${name}`, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      if (!!!JSON.parse(data).id) sendError(response, {message: `No record for ${name}`});
      client.getSpace(SPACE_ID)
        .then((space) => space.getEntry(JSON.parse(data).id))
        .then((result) => {
          // const items = result.items.map(item => item.fields);
          const firstItem = !!result.count ? result.items[0] : result;
          const msTimeDiff = Date.now() - result.fields.timestamp['en-US'];
          const isStale = msTimeDiff > staleTimeLimitMinutes * 60 * 1000;
          
          // response.send({ price: '0.15' });
          if (isStale) {
            https.get(`https://api.binance.com/api/v3/avgPrice?symbol=${result.fields.pairSymbol['en-US']}`, (resp) => {
              let data = '';

              // A chunk of data has been recieved.
              resp.on('data', (chunk) => {
                data += chunk;
              });

              // The whole response has been received. Print out the result.
              resp.on('end', () => {
                https.get(`https://chrome-coin-alert.glitch.me/updateFromName?name=${name}&price=${JSON.parse(data).price}`, (resp) => {
                  let data = '';

                  // A chunk of data has been recieved.
                  resp.on('data', (chunk) => {
                    data += chunk;
                  });

                  // The whole response has been received. Print out the result.
                  resp.on('end', () => {
                    return response.send(data);
                  });
                }).on("error", (err) => {
                  response.send({ err: err });
                });
                // response.send(JSON.parse(data).price);
              });

            }).on("error", (err) => {
              response.send({ err: err });
            });
          } else {
            let resultResponse = firstItem.fields.data['en-US'];
            resultResponse.source = 'oneFromName';
            return response.send(resultResponse);
          }
        
        })
        .catch((error) => sendError(response, error));
    });
  }).on("error", (err) => {
    sendError(response, err);
  });
});

app.get("/all", function (request, response) {
  client.getSpace(SPACE_ID)
    .then((space) => space.getEntries())
    .then((result) => {
      const items = result.items.map(item => {
        // let item = item.fields;
        let itemFields = item.fields;
        itemFields.id = item.sys.id;
        return itemFields;
      });
      return response.send({result: result})
    })
    .catch((error) => response.send({result: error.message}));
});

app.get("/idForName", function (request, response) {
  if (!!!request.query.name) response.send({err: "name required"});
  client.getSpace(SPACE_ID)
    .then((space) => space.getEntries())
    .then((result) => {
      const items = result.items.filter(item => item.fields.data['en-US'].name === request.query.name);
      const firstItemId = items[0].sys.id;
      return response.send({id: firstItemId});
    })
    .catch((error) => sendError(response, error.message));
})

app.get("/updateFromName", function (request, response) {
  if (!!!request.query.name && !!!request.query.price) response.send({err: "name and price required"});
  https.get(`https://chrome-coin-alert.glitch.me/idForName?name=${request.query.name}&price=${request.query.price}}`, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        https.get(`https://chrome-coin-alert.glitch.me/update?id=${JSON.parse(data).id}&price=${request.query.price}`, (resp) => {
          let data = '';

          // A chunk of data has been recieved.
          resp.on('data', (chunk) => {
            data += chunk;
          });

          // The whole response has been received. Print out the result.
          resp.on('end', () => {
            const updateResponse = { 
              "source": "updateFromName",
              "name": request.query.name, 
              "price": request.query.price
            };
            response.send(JSON.stringify(updateResponse));
          });

        }).on("error", (err) => {
          response.send({ err: err });
        });
      });

    }).on("error", (err) => {
      response.send({ err: err });
    });
});

app.get("/init", function (request, response) {
  if (!!!request.query.name && !!!request.query.price && !!!request.query.pairSymbol) response.send({err: "name, price and pairSymbol are required"});
  
  client.getSpace(SPACE_ID)
    .then((space) => space.createEntry(contentTypeId, {
      fields: {
        timestamp: {
          'en-US': Date.now()
        },
        name: {
          'en-US': request.query.name
        },
        data: {
          'en-US': {
            'name': request.query.name,
            'price': request.query.price,
          }
        },
        pairSymbol: {
          'en-US': request.query.pairSymbol
        },
      }
    }))
    .then((entry) => response.send({result: `Entry ${entry.sys.id} created.`}))
    .catch((error) => sendError(response, error));
});

app.get("/update", function (request, response) {
  const id = request.query.id || "DSwrb07m8T5wfF6kPjxvT";
  const price = request.query.price || "0.035";
  client.getSpace(SPACE_ID)
    .then((space) => space.getEntry(id))
    .then((entry) => {
      entry.fields.data['en-US'].price = price;
      entry.fields.timestamp['en-US'] = Date.now();
      return entry.update();
    })
    .then((entry) => response.send({result: `Entry ${entry.sys.id} updated.`}))
    .catch(console.error);
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});