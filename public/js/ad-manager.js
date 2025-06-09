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
import { createAd, updateAd, uploadAdImage, fetchAdById } from './services.js';
import { getState } from './state.js';
import { loadAndDisplayAds } from './map.js';

let imageFiles = [];
let isEditMode = false;
let adFormMap = null; // Reste dans la portée du module
let adFormMarker = null;

/**
 * Force le recalcul de la taille de la carte du formulaire.
 * Doit être appelée après que la modale soit devenue visible.
 */
export function invalidateAdFormMapSize() {
    if (adFormMap) {
        setTimeout(() => adFormMap.invalidateSize(), 10);
    }
}

/**
 * Initialise les écouteurs d'événements pour le gestionnaire d'annonces.
 */
export function initAdManager() {
    const adForm = document.getElementById('ad-form');
    const adImagesInput = document.getElementById('ad-images-input');
    const locationInput = document.getElementById('ad-location-address');
    const useCurrentLocationBtn = document.getElementById('ad-form-use-current-location-btn');

    adImagesInput.addEventListener('change', handleImageSelection);
    adForm.addEventListener('submit', handleAdFormSubmit);
    useCurrentLocationBtn.addEventListener('click', handleUseCurrentLocation);

    let geocodeTimeout;
    locationInput.addEventListener('input', () => {
        clearTimeout(geocodeTimeout);
        geocodeTimeout = setTimeout(() => geocodeAddress(locationInput.value), 800);
    });
}

/**
 * Ouvre et pré-remplit le formulaire d'annonce pour une création ou une édition.
 * @param {string|null} adId - L'ID de l'annonce à éditer, ou null pour une création.
 */
export async function openAdForm(adId = null) {
    const { isLoggedIn } = getState();
    if (!isLoggedIn) {
        showToast("Connectez-vous pour publier une annonce.", "error");
        return openModal('auth-modal');
    }

    const adForm = document.getElementById('ad-form');
    const modalTitle = document.getElementById('ad-form-modal-title');
    const submitButton = document.getElementById('submit-ad-form-btn');

    adForm.reset();
    document.getElementById('ad-image-previews-container').innerHTML = '';
    imageFiles = [];
    isEditMode = !!adId;

    let adData = null;
    let initialCoords = [48.8566, 2.3522]; // Paris par défaut

    if (isEditMode) {
        modalTitle.innerHTML = `<i class="fa-solid fa-pen"></i> Modifier l'annonce`;
        submitButton.innerHTML = `<i class="fa-solid fa-save"></i> Enregistrer les modifications`;
        showGlobalLoader("Chargement de l'annonce...");
        adData = await fetchAdById(adId, false); // Ne pas incrémenter la vue en édition
        hideGlobalLoader();
        if (adData) {
            populateFormForEdit(adData);
            if (adData.location?.coordinates) {
                initialCoords = [adData.location.coordinates.latitude, adData.location.coordinates.longitude];
            }
        } else {
            showToast("Annonce introuvable.", "error");
            return;
        }
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Publier une Annonce`;
        submitButton.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publier l'annonce`;
        document.getElementById('ad-id').value = '';
    }

    openModal('ad-form-modal');

    initAdFormMap(initialCoords);
    if (adData) {
        document.querySelector('#ad-category').value = adData.categoryId;
    }
}

/**
 * Remplit les champs du formulaire avec les données d'une annonce existante.
 * @param {object} adData - Les données de l'annonce.
 */
function populateFormForEdit(adData) {
    document.getElementById('ad-id').value = adData.id;
    document.getElementById('ad-title').value = adData.title;
    document.getElementById('ad-description').value = adData.description;
    document.getElementById('ad-price').value = adData.price;
    document.getElementById('ad-location-address').value = adData.location.address || '';
    if (adData.location?.coordinates) {
        document.getElementById('ad-lat').value = adData.location.coordinates.latitude;
        document.getElementById('ad-lng').value = adData.location.coordinates.longitude;
    }

    const previewContainer = document.getElementById('ad-image-previews-container');
    if (adData.images && adData.images.length > 0) {
        previewContainer.innerHTML = adData.images.map(url => `
            <div class="image-preview-item">
                <img src="${url}" alt="Aperçu d'image">
            </div>
        `).join('');
    }
}

/**
 * Initialise ou met à jour la carte dans le formulaire.
 * @param {Array<number>} center - Les coordonnées [lat, lng] initiales.
 */
