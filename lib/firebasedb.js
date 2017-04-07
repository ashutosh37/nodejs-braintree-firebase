'use strict';
var admin = require("firebase-admin");

var serviceAccount = require("../mandirdonation-b69eb-firebase-adminsdk-i400s-a69cd22210.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mandirdonation-b69eb.firebaseio.com",
   databaseAuthVariableOverride: {
    uid: "mandir-service-worker"
  }
});

var db = admin.database();

module.exports = db;