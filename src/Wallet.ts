import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, BIP32Interface } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";

import * as Encode from "./Encode";

bitcoin.initEccLib(ecc);

const network = bitcoin.networks.regtest;

const bip32 = BIP32Factory(ecc);

export default class Wallet {
  interface: BIP32Interface;
  root: BIP32Interface;

  constructor(seed: Buffer | undefined, xpub: string = "") {
    if (seed) {
      this.interface = bip32.fromSeed(seed, network);
      this.root = this.interface.derivePath("m/86'/0'/0'");
    } else {
      this.interface = bip32.fromBase58(xpub, network);
      this.root = this.interface;
    }
  }

  generateAddress(index: number) {
    const child = this.root.derivePath(`0/${index}`);
    const pubKeyXOnly = toXOnly(child.publicKey);
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: pubKeyXOnly,
      network,
    });

    return address;
  }

  generateSilentPayment(index: number) {
    const root = this.interface.derivePath("m/352'/0'/0'");

    const scanPubKey = root.derivePath(`1'/${index}`).publicKey;
    const spendPubKey = root.derivePath(`0'/${index}`).publicKey;
    const address = Encode.encodeSilentPaymentAddress(
      scanPubKey,
      spendPubKey,
      network
    );

    return address;
  }
}
