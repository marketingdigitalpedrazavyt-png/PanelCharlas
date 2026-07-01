/* =========================================================
   Maravillas del Mediterráneo · Autenticación (staff)
   Firebase Auth email/contraseña. El superadmin (config.js)
   se crea solo la primera vez que inicia sesión.
   Expone: window.Auth
   Requiere: firebase-auth-compat + firebase-firestore-compat
   ========================================================= */
window.Auth = (function () {
    "use strict";

    var CFG = window.APP_CONFIG || {};
    if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
    var auth = firebase.auth();
    var db = firebase.firestore();
    var COL_U = CFG.coleccionUsuarios || "usuarios";
    var SUPER = ((CFG.superAdmin || {}).email || "").trim().toLowerCase();

    function isSuper(user) {
        return !!user && (user.email || "").trim().toLowerCase() === SUPER;
    }

    async function login(email, pass) {
        email = (email || "").trim();
        try {
            var cred = await auth.signInWithEmailAndPassword(email, pass);
            return cred.user;
        } catch (err) {
            // Bootstrap: primera vez del superadmin → se crea la cuenta
            var faltante = (err.code === "auth/user-not-found" ||
                err.code === "auth/invalid-credential" ||
                err.code === "auth/invalid-login-credentials");
            if (faltante && email.toLowerCase() === SUPER) {
                try {
                    var c2 = await auth.createUserWithEmailAndPassword(email, pass);
                    try {
                        await db.collection(COL_U).doc(c2.user.uid).set({
                            email: email, rol: "superadmin",
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    } catch (e) { /* la sesión ya está iniciada igual */ }
                    return c2.user;
                } catch (e2) {
                    if (e2.code === "auth/email-already-in-use") {
                        var wrong = new Error("Contraseña incorrecta.");
                        wrong.code = "auth/wrong-password";
                        throw wrong;
                    }
                    throw e2;
                }
            }
            throw err;
        }
    }

    function logout() { return auth.signOut(); }
    function onChange(cb) { return auth.onAuthStateChanged(cb); }

    // Crea un usuario staff SIN cerrar la sesión del superadmin
    // (usa una app de Firebase secundaria).
    async function createStaff(email, pass) {
        var sec;
        try { sec = firebase.app("secondary"); }
        catch (e) { sec = firebase.initializeApp(CFG.firebase, "secondary"); }

        var cred = await sec.auth().createUserWithEmailAndPassword(email.trim(), pass);
        await db.collection(COL_U).doc(cred.user.uid).set({
            email: email.trim(), rol: "staff",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await sec.auth().signOut();
        return cred.user;
    }

    function mensajeError(err) {
        switch (err && err.code) {
            case "auth/invalid-email": return "El email no es válido.";
            case "auth/missing-password": return "Ingresá la contraseña.";
            case "auth/weak-password": return "La contraseña debe tener al menos 6 caracteres.";
            case "auth/wrong-password":
            case "auth/invalid-credential":
            case "auth/invalid-login-credentials": return "Email o contraseña incorrectos.";
            case "auth/user-not-found": return "No existe un usuario con ese email.";
            case "auth/email-already-in-use": return "Ya existe un usuario con ese email.";
            case "auth/too-many-requests": return "Demasiados intentos. Esperá un momento.";
            case "auth/operation-not-allowed": return "Activá Email/Password en Firebase Auth.";
            default: return (err && err.message) || "No se pudo completar la operación.";
        }
    }

    return {
        auth: auth, db: db,
        login: login, logout: logout, onChange: onChange,
        isSuper: isSuper, createStaff: createStaff,
        superEmail: SUPER, coleccionUsuarios: COL_U, mensajeError: mensajeError
    };
})();
