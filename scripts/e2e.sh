#!/usr/bin/env bash
# Lanza los tests e2e, resolviendo las librerías del sistema que Chromium necesita
# y este proyecto no usa: libnspr4, libnss3 y libasound2t64.
#
# Si ya están instaladas en el sistema, este script no hace nada especial y
# `npm run test:e2e` funciona por su cuenta. Solo interviene cuando Chromium
# arranca con «error while loading shared libraries».
#
# Ver docs/DEPLOYMENT.md para instalar las de forma permanente con sudo.
set -euo pipefail

LIBS_DIR="${PWLIBS:-$HOME/.local/share/pwlibs}/usr/lib/x86_64-linux-gnu"

if [[ -d "$LIBS_DIR" ]] && compgen -G "$LIBS_DIR/libnspr4.so" > /dev/null; then
  export LD_LIBRARY_PATH="$LIBS_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec npx playwright test "$@"
