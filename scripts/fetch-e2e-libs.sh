#!/usr/bin/env bash
# Deja las librerías del sistema que Chromium necesita en ~/.local/share/pwlibs,
# para poder lanzar los tests e2e sin sudo y sin instalar nada en el sistema.
#
# Es idempotente: si ya están descargadas, no vuelve a hacerlo.
set -euo pipefail

DEST="${PWLIBS:-$HOME/.local/share/pwlibs}"
LIB_SUBDIR="usr/lib/x86_64-linux-gnu"

# En Debian y Ubuntu los paquetes no se llaman igual: Noble renombró libasound2
# a libasound2t64 por el cambio de versión del soname.
asound_pkg() {
  if apt-cache show libasound2t64 > /dev/null 2>&1; then
    echo libasound2t64
  else
    echo libasound2
  fi
}

if [[ -f "$DEST/$LIB_SUBDIR/libnspr4.so" ]]; then
  echo "Ya están en $DEST. No hay nada que hacer."
  exit 0
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

echo "Descargando libnspr4, libnss3 y $(asound_pkg)..."
(
  cd "$workdir"
  apt-get download libnspr4 libnss3 "$(asound_pkg)"
)

for deb in "$workdir"/*.deb; do
  dpkg-deb -x "$deb" "$DEST"
done

if [[ ! -f "$DEST/$LIB_SUBDIR/libnspr4.so" ]]; then
  echo "Error: no se ha encontrado libnspr4.so en $DEST/$LIB_SUBDIR" >&2
  exit 1
fi

echo "Listo en $DEST ($(du -sh "$DEST" | cut -f1))."
echo "A partir de ahora, 'npm run test:e2e' las encuentra solo."
