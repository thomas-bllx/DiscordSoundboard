#!/usr/bin/env bash
# Rebuild the standalone audio decoder shipped in the Windows application.
# Run from MSYS2 with an x86_64 LLVM-MinGW toolchain and GNU make on PATH.
set -euo pipefail

source_dir=${1:?Usage: bash scripts/build-ffmpeg.sh path/to/ffmpeg-9.0.2}
cd "$source_dir"
test "$(cat RELEASE | tr -d '\r\n')" = 9.0.2

./configure \
  --target-os=mingw32 --arch=x86_64 \
  --cc=clang --cxx=clang++ --ar=llvm-ar --ranlib=llvm-ranlib \
  --nm=llvm-nm --strip=llvm-strip \
  --prefix=./install --disable-debug --disable-doc --disable-x86asm \
  --disable-autodetect --disable-network --disable-shared --enable-static \
  --disable-gpl --disable-nonfree --disable-version3 \
  --disable-everything --disable-avdevice --disable-swscale \
  --disable-ffplay --disable-ffprobe --enable-ffmpeg \
  --enable-protocol=file,pipe \
  --enable-demuxer=mp3,wav,ogg \
  '--enable-decoder=mp1*,mp2*,mp3*,pcm*,adpcm*,vorbis,opus,flac,speex,aac,ac3,eac3,gsm,gsm_ms,wmav1,wmav2,wmavoice,alac,ilbc,g723_1,g729,dfpwm' \
  --enable-parser=mpegaudio,vorbis,opus,flac,aac,ac3,gsm \
  --enable-encoder=pcm_s16le --enable-muxer=pcm_s16le,null \
  --enable-filter=aformat,anull,aresample \
  --extra-ldflags=-static

make -j"${JOBS:-8}" ffmpeg.exe
llvm-strip ffmpeg.exe
./ffmpeg.exe -version
./ffmpeg.exe -L
