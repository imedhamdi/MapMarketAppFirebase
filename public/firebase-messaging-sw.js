/**
 * =================================================================
 * MAPMARKET - SERVICE WORKER POUR FIREBASE MESSAGING
 * =================================================================
 * Rôle : Tourner en arrière-plan pour recevoir les notifications push
 * via Firebase Cloud Messaging, même quand l'onglet de l'app est fermé.
 */

// Importe les scripts Firebase (requis pour FCM en arrière-plan)
importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js");

// --- VOTRE CONFIGURATION FIREBASE ---
// La même configuration que dans votre fichier firebase.js
const firebaseConfig = {
    apiKey: "AIzaSyAekia-9yVdrDCHSm5mhp3P8XJjg6UbQqg",
    authDomain: "mapmarket-72654.firebaseapp.com",
    projectId: "mapmarket-72654",
    storageBucket: "mapmarket-72654.appspot.com",
    messagingSenderId: "162014945728",
    appId: "1:162014945728:web:0f6a95782782c5d3d4b6c3"
};

// Initialise l'application Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Gère les messages reçus en arrière-plan
messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);

    // Personnalise la notification
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/assets/icons/icon-192x192.png', // Un icône par défaut
        data: {
            url: payload.fcmOptions.link // Ouvre ce lien au clic sur la notif
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gère le clic sur la notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Ferme la notification
    
    const urlToOpen = event.notification.data.url;
    
    // Ouvre une nouvelle fenêtre ou focus sur une existante
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clientList => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus().then(c => c.navigate(urlToOpen));
            }
            return clients.openWindow(urlToOpen);
        })
    );
});
