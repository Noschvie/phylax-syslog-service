# Environment Configuration Best Practices

## 🎯 Prinzip: Single Source of Truth

Die Konfiguration sollte an **nur einer Stelle** definiert sein: der `.env` Datei.

### ❌ Alte Methode (nicht empfohlen)
```yaml
# docker-compose.yml
environment:
  - NODE_ENV=production        # Hardcoded
  - SYSLOG_PORT=514            # Hardcoded
  - HEARTBEAT_ENABLED=true     # Hardcoded
```

**Probleme:**
- Konfiguration an mehreren Orten
- Schwer zu verwalten
- Fehleranfällig
- Nicht production-ready

### ✅ Neue Methode (empfohlen)
```yaml
# docker-compose.yml
environment:
  - NODE_ENV=${NODE_ENV:-production}
  - SYSLOG_PORT=${SYSLOG_PORT:-514}
  - HEARTBEAT_ENABLED=${HEARTBEAT_ENABLED:-true}
```

**Vorteile:**
- ✅ Konfiguration in `.env` zentralisiert
- ✅ Falls Variable nicht gesetzt → Default-Wert
- ✅ Einfach zu verwalten
- ✅ Production-ready
- ✅ Environment-spezifische Konfiguration möglich

---

## 🔧 Wie es funktioniert

### 1. docker-compose.yml nutzt Variablen
```yaml
environment:
  - TZ=${TZ:-Europe/Berlin}          # Nutzt .env oder Default
  - SYSLOG_PORT=${SYSLOG_PORT:-514}   # Nutzt .env oder Default
```

### 2. .env Datei definiert Werte
```dotenv
# .env (development)
TZ=Europe/Berlin
SYSLOG_PORT=5514
NODE_ENV=development

# oder .env.production (für Production)
TZ=Europe/Berlin
SYSLOG_PORT=514
NODE_ENV=production
```

### 3. Docker-compose lädt automatisch

```bash
# docker-compose loaded aus .env
docker-compose up -d

# Variablen werden gesetzt:
# $NODE_ENV = Wert aus .env
# $SYSLOG_PORT = Wert aus .env
# $TZ = Wert aus .env
```

---

## 📁 Datei-Struktur

```
phylax-syslog-service/
├── .env                      # Development (locally gitignored)
├── .env.example              # Template mit alle Variablen
├── .env.docker.example       # Template für Docker Production
├── docker-compose.yml        # Uses ${VARIABLES} from .env
├── docker-compose_dev.yml    # Uses ${VARIABLES} from .env
└── Dockerfile                # Keine Variablen, nur static config
```

### Bedeutung der Dateien

| Datei | Verwendung | Git |
|-------|-----------|-----|
| `.env` | Development lokal | ❌ `.gitignore` |
| `.env.example` | Template für alle Entwickler | ✅ Versionskontrolle |
| `.env.docker.example` | Template für Docker Production | ✅ Versionskontrolle |
| `docker-compose.yml` | Production docker-compose | ✅ Versionskontrolle |
| `docker-compose_dev.yml` | Development docker-compose | ✅ Versionskontrolle |

---

## 🚀 Deployment Szenarien

### Szenario 1: Lokale Entwicklung
```bash
# 1. Template kopieren
cp .env.example .env

# 2. Nach Bedarf anpassen
# NODE_ENV=development
# SYSLOG_PORT=5514
# TZ=Europe/Berlin

# 3. Starten
npm start
```

### Szenario 2: Docker Development
```bash
# 1. Template kopieren
cp .env.example .env

# 2. Optional anpassen
# SYSLOG_PORT=514 (für Docker)
# LOG_LEVEL=debug

# 3. Starten
docker-compose up -d
```

### Szenario 3: Docker Production
```bash
# 1. Production Template kopieren
cp .env.docker.example .env

# 2. Production-spezifische Werte setzen
# NODE_ENV=production
# HEARTBEAT_ENABLED=true
# HEARTBEAT_DESTINATION=192.168.1.10
# TZ=Europe/Berlin
# SYSLOG_LOG_RETENTION_DAYS=90

# 3. Starten
docker-compose up -d
```

### Szenario 4: Multiple Environments (CI/CD)
```bash
# Development
cp .env.example .env.dev
docker-compose --env-file .env.dev up -d

# Production
cp .env.docker.example .env.prod
docker-compose --env-file .env.prod up -d

# Staging
cp .env.docker.example .env.staging
# Anpassen...
docker-compose --env-file .env.staging up -d
```

---

## 📋 Checkliste für neue Variablen

Wenn Sie eine neue Konfigurationsvariable hinzufügen:

- [ ] **In `config.js` definieren** (mit Validierung)
  ```javascript
  const config = {
    myNewVar: process.env.MY_NEW_VAR || 'default-value',
  };
  ```

- [ ] **In `.env.example` hinzufügen** (mit Kommentaren)
  ```dotenv
  # Description of MY_NEW_VAR
  MY_NEW_VAR=default-value
  ```

- [ ] **In `.env.docker.example` hinzufügen** (mit Production-Wert)
  ```dotenv
  MY_NEW_VAR=production-value
  ```

- [ ] **In `docker-compose.yml` hinzufügen** (mit Fallback)
  ```yaml
  environment:
    - MY_NEW_VAR=${MY_NEW_VAR:-default-value}
  ```

- [ ] **In `docker-compose_dev.yml` hinzufügen**
  ```yaml
  environment:
    - MY_NEW_VAR=${MY_NEW_VAR:-default-value}
  ```

- [ ] **Testen**
  ```bash
  docker-compose config | grep MY_NEW_VAR
  ```

---

## 🔐 Sicherheit

### ✅ Was man in `.env` speichern kann
- Port-Nummern
- Verzeichnisse
- Feature-Flags
- Performance-Tuning-Parameter
- Monitoring-Einstellungen
- Timezone

### ❌ Was man NICHT in `.env` speichern sollte
- Passwörter
- API-Keys
- Secrets
- Tokens

**Für Secrets verwenden Sie:**
- Docker Secrets (für Swarm)
- Kubernetes Secrets (für K8s)
- Vault (für Secrets Management)
- CI/CD Secrets (GitHub Actions, GitLab CI, etc.)

---

## 🧪 Testen der Konfiguration

### Konfiguration überprüfen
```bash
# Zeige alle environment variables
docker-compose config

# Zeige spezifische Variable
docker-compose config | grep TZ

# Zeige nur Service-Environment
docker-compose config | grep -A 30 "environment:"
```

### Im Container überprüfen
```bash
# Zeige alle Umgebungsvariablen
docker exec phylax-syslog printenv

# Zeige spezifische Variable
docker exec phylax-syslog printenv SYSLOG_PORT

# Verifiziere Konfiguration wurde geladen
docker exec phylax-syslog node -e "console.log(process.env.TZ)"
```

---

## 📝 Zusammenfassung

| Konzept | Umsetzung |
|---------|-----------|
| **Configuration Source** | `.env` Dateien |
| **docker-compose** | Nutzt `${VARIABLE}` Syntax |
| **Fallback-Werte** | `${VARIABLE:-default}` in docker-compose |
| **Development** | `.env` (gitignored) |
| **Template** | `.env.example` + `.env.docker.example` |
| **Production** | Copy template, anpassen, `.env` laden |
| **CI/CD** | `--env-file` Option für verschiedene Environments |

**Result: Single source of truth für alle Konfiguration! ✅**

