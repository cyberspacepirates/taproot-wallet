import { bech32m } from "bech32";
import { Network } from "bitcoinjs-lib";
import { bitcoin } from "bitcoinjs-lib/src/networks";

export const encodeSilentPaymentAddress = (
  scanPubKey: Uint8Array,
  spendPubKey: Uint8Array,
  network: Network = bitcoin,
  version: number = 0
): string => {
  const data = bech32m.toWords(Buffer.concat([scanPubKey, spendPubKey]));
  data.unshift(version);

  return bech32m.encode(hrpFromNetwork(network), data, 1023);
};

const hrpFromNetwork = (network: Network): string => {
  return network.bech32 === "bc" ? "sp" : "tsp";
};
