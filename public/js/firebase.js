/**
 * =================================================================
 * MAPMARKET - CONFIGURATION FIREBASE (firebase.js)
 * =================================================================
 * Rôle : Initialiser tous les services Firebase et gérer la connexion
 * aux émulateurs pour le développement local.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, GeoPoint } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging.js";

// CORRECTION : Utilisation de la configuration exacte de votre projet Firebase.
const firebaseConfig = {
    apiKey: "AIzaSyAekia-9yVdrDCHSm5mhp3P8XJjg6UbQqg",
    authDomain: "mapmarket-72654.firebaseapp.com",
    projectId: "mapmarket-72654",
    storageBucket: "mapmarket-72654.appspot.com",
    messagingSenderId: "162014945728",
    appId: "1:162014945728:web:0f6a95782782c5d3d4b6c3" // Gardé depuis votre fichier original
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'europe-west1');
const messaging = getMessaging(app);

// Ce bloc est correct et permet de se connecter aux émulateurs locaux.
if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    console.warn(
        "MODE LOCAL DÉTECTÉ : Connexion aux Émulateurs Firebase. " +
        "Assurez-vous qu'ils sont bien lancés via 'firebase emulators:start'."
    );
    // Redirige l'authentification vers l'émulateur sur le port 9099
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    
    // Redirige Firestore vers l'émulateur sur le port 8080
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    
    // Redirige le Storage vers l'émulateur sur le port 9199
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    
    // Redirige les Fonctions vers l'émulateur sur le port 5001
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// On exporte tout pour que les autres modules puissent les utiliser.
export { app, auth, db, storage, functions, messaging, GeoPoint };