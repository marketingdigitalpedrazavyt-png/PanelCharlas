# Maravillas del Mediterráneo — Sistema de inscripción + credencial + check-in

## Qué hay

| Archivo | Para qué |
|---|---|
| `index.html` + `app.js` + `credencial.js` | Formulario de inscripción → se elige el **evento** en un desplegable, captura el **vendedor por link** (`?v=slug`), genera **código único** + **credencial boarding pass con QR**, la muestra, permite **descargar PDF / compartir** y avisa a tu backend para el **WhatsApp**. |
| `panel.html` + `panel.js` + `admin.css` | **Panel de administración** (login con email/contraseña), tema minimalista azul/blanco, con pestañas: **Inscriptos** (tabla, totales, filtros, export **CSV/Excel**, **PDF de la credencial** y **borrar** inscripto), **Eventos**, **Vendedores** y **Usuarios** (solo el superadmin). |
| `escaner.html` + `escaner.js` | **Escáner** (abierto, sin login). Lee el QR con la cámara y marca `asistio`. |
| `auth.js` | Autenticación con Firebase Auth (login + alta de usuarios + bootstrap del superadmin). |
| `config.js` | **Único archivo que editás**: Firebase, marca del paquete, email del superadmin y endpoint de WhatsApp. |
| `firestore.rules` | Reglas para pegar en Firebase Console. |

## 1) Editá `config.js`
- `evento`: solo `nombre` y `bajada` (la **marca** del paquete; título de la credencial).
- `superAdmin.email`: el dueño del panel (por defecto `cm@pedraza.com.ar`).
- `whatsapp.endpoint` / `authHeader` / `habilitado`: tu backend de WhatsApp.

## 2) Activá Email/Password en Firebase (¡obligatorio para el panel!)
**Firebase Console → Authentication → Sign-in method → Email/Password → Activar.**
Sin esto, el login del panel no funciona.

- La **primera vez** que entrás a `panel.html` con el email del superadmin y la contraseña que elijas, **la cuenta se crea sola** con esa clave. (Iniciá sesión vos primero para "reclamar" la cuenta.)
- Desde la pestaña **Usuarios**, el superadmin crea más usuarios (email + contraseña) y ve **cuántos hay**.
- El **escáner NO pide login** (queda abierto para el personal de acceso); solo puede marcar asistencia.

## 3) Reglas de Firestore
Pegá `firestore.rules` en **Firebase Console → Firestore → Reglas → Publicar**.
> Eventos/vendedores y el alta de inscripciones son públicos (los usa el formulario). **Borrar** inscriptos y administrar eventos/vendedores/usuarios requiere estar **logueado**. La lectura de inscripciones queda pública (la usa la verificación de duplicados del formulario); si querés cerrarla, avisame y lo movemos a un esquema con índice de claves.

## 4) Cargá eventos y vendedores (desde el panel)
Entrá a `panel.html` (login):
- **Pestaña Eventos:** creá las charlas con **día, hora, dirección y barrio** (obligatorios) + lugar y vendedor a cargo (opcionales). Aparecen al instante en el **desplegable del formulario**. Sin eventos, el formulario muestra "No hay eventos disponibles".
- **Pestaña Vendedores:** creá cada vendedor y **copiá su link** (`…/index.html?v=slug`). Quien se inscribe desde ese link queda **atribuido automáticamente** a ese vendedor (sin campos extra en el form). Quien entra sin link queda como "Directo".
- **Pestaña Inscriptos:** tabla en vivo con evento, día/hora y vendedor; filtros, buscador, **export CSV/Excel** y botón **PDF** para regenerar la credencial de cada uno.

## 5) 🔌 Conexión con tu backend de WhatsApp (lo que necesito de vos)

Cuando alguien se inscribe, la web hace este **POST** a tu endpoint:

```
POST  <whatsapp.endpoint>
Headers: Content-Type: application/json
         Authorization: <whatsapp.authHeader>   (si lo configuraste)

Body (JSON):
{
  "codigo": "MM-7F3K9",
  "nombre": "Juan",
  "apellido": "Pérez",
  "celular": "1155555555",            // dígitos tal cual los cargó
  "celularWhatsApp": "5491155555555", // normalización best-effort (VALIDALA vos)
  "paquete": "Maravillas del Mediterráneo",
  "evento": {                          // datos de la charla elegida
    "id": "abc123",
    "label": "15/08/2026 · 19:00 hs · Recoleta — Hotel Alvear",
    "dia": "2026-08-15",
    "hora": "19:00",
    "lugar": "Hotel Alvear",
    "direccion": "Av. Alvear 1891",
    "barrio": "Recoleta",
    "vendedor": "María"               // vendedor a cargo del evento (opcional)
  },
  "vendedor": {                        // quién le mandó el link (atribución)
    "id": "maria-gonzalez",
    "nombre": "María González"
  },
  "credencialBase64": "data:image/png;base64,iVBORw0KGgo..."  // la imagen de la credencial
}
```

**Tu backend** (que ya tenés corriendo con la WhatsApp Cloud API) debe:
1. Tomar `credencialBase64` (es un PNG en data-URL). Para mandarlo por WhatsApp Cloud API tenés 2 caminos:
   - **Subirlo como media**: `POST /{phone_id}/media` (multipart, el PNG) → te da un `media id` → mandás un mensaje tipo `image` con ese `id`.
   - **O alojarlo** en una URL pública y mandar `image.link`.
2. Enviar el mensaje al `celularWhatsApp` (recomendado: revalidá/normalizá el número con tu propia lógica AR; el que mando es "mejor esfuerzo").
   - Si el usuario **no te escribió antes**, Meta exige **plantilla aprobada** con header de imagen. Usá esa plantilla.

**Lo único que necesito que me confirmes / ajustes:**
- ✅ La **URL del endpoint** (la ponés en `config.js`).
- ✅ Si pide **auth**, el header exacto.
- ✅ Si tu endpoint prefiere **recibir el número ya normalizado** o lo normaliza él (yo mando ambos campos).
- ✅ Si en vez de `credencialBase64` preferís que te mande **otra cosa** (ej. solo los datos y que la imagen la generes vos): decímelo y lo cambio en `app.js` (función `enviarWhatsApp`).

> Respuesta esperada: cualquier `2xx` = enviado (la web muestra "✓ Te enviamos la credencial por WhatsApp"). Otro código = la web invita a descargar el PDF.

## 6) Respaldo siempre disponible
Pase lo que pase con WhatsApp, el usuario ve su credencial y puede **Descargar PDF** o **Compartir** (hoja nativa del celular: WhatsApp, mail, etc.).

## 7) Publicación
- Subí todos los archivos a tu hosting con HTTPS (la cámara del escáner **no funciona sin HTTPS**).
- URLs: formulario `…/index.html`, panel `…/panel.html`, escáner `…/escaner.html`.

## Nota sobre datos previos
La colección ahora es **`inscripciones`** (antes `fiesta`). Es una colección nueva; los registros viejos de prueba no se mezclan.