function initAdFormMap(center) {
    const mapContainerId = 'ad-form-map-preview';
    if (adFormMap) {
        adFormMap.setView(center, 13);
        adFormMarker.setLatLng(center);
    } else {
        adFormMap = L.map(mapContainerId, { zoomControl: true, scrollWheelZoom: false }).setView(center, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adFormMap);

        adFormMarker = L.marker(center, { draggable: true }).addTo(adFormMap);

        adFormMarker.on('dragend', function(e) {
            const { lat, lng } = e.target.getLatLng();
            updateLocationFields(lat, lng);
            reverseGeocode(lat, lng);
        });

        adFormMap.on('click', (e) => {
            adFormMarker.setLatLng(e.latlng);
            updateLocationFields(e.latlng.lat, e.latlng.lng);
            reverseGeocode(e.latlng.lat, e.latlng.lng);
        });
    }
    updateLocationFields(center[0], center[1]);
}

/**
 * Utilise la géolocalisation du navigateur pour positionner le marqueur.
 */
function handleUseCurrentLocation() {
    if (!adFormMap) return;
    if (!navigator.geolocation) return showToast("La géolocalisation n'est pas supportée.", "error");

    showGlobalLoader("Recherche de votre position...");
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        const newLatLng = [latitude, longitude];

        adFormMap.setView(newLatLng, 16);
        adFormMarker.setLatLng(newLatLng);
        updateLocationFields(latitude, longitude);
        reverseGeocode(latitude, longitude);

        hideGlobalLoader();
        showToast("Position mise à jour !", "success");
    }, () => {
        hideGlobalLoader();
        showToast("Impossible d'obtenir votre position.", "error");
    });
}

/**
 * Géocode une adresse textuelle pour trouver ses coordonnées.
 * @param {string} address - L'adresse à géocoder.
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
            const newLatLng = [parseFloat(lat), parseFloat(lon)];
            adFormMap.setView(newLatLng, 15);
            adFormMarker.setLatLng(newLatLng);
            updateLocationFields(newLatLng[0], newLatLng[1]);
            document.getElementById('ad-location-address').value = display_name;
        }
    } catch (error) {
        console.error("Erreur de géocodage:", error);
    }
}

/**
 * Trouve l'adresse correspondant à des coordonnées (géocodage inversé).
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 */
async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.display_name) {
            document.getElementById('ad-location-address').value = data.display_name;
        }
    } catch (error) {
        console.error("Erreur de géocodage inversé:", error);
    }
}

/**
 * Met à jour les champs cachés de latitude et longitude.
 */
function updateLocationFields(lat, lng) {
    document.getElementById('ad-lat').value = lat;
    document.getElementById('ad-lng').value = lng;
}

/**
 * Gère la sélection de fichiers image et affiche les aperçus.
 * @param {Event} event - L'événement de changement du champ de fichier.
 */
function handleImageSelection(event) {
    const previewContainer = document.getElementById('ad-image-previews-container');
    imageFiles = Array.from(event.target.files).slice(0, 5);
    previewContainer.innerHTML = ''; // Vide les anciens aperçus
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `<img src="${e.target.result}" alt="${file.name}">`;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Gère la soumission du formulaire de création/édition d'annonce.
 * @param {Event} e - L'événement de soumission.
 */
async function handleAdFormSubmit(e) {
    e.preventDefault();
    if (!validateForm(e.target).isValid) return;

    const { currentUser } = getState();
    if (!currentUser) return showToast("Session expirée, veuillez vous reconnecter.", "error");

    showGlobalLoader(isEditMode ? "Mise à jour..." : "Publication...");

    try {
        const formData = new FormData(e.target);
        const adId = formData.get('adId');

        let imageUrls = [];
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

        if (imageUrls.length > 0) {
            adData.images = imageUrls;
        } else if (isEditMode) {
            const existingAd = await fetchAdById(adId, false);
            adData.images = existingAd.images || [];
        }

        if (isEditMode && adId) {
            await updateAd(adId, adData);
            showToast("Annonce modifiée avec succès !", "success");
        } else {
            await createAd(adData);
            showToast("Annonce publiée !", "success");
        }

        closeModal('ad-form-modal');
        loadAndDisplayAds();
    } catch (error) {
        console.error("Erreur formulaire annonce:", error);
        showToast(error.message || "Erreur de soumission.", "error");
    } finally {
        hideGlobalLoader();
    }
}