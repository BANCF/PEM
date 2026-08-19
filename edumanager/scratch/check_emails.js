const admin = require('firebase-admin');
const serviceAccount = require('../pascaleducationmanager-firebase-adminsdk-fbsvc-bf7a0b5f81.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkEmails() {
  const bgh = await db.collection('users').where('role', '==', 'BGH').get();
  console.log('BGH Emails:');
  bgh.forEach(d => console.log(d.data().email, d.data().fullName));

  const teachers = await db.collection('users').where('role', 'in', ['TEACHER', 'TTCM', 'TPCM']).get();
  console.log('\nTeacher Emails:');
  teachers.forEach(d => console.log(d.data().email, d.data().fullName));
}

checkEmails();
