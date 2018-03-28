'use strict';

const envvar = require('envvar');
const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const plaid = require('plaid');
const firebase = require('firebase');
const uuidv4 = require('uuid/v4');
const axios = require('axios');
require('firebase/firestore');
const stripe = require("stripe")("SECRET");



const APP_PORT = envvar.number('APP_PORT', 8000);
const PLAID_CLIENT_ID = envvar.string('PLAID_CLIENT_ID');
const PLAID_SECRET = envvar.string('PLAID_SECRET');
const PLAID_PUBLIC_KEY = envvar.string('PLAID_PUBLIC_KEY');
const PLAID_ENV = envvar.string('PLAID_ENV', 'development');

let REACT_APP_FIREBASE_KEY = 'AIzaSyBRLZ8fm4-2rrH-f2kPI2aD7aBg7WzKYhU';
let REACT_APP_AUTH_DOMAIN = 'benevocent.firebaseapp.com';
let REACT_APP_DATABASE_URL = 'https://benevocent.firebaseio.com';
let REACT_APP_PROJECT_ID = 'benevocent';
let REACT_APP_STORAGE_BUCKET = 'benevocent.appspot.com';
let REACT_APP_MESSAGING_SENDER_ID = '237628622186';


const config = {
  apiKey: REACT_APP_FIREBASE_KEY,
  authDomain: REACT_APP_AUTH_DOMAIN,
  databaseURL: REACT_APP_DATABASE_URL,
  projectId: REACT_APP_PROJECT_ID,
  storageBucket: REACT_APP_STORAGE_BUCKET,
  messagingSenderId: REACT_APP_MESSAGING_SENDER_ID
};

firebase.initializeApp(config);
const db = firebase.firestore();


// We store the access_token in memory - in production, store it in a secure
// persistent data store
let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let ITEM_ID = null;

// Initialize the Plaid client
const client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());


app.use(function(request, response, next) {
  response.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  response.header('Access-Control-Allow-Credentials', 'true');
  //response.header('Authorization: Basic SECRET');
  response.header('Access-Control-Allow-Methods', '*');
  next();
});


app.get('/', function(request, response, next) {
  response.render('index.ejs', {
    PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    PLAID_ENV: PLAID_ENV,
  });
});

app.post('/get_access_token', function(request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  console.log('PUBLIC_TOKEN', PUBLIC_TOKEN);
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
    if (error !== null) {
      let msg = 'Could not exchange public_token!';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;
    console.log('Access Token: ' + ACCESS_TOKEN);
    console.log('Item ID: ' + ITEM_ID);
    response.json({
      error: false
    });
  });
});

app.get('/accounts', function(request, response, next) {
  // Retrieve high-level account information and account and routing numbers
  // for each account associated with the Item.
  client.getAuth(ACCESS_TOKEN, function(error, authResponse) {
    if (error !== null) {
      let msg = 'Unable to pull accounts from the Plaid API.';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }

    console.log(authResponse.accounts);
    response.json({
      error: false,
      accounts: authResponse.accounts,
      numbers: authResponse.numbers,
    });
  });
});

app.post('/item', function(request, response, next) {
  // Pull the Item - this includes information about available products,
  // billed products, webhook information, and more.
  client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
    if (error !== null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }

    // Also pull information about the institution
    client.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
      if (err !== null) {
        let msg = 'Unable to pull institution information from the Plaid API.';
        console.log(msg + '\n' + error);
        return response.json({
          error: msg
        });
      } else {
        response.json({
          item: itemResponse.item,
          institution: instRes.institution,
        });
      }
    });
  });
});


app.post('/transactions', function(request, response, next) {
  // Pull transactions for the Item for the last 30 days
  let startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
  let endDate = moment().format('YYYY-MM-DD');
  client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
    count: 250,
    offset: 0,
  }, function(error, transactionsResponse) {
    if (error !== null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }
    addBulkTransactions(transactionsResponse, request.body.uid);

    response.json(transactionsResponse);
  });
});


//benevocent defined routes

app.post('/newPurchase', function(request, response, next) {

  let trans = addSingleTransaction(request.body);

  stripe.invoiceItems.create({
    amount: +(request.body.amount),
    currency: 'usd',
    customer: request.body.uid,
    description: 'donation',
  });
  response.json(trans);

});


