# Docker Timezone Konfiguration

## ⏰ Wie Timezones in Docker funktionieren

Der Phylax Syslog Service benötigt Zugriff auf die korrekte lokale Zeit. Es gibt mehrere Wege, die Zeitzone im Container zu setzen:

## 1️⃣ Option 1: TZ Umgebungsvariable (Einfachste Methode ⭐ EMPFOHLEN)

Die **einfachste und portabelste** Methode ist das Setzen der `TZ` Umgebungsvariable in der docker-compose.yml.

### Dockerfile (bereits vorbereitet)
```dockerfile
# Der base image hat tzdata bereits installiert
RUN apk add --no-cache dumb-init tzdata
```

### docker-compose.yml
```yaml
services:
  syslog:
    environment:
      - TZ=Europe/Berlin  # ← Timezone hier setzen
```

### Vorteile:
✅ Einfach konfigurierbar  
✅ Funktioniert auf allen Docker-Umgebungen  
✅ Keine Host-Abhängigkeit  
✅ Direkt im docker-compose.yml dokumentiert  

### Supported Timezones:
```
Europe/Berlin        # UTC+1 (Winter) / UTC+2 (Sommer)
Europe/London        # UTC+0 (Winter) / UTC+1 (Sommer)
Europe/Amsterdam     # UTC+1 (Winter) / UTC+2 (Sommer)
America/New_York     # UTC-5 (Winter) / UTC-4 (Sommer)
America/Chicago      # UTC-6 (Winter) / UTC-5 (Sommer)
America/Denver       # UTC-7 (Winter) / UTC-6 (Sommer)
America/Los_Angeles  # UTC-8 (Winter) / UTC-7 (Sommer)
Asia/Singapore       # UTC+8 (ganzjährig)
Asia/Tokyo           # UTC+9 (ganzjährig)
Australia/Sydney     # UTC+10 (Winter) / UTC+11 (Sommer)
UTC                  # UTC (keine Anpassung)
```

Vollständige Liste: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

## 2️⃣ Option 2: Host-Timezone erben (Linux/Mac)

Wenn der Container auf einem Linux/Mac Host läuft, kann man die Timezone-Dateien vom Host mounten.

### docker-compose.yml
```yaml
services:
  syslog:
    volumes:
      - /etc/timezone:/etc/timezone:ro      # Read-only mount
      - /etc/localtime:/etc/localtime:ro    # Read-only mount
    environment:
      # TZ ist optional wenn /etc/localtime gemountet ist
      # aber es ist trotzdem empfohlen, um sicherzustellen
      - TZ=Europe/Berlin
```

### Vorteile:
✅ Verwendet automatisch die Host-Timezone  
✅ Funktioniert auch ohne TZ Variable  

### Nachteile:
❌ Funktioniert nicht auf Windows Docker Desktop (nur Linux-Container)  
❌ Host-Abhängigkeit (kann zu Problemen führen)  
❌ Komplexer zu dokumentieren  

### Nur auf Linux Host:
```bash
docker run \
  -v /etc/timezone:/etc/timezone:ro \
  -v /etc/localtime:/etc/localtime:ro \
  phylax-syslog-service:latest
```

---

## 3️⃣ Option 3: Im Dockerfile festlegen

Man kann die Timezone auch direkt im Dockerfile setzen (nicht flexible).

### Dockerfile
```dockerfile
FROM node:26-alpine

# Timezone permanently set
ENV TZ=Europe/Berlin

RUN apk add --no-cache dumb-init tzdata
```

### Nachteile:
❌ Wenig flexibel (Änderung erfordert Rebuild)  
❌ Nicht empfohlen für Production  

---

## 🎯 Empfehlung: Multi-Stage Setup

Hier ist die empfohlene Setup-Strategie:

### Dockerfile (vorbereitet)
```dockerfile
FROM node:26-alpine
RUN apk add --no-cache dumb-init tzdata
# Kein fester TZ im Dockerfile!
```

### docker-compose.yml (Production)
```yaml
services:
  syslog:
    environment:
      - TZ=Europe/Berlin  # ← Explizit setzen
```

