# Local Discord Soundboard

## ⬇️ [Télécharger l’installeur Windows](https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/Local-Discord-Soundboard-1.1.1-x64-nsis.exe)

**Windows 10 / 11 — 64 bits · Version 1.1.1 · Aucun Node.js, Git ou compilateur à installer.**

1. Cliquez sur le lien ci-dessus et ouvrez le fichier téléchargé.
2. Suivez l’assistant d’installation, puis ouvrez **Local Discord Soundboard**.
3. Importez vos sons MP3, WAV ou OGG. Pour Discord, suivez le [guide de création de votre bot](#créer-le-bot-dans-discord). Pour les jeux, ouvrez **En jeu** dans l’application.

[Notes de version et fichiers de téléchargement](https://github.com/thomas-bllx/DiscordSoundboard/releases/tag/v1.1.1) · [Guide du mode jeu](#diffuser-dans-les-jeux-sans-diffuser-dans-discord)

L’application n’est pas signée avec un certificat commercial : Windows peut afficher une alerte d’éditeur inconnu. Téléchargez-la depuis ce dépôt officiel. **macOS, Linux et Windows ARM ne sont pas pris en charge.**

Une soundboard Windows avec boutons personnalisables, profils, préécoute locale et raccourcis globaux. Les sons destinés à Discord sont transmis par **votre propre bot, exécuté sur votre PC** : votre micro Discord et Krisp restent indépendants. Le mode **En jeu** ajoute une sortie audio virtuelle et un mélange facultatif avec votre voix, activé explicitement depuis l’application.

## Démarrage rapide

Utilisez l’installeur proposé en haut de cette page pour une installation normale. Les exécutables sont publiés dans **Releases** ; les sources, la documentation et les visuels sont dans ce dépôt. Les sons personnels, paramètres et tokens ne sont jamais inclus.

Pour compiler vous-même l’application, suivez la section [Développement et compilation](#développement-et-compilation), puis lancez `npm run dist`.

Après compilation, dans `release/`, utilisez au choix :

- `Local-Discord-Soundboard-1.1.1-x64-portable.exe` : application autonome, composants audio inclus.
- `Local-Discord-Soundboard-1.1.1-x64-nsis.exe` : installeur Windows pour l’utilisateur courant.
- `win-unpacked/Local Discord Soundboard.exe` : application décompressée. Gardez **tout le dossier** `win-unpacked` ensemble.

Les noms ci-dessus correspondent aux cibles configurées ; les validations réellement réalisées sont consignées dans [docs/VALIDATION.md](docs/VALIDATION.md). Les exécutables ne sont pas signés avec un certificat commercial. Windows peut donc signaler un éditeur inconnu.

1. Lancez l’application et restez en **Écoute locale**.
2. Cliquez sur **Importer des sons** et sélectionnez un ou plusieurs MP3, WAV ou OGG. Vous pouvez aussi déposer vos fichiers dans la fenêtre.
3. Cliquez sur un bouton pour le jouer. Le bouton casque déclenche toujours une préécoute locale.
4. Ouvrez les trois points du son pour lui attribuer un nom, une couleur, une icône/emoji, un volume et un raccourci.
5. Réduisez la fenêtre, puis essayez le raccourci. **Ctrl + Alt + 0** arrête toutes les lectures par défaut.
6. Pour diffuser dans Discord, configurez votre bot comme expliqué ci-dessous, rejoignez un salon et choisissez la destination **Discord** dans la bibliothèque.

Le volume général démarre à 70 %. Une seule lecture est autorisée par destination ; le lancement d’un nouveau son remplace normalement le précédent. Une préécoute locale peut fonctionner pendant une diffusion. **STOP arrête tous les sons**, tout en conservant votre voix si le mode jeu est actif. Le bouton **Désactiver le mode jeu** coupe aussi le mélange micro et libère le microphone. Il n’existe aucun repli silencieux vers une autre destination.

## Diffuser dans les jeux, sans diffuser dans Discord

1. Ouvrez **En jeu → Installer le composant audio**. Le pilote officiel **VB-CABLE** est inclus : l’application vérifie son intégrité, l’extrait et lance l’installation. Validez la demande administrateur Windows. Redémarrez si nécessaire puis cliquez sur **Actualiser**. Aucun téléchargement séparé ni compte supplémentaire.
2. Dans cette page, choisissez **CABLE Input (VB-Audio Virtual Cable)** comme sortie vers les jeux. Activez **Ajouter ma voix** et choisissez votre vrai micro si vous souhaitez continuer à parler dans le jeu. Choisissez votre casque pour la préécoute et, facultativement, le retour des sons.
3. Dans les réglages vocaux du jeu, choisissez **CABLE Output (VB-Audio Virtual Cable)** comme microphone. Gardez votre casque comme sortie audio du jeu et de Windows.
4. Dans Discord, sélectionnez **explicitement votre vrai microphone**, pas « Par défaut » ni CABLE Output. Krisp peut rester activé.
5. Cliquez sur **Activer le mode jeu**, puis choisissez la destination **En jeu** dans la bibliothèque. Les boutons et raccourcis envoient les sons dans le jeu ; le bot Discord reste silencieux. **Jeu + Discord** envoie aux deux destinations et nécessite que le bot soit prêt.

Le mode jeu convient aux applications et jeux Windows qui acceptent un périphérique d’entrée audio. Il faut sélectionner ce micro dans chaque jeu ; les réglages du jeu et sa touche « Appuyer pour parler » restent applicables. La soundboard ne simule pas cette touche et n’injecte rien dans le jeu. Une compatibilité avec tous les jeux ou tous les anticheats n’est pas garantie.

L’activation n’est pas restaurée automatiquement au lancement : vos choix de périphériques sont mémorisés, votre micro reste fermé jusqu’à activation. Changer de périphérique, passer à Discord/écoute locale, ou désactiver le mode jeu libère le micro. Un débranchement arrête la diffusion sans choisir un autre appareil. Si le câble devient la sortie Windows par défaut, remettez votre casque comme sortie Windows avant d’activer le mode jeu. Le retour casque contient les sons uniquement, jamais votre propre voix. Le volume général et le volume de chaque son agissent sur les sons ; votre voix possède son propre volume.

**VB-CABLE est un composant tiers de VB-Audio, en donationware ; tous les dons sont les bienvenus.** [Site officiel](https://vb-audio.com/Cable/), [licence et autorisation de distribution](https://vb-audio.com/Services/licensing.htm), [soutenir l’auteur](https://shop.vb-audio.com/en/win-apps/11-vb-cable.html). L’installation du pilote est facultative pour Discord et l’écoute locale. Même en version portable, ce pilote est installé dans Windows. Il n’est pas désinstallé avec la soundboard, car d’autres applications peuvent l’utiliser.

La mise à jour conserve les sons, profils et paramètres, migre la configuration au format 2 et garde une copie du format 1. Ne réutilisez pas l’ancienne version 1.0 avec cette configuration migrée.

## Prérequis

Pour les exécutables distribués : Windows 10 ou 11, architecture x64. Connexion Internet pour Discord uniquement ; l’usage local fonctionne hors ligne après installation. Le bot doit être invité sur un serveur que vous pouvez gérer, ou par une personne disposant des permissions nécessaires.

Pour développer : Node.js **24.17.0 ou plus récent**, npm et Windows x64. Les composants audio et Electron sont téléchargés pendant l’installation des dépendances, puis intégrés aux exécutables. Aucun compilateur C++, VoiceMeeter, OBS, hébergement, abonnement ou compte sur un service supplémentaire n’est nécessaire. Le câble virtuel utile aux jeux est inclus et installé depuis l’application.

## Développement et compilation

Dans le dossier du projet :

```powershell
npm ci
npm run dev
```

`npm ci` installe les versions du fichier de verrouillage et prépare Electron, FFmpeg 9.0.2 et l’archive officielle VB-CABLE Pack45 avec vérification SHA-256. Cette préparation nécessite Internet et **n’installe aucun pilote Windows**. Si un gestionnaire de paquets a bloqué les scripts d’installation, lancez `node scripts/setup.mjs` après avoir installé les paquets. Un proxy d’entreprise peut nécessiter sa configuration habituelle pour npm et PowerShell.

Le serveur Vite de développement écoute **uniquement 127.0.0.1:5173**. Aucun serveur web n’est lancé dans l’application distribuée. Les modifications React sont rechargées à chaud ; les modifications du processus principal, du preload ou du moteur nécessitent de relancer `npm run dev`.

```powershell
npm run check          # TypeScript strict + tests unitaires/intégration simulée
npm run build          # Compilation complète
npm start              # Lancer la version compilée
npm run test:desktop   # Essais Electron Windows, sans compte Discord
node scripts/game-smoke.mjs # Mixeur Web Audio réel, périphériques simulés, sortie silencieuse
npm run pack           # Dossier Windows exécutable
npm run dist           # Version portable + installeur NSIS
```

La génération crée `dist/` et `release/`. FFmpeg et ses notices résident dans `vendor/ffmpeg/`, généré par le script d’installation. Ne supprimez pas les ressources à côté de l’exécutable décompressé. Le script de distribution n’effectue aucune publication et ne configure aucune mise à jour automatique.

Les tests de bureau créent un dossier distinct dans `.test-data/`, utilisent des sons synthétiques et un faux token, et mettent les haut-parleurs du rendu en sourdine. Ils ne se connectent pas à Discord. Ils envoient brièvement **Ctrl+Alt+9** et **Ctrl+Alt+0** par l’API Windows pour vérifier les raccourcis enregistrés. Lancez-les dans une session Windows interactive. Les rapports et captures sont dans `test-results/`.

Pour tester une application empaquetée :

```powershell
$env:SOUNDBOARD_TEST_EXE = (Resolve-Path 'release/win-unpacked/Local Discord Soundboard.exe').Path
node scripts/smoke.mjs
Remove-Item Env:SOUNDBOARD_TEST_EXE
```

Le lanceur portable NSIS utilise un pilote de test distinct : `node scripts/portable-check.mjs`. Ce test ouvre temporairement un port de diagnostic sur la boucle locale et le ferme avec l’application. Le mode développement peut être contrôlé par `node scripts/dev-smoke.mjs`. Aucun port de diagnostic n’est ouvert lors d’un lancement normal.

## Créer le bot dans Discord

1. Ouvrez le [Discord Developer Portal](https://discord.com/developers/applications) avec votre compte Discord habituel.
2. Créez une **New Application** et donnez-lui un nom, par exemple « Mon Soundboard ».
3. Dans **General Information**, copiez l’**Application ID**.
4. Dans **Bot**, créez le bot si nécessaire. Utilisez **Reset Token** pour générer son token et copiez-le directement dans le champ masqué de la soundboard.
5. Ne collez jamais ce token dans un chat, un ticket, une capture ou le code source. En cas de fuite, régénérez-le dans Discord puis remplacez-le dans l’application.
6. Aucun intent privilégié n’est nécessaire. L’application utilise seulement `Guilds` et `GuildVoiceStates`. Laissez **Message Content**, **Server Members** et **Presence** désactivés.
7. L’application utilise un bot de serveur classique, pas une installation utilisateur. Si Discord présente les contextes d’installation, utilisez **Guild Install**. Aucun redirect URI, endpoint d’interactions ou hébergement n’est requis.

Les intitulés du portail peuvent évoluer ; utilisez la [documentation officielle d’autorisation des bots](https://docs.discord.com/developers/topics/oauth2#bot-authorization-flow) si nécessaire.

### Inviter le bot et accorder les permissions

Dans l’application, enregistrez l’Application ID, puis cliquez sur **Inviter le bot**. Le navigateur ouvre un lien officiel Discord comprenant le scope `bot` et les trois permissions suivantes :

| Permission | Pourquoi |
|---|---|
| Voir le salon / View Channel | Lister et accéder au salon choisi |
| Se connecter / Connect | Rejoindre le salon vocal |
| Parler / Speak | Transmettre les sons du bot |

Le masque demandé est `3146752`. **Administrateur n’est pas nécessaire.** Vous pouvez aussi construire le lien avec **OAuth2 → URL Generator**, scope `bot`, et ces permissions.

Il faut disposer des permissions nécessaires pour ajouter une application au serveur (généralement **Gérer le serveur**) ou demander à son administrateur. Les permissions particulières d’un salon peuvent contredire celles du rôle du bot : contrôlez aussi les dérogations de ce salon. Un bot rendu muet par un modérateur ne pourra pas être entendu. Un salon plein peut refuser l’entrée ; l’application ne demande pas de permission supplémentaire pour passer outre.

### Connecter le bot depuis l’application

1. Ouvrez **Connexion Discord**.
2. Saisissez le token et l’Application ID, puis **Enregistrer**. La zone du token se vide après enregistrement ; l’indication « Enregistré et chiffré » confirme sa présence.
3. Cliquez sur **Connecter**. Le nom du bot et les serveurs accessibles apparaissent.
4. Choisissez un serveur et un salon vocal classique. Le bouton d’actualisation recharge les salons et leurs permissions.
5. Cliquez sur **Rejoindre le salon**. Attendez l’indication de connexion.
6. Revenez à la bibliothèque et sélectionnez la destination **Discord**. Un clic ou un raccourci envoie alors le son au bot.

La connexion au bot est volontaire à chaque démarrage ; enregistrer un token ne connecte pas automatiquement le compte. Les listes de serveurs et salons ne sont obtenues que par l’API officielle du bot.

### DAVE et microphone

Discord exige DAVE pour les appels vocaux chiffrés. La pile fixée dans ce projet comprend **discord.js 14.27.0**, **@discordjs/voice 0.19.2** et **@snazzah/davey 0.1.12**. Les connexions sont créées explicitement avec `daveEncryption: true`. Le binaire natif Windows de DAVE est inclus et extrait du paquet Electron pour être chargé correctement.

La préécoute passe par la sortie audio Windows habituelle. La diffusion passe par un processus de décodage FFmpeg → PCM 48 kHz stéréo → réglage du volume → Opus → connexion vocale du bot. Tout le moteur Discord et l’encodage Opus s’exécutent dans un worker séparé de l’interface et du processus principal.

Le bot se connecte avec `selfDeaf: true` et `selfMute: false`. Il n’enregistre ni n’analyse la voix des participants. L’accès au microphone est refusé par défaut. Seule l’interface locale peut obtenir un accès audio lors de la détection des appareils ou de l’activation du mode jeu ; la caméra et la capture d’écran restent refusées. Votre compte Discord et son réglage Krisp restent indépendants.

La présence du module DAVE et la génération d’un paquet de clés peuvent être testées localement. **Cela ne valide pas la négociation avec un vrai serveur vocal** : voir les essais manuels ci-dessous. Références : [documentation @discordjs/voice](https://discord.js.org/docs/packages/voice/0.19.2), [annonce officielle DAVE](https://discord.com/blog/bringing-dave-to-all-discord-platforms).

### Suivre automatiquement votre salon

Fonction facultative, désactivée par défaut :

1. Dans Discord, activez le **Mode développeur** dans les paramètres avancés, puis copiez votre identifiant utilisateur avec le menu contextuel de votre profil.
2. Renseignez cet identifiant dans la soundboard, puis enregistrez.
3. Activez **Suivre mon salon vocal**. Le bot utilise les événements officiels de changement de salon sur les serveurs communs.

Le bot rejoint votre salon accessible et le quitte lorsque vous quittez la voix. Il n’a pas accès aux serveurs où il n’est pas invité. Le suivi ne fonctionne pas pour les appels privés, les groupes privés ou les scènes. Désactivez-le avant de faire rester le bot dans un autre salon manuellement. Aucun état de votre client personnel n’est lu.

## Bibliothèque et raccourcis

Les fichiers sont copiés dans la bibliothèque locale à l’importation : déplacer l’original n’interrompt pas la lecture. L’analyse valide le début du flux ; un fichier tronqué plus loin peut encore échouer pendant la lecture. Les importations multiples traitent les fichiers indépendamment et signalent les fichiers refusés. Aucune limite artificielle de durée ou de nombre de sons ; les limites pratiques sont la place disque et les ressources du PC.

Les trois points d’un bouton permettent de modifier son nom, sa couleur, son emoji/icône, son volume, son profil et son raccourci. Le volume transmis est le produit du **volume du son × volume général** ; il n’y a pas d’amplification au-delà de 100 %. Le volume individuel du bot dans le client Discord des auditeurs s’ajoute à ces réglages.

- Glissez un bouton sur un autre pour le déplacer.
- L’étoile marque un favori ; le filtre étoile et la recherche s’appliquent au profil courant.
- Le **+** à côté de Profils crée un nouveau profil. Le menu près du nom du profil permet de le renommer et de supprimer un profil vide.
- Les raccourcis sont actifs **dans le profil sélectionné**, même si vous êtes sur l’écran Paramètres. Ils peuvent être réutilisés entre profils, mais pas deux fois dans le même profil ni en conflit avec STOP.
- Saisissez `Control+Alt+1`, par exemple, ou utilisez le bouton clavier pour capturer une combinaison. La capture suspend temporairement les raccourcis de la soundboard ; Échap annule.
- Un voyant/avertissement indique si Windows refuse l’enregistrement, notamment lorsqu’une autre application possède déjà la combinaison.
- **Raccourcis actifs** en haut de la fenêtre permet de les suspendre. Ce réglage persiste au redémarrage. STOP reste toujours disponible au clic et dans le menu de la zone de notification, même si son raccourci est suspendu.
- Dans Paramètres, désactivez **Remplacer le son en cours** pour refuser les nouveaux déclenchements pendant une lecture. Il n’y a pas de file d’attente dans cette version.

Les touches Windows et plusieurs combinaisons réservées sont refusées. Pour les caractères ordinaires, deux modificateurs sont requis afin d’éviter les déclenchements accidentels. Les touches de fonction sont acceptées, à l’exception de F12, réservée au débogage Windows. Préférez **Ctrl+Alt+chiffre** ; AltGr est ambigu sur certaines dispositions de clavier.

Fermer la fenêtre la masque par défaut dans la zone de notification. Les raccourcis continuent de fonctionner. Un double-clic sur l’icône restaure la fenêtre ; son menu permet **STOP** et **Quitter**. Si vous désactivez cette option, la fermeture quitte réellement l’application et nettoie les connexions. Le démarrage avec Windows est optionnel ; utilisez-le avec la version installée, dont le chemin ne change pas.

## Données locales et sécurité

Dossier par défaut : `%APPDATA%\Local Discord Soundboard`. **Paramètres → Ouvrir le dossier des données** donne le chemin effectivement utilisé.

- `config.json` : sons, profils et réglages, validés avec un schéma strict. Aucun token.
- `config.json.bak` : configuration précédente. Les écritures sont sérialisées, vidées sur disque et remplacées atomiquement.
- `library/` : copies audio nommées avec des identifiants, sans utiliser les noms saisis comme chemins.
- `bot-token.bin` : token chiffré par Electron `safeStorage`/DPAPI Windows. Le programme refuse tout stockage de token si le coffre sécurisé n’est pas disponible.

La suppression d’un bouton retire son entrée et son raccourci ; sa copie audio reste sur disque afin que la configuration de secours reste exploitable. Le fichier source n’est jamais modifié. Pour libérer cet espace, fermez l’application, sauvegardez le dossier, puis retirez uniquement les fichiers qui ne figurent plus dans `config.json` **ni** `config.json.bak`. Le nettoyage automatique et l’export/import de profils sont reportés.

Le chiffrement Windows protège les données contre les autres comptes Windows, pas contre un logiciel malveillant exécuté sous votre propre compte. Une copie du token chiffré sur un autre ordinateur n’est pas une méthode de transfert : renseignez le token à nouveau. **Oublier le token** déconnecte le bot et supprime le secret local.

Si la configuration est corrompue, l’original est conservé sous un nom daté, puis la sauvegarde est restaurée. Une configuration d’une version non prise en charge n’est pas écrasée. Vous pouvez sauvegarder tout le dossier lorsque l’application est fermée.

Electron utilise un renderer sandboxé, `contextIsolation`, sans Node.js accessible à React. Le preload expose des actions précises ; chaque argument est validé et chaque requête vérifie son expéditeur et son origine. Les fichiers audio sont servis par un protocole local borné à la bibliothèque. Les liens ouverts sont limités au portail, à l’invitation officielle et aux documents locaux. Le moteur ne journalise ni tokens ni erreurs HTTP brutes.

Pour des essais isolés, `SOUNDBOARD_DATA_DIR` peut désigner un chemin absolu différent. Cette variable est utilisée par les tests ; son absence rétablit le dossier Windows normal.

## Tester une véritable diffusion Discord

À réaliser avec votre bot et un serveur autorisé :

1. Rejoignez un salon avec votre compte personnel, conservez Krisp activé et choisissez votre microphone habituel.
2. Connectez le bot depuis la soundboard, puis faites-le rejoindre le même salon.
3. Réglez d’abord le volume général bas. Sélectionnez **Discord**, cliquez sur un son et faites confirmer son audibilité par un autre participant.
4. Vérifiez que c’est le bot qui indique une activité vocale. Parlez simultanément : votre propre micro doit toujours fonctionner.
5. Réduisez la soundboard, utilisez son raccourci, puis le raccourci STOP.
6. Testez deux sons lancés rapidement, le mode sans remplacement et les deux réglages de volume.
7. Quittez le salon avec le bot, puis tentez une lecture : un message doit demander de rejoindre un salon, sans son diffusé ailleurs.
8. Testez une interruption du réseau et une expulsion du bot. Une reconnexion peut rétablir la session ; après échec, rejoignez de nouveau le salon. Une lecture interrompue ne reprend pas spontanément.
9. Si souhaité, activez le suivi et changez de salon, puis quittez la voix. Vérifiez aussi un salon dont les permissions sont insuffisantes.
10. Testez ensuite Valorant en plein écran et en mode fenêtré sans bordures, avec le même raccourci et le STOP.

Les événements d’interface, les simulations et les essais de codecs ne prouvent pas qu’un autre participant reçoit du son. Ce critère exige un essai réel. La liste des validations déjà effectuées est dans [docs/VALIDATION.md](docs/VALIDATION.md).

## Limites et dépannage

| Symptôme | Vérification |
|---|---|
| Token refusé | Utiliser le token **du bot**, sans préfixe `Bot`, et non le Client Secret/Application ID. Régénérer un token révoqué. |
| Aucun serveur | Inviter le bot sur le serveur avec les permissions nécessaires. |
| Salon grisé ou inaccessible | Vérifier Voir le salon, Se connecter, Parler et les dérogations du salon. Seuls les salons vocaux classiques sont listés. |
| Connexion vocale impossible | Vérifier Internet, pare-feu/VPN et les communications UDP de Discord. Ne pas désactiver les protections globales du PC. |
| Bot présent mais muet | Choisir la destination Discord ; vérifier les volumes, le mute serveur, la sourdine du participant et la permission Parler. |
| Préécoute impossible | Vérifier le fichier ; certains WAV utilisant des codecs inhabituels ne sont pas décodés par Chromium. Réexporter en WAV PCM, MP3 ou OGG Vorbis. |
| Raccourci refusé | Choisir une autre combinaison et contrôler la liste dans Paramètres. |
| Raccourci inactif dans un jeu | Le jeu peut réserver la combinaison, gérer le plein écran exclusif différemment ou fonctionner avec d’autres privilèges. Essayer une autre combinaison ou le mode fenêtré sans bordures. |
| L’application reste active après fermeture | Comportement de la zone de notification ; choisir Quitter pour l’arrêter. |

**Valorant/Vanguard :** utilisation exclusive d’Electron `globalShortcut` et des mécanismes Windows normaux. Aucune injection, aucun hook de jeu, aucun contournement d’anti-cheat. Le fonctionnement dans tous les jeux n’est pas garanti ; la validation dans Valorant doit être réalisée séparément des tests Windows de bureau.

Version actuelle : un flux Discord, une préécoute locale, pas de mixage, boucle, normalisation, lecture aléatoire, historique, image de bouton importée ou export/import de profils. Les boutons acceptent des icônes/emoji. Les groupes et appels privés Discord, les scènes, Linux, macOS et ARM ne font pas partie de cette distribution. Le worker audio constitue le point d’extension pour un futur mixeur.

## Architecture

```text
src/renderer/     React, bibliothèque, configuration et préécoute HTMLAudio
src/preload/      API IPC limitée et récupération des fichiers déposés
src/main/         Fenêtre, coffre du token, imports, stockage, raccourcis
src/engine/       Worker Discord, connexions vocales et lecteur FFmpeg/Opus
src/shared/       Schémas, contrats IPC, modèles et validation des raccourcis
tests/           Configuration, sécurité, codecs, lecture, Discord simulé
scripts/         Développement, compilation, composants, licences, essais bureau
docs/            Architecture détaillée, état des validations et licences
```

## Licences

Le code de l’application est sous [licence MIT](LICENSE). Les composants tiers conservent leurs propres licences. L’application utilise un exécutable FFmpeg 9.0.2 sous **LGPL-2.1-or-later**, compilé sans modification des sources et sans codec externe. Ses [sources correspondantes et sa recette de compilation](https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/ffmpeg-9.0.2-soundboard-sources.zip) sont disponibles avec les téléchargements. Les avis des bibliothèques sont regroupés par `npm run licenses` et intégrés dans `resources/licenses` de l’application empaquetée. Consultez [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) et [docs/FFMPEG-BUILD.md](docs/FFMPEG-BUILD.md).
