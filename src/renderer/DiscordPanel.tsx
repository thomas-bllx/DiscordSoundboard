import { useEffect, useState } from "react";
import {
  Radio,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Mic,
  CheckCircle2,
  RefreshCw,
  LogOut,
} from "lucide-react";
import type { AppState, ChannelInfo } from "../shared/model";
import type { Run } from "./App";
import { Toggle } from "./components";

const api = window.soundboard;
export function DiscordPanel({ state, run }: { state: AppState; run: Run }) {
  const { discord, config } = state;
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState(config.settings.clientId);
  const [userId, setUserId] = useState(config.settings.userId);
  const [guildId, setGuildId] = useState(config.settings.lastGuildId);
  const [channelId, setChannelId] = useState(config.settings.lastChannelId);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const connected = discord.status === "online";
  const connecting =
    discord.status === "connecting" || discord.status === "reconnecting";
  useEffect(() => {
    if (!connected) {
      setChannels([]);
      return;
    }
    if (!discord.guilds.some((g) => g.id === guildId))
      setGuildId(discord.guilds[0]?.id ?? "");
  }, [connected, discord.guilds, guildId]);
  useEffect(() => {
    let active = true;
    setChannels([]);
    if (!connected || !guildId) return;
    setLoadingChannels(true);
    void run(api.listChannels(guildId)).then((value) => {
      if (!active) return;
      const list = value ?? [];
      setChannels(list);
      setChannelId((current) =>
        list.some((c) => c.id === current)
          ? current
          : (list.find((c) => c.accessible)?.id ?? ""),
      );
      setLoadingChannels(false);
    });
    return () => {
      active = false;
    };
  }, [connected, guildId, refresh, run]);
  async function save() {
    setBusy(true);
    try {
      const settings = await api.updateSettings({ clientId, userId });
      if (!settings.ok) {
        await run(Promise.resolve(settings));
        return;
      }
      if (token.trim()) {
        const secret = token;
        setToken("");
        await run(
          api.saveToken(secret),
          "Token enregistré dans le coffre Windows.",
        );
      } else await run(Promise.resolve(settings), "Configuration enregistrée.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN BOT. UN FLUX AUDIO INDÉPENDANT.</p>
          <h1>
            Votre voix reste votre voix<span className="mint">.</span>
          </h1>
          <p>
            Les sons passent par votre bot. Krisp reste activé sur votre micro.
          </p>
        </div>
      </div>
      <div className="signal-flow">
        <div>
          <Mic size={23} />
          <span>
            Votre micro<small>Krisp activé dans Discord</small>
          </span>
        </div>
        <ArrowRight size={18} />
        <div className="flow-destination">
          <Headphones size={25} />
          <span>
            Salon vocal<small>Deux flux indépendants</small>
          </span>
        </div>
        <ArrowRight className="reverse-arrow" size={18} />
        <div>
          <AudioMark />
          <span>
            Votre soundboard<small>Bot + chiffrement DAVE</small>
          </span>
        </div>
      </div>
      <div className="discord-grid">
        <section className="panel">
          <div className="section-title">
            <span className="step">01</span>
            <h2>Configurer votre bot</h2>
            <KeyRound size={19} />
          </div>
          <p className="panel-intro">
            Créez une application Discord, puis copiez le token de son bot.
            Aucun token de compte personnel.
          </p>
          <button
            className="text-link"
            onClick={() => void run(api.openLink("portal"))}
          >
            Ouvrir le Developer Portal
            <ExternalLink size={14} />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="field">
              Token du bot
              <span
                className={`field-status ${state.tokenStored ? "stored" : ""}`}
              >
                {state.tokenStored ? (
                  <>
                    <ShieldCheck size={13} />
                    Enregistré et chiffré
                  </>
                ) : (
                  "À renseigner"
                )}
              </span>
              <input
                type="password"
                aria-label="Token du bot"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  state.tokenStored
                    ? "Saisir ici pour remplacer le token"
                    : "Coller le token du bot"
                }
              />
              <small>
                Chiffré sur votre PC. Le token n’est jamais réaffiché.
              </small>
            </label>
            <label className="field">
              Application ID / Client ID
              <input
                inputMode="numeric"
                aria-label="Application ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Identifiant de votre application"
              />
              <small>Utilisé pour générer le lien d’invitation du bot.</small>
            </label>
            <label className="field">
              Votre identifiant Discord{" "}
              <span className="optional">facultatif</span>
              <input
                inputMode="numeric"
                aria-label="Identifiant utilisateur Discord"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Pour le suivi automatique du salon"
              />
            </label>
            {!state.encryptionAvailable && (
              <p className="form-error">
                Le coffre sécurisé est indisponible. L’enregistrement du token
                est désactivé.
              </p>
            )}
            <div className="form-actions">
              <button
                className="primary"
                type="submit"
                disabled={busy || !state.encryptionAvailable}
              >
                Enregistrer
              </button>
              {state.tokenStored && (
                <button
                  type="button"
                  className="text-link muted"
                  onClick={() =>
                    void run(
                      api.removeToken(),
                      "Token supprimé. Bot déconnecté.",
                    )
                  }
                >
                  Oublier le token
                </button>
              )}
            </div>
          </form>
          <div className="invite-box">
            <p>
              Invitez le bot sur votre serveur avec les permissions{" "}
              <strong>Voir le salon</strong>, <strong>Se connecter</strong> et{" "}
              <strong>Parler</strong>.
            </p>
            <button
              className="secondary"
              disabled={!config.settings.clientId}
              onClick={() => void run(api.openLink("invite"))}
            >
              Inviter le bot
              <ExternalLink size={14} />
            </button>
          </div>
        </section>
        <div className="discord-right">
          <section className="panel">
            <div className="section-title">
              <span className="step">02</span>
              <h2>Rejoindre un salon</h2>
              <Radio size={20} />
            </div>
            <div className="bot-status">
              <i
                className={`dot ${connected ? "green" : connecting ? "amber" : ""}`}
              />
              <div>
                <strong>
                  {connected
                    ? discord.botName
                    : connecting
                      ? "Connexion à Discord…"
                      : "Bot hors ligne"}
                </strong>
                <small>
                  {connected
                    ? "Connecté à Discord"
                    : "Vos sons locaux restent disponibles"}
                </small>
              </div>
              {connected || connecting ? (
                <button
                  className="icon-button"
                  title="Déconnecter le bot"
                  aria-label="Déconnecter le bot"
                  onClick={() => void run(api.disconnect())}
                >
                  <LogOut size={19} />
                </button>
              ) : (
                <button
                  className="secondary"
                  disabled={!state.tokenStored}
                  onClick={() => void run(api.connect())}
                >
                  Connecter
                </button>
              )}
            </div>
            {discord.error && (
              <p className="form-error" role="alert">
                {discord.error}
              </p>
            )}
            <label className="field">
              Serveur
              <select
                aria-label="Serveur Discord"
                value={guildId}
                disabled={!connected}
                onChange={(e) => {
                  setGuildId(e.target.value);
                  setChannelId("");
                }}
              >
                <option value="">
                  {connected
                    ? "Sélectionner un serveur"
                    : "Connectez le bot pour voir les serveurs"}
                </option>
                {discord.guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            {connected && discord.guilds.length === 0 && (
              <p className="hint">
                Aucun serveur accessible. Invitez d’abord le bot sur votre
                serveur, puis attendez quelques secondes.
              </p>
            )}
            <label className="field">
              Salon vocal
              <div className="channel-select">
                <select
                  aria-label="Salon vocal Discord"
                  value={channelId}
                  disabled={!connected || loadingChannels}
                  onChange={(e) => setChannelId(e.target.value)}
                >
                  <option value="">
                    {loadingChannels ? "Chargement…" : "Sélectionner un salon"}
                  </option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.accessible}>
                      {c.name}
                      {c.accessible ? "" : " — permissions insuffisantes"}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  disabled={!connected || loadingChannels}
                  title="Actualiser les salons"
                  aria-label="Actualiser les salons"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            </label>
            <div className="form-actions">
              <button
                className="primary"
                disabled={
                  !connected || !channelId || discord.voice === "joining"
                }
                onClick={() =>
                  void run(
                    api.join(guildId, channelId),
                    "Bot connecté au salon vocal.",
                  )
                }
              >
                <Radio size={17} />
                {discord.voice === "joining"
                  ? "Connexion au salon…"
                  : "Rejoindre le salon"}
              </button>
              {discord.voice !== "idle" && (
                <button
                  className="secondary"
                  onClick={() => void run(api.leave())}
                >
                  Quitter
                </button>
              )}
            </div>
            {discord.voice === "ready" && (
              <div className="voice-ready">
                <CheckCircle2 size={20} />
                <div>
                  Prêt dans <strong>{discord.channelName}</strong>
                  <small>
                    Sélectionnez « Discord » dans la bibliothèque pour diffuser.
                  </small>
                </div>
              </div>
            )}
            {discord.voice === "reconnecting" && (
              <p className="hint">
                Connexion vocale interrompue. Tentative de reconnexion…
              </p>
            )}
            <Toggle
              checked={config.settings.followUser}
              disabled={!config.settings.userId}
              label="Suivre mon salon vocal"
              description="Le bot suit les changements de salon sur les serveurs communs et quitte quand vous partez."
              onChange={(value) =>
                void run(api.updateSettings({ followUser: value }))
              }
            />
          </section>
          <section className="help-card">
            <ShieldCheck size={22} />
            <div>
              <h3>Un circuit indépendant du micro</h3>
              <p>
                Le bot n’enregistre pas les conversations. Aucun câble virtuel
                et aucun serveur à héberger. Les appels privés Discord ne sont
                pas pris en charge.
              </p>
              <button
                className="text-link"
                onClick={() => void run(api.openLink("guide"))}
              >
                Guide de configuration pas à pas
                <ExternalLink size={14} />
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
function AudioMark() {
  return <Radio size={24} className="mint" />;
}
