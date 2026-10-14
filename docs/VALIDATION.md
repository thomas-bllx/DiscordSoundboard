# Validation de la version 1.1.0

Les tests n’utilisent aucun compte ou serveur Discord réel. La version portable, l’installeur NSIS et le dossier Windows autonome ont été générés localement.

## Déjà observé le 14 octobre 2026

- Compilation TypeScript strict et Vite réussie.
- **49 tests automatisés réussis** : configuration et reprise, migration depuis la version 1, chiffrement simulé, conflits de raccourcis, lecture locale, séparation jeu/Discord, refus des boucles et sorties par défaut, états de l’installeur, archive altérée, FFmpeg/Opus réels, DAVE natif et intégration Discord simulée. La production de véritables paquets Opus est vérifiée.
- Application Electron réellement lancée sous Windows.
- Mêmes essais réussis sur `release/win-unpacked/Local Discord Soundboard.exe`, en utilisant ses bibliothèques et FFmpeg intégrés.
- Portable final : extraction, démarrage autonome, import WAV par FFmpeg intégré, préécoute (volume zéro), STOP, disponibilité du worker Discord/DAVE, refus de lecture hors salon et fermeture complète du lanceur/application vérifiés avec `scripts/portable-check.mjs`. Ce test adapté au lanceur NSIS complète la suite de l’exécutable décompressé.
- Mode développement Vite/React/IPC vérifié sur `127.0.0.1:5173` avec `scripts/dev-smoke.mjs`.
- Import multiple de WAV, MP3 et OGG synthétiques, renommage et copie persistante.
- Import par événement de dépôt avec un vrai fichier Windows et suppression via l’interface. Le geste Explorer → fenêtre reste distinct de cette simulation de l’événement de dépôt.
- Lecture HTMLAudio de ces trois formats et STOP ; sortie volontairement muette pendant les tests, donc aucune validation auditive humaine.
- Raccourcis Ctrl+Alt+9 et Ctrl+Alt+0 réellement envoyés par Windows, fenêtre réduite, déclenchant lecture et arrêt.
- Refus de deux raccourcis équivalents et des lectures superposées lorsque le remplacement est désactivé.
- Chiffrement réel d’un faux token par `safeStorage`/DPAPI : absence du texte en clair dans le fichier, le JSON et les réponses IPC.
- Redémarrage avec conservation des sons, profils, réglages, présence du token et enregistrement des raccourcis.
- DAVE natif chargé par Electron 44.7.2 / Node 24.21.0 et génération d’un paquet de clés.
- Isolation du renderer, absence de Node.js exposé, aucune exception React observée et fenêtre à 900 × 640 sans débordement horizontal.
- Audit npm des dépendances de production : aucune vulnérabilité signalée lors de l’exécution du 14 octobre 2026. Cet audit ne couvre pas tous les composants natifs externes.

Les rapports JSON et les captures de ces essais sont dans `test-results/`. Ils ne sont pas inclus dans Git.

## Mode jeu : essais observés dans Electron

`scripts/game-smoke.mjs` utilise le vrai décodeur audio, les gains, le compresseur Web Audio, l’IPC et l’interface. Les noms de périphériques sont simulés et la sortie de test est silencieuse. Le micro de test est une source artificielle Chromium, jamais le microphone personnel.

- Signal WAV mesuré en sortie du mixeur, sans lecture locale ou Discord en destination « En jeu ».
- STOP coupe le signal ; la préécoute reste hors du mixeur jeu.
- Mode « Jeu + Discord » refusé avant la lecture si le bot est hors vocal.
- Perte simulée du câble : lecteur arrêté et contexte audio fermé, sans repli vers une autre sortie.
- Micro artificiel mesuré dans le mixeur mais absent du retour casque ; son mesuré dans les deux ; gains micro et sons indépendants.
- Passage à Discord : piste micro arrêtée et accès libéré. Micro refusé au démarrage ; caméra refusée même lorsque l’audio est autorisé.
- Page « En jeu » inspectée à 1280 × 840 et 900 × 640, sans erreur React.
- Détection Windows réelle : aucun pilote VB-CABLE actif sur la machine au moment de l’essai.
- Archive officielle intégrée et signature Authenticode de l’installeur vérifiées. Annulation UAC, absence d’endpoints après sortie réussie, code d’échec et archive modifiée couverts par simulation du processus Windows, sans lancer d’installation.

Ces résultats **ne valident pas encore** l’installation effective avec UAC, le chargement du pilote après redémarrage, la boucle audio Windows réelle ou l’audibilité dans un jeu.

## Nécessite encore votre environnement Discord / jeu

- Authentification d’un vrai bot, liste réelle des serveurs et salons.
- Négociation DAVE/UDP sur un véritable salon vocal et audibilité par un autre participant.
- Déclenchement clic/raccourci pendant une conversation Discord réelle.
- Microphone du compte personnel avec Krisp, confirmé à l’écoute.
- Suivi automatique lors de vrais changements de salon, mute serveur, refus de permissions et interruptions réseau réelles.
- Valorant/Vanguard, plein écran exclusif, clavier et privilèges effectifs de votre session.
- Parcours d’installation/désinstallation NSIS et démarrage automatique avec Windows.
- Première installation VB-CABLE depuis l’application, validation UAC et redémarrage Windows si nécessaire.
- CABLE Output sélectionné dans un vrai jeu, sons reçus par un coéquipier ; Discord conserve le vrai micro et le bot reste silencieux en mode « En jeu ».

Les étapes du test manuel sont détaillées dans le README. La pile Discord, les options DAVE et les scénarios de connexion sont testés avec des simulations ; aucun de ces résultats n’est présenté comme une diffusion réussie sur Discord.
