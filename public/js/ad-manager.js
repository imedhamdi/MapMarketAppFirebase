/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'ANNONCES (ad-manager.js)
 * =================================================================
 * @file Ce fichier gère :
 * 1. La logique du formulaire de création/édition d'annonces.
 * 2. Le chargement paginé et l'affichage de la liste des annonces.
 */

// Imports pour la gestion du formulaire
import { showToast, showGlobalLoader, hideGlobalLoader, validateForm } from './utils.js';
import { openModal, closeModal } from './ui.js';
// Assurez-vous que 'db' et 'GeoPoint' sont bien exportés depuis firebase.js
import { db, GeoPoint } from './firebase.js'; 
import { createAd, updateAd, uploadAdImage, fetchAdById } from './services.js';
import { getState } from './state.js';

// =================================================================
// SECTION 1 : LOGIQUE DU FORMULAIRE DE CRÉATION/ÉDITION
// =================================================================

let imageFiles = [];
let isEditMode = false;
let adFormMap = null;
let adFormMarker = null;

export function invalidateAdFormMapSize() {
    if (adFormMap) {
        setTimeout(() => adFormMap.invalidateSize(), 10);
    }
}

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
        adData = await fetchAdById(adId, false);
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

function handleUseCurrentLocation() {
    if (!adFormMap) return;
    if (!navigator.geolocation) return showToast("La géolocalisation n'est pas supportée.", "error");
    showGlobalLoader("Recherche de votre position...");
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        adFormMap.setView([latitude, longitude], 16);
        adFormMarker.setLatLng([latitude, longitude]);
        updateLocationFields(latitude, longitude);
        reverseGeocode(latitude, longitude);
        hideGlobalLoader();
        showToast("Position mise à jour !", "success");
    }, () => {
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
            adFormMap.setView(newLatLng, 15);
            adFormMarker.setLatLng(newLatLng);
            updateLocationFields(newLatLng[0], newLatLng[1]);
            document.getElementById('ad-location-address').value = display_name;
        }
    } catch (error) {
        console.error("Erreur de géocodage:", error);
    }
}

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
    previewContainer.innerHTML = '';
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
            const uploadPromises = imageFiles.map(file => uploadAdImage(file, currentUser.uid, adId));
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
        // MODIFICATION : On appelle loadInitialAds pour recharger la liste depuis le début.
        loadInitialAds(); 
    } catch (error) {
        console.error("Erreur formulaire annonce:", error);
        showToast(error.message || "Erreur de soumission.", "error");
    } finally {
        hideGlobalLoader();
    }
}


// =================================================================
// SECTION 2 : LOGIQUE DE CHARGEMENT ET D'AFFICHAGE DE LA LISTE
// =================================================================

let lastVisibleAd = null;
let isLoading = false;
const ADS_PER_PAGE = 10;

const adListContainer = document.getElementById('ad-list-container');
const loadMoreButton = document.getElementById('load-more-btn');

/**
 * Charge la première page d'annonces ou recharge à partir de zéro.
 */
export async function loadInitialAds() {
    if (isLoading) return;
    isLoading = true;
    lastVisibleAd = null; 
    if(adListContainer) adListContainer.innerHTML = ''; 
    
    console.log('Loading initial ads...');

    try {
        const query = db.collection('ads')
            .orderBy('createdAt', 'desc')
            .limit(ADS_PER_PAGE);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            if(adListContainer) adListContainer.innerHTML = '<p>Aucune annonce trouvée.</p>';
            if(loadMoreButton) loadMoreButton.style.display = 'none';
        } else {
            const ads = snapshot.docs;
            lastVisibleAd = ads[ads.length - 1];
            displayAds(ads);
            if(loadMoreButton) loadMoreButton.style.display = 'block';
        }
    } catch (error) {
        console.error("Error loading initial ads:", error);
        if(adListContainer) adListContainer.innerHTML = '<p>Erreur lors du chargement des annonces.</p>';
    } finally {
        isLoading = false;
    }
}

/**
 * Charge la page suivante d'annonces.
 */
async function loadMoreAds() {
    if (isLoading || !lastVisibleAd) return;
    isLoading = true;
    if(loadMoreButton) loadMoreButton.textContent = 'Chargement...';

    console.log('Loading more ads...');
    
    try {
        const query = db.collection('ads')
            .orderBy('createdAt', 'desc')
            .startAfter(lastVisibleAd)
            .limit(ADS_PER_PAGE);

        const snapshot = await query.get();

        if (snapshot.empty) {
            if(loadMoreButton) loadMoreButton.style.display = 'none';
            console.log("No more ads to load.");
        } else {
            const ads = snapshot.docs;
            lastVisibleAd = ads[ads.length - 1];
            displayAds(ads);
        }
    } catch (error) {
        console.error("Error loading more ads:", error);
    } finally {
        isLoading = false;
        if(loadMoreButton) loadMoreButton.textContent = 'Charger plus';
    }
}

/**
 * Fonction d'affichage des annonces (à adapter à votre HTML)
 * @param {Array<object>} docs - Les documents d'annonces de Firestore.
 */
function displayAds(docs) {
    if(!adListContainer) return;

    docs.forEach(doc => {
        const ad = doc.data();
        const adElement = document.createElement('div');
        adElement.className = 'ad-card'; // Assurez-vous d'avoir ce style dans votre CSS
        adElement.innerHTML = `
            <img src="${(ad.images && ad.images.length > 0) ? ad.images[0] : './assets/placeholder.jpg'}" alt="${ad.title}">
            <h3>${ad.title}</h3>
            <p class="price">${ad.price} €</p>
            <p class="location">${ad.location?.address || 'Lieu non spécifié'}</p>
        `;
        adElement.addEventListener('click', () => {
            // Redirigez vers la page de détail de l'annonce
            window.location.href = `/ad-detail.html?id=${doc.id}`;
        });
        adListContainer.appendChild(adElement);
    });
}

// L'initialisation de la liste se fait désormais dans votre fichier principal (ex: main.js)
// où vous appelez loadInitialAds() et initAdManager() après le chargement du DOM.
// Exemple pour main.js :
// import { initAdManager, loadInitialAds } from './ad-manager.js';
// document.addEventListener('DOMContentLoaded', () => {
//     initAdManager();
//     loadInitialAds();
//     document.getElementById('load-more-btn')?.addEventListener('click', loadMoreAds);
// });