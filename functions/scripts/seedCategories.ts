/**
 * Script d'initialisation (seeding) pour remplir la collection 'categories'.
 * À exécuter manuellement avec `ts-node` depuis le répertoire `functions`.
 * Ex: `ts-node scripts/seedCategories.ts`
 * Assurez-vous d'avoir configuré les identifiants de votre projet (GOOGLE_APPLICATION_CREDENTIALS).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- CONFIGURATION ---
// CORRECTION : Le chemin pointe maintenant vers un fichier placé à la racine du dossier `functions`.
// Nous allons télécharger ce fichier à l'étape suivante.
const serviceAccount = require('../service-account.json'); 

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const categories = [
    { id: "immobilier", name_fr: "Immobilier", name_en: "Real Estate", icon: "fa-home" },
    { id: "vehicules", name_fr: "Véhicules", name_en: "Vehicles", icon: "fa-car" },
    { id: "electronique", name_fr: "Électronique", name_en: "Electronics", icon: "fa-mobile-alt" },
    { id: "mode", name_fr: "Mode & Vêtements", name_en: "Fashion & Apparel", icon: "fa-tshirt" },
    { id: "maison", name_fr: "Maison & Jardin", name_en: "Home & Garden", icon: "fa-couch" },
    { id: "loisirs", name_fr: "Loisirs & Divertissement", name_en: "Hobbies & Entertainment", icon: "fa-gamepad" },
    { id: "services", name_fr: "Services", name_en: "Services", icon: "fa-concierge-bell" },
    { id: "autres", name_fr: "Autres", name_en: "Other", icon: "fa-box" }
];

async function seedCategories() {
    console.log("Début du seeding des catégories...");
    const batch = db.batch();
    const collectionRef = db.collection('categories');

    categories.forEach(category => {
        const docRef = collectionRef.doc(category.id);
        batch.set(docRef, {
            ...category,
            adCount: 0 // Initialise le compteur à 0
        });
    });

    try {
        await batch.commit();
        console.log(`✅ ${categories.length} catégories ont été ajoutées/mises à jour avec succès.`);
    } catch (error) {
        console.error("❌ Erreur lors du seeding des catégories:", error);
    }
}

seedCategories();
