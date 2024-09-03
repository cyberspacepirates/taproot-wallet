import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useOutletContext,
} from "react-router-dom";

import "./App.css";
import {
  StartUp,
  NewWallet,
  RecoverWallet,
  RecoverWatchOnly,
} from "./StartPage";

import Wallet from "./Wallet";
import QRCode from "qrcode";
import { Link } from "react-router-dom";

const formatter = new Intl.NumberFormat();

const router = createBrowserRouter([
  {
    path: "/",
    element: <StartUp />,
    children: [
      {
        path: "/new_wallet",
        element: <NewWallet />,
      },
      {
        path: "/recover_wallet",
        element: <RecoverWallet />,
      },
      {
        path: "/recover_watch_only",
        element: <RecoverWatchOnly />,
      },
    ],
  },
  {
    path: "/wallet",
    element: <WalletDashboard />,
    children: [
      {
        path: "receive",
        element: <Receive />,
      },
      {
        path: "silent_payment",
        element: <SilentPaymentRecieve />,
      },
      {
        path: "send",
        element: <SendTransaction />,
      },
      {
        path: "addresses",
        element: <Addresses />,
      },
      {
        path: "utxos",
        element: <UTXOS />,
      },
    ],
  },
]);

type UTXOInputType = {
  hash: string;
  vout: number;
  derivationPath: string;
  value: number;
};

function WalletDashboard() {
  const [queries, setQueries] = useState("");

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [sats, setSats] = useState(0);

  const [utxos, setUTXOS] = useState<Array<UTXOInputType>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Starting up wallet");
    const params = new URLSearchParams(window.location.search);
    setQueries(params.toString());
    const seed = params.get("seed");
    console.log(seed, seed?.length);
    if (/^[a-f0-9A-F]{128}$/.test(seed!)) {
      console.log("you provided a good seed");

      setWallet(new Wallet(Buffer.from(seed!, "hex")));
    } else {
      console.log("you seed is bad");
      navigate("/");
    }
  }, []);
  return (
    <>
      <p style={{ fontSize: "32px" }}>{formatter.format(sats)} sats</p>
      <div>
        <Link to={`/wallet/silent_payment?${queries}`}>
          <button>Silent Payment</button>
        </Link>
        <Link to={`/wallet/receive?${queries}`}>
          <button>Receive</button>
        </Link>
        <Link to={`/wallet/send?${queries}`}>
          <button>Send</button>
        </Link>
        <Link to={`/wallet?${queries}`}>
          <button>Channel</button>
        </Link>
        <Link to={`/wallet/utxos?${queries}`}>
          <button>UTXOs</button>
        </Link>
        <Link to={`/wallet/addresses?${queries}`}>
          <button>Addresses</button>
        </Link>
      </div>
      <div style={{ minHeight: "520px" }}>
        <Outlet context={{ wallet, utxos, setUTXOS, setSats }}></Outlet>
      </div>
    </>
  );
}

function Receive() {
  const { wallet } = useOutletContext<{
    wallet: Wallet;
  }>();

  const [[address, qrCodeDataURI], setState] = useState(["", ""]);

  useEffect(() => {
    if (!wallet) return;
    const _address = wallet.getNextAddress();
    QRCode.toDataURL("bitcoin:" + _address, (err, data) => {
      if (err) return;
      setState([_address!, data]);
    });
  }, [qrCodeDataURI, wallet, address]);
  return (
    <>
      <h3>Receive Address</h3>
      <p>{address}</p>
      <div>
        <img src={qrCodeDataURI}></img>
      </div>
    </>
  );
}

function SilentPaymentRecieve() {
  const { wallet } = useOutletContext<{
    wallet: Wallet;
  }>();

  const [[address, qrCodeDataURI], setState] = useState(["", ""]);

  useEffect(() => {
    if (!wallet) return;
    const _address = wallet.generateSilentPayment(0);
    QRCode.toDataURL("bitcoin:" + _address, (err, data) => {
      if (err) return;
      setState([_address!, data]);
    });
  }, [qrCodeDataURI, wallet, address]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <h3>Silent Payment</h3>
      <div>
        <p
          style={{
            overflowWrap: "break-word",
            maxWidth: "540px",
          }}
        >
          {address}
        </p>
      </div>
      <div>
        <img src={qrCodeDataURI}></img>
      </div>
    </div>
  );
}

function Addresses() {
  const [npage, setNPage] = useState(0);
  const { wallet } = useOutletContext<{ wallet: Wallet }>();

  return (
    <>
      <h3>Addresses</h3>
      {[...Array(15).keys()].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignContent: "space-between",
            gap: "12px",
            marginTop: "2px",
            width: "700px",
          }}
        >
          <div>{(i + npage).toString().padStart(2, "0")}</div>
          <div style={{ alignSelf: "end" }}>
            {wallet && wallet.generateAddress(i + npage)}
          </div>
          <div style={{ marginLeft: "auto" }}>{0} utxos</div>
        </div>
      ))}
      <div>
        <button
          disabled={npage === 0}
          onClick={() => {
            setNPage((npage) => (npage == 0 ? 0 : npage - 15));
          }}
        >
          {npage === 0 ? "Current Page" : "Previvous page"}
        </button>
        <button
          onClick={() => {
            setNPage((npage) => npage + 15);
          }}
        >
          Next Page
        </button>
      </div>
    </>
  );
}

