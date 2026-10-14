import { useEffect, useState } from "react";
import {
  Gamepad2,
  Mic,
  Headphones,
  Download,
  RefreshCw,
  Power,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { AppState, Settings } from "../shared/model";
import {
  isCableInput,
  isExplicitDevice,
  isVirtualDevice,
} from "../shared/routing";
import type { Run } from "./App";
import type { GameAudio } from "./game-audio";
import { Toggle, Volume } from "./components";

const api = window.soundboard;
export function GamePanel({
  state,
  run,
  audio,
}: {
  state: AppState;
  run: Run;
  audio: GameAudio | null;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settings = state.config.settings;
  const active = state.gameSession.status === "ready";
  const pending = state.gameSession.status === "starting";
  const outputs = devices.filter(
    (d) => d.kind === "audiooutput" && isExplicitDevice(d.deviceId),
  );
  const cables = outputs.filter((d) => isCableInput(d.label));
  const microphones = devices.filter(
    (d) =>
      d.kind === "audioinput" &&
      isExplicitDevice(d.deviceId) &&
      !isVirtualDevice(d.label),
  );
  const monitors = outputs.filter((d) => !isVirtualDevice(d.label));
  async function refresh() {
    if (!audio) return;
    setError("");
    try {
      const list = await audio.devices();
      setDevices(list);
      const cable = list.find(
        (d) =>
          d.kind === "audiooutput" &&
          isExplicitDevice(d.deviceId) &&
          isCableInput(d.label),
      );
      if (cable && !settings.gameOutputId)
        await run(api.updateSettings({ gameOutputId: cable.deviceId }));
    } catch {
      setError(
        "Impossible de lister les appareils. Vérifiez l’accès au microphone dans les paramètres de confidentialité Windows.",
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, [audio]);
  const update = (patch: Partial<Settings>) => {
    void run(api.updateSettings(patch));
  };
  const unavailable = busy || pending || state.driver.status === "installing";
  async function activate() {
    if (!audio) return;
    setBusy(true);
    try {
      if (active) await audio.stop();
      else {
        const output = settings.output === "both" ? "both" : "game";
        const result = await api.updateSettings({ output });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await audio.start({ ...settings, output });
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN MICRO POUR VOS JEUX</p>
          <h1>
            Faites entendre vos sons<span className="mint">.</span>
          </h1>
          <p>
            Une seule configuration pour les jeux qui permettent de choisir leur
            microphone.
          </p>
        </div>
      </div>
      <div className={`game-session ${active ? "ready" : ""}`}>
        <Gamepad2 size={28} />
        <div>
          <strong>
            {active
              ? "Audio en jeu actif"
              : pending
                ? "Activation…"
                : "Audio en jeu désactivé"}
          </strong>
          <span>
            {active
              ? settings.gameMicEnabled
                ? "Votre voix et vos sons sont envoyés au micro virtuel."
                : "Seuls les sons de la soundboard sont envoyés au micro virtuel."
              : "Votre microphone n’est pas transmis par l’application."}
          </span>
        </div>
        <button
          className={active ? "secondary" : "primary"}
          onClick={() => void activate()}
          disabled={unavailable || !audio || !settings.gameOutputId}
        >
          <Power size={17} />
          {active ? "Désactiver le mode jeu" : "Activer le mode jeu"}
        </button>
      </div>
      {(error || state.gameSession.error) && (
        <div className="banner warning" role="alert">
          {error || state.gameSession.error}
        </div>
      )}
      <div className="game-columns">
        <section className="panel">
          <div className="section-title">
            <Download size={21} />
            <h2>1. Composant audio inclus</h2>
          </div>
          <p className="hint">
            L’application inclut VB-CABLE. Aucun téléchargement ni logiciel de
            mixage à configurer séparément.
          </p>
          <div className={`driver-status ${state.driver.status}`}>
            <i
              className={`dot ${state.driver.status === "installed" ? "green" : ""}`}
            />
            <span>{state.driver.message}</span>
          </div>
          <div className="game-actions">
            <button
              className="primary"
              disabled={
                unavailable ||
                ["installed", "restart", "checking"].includes(
                  state.driver.status,
                )
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await run(api.installDriver());
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={17} />
              {state.driver.status === "installing"
                ? "Installation…"
                : "Installer le composant audio"}
            </button>
            <button
              className="secondary"
              disabled={unavailable}
              onClick={async () => {
                setBusy(true);
                try {
                  await run(api.refreshDriver());
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
          </div>
          <p className="hint">
            Windows demandera l’autorisation administrateur. Un redémarrage peut
            être nécessaire ; l’application ne redémarre pas votre PC.
          </p>
          <div className="driver-credit">
            <strong>VB-CABLE · VB-Audio Software</strong>
            <p>
              Composant tiers en donationware : tous les dons sont les
              bienvenus.
            </p>
            <button
              className="text-link"
              onClick={() => void run(api.openLink("cable"))}
            >
              Site officiel <ArrowUpRight size={13} />
            </button>
            <button
              className="text-link"
              onClick={() => void run(api.openLink("cableLicense"))}
            >
              Licence
            </button>
            <button
              className="text-link"
              onClick={() => void run(api.openLink("cableDonate"))}
            >
              Soutenir VB-Audio
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <Mic size={21} />
            <h2>2. Votre voix et vos sons</h2>
          </div>
          <label className="field">
            Sortie vers les jeux
            <select
              value={settings.gameOutputId}
              disabled={unavailable}
              onChange={(e) => update({ gameOutputId: e.target.value })}
            >
              <option value="">Sélectionner le périphérique virtuel</option>
              {settings.gameOutputId &&
                !cables.some((d) => d.deviceId === settings.gameOutputId) && (
                  <option value={settings.gameOutputId}>
                    Périphérique mémorisé indisponible
                  </option>
                )}
              {cables.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            label="Ajouter ma voix dans les jeux"
            description="Votre vrai micro reste disponible dans Discord. Aucun enregistrement."
            checked={settings.gameMicEnabled}
            disabled={unavailable}
            onChange={(value) => update({ gameMicEnabled: value })}
          />
          {settings.gameMicEnabled && (
            <>
              <label className="field">
                Votre microphone
                <select
                  value={settings.gameMicrophoneId}
                  disabled={unavailable}
                  onChange={(e) => update({ gameMicrophoneId: e.target.value })}
                >
                  <option value="">Choisir votre vrai microphone</option>
                  {settings.gameMicrophoneId &&
                    !microphones.some(
                      (d) => d.deviceId === settings.gameMicrophoneId,
                    ) && (
                      <option value={settings.gameMicrophoneId}>
                        Microphone mémorisé indisponible
                      </option>
                    )}
                  {microphones.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <Volume
                label="Volume de ma voix en jeu"
                value={settings.gameMicVolume}
                onChange={(value) => update({ gameMicVolume: value })}
              />
            </>
          )}
          <Toggle
            label="Entendre aussi les sons dans mon casque"
            description="Retour des sons uniquement, sans vous renvoyer votre propre voix."
            checked={settings.gameMonitorEnabled}
            disabled={unavailable}
            onChange={(value) => update({ gameMonitorEnabled: value })}
          />
          <label className="field">
            <span>
              <Headphones size={15} /> Casque pour la préécoute et le retour
            </span>
            <select
              value={settings.gameMonitorId}
              disabled={unavailable}
              onChange={(e) => update({ gameMonitorId: e.target.value })}
            >
              <option value="">Choisir une sortie physique</option>
              {settings.gameMonitorId &&
                !monitors.some(
                  (d) => d.deviceId === settings.gameMonitorId,
                ) && (
                  <option value={settings.gameMonitorId}>
                    Casque mémorisé indisponible
                  </option>
                )}
              {monitors.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {settings.gameMonitorEnabled && (
            <>
              <Volume
                label="Volume du retour casque"
                value={settings.gameMonitorVolume}
                onChange={(value) => update({ gameMonitorVolume: value })}
              />
            </>
          )}
          <p className="hint">
            Changer de périphérique ou de mélange désactive le mode jeu.
            Réactivez-le après vos réglages. STOP coupe les sons ; « Désactiver
            » libère aussi le micro.
          </p>
        </section>
      </div>
      <section className="panel game-guide">
        <div className="section-title">
          <ShieldCheck size={21} />
          <h2>3. Choisir le micro dans votre jeu</h2>
        </div>
        <div className="game-routing">
          <div>
            <span>DANS LE JEU</span>
            <strong>CABLE Output (VB-Audio Virtual Cable)</strong>
            <p>
              Votre voix et les sons. Gardez la touche « Appuyer pour parler »
              du jeu si elle est requise.
            </p>
          </div>
          <div>
            <span>DANS DISCORD</span>
            <strong>Votre microphone habituel</strong>
            <p>
              Sélectionnez son nom plutôt que « Par défaut ». Krisp peut rester
              activé. En destination « En jeu », le bot reste silencieux.
            </p>
          </div>
        </div>
        <p className="hint">
          Ne sélectionnez pas CABLE Output dans Discord et gardez votre casque
          comme sortie Windows et sortie du jeu. Les jeux qui imposent leur
          propre micro ou bloquent certains raccourcis peuvent demander un
          réglage spécifique.
        </p>
      </section>
    </>
  );
}
