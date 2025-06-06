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
window.adFormMap = null; // CORRECTION: Exposer la carte globalement pour `invalidateSize`
let adFormMarker = null;

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

export async function openAdForm(adId = null) {
    const { isLoggedIn, allCategories } = getState();
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
        adData = await fetchAdById(adId);
        if (adData) {
            populateFormForEdit(adData);
            if (adData.location?.coordinates) {
                initialCoords = [adData.location.coordinates.latitude, adData.location.coordinates.longitude];
            }
        }
        hideGlobalLoader();
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Publier une Annonce`;
        submitButton.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publier l'annonce`;
        document.getElementById('ad-id').value = '';
    }
    
    // CORRECTION : On passe les catégories et la valeur sélectionnée à la fonction d'ouverture de la modale
    openModal('ad-form-modal');
    
    initAdFormMap(initialCoords);
    if(adData) {
        document.querySelector('#ad-category').value = adData.categoryId;
    }
}

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
 * CORRECTION : Logique de la carte améliorée.
 */
function initAdFormMap(center) {
    const mapContainerId = 'ad-form-map-preview';
    if (window.adFormMap) {
        window.adFormMap.setView(center, 13);
        adFormMarker.setLatLng(center);
    } else {
        window.adFormMap = L.map(mapContainerId, { zoomControl: true, scrollWheelZoom: false }).setView(center, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window.adFormMap);
        
        // Création du marqueur draggable
        adFormMarker = L.marker(center, { draggable: true }).addTo(window.adFormMap);

        // Mise à jour des champs lors du déplacement
        adFormMarker.on('dragend', function(e) {
            const { lat, lng } = e.target.getLatLng();
            updateLocationFields(lat, lng);
            reverseGeocode(lat, lng); // Met à jour le champ d'adresse
        });
        
        // Mise à jour en cliquant sur la carte
        window.adFormMap.on('click', (e) => {
            adFormMarker.setLatLng(e.latlng);
            updateLocationFields(e.latlng.lat, e.latlng.lng);
            reverseGeocode(e.latlng.lat, e.latlng.lng);
        });
    }
    updateLocationFields(center[0], center[1]);
}

function handleUseCurrentLocation() {
    if (!window.adFormMap) return;
    if (!navigator.geolocation) return showToast("La géolocalisation n'est pas supportée.", "error");

    showGlobalLoader("Recherche de votre position...");
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        const newLatLng = [latitude, longitude];
        
        window.adFormMap.setView(newLatLng, 16);
        adFormMarker.setLatLng(newLatLng);
        updateLocationFields(latitude, longitude);
        reverseGeocode(latitude, longitude);
        
        hideGlobalLoader();
        showToast("Position mise à jour !", "success");
    }, error => {
        hideGlobalLoader();
        showToast("Impossible d'obtenir votre position.", "error");
    });
}

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
            window.adFormMap.setView(newLatLng, 15);
            adFormMarker.setLatLng(newLatLng);
            updateLocationFields(newLatLng[0], newLatLng[1]);
            document.getElementById('ad-location-address').value = display_name;
        }
    } catch (error) {
        console.error("Erreur de géocodage:", error);
    }
}

/**
 * AJOUT : Trouve l'adresse correspondant à des coordonnées.
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


function updateLocationFields(lat, lng) {
    document.getElementById('ad-lat').value = lat;
    document.getElementById('ad-lng').value = lng;
}

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
            // Conserve les anciennes images si aucune nouvelle n'est uploadée
            const existingAd = await fetchAdById(adId, false); // false pour ne pas incrémenter les vues
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