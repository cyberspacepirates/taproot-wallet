import * as ecc from "@bitcoinerlab/secp256k1";
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import { AppState } from "./types";
import { useState } from "react";

const bip32 = BIP32Factory(ecc);

const generateWallet = function GenerateNewWallet(
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
  const xpub = bip32.fromSeed(seed).derivePath(path).neutered().toBase58();
  return {
    mnemonics,
    seed,
    xpub,
    watchonly: false,
  };
};

type StartPageChildren = {
  appState: AppState;
  setAppState: (a: AppState) => void;
};

enum PageState {
  None = "none",
  NewWallet = "new-wallet",
  RecoverSeed = "recover-seed",
  RecoverXPUB = "recover-xpub",
}

const StartPage = ({ appState, setAppState }: StartPageChildren) => {
  const [pageState, setPageState] = useState<PageState>(PageState.None);
  const [mnemonics, setMnemonics] = useState("");
  const [message, setMessage] = useState("");

  const handleMnemonicsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setMnemonics(event.target.value);
  };

  if (appState === AppState.None) {
    const wallet = generateWallet("m/86'/0'/0'", "");

    const startWallet = (wallet: { seed: Buffer }) => {
      const seed = wallet.seed.toString("hex");
      const params = new URLSearchParams(window.location.search);
      params.set("seed", seed);
      setAppState(AppState.Full);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      history.pushState({}, "", newUrl);
    };

    const startWalletWithXPub = (wallet: { xpub: string }) => {
      const xpub = wallet.xpub;
      const params = new URLSearchParams(window.location.search);
      params.set("xpub", xpub);
      setAppState(AppState.WatchOnly);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      history.pushState({}, "", newUrl);
    };

    switch (pageState) {
      case PageState.None:
        return (
          <>
            <button
              onClick={() => {
                setPageState(PageState.NewWallet);
              }}
            >
              Create new Wallet
            </button>
            <button
              onClick={() => {
                setPageState(PageState.RecoverSeed);
              }}
            >
              Recover seed
            </button>
            <button>Recover from XPUB</button>
          </>
        );
      case PageState.RecoverSeed:
        return (
          <>
            <div>
              <textarea
                /*value={mnemonics}*/
                onChange={handleMnemonicsChange}
                style={{ width: "500px", height: "100px", padding: "10px" }}
              ></textarea>
              <p>{message}</p>
            </div>
            <button
              onClick={() => {
                const isValid = bip39.validateMnemonic(
                  mnemonics,
                  bip39.wordlists["english"]
                );
                if (!isValid) return setMessage("Not valid Mnemonics");
                const wallet = generateWallet("m/86'/0'/0'", mnemonics);

                startWallet({ seed: wallet.seed });
              }}
            >
              Recover
            </button>
          </>
        );
      case PageState.NewWallet:
      default:
        return (
          <div>
            <p>Backup your seed in a piece of Paper</p>
            <div className="myTextBox">{wallet.mnemonics}</div>
            <p>Here is your XPUB:</p>
            <div className="myTextBox">{wallet.xpub}</div>
            <p>
              You also can generate your own seed offline and use only your XPUB
            </p>
            <div>
              <button onClick={() => startWallet({ seed: wallet.seed })}>
                Start with Priv Keys
              </button>
              <button
                onClick={() => startWalletWithXPub({ xpub: wallet.xpub })}
              >
                Start with Watch-Only Mode
              </button>
            </div>
          </div>
        );
    }
  }
};

export default StartPage;
