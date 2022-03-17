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
