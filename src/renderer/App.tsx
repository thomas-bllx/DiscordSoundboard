import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AudioLines,
  LayoutGrid,
  Radio,
  Settings2,
  Plus,
  Upload,
  Search,
  Headphones,
  Square,
  Star,
  MoreHorizontal,
  Keyboard,
  ArrowUpRight,
  FolderOpen,
  Check,
  AlertCircle,
  X,
  GripVertical,
  ChevronRight,
  Play,
  ShieldCheck,
  Gamepad2,
} from "lucide-react";
import type { AppState, Result, Sound, Settings } from "../shared/model";
import { PreviewPlayer } from "./audio";
import {
  Modal,
  ShortcutInput,
  Toggle,
  Volume,
  shortcutLabel,
  durationLabel,
} from "./components";
import { DiscordPanel } from "./DiscordPanel";
import { GamePanel } from "./GamePanel";
import { GameAudio } from "./game-audio";
import { destinations } from "../shared/routing";

type Page = "board" | "discord" | "game" | "settings";
type Toast = {
  id: number;
  message: string;
  level: "success" | "error" | "info";
};
export type Run = <T>(
  operation: Promise<Result<T>>,
  success?: string,
) => Promise<T | undefined>;
const api = window.soundboard;
export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [gameAudio, setGameAudio] = useState<GameAudio | null>(null);
  const [page, setPage] = useState<Page>("board");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [editing, setEditing] = useState<Sound | null>(null);
  const [profileModal, setProfileModal] = useState<"new" | "edit" | null>(null);
  const [profileName, setProfileName] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const toastId = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [page]);
  const notify = useCallback(
    (message: string, level: Toast["level"] = "error") => {
      const id = ++toastId.current;
      setToasts((current) => [...current.slice(-3), { id, message, level }]);
      if (level !== "error")
        setTimeout(
          () => setToasts((current) => current.filter((t) => t.id !== id)),
          5500,
        );
    },
    [],
  );
  const run: Run = useCallback(
    async <T,>(
      operation: Promise<Result<T>>,
      success?: string,
    ): Promise<T | undefined> => {
      try {
        const result = await operation;
        if (!result.ok) {
          notify(result.error);
          return undefined;
        }
        if (success) notify(success, "success");
        return result.value;
      } catch {
        notify("L’application ne répond pas. Fermez-la puis relancez-la.");
        return undefined;
      }
    },
    [notify],
  );
  useEffect(() => {
    const player = new PreviewPlayer(api);
    const game = new GameAudio(api);
    setGameAudio(game);
    const unsubscribe = api.onEvent((event) => {
      if (event.type === "state") {
        setState(event.state);
        game.update(event.state.config.settings);
        player.configure(
          event.state.config.settings.gameMonitorId,
          event.state.driver.status === "installed" ||
            event.state.driver.status === "restart",
        );
      }
      if (event.type === "localAudio") player.receive(event.event);
      if (event.type === "gameAudio") game.receive(event.event);
      if (event.type === "gameDisabled") void game.stop();
      if (event.type === "notice") notify(event.message, event.level);
    });
    void run(api.getState()).then((value) => {
      if (value) {
        setState(value);
        player.configure(
          value.config.settings.gameMonitorId,
          value.driver.status === "installed" ||
            value.driver.status === "restart",
        );
      }
    });
    return () => {
      unsubscribe();
      player.reset();
      game.dispose();
    };
  }, [notify, run]);
  async function importSounds(paths?: string[]) {
    const report = await run(api.importSounds(paths));
    if (!report) return;
    if (report.imported)
      notify(
        `${report.imported} son${report.imported > 1 ? "s" : ""} ajouté${report.imported > 1 ? "s" : ""} à votre bibliothèque.`,
        "success",
      );
    if (report.failures.length) notify(report.failures.join("\n"));
  }
  if (!state)
    return (
      <div className="loading">
        <AudioLines size={40} />
        <p>Ouverture de votre soundboard…</p>
        {toasts.map((t) => (
          <p key={t.id}>{t.message}</p>
        ))}
      </div>
    );
  const { config, discord, local, broadcast } = state;
  const profile = config.profiles.find((p) => p.id === config.activeProfileId)!;
  const sounds = config.sounds.filter((s) => s.profileId === profile.id);
  const visible = sounds.filter(
    (s) =>
      (!favorites || s.favorite) &&
      s.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
  );
  const errors = state.shortcuts.filter((s) => s.status === "error");
  const route = destinations(config.settings.output);
  const playing = route.game ? state.game : route.discord ? broadcast : local;
  const updateSettings = (patch: Partial<Settings>) => {
    void run(api.updateSettings(patch));
  };
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const ids = sounds.map((s) => s.id);
    const index = ids.indexOf(from);
    if (index === -1) return;
    ids.splice(index, 1);
    ids.splice(ids.indexOf(to), 0, from);
    void run(api.reorderSounds(ids));
  };
  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const paths = api.pathsForFiles(Array.from(e.dataTransfer.files));
        if (paths.length) void importSounds(paths);
      }}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <AudioLines size={25} />
          </span>
          <div>
            Soundboard<small>LOCAL / DISCORD / JEUX</small>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          <button
            className={page === "board" ? "nav active" : "nav"}
            onClick={() => setPage("board")}
          >
            <LayoutGrid size={19} />
            Bibliothèque<span className="count">{config.sounds.length}</span>
          </button>
          <button
            className={page === "discord" ? "nav active" : "nav"}
            onClick={() => setPage("discord")}
          >
            <Radio size={19} />
            Connexion Discord
            {discord.status === "online" && <i className="dot green" />}
          </button>
          <button
            className={page === "settings" ? "nav active" : "nav"}
            onClick={() => setPage("settings")}
          >
            <Settings2 size={19} />
            Paramètres
          </button>
          <button
            className={page === "game" ? "nav active" : "nav"}
            onClick={() => setPage("game")}
          >
            <Gamepad2 size={19} />
            En jeu
            {state.gameSession.status === "ready" && (
              <i className="dot green" />
            )}
          </button>
        </nav>
        <div className="sidebar-section">
          <span>PROFILS</span>
          <button
            className="icon-button"
            aria-label="Créer un profil"
            onClick={() => {
              setProfileName("");
              setProfileModal("new");
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="profiles">
          {config.profiles.map((p) => (
            <button
              key={p.id}
              className={`profile ${p.id === profile.id ? "selected" : ""}`}
              onClick={() => {
                void run(api.selectProfile(p.id));
                setPage("board");
                setSearch("");
              }}
            >
              <span className="profile-dot" /> <span>{p.name}</span>
              <small>
                {config.sounds.filter((s) => s.profileId === p.id).length}
              </small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="private-label">
            <ShieldCheck size={15} />
            <span>Votre PC. Vos sons.</span>
          </div>
          <div className="connection-card">
            <div>
              <i
                className={`dot ${discord.voice === "ready" ? "green" : ""}`}
              />
              <strong>
                {discord.voice === "ready"
                  ? "Bot en vocal"
                  : "Bot déconnecté du vocal"}
              </strong>
            </div>
            <p>
              {discord.voice === "ready"
                ? discord.channelName
                : "Connectez votre bot pour diffuser dans Discord."}
            </p>
            <button onClick={() => setPage("discord")}>
              {discord.voice === "ready"
                ? "Gérer la connexion"
                : "Configurer Discord"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <small className="version">
            v{state.version} · Tout reste en local
          </small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            ESPACE LOCAL
            <ChevronRight size={13} />
            <span>
              {page === "board"
                ? "Bibliothèque"
                : page === "discord"
                  ? "Discord"
                  : page === "game"
                    ? "En jeu"
                    : "Paramètres"}
            </span>
          </div>
          <button
            className={`shortcut-status ${config.settings.shortcutsEnabled ? "" : "muted"}`}
            onClick={() =>
              updateSettings({
                shortcutsEnabled: !config.settings.shortcutsEnabled,
              })
            }
            title="Activer ou désactiver les raccourcis globaux"
          >
            <Keyboard size={16} />
            <span>
              {config.settings.shortcutsEnabled
                ? "Raccourcis actifs"
                : "Raccourcis suspendus"}
            </span>
            <i
              className={`dot ${config.settings.shortcutsEnabled && !errors.length ? "green" : ""}`}
            />
          </button>
        </header>
        <div className="page-content" ref={content}>
          {state.storageWarning && (
            <div className="banner warning">
              <AlertCircle size={18} />
              {state.storageWarning}
            </div>
          )}
          {errors.length > 0 && (
            <div className="banner warning">
              <AlertCircle size={18} />
              <span>
                {errors.length} raccourci(s) indisponible(s). Modifiez-les dans
                les sons ou les paramètres.
              </span>
            </div>
          )}
          {page === "board" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">PRÊT POUR VOTRE PROCHAIN MOMENT</p>
                  <h1>
                    Votre bibliothèque de sons<span className="mint">.</span>
                  </h1>
                  <p>Un clic, un raccourci. Faites-vous entendre.</p>
                </div>
                <button
                  className="primary"
                  disabled={state.importing}
                  onClick={() => void importSounds()}
                >
                  <Plus size={18} />
                  {state.importing ? "Importation…" : "Importer des sons"}
                </button>
              </div>
              <div className="route-bar">
                <div className="route-label">
                  <span>DESTINATION</span>
                  <small>
                    {
                      {
                        local: "Audible sur ce PC uniquement",
                        discord: "Diffusion par le bot, micro indépendant",
                        game: "Vocal du jeu uniquement · bot silencieux",
                        both: "Vocal du jeu et bot Discord",
                      }[config.settings.output]
                    }
                  </small>
                </div>
                <div
                  className="segmented"
                  role="group"
                  aria-label="Destination de lecture"
                >
                  <button
                    className={
                      config.settings.output === "local" ? "selected" : ""
                    }
                    onClick={() => updateSettings({ output: "local" })}
                  >
                    <Headphones size={16} />
                    Écoute locale
                  </button>
                  <button
                    className={
                      config.settings.output === "discord" ? "selected" : ""
                    }
                    onClick={() => updateSettings({ output: "discord" })}
                  >
                    <Radio size={16} />
                    Discord
                    <i
                      className={`dot ${discord.voice === "ready" ? "green" : ""}`}
                    />
                  </button>
                  <button
                    className={
                      config.settings.output === "game" ? "selected" : ""
                    }
                    onClick={() => updateSettings({ output: "game" })}
                  >
                    <Gamepad2 size={16} />
                    En jeu
                    <i
                      className={`dot ${state.gameSession.status === "ready" ? "green" : ""}`}
                    />
                  </button>
                  <button
                    className={
                      config.settings.output === "both" ? "selected" : ""
                    }
                    onClick={() => updateSettings({ output: "both" })}
                  >
                    Jeu + Discord
                  </button>
                </div>
              </div>
              {route.discord && discord.voice !== "ready" && (
                <div className="banner">
                  <Radio size={17} />
                  <span>Rejoignez un salon vocal pour diffuser vos sons.</span>
                  <button onClick={() => setPage("discord")}>
                    Connecter le bot
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {route.game && state.gameSession.status !== "ready" && (
                <div className="banner">
                  <Gamepad2 size={17} />
                  <span>
                    Configurez et activez l’audio en jeu avant de diffuser.
                  </span>
                  <button onClick={() => setPage("game")}>
                    Configurer le mode jeu
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              <div className="library-toolbar">
                <div className="profile-title">
                  <h2>{profile.name}</h2>
                  <span className="badge">{sounds.length}</span>
                  <button
                    className="icon-button"
                    aria-label="Modifier le profil"
                    onClick={() => {
                      setProfileName(profile.name);
                      setProfileModal("edit");
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                <div className="filters">
                  <button
                    className={`icon-button favorite-filter ${favorites ? "selected" : ""}`}
                    aria-label="Afficher les favoris"
                    aria-pressed={favorites}
                    onClick={() => setFavorites(!favorites)}
                  >
                    <Star size={18} />
                  </button>
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Rechercher un son"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un son…"
                    />
                  </label>
                </div>
              </div>
              {sounds.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-art" aria-hidden="true">
                    <div className="ghost-pad">
                      <Radio />
                    </div>
                    <div className="main-pad">
                      <AudioLines size={44} />
                    </div>
                    <div className="ghost-pad violet">
                      <Headphones />
                    </div>
                  </div>
                  <h2>Votre prochain son commence ici.</h2>
                  <p>
                    Glissez vos fichiers audio dans cette fenêtre
                    <br />
                    ou importez-les depuis votre ordinateur.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => void importSounds()}
                    disabled={state.importing}
                  >
                    <Upload size={17} />
                    Choisir des fichiers
                  </button>
                  <div className="format-tags">
                    <span>MP3</span>
                    <span>WAV</span>
                    <span>OGG</span>
                    <small>Sans limite de durée</small>
                  </div>
                </div>
              ) : visible.length === 0 ? (
                <div className="empty-search">
                  <Search size={30} />
                  <h2>Aucun son trouvé</h2>
                  <p>
                    Essayez un autre nom ou désactivez le filtre des favoris.
                  </p>
                </div>
              ) : (
                <div className="sound-grid">
                  {visible.map((sound) => {
                    const activeLocal =
                      local.soundId === sound.id && local.status !== "idle";
                    const activeDiscord =
                      broadcast.soundId === sound.id &&
                      broadcast.status !== "idle";
                    const activeGame =
                      state.game.soundId === sound.id &&
                      state.game.status !== "idle";
                    const active = activeLocal || activeDiscord || activeGame;
                    const shortcut = state.shortcuts.find(
                      (s) => s.soundId === sound.id,
                    );
                    return (
                      <article
                        key={sound.id}
                        className={`sound-card ${active ? "playing" : ""}`}
                        style={
                          { "--sound-color": sound.color } as CSSProperties
                        }
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "application/x-soundboard-id",
                            sound.id,
                          )
                        }
                        onDragOver={(e) => {
                          if (
                            e.dataTransfer.types.includes(
                              "application/x-soundboard-id",
                            )
                          )
                            e.preventDefault();
                        }}
                        onDrop={(e) => {
                          const id = e.dataTransfer.getData(
                            "application/x-soundboard-id",
                          );
                          if (id) {
                            e.preventDefault();
                            e.stopPropagation();
                            reorder(id, sound.id);
                          }
                        }}
                      >
                        <div className="card-top">
                          <GripVertical size={14} className="drag-handle" />
                          <span>{durationLabel(sound.duration)}</span>
                          <button
                            className={`icon-button star ${sound.favorite ? "selected" : ""}`}
                            aria-label={`Favori : ${sound.name}`}
                            aria-pressed={sound.favorite}
                            onClick={() =>
                              void run(
                                api.updateSound(sound.id, {
                                  favorite: !sound.favorite,
                                }),
                              )
                            }
                          >
                            <Star size={14} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Modifier ${sound.name}`}
                            onClick={() => setEditing(sound)}
                          >
                            <MoreHorizontal size={19} />
                          </button>
                        </div>
                        <button
                          className="pad-trigger"
                          aria-label={`Jouer ${sound.name}`}
                          onClick={() => void run(api.play(sound.id))}
                        >
                          <span className="sound-icon">
                            {active ? (
                              <AudioLines size={35} className="pulse" />
                            ) : (
                              sound.icon || <Play size={30} />
                            )}
                          </span>
                          <strong>{sound.name}</strong>
                          <small>
                            {activeGame
                              ? activeDiscord
                                ? "EN JEU + DISCORD"
                                : "EN JEU"
                              : activeDiscord
                                ? "EN DIFFUSION"
                                : activeLocal
                                  ? "ÉCOUTE LOCALE"
                                  : "CLIQUER POUR JOUER"}
                          </small>
                        </button>
                        <div className="card-footer">
                          <span
                            className={`keycap ${shortcut?.status === "error" ? "error" : ""}`}
                            title={shortcut?.error ?? "Raccourci global"}
                          >
                            {sound.shortcut
                              ? shortcutLabel(sound.shortcut)
                              : "Sans raccourci"}
                          </span>
                          <button
                            className="preview-button"
                            aria-label={`Préécouter ${sound.name}`}
                            title="Préécouter uniquement sur ce PC"
                            onClick={() => void run(api.play(sound.id, true))}
                          >
                            <Headphones size={17} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  <button
                    className="add-pad"
                    disabled={state.importing}
                    onClick={() => void importSounds()}
                  >
                    <Plus size={27} />
                    <span>Ajouter un son</span>
                  </button>
                </div>
              )}
              <div className="library-footnote">
                <GripVertical size={14} />
                Glissez les boutons pour les réorganiser.
                <span>
                  <Headphones size={14} />
                  Le casque lance toujours une préécoute locale.
                </span>
              </div>
            </>
          )}
          {page === "discord" && <DiscordPanel state={state} run={run} />}
          {page === "game" && (
            <GamePanel state={state} run={run} audio={gameAudio} />
          )}
          {page === "settings" && <SettingsPanel state={state} run={run} />}
        </div>
        <footer className="transport">
          <div
            className={`transport-art ${playing.status !== "idle" ? "on" : ""}`}
          >
            <AudioLines size={24} />
          </div>
          <div className="now-playing">
            <small>
              {playing.status === "idle"
                ? "PRÊT À JOUER"
                : playing.status === "loading"
                  ? "CHARGEMENT"
                  : route.game
                    ? config.settings.output === "both"
                      ? "EN JEU + DISCORD"
                      : "EN DIFFUSION DANS LE JEU"
                    : route.discord
                      ? "EN DIFFUSION SUR DISCORD"
                      : "LECTURE LOCALE"}
            </small>
            <strong>{playing.name || "Aucun son en cours"}</strong>
            {!route.local && local.status !== "idle" && (
              <span>Préécoute : {local.name}</span>
            )}
          </div>
          <Volume
            compact
            label="Volume général"
            value={config.settings.masterVolume}
            onChange={(value) => updateSettings({ masterVolume: value })}
          />
          <button
            className="stop-button"
            onClick={() => void run(api.stop())}
            aria-label="STOP — arrêter tous les sons"
          >
            <Square size={16} fill="currentColor" />
            <strong>STOP</strong>
            <kbd>
              {shortcutLabel(config.settings.stopShortcut) || "Tout arrêter"}
            </kbd>
          </button>
        </footer>
      </main>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.level}`}
            role={t.level === "error" ? "alert" : "status"}
          >
            {t.level === "success" ? (
              <Check size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
            <span>{t.message}</span>
            <button
              aria-label="Fermer le message"
              onClick={() =>
                setToasts((current) => current.filter((v) => v.id !== t.id))
              }
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
      {dragOver && (
        <div className="drop-overlay">
          <Upload size={52} />
          <h2>Déposez vos sons ici</h2>
          <p>MP3, WAV ou OGG · Copiés dans votre bibliothèque locale</p>
        </div>
      )}
      {editing && (
        <SoundEditor
          sound={editing}
          state={state}
          close={() => setEditing(null)}
        />
      )}
      {profileModal && (
        <Modal
          title={
            profileModal === "new" ? "Nouveau profil" : "Modifier le profil"
          }
          close={() => setProfileModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await (profileModal === "new"
                ? api.createProfile(profileName)
                : api.renameProfile(profile.id, profileName));
              if (result.ok) setProfileModal(null);
              else notify(result.error);
            }}
          >
            <label className="field">
              Nom du profil
              <input
                autoFocus
                value={profileName}
                maxLength={50}
                required
                onChange={(e) => setProfileName(e.target.value)}
              />
            </label>
            <p className="hint">
              Les raccourcis s’appliquent au profil actif. Un même raccourci
              peut être réutilisé dans un autre profil.
            </p>
            <div className="modal-actions">
              {profileModal === "edit" && config.profiles.length > 1 && (
                <button
                  type="button"
                  className="danger-text"
                  disabled={sounds.length > 0}
                  title={
                    sounds.length ? "Videz ce profil avant de le supprimer" : ""
                  }
                  onClick={async () => {
                    const result = await api.deleteProfile(profile.id);
                    if (result.ok) setProfileModal(null);
                    else notify(result.error);
                  }}
                >
                  Supprimer le profil vide
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setProfileModal(null)}
              >
                Annuler
              </button>
              <button className="primary" type="submit">
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SoundEditor({
  sound,
  state,
  close,
}: {
  sound: Sound;
  state: AppState;
  close: () => void;
}) {
  const [draft, setDraft] = useState({
    name: sound.name,
    color: sound.color,
    icon: sound.icon,
    shortcut: sound.shortcut,
    volume: sound.volume,
    profileId: sound.profileId,
  });
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const colors = [
    "#66e3c4",
    "#9d9bff",
    "#f6bf73",
    "#f68cad",
    "#75bfff",
    "#eb806c",
  ];
  return (
    <Modal title="Personnaliser le son" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const result = await api.updateSound(sound.id, draft);
          setBusy(false);
          if (result.ok) close();
          else setError(result.error);
        }}
      >
        <label className="field">
          Nom
          <input
            autoFocus
            value={draft.name}
            maxLength={80}
            required
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-columns">
          <label className="field">
            Icône ou emoji
            <input
              value={draft.icon}
              maxLength={16}
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            />
          </label>
          <label className="field">
            Profil
            <select
              value={draft.profileId}
              onChange={(e) =>
                setDraft({ ...draft, profileId: e.target.value })
              }
            >
              {state.config.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          Couleur
          <div className="color-picker">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                style={{ background: color }}
                aria-label={`Couleur ${color}`}
                aria-pressed={color === draft.color}
                onClick={() => setDraft({ ...draft, color })}
              >
                {color === draft.color && <Check size={16} />}
              </button>
            ))}
            <input
              type="color"
              aria-label="Couleur personnalisée"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </div>
        </div>
        <ShortcutInput
          value={draft.shortcut}
          onChange={(shortcut) => setDraft({ ...draft, shortcut })}
        />
        <Volume
          label="Volume du son"
          value={draft.volume}
          onChange={(volume) => setDraft({ ...draft, volume })}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {deleting && (
          <div className="delete-confirm">
            <p>
              Retirer « {sound.name} » de la bibliothèque ? Le fichier d’origine
              reste intact.
            </p>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                const result = await api.deleteSound(sound.id);
                if (result.ok) close();
                else setError(result.error);
              }}
            >
              Confirmer la suppression
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="danger-text"
            onClick={() => setDeleting(!deleting)}
          >
            Supprimer
          </button>
          <button type="button" className="secondary" onClick={close}>
            Annuler
          </button>
          <button className="primary" disabled={busy} type="submit">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsPanel({ state, run }: { state: AppState; run: Run }) {
  const settings = state.config.settings;
  const [stopShortcut, setStopShortcut] = useState(settings.stopShortcut);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">À VOTRE FAÇON</p>
          <h1>
            Paramètres<span className="mint">.</span>
          </h1>
          <p>Gardez le contrôle, même en pleine partie.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="section-title">
            <Keyboard size={20} />
            <h2>Raccourcis & lecture</h2>
          </div>
          <Toggle
            checked={settings.shortcutsEnabled}
            label="Raccourcis globaux"
            description="Actifs même lorsque la fenêtre est réduite."
            onChange={(value) =>
              void run(api.updateSettings({ shortcutsEnabled: value }))
            }
          />
          <Toggle
            checked={settings.interrupt}
            label="Remplacer le son en cours"
            description="Le nouveau son interrompt le précédent. Si désactivé, les nouveaux déclenchements sont refusés pendant la lecture."
            onChange={(value) =>
              void run(api.updateSettings({ interrupt: value }))
            }
          />
          <form
            className="stop-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                api.updateSettings({ stopShortcut }),
                "Raccourci STOP enregistré.",
              );
            }}
          >
            <ShortcutInput
              label="Raccourci STOP"
              value={stopShortcut}
              onChange={setStopShortcut}
            />
            <button className="secondary" type="submit">
              Enregistrer le raccourci
            </button>
          </form>
          <p className="hint">
            Les jeux peuvent réserver certaines combinaisons. Essayez Ctrl + Alt
            + un chiffre. Aucun contournement de Vanguard n’est utilisé.
          </p>
        </section>
        <section className="panel">
          <div className="section-title">
            <Settings2 size={20} />
            <h2>Application</h2>
          </div>
          <Toggle
            checked={settings.minimizeToTray}
            label="Rester dans la zone de notification"
            description="Fermer la fenêtre laisse les raccourcis actifs. Pour arrêter l’application, choisissez Quitter dans l’icône près de l’horloge."
            onChange={(value) =>
              void run(api.updateSettings({ minimizeToTray: value }))
            }
          />
          <Toggle
            checked={settings.launchAtLogin}
            disabled={!state.startupAvailable && !settings.launchAtLogin}
            label="Démarrer avec Windows"
            description="À utiliser avec la version installée, conservée au même emplacement."
            onChange={(value) =>
              void run(api.updateSettings({ launchAtLogin: value }))
            }
          />
          <div className="data-info">
            <FolderOpen size={23} />
            <h3>Tout est sur votre ordinateur</h3>
            <p>
              Vos sons sont copiés dans la bibliothèque. Le token est chiffré
              avec le coffre Windows. Aucune télémétrie.
            </p>
            <button
              className="secondary"
              onClick={() => void run(api.openLink("data"))}
            >
              Ouvrir le dossier des données
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="text-link"
            onClick={() => void run(api.openLink("guide"))}
          >
            Lire le guide complet en français
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <section className="panel shortcut-list">
        <div className="section-title">
          <Keyboard size={20} />
          <h2>État des raccourcis du profil actif</h2>
        </div>
        {state.shortcuts.length === 0 && <p>Aucun raccourci configuré.</p>}
        {state.shortcuts.map((s) => (
          <div className="shortcut-row" key={s.soundId}>
            <strong>
              {s.soundId === "stop"
                ? "STOP global"
                : state.config.sounds.find((sound) => sound.id === s.soundId)
                    ?.name}
            </strong>
            <kbd>{shortcutLabel(s.shortcut)}</kbd>
            <span className={s.status === "error" ? "error-text" : ""}>
              {s.status === "registered"
                ? "Enregistré"
                : s.status === "disabled"
                  ? "Suspendu"
                  : s.error}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
