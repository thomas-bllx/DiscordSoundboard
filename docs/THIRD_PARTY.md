# Composants et licences

Le code de cette application est MIT. Les licences des composants restent applicables indépendamment.

| Composant | Version fixée | Licence déclarée / source |
|---|---|---|
| Electron | 44.7.2 | MIT, Chromium et Node avec leurs notices incluses |
| React / React DOM | 19.3.0 | MIT |
| Lucide | 1.56.0 | ISC |
| discord.js | 14.27.0 | Apache-2.0 |
| @discordjs/voice | 0.19.2 | Apache-2.0 |
| @snazzah/davey | 0.1.12 | MIT, bibliothèques Rust/OpenMLS selon leurs licences |
| opusscript | 0.1.1 | MIT pour l’enveloppe ; notices Opus/Emscripten dans le paquet |
| Zod | 4.6.7 | MIT |
| FFmpeg audio Windows | 9.0.2 | LGPL-2.1-or-later, sources officielles non modifiées, programme séparé |
| VB-CABLE standard | Driver Pack45, octobre 2024 | Donationware, VB-Audio Software |

La liste automatisée et les textes trouvés dans les paquets sont produits dans `resources/licenses/` par `npm run licenses`. Le dossier est livré à côté des ressources de l’exécutable. Les composants embarqués dans le rendu React sont aussi inclus dans ce relevé. Le paquet Electron distribue également `LICENSE` et `LICENSES.chromium.html`.

## VB-CABLE

Le paquet standard intact est inclus, sans les produits payants A+B ou C+D. L’intégration se fonde sur l’autorisation publiée dans la section **VB-CABLE Distribution with other product** de la [page de licence de l’auteur](https://vb-audio.com/Services/licensing.htm), consultée le 14 octobre 2026. L’interface identifie VB-Audio, explique le modèle donationware et donne accès au site, à la licence et aux dons. Le `readme.txt` original reste dans l’archive et dans les notices livrées. La notice historique demande l’accord de l’auteur pour intégrer l’installation ; la page actuelle publie cet accord sous les conditions mentionnées.

- Origine : [VB-CABLE / VB-Audio](https://vb-audio.com/Cable/).
- **VB-CABLE est un donationware, tous les dons sont les bienvenus.** [Soutenir l’auteur](https://shop.vb-audio.com/en/win-apps/11-vb-cable.html).
- Archive : `https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip`.
- SHA-256 fixé après téléchargement HTTPS officiel : `b950e39f01af1d04ea623c8f6d8eb9b6ea5c477c637295fabf20631c85116bfb`.
- Signature de l’installeur observée valide : **BUREL VINCENT Entrepreneur individuel** ; vérification refaite à l’exécution.
- L’installeur de l’application ne modifie pas les règles de signature des pilotes et ne désinstalle pas un câble partagé lors du retrait de l’application.

## FFmpeg

- Sources originales : [FFmpeg 9.0.2](https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz), SHA-256 `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e`.
- [Sources correspondantes et recette de compilation](https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/ffmpeg-9.0.2-soundboard-sources.zip), publiées à côté de l’installeur.
- [Binaire autonome et notices](https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/ffmpeg-9.0.2-soundboard-win64.zip). Les empreintes exactes sont dans `resources/ffmpeg-runtime.json`.
- [Instructions de reconstruction](FFMPEG-BUILD.md) et script `scripts/build-ffmpeg.sh`.
- La licence complète, le README de compilation et le manifeste avec le hash du binaire sont dans `vendor/ffmpeg/` (développement) et `resources/ffmpeg/` (application empaquetée).

Le programme FFmpeg est exécuté séparément par l’application. Les sources sont intactes ; la recette désactive GPL, nonfree, les composants externes et le réseau. Le décodage MP3/WAV/OGG, la conversion audio et les sorties PCM/null sont inclus. Il n’y a aucune bibliothèque de codec tierce à lier ou à installer. Voir les [informations de licence officielles de FFmpeg](https://ffmpeg.org/legal.html).

**Redistribution publique :** conserver les licences et l’accès aux sources correspondantes avec les exécutables. La version 1.1.1 fournit effectivement l’archive source originale et la recette de compilation, sans faire dépendre l’utilisateur d’une demande par courrier. Les anciennes compilations locales utilisant FFmpeg Gyan GPLv3 ne font pas partie de cette publication.
