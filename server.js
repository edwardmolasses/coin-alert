// server.js
// where your node app starts

// init project
const https = require('https');
const express = require('express');
// const contentful = require('contentful');
const contentful = require('contentful-management');
const chalk = require('chalk');
const Table = require('cli-table2');
const moment = require('moment');
// setup a new database
// persisted using async file storage
// Security note: the database is saved to the file `db.json` on the local filesystem.
// It's deliberately placed in the `.data` directory which doesn't get copied if someone remixes the project.
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('.data/db.json');
const db = low(adapter);
const app = express();

// contentful configuration
const SPACE_ID = process.env.SPACE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN;
const contentTypeId = 'coins';

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

// default user list
db.defaults({ coins: [
      { "coin":"IOTA", "price":false }
    ]
  }).write();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/coins", function (request, response) {
  var dbUsers=[];
  var coins = db.get(contentTypeId).value() // Find all coins in the collection
  coins.forEach(function(coin) {
    dbUsers.push([coin.name,coin.price]); // adds their info to the dbUsers value
  });
  response.send(dbUsers); // sends dbUsers back to the page
});

// update an entry in the coin collection with the submitted values
app.post("/coins", function (request, response) {
  db.get(contentTypeId)
    .find({ name: request.query.fName })
    .assign({ price: request.query.lName })
    .write()
  console.log("New coin inserted in the database");
  response.sendStatus(200);
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
          const isStale = msTimeDiff > 60 * 1000;
          
          if (isStale) {
            // response.send({ price: '111' });
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

// removes entries from users and populates it with default users
app.get("/reset", function (request, response) {
  // removes all entries from the collection
  db.get(contentTypeId)
  .remove()
  .write()
  console.log("Database cleared");
  
  // default users inserted in the database
  var coins= [
      {"name":"IOTA", "price":false}
  ];
  
  coins.forEach(function(coin){
    db.get(contentTypeId)
      .push({ name: coin.name, price: coin.price })
      .write()
  });
  console.log("Default users added");
  response.redirect("/");
});

// removes all entries from the collection
app.get("/clear", function (request, response) {
  // removes all entries from the collection
  db.get(contentTypeId)
  .remove()
  .write()
  console.log("Database cleared");
  response.redirect("/");
});

// const client = contentful.createClient({
//   // This is the space ID. A space is like a project folder in Contentful terms
//   space: SPACE_ID,
//   // This is the access token for this space. Normally you get both ID and the token in the Contentful web app
//   accessToken: ACCESS_TOKEN
// })

// app.get("/all", function (request, response) {
//   client.getEntries({
//       content_type: "coins"
//   })
//   .then((result) => {
//     const items = result.items.map(item => item.fields);
//     return response.send({result: items});
//   })
//   .catch((error) => {
//     response.send({result: error.message})
//   })
// });

// app.get("/one", function (request, response) {
//   client.getEntries({
//     'fields.name': 'IOTA',
//     'content_type': 'coins'
//   })
//   .then((result) => {
//     const items = result.items.map(item => item.fields);
//     return response.send({result: items});
//   })
//   .catch((error) => {
//     response.send({result: error.message})
//   })
// });

// app.get('/price', (request, response) => {
//   response.setHeader('Content-Type', 'application/json');
//   response.header("Access-Control-Allow-Origin", "*");
//   response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  
//   https.get('https://api.binance.com/api/v3/avgPrice?symbol=IOTAUSDT', (resp) => {
//     let data = '';

//     // A chunk of data has been recieved.
//     resp.on('data', (chunk) => {
//       data += chunk;
//     });

//     // The whole response has been received. Print out the result.
//     resp.on('end', () => {
//       db.get('coins')
//         .find({ name: 'IOTA' })
//         .assign({ price: data.price })
//         .write();
//       response.send(data);
//     });

//   }).on("error", (err) => {
//     response.send({ err: err });
//   });
// });

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});