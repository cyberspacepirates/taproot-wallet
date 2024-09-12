import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, BIP32Interface } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as bip39 from "bip39";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
//@ts-expect-error next
import coinSelect from "coinselect";
import * as Encode from "./Encode";
import axios from "axios";

bitcoin.initEccLib(ecc);

const network = bitcoin.networks.regtest;
const API_URL = "http://localhost:3000";

const bip32 = BIP32Factory(ecc);

type UTXOInputType = {
  hash: string;
  txid?: string;
  vout: number;
  value: number;
  witnessUtxo?: {
    script: Buffer;
    value: number;
  };
  tapInternalKey?: Buffer;
  derivationPath: string;
};

const getDerivationPath = (network: bitcoin.Network, wallet: number = 0) => {
  const networkN = network === bitcoin.networks.bitcoin ? 0 : 1;
  return `m/86'/${networkN}'/${wallet}'`;
};

export default class Wallet {
  interface: BIP32Interface;
  root: BIP32Interface;
  currentIndex: number;
  currentChange: number;
  sats: number;
  utxos: {
    hash: string;
    vout: number;
    derivationPath: string;
    value: number;
  }[];
  constructor(seed: Buffer | undefined, xpub: string = "") {
    if (seed) {
      this.interface = bip32.fromSeed(seed, network);
      this.root = this.interface.derivePath(getDerivationPath(network));
    } else {
      this.interface = bip32.fromBase58(xpub, network);
      this.root = this.interface;
    }
    this.currentIndex = 0;
    this.currentChange = 0;
    this.utxos = [];
    this.sats = 0;
  }

  static generateNewWallet(
    path: string,
    _mnemonics: string = "",
    _xpub: string = ""
  ) {
    if (_xpub) {
      return {
        mnemonics: "",
        seed: Buffer.from("0", "hex"),
        xpub: _xpub,
        watchonly: true,
      };
    }
    const mnemonics = _mnemonics ? _mnemonics : bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonics);
    const xpub = bip32
      .fromSeed(seed, network)
      .derivePath(path)
      .neutered()
      .toBase58();
    return {
      mnemonics,
      seed,
      xpub,
      watchonly: false,
    };
  }

  static isValidMnemonics(mnemonics: string) {
    return bip39.validateMnemonic(mnemonics, bip39.wordlists["english"]);
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

  generateChangeAddress(index: number) {
    const child = this.root.derivePath(`1/${index}`);
    const pubKeyXOnly = toXOnly(child.publicKey);
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: pubKeyXOnly,
      network,
    });

    return address;
  }

  generateSilentPayment(index: number) {
    const networkN = network === bitcoin.networks.bitcoin ? 0 : 1;
    const root = this.interface.derivePath(`m/352'/${networkN}'/0'`);

    const scanPubKey = root.derivePath(`1'/${index}`).publicKey;
    const spendPubKey = root.derivePath(`0'/${index}`).publicKey;
    const address = Encode.encodeSilentPaymentAddress(
      toXOnly(scanPubKey),
      toXOnly(spendPubKey),
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
    const address = this.generateAddress(
      this.currentIndex > this.currentChange
        ? this.currentIndex
        : this.currentChange
    );
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

  sendToAddress(
    address: string,
    value: number,
    utxos: UTXOInputType[],
    feeRate: number = 10
  ) {
    this.utxos = utxos;
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
        .tweak(bitcoin.crypto.taggedHash("TapTweak", input.tapInternalKey!));
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
    for (let i = this.currentIndex; i < gapLimit; i++) {
      const address = this.generateAddress(i);
      const txs = await axios.get(`${API_URL}/address/${address}/txs`);
      console.log(i, address, txs.data, txs.data.length);
      if (txs.data!.length > 0) {
        const result = await axios.get(`${API_URL}/address/${address}/utxo`);

        if (result.data!.length == 0) {
          this.currentIndex++;
          return;
        }

        result.data.forEach((utxo: UTXOInputType) => {
          this.utxos.push({
            hash: utxo.txid!,
            vout: utxo.vout!,
            value: utxo.value!,
            derivationPath: `${getDerivationPath(network)}/0/${i}`,
          });
        });
        this.currentIndex = i + 1;
      }
    }
  }

  async scanChangeUTXOS() {
    const gapLimit = 20;
    for (let i = this.currentChange; i < gapLimit; i++) {
      const address = this.generateChangeAddress(i);
      const result = await axios.get(`${API_URL}/address/${address}/utxo`);
      console.log(i, address, result.data, result.data.length);
      if (result.data!.length > 0) {
        result.data.forEach((utxo: UTXOInputType) => {
          this.utxos.push({
            hash: utxo.txid!,
            vout: utxo.vout!,
            value: utxo.value!,
            derivationPath: `${getDerivationPath(network)}/1/${i}`,
          });
        });
        this.currentChange = i + 1;
      }
    }
  }

  updateStats() {
    this.sats = this.utxos.reduce((sats, utxo) => sats + utxo.value, 0);
    console.log(this.sats);
    return this.sats;
  }
}