function SendTransaction() {
  const [recipient, setRecipient] = useState({
    address: "",
    value: 0,
    result: "",
    feeRate: 10,
  });

  const { wallet, utxos } = useOutletContext<{
    wallet: Wallet;
    utxos: UTXOInputType[];
  }>();

  return (
    <>
      <h3>Sending</h3>
      <div>
        <label>Address</label>
        <br />
        <input
          type="text"
          style={{ padding: "5px", width: "500px" }}
          value={recipient.address}
          onChange={(e) =>
            setRecipient((s) => ({ ...s, address: e.target.value }))
          }
          required
        ></input>
      </div>
      <div>
        <label>Amount</label>
        <br />
        <input
          type="number"
          style={{ padding: "5px", width: "500px" }}
          value={recipient.value}
          onChange={(e) =>
            setRecipient((s) => ({
              ...s,
              value: Number(e.target.value),
            }))
          }
          required
        ></input>
      </div>
      <div>
        <label>Fee (sat/vbyte)</label>
        <br />
        <input
          type="number"
          style={{ padding: "5px", width: "500px" }}
          value={recipient.feeRate}
          onChange={(e) =>
            setRecipient((s) => ({
              ...s,
              feeRate: Number(e.target.value) < 1 ? 1 : Number(e.target.value),
            }))
          }
          required
        ></input>
      </div>
      <button
        onClick={() => {
          const tx = wallet.sendToAddress(
            recipient.address,
            recipient.value,
            utxos,
            recipient.feeRate
          );
          setRecipient((s) => ({
            ...s,
            result: tx,
          }));
        }}
      >
        Send
      </button>
      <div style={{ overflowWrap: "break-word" }}>
        <p>{recipient.result}</p>
      </div>
    </>
  );
}

function UTXOS() {
  const { wallet, utxos, setUTXOS, setSats } = useOutletContext<{
    wallet: Wallet;
    utxos: UTXOInputType[];
    setSats: (a: number) => void;
    setUTXOS: (
      a: UTXOInputType[] | ((b: UTXOInputType[]) => UTXOInputType[])
    ) => void;
  }>();

  const [manualUTXO, setManualUTXO] = useState({
    hash: "",
    vout: 0,
    derivationPath: `m/86'/1'/0'/0/${wallet ? wallet.currentIndex : 0}`,
    value: 0,
  });

  return (
    <>
      <div>
        <h3>Add a UTXO</h3>
        <div style={{ display: "none" }}>
          <label>TXID</label>
          <br />
          <input
            type="text"
            style={{ padding: "5px", width: "500px" }}
            value={manualUTXO.hash}
            onChange={(e) =>
              setManualUTXO((state) => ({ ...state, hash: e.target.value }))
            }
            required
          ></input>
        </div>
        <div>
          <label>VOUT</label>
          <br />
          <input
            value={manualUTXO.vout}
            onChange={(e) =>
              setManualUTXO((state) => ({
                ...state,
                vout: Number(e.target.value) < 0 ? 0 : Number(e.target.value),
              }))
            }
            type={"number"}
            style={{ padding: "5px", width: "500px" }}
          ></input>
        </div>
        <div>
          <label>Derivation Path</label>
          <br />
          <input
            value={manualUTXO.derivationPath}
            onChange={(e) =>
              setManualUTXO((state) => ({
                ...state,
                derivationPath: e.target.value,
              }))
            }
            type={"text"}
            style={{ padding: "5px", width: "500px" }}
          ></input>
        </div>
        <div>
          <label>Value</label>
          <br />
          <input
            value={manualUTXO.value}
            onChange={(e) =>
              setManualUTXO((state) => ({
                ...state,
                value: Number(e.target.value) < 0 ? 0 : Number(e.target.value),
              }))
            }
            type={"number"}
            style={{ padding: "5px", width: "500px" }}
          ></input>
        </div>
        <button
          onClick={() => {
            setUTXOS((state) =>
              state.concat({
                hash: manualUTXO.hash,
                vout: manualUTXO.vout,
                value: manualUTXO.value,
                derivationPath: manualUTXO.derivationPath,
              })
            );

            wallet.utxos = utxos;
          }}
        >
          Add UTXO
        </button>
      </div>
      <a
        onClick={async () => {
          if (wallet) {
            wallet.scanUTXOS();
            setUTXOS(wallet.utxos);
            await wallet.scanChangeUTXOS();
            await wallet.updateStats();
            const number = wallet.updateStats();
            setSats(number);
          }
        }}
      >
        <button>Scan all Addresses</button>
      </a>
      <h3>List of UTXOS</h3>
      {utxos.reverse().map((utxo, i) => {
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "baseline",
            }}
          >
            <div>{utxo.hash}</div>
            <div>{utxo.vout}</div>
            <div>{utxo.derivationPath}</div>
            <div>{utxo.value}</div>
            <div>
              <button
                onClick={() => {
                  setUTXOS((state) =>
                    state
                      .reverse()
                      .filter((_v, index) => i !== index)
                      .reverse()
                  );
                }}
              >
                Delete UTXO
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Root() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}
export default Root;
