/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'INTERFACE (ui.js)
 * =================================================================
 */

import { getState, subscribe } from './state.js';
import { handleLogout, handleLogin, handleSignUp, handlePasswordReset, handleUpdatePassword } from './auth.js';
import { validateForm, showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';
import { openAdForm } from './ad-manager.js';
import { updateUserProfile, uploadAvatar, fetchUserAds, deleteAd } from './services.js';
import { updateProfile as updateAuthProfile } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from './firebase.js';

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

    const adList = document.getElementById('my-ads-list');
    adList.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-my-ad-btn');
        const deleteBtn = e.target.closest('.delete-my-ad-btn');

        if (editBtn) {
            const adId = editBtn.closest('.my-ad-item').dataset.adId;
            closeModal('my-ads-modal');
            openAdForm(adId);
        }

        if (deleteBtn) {
            const adItem = deleteBtn.closest('.my-ad-item');
            const adId = adItem.dataset.adId;
            const adTitle = adItem.querySelector('.item-title').textContent;
            
            showConfirmationModal(`Voulez-vous vraiment supprimer l'annonce "${adTitle}" ?`, async () => {
                showGlobalLoader("Suppression de l'annonce...");
                try {
                    await deleteAd(adId);
                    showToast("Annonce supprimée.", "success");
                    adItem.remove();
                } catch (error) {
                    showToast("Erreur lors de la suppression.", "error");
                } finally {
                    hideGlobalLoader();
                }
            });
        }
    });
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
        showToast("Profil mis à jour avec succès !", "success");
        toggleProfileEditMode(false);
        const updatedProfile = await fetchUserProfile(currentUser.uid);
        setState({ userProfile: updatedProfile });
        
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

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const close = () => closeModal('confirmation-modal');
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        close();
    });
    
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

    authModal.querySelectorAll('.auth-form, .auth-view, .modal-title').forEach(el => el.classList.add('hidden'));
    
    const viewMap = {
        login: { viewId: 'login-form', titleId: 'auth-modal-title-login' },
        signup: { viewId: 'signup-form', titleId: 'auth-modal-title-signup' },
        reset: { viewId: 'reset-password-form', titleId: 'auth-modal-title-reset' },
        'email-validation-view': { viewId: 'email-validation-view', titleId: 'auth-modal-title-validate-email' }
    };

    const target = viewMap[viewName];
    if (target) {
        document.getElementById(target.viewId)?.classList.remove('hidden');
        document.getElementById(target.titleId)?.classList.remove('hidden');
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
        profileAvatar.src = 'https://placehold.co/32x32/e0e0e0/757575?text=U';
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
        modalId = 'auth-modal';
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;
    
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

    if (modalId === 'ad-form-modal') {
        setTimeout(() => {
            if (window.adFormMap) {
                window.adFormMap.invalidateSize();
            }
        }, 10);
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