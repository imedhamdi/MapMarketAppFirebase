/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'INTERFACE (ui.js)
 * =================================================================
 * @file Gère l'initialisation de l'UI, les modales, les formulaires
 * et les mises à jour visuelles basées sur l'état de l'application.
 */

import { getState, subscribe, setState } from './state.js';
import { handleLogout, handleLogin, handleSignUp, handlePasswordReset, handleUpdatePassword } from './auth.js';
import { validateForm, showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';
import { openAdForm, invalidateAdFormMapSize } from './ad-manager.js';
import { updateUserProfile, uploadAvatar, fetchUserAds, deleteAd, createOrUpdateAlert, fetchAlerts, deleteAlert as deleteAlertService } from './services.js';
import { updateProfile as updateAuthProfile } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from './firebase.js';
import { fetchUserProfile } from './services.js';
import { loadAndDisplayAds } from './map.js';

let deferredInstallPrompt = null;

/**
 * Initialise tous les gestionnaires d'événements de l'UI.
 */
export function initUIManager() {
    subscribe(updateUIOnStateChange);
    setupModalTriggers();
    setupAuthModal();
    initProfileModal();
    initMoreOptionsMenu();
    initMyAdsModal();
    initPwaInstall();
    initFiltersModal();
    initAlertsModal();
    initSearchBar();
}

/**
 * Gère l'invite d'installation de la PWA.
 */
function initPwaInstall() {
    const installContainer = document.getElementById('pwa-install-prompt-container');
    const installBtn = document.getElementById('pwa-install-accept-btn');
    const dismissBtn = document.getElementById('pwa-install-dismiss-btn');
    const moreInstallBtn = document.getElementById('more-pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        installContainer.classList.remove('hidden');
        moreInstallBtn.classList.remove('hidden');
    });

    const handleInstall = async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('Application installée avec succès !', 'success');
            }
            deferredInstallPrompt = null;
            installContainer.classList.add('hidden');
            moreInstallBtn.classList.add('hidden');
        }
    };

    installBtn.addEventListener('click', handleInstall);
    moreInstallBtn.addEventListener('click', handleInstall);

    dismissBtn.addEventListener('click', () => {
        installContainer.classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
        installContainer.classList.add('hidden');
        moreInstallBtn.classList.add('hidden');
    });
}


/**
 * Gère l'affichage/masquage de la barre de recherche.
 */
function initSearchBar() {
    const showBtn = document.getElementById('header-show-search-btn');
    const closeBtn = document.getElementById('close-search-bar-btn');
    const searchWrapper = document.getElementById('header-search-bar-wrapper');

    showBtn.addEventListener('click', () => searchWrapper.classList.toggle('hidden'));
    closeBtn.addEventListener('click', () => searchWrapper.classList.add('hidden'));
}

/**
 * Initialise la modale des filtres.
 */
function initFiltersModal() {
    const filtersForm = document.getElementById('filters-form');
    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filtersForm);
        const filters = {};
        // Ne conserve que les filtres qui ont une valeur
        for (const [key, value] of formData.entries()) {
            if (value) {
                filters[key] = value;
            }
        }
        
        showGlobalLoader('Application des filtres...');
        loadAndDisplayAds(filters).finally(() => {
            hideGlobalLoader();
            closeModal('filters-modal');
            showToast('Filtres appliqués', 'success');
        });
    });

    filtersForm.addEventListener('reset', () => {
        showGlobalLoader('Réinitialisation...');
        loadAndDisplayAds({}).finally(() => {
            hideGlobalLoader();
            closeModal('filters-modal');
            showToast('Filtres réinitialisés', 'info');
        });
    });
    
    const distanceSlider = document.getElementById('filter-distance');
    const distanceDisplay = document.getElementById('filter-distance-value-display');
    distanceSlider.addEventListener('input', () => {
        distanceDisplay.textContent = `${distanceSlider.value} km`;
    });
}

/**
 * Initialise la modale des alertes.
 */
