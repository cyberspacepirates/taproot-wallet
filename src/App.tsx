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
    sats: number;
    seed: Buffer | undefined;
    xpub: string;
    utxos:
      | Array<{
          hash: string;
          vout: number;
          derivationPath: string;
          value: number;
        }>
      | [];
  }>({ sats: 0, seed: undefined, xpub: "", utxos: [] });

  const [utxo, setUTXO] = useState<{
    hash: string;
    vout: number;
    derivationPath: string;
    value: number;
  }>({
    hash: "",
    vout: 0,
    derivationPath: "m/86'/1'/0'/0/0",
    value: 0,
  });

  const [recipient, setRecipient] = useState<{
    address: string;
    value: number;
    result: string;
  }>({
    address: "",
    value: 0,
    result: "",
  });

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
    wallet.scanUTXOS().then(() => {
      console.log(wallet.utxos);
      setWalletState((s) => ({
        ...s,
        utxos: wallet.utxos,
      }));
    });
    // setWalletState((s) => ({
    //   ...s,
    //   utxos: wallet.utxos,
    // }));
    return (
      <>
        <p style={{ fontSize: "32px" }}>{walletState.sats} sats</p>
        <div>
          <button onClick={() => setScreenState(ScreenState.SilentPayment)}>
            Silent Payment
          </button>
          <button onClick={() => setScreenState(ScreenState.Receive)}>
            Receive
          </button>
          <button onClick={() => setScreenState(ScreenState.Send)}>Send</button>
          <button>Channel</button>
          <button onClick={() => setScreenState(ScreenState.UTXOS)}>
            UTXOs
          </button>
          <button onClick={() => setScreenState(ScreenState.Address)}>
            Addresses
          </button>
        </div>
        <div style={{ minHeight: "520px", textAlign: "center" }}>
          {screenState === ScreenState.SilentPayment &&
            (function () {
              const sp = wallet.generateSilentPayment(0);
              let qrCodeSP = "";
              QRCode.toDataURL(sp, (err, data) => {
                if (err) return;
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
          {screenState === ScreenState.Send &&
            (function () {
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
                  <button
                    onClick={() => {
                      const tx = wallet.sendToAddress(
                        recipient.address,
                        recipient.value,
                        walletState.utxos
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
                        value={utxo.hash}
                        onChange={(e) =>
                          setUTXO((s) => ({ ...s, hash: e.target.value }))
                        }
                        required
                      ></input>
                    </div>
                    <div>
                      <label>VOUT</label>
                      <br />
                      <input
                        value={utxo.vout}
                        onChange={(e) =>
                          setUTXO((s) => ({
                            ...s,
                            vout:
                              Number(e.target.value) < 0
                                ? 0
                                : Number(e.target.value),
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
                        value={utxo.derivationPath}
                        onChange={(e) =>
                          setUTXO((s) => ({
                            ...s,
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
                        value={utxo.value}
                        onChange={(e) =>
                          setUTXO((s) => ({
                            ...s,
                            value:
                              Number(e.target.value) < 0
                                ? 0
                                : Number(e.target.value),
                          }))
                        }
                        type={"number"}
                        style={{ padding: "5px", width: "500px" }}
                      ></input>
                    </div>
                    <button
                      onClick={() => {
                        setWalletState((s) => ({
                          ...s,
                          utxos: s.utxos.concat({
                            //@ts-expect-error next
                            hash: utxo.hash,
                            vout: utxo.vout,
                            value: utxo.value,
                            derivationPath: utxo.derivationPath,
                          }),
                          sats:
                            s.utxos.reduce((acc, curr) => acc + curr.value, 0) +
                            utxo.value,
                        }));
                      }}
                    >
                      Add UTXO
                    </button>
                  </div>
                  <h3>List of UTXOS</h3>
                  {walletState.utxos.reverse().map((utxo, i) => {
                    return (
                      <div
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
                              setWalletState((s) => ({
                                ...s,
                                utxos: s.utxos
                                  .reverse()
                                  .filter((_v, index) => i !== index)
                                  .reverse(),
                              }));
                            }}
                          >
                            Delete UTXO
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div></div>
                </>
              );
            })()}
          {screenState === ScreenState.Receive &&
            (function () {
              const newAddress = wallet.generateAddress(0);
              let addressQRCode = "";
              QRCode.toDataURL("bitcoin:" + newAddress, (err, data) => {
                if (err) return;
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
                    gap: "12px",
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
