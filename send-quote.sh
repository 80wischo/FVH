#!/bin/bash
# Hol Trainingstage vom Server
RESP=$(curl -s http://localhost:3000/api/settings/trainingdays)
DAYS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(d.get('days',[])))" 2>/dev/null)

# Prüfe ob heute ein Trainingstag ist
TODAY=$(date +%u) # 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa, 7=So
TODAY_DE=""
case $TODAY in
  1) TODAY_DE="Mo" ;; 2) TODAY_DE="Di" ;; 3) TODAY_DE="Mi" ;;
  4) TODAY_DE="Do" ;; 5) TODAY_DE="Fr" ;; 6) TODAY_DE="Sa" ;; 7) TODAY_DE="So" ;;
esac

if echo "$DAYS" | grep -q "$TODAY_DE"; then
  curl -s -X POST http://localhost:3000/api/bot/quote \
    -H 'Content-Type: application/json' \
    -d '{}' > /dev/null 2>&1
fi