function initAlertsModal() {
    const alertsModal = document.getElementById('alerts-modal');
    const createFormSection = document.getElementById('create-alert-form-section');
    const showFormBtn = document.getElementById('show-create-alert-form-btn');
    const cancelFormBtn = document.getElementById('cancel-create-alert-btn');
    const alertForm = document.getElementById('create-alert-form');

    alertsModal.addEventListener('modal:open', loadUserAlerts);

    showFormBtn.addEventListener('click', () => {
        alertForm.reset();
        document.getElementById('alert-id').value = '';
        createFormSection.classList.remove('hidden');
        showFormBtn.classList.add('hidden');
    });

    cancelFormBtn.addEventListener('click', () => {
        createFormSection.classList.add('hidden');
        showFormBtn.classList.remove('hidden');
    });

    alertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!validateForm(alertForm).isValid) return;

        const { currentUser } = getState();
        const formData = new FormData(alertForm);
        const alertId = formData.get('alertId') || null;
        const alertData = {
            keywords: formData.get('keywords').split(',').map(kw => kw.trim()).filter(Boolean),
            categoryId: formData.get('category') || null,
            radius: parseInt(formData.get('radius'), 10),
        };

        showGlobalLoader('Sauvegarde de l\'alerte...');
        try {
            await createOrUpdateAlert(currentUser.uid, alertData, alertId);
            showToast(alertId ? 'Alerte modifiée !' : 'Alerte créée !', 'success');
            await loadUserAlerts();
            cancelFormBtn.click();
        } catch (error) {
            showToast("Erreur lors de la sauvegarde de l'alerte.", 'error');
            console.error(error);
        } finally {
            hideGlobalLoader();
        }
    });

    document.getElementById('alert-list').addEventListener('click', async (e) => {
        const { currentUser, userAlerts } = getState();
        const alertItem = e.target.closest('.alert-item');
        if (!alertItem) return;

        const alertId = alertItem.dataset.alertId;

        if(e.target.closest('.edit-alert-btn')) {
            const alertToEdit = (userAlerts || []).find(a => a.id === alertId);
            if(alertToEdit) {
                document.getElementById('alert-id').value = alertToEdit.id;
                document.getElementById('alert-keywords').value = alertToEdit.keywords.join(', ');
                document.getElementById('alert-category').value = alertToEdit.categoryId || '';
                document.getElementById('alert-radius').value = alertToEdit.radius;
                createFormSection.classList.remove('hidden');
                showFormBtn.classList.add('hidden');
            }
        }

        if(e.target.closest('.delete-alert-btn')) {
            showConfirmationModal('Voulez-vous vraiment supprimer cette alerte ?', async () => {
                showGlobalLoader('Suppression...');
                try {
                    await deleteAlertService(currentUser.uid, alertId);
                    showToast('Alerte supprimée.', 'success');
                    await loadUserAlerts(); // Recharger la liste
                } catch(error) {
                    showToast('Erreur de suppression.', 'error');
                } finally {
                    hideGlobalLoader();
                }
            });
        }
    });
}

/**
 * Gère l'ouverture/fermeture générique des modales.
 */
function setupModalTriggers() {
    document.addEventListener('click', (e) => {
        const modalControl = e.target.closest('[aria-controls]');
        if (modalControl) {
            e.preventDefault();
            openModal(modalControl.getAttribute('aria-controls'));
        }

        const dismissControl = e.target.closest('[data-dismiss-modal]');
        if (dismissControl) {
            e.preventDefault();
            closeModal(dismissControl.getAttribute('data-dismiss-modal'));
        }

        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModalEl = document.querySelector('.modal-overlay[aria-hidden="false"]');
            if (openModalEl) closeModal(openModalEl.id);
        }
    });
}

/**
 * Initialise les actions du menu "Plus"
 */
function initMoreOptionsMenu() {
    document.getElementById('more-profile-btn')?.addEventListener('click', () => openModal('profile-modal'));
    document.getElementById('more-my-ads-btn')?.addEventListener('click', () => openModal('my-ads-modal'));
    document.getElementById('more-alerts-btn')?.addEventListener('click', () => openModal('alerts-modal'));
    document.getElementById('more-logout-btn')?.addEventListener('click', handleLogout);
}

/**
 * Initialise la modale "Mes Annonces"
 */
