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
| FFmpeg Windows essentials | 9.0.2 | GPLv3, distribution Gyan, programme séparé |
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

- Distributeur référencé par le [site officiel FFmpeg](https://ffmpeg.org/download.html) : [Gyan Windows Builds](https://www.gyan.dev/ffmpeg/builds/).
- Archive fixée : [FFmpeg 9.0.2 essentials x64](https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip).
- [Empreinte publiée](https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip.sha256) : `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`.
- [Sources FFmpeg correspondant à cette compilation](https://github.com/FFmpeg/FFmpeg/commit/946fcce07b).
- La licence complète, le README de compilation et le manifeste avec le hash du binaire sont dans `vendor/ffmpeg/` (développement) et `resources/ffmpeg/` (application empaquetée).

Le programme FFmpeg n’est pas modifié et est exécuté séparément par l’application. Aucun composant n’est configuré avec `--enable-nonfree` par ce projet. Le README du distributeur recense les bibliothèques de sa compilation. Voir aussi les [informations de licence officielles de FFmpeg](https://ffmpeg.org/legal.html).

**Redistribution publique :** livrer les notices seules ne remplace pas les obligations de mise à disposition des sources correspondantes. Avant de republier l’installeur ou le portable, fournir les sources correspondant au binaire FFmpeg et à ses bibliothèques liées, avec leurs licences et instructions de compilation, selon les licences applicables. Les liens et le manifeste servent à identifier ces composants ; ils ne constituent pas une offre écrite de sources. Aucune publication ou redistribution publique n’a été effectuée par les scripts de ce projet.
