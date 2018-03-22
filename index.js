'use strict';

const envvar = require('envvar');
const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const plaid = require('plaid');
const firebase = require('firebase');
const uuidv4 = require('uuid/v4');
require('firebase/firestore');


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
      var msg = 'Could not exchange public_token!';
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
    console.log('pulled ' + transactionsResponse.transactions.length + ' transactions');
    addBulkTransactions(transactionsResponse, request.body.uid);

    response.json(transactionsResponse);
  });
});


//benevocent defined routes

app.post('/newPurchase', function(request, response, next) {

  let trans = addSingleTransaction(request.body);
  response.json(trans);
  
});


//seeding routes
app.get('/charities', function(request, response, next) {

  let charities = ['Bill and Melinda Gates Foundation', 'Doctors Without Borders', 'World Wildlife Fund', '	UNICEF', 'American Red Cross', 'Wounded Warrior Project', 'American Heart Association', 'Boys and Girls Clubs of America'];

  let uidArr = charities.map(() => uuidv4());
  let charityCol = db.collection('charities');

  charities.forEach((charity, idx) => {
    charityCol.doc(uidArr[idx]).set({'name': charity, totalDonations: 0, uid: uidArr[idx]})
  })

  response.sendStatus(200);

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

  db
    .collection(`all_transactions`)
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
    let monthlyDonation = snapshot.data() ? snapshot.data().totalDonations + donation : donation;
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
            var newDonationAmount =  doc.data().totalDonations ? +(doc.data().totalDonations) + donation : donation;
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


const server = app.listen(APP_PORT, function() {
  console.log('plaid-walkthrough server listening on port ' + APP_PORT);
});