function initMyAdsModal() {
    const myAdsModal = document.getElementById('my-ads-modal');
    myAdsModal.addEventListener('modal:open', loadUserAds);

    // Bouton pour publier une annonce depuis la modale vide
    document.getElementById('my-ads-publish-new-btn')?.addEventListener('click', () => {
        closeModal('my-ads-modal');
        openAdForm();
    });

    const adList = document.getElementById('my-ads-list');
    adList.addEventListener('click', e => {
        const adItem = e.target.closest('.my-ad-item');
        if (!adItem) return;

        const adId = adItem.dataset.adId;
        
        if (e.target.closest('.edit-my-ad-btn')) {
            closeModal('my-ads-modal');
            openAdForm(adId);
        }

        if (e.target.closest('.delete-my-ad-btn')) {
            const adTitle = adItem.querySelector('.item-title').textContent;
            
            showConfirmationModal(`Voulez-vous vraiment supprimer l'annonce "${adTitle}" ?`, async () => {
                showGlobalLoader("Suppression de l'annonce...");
                try {
                    await deleteAd(adId);
                    showToast("Annonce supprimée.", "success");
                    adItem.remove(); // Suppression visuelle immédiate
                } catch (error) {
                    showToast("Erreur lors de la suppression.", "error");
                } finally {
                    hideGlobalLoader();
                }
            });
        }
    });
}

async function loadUserAlerts() {
    const { currentUser } = getState();
    if (!currentUser) return;
    const listEl = document.getElementById('alert-list');
    const placeholder = document.getElementById('no-alerts-placeholder');
    listEl.innerHTML = '';
    
    try {
        const alerts = await fetchAlerts(currentUser.uid);
        setState({ userAlerts: alerts }); // Met en cache les alertes
        placeholder.classList.toggle('hidden', alerts.length > 0);
        
        const template = document.getElementById('alert-item-template');
        const { allCategories } = getState();

        alerts.forEach(alert => {
            const item = template.content.cloneNode(true).firstElementChild;
            item.dataset.alertId = alert.id;
            item.querySelector('.alert-keywords span').textContent = alert.keywords.join(', ');
            const categoryName = allCategories.find(c => c.id === alert.categoryId)?.name_fr || 'Toutes';
            item.querySelector('.alert-category span').textContent = categoryName;
            item.querySelector('.alert-radius span').textContent = `${alert.radius} km`;
            listEl.appendChild(item);
        });
    } catch (error) {
        console.error("Erreur chargement des alertes:", error);
    }
}


/**
 * Charge et affiche les annonces de l'utilisateur connecté.
 */
