# Maravillas del Mediterráneo — Stack Docker (React + Express + MySQL + n8n + WAHA)

Sistema de inscripción a charlas con credencial (boarding pass + QR), panel de
administración, escáner de ingreso y envío de la credencial por WhatsApp.

## Arquitectura

```
┌───────────┐   /api    ┌───────────┐        ┌──────────┐
│ frontend  │ ────────► │  backend  │ ─────► │  mysql   │
│ React+Vite│  (nginx   │  Express  │  SQL   │          │
│  (nginx)  │  proxy)   │ hexagonal │        └──────────┘
└───────────┘           │  mysql2   │
     :8080              └─────┬─────┘
                              │ HTTP
                        ┌─────▼─────┐
                        │   n8n     │  (Webhook WhatsApp)
                        │  webhook  │
                        └─────┬─────┘
                              │ HTTP
                        ┌─────▼─────┐
                        │   WAHA    │  (WhatsApp API)
                        │   :3000   │
                        └───────────┘
```

- **frontend/** — React + Vite. Rutas: `/` (inscripción, estética del paquete),
  `/panel` (admin, minimalista azul/blanco), `/escaner` (abierto).
- **backend/** — Node + Express con **arquitectura hexagonal**:
  - `domain/` — entidades + puertos (sin framework).
  - `application/` — casos de uso.
  - `infrastructure/` — adaptadores: `persistence/mysql` (mysql2), `auth` (JWT+bcrypt),
    `whatsapp` (n8n webhook), `credencial` (@napi-rs/canvas + qrcode + pdfkit), `http` (Express).
  - `main.js` — composition root (wiring).
- **db/init.sql** — esquema MySQL (el superadmin lo siembra el backend al arrancar).

## Puesta en marcha

1. Instalá **Docker** y **Docker Compose**.
2. Copiá el archivo de entorno y completá los valores:
   ```bash
   cp .env.example .env
   # editá .env: contraseñas de MySQL, JWT_SECRET, SUPERADMIN_*, N8N_WEBHOOK_URL…
   ```
3. Levantá todo:
   ```bash
   docker compose up -d --build
   ```
4. Abrí:
   - **Formulario:** http://localhost:8080/
   - **Panel:** http://localhost:8080/panel  → login con `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` (del `.env`).
   - **Escáner:** http://localhost:8080/escaner
   - **WAHA:** http://localhost:3000
> El superadmin se crea/actualiza solo al arrancar el backend, con los datos del `.env`.

## Flujo de uso
1. En el **panel** → pestaña **Eventos**: creá las charlas (día, hora, dirección, barrio).
2. Pestaña **Vendedores**: creá vendedores y copiá su link (`…/?v=slug`).
3. La gente entra al **formulario**, elige el evento y se inscribe → recibe su **credencial**
   (imagen + PDF) y, si WhatsApp está activo, le llega por WhatsApp.
4. En el evento, el **escáner** lee el QR y marca asistencia.
5. En **Inscriptos** ves todo, filtrás, exportás **CSV/Excel**, bajás el **PDF** de cada uno o borrás.

## WhatsApp por n8n
1. Pone `WHATSAPP_ENABLED=true` en `.env`.
2. Configura `N8N_WEBHOOK_URL` con la URL del webhook de n8n que recibira la credencial.
3. En n8n, usa el payload recibido para llamar a WAHA.
4. Listo: cada inscripción dispara un POST al webhook; Express no envia mensajes directo a WAHA.

### Endpoint puente n8n → WAHA
Desde n8n podes llamar al backend para que normalice el payload y lo envie a WAHA:

```http
POST http://backend:4000/api/n8n/waha/send-image
Content-Type: application/json
Authorization: Bearer N8N_BRIDGE_TOKEN
```

El header de autorizacion es obligatorio solo si configuraste `N8N_BRIDGE_TOKEN`.

Objeto simple aceptado:

```json
{
  "numero": "5491123456789",
  "imagen": "BASE64_DE_LA_IMAGEN",
  "body": "Texto del mensaje"
}
```

Tambien acepta el payload WAHA completo:

```json
{
  "session": "default",
  "chatId": "5491123456789@c.us",
  "caption": "Texto del mensaje",
  "file": {
    "mimetype": "image/png",
    "filename": "credencial.png",
    "data": "BASE64_DE_LA_IMAGEN"
  }
}
```

## Producción / HTTPS
- La **cámara del escáner exige HTTPS** (salvo en `localhost`). En un servidor real, poné un
  reverse proxy con certificado (Caddy / Traefik / nginx + certbot) delante del servicio `frontend`.
- Cambiá **todas** las contraseñas del `.env` y usá un `JWT_SECRET` largo y aleatorio.

## Desarrollo local (sin Docker)
```bash
# backend
cd backend && npm install && npm run dev        # necesita un MySQL accesible (ver .env)
# frontend
cd frontend && npm install && npm run dev        # http://localhost:5173 (proxy /api → :4000)
```

## Comandos útiles
```bash
docker compose logs -f backend      # ver logs del backend
docker compose down                 # apagar
docker compose down -v              # apagar y BORRAR la base de datos (volúmenes)
```
