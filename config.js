/* =========================================================
   Maravillas del Mediterráneo · Configuración central
   ---------------------------------------------------------
   👉 EDITÁ ESTE ARCHIVO. Es el único lugar con datos que
      cambian (Firebase, evento, PIN del staff y tu backend
      de WhatsApp). El resto del código lee de acá.
   ========================================================= */
window.APP_CONFIG = {

    /* 1) Firebase (tu proyecto actual) */
    firebase: {
        apiKey: "AIzaSyBnIReT31u-ACaOp4orpodz6fyjzToUhuc",
        authDomain: "formulario-pedraza.firebaseapp.com",
        projectId: "formulario-pedraza",
        storageBucket: "formulario-pedraza.appspot.com",
        messagingSenderId: "220367986642",
        appId: "1:220367986642:web:50d74eef0ebdb21daa320b"
    },

    /* 2) Colecciones de Firestore */
    coleccion: "inscripciones",
    coleccionEventos: "eventos",
    coleccionVendedores: "vendedores",
    coleccionUsuarios: "usuarios",

    /* URL pública del formulario. Dejalo VACÍO para autodetectar
       según desde dónde abrís el panel (recomendado). Poné la URL
       final si querés que los links de vendedores SIEMPRE apunten
       al servidor aunque generes desde localhost.
       Ej: "https://inscripciones.pedraza.com.ar/index.html" */
    siteUrl: "",

    /* 3) Marca del paquete (título de la credencial). Los datos de cada
          charla (día, hora, lugar…) se cargan desde el panel (pestaña
          Eventos) y se eligen en el formulario. */
    evento: {
        nombre: "Maravillas del Mediterráneo",
        bajada: "Charla informativa exclusiva"
    },

    /* 4) Superadmin (login del panel/escáner con Firebase Auth).
          Este email es el dueño: puede crear otros usuarios.
          La contraseña NO se guarda acá: la primera vez que inicies
          sesión con este email, la cuenta se crea con la clave que
          escribas. Requiere activar "Email/Password" en Firebase Auth. */
    superAdmin: { email: "cm@pedraza.com.ar" },

    /* 5) Integración con TU backend (WhatsApp Cloud API).
          La web hace POST a este endpoint con los datos + la
          credencial en base64; tu servidor envía el WhatsApp. */
    whatsapp: {
        habilitado: false,                     // poné true cuando el endpoint esté listo
        endpoint: "",                          // ej: "https://api.tuservidor.com/enviar-credencial"
        // Si tu endpoint requiere autenticación, poné el header completo:
        authHeader: ""                         // ej: "Bearer TU_TOKEN"  (vacío = sin header)
    }
};