async function loadUserAds() {
    const { currentUser } = getState();
    if (!currentUser) return;

    const listEl = document.getElementById('my-ads-list');
    const loader = document.getElementById('my-ads-loader');
    const placeholder = document.getElementById('no-my-ads-placeholder');
    
    listEl.innerHTML = '';
    loader.classList.remove('hidden');
    placeholder.classList.add('hidden');

    try {
        const ads = await fetchUserAds(currentUser.uid);
        if (ads.length === 0) {
            placeholder.classList.remove('hidden');
        } else {
            const template = document.getElementById('my-ad-item-template');
            ads.forEach(ad => {
                const item = template.content.cloneNode(true).firstElementChild;
                item.dataset.adId = ad.id;
                item.querySelector('.item-image').src = ad.images?.[0] || 'https://placehold.co/80x80';
                item.querySelector('.item-title').textContent = ad.title;
                item.querySelector('.item-price').textContent = `${ad.price} €`;
                item.querySelector('.item-date').textContent = `Publiée le: ${new Date(ad.createdAt.seconds * 1000).toLocaleDateString()}`;
                const statusBadge = item.querySelector('.item-status .status-badge');
                statusBadge.textContent = ad.status === 'active' ? 'Active' : 'Inactive';
                statusBadge.className = `status-badge status-${ad.status}`;
                item.querySelector('.view-my-ad-btn').dataset.id = ad.id;
                listEl.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Erreur chargement de mes annonces:", error);
        showToast("Impossible de charger vos annonces.", "error");
    } finally {
        loader.classList.add('hidden');
    }
}


/**
 * Initialise la modale de profil
 */
function initProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    const profileForm = document.getElementById('profile-form');
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-profile-btn');
    const avatarInput = document.getElementById('avatar-upload-input');
    const avatarContainer = document.getElementById('avatar-preview-container');

    profileModal.addEventListener('modal:open', populateProfileForm);
    editBtn.addEventListener('click', () => toggleProfileEditMode(true));
    cancelBtn.addEventListener('click', () => {
        toggleProfileEditMode(false);
        populateProfileForm();
    });

    profileForm.addEventListener('submit', handleProfileFormSubmit);

    avatarContainer.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', handleAvatarChange);
}


/**
 * Active ou désactive le mode édition du profil
 */
function toggleProfileEditMode(isEditing) {
    const nameInput = document.getElementById('profile-name');
    nameInput.readOnly = !isEditing;
    nameInput.classList.toggle('editable', isEditing);

    document.getElementById('profile-edit-actions').classList.toggle('hidden', !isEditing);
    document.getElementById('edit-profile-btn').classList.toggle('hidden', isEditing);
}

/**
 * Peuple le formulaire de profil avec les données de l'état
 */
function populateProfileForm() {
    const { userProfile } = getState();
    if (!userProfile) return;

    document.getElementById('profile-avatar-img').src = userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.username)}&background=4f46e5&color=fff`;
    document.getElementById('profile-name').value = userProfile.username;
    document.getElementById('profile-email').value = userProfile.email;
    
    document.getElementById('stats-ads-published').textContent = userProfile.stats?.adsCount || 0;
    document.getElementById('stats-favorites-count').textContent = userProfile.stats?.favoritesCount || 0;
    document.getElementById('stats-avg-rating').textContent = userProfile.stats?.averageRating?.toFixed(1) || 'N/A';
}

/**
 * Gère la soumission du formulaire de profil
 */
async function handleProfileFormSubmit(e) {
    e.preventDefault();
    if (!validateForm(e.target).isValid) return;

    const { currentUser } = getState();
    const newUsername = document.getElementById('profile-name').value;
    const newPassword = document.getElementById('profile-new-password').value;

    showGlobalLoader("Mise à jour du profil...");

    try {
        const promises = [];
        if (newUsername !== auth.currentUser.displayName) {
            promises.push(updateAuthProfile(currentUser, { displayName: newUsername }));
            promises.push(updateUserProfile(currentUser.uid, { username: newUsername }));
        }
        if (newPassword) {
            promises.push(handleUpdatePassword(newPassword));
        }

        await Promise.all(promises);
        
        // Rafraîchir le profil depuis la source de vérité (Firestore)
        const updatedProfile = await fetchUserProfile(currentUser.uid);
        setState({ userProfile: updatedProfile });
        
        showToast("Profil mis à jour avec succès !", "success");
        toggleProfileEditMode(false);
        
    } catch (error) {
        showToast("Erreur lors de la mise à jour.", "error");
        console.error(error);
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Gère le changement et l'upload de l'avatar
 */
async function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const { currentUser } = getState();
    showGlobalLoader("Téléchargement de l'avatar...");
    try {
        const avatarUrl = await uploadAvatar(file, currentUser.uid);
        await updateUserProfile(currentUser.uid, { avatarUrl });
        
        const updatedProfile = await fetchUserProfile(currentUser.uid);
        setState({ userProfile: updatedProfile });
        
        showToast("Avatar mis à jour !", "success");
    } catch (error) {
        showToast("Erreur lors du changement d'avatar.", "error");
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Ouvre une modale de confirmation générique.
 */
function showConfirmationModal(message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const messageEl = document.getElementById('confirmation-modal-message');
    const confirmBtn = document.getElementById('confirm-action-btn');

    messageEl.textContent = message;

    // Clonage pour purger les anciens écouteurs
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const close = () => closeModal('confirmation-modal');
    
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        close();
    }, { once: true });
    
    openModal('confirmation-modal');
}


function setupAuthModal() {
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    authModal.querySelectorAll('[data-auth-view-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthView(link.dataset.authViewTarget);
        });
    });

    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(loginForm).isValid) return;
        const result = await handleLogin(loginForm.elements['login-email'].value, loginForm.elements['login-password'].value);
        if (result.success) closeModal('auth-modal');
    });
    
    const signupForm = document.getElementById('signup-form');
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(signupForm).isValid) return;
        const result = await handleSignUp(signupForm.elements['signup-email'].value, signupForm.elements['signup-password'].value, signupForm.elements['signup-name'].value);
        if (result.success) switchAuthView('email-validation-view');
    });

    const resetForm = document.getElementById('reset-password-form');
    resetForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(resetForm).isValid) return;
        const result = await handlePasswordReset(resetForm.elements['reset-email'].value);
        if (result.success) switchAuthView('login');
    });
}

function switchAuthView(viewName) {
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;
    
    const views = authModal.querySelectorAll('.auth-form, .auth-view');
    const titles = authModal.querySelectorAll('.modal-title');
    const footerLinks = authModal.querySelectorAll('.auth-switch-link');

    views.forEach(el => el.classList.add('hidden'));
    titles.forEach(el => el.classList.add('hidden'));
    footerLinks.forEach(el => el.classList.add('hidden'));
    
    const viewMap = {
        login: { viewId: 'login-form', titleId: 'auth-modal-title-login', footerId: 'auth-switch-to-signup-btn' },
        signup: { viewId: 'signup-form', titleId: 'auth-modal-title-signup', footerId: 'auth-switch-to-login-btn' },
        reset: { viewId: 'reset-password-form', titleId: 'auth-modal-title-reset', footerId: 'auth-switch-to-login-btn' },
        'email-validation-view': { viewId: 'email-validation-view', titleId: 'auth-modal-title-validate-email', footerId: 'auth-switch-to-login-btn' }
    };

    const target = viewMap[viewName];
    if (target) {
        document.getElementById(target.viewId)?.classList.remove('hidden');
        document.getElementById(target.titleId)?.classList.remove('hidden');
        document.getElementById(target.footerId)?.classList.remove('hidden');
    }
}

function updateUIOnStateChange({ isLoggedIn, userProfile }) {
    const profileBtn = document.getElementById('header-profile-btn');
    const profileAvatar = document.getElementById('header-profile-avatar');

    if (isLoggedIn && userProfile) {
        profileBtn.setAttribute('data-user-logged-in', 'true');
        profileAvatar.src = userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.username)}&background=4f46e5&color=fff`;
        profileAvatar.alt = `Profil de ${userProfile.username}`;
    } else {
        profileBtn.setAttribute('data-user-logged-in', 'false');
        profileAvatar.src = 'avatar-default.svg';
        profileAvatar.alt = 'Se connecter';
    }
}

