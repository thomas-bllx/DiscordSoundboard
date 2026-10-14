# Composant audio FFmpeg 9.0.2

La version publique 1.1.1 utilise un exécutable FFmpeg autonome compilé à partir des sources officielles non modifiées. Il est sous LGPL-2.1-or-later, sans option GPL/nonfree et sans bibliothèque de codec externe. L'application le lance comme programme séparé ; son remplacement n'est pas interdit.

- Sources originales : https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
- SHA-256 : `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e`
- Sources correspondantes et recette : https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/ffmpeg-9.0.2-soundboard-sources.zip
- Binaire et notices : https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1/ffmpeg-9.0.2-soundboard-win64.zip
- Empreintes des paquets et du binaire : `resources/ffmpeg-runtime.json`.

## Recompiler

Sur Windows x64, utiliser un shell MSYS2 avec GNU make et une chaîne LLVM-MinGW x86_64 sur `PATH`. La compilation distribuée a été réalisée avec Clang/LLVM 14.0.6 et GNU make 4.4.1. Aucun codec tiers n'est nécessaire. Les bibliothèques FFmpeg sont liées dans l'exécutable ; les DLL Windows système restent fournies par Windows.

1. Télécharger l'archive originale ci-dessus et contrôler son SHA-256.
2. La décompresser dans `vendor/ffmpeg-source/` : elle crée `ffmpeg-9.0.2/`.
3. Depuis la racine du projet, dans MSYS2, exécuter :

```sh
bash scripts/build-ffmpeg.sh vendor/ffmpeg-source/ffmpeg-9.0.2
```

L'exécutable obtenu est `vendor/ffmpeg-source/ffmpeg-9.0.2/ffmpeg.exe`. Le script contient la configuration complète. Il désactive les composants externes, le réseau, les symboles de débogage et les options GPL/nonfree. Il active les conteneurs MP3/WAV/OGG, les décodeurs audio utilisés, la conversion audio et les sorties PCM/null. Ce composant sert au décodage ; ce n'est pas une distribution FFmpeg vidéo ou un encodeur MP3 universel.

Pour fabriquer les archives de redistribution, lancer depuis PowerShell :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-ffmpeg.ps1
```

Ce script produit les deux archives dans `release/` et actualise leurs empreintes dans `resources/ffmpeg-runtime.json`. L'archive des sources contient l'archive officielle intacte, cette documentation et le script de compilation. Aucun patch n'est appliqué aux sources FFmpeg. Les numéros de version des outils et la recette servent à reconstruire le composant ; une identité bit à bit entre différentes chaînes de compilation n'est pas promise.

Les fichiers `COPYING.LGPLv2.1`, `LICENSE.md` et les avis propres aux fichiers restent dans les sources originales. La licence LGPL est aussi fournie dans le paquet binaire et dans l'application. Les versions précédentes construites localement utilisaient FFmpeg Gyan GPLv3 ; elles ne sont pas publiées dans cette version.
