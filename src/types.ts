import { Point } from '@cardano-ogmios/schema';

// lodash global typing - begin
declare namespace _ {}
// lodash global typing - end

export enum ActivityType {
  sold = 'sold',
  bought = 'bought',
  listed = 'listed',
  bid = 'bid',
  canceledBid = 'canceledBid',
  canceledListing = 'canceledListing',
}

type Activity = {
  type: ActivityType;
  budId: number;
  lovelace: BigInt;
  slot: number;
};

type Trade = { owner: string; amount: BigInt; slot: number };

type Sale = { amount: BigInt; slot: number };

type Version = 'v1' | 'v2';

type SpaceBud = {
  [key: number]: {
    trade: {
      [key in Version]: {
        bid?: Trade;
        listing?: Trade;
      };
    };
    history?: Sale[];
  };
};

export type Schema = {
  spacebudz: SpaceBud;
  point: Point;
  hash: string;
  activity: Activity[];
  topSales: Sale[];
  totalVolume: BigInt;
  totalSales: number;
};