### docker-compose_dev.yml
```yaml
services:
  syslog:
    environment:
      - TZ=Europe/Berlin  # oder andere Timezone
```

---

## 🧪 Testen ob die Timezone funktioniert

### 1. Container starten
```bash
docker-compose up -d
```

### 2. Container-Zeit überprüfen
```bash
# Zeige Node.js lokale Zeit
docker exec phylax-syslog node -e "console.log(new Date().toLocaleString())"

# Beispielausgabe (wenn TZ=Europe/Berlin):
# 7/25/2026, 2:30:45 PM
```

### 3. Logs überprüfen
```bash
# Zeige letzte Log-Einträge
docker exec phylax-syslog tail -f /var/log/syslog/host1.log

# Logs sollten lokale Zeit zeigen:
# 2026-07-24 14:30:45.123 hostname [tag] message
#                     ↑
#           Sollte Ihrer lokalen Zeit entsprechen
```

### 4. Vergleich: Host vs. Container
```bash
# Host-Zeit
date

# Container-Zeit
docker exec phylax-syslog node -e "console.log(new Date())"

# Sollte (je nach TZ) gleich sein oder erwarteter Unterschied
```

---

## ⚙️ Laufzeit-Änderung der Timezone

### Ohne Neustart (nur Logs beeinflussen)
```bash
docker exec -it phylax-syslog env TZ=America/New_York node -e "console.log(new Date())"
```

### Mit Neustart (vollständige Änderung)
```bash
# 1. docker-compose.yml Timezone ändern
# 2. Container neu starten
docker-compose restart syslog
```

---

## 🐛 Fehlerbehebung

### Problem: Logs zeigen immer noch UTC?

**Ursache 1: `tzdata` nicht installiert**
```bash
docker exec phylax-syslog apk add tzdata
docker-compose restart syslog
```

**Ursache 2: TZ-Variable nicht gesetzt**
```bash
# Prüfe ob TZ gesetzt ist
docker exec phylax-syslog printenv TZ

# Sollte einen Wert zeigen, z.B. "Europe/Berlin"
```

**Ursache 3: Falsche Timezone**
```bash
# Überprüfe mit dieser Kommando
docker exec phylax-syslog node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)"

# Sollte die erwartete Timezone zeigen
```

### Problem: Container startet nicht nach TZ-Änderung?

```bash
# Container-Logs anschauen
docker-compose logs syslog

# Evtl. liegt es an einer ungültigen Timezone
# Überprüfe die Spelling!
```

---

## 📝 Checkliste für Deployment

- ✅ Dockerfile hat `tzdata` installiert (bereits done)
- ✅ docker-compose.yml hat `TZ` Variable gesetzt
- ✅ `TZ` hat korrekte Timezone (z.B. `Europe/Berlin`)
- ✅ Logs zeigen lokale Zeit (nicht UTC)
- ✅ Datei-Rotation basiert auf lokalem Datum
- ✅ Health-Check funktioniert

---

## 🔗 Weiterführende Links

- [TZ Database Time Zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [Node.js Timezone Support](https://nodejs.org/en/knowledge/file-system/how-to-store-local-time-in-node/)
- [Docker Alpine Linux Timezone](https://wiki.alpinelinux.org/wiki/Setting_the_timezone)
- [TZDATA Package](https://pkgs.alpinelinux.org/package/edge/main/x86_64/tzdata)

---

## 📌 Zusammenfassung

| Methode | Einfachheit | Flexibilität | Empfehlung |
|---------|-------------|--------------|-----------|
| **TZ Variable** | ⭐⭐⭐ Einfach | ⭐⭐⭐ Sehr flexibel | ✅ **BEST** |
| **Host-Mount** | ⭐⭐ Mittel | ⭐⭐ Mittelmäßig | ⚠️ Nur Linux |
| **Dockerfile ENV** | ⭐ Sehr simpel | ⭐ Nicht flexibel | ❌ **Nicht empfohlen** |

**→ Nutze die `TZ` Umgebungsvariable in docker-compose.yml** ✅

