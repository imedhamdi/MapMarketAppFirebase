/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'ANNONCES (ad-manager.js)
 * =================================================================
 * @file Ce fichier gère toute la logique du formulaire de création et
 * d'édition d'annonces, y compris la carte interactive, la gestion
 * des images, le géocodage, et la soumission des données à Firestore.
 */

import { showToast, showGlobalLoader, hideGlobalLoader, validateForm } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { GeoPoint } from './firebase.js';
import { createAd, updateAd, uploadAdImage, fetchCategories, fetchAdById } from './services.js';
import { getState } from './state.js';
import { loadAndDisplayAds } from './map.js';

// Variables globales pour le module
let imageFiles = []; // Tableau des fichiers d'image sélectionnés
let adFormMap = null; // Instance de la carte Leaflet dans la modale
let adFormMarker = null; // Marqueur sur la mini-carte
let isEditMode = false; // Flag pour savoir si on est en création ou en édition

/**
 * Initialise le gestionnaire d'annonces en ajoutant les écouteurs d'événements.
 */
export function initAdManager() {
    const adForm = document.getElementById('ad-form');
    const adImagesInput = document.getElementById('ad-images-input');
    const locationInput = document.getElementById('ad-location-address');
    const useCurrentLocationBtn = document.getElementById('ad-form-use-current-location-btn');

    // Écouteurs pour les actions principales
    document.getElementById('nav-publish-ad-btn').addEventListener('click', () => openAdForm());
    adImagesInput.addEventListener('change', handleImageSelection);
    adForm.addEventListener('submit', handleAdFormSubmit);
    useCurrentLocationBtn.addEventListener('click', handleUseCurrentLocation);

    // Géocodage avec un délai pour ne pas surcharger l'API de recherche d'adresse
    let geocodeTimeout;
    locationInput.addEventListener('input', () => {
        clearTimeout(geocodeTimeout);
        geocodeTimeout = setTimeout(() => geocodeAddress(locationInput.value), 800);
    });
}

/**
 * Ouvre le formulaire d'annonce, soit en mode création, soit en mode édition.
 * @param {string|null} adId - L'ID de l'annonce à éditer. Si null, ouvre en mode création.
 */
export async function openAdForm(adId = null) {
    const { isLoggedIn } = getState();
    if (!isLoggedIn) {
        showToast("Connectez-vous pour gérer vos annonces.", "error");
        return openModal('auth-modal');
    }

    const adForm = document.getElementById('ad-form');
    const modalTitle = document.getElementById('ad-form-modal-title');
    const submitButton = document.getElementById('submit-ad-form-btn');
    
    // Réinitialisation du formulaire
    adForm.reset();
    document.getElementById('ad-image-previews-container').innerHTML = '';
    imageFiles = [];
    isEditMode = !!adId;

    if (isEditMode) {
        modalTitle.innerHTML = `<i class="fa-solid fa-pen"></i> Modifier l'annonce`;
        submitButton.innerHTML = `<i class="fa-solid fa-save"></i> Enregistrer les modifications`;
        showGlobalLoader("Chargement de l'annonce...");
        const adData = await fetchAdById(adId);
        if (adData) {
            populateFormForEdit(adData);
        }
        hideGlobalLoader();
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Publier une Annonce`;
        submitButton.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publier l'annonce`;
        document.getElementById('ad-id').value = '';
    }

    openModal('ad-form-modal');
    
    // Initialise la carte APRÈS que la modale soit visible pour avoir ses dimensions
    // et centre la vue sur l'annonce existante ou Paris par défaut.
    const initialCoords = isEditMode && adData.location.coordinates 
        ? [adData.location.coordinates.latitude, adData.location.coordinates.longitude]
        : [48.8566, 2.3522];
    initAdFormMap(initialCoords);
    if(isEditMode) updateLocationFields(initialCoords[0], initialCoords[1]);

    await populateCategories(isEditMode ? adData.categoryId : null);
}

/**
 * Pré-remplit le formulaire avec les données d'une annonce existante.
 * @param {object} adData Les données de l'annonce.
 */
function populateFormForEdit(adData) {
    document.getElementById('ad-id').value = adData.id;
    document.getElementById('ad-title').value = adData.title;
    document.getElementById('ad-description').value = adData.description;
    document.getElementById('ad-price').value = adData.price;
    document.getElementById('ad-location-address').value = adData.location.address;
    document.getElementById('ad-lat').value = adData.location.coordinates.latitude;
    document.getElementById('ad-lng').value = adData.location.coordinates.longitude;
    
    // Affiche les aperçus des images existantes
    const previewContainer = document.getElementById('ad-image-previews-container');
    previewContainer.innerHTML = adData.images.map(url => `
        <div class="image-preview-item">
            <img src="${url}" alt="Aperçu d'image">
        </div>
    `).join('');
}


/**
 * Initialise ou réinitialise la mini-carte dans le formulaire.
 * @param {Array<number>} center Coordonnées [lat, lng] pour centrer la carte.
 */
