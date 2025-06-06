/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'INTERFACE (ui.js)
 * =================================================================
 * @file Ce fichier gère toutes les manipulations du DOM, l'ouverture et la fermeture
 * des modales, et les mises à jour visuelles en réponse aux actions de l'utilisateur
 * et aux changements d'état de l'application.
 * @version 2.0.0
 */

import { getState, subscribe } from './state.js';
import { handleLogout, handleLogin, handleSignUp, handlePasswordReset, handleResendVerificationEmail } from './auth.js';
import { validateForm } from './utils.js';

// On garde une référence aux éléments importants pour ne pas les chercher à chaque fois.
const authModal = document.getElementById('auth-modal');

/**
 * Initialise tous les gestionnaires d'événements de l'UI.
 * C'est la fonction de démarrage pour ce module.
 */
export function initUIManager() {
    // S'abonne aux changements d'état pour mettre à jour l'UI en conséquence.
    subscribe(updateUIOnStateChange);

    // Gère l'ouverture et la fermeture de toutes les modales.
    setupModalTriggers();

    // Gère la logique interne de la modale d'authentification (changement de vue).
    setupAuthModal();
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
 * **IMPLÉMENTATION COMPLÈTE**
 * Met en place toute la logique pour la modale d'authentification :
 * - Les clics sur les liens pour changer de vue (inscription, mdp oublié).
 * - La soumission des formulaires.
 */
function setupAuthModal() {
    if (!authModal) return;

    // Écouteurs pour les liens qui changent de vue
    authModal.querySelectorAll('[data-auth-view-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.authViewTarget;
            switchAuthView(viewName);
        });
    });

    // Écouteurs pour la soumission des formulaires
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const resetForm = document.getElementById('reset-password-form');
    
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(loginForm).isValid) return;
        const email = loginForm.elements['login-email'].value;
        const password = loginForm.elements['login-password'].value;
        const result = await handleLogin(email, password);
        if (result.success) closeModal('auth-modal');
    });

    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(signupForm).isValid) return;
        const email = signupForm.elements['signup-email'].value;
        const password = signupForm.elements['signup-password'].value;
        const username = signupForm.elements['signup-name'].value;
        const result = await handleSignUp(email, password, username);
        if (result.success) switchAuthView('validate-email');
    });

    resetForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(resetForm).isValid) return;
        const email = resetForm.elements['reset-email'].value;
        await handlePasswordReset(email);
    });

    document.getElementById('resend-validation-email-btn')?.addEventListener('click', handleResendVerificationEmail);
}

/**
 * Bascule entre les différentes vues de la modale d'authentification.
 * @param {'login' | 'signup' | 'reset' | 'validate-email'} viewName Le nom de la vue à afficher.
 */
function switchAuthView(viewName) {
    if (!authModal) return;

    // Cache toutes les vues et tous les titres
    authModal.querySelectorAll('.auth-form, .auth-view').forEach(view => view.classList.add('hidden'));
    authModal.querySelectorAll('.modal-title').forEach(title => title.classList.add('hidden'));
    
    // Affiche la vue et le titre correspondants
    const viewToShow = authModal.querySelector(`#${viewName}-form`) || authModal.querySelector(`#${viewName}-view`);
    const titleToShow = authModal.querySelector(`#auth-modal-title-${viewName}`);
    
    viewToShow?.classList.remove('hidden');
    titleToShow?.classList.remove('hidden');

    // Met à jour l'état de la modale
    authModal.dataset.currentView = viewName;
    
    // Gère les liens du pied de page
    const switchToSignupBtn = document.getElementById('auth-switch-to-signup-btn');
    const switchToLoginBtn = document.getElementById('auth-switch-to-login-btn');

    if (viewName === 'login') {
        switchToSignupBtn?.classList.remove('hidden');
        switchToLoginBtn?.classList.add('hidden');
    } else { // pour signup, reset, etc.
        switchToSignupBtn?.classList.add('hidden');
        switchToLoginBtn?.classList.remove('hidden');
    }

    if (viewName === 'validate-email') {
        const emailAddressSpan = document.getElementById('validation-email-address');
        const signupEmailInput = document.getElementById('signup-email');
        if (emailAddressSpan && signupEmailInput) {
            emailAddressSpan.textContent = signupEmailInput.value;
        }
    }
}


/**
 * La fonction principale qui met à jour l'UI en fonction de l'état global.
 */
function updateUIOnStateChange({ isLoggedIn, userProfile }) {
    const profileBtn = document.getElementById('header-profile-btn');
    const profileAvatar = document.getElementById('header-profile-avatar');

    if (isLoggedIn && userProfile) {
        profileBtn.setAttribute('data-user-logged-in', 'true');
        profileAvatar.src = userProfile.avatarUrl || `https://placehold.co/32x32/4f46e5/ffffff?text=${userProfile.username.charAt(0).toUpperCase()}`;
        profileAvatar.alt = `Profil de ${userProfile.username}`;
        profileBtn.onclick = () => openModal('profile-modal');
    } else {
        profileBtn.setAttribute('data-user-logged-in', 'false');
        profileAvatar.src = 'https://placehold.co/32x32/e0e0e0/757575?text=User';
        profileAvatar.alt = 'Se connecter';
        profileBtn.onclick = () => openModal('auth-modal');
    }
}

// --- Fonctions d'ouverture/fermeture exportées si besoin ---

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.modal-overlay[aria-hidden="false"]')) {
            document.body.classList.remove('modal-open');
        }
    }
}
