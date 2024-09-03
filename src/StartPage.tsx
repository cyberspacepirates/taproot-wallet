import { useState } from "react";
import Wallet from "./Wallet";
import { Outlet, useNavigate } from "react-router-dom";

export function StartUp() {
  return (
    <>
      <div>
        <button>
          <a href={`/new_wallet`}>Create new wallet</a>
        </button>
        <button>
          <a href={`/recover_wallet`}>Recover wallet</a>
        </button>
        <button>
          <a href={`/recover_watch_only`}>Recover Watch-onlys</a>
        </button>
      </div>
      <div style={{ minHeight: "520px" }}>
        <Outlet />
      </div>
    </>
  );
}

export function NewWallet() {
  const wallet = Wallet.generateNewWallet("m/86'/1'/0'");
  console.log(wallet.seed.toString("hex"));
  return (
    <div>
      <h3>Creating a new Wallet</h3>
      <p>Backup your seed in a piece of Paper</p>
      <div className="myTextBox">{wallet.mnemonics}</div>
      <p>Here is your XPUB:</p>
      <div className="myTextBox">{wallet.xpub}</div>
      <p>You also can generate your own seed offline and use only your XPUB</p>
      <div>
        <a href={`/wallet?seed=${wallet.seed.toString("hex")}`}>
          <button>Start with Priv Keys</button>
        </a>
        <button>Start with Watch-Only Mode</button>
      </div>
    </div>
  );
}

export function RecoverWallet() {
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const [mnemonics, setMnemonics] = useState("");

  const handleMnemonicsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setMnemonics(event.target.value);
  };
  return (
    <>
      <h3>Recovering your Wallet</h3>
      <p>Type your mnemonics bellow</p>
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
          if (!Wallet.isValidMnemonics(mnemonics.trim()))
            return setMessage("Not valid Mnemonics");
          const wallet = Wallet.generateNewWallet("m/86'/1'/0'", mnemonics);
          console.log(wallet);
          navigate(`/wallet?seed=${wallet.seed.toString("hex")}`);
        }}
      >
        Recover
      </button>
    </>
  );
}

export function RecoverWatchOnly() {
  return <>Here you recover in watch-only mode</>;
}