function populateCategoryDropdowns(selectElement, categories, selectedValue = null) {
    if (!selectElement || !categories) return;
    
    const currentFirstOptionHTML = selectElement.options[0].outerHTML;
    selectElement.innerHTML = currentFirstOptionHTML;

    categories.forEach(cat => {
        const option = new Option(cat.name_fr, cat.id);
        selectElement.appendChild(option);
    });

    if (selectedValue) {
        selectElement.value = selectedValue;
    }
}

export function openModal(modalId) {
    const { isLoggedIn, allCategories } = getState();

    const protectedModals = ['profile-modal', 'my-ads-modal', 'ad-form-modal', 'alerts-modal', 'messages-modal', 'favorites-modal'];
    if (protectedModals.includes(modalId) && !isLoggedIn) {
        showToast("Veuillez vous connecter pour accéder à cette section.", "warning");
        modalId = 'auth-modal'; // Redirige vers la connexion
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Remplissage dynamique des listes déroulantes de catégories
    if (allCategories.length > 0) {
        if (modalId === 'ad-form-modal') {
            populateCategoryDropdowns(modal.querySelector('#ad-category'), allCategories);
        } else if (modalId === 'alerts-modal') {
             populateCategoryDropdowns(modal.querySelector('#alert-category'), allCategories);
        } else if (modalId === 'filters-modal') {
             populateCategoryDropdowns(modal.querySelector('#filter-category'), allCategories);
        }
    }
    
    if (modalId === 'auth-modal') switchAuthView('login');

    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    
    modal.dispatchEvent(new CustomEvent('modal:open'));

    // Correction pour la carte dans la modale d'annonce
    if (modalId === 'ad-form-modal') {
        invalidateAdFormMapSize();
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.dispatchEvent(new CustomEvent('modal:close'));
        if (!document.querySelector('.modal-overlay[aria-hidden="false"]')) {
            document.body.classList.remove('modal-open');
        }
    }
}