//seeding routes
app.get('/charities', function (request, response, next) {
  const charityApiEndpoint = 'https://api.data.charitynavigator.org/v2';
  const searchType = '/Organizations';
  const appId = '?app_id=INSERT_APP_ID';
  const appKey = '&app_key=INSERT_APP_KEY';
  const extraParameters = '&pageSize=30&rated=true&fundraisingOrgs=true&state=NY&minRating=4&maxRating=4&scopeOfWork=REGIONAL&sort=NAME%3AASC';
  const url = `${charityApiEndpoint}${searchType}${appId}${appKey}${extraParameters}`;

  axios
    .get(url)
    .then(charities => {
      let uidArr = charities.data.map(() => uuidv4());
      let charityNames = charities.data.map(charity => charity.charityName);
      charities.data.forEach((charity, idx) => {
        db
          .collection('charities')
          .doc(uidArr[idx])
          .set({
            name: charity.charityName,
            mission: charity.mission,
            tag: charity.tagLine,
            url: charity.websiteURL,
            category: charity.category.categoryName,
            img: charity.category.image,
            uid: uidArr[idx]
          });
      });
      response.status(200).send({ charityNames, uidArr });
    })
    .catch(err => console.error(err));
});


app.get('/plants', function(request, response, next) {
  let plantCol = db.collection('plants');

  plantCol.doc('carrot').set({'name': 'carrot', 'unlockValue': null});
  plantCol.doc('aubergine').set({'name': 'aubergine', 'unlockValue': 1});
  plantCol.doc('radish').set({'name': 'radish', 'unlockValue': 2});
  plantCol.doc('broccoli').set({'name': 'broccoli', 'unlockValue': 3});
  plantCol.doc('grapes').set({'name': 'grapes', 'unlockValue': 4});
  plantCol.doc('onion').set({'name': 'onion', 'unlockValue': 5});
  plantCol.doc('peas').set({'name': 'peas', 'unlockValue': 6});
  plantCol.doc('pumpkin').set({'name': 'pumpkin', 'unlockValue': 7});
  plantCol.doc('strawberry').set({'name': 'strawberry', 'unlockValue': 8});

  response.sendStatus(200);

});


app.post('/newGarden', (request, response) => {

  generateEmptyGarden(request.body.month, request.body.uid);
  response.sendStatus(200);
})

//front end code to get data for community garden
app.post('/orderData', (request, response) => {
  let charityRef = db.collection('donationsToCharities').doc(request.body.charity).collection('donationsToCharity');

  charityRef.orderBy('totalDonations').limit(9).get()
  .then(snapshot => {
    snapshot.forEach((doc) => {
      console.log(doc.data());
    })

    response.send('coolio');
  })

});

app.post('/stripeTransaction', (request, response) => {

  const token = request.body.token;
  const charityId = request.body.charityId;

  stripe.charges.create({
    amount: request.body.amount,
    currency: "usd",
    description: `Benevocent donation to ${request.body.charityName}`,
    source: request.body.token.id,
  }, function(err, charge) {
    console.log('charge', charge);
    console.log('err', err);

    addDirectDonation(charityId, request.body.userId, request.body.amount);

  });

})

app.post('/subscribeCustomer', (request, response) => {
  stripe.subscriptions.create({
    customer: request.uid,
    items: [
      {
        plan: "prod_CZgErZZBE64HLo",
      },
    ]
  }, function(err, subscription) {
      // asynchronously called
    }
  );
})

// app.post('/stripeUpdatePlan', (request, response) => {
//   stripe.plans.create({
//     amount: 5000,
//     interval: "month",
//     product: {
//       name: "Benevocent Donations"
//     },
//     currency: "usd",
//   }, function(err, plan) {
//     // asynchronously called
//   });
// })


function generateDonation(amount){

  amount = +amount;
  if (amount < 0 || amount % 1 === 0) return 0;
  return +((1 - (amount % 1)).toFixed(2));

}


function addBulkTransactions(transactions, uid) {

  let filteredData = transactions.transactions.map(transaction => {
    if (+transaction.amount % 1 === 0){
      transaction.amount = 0.01 + transaction.amount;
    }
    if (+transaction.amount < 0){
      transaction.amount = +transaction.amount * -1;
    }
    return transaction;
  });

  let monthArr = {};

  filteredData.forEach(transaction => {

    let data = {
      account_id: transaction.account_id,
      amount: transaction.amount,
      date: transaction.date,
      name: transaction.name,
      donation: generateDonation(transaction.amount)
    };

    let month = data.date.substring(0, 7);

    if(!monthArr[month]) monthArr[month] = true;

    return db
      .collection(`all_transactions`)
      .doc(uid)
      .collection(`user_transactions`)
      .doc(transaction.transaction_id)
      .set(data);
  });

  bulkUpdateMonthlyDonations(monthArr, uid);

}


function addSingleTransaction(body){

  let data = {
    account_id: body.account_id,
    amount: body.amount,
    date: body.date,
    name: body.name,
    donation: generateDonation(body.amount)
  };

  singleUpdateMonthlyDonations(data.date.substring(0, 7), body.userUid, data.donation);


  db.collection(`all_transactions`)
    .doc(`${body.userUid}`)
    .collection('user_transactions')
    .doc(body.transaction_id)
    .set(data);

  return data;

}


