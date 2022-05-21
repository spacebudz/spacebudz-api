import {
  createChainSyncClient,
  createInteractionContext,
} from '@cardano-ogmios/client';
import { Point } from '@cardano-ogmios/schema';
import { Low, JSONFile } from 'lowdb';
import hash from 'object-hash';
import { config } from './config';
import { Schema } from './types';
import { initBigintSerialization, slotToPosix } from './utils';
import { marketplaceV1, marketplaceV2 } from './version';
// import { firebaseDB } from './firebase.js';

initBigintSerialization();

const adapter = new JSONFile<Schema>('db/db.json');
const db = new Low<Schema>(adapter);
await db.read();

db.data = db.data || {
  spacebudz: {},
  point: { slot: 0, hash: '' },
  hash: '',
  activity: [],
  topSales: [],
  totalVolume: 0n,
  totalSales: 0,
};

const startPoint =
  db.data.point.slot > 0 && db.data.point.hash
    ? db.data.point
    : {
        hash: 'c05964f83b5601cbb03b7c1579032017209bed8b197e94eee0f7d4316fc0ada4',
        slot: 42297261,
      };

// const uploadFirebase = async () => {
//   // Firebase documents can only hold up to 1MB => slice the db
//   const spacebudz = db.data.spacebudz;
//   const sliced = { 0: {}, 1: {}, 2: {}, 3: {} };
//   const keys = Object.keys(spacebudz);
//   const p = Math.ceil(keys.length / 6);
//   keys.slice(0, p).forEach((budId) => (sliced[0][budId] = spacebudz[budId]));
//   keys
//     .slice(p, 2 * p)
//     .forEach((budId) => (sliced[1][budId] = spacebudz[budId]));
//   keys
//     .slice(2 * p, 3 * p)
//     .forEach((budId) => (sliced[2][budId] = spacebudz[budId]));
//   keys
//     .slice(3 * p, 4 * p)
//     .forEach((budId) => (sliced[3][budId] = spacebudz[budId]));
//   keys
//     .slice(4 * p, 5 * p)
//     .forEach((budId) => (sliced[3][budId] = spacebudz[budId]));
//   keys
//     .slice(5 * p, 6 * p)
//     .forEach((budId) => (sliced[3][budId] = spacebudz[budId]));
//   console.log('Uploading to Firebase...');
//   firebaseDB.collection('SpaceBudzV2').doc('0').set(sliced[0]);
//   firebaseDB.collection('SpaceBudzV2').doc('1').set(sliced[1]);
//   firebaseDB.collection('SpaceBudzV2').doc('2').set(sliced[2]);
//   firebaseDB.collection('SpaceBudzV2').doc('3').set(sliced[3]);
//   firebaseDB.collection('SpaceBudzV2').doc('4').set(sliced[4]);
//   firebaseDB.collection('SpaceBudzV2').doc('5').set(sliced[5]);

//   firebaseDB.collection('Common').doc('common').set({
//     activity: db.data.activity,
//     topSales: db.data.topSales,
//     totalSales: db.data.totalSales,
//     totalVolume: db.data.totalVolume,
//   });

//   await new Promise((res) => setTimeout(() => res(1), 1000));
//   console.log('Done uploading');
// };

const rollForward = async ({ block }, requestNext) => {
  const eraBlock = block.shelley || block.allegra || block.mary || block.alonzo;
  const point: Point = {
    hash: eraBlock.headerHash,
    slot: eraBlock.header.slot,
  };

  marketplaceV1(eraBlock, point, db.data);
  marketplaceV2(eraBlock, point, db.data);

  db.data.point = point;
  const currentHash = hash(db.data.spacebudz);

  if (db.data.hash != currentHash) {
    console.log('UPDATED DB');
    console.log(new Date(slotToPosix(point.slot)));
    console.log(point);
    db.data.hash = currentHash;
  }
  await db.write();
  requestNext();
};

const rollBackward = async ({ point }, requestNext) => {
  db.data.point = point;
  await db.write();
  requestNext();
};

const context = await createInteractionContext(
  (err) => console.error(err),
  () => console.log('Connection closed.'),
  { connection: config.connection },
);
const client = await createChainSyncClient(context, {
  rollForward,
  rollBackward,
});
client.startSync([startPoint]);
