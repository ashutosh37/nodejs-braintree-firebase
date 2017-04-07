'use strict';

var express = require('express');
var braintree = require('braintree');
var router = express.Router(); // eslint-disable-line new-cap
var gateway = require('../lib/gateway');
var db = require('../lib/firebasedb');
var moment = require('moment');

var TRANSACTION_SUCCESS_STATUSES = [
  braintree.Transaction.Status.Authorizing,
  braintree.Transaction.Status.Authorized,
  braintree.Transaction.Status.Settled,
  braintree.Transaction.Status.Settling,
  braintree.Transaction.Status.SettlementConfirmed,
  braintree.Transaction.Status.SettlementPending,
  braintree.Transaction.Status.SubmittedForSettlement
];

function formatErrors(errors) {
  var formattedErrors = '';

  for (var i in errors) { // eslint-disable-line no-inner-declarations, vars-on-top
    if (errors.hasOwnProperty(i)) {
      formattedErrors += 'Error: ' + errors[i].code + ': ' + errors[i].message + '\n';
    }
  }
  return formattedErrors;
}

function createResultObject(transaction) {
  var result;
  var status = transaction !== null ?transaction.status : -1;

  if (TRANSACTION_SUCCESS_STATUSES.indexOf(status) !== -1) {
    result = {
      header: 'Sweet Success!',
      icon: 'success',
      message: 'Your test transaction has been successfully processed. See the Braintree API response and try again.'
    };
  } else {
    result = {
      header: 'Transaction Failed',
      icon: 'fail',
      message: 'Your test transaction has a status of ' + status + '. See the Braintree API response and try again.'
    };
  }

  return result;
}

router.get('/', function (req, res) {
  res.redirect('/checkouts/landing');
});
router.get('/checkouts/landing', function(req,res){
  var ref = db.ref("/");
    ref.on("value", function(snapshot) {
        console.log(snapshot.val());
        res.render('checkouts/landing', {totalamount : snapshot.val().totalamount , users: snapshot.val().Users});
      }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
      });
})

router.get('/checkouts/new', function (req, res) {
  gateway.clientToken.generate({}, function (err, response) {
    var totalamount = db.ref("/totalamount");
    totalamount.on("value", function(snapshot) {
        res.render('checkouts/new', {clientToken: response.clientToken, totalamount : snapshot.val(), messages: req.flash('error')});
      }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
      });
    
  });
});

router.get('/checkouts/:id', function (req, res) {
  var result;
  var transactionId = req.params.id;

  gateway.transaction.find(transactionId, function (err, transaction) {
    result = createResultObject(transaction);
    res.render('checkouts/show', {transaction: transaction, result: result});
  });
});

router.post('/checkouts', function (req, res) {
  var transactionErrors;
  var amount = req.body.amount; // In production you should not take amounts directly from clients
  var nonce = req.body.payment_method_nonce;
  var fn = req.body.fullName;
  var email = req.body.email;
  gateway.transaction.sale({
    amount: amount,
    paymentMethodNonce: nonce,
    customer: {
    firstName : fn,
    email : email
    },
    options: {
      storeInVaultOnSuccess: true
    }
  }, function (err, result) {
    if (result.success || result.transaction) {
      var totalamount = db.ref("/totalamount");
      totalamount.transaction(function (current_value) {
        return (current_value || 0) + parseInt(req.body.amount);
      });
      var userref = db.ref('/Users');
      var newuserref = userref.push();
      var date = moment(new Date()).format('DD/MM/YYYY MM:HH A');
      console.log(date);
      newuserref.set({name:req.body.fullName , email: req.body.email,amount : req.body.amount , time: date})
      res.redirect('checkouts/' + result.transaction.id);
    } else {
      transactionErrors = result.errors.deepErrors();
      req.flash('error', {msg: formatErrors(transactionErrors)});
      res.redirect('checkouts/new');
    }
  });
});

module.exports = router;