function bulkUpdateMonthlyDonations(monthArr, uid){

  let promiseArr = [];
  let donationArr = [];
  let transactionCol = db.collection('all_transactions').doc(uid).collection(`user_transactions`);
  let donationCol = db.collection('all_donations').doc(uid).collection(`user_donations`);

  monthArr = Object.keys(monthArr);

  monthArr.forEach((month, index) => {

    transactionCol.where('date', '>', monthArr[index]).where('date', '<', `${monthArr[index]}-32`)
      .get()
      .then(snapshot => {
              let donation = 0;
              snapshot.forEach(doc => {
                 donation += doc.data().donation;
               });
               return donation;
      })
      .then(donation => {

        donationCol.doc(monthArr[index])
          .set({totalDonations: +(donation.toFixed(2))})

        updateTotalDonations(donation, uid);
        distributeMoney(donation, uid);

      })
  });

}

function singleUpdateMonthlyDonations(month, uid, donation){


  let monthDoc = db.collection('all_donations')
    .doc(uid)
    .collection(`user_donations`)
    .doc(month);

  monthDoc.get()
  .then(snapshot => {
    let monthlyDonation = snapshot.data() ? snapshot.data().totalDonations + +(donation) : +(donation);

    monthDoc.set({totalDonations: +(monthlyDonation.toFixed(2))})
  })

  updateTotalDonations(donation, uid);
  distributeMoney(donation, uid);

}


function updateTotalDonations(donation, uid){

  let userDoc = db.collection('users').doc(uid);

  db.runTransaction(t => {
    return t.get(userDoc)
        .then(doc => {
            let newDonationAmount =  doc.data().totalDonations ? +(doc.data().totalDonations) + +(donation) : +(donation);
            newDonationAmount = +(newDonationAmount.toFixed(2));
            t.update(userDoc, { totalDonations: newDonationAmount });
        });
  });

}

function distributeMoney(donation, uid){

  db.collection('distributions').doc(uid).get()
  .then(doc => {
    let keys = Object.keys(doc.data());

    keys.forEach((key) => {
      db.runTransaction(t => {
        return t.get(db.collection('charities').doc(key))
        .then(charityDoc => {
          let existingDonationAmount =  charityDoc.data().totalDonations ? +(charityDoc.data().totalDonations) : 0;
          let newDonationAmount = existingDonationAmount + donation * doc.data()[key];
          newDonationAmount = +(newDonationAmount.toFixed(4));
          t.update(db.collection('charities').doc(key), { totalDonations: newDonationAmount });
          calculateDonationsToCharities(key, uid, donation * doc.data()[key]);
          storeUserDonationsToCharities(key, uid, donation * doc.data()[key]);
        });
      })
    })
  })
}

function generateEmptyGarden(specifiedMonth, uid){


  let date = new Date();
  let month = !specifiedMonth ? `${date.getFullYear()}-0${date.getMonth() + 1}` : specifiedMonth;

  db.collection('gardens')
    .doc(uid)
    .collection('user_gardens')
    .doc(month)
    .set({
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
      8: null
    })

}


function calculateDonationsToCharities(charity, user, donation){


  let donationsToCharityByUser = db.collection('donationsToCharities')
    .doc(charity).collection('donationsToCharity').doc(user);

    donationsToCharityByUser.get()
  .then((charityDoc) => {

    if (!charityDoc.data()){
      donationsToCharityByUser.set({'totalDonations': donation, 'uid': user});
    } else {

      db.runTransaction(t => {
        return t.get(donationsToCharityByUser)
            .then(doc => {
                let newDonationAmount =  doc.data() ? +(doc.data().totalDonations) + donation : donation;
                newDonationAmount = +(newDonationAmount.toFixed(2));
                t.update(donationsToCharityByUser, { 'totalDonations': newDonationAmount });
            });
      });
    }
  })
}

function storeUserDonationsToCharities(charity, user, donation){

  let donationByUserDoc = db.collection('donationsFromUsers')
    .doc(user);

    donationByUserDoc.get()
  .then((userDoc) => {

    if (!userDoc.data()){
      donationByUserDoc.set({[charity]: donation});
    } else {

      db.runTransaction(t => {
        return t.get(donationByUserDoc)
            .then(doc => {
                let newDonationAmount =  doc.data()[charity] ? +(doc.data()[charity]) + (donation) : +(donation);
                newDonationAmount = +(newDonationAmount.toFixed(2));
                t.update(donationByUserDoc, { [charity]: newDonationAmount });
            });
      });
    }
  })

}


function addDirectDonation(charity, user, amount){

  amount = amount / 100;

  let date = new Date();
  let month = `${date.getFullYear()}-0${date.getMonth() + 1}`;
  singleUpdateMonthlyDonations(month, user, amount);
  calculateDonationsToCharities(charity, user, amount);
  storeUserDonationsToCharities(charity, user, amount);

}


const server = app.listen(APP_PORT, function() {
  console.log('plaid-walkthrough server listening on port ' + APP_PORT);
});