function initAdFormMap(center) {
    const mapContainerId = 'ad-form-map-preview';
    if (adFormMap) {
        adFormMap.setView(center, 13);
    } else {
        adFormMap = L.map(mapContainerId, { zoomControl: true, scrollWheelZoom: false }).setView(center, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adFormMap);
        adFormMap.on('click', (e) => updateLocationFields(e.latlng.lat, e.latlng.lng));
    }
    
    // Invalide la taille pour forcer Leaflet à se redessiner correctement dans la modale
    setTimeout(() => adFormMap.invalidateSize(), 200);
}

/**
 * Gère le clic sur "Utiliser ma position actuelle".
 */
function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
        return showToast("La géolocalisation n'est pas supportée par votre navigateur.", "error");
    }
    showGlobalLoader("Recherche de votre position...");
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        updateLocationFields(latitude, longitude);
        adFormMap.setView([latitude, longitude], 16);
        hideGlobalLoader();
        showToast("Position mise à jour !", "success");
    }, error => {
        hideGlobalLoader();
        showToast("Impossible d'obtenir votre position.", "error");
    });
}

/**
 * Trouve les coordonnées GPS d'une adresse via l'API Nominatim.
 * @param {string} address L'adresse à rechercher.
 */
async function geocodeAddress(address) {
    if (address.length < 5) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Réponse réseau non valide');
        const data = await response.json();
        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            updateLocationFields(parseFloat(lat), parseFloat(lon));
            adFormMap.setView([lat, lon], 15);
            document.getElementById('ad-location-address').value = display_name;
        }
    } catch (error) {
        console.error("Erreur de géocodage:", error);
        showToast("L'adresse n'a pas pu être trouvée.", "warning");
    }
}

/**
 * Met à jour les champs de formulaire cachés (lat/lng) et le marqueur sur la carte.
 * @param {number} lat Latitude.
 * @param {number} lng Longitude.
 */
function updateLocationFields(lat, lng) {
    document.getElementById('ad-lat').value = lat;
    document.getElementById('ad-lng').value = lng;
    if (adFormMarker) {
        adFormMarker.setLatLng([lat, lng]);
    } else {
        adFormMarker = L.marker([lat, lng]).addTo(adFormMap);
    }
}

/**
 * Récupère les catégories depuis Firestore et peuple le menu déroulant.
 * @param {string|null} selectedCategoryId L'ID de la catégorie à présélectionner en mode édition.
 */
async function populateCategories(selectedCategoryId = null) {
    const select = document.getElementById('ad-category');
    try {
        const categories = await fetchCategories();
        select.innerHTML = '<option value="" disabled>Choisir une catégorie...</option>';
        categories.forEach(cat => {
            const option = new Option(cat.name_fr, cat.id);
            select.appendChild(option);
        });
        if (selectedCategoryId) {
            select.value = selectedCategoryId;
        } else {
            select.selectedIndex = 0;
        }
    } catch (e) {
        console.error("Erreur chargement catégories:", e);
    }
}

/**
 * Gère la sélection des images et affiche les aperçus.
 */
function handleImageSelection(event) {
    const previewContainer = document.getElementById('ad-image-previews-container');
    imageFiles = Array.from(event.target.files).slice(0, 5);
    previewContainer.innerHTML = '';
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => previewContainer.innerHTML += `<div class="image-preview-item"><img src="${e.target.result}" alt="${file.name}"></div>`;
        reader.readAsDataURL(file);
    });
}

/**
 * Gère la soumission du formulaire pour créer ou mettre à jour une annonce.
 */
async function handleAdFormSubmit(e) {
    e.preventDefault();
    if (!validateForm(e.target).isValid) return;
    const { currentUser } = getState();
    if (!currentUser) return;

    showGlobalLoader(isEditMode ? "Mise à jour..." : "Publication...");
    
    try {
        const formData = new FormData(e.target);
        const adId = formData.get('adId');
        let imageUrls = [];

        // Upload de nouvelles images seulement si elles ont été sélectionnées
        if (imageFiles.length > 0) {
            const uploadPromises = imageFiles.map(file => uploadAdImage(file, currentUser.uid));
            imageUrls = await Promise.all(uploadPromises);
        }

        const lat = parseFloat(formData.get('latitude'));
        const lng = parseFloat(formData.get('longitude'));
        if (isNaN(lat) || isNaN(lng)) throw new Error("Localisation invalide.");

        const adData = {
            title: formData.get('title'),
            description: formData.get('description'),
            categoryId: formData.get('category'),
            price: parseFloat(formData.get('price')),
            location: {
                address: formData.get('locationAddress'),
                coordinates: new GeoPoint(lat, lng)
            },
            sellerId: currentUser.uid,
            status: 'active',
        };
        // N'ajoute les images que si de nouvelles ont été uploadées pour ne pas écraser les anciennes
        if (imageUrls.length > 0) {
            adData.images = imageUrls;
        }

        if (isEditMode && adId) {
            await updateAd(adId, adData);
            showToast("Annonce modifiée avec succès !", "success");
        } else {
            await createAd(adData);
            showToast("Annonce publiée !", "success");
        }

        closeModal('ad-form-modal');
        loadAndDisplayAds(); // Rafraîchit la carte
    } catch (error) {
        console.error("Erreur formulaire annonce:", error);
        showToast(error.message || "Erreur de soumission.", "error");
    } finally {
        hideGlobalLoader();
    }
}
