import { useEffect, useState } from "react";
import "./App.css";
import StartPage from "./StartPage";
import { ScreenState, AppState } from "./types";
import Wallet from "./Wallet";
import QRCode from "qrcode";

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.None);

  const [screenState, setScreenState] = useState<ScreenState>(
    ScreenState.Receive
  );
  const [walletState, setWalletState] = useState<{
    seed: Buffer | undefined;
    xpub: string;
  }>({ seed: undefined, xpub: "" });

  const [npage, setNPage] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("seed")) {
      setWalletState((s) => ({
        ...s,
        seed: Buffer.from(params.get("seed")!, "hex"),
      }));
      setAppState(AppState.Full);
    } else if (params.get("xpub")) {
      setWalletState((s) => ({
        ...s,
        seed: undefined,
        xpub: params.get("xpub")!,
      }));
      setAppState(AppState.WatchOnly);
    }
  }, [setAppState]);

  if (appState === AppState.Full || appState === AppState.WatchOnly) {
    const wallet = new Wallet(walletState.seed, walletState.xpub);
    return (
      <>
        <p style={{ fontSize: "32px" }}>{0} sats</p>
        <div>
          <button onClick={() => setScreenState(ScreenState.SilentPayment)}>
            Silent Payment
          </button>
          <button onClick={() => setScreenState(ScreenState.Receive)}>
            Receive
          </button>
          <button>Send</button>
          <button>Channel</button>
          <button onClick={() => setScreenState(ScreenState.UTXOS)}>
            UTXOs
          </button>
          <button onClick={() => setScreenState(ScreenState.Address)}>
            Addresses
          </button>
        </div>
        <div style={{ minHeight: "500px", textAlign: "center" }}>
          {screenState === ScreenState.SilentPayment &&
            (function () {
              const sp = wallet.generateSilentPayment(0);
              let qrCodeSP = "";
              QRCode.toDataURL(sp, (err, data) => {
                qrCodeSP = data;
              });

              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "column",
                  }}
                >
                  <h3>Silent Payments</h3>
                  <p style={{ maxWidth: "540px", overflowWrap: "break-word" }}>
                    {sp}
                  </p>
                  <img src={qrCodeSP} alt="" />
                </div>
              );
            })()}
          {screenState === ScreenState.UTXOS &&
            (function () {
              return (
                <>
                  <div>
                    <h3>Add a UTXO</h3>
                    <div>
                      <label>TXID</label>
                      <br />
                      <input
                        type="text"
                        style={{ padding: "5px", width: "500px" }}
                        required
                      ></input>
                    </div>
                    <div>
                      <label>VOUT</label>
                      <br />
                      <input
                        value={0}
                        type={"number"}
                        style={{ padding: "5px", width: "500px" }}
                      ></input>
                    </div>
                    <div>
                      <label>Derivation Path</label>
                      <br />
                      <input
                        value={"m/86'/1'/0'/0/0"}
                        type={"text"}
                        style={{ padding: "5px", width: "500px" }}
                      ></input>
                    </div>
                  </div>
                  <h3>List of UTXOS</h3>
                  <div></div>
                </>
              );
            })()}
          {screenState === ScreenState.Receive &&
            (function () {
              const newAddress = wallet.generateAddress(0);
              let addressQRCode = "";
              QRCode.toDataURL("bitcoin:" + newAddress, (err, data) => {
                addressQRCode = data;
              });
              return (
                <>
                  <div style={{ overflowWrap: "break-word" }}>
                    <h3>Unused Address</h3>
                    <p>{newAddress}</p>
                    <img src={addressQRCode} alt="" />
                  </div>
                </>
              );
            })()}
          {screenState === ScreenState.Address && (
            <>
              <h3>Addresses</h3>
              {[...Array(15).keys()].map((i) => (
                <div
                  id={i.toString()}
                  style={{
                    display: "flex",
                    alignContent: "space-between",
                    gap: "30px",
                    marginTop: "2px",
                    width: "700px",
                  }}
                >
                  <div>{(i + npage).toString().padStart(2, "0")}</div>
                  <div style={{ alignSelf: "end" }}>
                    {wallet.generateAddress(i + npage)}
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
          )}
        </div>
      </>
    );
  } else if (appState === AppState.None) {
    return (
      <StartPage appState={appState} setAppState={setAppState}></StartPage>
    );
  }
}

export default App;
