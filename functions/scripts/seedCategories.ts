// /functions/scripts/seedCategories.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

// Charger la clé de service
const serviceAccount = JSON.parse(
  fs.readFileSync(__dirname + "/../service-account.json", "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: "mapmarket-72654",
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
  console.log("🟡 Début du seeding des catégories...");
  const batch = db.batch();
  const ref = db.collection("categories");

  categories.forEach((cat) => {
    const docRef = ref.doc(cat.id);
    batch.set(docRef, {
      ...cat,
      adCount: 0,
      updatedAt: new Date()
    });
  });

  try {
    await batch.commit();
    console.log(`✅ ${categories.length} catégories ajoutées avec succès.`);
  } catch (err) {
    console.error("❌ Erreur de batch Firestore:", err);
  }
}

seedCategories();
