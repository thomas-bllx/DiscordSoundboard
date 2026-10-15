# Architecture et décisions

## Frontières d’exécution

React n’a pas accès à Node, au système de fichiers, au token enregistré ou à un canal IPC arbitraire. Le preload expose `DesktopApi`. Le processus principal vérifie la fenêtre et la frame d’origine, valide les données par Zod et appelle un service spécialisé.

Le bot tourne dans un worker Node au sein de l’application. Un pont requête/réponse corrèle les identifiants, expire les commandes bloquées et transmet des états sérialisables. Les erreurs brutes des bibliothèques ne sont pas diffusées au renderer ni enregistrées. Le token n’est transféré qu’au worker pour l’authentification, après déchiffrement dans le processus principal.

FFmpeg tourne dans un processus enfant avec `windowsHide`, arguments séparés et sans shell. Les imports et les lectures forcent le démultiplexeur correspondant à MP3/WAV/OGG et n’autorisent que les protocoles `file,pipe`. Un fichier audio déguisé en playlist ne peut pas demander un accès HTTP à FFmpeg. L’import utilise des opérations disque asynchrones ; seuls les premiers instants sont décodés pour valider le fichier. La lecture ne charge pas tout le son en mémoire : les streams gèrent la contre-pression.

## Lecture et concurrence

Chaque destination possède son lecteur et son état : `idle`, `loading`, `playing`. Chaque déclenchement reçoit une génération. Les callbacks d’un ancien son sont ignorés après remplacement/STOP. Avant d’arrêter un lecteur Discord, sa génération est invalidée et ses ressources sont détachées ; les événements synchrones `Idle` ne peuvent pas effacer le nouveau son. Le processus FFmpeg est tué et le stream détruit à la fin, lors d’une erreur ou d’un arrêt. Une nouvelle lecture n’est autorisée que si la voix du bot est prête.

Le lecteur local est volontairement séparé : il reste utilisable sans Discord et son bouton casque garde toujours cette destination. Les touches et les clics passent par le même contrôleur principal. Changer de destination interrompt les lecteurs ; une connexion vocale ne change jamais la destination à l’insu de l’utilisateur. Si le pilote virtuel est installé, la préécoute exige un casque explicitement sélectionné pour éviter de suivre une sortie Windows devenue virtuelle.

Les changements de connexion sont également versionnés. Une arrivée tardive d’un login/join ne ressuscite pas une connexion annulée. Une perte de réseau interrompt le lecteur ; les tentatives de reconnexion sont bornées pour la voix et les bibliothèques officielles gèrent la passerelle. Aucun son n’est remis en attente pour une diffusion surprise à la reconnexion.

Le mixeur du micro virtuel utilise Web Audio à 48 kHz, `AudioContext.setSinkId` et un identifiant explicite de sortie VB-CABLE. Un `HTMLAudioElement` décode les sons progressivement, sans charger l’intégralité d’un fichier long ; sa source est reliée au mélange avec le micro. Un compresseur limite les crêtes. Le micro, obtenu avec `deviceId.exact`, dispose d’un gain distinct. Un retour facultatif vers un casque explicite reçoit seulement les sons. Le protocole audio local expose les en-têtes CORS nécessaires au décodage Web Audio.

`GameAudio` ne démarre pas automatiquement au lancement. Les générations de session et de lecture invalident les callbacks tardifs. `devicechange`, fin d’une piste et changement de destination ou de sortie ferment le mixeur au lieu d’utiliser la sortie par défaut. Les configurations qui renvoient le câble dans lui-même, utilisent une entrée « default », ou font de CABLE Input la sortie Windows par défaut sont refusées. Chaque destination accepte un son à la fois.

Les destinations `game` (En jeu) et `micro` (Micro partout) utilisent le même flux VB-CABLE et n’envoient rien au bot. Les applications destinataires sont déterminées par leur choix de microphone : CABLE Output pour recevoir le mélange, microphone physique pour recevoir seulement la voix. La soundboard ne modifie ni les paramètres Discord ni les périphériques Windows par défaut. Choisir Micro partout prépare le mélange avec la voix, sans ouvrir le micro avant activation. Changer de mode ferme la capture, y compris entre les deux modes virtuels. Seule la destination `discord` transmet les sons au bot ; la préécoute reste locale dans tous les modes.

`VirtualDriver` détecte les endpoints Windows par l’API Core Audio documentée, en utilisant leur état réel et le nom de l’adaptateur. Un composant présent mais désactivé est distingué d’un pilote absent : l’interface propose les réglages audio Windows plutôt qu’une nouvelle installation. L’archive Pack45 complète et intacte est incluse dans les ressources. Son hash SHA-256 est fixé dans le code et vérifié avant extraction dans un nouveau dossier de données de l’application. La signature Authenticode de l’installeur est contrôlée avant `Start-Process -Verb RunAs`. Aucune désactivation de signature, installation de certificat de confiance, modification du jeu ou élévation permanente de l’application. La détection du périphérique après installation prime sur le code de sortie ; l’état « redémarrage » ne prétend pas que le périphérique est déjà disponible.

## Persistance

Le magasin utilise un schéma versionné strict. Les modifications concurrentes passent par une file. Chaque écriture conserve l’état précédent, écrit un fichier temporaire, le vide sur disque et le renomme. La mémoire n’est mise à jour qu’après succès. Une corruption déclenche une sauvegarde de l’original et une tentative de reprise depuis `.bak` ; une version future provoque un arrêt explicite, sans écrasement.

La version 1.2.0 utilise le format 3. Les formats 1 et 2 sont migrés après copie exacte du fichier original sous un nom daté. L’ancienne destination `both` devient `game`, avec un avis invitant à choisir Micro partout ; cette migration n’active ni microphone ni flux audio. Les autres destinations, sons et réglages sont conservés. Les anciennes versions de l’application refusent le format 3.

La copie audio reste disponible lors du retrait d’un bouton afin de permettre la récupération de la configuration précédente. Il n’y a pas de purge implicite des données utilisateur. Le coffre du token est indépendant des JSON et ses écritures sont aussi sérialisées. Les tests utilisent un répertoire distinct via `SOUNDBOARD_DATA_DIR`.

## Plateforme cible

Windows x64, versions exactes dans `package-lock.json`. DAVE utilise le binaire N-API du paquet `@snazzah/davey`. Opus utilise `opusscript`, sans compilation C++ locale. FFmpeg 9.0.2 est téléchargé par un script d’installation dont les hashes d’archive et de binaire sont fixés dans `resources/ffmpeg-runtime.json`, puis copié dans les ressources de l’application ; il n’est pas téléchargé à son premier lancement. Depuis la version 1.1.1, ce composant autonome est compilé à partir des sources officielles, sans bibliothèque de codec externe et sans réseau, sous LGPL-2.1-or-later. Ses sources exactes et sa recette sont fournies avec la version publique. Les `.node` et `.wasm` sont décompressés par l’empaqueteur.

Le format portable conserve ses données dans le profil Windows, comme la version installée. Son exécutable s’extrait temporairement : la fonction de démarrage Windows est destinée à la version installée. L’absence de télémétrie et de mise à jour automatique simplifie les échanges réseau ; seuls les accès Discord nécessaires au bot sont réalisés à l’exécution.
