import functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const firebaseDB = admin.initializeApp().firestore();
// Automatically allow cross-origin requests
app.use(cors({ origin: true }));

const DATUM_TYPE = {
  StartBid: 0,
  Bid: 1,
  Offer: 2,
};

const getActivity = async () => {
  const activity = await firebaseDB
    .collection('Activity')
    .doc('activity')
    .get();
  return activity.data()?.activity;
};

const getSpaceBudz = async () => {
  const snapshot = await firebaseDB.collection('SpaceBudz').get();
  let spacebudz = {};
  snapshot.docs.forEach((doc) => (spacebudz = { ...spacebudz, ...doc.data() }));
  return spacebudz;
};

app.get('/lastSales', async (req, res) => {
  const spacebudz = await getSpaceBudz();
  const lastSales = Object.keys(spacebudz)
    .filter((budId) => spacebudz[budId].lastSale)
    .map((budId) => ({ budId, lastSale: spacebudz[budId].lastSale }));
  return res.json(lastSales);
});

app.get('/bids/:address?', async (req, res) => {
  const spacebudz = await getSpaceBudz();
  const address = req.params.address;
  const bids = Object.keys(spacebudz)
    .filter(
      (budId) =>
        spacebudz[budId][DATUM_TYPE.Bid] &&
        (address ? spacebudz[budId][DATUM_TYPE.Bid].owner == address : true),
    )
    .map((budId) => ({ budId, bid: spacebudz[budId][DATUM_TYPE.Bid] }));
  const totalBids = bids.length;
  const totalAmount = bids.reduce(
    (prev, current) => (prev += current.bid.amount),
    0,
  );
  return res.json({ totalAmount, totalBids, bids });
});

app.get('/offers/:address?', async (req, res) => {
  const spacebudz = await getSpaceBudz();
  const address = req.params.address;
  const offers = Object.keys(spacebudz)
    .filter(
      (budId) =>
        spacebudz[budId][DATUM_TYPE.Offer] &&
        (address ? spacebudz[budId][DATUM_TYPE.Offer].owner == address : true),
    )
    .map((budId) => ({ budId, offer: spacebudz[budId][DATUM_TYPE.Offer] }));
  const totalOffers = offers.length;
  const totalAmount = offers.reduce(
    (prev, current) => (prev += current.offer.amount),
    0,
  );
  return res.json({ totalAmount, totalOffers, offers });
});

app.get('/specificSpaceBud/:id', async (req, res) => {
  const spacebudz = await getSpaceBudz();
  const budId = req.params.id;
  const spacebud = spacebudz[budId] || {};
  const offer = spacebud[DATUM_TYPE.Offer] || null;
  const bid = spacebud[DATUM_TYPE.Bid] || null;
  const lastSale = spacebud.lastSale || null;
  return res.json({ budId, offer, bid, lastSale });
});

app.get('/activity', async (req, res) => {
  const activity = await getActivity();
  return res.json(activity ? activity : []);
});

app.post('/submit/tx', async (req, res) => {
  const result = await fetch('http://node.pipool.online:8090/api/submit/tx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/cbor' },
    body: req.body,
  });
  if (result.ok) return res.json(result);
  return res.status(result.status).json(await result.json());
});

app.use('/api', app._router);

export const api = functions.https.onRequest(app);
