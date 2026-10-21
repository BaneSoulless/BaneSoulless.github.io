#!/usr/bin/env bash
# Relaunch sito pubblico: origine HTTP + tunnel (cloudflared default, fallback Pinggy).
# Uso manuale (Git Bash): bash C:/Users/Fabrizio/workspace/public-site/restart-site.sh
#   TUNNEL_BACKEND=pinggy bash C:/Users/Fabrizio/workspace/public-site/restart-site.sh  (forza Pinggy)
# NOTA Pinggy free: un secondo tunnel dalla stessa IP killa il primo; l'URL cambia ad ogni
#   restart e i BROWSER vedono l'interstitial "Caution" (curl/API no; bypass solo via header
#   X-Pinggy-No-Screen o User-Agent custom, cosa che un sito statico NON puo' imporre).
#   Per questo il backend di default e' cloudflared quick tunnel (trycloudflare.com):
#   nessun interstitial, nessun signup, URL gratuito che cambia ad ogni restart.
set -euo pipefail

DIR="C:/Users/Fabrizio/workspace/public-site"
PORT=8777
BIN="$DIR/bin/cloudflared.exe"
BACKEND="${TUNNEL_BACKEND:-cloudflared}"
LOGS="$DIR/logs"
mkdir -p "$LOGS"
touch "${LOGS}/origin-8777.log"  # il log deve esistere anche se l'origine era gia' attiva

# 1. Termina tunnel precedenti (match precisi, niente kill generico)
pkill -f "ssh -p 443 .*free@a\\.pinggy\\.io" 2>/dev/null || true
powershell -NoProfile -File "C:/Users/Fabrizio/workspace/public-site/kill-old-tunnels.ps1" 2>/dev/null || true
sleep 1

# 2. Origine: avvia solo se non risponde gia'
if ! curl -sI "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  nohup python "${DIR}/server.py" "${PORT}" > "${LOGS}/origin-8777.log" 2>&1 &
  sleep 1
fi

# 3. Avvia il tunnel del backend scelto
URL=""
if [ "${BACKEND}" = "cloudflared" ]; then
  if [ -x "${BIN}" ]; then
    LOG_CF="${LOGS}/cloudflared-${PORT}.log"
    nohup "${BIN}" tunnel --url "http://localhost:${PORT}" > "${LOG_CF}" 2>&1 &
    # attende fino a 25s l'URL trycloudflare nel log
    for _ in $(seq 1 25); do
      URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${LOG_CF}" 2>/dev/null | head -1 || true)
      if [ -n "${URL}" ]; then break; fi
      sleep 1
    done
  fi
  if [ -z "${URL}" ]; then
    echo "AVVISO: cloudflared non disponibile o URL non ottenuto, fallback a Pinggy" >&2
    BACKEND="pinggy"
  fi
fi

# 4. Fallback Pinggy (con eventuale TUNNEL_BACKEND=pinggy esplicito)
if [ "${BACKEND}" = "pinggy" ] && [ -z "${URL}" ]; then
  LOG_PG="${LOGS}/pinggy-${PORT}.log"
  nohup ssh -p 443 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -R0:localhost:${PORT} free@a.pinggy.io > "${LOG_PG}" 2>&1 &
  for _ in $(seq 1 25); do
    URL=$(grep -oE 'https://[a-z0-9.-]+\.(pinggy\.link|pinggy\.net|pinggy\.io)' "${LOG_PG}" 2>/dev/null | head -1 || true)
    if [ -n "${URL}" ]; then break; fi
    sleep 1
  done
fi

if [ -z "${URL}" ]; then
  echo "ERRORE: URL tunnel non trovato (backend=${BACKEND})." >&2
  exit 1
fi
echo "Backend: ${BACKEND}"
echo "Sito pubblico: ${URL}"

# 5. Persisti URL attivo + riallinea canonical/og:url/JSON-LD/sitemap alle 6 pagine (no rebuild completo).
#    Senza questo passo ad ogni restart l'URL cambia e i metadati SEO restano stale.
python "${DIR}/update_canonical.py" "${URL}" "${BACKEND}"
echo "current-url.json aggiornato + canonical riallineati."
