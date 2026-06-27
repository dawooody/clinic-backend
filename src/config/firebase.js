const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  // Convert escaped newlines back to real newlines
  serviceAccount.private_key = serviceAccount.private_key.replace(
    /\\n/g,
    "\n"
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;