import {
  BlockAllegra,
  BlockAlonzo,
  BlockMary,
  BlockShelley,
  Point,
} from '@cardano-ogmios/schema';
import { ActivityType, Schema } from '../types';
import S from '@emurgo/cardano-serialization-lib-nodejs';
import _ from 'lodash';

const CONTRACT_ADDRESS =
  'addr1wyzynye0nksztrfzpsulsq7whr3vgh7uvp0gm4p0x42ckkqqq6kxq';
const SCRIPT_HASH = '0449932f9da0258d220c39f803ceb8e2c45fdc605e8dd42f35558b58';
const BID_POLICY = '800df05a0cc6b6f0d28aaa1812135bd9eebfbf5e8e80fd47da9989eb';
const SPACEBUDZ_POLICY =
  'd5e6bf0500378d4f0da4e8dde6becec7621cd8cbf5cbb9b87013d4cc';
const START_BID_HASH =
  'f7f2f57c58b5e4872201ab678928b0d63935e82d022d385e1bad5bfe347e89d8';

enum REDEEMER {
  Buy = 0,
  Sell = 1,
  Cancel = 3,
}

const DATUM_LABEL = 405;
const ADDRESS_LABEL = 406;

enum DATUM_TYPE {
  StartBid,
  Bid,
  Listing,
}

const mapDatumType = (type: DATUM_TYPE) => {
  const m = {
    [DATUM_TYPE.StartBid]: 'startBid',
    [DATUM_TYPE.Bid]: 'bid',
    [DATUM_TYPE.Listing]: 'listing',
  };
  return m[type];
};

const filterIndexAndContent = (array, f) => {
  const result = [];
  for (let i = 0; i < array.length; i++) {
    if (f(array[i])) {
      result.push({ index: i, content: array[i] });
    }
  }
  return result;
};

const getTradeDetails = (
  datumHex: string,
): { type: DATUM_TYPE; budId: number; amount: BigInt } => {
  const datum = S.PlutusData.from_bytes(
    Buffer.from(datumHex, 'hex'),
  ).as_constr_plutus_data();
  const type = parseInt(datum.alternative().to_str());
  const tradeDetails = datum.data().get(0).as_constr_plutus_data().data();
  return {
    type,
    budId: parseInt(Buffer.from(tradeDetails.get(1).as_bytes()).toString()),
    amount: BigInt(tradeDetails.get(2).as_integer().as_u64().to_str()),
  };
};

const getAddress = (addressHex: string): string =>
  S.Address.from_bytes(Buffer.from(addressHex, 'hex')).to_bech32();

const getRedeemers = (transaction): REDEEMER[] => {
  const redeemers = transaction.witness.redeemers;
  const result = [];
  if (!transaction.witness.scripts[SCRIPT_HASH]) return [];
  for (const index in redeemers) {
    const redeemer = redeemers[index].redeemer;
    const redeemerType = parseInt(
      S.PlutusData.from_bytes(Buffer.from(redeemer, 'base64'))
        .as_constr_plutus_data()
        .alternative()
        .to_str(),
    );
    if (redeemerType === REDEEMER.Sell) result.push(REDEEMER.Sell);
    else if (redeemerType === REDEEMER.Buy) result.push(REDEEMER.Buy);
    else if (redeemerType === REDEEMER.Cancel) result.push(REDEEMER.Cancel);
  }
  return result;
};

const getDatum = (transaction, datumType: DATUM_TYPE) => {
  const datums = transaction.witness.datums;
  for (const datumHash in datums) {
    const datum = Buffer.from(datums[datumHash], 'base64').toString('hex');
    try {
      const tradeDetails = getTradeDetails(datum);
      if (tradeDetails.type == datumType) return tradeDetails;
    } catch (e) {}
  }
  return null;
};

const updateActivity = ({
  db,
  activityType,
  budId,
  lovelace,
  slot,
}: {
  db: Schema;
  activityType: ActivityType;
  budId: number;
  lovelace: BigInt;
  slot: number;
}) => {
  db.activity.unshift({ type: activityType, budId, lovelace, slot });
  if (db.activity.length > 10) db.activity.pop();
};

const setSpaceBudTrade = ({
  db,
  type,
  budId,
  owner,
  amount,
  slot,
}: {
  db: Schema;
  type: DATUM_TYPE;
  budId: number;
  owner: string;
  amount: BigInt;
  slot: number;
}) => {
  updateActivity({
    db,
    budId,
    lovelace: amount,
    slot,
    activityType:
      type === DATUM_TYPE.Bid ? ActivityType.bid : ActivityType.listed,
  });
  _.set(db.spacebudz, `[${budId}].trade.v2[${mapDatumType(type)}]`, {
    owner,
    amount,
    slot,
  });
};

