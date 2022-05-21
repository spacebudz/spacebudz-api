import admin from 'firebase-admin';
import { key } from '../key.js';

admin.initializeApp({
  credential: admin.credential.cert(key as any),
  databaseURL: 'https://space-budz.firebaseio.com',
});

export const firebaseDB = admin.firestore();
