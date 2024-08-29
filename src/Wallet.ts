import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, BIP32Interface } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
//@ts-expect-error next
import coinSelect from "coinselect";
import * as Encode from "./Encode";
import axios from "axios";

bitcoin.initEccLib(ecc);

const network = bitcoin.networks.regtest;

const bip32 = BIP32Factory(ecc);

type UTXOInputType = {
  hash: string;
  txid?: string;
  vout: number;
  value: number;
  witnessUtxo: {
    script: Buffer;
    value: number;
  };
  tapInternalKey: Buffer;
  derivationPath: string;
};

export default class Wallet {
  interface: BIP32Interface;
  root: BIP32Interface;
  currentIndex: number;
  currentChange: number;
  utxos: {
    hash: string;
    vout: number;
    derivationPath: string;
    value: number;
  }[];
  constructor(seed: Buffer | undefined, xpub: string = "") {
    if (seed) {
      this.interface = bip32.fromSeed(seed, network);
      this.root = this.interface.derivePath("m/86'/1'/0'");
    } else {
      this.interface = bip32.fromBase58(xpub, network);
      this.root = this.interface;
    }
    this.currentIndex = 0;
    this.currentChange = 0;
    this.utxos = [];
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

  getInternalPubkey(path: string) {
    const child = this.interface.derivePath(path);
    const pubKeyXOnly = toXOnly(child.publicKey);
    return pubKeyXOnly;
  }

  getNextAddress() {
    const address = this.generateAddress(this.currentIndex);
    return address;
  }

  getNextChangeAddress() {
    const child = this.root.derivePath(`1/${this.currentChange}`);
    const pubKeyXOnly = toXOnly(child.publicKey);
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: pubKeyXOnly,
      network,
    });
    this.currentChange++;
    return address;
  }

  sendToAddress(address: string, value: number, utxos: UTXOInputType[]) {
    this.utxos = utxos;
    const feeRate = 10;
    const targets = [
      {
        address,
        value,
      },
    ];
    const signs: (() => bitcoin.Psbt)[] = [];
    const { inputs, outputs, fee } = coinSelect(
      this.utxos.map((utxo) => ({
        hash: utxo.hash,
        vout: utxo.vout,
        value: utxo.value,
        witnessUtxo: {
          script: bitcoin.payments.p2tr({
            internalPubkey: this.getInternalPubkey(utxo.derivationPath),
          }).output,
          value: utxo.value, // 1 BTC and is the exact same as the value above
          network,
        },
        tapInternalKey: this.getInternalPubkey(utxo.derivationPath),
        derivationPath: utxo.derivationPath,
      })),
      targets,
      feeRate
    );

    // the accumulated fee is always returned for analysis
    console.log(fee);

    // .inputs and .outputs will be undefined if no solution was found
    // if (!inputs || !outputs) return;

    const psbt = new bitcoin.Psbt({ network });

    inputs.forEach((input: UTXOInputType, index: number) => {
      psbt.addInput({
        hash: input.hash,
        index: input.vout,
        // OR (not both)
        witnessUtxo: input.witnessUtxo,
        tapInternalKey: input.tapInternalKey,
      });
      const tweakedChild = this.interface
        .derivePath(input.derivationPath!)
        .tweak(bitcoin.crypto.taggedHash("TapTweak", input.tapInternalKey));
      console.log("this is the index", index);
      signs.push(() => psbt.signInput(index, tweakedChild));
    });
    outputs.forEach((output: { address: string; value: number }) => {
      // watch out, outputs may have been added that you need to provide
      // an output address/script for
      if (!output.address) {
        output.address = this.getNextChangeAddress()!;
      }

      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    });

    signs.forEach((f) => f());
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    return tx.toHex();
  }

  async scanUTXOS() {
    const gapLimit = 20;
    for (let j = 0, i = 0; j < i + gapLimit; j++) {
      console.log(j);
      const address = this.generateAddress(j);
      const result = await axios.get(
        `http://localhost:8094/regtest/api/address/${address}/utxo`
      );
      console.log(j, address, result.data, result.data.length);
      if (result.data!.length > 0) {
        result.data.forEach((utxo: UTXOInputType) => {
          this.utxos.push({
            hash: utxo.txid!,
            vout: utxo.vout!,
            value: utxo.value!,
            derivationPath: `m/86'/1'/0'/0/${j}`,
          });
        });
        i++;
      }
    }
  }
}
