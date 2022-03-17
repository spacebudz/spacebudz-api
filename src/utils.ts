import { Slot } from '@cardano-ogmios/schema';

export const initBigintSerialization = () => {
  // serialize BigInt to string after writing to db
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  // deserialize string from json to BigInt if it's also a number
  (function () {
    var parse = JSON.parse;
    JSON.parse = function (s, f) {
      return parse(
        s,
        f
          ? f
          : function ({}, value) {
              return typeof value === 'string' && Number(value)
                ? BigInt(value)
                : value;
            },
      );
    };
  })();
};

export const slotToPosix = (slot: Slot): number =>
  1596491091000 + (slot * 1000 - 4924800000);