const setSpaceBudLastSale = ({
  db,
  type,
  budId,
  slot,
}: {
  db: Schema;
  type: DATUM_TYPE;
  budId: number;
  slot: number;
}) => {
  const amount = db.spacebudz[budId].trade.v2[mapDatumType(type)].amount;

  updateActivity({
    db,
    budId,
    lovelace: amount,
    slot,
    activityType:
      type === DATUM_TYPE.Bid ? ActivityType.sold : ActivityType.bought,
  });

  // update SpaceBud history
  if (!db.spacebudz[budId]?.history)
    _.set(db.spacebudz, `[${budId}].history`, []);

  db.spacebudz[budId].history.unshift({
    amount,
    slot,
  });

  // update topSales
  if (db.topSales.length < 10) {
    db.topSales.push({
      slot,
      amount,
      budId,
    });
    db.topSales.sort((a, b) =>
      a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0,
    ); // sort amount in DESC order
  } else {
    const reverseTopSales = [...db.topSales].reverse();
    const index = reverseTopSales.findIndex((sale) => sale.amount < amount);
    if (index !== -1) {
      reverseTopSales[index] = { slot, amount, budId };
      reverseTopSales.sort((a, b) =>
        a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0,
      ); // sort amount in DESC order
      db.topSales = reverseTopSales;
    }
  }

  // update volume
  db.totalVolume += amount;

  // update count
  db.totalSales += 1;

  delete db.spacebudz[budId].trade.v2[mapDatumType(type)];
};

const setSpaceBudCancel = ({
  db,
  type,
  budId,
  slot,
}: {
  db: Schema;
  type: DATUM_TYPE;
  budId: number;
  slot: number;
}) => {
  updateActivity({
    db,
    budId,
    lovelace: db.spacebudz[budId].trade.v2[mapDatumType(type)].amount,
    slot,
    activityType:
      type === DATUM_TYPE.Bid
        ? ActivityType.canceledBid
        : ActivityType.canceledListing,
  });
  delete db.spacebudz[budId].trade.v2[mapDatumType(type)];
};

export const marketplaceV2 = (
  block: BlockShelley | BlockAllegra | BlockMary | BlockAlonzo,
  point: Point,
  db: Schema,
) => {
  const transactions = block.body;
  transactions.forEach((transaction) => {
    const outputs = transaction.body.outputs;
    const metadata = transaction.metadata?.body?.blob;
    const contractOutputs = filterIndexAndContent(
      outputs,
      (output) =>
        metadata?.[DATUM_LABEL] &&
        metadata?.[ADDRESS_LABEL] &&
        output.address === CONTRACT_ADDRESS &&
        output.datum !== START_BID_HASH &&
        Object.keys(output.value.assets).some(
          (asset) =>
            (asset.startsWith(SPACEBUDZ_POLICY) ||
              asset.startsWith(BID_POLICY)) &&
            output.value.assets[asset] >= 1n,
        ),
    );

    // check for sales and cancelling
    const redeemers = getRedeemers(transaction);
    redeemers.forEach((redeemer) => {
      if (redeemer === REDEEMER.Buy) {
        const tradeDetails = getDatum(transaction, DATUM_TYPE.Listing);
        setSpaceBudLastSale({
          db,
          budId: tradeDetails.budId,
          type: DATUM_TYPE.Listing,
          slot: point.slot,
        });
      } else if (redeemer === REDEEMER.Sell) {
        const tradeDetails = getDatum(transaction, DATUM_TYPE.Bid);
        setSpaceBudLastSale({
          db,
          budId: tradeDetails.budId,
          type: DATUM_TYPE.Bid,
          slot: point.slot,
        });
      } else if (redeemer === REDEEMER.Cancel) {
        let tradeDetails = getDatum(transaction, DATUM_TYPE.Bid);
        if (tradeDetails) {
          setSpaceBudCancel({
            db,
            budId: tradeDetails.budId,
            type: DATUM_TYPE.Bid,
            slot: point.slot,
          });
        } else {
          tradeDetails = getDatum(transaction, DATUM_TYPE.Listing);
          if (tradeDetails)
            setSpaceBudCancel({
              db,
              budId: tradeDetails.budId,
              type: DATUM_TYPE.Listing,
              slot: point.slot,
            });
        }
      }
    });

    // check for new listings and bids
    if (contractOutputs.length <= 0) return;
    contractOutputs.forEach(({ index, content }) => {
      const tradeDetails = getTradeDetails(metadata[405].map[index].v.bytes);
      const type = tradeDetails.type;
      const budId = tradeDetails.budId;
      const owner = getAddress(metadata[406].map[0].v.bytes);
      if (type == DATUM_TYPE.Bid) {
        setSpaceBudTrade({
          db,
          type,
          budId,
          owner,
          amount: BigInt(content.value.coins),
          slot: point.slot,
        });
      } else if (type == DATUM_TYPE.Listing) {
        setSpaceBudTrade({
          db,
          type,
          budId,
          owner,
          amount: tradeDetails.amount,
          slot: point.slot,
        });
      }
    });
  });
};
