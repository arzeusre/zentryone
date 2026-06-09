/**
 * app.js
 * Controlador principal del Sentinel Vault.
 * Gestiona el estado de la aplicación, interacción de UI, modales y lógica del negocio.
 */

import { Storage } from './storage.js';
import { GDrive } from './gdrive.js';

// ESTADO GLOBAL EN MEMORIA
let vault = { accounts: [] };
let selectedAccountId = null;
let activeCategory = 'all';
let activeWorkspaceId = 'default'; // Espacio de trabajo activo
let activeSecurityFilter = null; // Filtro del Dashboard de Auditoría ('reused', 'weak', 'expired')
let clipboardTimer = null; // Temporizador para auto-limpiar portapapeles
let autoLockTimer = null;
const AUTO_LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutos de inactividad

// Variables de edición de categorías
let selectedCategoryIcon = '';
let selectedCategoryColor = '';

// Variable temporal para guardar los datos del formulario mientras se solicita el motivo
let pendingAccountSaveData = null;

// Variables de ordenamiento por arrastre (drag-and-drop)
let draggedAccountId = null;
let draggedCategoryId = null;
let draggedElement = null;

// ELEMENTOS DOM
const dom = {
  // Contenedores principales
  unlockContainer: document.getElementById('unlock-container'),
  appContainer: document.getElementById('app-container'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  toastProgress: document.getElementById('toast-progress'),

  // Zentry One Multiusuario Auth Panels y Formularios
  authLoginPanel: document.getElementById('auth-login-panel'),
  authRegisterPanel: document.getElementById('auth-register-panel'),
  authRecoveryPanel: document.getElementById('auth-recovery-panel'),
  recoveryKeyDisplayPanel: document.getElementById('recovery-key-display-panel'),
  
  authLoginForm: document.getElementById('auth-login-form'),
  authLoginUsername: document.getElementById('auth-login-username'),
  authLoginPassword: document.getElementById('auth-login-password'),
  toggleLoginPassword: document.getElementById('toggle-login-password'),
  btnGoToRegister: document.getElementById('btn-go-to-register'),
  btnGoToRecovery: document.getElementById('btn-go-to-recovery'),
  
  authRegisterForm: document.getElementById('auth-register-form'),
  authRegisterUsername: document.getElementById('auth-register-username'),
  authRegisterPassword: document.getElementById('auth-register-password'),
  authRegisterConfirm: document.getElementById('auth-register-confirm'),
  toggleRegisterPassword: document.getElementById('toggle-register-password'),
  btnToggleRegisterGenerator: document.getElementById('btn-toggle-register-generator'),
  registerGeneratorPanel: document.getElementById('register-generator-panel'),
  registerGenPasswordPreview: document.getElementById('register-gen-password-preview'),
  btnRegisterRegeneratePassword: document.getElementById('btn-register-regenerate-password'),
  btnRegisterUseGenPassword: document.getElementById('btn-register-use-gen-password'),
  registerGenLengthInput: document.getElementById('register-gen-length'),
  registerGenLengthVal: document.getElementById('register-gen-length-val'),
  registerGenUpper: document.getElementById('register-gen-upper'),
  registerGenLower: document.getElementById('register-gen-lower'),
  registerGenNumbers: document.getElementById('register-gen-numbers'),
  registerGenSymbols: document.getElementById('register-gen-symbols'),
  registerStrengthBar: document.getElementById('register-strength-bar') ? document.getElementById('register-strength-bar').firstElementChild : null,
  registerStrengthText: document.getElementById('register-strength-text'),
  btnGoToLoginFromReg: document.getElementById('btn-go-to-login-from-reg'),
  
  authRecoveryForm: document.getElementById('auth-recovery-form'),
  authRecoveryUsername: document.getElementById('auth-recovery-username'),
  authRecoveryKey: document.getElementById('auth-recovery-key'),
  authRecoveryNewPassword: document.getElementById('auth-recovery-new-password'),
  toggleRecoveryPassword: document.getElementById('toggle-recovery-password'),
  btnGoToLoginFromRec: document.getElementById('btn-go-to-login-from-rec'),
  
  generatedRecoveryKeyText: document.getElementById('generated-recovery-key-text'),
  btnCopyGeneratedRecoveryKey: document.getElementById('btn-copy-generated-recovery-key'),
  btnAckRecoveryKey: document.getElementById('btn-ack-recovery-key'),
  
  migrationAlertBox: document.getElementById('migration-alert-box'),
  btnResetVaultUnlock: document.getElementById('btn-reset-vault-unlock'),

  // Sidebar / Navegación
  btnLockVault: document.getElementById('btn-lock-vault'),
  categoryFilters: document.getElementById('category-filters'),
  btnExportVault: document.getElementById('btn-export-vault'),
  btnImportVaultTrigger: document.getElementById('btn-import-vault-trigger'),
  importVaultFile: document.getElementById('import-vault-file'),
  btnResetVault: document.getElementById('btn-reset-vault'),
  btnNavDashboard: document.getElementById('btn-nav-dashboard'),
  workspaceSelect: document.getElementById('workspace-select'),
  btnManageWorkspaces: document.getElementById('btn-manage-workspaces'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),

  // Listado de cuentas
  searchInput: document.getElementById('search-input'),
  btnAddAccount: document.getElementById('btn-add-account'),
  resultsCount: document.getElementById('results-count'),
  accountsList: document.getElementById('accounts-list'),

  // Panel de detalles
  detailsEmptyState: document.getElementById('details-empty-state'),
  detailsContent: document.getElementById('details-content'),
  detailName: document.getElementById('detail-name'),
  detailCategoryBadge: document.getElementById('detail-category-badge'),
  detailUsername: document.getElementById('detail-username'),
  detailPassword: document.getElementById('detail-password'),
  detailPasswordAge: document.getElementById('detail-password-age'),
  detailUrl: document.getElementById('detail-url'),
  detailNotes: document.getElementById('detail-notes'),
  historyList: document.getElementById('history-list'),

  btnEditAccount: document.getElementById('btn-edit-account'),
  btnDeleteAccount: document.getElementById('btn-delete-account'),
  btnCopyUsername: document.getElementById('btn-copy-username'),
  btnCopyPassword: document.getElementById('btn-copy-password'),
  btnTogglePwdVisibility: document.getElementById('btn-toggle-password-visibility'),
  btnVisitUrl: document.getElementById('btn-visit-url'),
  btnCloseDetails: document.getElementById('btn-close-details'),

  // Modal Formulario de Cuenta
  accountModal: document.getElementById('account-modal'),
  accountForm: document.getElementById('account-form'),
  modalTitle: document.getElementById('modal-title'),
  formAccountId: document.getElementById('form-account-id'),
  formName: document.getElementById('form-name'),
  formCategory: document.getElementById('form-category'),
  formUsername: document.getElementById('form-username'),
  formPassword: document.getElementById('form-password'),
  formUrl: document.getElementById('form-url'),
  formWorkspaceSelect: document.getElementById('form-workspace'),
  formNotes: document.getElementById('form-notes'),
  formStrengthBar: document.getElementById('form-strength-bar') ? document.getElementById('form-strength-bar').firstElementChild : null,
  formStrengthText: document.getElementById('form-strength-text'),
  btnFormPwdToggle: document.getElementById('toggle-form-password'),
  btnCancelModal: document.getElementById('btn-cancel-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),

  // Generador de Contraseñas
  btnToggleGenerator: document.getElementById('btn-toggle-generator'),
  generatorPanel: document.getElementById('generator-panel'),
  genPasswordPreview: document.getElementById('gen-password-preview'),
  btnRegeneratePassword: document.getElementById('btn-regenerate-password'),
  btnUseGenPassword: document.getElementById('btn-use-gen-password'),
  genLengthInput: document.getElementById('gen-length'),
  genLengthVal: document.getElementById('gen-length-val'),
  genUpper: document.getElementById('gen-upper'),
  genLower: document.getElementById('gen-lower'),
  genNumbers: document.getElementById('gen-numbers'),
  genSymbols: document.getElementById('gen-symbols'),

  // Modal Motivo
  reasonModal: document.getElementById('reason-modal'),
  reasonForm: document.getElementById('reason-form'),
  changeReasonInput: document.getElementById('change-reason-input'),

  // Modal Confirmar
  confirmModal: document.getElementById('confirm-modal'),
  confirmTitle: document.getElementById('confirm-modal-title'),
  confirmMessage: document.getElementById('confirm-modal-message'),
  btnConfirmAccept: document.getElementById('btn-confirm-accept'),
  btnConfirmCancel: document.getElementById('btn-confirm-cancel'),

  // Modal Espacios de Trabajo
  workspacesModal: document.getElementById('workspaces-modal'),
  btnCloseWorkspacesModal: document.getElementById('btn-close-workspaces-modal'),
  workspaceForm: document.getElementById('workspace-form'),
  newWorkspaceName: document.getElementById('new-workspace-name'),
  workspacesList: document.getElementById('workspaces-list'),

  // Elementos del Dashboard de Auditoría
  dashCardTotal: document.getElementById('dash-card-total'),
  dashCardReused: document.getElementById('dash-card-reused'),
  dashCardWeak: document.getElementById('dash-card-weak'),
  dashCardExpired: document.getElementById('dash-card-expired'),
  dashValTotal: document.getElementById('dash-val-total'),
  dashValReused: document.getElementById('dash-val-reused'),
  dashValWeak: document.getElementById('dash-val-weak'),
  dashValExpired: document.getElementById('dash-val-expired'),
  dashAlertBox: document.getElementById('dash-active-filter-alert'),
  dashFilterMsg: document.getElementById('dash-filter-message'),
  btnClearDashFilter: document.getElementById('btn-clear-dash-filter'),
  dashRecList: document.getElementById('dashboard-rec-list'),

  // Elementos de Campos Personalizados
  btnAddCustomField: document.getElementById('btn-add-custom-field'),
  formCustomFieldsContainer: document.getElementById('form-custom-fields-container'),
  detailCustomFieldsWrapper: document.getElementById('detail-custom-fields-wrapper'),
  detailCustomFieldsList: document.getElementById('detail-custom-fields-list'),

  // Elementos de Categorías Dinámicas
  btnManageCategories: document.getElementById('btn-manage-categories'),
  categoriesModal: document.getElementById('categories-modal'),
  btnCloseCategoriesModal: document.getElementById('btn-close-categories-modal'),
  categoryForm: document.getElementById('category-form'),
  formCategoryId: document.getElementById('form-category-id'),
  newCategoryName: document.getElementById('new-category-name'),
  categoryIconSelector: document.getElementById('category-icon-selector'),
  categoryColorSelector: document.getElementById('category-color-selector'),
  categoryCustomColor: document.getElementById('category-custom-color'),
  btnCancelCategoryEdit: document.getElementById('btn-cancel-category-edit'),
  btnSaveCategory: document.getElementById('btn-save-category'),
  btnSaveCategoryText: document.getElementById('btn-save-category-text'),
  categoriesList: document.getElementById('categories-list'),

  deleteCategoryConfirmModal: document.getElementById('delete-category-confirm-modal'),
  deleteCategoryMsg: document.getElementById('delete-category-msg'),
  deleteCategoryTransferGroup: document.getElementById('delete-category-transfer-group'),
  deleteCategoryTransferSelect: document.getElementById('delete-category-transfer-select'),
  btnCancelDeleteCategory: document.getElementById('btn-cancel-delete-category'),
  btnConfirmDeleteCategory: document.getElementById('btn-confirm-delete-category'),
};

// INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
  setupGDriveEventListeners();
  // Crear iconos de Lucide cargados por script CDN
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// DETERMINA QUÉ PANTALLA MOSTRAR (Desbloquear o Crear Nueva Bóveda)
// DETERMINA QUÉ PANTALLA MOSTRAR (Inicio de Sesión, Registro o Recuperación)
function initApp() {
  resetState();
  initTheme();
  initGDriveClient();
  
  // Mostrar alerta si hay una base de datos antigua para migrar
  if (Storage.hasLegacyVault()) {
    dom.migrationAlertBox.classList.remove('hidden');
  } else {
    dom.migrationAlertBox.classList.add('hidden');
  }

  const users = Storage.getUsers();

  // Ocultar todos los paneles
  dom.authLoginPanel.classList.add('hidden');
  dom.authRegisterPanel.classList.add('hidden');
  dom.authRecoveryPanel.classList.add('hidden');
  dom.recoveryKeyDisplayPanel.classList.add('hidden');

  if (users.length > 0) {
    dom.authLoginPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Inicia sesión en tu cuenta';
    dom.authLoginUsername.focus();
  } else {
    dom.authRegisterPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Registra tu primera cuenta';
    dom.authRegisterUsername.focus();
  }
}

// RESTABLECE EL ESTADO EN MEMORIA Y DE LA UI
function resetState() {
  Storage.logout();
  vault = { accounts: [] };
  selectedAccountId = null;
  activeCategory = 'all';
  pendingAccountSaveData = null;
  stopAutoLockTimer();

  // Limpiar portapapeles por seguridad al salir o bloquear
  if (clipboardTimer) {
    clearTimeout(clipboardTimer);
    clipboardTimer = null;
  }
  try {
    navigator.clipboard.writeText('').catch(() => {});
  } catch (e) {
    // Ignorar si no se tienen permisos de foco
  }

  // Limpiar token de acceso a la nube
  GDrive.setAccessToken(null);

  // Ocultar tableros
  dom.appContainer.classList.add('hidden');
  dom.unlockContainer.classList.remove('hidden');
  dom.detailsContent.classList.add('hidden');
  dom.detailsEmptyState.classList.remove('hidden');

  // Limpiar campos sensibles de los formularios
  dom.authLoginUsername.value = '';
  dom.authLoginPassword.value = '';
  dom.authRegisterUsername.value = '';
  dom.authRegisterPassword.value = '';
  dom.authRegisterConfirm.value = '';
  dom.authRecoveryUsername.value = '';
  dom.authRecoveryKey.value = '';
  dom.authRecoveryNewPassword.value = '';
  dom.searchInput.value = '';
}

// CARGA Y CONFIGURA LA BÓVEDA TRAS UNA AUTENTICACIÓN EXITOSA
function loadAndDisplayVault() {
  Storage.loadVault()
    .then((loadedVault) => {
      vault = loadedVault;
      
      // MIGRACIÓN Y COMPATIBILIDAD DE ESTRUCTURAS
      let needsSave = false;
      if (!vault.workspaces || !Array.isArray(vault.workspaces) || vault.workspaces.length === 0) {
        vault.workspaces = [{ id: 'default', name: 'General' }];
        needsSave = true;
      }
      if (!vault.categories || !Array.isArray(vault.categories)) {
        vault.categories = [
          { id: 'email', name: 'Correos', icon: 'mail', color: 'hsl(188, 86%, 53%)' },
          { id: 'server', name: 'Servidores / SSH', icon: 'server', color: 'hsl(221, 83%, 53%)' }, // Cobalto
          { id: 'db', name: 'Bases de Datos', icon: 'database', color: 'hsl(47, 95%, 50%)' },
          { id: 'web', name: 'Servicios Web', icon: 'globe', color: 'hsl(142, 71%, 45%)' },
          { id: 'other', name: 'Otros / Sin Categoría', icon: 'grid', color: 'hsl(215, 15%, 60%)' }
        ];
        needsSave = true;
      }
      if (vault.accounts && Array.isArray(vault.accounts)) {
        vault.accounts.forEach(acc => {
          if (!acc.workspaceId) {
            acc.workspaceId = 'default';
            needsSave = true;
          }
          if (!acc.category) {
            acc.category = 'other';
            needsSave = true;
          }
        });
      }
      if (needsSave) {
        Storage.saveVault(vault).catch(console.error);
      }
      
      // Mostrar Tablero Principal
      dom.unlockContainer.classList.add('hidden');
      dom.appContainer.classList.remove('hidden');
      
      showToast('Bóveda descifrada y sesión iniciada.', 'success');

      // Mostrar nombre de usuario activo y estado de sincronización
      const activeUser = Storage.getActiveUser();
      const usernameDisplay = document.getElementById('active-username-display');
      if (usernameDisplay && activeUser) {
        usernameDisplay.textContent = activeUser;
      }

      const roleDisplay = document.getElementById('active-user-role-display');
      if (roleDisplay && activeUser) {
        const isLinked = GDrive.isLinked(activeUser);
        roleDisplay.textContent = isLinked ? 'Drive Sincronizado' : 'Sesión Local';
        roleDisplay.style.color = isLinked ? 'var(--success)' : 'var(--text-muted)';
      }

      // Hook para sincronización automática al iniciar sesión
      if (activeUser && GDrive.isLinked(activeUser) && GDrive.isAutoSyncEnabled(activeUser)) {
        triggerAutoSyncPullAndMerge(activeUser);
      }
      
      // Cargar selectores
      activeWorkspaceId = 'default';
      updateWorkspaceDropdowns();
      updateCategoryDropdowns();
      renderCategoriesSidebar();
      
      // Refrescar vistas
      refreshAccountsList();
      updateSidebarBadges();
      renderSecurityDashboard();
      startAutoLockTimer();
    })
    .catch((error) => {
      showToast('Error al cargar la base de datos: ' + error.message, 'danger');
      lockVault();
    });
}

// INICIA EL PROCESO DE INICIO DE SESIÓN
function handleLogin(username, password) {
  Storage.loginUser(username, password)
    .then(() => {
      loadAndDisplayVault();
    })
    .catch(err => {
      showToast(err.message, 'danger');
      dom.authLoginPassword.value = '';
      dom.authLoginPassword.focus();
    });
}

// GESTIONA EL REGISTRO CON SOPORTE DE MIGRACIÓN OPCIONAL
function handleRegister(username, password) {
  if (Storage.hasLegacyVault()) {
    openConfirmModal(
      'Migrar Bóveda Antigua',
      'Se ha detectado una base de datos antigua. ¿Deseas ingresar la contraseña de tu bóveda anterior para migrar tus datos de manera automática a tu nueva cuenta multiusuario?',
      () => {
        const legacyPwd = prompt('Ingresa la contraseña maestra de tu bóveda antigua:');
        if (legacyPwd === null) {
          proceedWithRegistration(username, password);
        } else {
          Storage.migrateLegacyVault(username, password, legacyPwd)
            .then((recoveryKey) => {
              showRecoveryKeyAndLogin(recoveryKey);
            })
            .catch(err => {
              showToast('Error en la migración: ' + err.message, 'danger');
            });
        }
      }
    );
  } else {
    proceedWithRegistration(username, password);
  }
}

function proceedWithRegistration(username, password) {
  Storage.registerUser(username, password)
    .then((recoveryKey) => {
      showRecoveryKeyAndLogin(recoveryKey);
    })
    .catch(err => {
      showToast('Error de registro: ' + err.message, 'danger');
    });
}

function showRecoveryKeyAndLogin(recoveryKey) {
  dom.authLoginPanel.classList.add('hidden');
  dom.authRegisterPanel.classList.add('hidden');
  dom.authRecoveryPanel.classList.add('hidden');
  
  dom.recoveryKeyDisplayPanel.classList.remove('hidden');
  dom.generatedRecoveryKeyText.textContent = recoveryKey;
}

// GESTIONA LA RECUPERACIÓN DE CUENTAS
function handleRecovery(username, recoveryKey, newPassword) {
  Storage.recoverUser(username, recoveryKey, newPassword)
    .then(() => {
      showToast('Cuenta restablecida correctamente con nueva contraseña maestra.', 'success');
      loadAndDisplayVault();
    })
    .catch(err => {
      showToast(err.message, 'danger');
    });
}

// BLOQUEAR BÓVEDA
function lockVault() {
  resetState();
  initApp();
  showToast('Sesión bloqueada por inactividad o seguridad.', 'success');
}

// TIMER DE AUTO-BLOQUEO POR INACTIVIDAD
function startAutoLockTimer() {
  stopAutoLockTimer();
  autoLockTimer = setTimeout(() => {
    lockVault();
  }, AUTO_LOCK_TIMEOUT);
}

function stopAutoLockTimer() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

function resetAutoLockTimer() {
  if (Storage.getActiveUser()) {
    startAutoLockTimer();
  }
}

// MUESTRA NOTIFICACIONES FLOTANTES (TOAST) CON BARRA DE PROGRESO OPCIONAL
let toastHideTimeout = null;

function showToast(message, type = 'success', duration = 3500) {
  if (toastHideTimeout) {
    clearTimeout(toastHideTimeout);
  }

  dom.toastMessage.textContent = message;
  dom.toast.className = 'toast'; // reset classes
  
  if (type === 'danger') {
    dom.toast.classList.add('toast-danger');
    dom.toast.style.borderColor = 'var(--danger)';
    dom.toast.style.boxShadow = 'var(--shadow-toast), 0 0 10px 0 var(--danger-glow)';
    const icon = dom.toast.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'x-circle');
  } else {
    dom.toast.style.borderColor = 'var(--success)';
    dom.toast.style.boxShadow = 'var(--shadow-toast), 0 0 10px 0 var(--success-glow)';
    const icon = dom.toast.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'check-circle');
  }
  
  if (window.lucide) window.lucide.createIcons();
  
  // Mostrar
  dom.toast.classList.remove('hidden');

  // Controlar barra de progreso
  if (dom.toastProgress) {
    dom.toastProgress.style.transition = 'none';
    dom.toastProgress.style.transform = 'scaleX(1)';
    // Pequeño retardo para forzar el reflujo del navegador
    setTimeout(() => {
      dom.toastProgress.style.transition = `transform ${duration}ms linear`;
      dom.toastProgress.style.transform = 'scaleX(0)';
    }, 50);
  }
  
  toastHideTimeout = setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, duration);
}

// CONTROLES DE SEGURIDAD (FUERZA DE CONTRASEÑA)
function evaluatePasswordStrength(password) {
  let score = 0;
  if (!password) return { score, label: 'Ninguna', color: 'transparent' };
  
  if (password.length >= 8) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  // Normalizar el score a 4 niveles máximo
  score = Math.min(score, 4);

  const colors = [
    'var(--danger)',     // 0-1 Muy Débil
    'var(--danger)',     // 1 Débil
    'var(--warning)',    // 2 Media
    'var(--primary)',    // 3 Fuerte
    'var(--success)'     // 4 Muy Fuerte
  ];

  const labels = [
    'Demasiado corta',
    'Débil',
    'Media',
    'Fuerte',
    'Muy Fuerte (Excelente)'
  ];

  return {
    score,
    label: labels[score],
    color: colors[score]
  };
}

// GENERADOR DE CONTRASEÑAS
function generatePassword() {
  const length = parseInt(dom.genLengthInput.value);
  const includeUpper = dom.genUpper.checked;
  const includeLower = dom.genLower.checked;
  const includeNumbers = dom.genNumbers.checked;
  const includeSymbols = dom.genSymbols.checked;

  const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 'O', 'I' ambiguos
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz'; // Sin 'l' ambiguo
  const numberChars = '23456789'; // Sin '0', '1' ambiguos
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charSet = '';
  let mandatory = [];

  if (includeUpper) {
    charSet += upperChars;
    mandatory.push(upperChars[Math.floor(Math.random() * upperChars.length)]);
  }
  if (includeLower) {
    charSet += lowerChars;
    mandatory.push(lowerChars[Math.floor(Math.random() * lowerChars.length)]);
  }
  if (includeNumbers) {
    charSet += numberChars;
    mandatory.push(numberChars[Math.floor(Math.random() * numberChars.length)]);
  }
  if (includeSymbols) {
    charSet += symbolChars;
    mandatory.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);
  }

  if (charSet === '') {
    dom.genPasswordPreview.textContent = 'Selecciona alguna opción';
    return;
  }

  let generatedPassword = '';
  // Añadimos primero los obligatorios para garantizar cumplimiento de reglas
  generatedPassword += mandatory.join('');

  // Generamos el resto de los caracteres de forma aleatoria
  const remainingLength = length - mandatory.length;
  const randomValues = new Uint32Array(remainingLength);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < remainingLength; i++) {
    generatedPassword += charSet[randomValues[i] % charSet.length];
  }

  // Mezclar la contraseña para que los obligatorios no queden al inicio
  const shuffledPassword = generatedPassword.split('').sort(() => 0.5 - Math.random()).join('');
  dom.genPasswordPreview.textContent = shuffledPassword;
}

// GENERADOR DE CONTRASEÑA MAESTRA DE REGISTRO
function generateRegisterPassword() {
  if (!dom.registerGenLengthInput) return;
  const length = parseInt(dom.registerGenLengthInput.value);
  const includeUpper = dom.registerGenUpper.checked;
  const includeLower = dom.registerGenLower.checked;
  const includeNumbers = dom.registerGenNumbers.checked;
  const includeSymbols = dom.registerGenSymbols.checked;

  const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
  const numberChars = '23456789';
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charSet = '';
  let mandatory = [];

  if (includeUpper) {
    charSet += upperChars;
    mandatory.push(upperChars[Math.floor(Math.random() * upperChars.length)]);
  }
  if (includeLower) {
    charSet += lowerChars;
    mandatory.push(lowerChars[Math.floor(Math.random() * lowerChars.length)]);
  }
  if (includeNumbers) {
    charSet += numberChars;
    mandatory.push(numberChars[Math.floor(Math.random() * numberChars.length)]);
  }
  if (includeSymbols) {
    charSet += symbolChars;
    mandatory.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);
  }

  if (charSet === '') {
    dom.registerGenPasswordPreview.textContent = 'Selecciona alguna opción';
    return;
  }

  let generatedPassword = '';
  generatedPassword += mandatory.join('');

  const remainingLength = length - mandatory.length;
  if (remainingLength > 0) {
    const randomValues = new Uint32Array(remainingLength);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < remainingLength; i++) {
      generatedPassword += charSet[randomValues[i] % charSet.length];
    }
  }

  const shuffledPassword = generatedPassword.split('').sort(() => 0.5 - Math.random()).join('');
  dom.registerGenPasswordPreview.textContent = shuffledPassword;
}

// REFRESCAR LA LISTA DE CUENTAS EN INTERFAZ
function refreshAccountsList() {
  const query = dom.searchInput.value.toLowerCase().trim();
  dom.accountsList.innerHTML = '';

  // Filtrar cuentas
  const filteredAccounts = vault.accounts.filter(account => {
    // Filtrar por Espacio de Trabajo
    const matchesWorkspace = (account.workspaceId === activeWorkspaceId);
    if (!matchesWorkspace) return false;

    const matchesCategory = (activeCategory === 'all' || account.category === activeCategory);
    
    // Filtro de seguridad (Dashboard Auditoría)
    let matchesSecurity = true;
    if (activeSecurityFilter === 'reused') {
      const reusedCount = vault.accounts.filter(acc => acc.workspaceId === activeWorkspaceId && acc.password === account.password).length;
      matchesSecurity = reusedCount >= 2;
    } else if (activeSecurityFilter === 'weak') {
      matchesSecurity = evaluatePasswordStrength(account.password).score < 3;
    } else if (activeSecurityFilter === 'expired') {
      let lastChangeDate = null;
      if (account.history && Array.isArray(account.history) && account.history.length > 0) {
        const sorted = [...account.history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        lastChangeDate = new Date(sorted[0].timestamp);
      } else {
        lastChangeDate = new Date();
      }
      const diffTime = Math.abs(new Date() - lastChangeDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      matchesSecurity = diffDays > 90;
    }

    const matchesSearch = !query || 
      account.name.toLowerCase().includes(query) ||
      account.username.toLowerCase().includes(query) ||
      (account.url && account.url.toLowerCase().includes(query)) ||
      (account.notes && account.notes.toLowerCase().includes(query));
    return matchesCategory && matchesSecurity && matchesSearch;
  });

  dom.resultsCount.textContent = `${filteredAccounts.length} cuenta${filteredAccounts.length !== 1 ? 's' : ''} encontrada${filteredAccounts.length !== 1 ? 's' : ''}`;

  if (filteredAccounts.length === 0) {
    dom.accountsList.innerHTML = `
      <div class="empty-state-card" style="padding: 30px; text-align: center; color: var(--text-muted);">
        <p>No se encontraron cuentas.</p>
      </div>
    `;
    return;
  }

  filteredAccounts.forEach(account => {
    const card = document.createElement('div');
    card.className = `account-card ${selectedAccountId === account.id ? 'active' : ''}`;
    card.setAttribute('data-id', account.id);
    
    // Obtener información dinámica de la categoría
    const catInfo = vault.categories.find(c => c.id === account.category) || 
                    vault.categories.find(c => c.id === 'other') || 
                    { name: 'Otros', icon: 'grid', color: 'hsl(215, 15%, 60%)' };
    
    const bgRgba = catInfo.color.replace('hsl', 'hsla').replace(')', ', 0.15)');
    const borderRgba = catInfo.color.replace('hsl', 'hsla').replace(')', ', 0.2)');

    card.innerHTML = `
      <div class="card-title-row">
        <span class="card-title">${escapeHtml(account.name)}</span>
        <span class="badge-category" style="background-color: ${bgRgba}; color: ${catInfo.color}; border: 1px solid ${borderRgba};">${escapeHtml(catInfo.name)}</span>
      </div>
      <div class="card-username">${escapeHtml(account.username)}</div>
      <div class="card-tags">
        <span class="card-url">${account.url ? escapeHtml(account.url.replace(/^https?:\/\//, '')) : 'Sin URL'}</span>
        <i data-lucide="${catInfo.icon}" style="width: 14px; height: 14px; color: ${catInfo.color};"></i>
      </div>
    `;

    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      draggedAccountId = account.id;
      draggedElement = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', account.id);
    });

    card.addEventListener('dragover', (e) => {
      if (draggedAccountId === null || draggedAccountId === account.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect = card.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isBelow = relativeY > rect.height / 2;

      card.classList.remove('drag-over-above', 'drag-over-below');
      if (isBelow) {
        card.classList.add('drag-over-below');
      } else {
        card.classList.add('drag-over-above');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-above', 'drag-over-below');
    });

    card.addEventListener('drop', (e) => {
      if (draggedAccountId === null || draggedAccountId === account.id) return;
      e.preventDefault();

      const insertBelow = card.classList.contains('drag-over-below');
      card.classList.remove('drag-over-above', 'drag-over-below');

      const draggedIndex = vault.accounts.findIndex(acc => acc.id === draggedAccountId);
      if (draggedIndex === -1) return;

      const draggedItem = vault.accounts.splice(draggedIndex, 1)[0];
      
      // Encontrar el nuevo índice del target después de remover el draggedItem
      let targetIndex = vault.accounts.findIndex(acc => acc.id === account.id);
      if (targetIndex !== -1) {
        if (insertBelow) {
          vault.accounts.splice(targetIndex + 1, 0, draggedItem);
        } else {
          vault.accounts.splice(targetIndex, 0, draggedItem);
        }
        
        saveAndRefreshVault();
      }
    });

    card.addEventListener('dragend', () => {
      clearDragOverClasses();
      if (draggedElement) draggedElement.classList.remove('dragging');
      draggedAccountId = null;
      draggedElement = null;
    });

    card.addEventListener('click', () => {
      selectAccount(account.id);
    });

    dom.accountsList.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ACTUALIZACIÓN DE CONTADORES LATERALES (SIDEBAR BADGES)
function updateSidebarBadges() {
  const counts = { all: 0 };
  
  if (!vault.categories) return;

  vault.categories.forEach(cat => {
    counts[cat.id] = 0;
  });

  vault.accounts.forEach(acc => {
    if (acc.workspaceId === activeWorkspaceId) {
      counts.all++;
      const catId = acc.category || 'other';
      if (counts[catId] === undefined) {
        counts[catId] = 0;
      }
      counts[catId]++;
    }
  });

  const badgeAllEl = document.getElementById('badge-all');
  if (badgeAllEl) badgeAllEl.textContent = counts.all;

  vault.categories.forEach(cat => {
    const badgeEl = document.getElementById(`badge-${cat.id}`);
    if (badgeEl) {
      badgeEl.textContent = counts[cat.id] || 0;
    }
  });
}

// SELECCIONAR CUENTA PARA VER DETALLE
function selectAccount(id) {
  selectedAccountId = id;
  const account = vault.accounts.find(acc => acc.id === id);

  if (!account) {
    dom.detailsContent.classList.add('hidden');
    dom.detailsEmptyState.classList.remove('hidden');
    renderSecurityDashboard(); // Actualizar dashboard de seguridad en estado vacío
    if (dom.btnNavDashboard) {
      dom.btnNavDashboard.classList.add('active');
    }
    return;
  }

  // Marcar como activo en la lista
  document.querySelectorAll('.account-card').forEach(card => {
    if (card.getAttribute('data-id') === id) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Cargar campos
  dom.detailName.textContent = account.name;
  
  // Asignar badge dinámico con color HSL
  const catInfo = vault.categories.find(c => c.id === account.category) || 
                  vault.categories.find(c => c.id === 'other') || 
                  { name: 'Otros', icon: 'grid', color: 'hsl(215, 15%, 60%)' };
  dom.detailCategoryBadge.textContent = catInfo.name;
  dom.detailCategoryBadge.className = 'badge-category';
  
  const bgRgba = catInfo.color.replace('hsl', 'hsla').replace(')', ', 0.15)');
  const borderRgba = catInfo.color.replace('hsl', 'hsla').replace(')', ', 0.2)');
  dom.detailCategoryBadge.style.backgroundColor = bgRgba;
  dom.detailCategoryBadge.style.color = catInfo.color;
  dom.detailCategoryBadge.style.border = `1px solid ${borderRgba}`;

  dom.detailUsername.textContent = account.username;
  
  // Resetear visibilidad de contraseña
  dom.detailPassword.textContent = '••••••••••••••••';
  dom.detailPassword.classList.add('font-blur');
  const eyeIcon = dom.btnTogglePwdVisibility.querySelector('i');
  if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');

  // URL
  if (account.url) {
    dom.detailUrl.textContent = account.url;
    dom.detailUrl.href = account.url;
    dom.detailUrl.classList.remove('hidden');
    dom.btnVisitUrl.classList.remove('hidden');
  } else {
    dom.detailUrl.textContent = 'Sin dirección URL';
    dom.detailUrl.removeAttribute('href');
    dom.btnVisitUrl.classList.add('hidden');
  }

  // Notas
  dom.detailNotes.textContent = account.notes ? account.notes : 'Sin anotaciones adicionales.';

  // Renderizar campos personalizados
  const customFieldsContainer = dom.detailCustomFieldsList;
  const customFieldsWrapper = dom.detailCustomFieldsWrapper;
  
  if (customFieldsContainer && customFieldsWrapper) {
    customFieldsContainer.innerHTML = '';
    if (account.customFields && Array.isArray(account.customFields) && account.customFields.length > 0) {
      customFieldsWrapper.classList.remove('hidden');
      
      account.customFields.forEach(field => {
        if (!field.label || !field.value) return;
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'detail-custom-field-item';
        fieldDiv.innerHTML = `
          <span class="custom-field-label">${escapeHtml(field.label)}</span>
          <div class="field-value-group">
            <span class="selectable-text">${escapeHtml(field.value)}</span>
            <button class="icon-btn btn-copy-custom tooltip" title="Copiar campo">
              <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        `;
        
        // Copiar valor de campo personalizado
        const copyBtn = fieldDiv.querySelector('.btn-copy-custom');
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          copyToClipboard(field.value, copyBtn, `${field.label} copiado`);
        });
        
        customFieldsContainer.appendChild(fieldDiv);
      });
    } else {
      customFieldsWrapper.classList.add('hidden');
    }
  }

  // Antigüedad de la contraseña
  updatePasswordAgeIndicator(account);

  // Historial
  renderHistory(account.history || []);

  dom.detailsEmptyState.classList.add('hidden');
  dom.detailsContent.classList.remove('hidden');

  if (dom.btnNavDashboard) {
    dom.btnNavDashboard.classList.remove('active');
  }

  if (window.lucide) window.lucide.createIcons();
}

// MOSTRAR EL HISTORIAL DE CAMBIOS DE CONTRASEÑA (BITÁCORA)
function renderHistory(history) {
  dom.historyList.innerHTML = '';

  if (history.length === 0) {
    dom.historyList.innerHTML = `
      <div style="font-size: 12px; color: var(--text-muted); font-style: italic; padding: 10px 0;">
        No hay cambios registrados todavía.
      </div>
    `;
    return;
  }

  // Mostrar el historial, ordenado del más nuevo al más viejo
  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sortedHistory.forEach(item => {
    const dateStr = new Date(item.timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.innerHTML = `
      <div class="history-header">
        <span class="history-time">${dateStr}</span>
      </div>
      <div class="history-reason">${escapeHtml(item.reason)}</div>
      <div class="history-pwd-row">
        <span class="password-font">••••••••••••••••</span>
        <button type="button" class="icon-btn btn-copy-history-pwd tooltip" title="Copiar esta contraseña anterior">
          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;

    // Botón de copiado de la contraseña histórica
    const copyBtn = itemDiv.querySelector('.btn-copy-history-pwd');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.password)
        .then(() => showToast('Contraseña anterior copiada.', 'success'))
        .catch(() => showToast('No se pudo copiar.', 'danger'));
    });

    dom.historyList.appendChild(itemDiv);
  });

  if (window.lucide) window.lucide.createIcons();
}

// CALCULA Y ACTUALIZA EL INDICADOR DE EDAD DE LA CONTRASEÑA
function updatePasswordAgeIndicator(account) {
  if (!dom.detailPasswordAge) return;

  let lastChangeDate = null;
  if (account.history && Array.isArray(account.history) && account.history.length > 0) {
    // Obtener el cambio más reciente (el último registrado)
    const sorted = [...account.history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    lastChangeDate = new Date(sorted[0].timestamp);
  } else {
    // Si no hay historial, asumir la fecha actual
    lastChangeDate = new Date();
  }

  const now = new Date();
  const diffTime = Math.abs(now - lastChangeDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  dom.detailPasswordAge.className = 'password-age-badge';

  if (diffDays <= 30) {
    dom.detailPasswordAge.classList.add('secure');
    dom.detailPasswordAge.textContent = `Actualizada: ${diffDays === 0 ? 'hoy' : 'hace ' + diffDays + (diffDays === 1 ? ' día' : ' días')}`;
  } else if (diffDays <= 90) {
    dom.detailPasswordAge.classList.add('warning');
    dom.detailPasswordAge.textContent = `Hace ${diffDays} días`;
  } else {
    dom.detailPasswordAge.classList.add('danger');
    dom.detailPasswordAge.textContent = `Riesgo: hace ${diffDays} días`;
  }
}

// MICRO-INTERACCIÓN DE COPIADO EXITOSO
function triggerCopyFeedback(buttonElement) {
  if (!buttonElement) return;
  const icon = buttonElement.querySelector('i');
  if (icon) {
    const originalIcon = icon.getAttribute('data-lucide');
    icon.setAttribute('data-lucide', 'check');
    icon.classList.add('copied-green');
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      icon.setAttribute('data-lucide', originalIcon);
      icon.classList.remove('copied-green');
      if (window.lucide) window.lucide.createIcons();
    }, 1500);
  }
}

// COPIADO SEGURO CON AUTO-LIMPIEZA DE PORTAPAPELES EN 30 SEGUNDOS
function copyToClipboard(text, buttonElement, successMsg) {
  if (clipboardTimer) {
    clearTimeout(clipboardTimer);
    clipboardTimer = null;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      showToast(`${successMsg} (Portapapeles se limpiará en 30s).`, 'success', 30000);
      triggerCopyFeedback(buttonElement);

      clipboardTimer = setTimeout(() => {
        navigator.clipboard.writeText('');
        showToast('Portapapeles limpio por seguridad.', 'success');
        clipboardTimer = null;
      }, 30000);
    })
    .catch(err => {
      showToast('Error al copiar: ' + err.message, 'danger');
    });
}

// GENERAR FILAS DINÁMICAS PARA CAMPOS PERSONALIZADOS EN EL FORMULARIO
function addCustomFieldRow(label = '', value = '') {
  if (!dom.formCustomFieldsContainer) return;

  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <input type="text" class="custom-field-label-input" placeholder="Nombre (ej. IP, Puerto, API Key)" value="${escapeHtml(label)}" maxlength="32" required>
    <input type="text" class="custom-field-value-input" placeholder="Valor" value="${escapeHtml(value)}" maxlength="128" required>
    <button type="button" class="icon-btn btn-delete-custom-field tooltip" title="Eliminar Campo">
      <i data-lucide="trash-2" style="width: 16px; height: 16px; color: var(--danger);"></i>
    </button>
  `;

  const deleteBtn = row.querySelector('.btn-delete-custom-field');
  deleteBtn.addEventListener('click', () => {
    row.remove();
  });

  dom.formCustomFieldsContainer.appendChild(row);
  if (window.lucide) window.lucide.createIcons();
}

// RENDERIZAR EL DASHBOARD DE AUDITORÍA DE SEGURIDAD
function renderSecurityDashboard() {
  const wsAccounts = vault.accounts.filter(acc => acc.workspaceId === activeWorkspaceId);
  const total = wsAccounts.length;
  let weak = 0;
  let reusedCount = 0;
  let expired = 0;

  // Mapa de contraseñas para detectar reutilizaciones
  const pwdMap = {};
  wsAccounts.forEach(acc => {
    pwdMap[acc.password] = (pwdMap[acc.password] || 0) + 1;
  });

  wsAccounts.forEach(acc => {
    // 1. Debil
    if (evaluatePasswordStrength(acc.password).score < 3) {
      weak++;
    }
    // 2. Reutilizada
    if (pwdMap[acc.password] >= 2) {
      reusedCount++;
    }
    // 3. Expirada (>90 dias)
    let lastChangeDate = null;
    if (acc.history && Array.isArray(acc.history) && acc.history.length > 0) {
      const sorted = [...acc.history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      lastChangeDate = new Date(sorted[0].timestamp);
    } else {
      lastChangeDate = new Date();
    }
    const diffTime = Math.abs(new Date() - lastChangeDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      expired++;
    }
  });

  // Renderizar valores en el Dashboard
  if (dom.dashValTotal) dom.dashValTotal.textContent = total;
  if (dom.dashValReused) dom.dashValReused.textContent = reusedCount;
  if (dom.dashValWeak) dom.dashValWeak.textContent = weak;
  if (dom.dashValExpired) dom.dashValExpired.textContent = expired;

  // Actualizar clases de filtro activo
  [dom.dashCardReused, dom.dashCardWeak, dom.dashCardExpired].forEach(card => {
    if (card) card.classList.remove('active-dash-filter');
  });

  if (activeSecurityFilter === 'reused' && dom.dashCardReused) {
    dom.dashCardReused.classList.add('active-dash-filter');
  } else if (activeSecurityFilter === 'weak' && dom.dashCardWeak) {
    dom.dashCardWeak.classList.add('active-dash-filter');
  } else if (activeSecurityFilter === 'expired' && dom.dashCardExpired) {
    dom.dashCardExpired.classList.add('active-dash-filter');
  }

  // Alerta de filtro activo
  if (activeSecurityFilter && dom.dashAlertBox && dom.dashFilterMsg) {
    dom.dashAlertBox.classList.remove('hidden');
    let msg = '';
    if (activeSecurityFilter === 'reused') msg = 'Mostrando solo cuentas con contraseñas reutilizadas en infraestructura.';
    else if (activeSecurityFilter === 'weak') msg = 'Mostrando solo cuentas con contraseñas débiles (Riesgo).';
    else if (activeSecurityFilter === 'expired') msg = 'Mostrando solo cuentas con más de 90 días sin actualización.';
    dom.dashFilterMsg.textContent = msg;
  } else if (dom.dashAlertBox) {
    dom.dashAlertBox.classList.add('hidden');
  }

  // Generar recomendaciones
  if (dom.dashRecList) {
    dom.dashRecList.innerHTML = '';
    const recs = [];

    if (reusedCount > 0) {
      recs.push(`
        <li class="recommendation-item rec-danger">
          <i data-lucide="alert-triangle" class="rec-icon"></i>
          <div>
            <strong>¡Vulnerabilidad Crítica de Reutilización!</strong>
            Hay ${reusedCount} cuentas compartiendo contraseña. Un atacante comprometedor podría acceder a múltiples servicios. Utiliza contraseñas únicas para cada host.
          </div>
        </li>
      `);
    }

    if (weak > 0) {
      recs.push(`
        <li class="recommendation-item rec-warning">
          <i data-lucide="alert-circle" class="rec-icon"></i>
          <div>
            <strong>Contraseñas Débiles en Uso</strong>
            Tienes ${weak} accesos evaluados con baja robustez. Incrementa la longitud a mínimo 16 caracteres e incorpora caracteres especiales en el generador integrado.
          </div>
        </li>
      `);
    }

    if (expired > 0) {
      recs.push(`
        <li class="recommendation-item rec-warning">
          <i data-lucide="clock" class="rec-icon"></i>
          <div>
            <strong>Accesos Expirados</strong>
            ${expired} credenciales tienen más de 90 días de antigüedad. Programa una ventana de mantenimiento para rotar contraseñas de infraestructura crítica.
          </div>
        </li>
      `);
    }

    if (reusedCount === 0 && weak === 0 && expired === 0 && total > 0) {
      recs.push(`
        <li class="recommendation-item rec-secure">
          <i data-lucide="check-circle" class="rec-icon"></i>
          <div>
            <strong>¡Excelente Estado de Seguridad!</strong>
            Todas las cuentas cuentan con contraseñas únicas, robustas y actualizadas recientemente. ¡Buen trabajo de administración!
          </div>
        </li>
      `);
    } else if (total === 0) {
      recs.push(`
        <li class="recommendation-item" style="border-left: 3px solid var(--border-color);">
          <i data-lucide="info" class="rec-icon"></i>
          <div>
            <strong>Bóveda Vacía</strong>
            Agrega tu primera cuenta usando el botón "Nueva Cuenta" para habilitar las auditorías automáticas.
          </div>
        </li>
      `);
    }

    dom.dashRecList.innerHTML = recs.join('');
    if (window.lucide) window.lucide.createIcons();
  }
}

// GUARDAR LA CUENTA (CREAR O ACTUALIZAR)
function processSaveAccount(accountData) {
  const isEdit = accountData.id !== '';
  
  // Autocompletar protocolo HTTPS en la URL si no lo tiene
  if (accountData.url) {
    if (!/^https?:\/\//i.test(accountData.url)) {
      accountData.url = 'https://' + accountData.url;
    }
  }
  
  if (isEdit) {
    // Editar Cuenta
    const existingIndex = vault.accounts.findIndex(acc => acc.id === accountData.id);
    if (existingIndex !== -1) {
      const existingAccount = vault.accounts[existingIndex];
      const passwordChanged = existingAccount.password !== accountData.password;

      if (passwordChanged) {
        // Obligatorio pedir el motivo
        pendingAccountSaveData = { ...accountData, oldPassword: existingAccount.password };
        openReasonModal();
        return;
      } else {
        // No cambió contraseña, guardar directamente heredando el historial
        accountData.history = existingAccount.history || [];
        vault.accounts[existingIndex] = accountData;
      }
    }
  } else {
    // Nueva Cuenta
    accountData.id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    accountData.history = [
      {
        id: 'hist_' + Date.now(),
        timestamp: new Date().toISOString(),
        password: accountData.password,
        reason: 'Creación inicial de la cuenta'
      }
    ];
    vault.accounts.push(accountData);
  }

  saveAndRefreshVault();
  closeAccountModal();
  if (!isEdit) {
    selectedAccountId = accountData.id;
  }
  if (accountData.workspaceId) {
    activeWorkspaceId = accountData.workspaceId;
    updateWorkspaceDropdowns();
  }
  selectAccount(selectedAccountId);
}

// FINALIZAR EL GUARDADO TRAS OBTENER EL MOTIVO DEL CAMBIO DE CONTRAPASEÑA
function finalizeSaveWithReason(reason) {
  try {
    if (!pendingAccountSaveData) {
      console.warn('finalizeSaveWithReason: No hay datos guardados pendientes.');
      return;
    }

    const existingIndex = vault.accounts.findIndex(acc => acc.id === pendingAccountSaveData.id);
    if (existingIndex !== -1) {
      const existingAccount = vault.accounts[existingIndex];
      
      // Inicializar de forma segura el array de historial
      let history = [];
      if (existingAccount.history && Array.isArray(existingAccount.history)) {
        history = [...existingAccount.history];
      }
      
      // Agregar el estado ANTERIOR a la bitácora antes de actualizar
      history.push({
        id: 'hist_' + Date.now(),
        timestamp: new Date().toISOString(),
        password: pendingAccountSaveData.oldPassword, // Guardamos la contraseña vieja
        reason: reason
      });

      // Construir el objeto limpio
      const cleanAccount = {
        id: pendingAccountSaveData.id,
        name: pendingAccountSaveData.name,
        category: pendingAccountSaveData.category,
        username: pendingAccountSaveData.username,
        password: pendingAccountSaveData.password, // Nueva contraseña
        url: pendingAccountSaveData.url,
        workspaceId: pendingAccountSaveData.workspaceId || 'default',
        customFields: pendingAccountSaveData.customFields || [],
        notes: pendingAccountSaveData.notes,
        history: history
      };

      vault.accounts[existingIndex] = cleanAccount;
      
      saveAndRefreshVault();
      if (cleanAccount.workspaceId) {
        activeWorkspaceId = cleanAccount.workspaceId;
        updateWorkspaceDropdowns();
      }
      selectAccount(cleanAccount.id);
      showToast('Cuenta y contraseña actualizadas en la bitácora.', 'success');
    } else {
      console.error('finalizeSaveWithReason: No se encontró la cuenta con ID:', pendingAccountSaveData.id);
      showToast('Error: No se encontró la cuenta a actualizar.', 'danger');
    }
  } catch (error) {
    console.error('Error al guardar con motivo:', error);
    showToast('Error al actualizar contraseña: ' + error.message, 'danger');
  } finally {
    pendingAccountSaveData = null;
    closeReasonModal();
    closeAccountModal();
  }
}

// ENCRIPTAR Y GUARDAR EN LOCALSTORAGE
function saveAndRefreshVault() {
  Storage.saveVault(vault)
    .then(() => {
      refreshAccountsList();
      updateSidebarBadges();
      renderSecurityDashboard();

      // Sincronización automática al modificar datos
      const activeUser = Storage.getActiveUser();
      if (activeUser && GDrive.isLinked(activeUser) && GDrive.isAutoSyncEnabled(activeUser)) {
        triggerAutoSyncPush(activeUser);
      }
    })
    .catch(err => {
      showToast('Error al cifrar y guardar los datos: ' + err.message, 'danger');
    });
}

// CONTROL DE MODALES
function openAccountModal(id = '') {
  dom.accountForm.reset();
  dom.formAccountId.value = id;
  dom.generatorPanel.classList.add('hidden');
  dom.formStrengthBar.style.width = '0';
  dom.formStrengthText.textContent = 'Fuerza de contraseña';
  if (dom.formCustomFieldsContainer) dom.formCustomFieldsContainer.innerHTML = '';

  // Asegurar que los dropdowns de espacio de trabajo y categorías estén actualizados
  updateWorkspaceDropdowns();
  updateCategoryDropdowns();

  if (id) {
    // Editar
    dom.modalTitle.textContent = 'Editar Cuenta';
    const account = vault.accounts.find(acc => acc.id === id);
    if (account) {
      dom.formName.value = account.name;
      dom.formCategory.value = account.category;
      dom.formUsername.value = account.username;
      dom.formPassword.value = account.password;
      dom.formUrl.value = account.url || '';
      dom.formNotes.value = account.notes || '';
      
      if (dom.formWorkspaceSelect) {
        dom.formWorkspaceSelect.value = account.workspaceId || 'default';
      }
      
      // Cargar campos personalizados en formulario
      if (account.customFields && Array.isArray(account.customFields)) {
        account.customFields.forEach(field => {
          addCustomFieldRow(field.label, field.value);
        });
      }
      
      const strength = evaluatePasswordStrength(account.password);
      dom.formStrengthBar.style.width = `${(strength.score / 4) * 100}%`;
      dom.formStrengthBar.style.backgroundColor = strength.color;
      dom.formStrengthText.textContent = strength.label;
    }
  } else {
    // Crear
    dom.modalTitle.textContent = 'Agregar Nueva Cuenta';
    if (dom.formWorkspaceSelect) {
      dom.formWorkspaceSelect.value = activeWorkspaceId;
    }
  }

  dom.accountModal.classList.remove('hidden');
  dom.formName.focus();
}

function closeAccountModal() {
  dom.accountModal.classList.add('hidden');
}

function openReasonModal() {
  dom.changeReasonInput.value = '';
  dom.reasonModal.classList.remove('hidden');
  dom.changeReasonInput.focus();
}

function closeReasonModal() {
  dom.reasonModal.classList.add('hidden');
}

function openConfirmModal(title, message, onAccept) {
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  
  const acceptWrapper = (e) => {
    e.preventDefault();
    onAccept();
    closeConfirmModal();
  };

  dom.btnConfirmAccept.onclick = acceptWrapper;
  dom.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  dom.confirmModal.classList.add('hidden');
}

// SETUP DE EVENT LISTENERS
function setupEventListeners() {
  // --- INACTIVIDAD (Auto-lock) ---
  const resetActivity = () => resetAutoLockTimer();
  ['click', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetActivity);
  });

  // --- CONTROLES DE AUTENTICACIÓN ---
  
  // Toggles de visibilidad de contraseñas de autenticación
  dom.toggleLoginPassword.addEventListener('click', () => {
    const type = dom.authLoginPassword.type === 'password' ? 'text' : 'password';
    dom.authLoginPassword.type = type;
    const icon = dom.toggleLoginPassword.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  dom.toggleRegisterPassword.addEventListener('click', () => {
    const type = dom.authRegisterPassword.type === 'password' ? 'text' : 'password';
    dom.authRegisterPassword.type = type;
    const icon = dom.toggleRegisterPassword.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  dom.toggleRecoveryPassword.addEventListener('click', () => {
    const type = dom.authRecoveryNewPassword.type === 'password' ? 'text' : 'password';
    dom.authRecoveryNewPassword.type = type;
    const icon = dom.toggleRecoveryPassword.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  // Envío de Formularios
  dom.authLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = dom.authLoginUsername.value.trim();
    const pwd = dom.authLoginPassword.value;
    if (user && pwd) {
      handleLogin(user, pwd);
    }
  });

  dom.authRegisterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = dom.authRegisterUsername.value.trim();
    const pwd = dom.authRegisterPassword.value;
    const confirm = dom.authRegisterConfirm.value;

    if (pwd !== confirm) {
      showToast('Las contraseñas no coinciden.', 'danger');
      return;
    }

    if (pwd.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'danger');
      return;
    }

    handleRegister(user, pwd);
  });

  dom.authRegisterPassword.addEventListener('input', () => {
    const pwd = dom.authRegisterPassword.value;
    const strength = evaluatePasswordStrength(pwd);
    if (dom.registerStrengthBar) {
      dom.registerStrengthBar.style.width = `${(strength.score / 4) * 100}%`;
      dom.registerStrengthBar.style.backgroundColor = strength.color;
    }
    if (dom.registerStrengthText) {
      dom.registerStrengthText.textContent = strength.label;
    }
  });

  dom.btnToggleRegisterGenerator.addEventListener('click', () => {
    dom.registerGeneratorPanel.classList.toggle('hidden');
    if (!dom.registerGeneratorPanel.classList.contains('hidden')) {
      generateRegisterPassword();
    }
  });

  dom.registerGenLengthInput.addEventListener('input', () => {
    dom.registerGenLengthVal.textContent = dom.registerGenLengthInput.value;
    generateRegisterPassword();
  });

  [dom.registerGenUpper, dom.registerGenLower, dom.registerGenNumbers, dom.registerGenSymbols].forEach(cb => {
    cb.addEventListener('change', generateRegisterPassword);
  });

  if (dom.btnRegisterRegeneratePassword) {
    dom.btnRegisterRegeneratePassword.addEventListener('click', () => {
      generateRegisterPassword();
    });
  }

  dom.btnRegisterUseGenPassword.addEventListener('click', () => {
    const pwd = dom.registerGenPasswordPreview.textContent;
    if (pwd && pwd !== 'Selecciona alguna opción') {
      dom.authRegisterPassword.value = pwd;
      dom.authRegisterConfirm.value = pwd; // Auto-fill confirm field for convenience
      dom.authRegisterPassword.type = 'text';
      
      // Update strength meter
      const strength = evaluatePasswordStrength(pwd);
      if (dom.registerStrengthBar) {
        dom.registerStrengthBar.style.width = `${(strength.score / 4) * 100}%`;
        dom.registerStrengthBar.style.backgroundColor = strength.color;
      }
      if (dom.registerStrengthText) {
        dom.registerStrengthText.textContent = strength.label;
      }
      
      // Update eye icon
      const icon = dom.toggleRegisterPassword.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
      if (window.lucide) window.lucide.createIcons();

      dom.registerGeneratorPanel.classList.add('hidden');
      showToast('Contraseña maestra generada y aplicada en ambos campos.', 'success');
    }
  });

  dom.authRecoveryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = dom.authRecoveryUsername.value.trim();
    const key = dom.authRecoveryKey.value.trim();
    const pwd = dom.authRecoveryNewPassword.value;

    if (pwd.length < 8) {
      showToast('La nueva contraseña debe tener al menos 8 caracteres.', 'danger');
      return;
    }

    handleRecovery(user, key, pwd);
  });

  // Navegación entre pestañas de autenticación
  dom.btnGoToRegister.addEventListener('click', () => {
    dom.authLoginPanel.classList.add('hidden');
    dom.authRecoveryPanel.classList.add('hidden');
    dom.authRegisterPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Registra tu cuenta maestra';
    dom.authRegisterUsername.focus();
  });

  dom.btnGoToRecovery.addEventListener('click', () => {
    dom.authLoginPanel.classList.add('hidden');
    dom.authRegisterPanel.classList.add('hidden');
    dom.authRecoveryPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Recupera tu cuenta';
    dom.authRecoveryUsername.focus();
  });

  dom.btnGoToLoginFromReg.addEventListener('click', () => {
    dom.authRegisterPanel.classList.add('hidden');
    dom.authRecoveryPanel.classList.add('hidden');
    dom.authLoginPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Inicia sesión en tu cuenta';
    dom.authLoginUsername.focus();
  });

  dom.btnGoToLoginFromRec.addEventListener('click', () => {
    dom.authRegisterPanel.classList.add('hidden');
    dom.authRecoveryPanel.classList.add('hidden');
    dom.authLoginPanel.classList.remove('hidden');
    document.getElementById('unlock-subtitle').textContent = 'Inicia sesión en tu cuenta';
    dom.authLoginUsername.focus();
  });

  dom.btnAckRecoveryKey.addEventListener('click', () => {
    dom.recoveryKeyDisplayPanel.classList.add('hidden');
    loadAndDisplayVault();
  });

  dom.btnCopyGeneratedRecoveryKey.addEventListener('click', () => {
    const key = dom.generatedRecoveryKeyText.textContent;
    navigator.clipboard.writeText(key)
      .then(() => {
        showToast('Clave de recuperación copiada.', 'success');
        triggerCopyFeedback(dom.btnCopyGeneratedRecoveryKey);
      })
      .catch(() => showToast('Error al copiar.', 'danger'));
  });

  // Restablecimiento total desde desbloqueo
  dom.btnResetVaultUnlock.addEventListener('click', () => {
    openConfirmModal(
      '¿Restablecer Aplicación?',
      'Se borrarán por completo de tu navegador todas las cuentas de usuario y credenciales guardadas. Esta acción no se puede deshacer.',
      () => {
        Storage.resetAll();
        initApp();
        showToast('Aplicación restablecida por completo.', 'success');
      }
    );
  });

  // --- TABLERO GENERAL ---
  dom.btnLockVault.addEventListener('click', () => {
    lockVault();
  });

  // --- RETORNO AL DASHBOARD DE AUDITORÍA ---
  if (dom.btnNavDashboard) {
    dom.btnNavDashboard.addEventListener('click', () => {
      // Quitar active de categorías
      dom.categoryFilters.querySelectorAll('li').forEach(item => item.classList.remove('active'));
      selectAccount(null);
    });
  }

  if (dom.btnCloseDetails) {
    dom.btnCloseDetails.addEventListener('click', () => {
      selectAccount(null);
    });
  }

  // --- CONTROL DE ESPACIOS DE TRABAJO (WORKSPACES) ---
  if (dom.workspaceSelect) {
    dom.workspaceSelect.addEventListener('change', () => {
      activeWorkspaceId = dom.workspaceSelect.value;
      selectedAccountId = null; // Limpiar cuenta seleccionada
      
      // Quitar active de categorías y re-filtrar
      dom.categoryFilters.querySelectorAll('li').forEach(item => item.classList.remove('active'));
      // Activar "Todas las cuentas" por defecto
      const allCategoryLi = dom.categoryFilters.querySelector('li[data-category="all"]');
      if (allCategoryLi) allCategoryLi.classList.add('active');
      activeCategory = 'all';
      activeSecurityFilter = null; // Limpiar filtros del dashboard
      
      refreshAccountsList();
      updateSidebarBadges();
      selectAccount(null); // Mostrar dashboard
    });
  }

  if (dom.btnManageWorkspaces) {
    dom.btnManageWorkspaces.addEventListener('click', () => {
      renderWorkspacesList();
      dom.workspacesModal.classList.remove('hidden');
    });
  }

  if (dom.btnCloseWorkspacesModal) {
    dom.btnCloseWorkspacesModal.addEventListener('click', () => {
      dom.workspacesModal.classList.add('hidden');
    });
  }

  if (dom.workspaceForm) {
    dom.workspaceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const wsName = dom.newWorkspaceName.value.trim();
      if (wsName) {
        addWorkspace(wsName);
      }
    });
  }

  // Filtros de Categorías
  dom.categoryFilters.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;

    dom.categoryFilters.querySelectorAll('li').forEach(item => item.classList.remove('active'));
    li.classList.add('active');

    activeCategory = li.getAttribute('data-category');
    refreshAccountsList();
    
    // Si la cuenta activa no está en la nueva categoría, deseleccionar
    if (selectedAccountId) {
      const account = vault.accounts.find(acc => acc.id === selectedAccountId);
      if (account && activeCategory !== 'all' && account.category !== activeCategory) {
        selectedAccountId = null;
        dom.detailsContent.classList.add('hidden');
        dom.detailsEmptyState.classList.remove('hidden');
      }
    }
  });

  // Búsqueda
  dom.searchInput.addEventListener('input', () => {
    refreshAccountsList();
  });

  // Crear Cuenta Nuevo
  dom.btnAddAccount.addEventListener('click', () => {
    openAccountModal();
  });

  // --- DETALLES DE CUENTA ---
  dom.btnTogglePwdVisibility.addEventListener('click', () => {
    if (!selectedAccountId) return;
    const account = vault.accounts.find(acc => acc.id === selectedAccountId);
    if (!account) return;

    const isBlurred = dom.detailPassword.classList.contains('font-blur');
    const eyeIcon = dom.btnTogglePwdVisibility.querySelector('i');

    if (isBlurred) {
      dom.detailPassword.textContent = account.password;
      dom.detailPassword.classList.remove('font-blur');
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      dom.detailPassword.textContent = '••••••••••••••••';
      dom.detailPassword.classList.add('font-blur');
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  });

  dom.btnCopyUsername.addEventListener('click', () => {
    if (!selectedAccountId) return;
    const account = vault.accounts.find(acc => acc.id === selectedAccountId);
    if (account) {
      navigator.clipboard.writeText(account.username)
        .then(() => {
          showToast('Nombre de usuario copiado.', 'success');
          triggerCopyFeedback(dom.btnCopyUsername);
        })
        .catch(() => showToast('Error al copiar.', 'danger'));
    }
  });

  dom.btnCopyPassword.addEventListener('click', () => {
    if (!selectedAccountId) return;
    const account = vault.accounts.find(acc => acc.id === selectedAccountId);
    if (account) {
      copyToClipboard(account.password, dom.btnCopyPassword, 'Contraseña copiada al portapapeles');
    }
  });

  dom.btnVisitUrl.addEventListener('click', () => {
    if (!selectedAccountId) return;
    const account = vault.accounts.find(acc => acc.id === selectedAccountId);
    if (account && account.url) {
      window.open(account.url, '_blank', 'noopener,noreferrer');
    }
  });

  dom.btnEditAccount.addEventListener('click', () => {
    if (selectedAccountId) {
      openAccountModal(selectedAccountId);
    }
  });

  dom.btnDeleteAccount.addEventListener('click', () => {
    if (!selectedAccountId) return;
    const account = vault.accounts.find(acc => acc.id === selectedAccountId);
    if (!account) return;

    openConfirmModal(
      '¿Eliminar Cuenta?',
      `¿Estás seguro de que deseas eliminar permanentemente la cuenta "${account.name}" y todo su historial de contraseñas?`,
      () => {
        vault.accounts = vault.accounts.filter(acc => acc.id !== selectedAccountId);
        selectedAccountId = null;
        saveAndRefreshVault();
        dom.detailsContent.classList.add('hidden');
        dom.detailsEmptyState.classList.remove('hidden');
        showToast('Cuenta eliminada correctamente.', 'success');
      }
    );
  });

  // --- MODAL DE CUENTA (FORMULARIO) ---
  dom.btnCloseModal.addEventListener('click', closeAccountModal);
  dom.btnCancelModal.addEventListener('click', closeAccountModal);

  dom.btnFormPwdToggle.addEventListener('click', () => {
    const type = dom.formPassword.type === 'password' ? 'text' : 'password';
    dom.formPassword.type = type;
    const icon = dom.btnFormPwdToggle.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  dom.formPassword.addEventListener('input', () => {
    const pwd = dom.formPassword.value;
    const strength = evaluatePasswordStrength(pwd);
    dom.formStrengthBar.style.width = `${(strength.score / 4) * 100}%`;
    dom.formStrengthBar.style.backgroundColor = strength.color;
    dom.formStrengthText.textContent = strength.label;
  });

  dom.accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let urlVal = dom.formUrl.value.trim();
    if (urlVal && !/^https?:\/\//i.test(urlVal)) {
      urlVal = 'https://' + urlVal;
    }

    // Recopilar campos personalizados del formulario
    const customFields = [];
    if (dom.formCustomFieldsContainer) {
      const rows = dom.formCustomFieldsContainer.querySelectorAll('.custom-field-row');
      rows.forEach(row => {
        const label = row.querySelector('.custom-field-label-input').value.trim();
        const value = row.querySelector('.custom-field-value-input').value.trim();
        if (label && value) {
          customFields.push({ label, value });
        }
      });
    }

    const accountData = {
      id: dom.formAccountId.value,
      name: dom.formName.value.trim(),
      category: dom.formCategory.value,
      username: dom.formUsername.value.trim(),
      password: dom.formPassword.value,
      url: urlVal,
      workspaceId: dom.formWorkspaceSelect ? dom.formWorkspaceSelect.value : 'default',
      customFields: customFields,
      notes: dom.formNotes.value.trim()
    };

    processSaveAccount(accountData);
  });

  // --- GENERADOR ---
  dom.btnToggleGenerator.addEventListener('click', () => {
    dom.generatorPanel.classList.toggle('hidden');
    if (!dom.generatorPanel.classList.contains('hidden')) {
      generatePassword();
    }
  });

  dom.genLengthInput.addEventListener('input', () => {
    dom.genLengthVal.textContent = dom.genLengthInput.value;
    generatePassword();
  });

  [dom.genUpper, dom.genLower, dom.genNumbers, dom.genSymbols].forEach(cb => {
    cb.addEventListener('change', generatePassword);
  });

  if (dom.btnRegeneratePassword) {
    dom.btnRegeneratePassword.addEventListener('click', () => {
      generatePassword();
    });
  }

  dom.btnUseGenPassword.addEventListener('click', () => {
    const pwd = dom.genPasswordPreview.textContent;
    if (pwd && pwd !== 'Selecciona alguna opción') {
      dom.formPassword.value = pwd;
      dom.formPassword.type = 'text';
      
      // Actualizar fuerza
      const strength = evaluatePasswordStrength(pwd);
      dom.formStrengthBar.style.width = `${(strength.score / 4) * 100}%`;
      dom.formStrengthBar.style.backgroundColor = strength.color;
      dom.formStrengthText.textContent = strength.label;
      
      // Actualizar ojito
      const icon = dom.btnFormPwdToggle.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
      if (window.lucide) window.lucide.createIcons();

      dom.generatorPanel.classList.add('hidden');
      showToast('Contraseña generada aplicada.', 'success');
    }
  });

  // --- MODAL DE MOTIVO ---
  dom.reasonForm.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const reason = dom.changeReasonInput.value.trim();
      if (reason) {
        finalizeSaveWithReason(reason);
      }
    } catch (err) {
      console.error('Error en reasonForm submit listener:', err);
      showToast('Error al enviar el formulario: ' + err.message, 'danger');
    }
  });

  // --- IMPORTAR / EXPORTAR / RESTABLECER ---
  dom.btnExportVault.addEventListener('click', () => {
    // Generar JSON legible y descargarlo
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vault, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `sentinel-vault-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Copia de seguridad JSON exportada.', 'success');
  });

  dom.btnImportVaultTrigger.addEventListener('click', () => {
    dom.importVaultFile.click();
  });

  dom.importVaultFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        
        // Saneamiento riguroso antes de procesar
        const cleanImport = Storage.validateAndSanitizeVault(importedData);

        openConfirmModal(
          '¿Importar Bóveda?',
          'Esta operación combinará las cuentas del archivo con tus cuentas actuales (si hay IDs coincidentes, se actualizarán). ¿Deseas continuar?',
          () => {
            // Combinar espacios de trabajo
            if (cleanImport.workspaces) {
              cleanImport.workspaces.forEach(impWs => {
                const idx = vault.workspaces.findIndex(ws => ws.id === impWs.id);
                if (idx === -1) {
                  vault.workspaces.push(impWs);
                }
              });
            }

            // Combinar categorías
            if (cleanImport.categories) {
              cleanImport.categories.forEach(impCat => {
                const idx = vault.categories.findIndex(c => c.id === impCat.id);
                if (idx === -1) {
                  vault.categories.push(impCat);
                }
              });
            }

            // Combinar cuentas
            if (cleanImport.accounts) {
              cleanImport.accounts.forEach(impAcc => {
                const idx = vault.accounts.findIndex(acc => acc.id === impAcc.id);
                if (idx !== -1) {
                  vault.accounts[idx] = impAcc;
                } else {
                  vault.accounts.push(impAcc);
                }
              });
            }

            saveAndRefreshVault();
            updateWorkspaceDropdowns();
            updateCategoryDropdowns();
            renderCategoriesSidebar();
            showToast('Bóveda importada con éxito.', 'success');
            dom.importVaultFile.value = ''; // Reset input
          }
        );
      } catch (err) {
        showToast('Error al importar: archivo no válido.', 'danger');
        dom.importVaultFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  dom.btnResetVault.addEventListener('click', () => {
    openConfirmModal(
      '¿Eliminar Bóveda?',
      'Esta operación destruirá de manera irreversible todas tus credenciales de esta cuenta e historial guardados. ¿Estás absolutamente seguro?',
      () => {
        Storage.resetUserVault();
        resetState();
        initApp();
        showToast('Bóveda y cuenta eliminadas.', 'success');
      }
    );
  });

  // Cancelar confirmación
  dom.btnConfirmCancel.addEventListener('click', closeConfirmModal);

  // --- DASHBOARD DE SEGURIDAD EVENTOS ---
  if (dom.dashCardReused) {
    dom.dashCardReused.addEventListener('click', () => {
      activeSecurityFilter = activeSecurityFilter === 'reused' ? null : 'reused';
      refreshAccountsList();
      renderSecurityDashboard();
    });
  }
  if (dom.dashCardWeak) {
    dom.dashCardWeak.addEventListener('click', () => {
      activeSecurityFilter = activeSecurityFilter === 'weak' ? null : 'weak';
      refreshAccountsList();
      renderSecurityDashboard();
    });
  }
  if (dom.dashCardExpired) {
    dom.dashCardExpired.addEventListener('click', () => {
      activeSecurityFilter = activeSecurityFilter === 'expired' ? null : 'expired';
      refreshAccountsList();
      renderSecurityDashboard();
    });
  }
  if (dom.btnClearDashFilter) {
    dom.btnClearDashFilter.addEventListener('click', () => {
      activeSecurityFilter = null;
      refreshAccountsList();
      renderSecurityDashboard();
    });
  }

  // --- CAMPOS PERSONALIZADOS FORMULARIO EVENTOS ---
  if (dom.btnAddCustomField) {
    dom.btnAddCustomField.addEventListener('click', () => {
      addCustomFieldRow();
    });
  }

  // --- ATAJOS DE TECLADO RÁPIDOS ---
  window.addEventListener('keydown', (e) => {
    if (!Storage.getActiveUser()) return;

    // Ignorar atajos si el foco está en un campo de texto o área editable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) {
      if (e.key === 'Escape') {
        e.preventDefault();
        active.blur();
        closeAccountModal();
        closeReasonModal();
        closeConfirmModal();
      }
      return;
    }

    // '/' o 'Ctrl + F' -> Buscar
    if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'f')) {
      e.preventDefault();
      dom.searchInput.focus();
      dom.searchInput.select();
    }
    // 'Esc' -> Limpiar filtros/búsqueda o Cerrar Sesión (Panic Action)
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (!dom.accountModal.classList.contains('hidden') || 
          !dom.reasonModal.classList.contains('hidden') || 
          !dom.confirmModal.classList.contains('hidden') ||
          !dom.workspacesModal.classList.contains('hidden') ||
          !dom.categoriesModal.classList.contains('hidden') ||
          !dom.deleteCategoryConfirmModal.classList.contains('hidden')) {
        closeAccountModal();
        closeReasonModal();
        closeConfirmModal();
        dom.workspacesModal.classList.add('hidden');
        dom.categoriesModal.classList.add('hidden');
        dom.deleteCategoryConfirmModal.classList.add('hidden');
      } else if (activeSecurityFilter) {
        activeSecurityFilter = null;
        refreshAccountsList();
        renderSecurityDashboard();
      } else if (dom.searchInput.value) {
        dom.searchInput.value = '';
        refreshAccountsList();
      } else {
        lockVault();
      }
    }
    // 'N' o 'n' -> Nueva Cuenta
    else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openAccountModal();
    }
  });

  // --- CONTROL DE CATEGORÍAS DINÁMICAS (FASE 7) ---
  if (dom.btnManageCategories) {
    dom.btnManageCategories.addEventListener('click', (e) => {
      e.stopPropagation();
      initCategorySelectors();
      cancelCategoryEdit();
      renderCategoriesList();
      dom.categoriesModal.classList.remove('hidden');
    });
  }

  if (dom.btnCloseCategoriesModal) {
    dom.btnCloseCategoriesModal.addEventListener('click', () => {
      dom.categoriesModal.classList.add('hidden');
    });
  }

  if (dom.btnCancelCategoryEdit) {
    dom.btnCancelCategoryEdit.addEventListener('click', () => {
      cancelCategoryEdit();
    });
  }

  if (dom.categoryForm) {
    dom.categoryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = dom.newCategoryName.value.trim();
      const id = dom.formCategoryId.value;
      saveCategory(name, selectedCategoryIcon, selectedCategoryColor, id);
    });
  }

  if (dom.btnToggleTheme) {
    dom.btnToggleTheme.addEventListener('click', () => {
      toggleTheme();
    });
  }

  if (dom.categoryCustomColor) {
    dom.categoryCustomColor.addEventListener('input', () => {
      const hslColor = hexToHsl(dom.categoryCustomColor.value);
      selectCategoryColorInForm(hslColor);
    });
  }

  setupDeleteCategoryEvents();
  setupUserProfileEvents();
}

// ACTUALIZA LOS DROPDOWNS DE ESPACIOS DE TRABAJO (BARRA LATERAL Y FORMULARIO)
function updateWorkspaceDropdowns() {
  if (!vault.workspaces) vault.workspaces = [{ id: 'default', name: 'General' }];

  // 1. Dropdown del Sidebar
  if (dom.workspaceSelect) {
    dom.workspaceSelect.innerHTML = '';
    vault.workspaces.forEach(ws => {
      const opt = document.createElement('option');
      opt.value = ws.id;
      opt.textContent = ws.name;
      if (ws.id === activeWorkspaceId) {
        opt.selected = true;
      }
      dom.workspaceSelect.appendChild(opt);
    });
  }

  // 2. Dropdown del Formulario de Cuenta
  if (dom.formWorkspaceSelect) {
    dom.formWorkspaceSelect.innerHTML = '';
    vault.workspaces.forEach(ws => {
      const opt = document.createElement('option');
      opt.value = ws.id;
      opt.textContent = ws.name;
      dom.formWorkspaceSelect.appendChild(opt);
    });
  }
}

// RENDERIZA LA LISTA DE ESPACIOS DE TRABAJO EN EL MODAL DE GESTIÓN
function renderWorkspacesList() {
  if (!dom.workspacesList) return;
  dom.workspacesList.innerHTML = '';

  vault.workspaces.forEach(ws => {
    const row = document.createElement('div');
    row.className = 'workspace-item-row';
    
    // Contar cuántas cuentas hay en este espacio
    const count = vault.accounts.filter(acc => acc.workspaceId === ws.id).length;
    const countText = count > 0 ? ` (${count} cuenta${count !== 1 ? 's' : ''})` : '';

    row.innerHTML = `
      <span class="workspace-item-name">${escapeHtml(ws.name)}${countText}</span>
      <div class="workspace-item-actions">
        ${ws.id !== 'default' ? `
          <button type="button" class="icon-btn btn-delete-workspace tooltip" title="Eliminar Espacio" data-id="${ws.id}">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--danger);"></i>
          </button>
        ` : `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Sistema</span>`}
      </div>
    `;

    // Vincular borrado
    const delBtn = row.querySelector('.btn-delete-workspace');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWorkspace(ws.id, ws.name, count);
      });
    }

    dom.workspacesList.appendChild(row);
  });

  if (window.lucide) window.lucide.createIcons();
}

// AGREGAR UN NUEVO ESPACIO DE TRABAJO
function addWorkspace(name) {
  const cleanName = name.trim();
  if (!cleanName) return;

  // Evitar duplicados
  const exists = vault.workspaces.some(ws => ws.name.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    showToast('Ya existe un espacio de trabajo con ese nombre.', 'danger');
    return;
  }

  const newId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  vault.workspaces.push({
    id: newId,
    name: cleanName
  });

  saveAndRefreshVault();
  updateWorkspaceDropdowns();
  renderWorkspacesList();
  
  dom.newWorkspaceName.value = '';
  showToast(`Espacio de trabajo "${cleanName}" creado.`, 'success');
}

// ELIMINAR UN ESPACIO DE TRABAJO Y TRASLADAR SUS CUENTAS A GENERAL
function deleteWorkspace(id, name, accountCount) {
  if (id === 'default') return;

  const msg = accountCount > 0 
    ? `¿Estás seguro de que deseas eliminar el espacio de trabajo "${name}"? Las ${accountCount} cuenta(s) asociadas se trasladarán automáticamente de forma segura al espacio "General".`
    : `¿Deseas eliminar el espacio de trabajo "${name}"?`;

  openConfirmModal(
    'Eliminar Espacio de Trabajo',
    msg,
    () => {
      // Reasignar cuentas a default
      vault.accounts.forEach(acc => {
        if (acc.workspaceId === id) {
          acc.workspaceId = 'default';
        }
      });

      // Eliminar espacio
      vault.workspaces = vault.workspaces.filter(ws => ws.id !== id);

      // Si el espacio activo era el eliminado, cambiar a default
      if (activeWorkspaceId === id) {
        activeWorkspaceId = 'default';
      }

      // Guardar y refrescar
      saveAndRefreshVault();
      updateWorkspaceDropdowns();
      renderWorkspacesList();
      showToast(`Espacio "${name}" eliminado correctamente.`, 'success');
    }
  );
}

// --- CONFIGURACIÓN DE CATEGORÍAS DINÁMICAS (FASE 7) ---
const AVAILABLE_ICONS = [
  'mail', 'server', 'database', 'globe', 'terminal', 'cpu', 'cloud', 'shield',
  'key-round', 'credit-card', 'link', 'file-text', 'hard-drive', 'hash', 'user', 'settings',
  'lock', 'unlock', 'activity', 'wifi', 'code-2', 'wallet', 'fingerprint', 'git-branch'
];

const AVAILABLE_COLORS = [
  'hsl(263, 70%, 55%)',  // Violeta
  'hsl(188, 86%, 53%)',  // Cian
  'hsl(142, 71%, 45%)',  // Esmeralda
  'hsl(47, 95%, 50%)',   // Amarillo/Oro
  'hsl(24, 95%, 53%)',   // Naranja
  'hsl(330, 85%, 60%)',  // Rosa Neón
  'hsl(350, 89%, 60%)',  // Rojo Coral
  'hsl(217, 91%, 60%)',  // Azul Royal
  'hsl(162, 76%, 45%)',  // Verde Menta
  'hsl(215, 15%, 60%)'   // Gris
];

let categoryToDelete = null;

function renderCategoriesSidebar() {
  const filtersUl = dom.categoryFilters;
  if (!filtersUl) return;

  // Limpiar excepto el primer elemento (Todas las Cuentas)
  const allItem = filtersUl.querySelector('li[data-category="all"]');
  filtersUl.innerHTML = '';
  if (allItem) {
    filtersUl.appendChild(allItem);
  }

  if (!vault.categories) return;

  vault.categories.forEach(cat => {
    const li = document.createElement('li');
    li.setAttribute('data-category', cat.id);
    if (activeCategory === cat.id) {
      li.className = 'active';
    }

    // Guardar el color HSL en variables CSS locales para el item
    li.style.setProperty('--cat-color', cat.color);
    li.style.setProperty('--cat-color-rgba', cat.color.replace('hsl', 'hsla').replace(')', ', 0.15)'));
    
    li.innerHTML = `
      <i data-lucide="${cat.icon}" style="color: ${cat.color};"></i>
      <span>${escapeHtml(cat.name)}</span>
      <span class="badge" id="badge-${cat.id}">0</span>
    `;

    li.setAttribute('draggable', 'true');

    li.addEventListener('dragstart', (e) => {
      draggedCategoryId = cat.id;
      draggedElement = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cat.id);
    });

    li.addEventListener('dragover', (e) => {
      if (draggedCategoryId === null || draggedCategoryId === cat.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect = li.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isBelow = relativeY > rect.height / 2;

      li.classList.remove('drag-over-above', 'drag-over-below');
      if (isBelow) {
        li.classList.add('drag-over-below');
      } else {
        li.classList.add('drag-over-above');
      }
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over-above', 'drag-over-below');
    });

    li.addEventListener('drop', (e) => {
      if (draggedCategoryId === null || draggedCategoryId === cat.id) return;
      e.preventDefault();

      const insertBelow = li.classList.contains('drag-over-below');
      li.classList.remove('drag-over-above', 'drag-over-below');

      const draggedIndex = vault.categories.findIndex(c => c.id === draggedCategoryId);
      if (draggedIndex === -1) return;

      const draggedItem = vault.categories.splice(draggedIndex, 1)[0];
      
      let targetIndex = vault.categories.findIndex(c => c.id === cat.id);
      if (targetIndex !== -1) {
        if (insertBelow) {
          vault.categories.splice(targetIndex + 1, 0, draggedItem);
        } else {
          vault.categories.splice(targetIndex, 0, draggedItem);
        }
        
        saveAndRefreshVault();
        updateCategoryDropdowns();
        renderCategoriesSidebar();
        renderCategoriesList();
      }
    });

    li.addEventListener('dragend', () => {
      clearDragOverClasses();
      if (draggedElement) draggedElement.classList.remove('dragging');
      draggedCategoryId = null;
      draggedElement = null;
    });

    filtersUl.appendChild(li);
  });

  if (window.lucide) window.lucide.createIcons();
}

function updateCategoryDropdowns() {
  if (dom.formCategory && vault.categories) {
    dom.formCategory.innerHTML = '';
    vault.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      dom.formCategory.appendChild(opt);
    });
  }
}

function renderCategoriesList() {
  if (!dom.categoriesList || !vault.categories) return;
  dom.categoriesList.innerHTML = '';

  vault.categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'category-item-row';
    
    // Contar cuentas en esta categoría
    const count = vault.accounts.filter(acc => acc.category === cat.id).length;
    const countText = count > 0 ? ` (${count} cuenta${count !== 1 ? 's' : ''})` : '';

    const bgRgba = cat.color.replace('hsl', 'hsla').replace(')', ', 0.15)');
    const borderRgba = cat.color.replace('hsl', 'hsla').replace(')', ', 0.2)');

    row.innerHTML = `
      <div class="category-item-identity">
        <div class="category-item-icon-wrapper" style="background-color: ${bgRgba}; border: 1px solid ${borderRgba}; color: ${cat.color};">
          <i data-lucide="${cat.icon}"></i>
        </div>
        <span class="category-item-name">${escapeHtml(cat.name)}${countText}</span>
      </div>
      <div class="category-item-actions">
        <button type="button" class="icon-btn btn-edit-category tooltip" title="Editar Categoría" data-id="${cat.id}">
          <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
        </button>
        ${cat.id !== 'other' ? `
          <button type="button" class="icon-btn btn-delete-category tooltip" title="Eliminar Categoría" data-id="${cat.id}">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--danger);"></i>
          </button>
        ` : `<span style="font-size: 11px; color: var(--text-muted); font-style: italic; margin-left: 6px;">Comodín</span>`}
      </div>
    `;

    const editBtn = row.querySelector('.btn-edit-category');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditCategory(cat);
    });

    const delBtn = row.querySelector('.btn-delete-category');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteCategory(cat, count);
      });
    }

    dom.categoriesList.appendChild(row);
  });

  if (window.lucide) window.lucide.createIcons();
}

function initCategorySelectors() {
  const iconContainer = dom.categoryIconSelector;
  if (iconContainer) {
    iconContainer.innerHTML = '';
    AVAILABLE_ICONS.forEach(iconName => {
      const div = document.createElement('div');
      div.className = 'icon-selector-item';
      div.setAttribute('data-icon', iconName);
      div.innerHTML = `<i data-lucide="${iconName}"></i>`;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCategoryIconInForm(iconName);
      });
      iconContainer.appendChild(div);
    });
  }

  const colorContainer = dom.categoryColorSelector;
  if (colorContainer) {
    colorContainer.innerHTML = '';
    AVAILABLE_COLORS.forEach(colorVal => {
      const div = document.createElement('div');
      div.className = 'color-selector-item';
      div.setAttribute('data-color', colorVal);
      div.style.backgroundColor = colorVal;
      div.style.color = colorVal;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCategoryColorInForm(colorVal);
      });
      colorContainer.appendChild(div);
    });
  }
  
  if (window.lucide) window.lucide.createIcons();
}

function selectCategoryIconInForm(iconName) {
  selectedCategoryIcon = iconName;
  if (dom.categoryIconSelector) {
    dom.categoryIconSelector.querySelectorAll('.icon-selector-item').forEach(item => {
      if (item.getAttribute('data-icon') === iconName) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }
}

function selectCategoryColorInForm(colorVal) {
  selectedCategoryColor = colorVal;
  const isPredefined = AVAILABLE_COLORS.includes(colorVal);

  if (dom.categoryColorSelector) {
    dom.categoryColorSelector.querySelectorAll('.color-selector-item').forEach(item => {
      if (item.getAttribute('data-color') === colorVal) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  if (dom.categoryCustomColor) {
    if (!isPredefined) {
      dom.categoryCustomColor.style.boxShadow = '0 0 0 2px var(--text-main)';
      dom.categoryCustomColor.value = hslToHex(colorVal);
    } else {
      dom.categoryCustomColor.style.boxShadow = 'none';
    }
  }
}

function startEditCategory(cat) {
  dom.formCategoryId.value = cat.id;
  dom.newCategoryName.value = cat.name;
  dom.btnSaveCategoryText.textContent = 'Guardar Cambios';
  
  const icon = dom.btnSaveCategory.querySelector('i');
  if (icon) icon.setAttribute('data-lucide', 'check');
  
  dom.btnCancelCategoryEdit.classList.remove('hidden');
  
  const label = document.getElementById('category-form-label');
  if (label) label.textContent = 'Editar Categoría';
  
  selectCategoryIconInForm(cat.icon);
  selectCategoryColorInForm(cat.color);
  if (window.lucide) window.lucide.createIcons();
}

function cancelCategoryEdit() {
  dom.formCategoryId.value = '';
  dom.newCategoryName.value = '';
  dom.btnSaveCategoryText.textContent = 'Agregar Categoría';
  
  const icon = dom.btnSaveCategory.querySelector('i');
  if (icon) icon.setAttribute('data-lucide', 'plus');
  
  dom.btnCancelCategoryEdit.classList.add('hidden');
  
  const label = document.getElementById('category-form-label');
  if (label) label.textContent = 'Nueva Categoría';

  selectCategoryIconInForm(AVAILABLE_ICONS[0]);
  selectCategoryColorInForm(AVAILABLE_COLORS[0]);
  if (window.lucide) window.lucide.createIcons();
}

function saveCategory(name, icon, color, id = '') {
  const cleanName = name.trim();
  if (!cleanName) return;

  if (id) {
    const idx = vault.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      vault.categories[idx].name = cleanName;
      vault.categories[idx].icon = icon;
      vault.categories[idx].color = color;
      showToast(`Categoría "${cleanName}" actualizada.`, 'success');
    }
  } else {
    const exists = vault.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      showToast('Ya existe una categoría con ese nombre.', 'danger');
      return;
    }

    const newId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    vault.categories.push({
      id: newId,
      name: cleanName,
      icon: icon,
      color: color
    });
    showToast(`Categoría "${cleanName}" creada.`, 'success');
  }

  saveAndRefreshVault();
  updateCategoryDropdowns();
  renderCategoriesSidebar();
  renderCategoriesList();
  cancelCategoryEdit();
}

function confirmDeleteCategory(cat, count) {
  if (cat.id === 'other') return;

  categoryToDelete = cat;
  
  if (count === 0) {
    openConfirmModal(
      'Eliminar Categoría',
      `¿Deseas eliminar la categoría vacía "${cat.name}"?`,
      () => {
        vault.categories = vault.categories.filter(c => c.id !== cat.id);
        saveAndRefreshVault();
        updateCategoryDropdowns();
        renderCategoriesSidebar();
        renderCategoriesList();
        showToast(`Categoría "${cat.name}" eliminada.`, 'success');
      }
    );
    return;
  }

  dom.deleteCategoryMsg.innerHTML = `La categoría <strong>"${escapeHtml(cat.name)}"</strong> tiene <strong>${count} cuenta${count !== 1 ? 's' : ''}</strong> asociada${count !== 1 ? 's' : ''}. ¿Qué deseas hacer con ellas?`;
  
  dom.deleteCategoryTransferSelect.innerHTML = '';
  vault.categories.forEach(c => {
    if (c.id !== cat.id) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      dom.deleteCategoryTransferSelect.appendChild(opt);
    }
  });

  const radioTransfer = dom.deleteCategoryConfirmModal.querySelector('input[value="transfer"]');
  if (radioTransfer) radioTransfer.checked = true;
  dom.deleteCategoryTransferGroup.classList.remove('hidden');

  dom.deleteCategoryConfirmModal.classList.remove('hidden');
}

function setupDeleteCategoryEvents() {
  const transferRadios = dom.deleteCategoryConfirmModal.querySelectorAll('input[name="delete-category-action"]');
  transferRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'transfer') {
        dom.deleteCategoryTransferGroup.classList.remove('hidden');
      } else {
        dom.deleteCategoryTransferGroup.classList.add('hidden');
      }
    });
  });

  dom.btnCancelDeleteCategory.addEventListener('click', () => {
    dom.deleteCategoryConfirmModal.classList.add('hidden');
    categoryToDelete = null;
  });

  dom.btnConfirmDeleteCategory.addEventListener('click', () => {
    if (!categoryToDelete) return;

    const action = dom.deleteCategoryConfirmModal.querySelector('input[name="delete-category-action"]:checked').value;
    
    if (action === 'transfer') {
      const targetCatId = dom.deleteCategoryTransferSelect.value;
      const targetCat = vault.categories.find(c => c.id === targetCatId);
      
      vault.accounts.forEach(acc => {
        if (acc.category === categoryToDelete.id) {
          acc.category = targetCatId;
        }
      });
      
      vault.categories = vault.categories.filter(c => c.id !== categoryToDelete.id);
      showToast(`Cuentas transferidas a "${targetCat.name}" y categoría eliminada.`, 'success');
    } else if (action === 'delete') {
      vault.accounts = vault.accounts.filter(acc => acc.category !== categoryToDelete.id);
      vault.categories = vault.categories.filter(c => c.id !== categoryToDelete.id);
      showToast(`Categoría y cuentas asociadas eliminadas.`, 'success');
    }

    if (activeCategory === categoryToDelete.id) {
      activeCategory = 'all';
    }

    saveAndRefreshVault();
    updateCategoryDropdowns();
    renderCategoriesSidebar();
    renderCategoriesList();
    selectAccount(null);

    dom.deleteCategoryConfirmModal.classList.add('hidden');
    categoryToDelete = null;
  });
}

// ESCAPADO DE HTML PARA PREVENIR XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- UTILIDADES DE TRADUCCIÓN DE COLOR (HEX <> HSL) ---
function hexToHsl(hex) {
  hex = hex.replace(/^#/, '');

  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hslToHex(hslStr) {
  const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#2563eb';
  
  let h = parseInt(match[1]) / 360;
  let s = parseInt(match[2]) / 100;
  let l = parseInt(match[3]) / 100;
  
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- GESTIÓN DE TEMAS (OSCURO / CLARO) ---
function initTheme() {
  const savedTheme = localStorage.getItem('zentry_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    updateThemeToggleButton(true);
  } else {
    document.body.classList.remove('light-theme');
    updateThemeToggleButton(false);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('zentry_theme', isLight ? 'light' : 'dark');
  updateThemeToggleButton(isLight);
  showToast(isLight ? 'Modo claro activado.' : 'Modo oscuro activado.', 'success');
}

function updateThemeToggleButton(isLight) {
  const btn = dom.btnToggleTheme;
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }
}

// --- CONFIGURACIÓN DE USUARIO (CONFIGURACIÓN DE CUENTA) ---
function setupUserProfileEvents() {
  const modal = document.getElementById('user-panel-modal');
  const btnOpen = document.getElementById('btn-user-panel');
  const btnClose = document.getElementById('btn-close-user-panel');
  
  // Formulario de Usuario
  const renameForm = document.getElementById('change-username-form');
  const newUsernameInput = document.getElementById('new-profile-username');
  
  // Formulario de Contraseña Maestra
  const changePasswordForm = document.getElementById('change-password-form');
  const currentPasswordInput = document.getElementById('current-master-password');
  const newPasswordInput = document.getElementById('new-master-password');
  const newPasswordConfirmInput = document.getElementById('new-master-password-confirm');
  const toggleCurrentPasswordBtn = document.getElementById('toggle-current-password');
  const toggleNewPasswordBtn = document.getElementById('toggle-new-password');
  
  // Generador de Contraseña Maestra
  const btnToggleGenerator = document.getElementById('btn-toggle-user-generator');
  const generatorPanel = document.getElementById('user-generator-panel');
  const genPasswordPreview = document.getElementById('user-gen-password-preview');
  const btnRegenerate = document.getElementById('btn-user-regenerate-password');
  const btnUseGen = document.getElementById('btn-user-use-gen-password');
  const genLengthInput = document.getElementById('user-gen-length');
  const genLengthVal = document.getElementById('user-gen-length-val');
  const genUpper = document.getElementById('user-gen-upper');
  const genLower = document.getElementById('user-gen-lower');
  const genNumbers = document.getElementById('user-gen-numbers');
  const genSymbols = document.getElementById('user-gen-symbols');
  const strengthBar = document.getElementById('user-strength-bar') ? document.getElementById('user-strength-bar').firstElementChild : null;
  const strengthText = document.getElementById('user-strength-text');
  
  // Clave de Recuperación
  const revealPasswordInput = document.getElementById('reveal-recovery-password-input');
  const btnRevealRecovery = document.getElementById('btn-reveal-recovery');
  const recoveryWrapper = document.getElementById('revealed-recovery-key-wrapper');
  const recoveryKeyText = document.getElementById('revealed-recovery-key-text');
  const btnCopyRecovery = document.getElementById('btn-copy-revealed-recovery');

  // Helper para generar contraseña de usuario
  function generateUserPassword() {
    const length = parseInt(genLengthInput.value);
    const includeUpper = genUpper.checked;
    const includeLower = genLower.checked;
    const includeNumbers = genNumbers.checked;
    const includeSymbols = genSymbols.checked;

    const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
    const numberChars = '23456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charSet = '';
    let mandatory = [];

    if (includeUpper) {
      charSet += upperChars;
      mandatory.push(upperChars[Math.floor(Math.random() * upperChars.length)]);
    }
    if (includeLower) {
      charSet += lowerChars;
      mandatory.push(lowerChars[Math.floor(Math.random() * lowerChars.length)]);
    }
    if (includeNumbers) {
      charSet += numberChars;
      mandatory.push(numberChars[Math.floor(Math.random() * numberChars.length)]);
    }
    if (includeSymbols) {
      charSet += symbolChars;
      mandatory.push(symbolChars[Math.floor(Math.random() * symbolChars.length)]);
    }

    if (charSet === '') {
      genPasswordPreview.textContent = 'Selecciona alguna opción';
      return;
    }

    let generatedPassword = '';
    generatedPassword += mandatory.join('');

    const remainingLength = length - mandatory.length;
    if (remainingLength > 0) {
      const randomValues = new Uint32Array(remainingLength);
      crypto.getRandomValues(randomValues);

      for (let i = 0; i < remainingLength; i++) {
        generatedPassword += charSet[randomValues[i] % charSet.length];
      }
    }

    const shuffledPassword = generatedPassword.split('').sort(() => 0.5 - Math.random()).join('');
    genPasswordPreview.textContent = shuffledPassword;
  }

  // Abrir Modal
  btnOpen.addEventListener('click', () => {
    const activeUser = Storage.getActiveUser();
    newUsernameInput.value = activeUser || '';
    
    // Limpiar campos
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    newPasswordConfirmInput.value = '';
    revealPasswordInput.value = '';
    
    if (strengthBar) strengthBar.style.width = '0';
    if (strengthText) strengthText.textContent = 'Fuerza de contraseña';
    
    generatorPanel.classList.add('hidden');
    recoveryWrapper.classList.add('hidden');
    
    // Actualizar sincronización en la nube en UI
    if (activeUser) {
      updateSyncUI(activeUser);
    }
    
    modal.classList.remove('hidden');
  });

  // Cerrar Modal
  btnClose.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Cerrar haciendo clic afuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  // Toggles de visibilidad de contraseña
  toggleCurrentPasswordBtn.addEventListener('click', () => {
    const type = currentPasswordInput.type === 'password' ? 'text' : 'password';
    currentPasswordInput.type = type;
    const icon = toggleCurrentPasswordBtn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  toggleNewPasswordBtn.addEventListener('click', () => {
    const type = newPasswordInput.type === 'password' ? 'text' : 'password';
    newPasswordInput.type = type;
    const icon = toggleNewPasswordBtn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons();
  });

  // Renombrar Usuario
  renameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const oldUsername = Storage.getActiveUser();
    const newUsername = newUsernameInput.value.trim();
    if (!newUsername) return;

    try {
      Storage.renameUser(oldUsername, newUsername);
      const usernameDisplay = document.getElementById('active-username-display');
      if (usernameDisplay) {
        usernameDisplay.textContent = newUsername;
      }
      showToast('Nombre de usuario actualizado con éxito.', 'success');
      modal.classList.add('hidden');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Medidor de fuerza de nueva contraseña maestra
  newPasswordInput.addEventListener('input', () => {
    const pwd = newPasswordInput.value;
    const strength = evaluatePasswordStrength(pwd);
    if (strengthBar) {
      strengthBar.style.width = `${(strength.score / 4) * 100}%`;
      strengthBar.style.backgroundColor = strength.color;
    }
    if (strengthText) {
      strengthText.textContent = strength.label;
    }
  });

  // Generador de Contraseña
  btnToggleGenerator.addEventListener('click', () => {
    generatorPanel.classList.toggle('hidden');
    if (!generatorPanel.classList.contains('hidden')) {
      generateUserPassword();
    }
  });

  genLengthInput.addEventListener('input', () => {
    genLengthVal.textContent = genLengthInput.value;
    generateUserPassword();
  });

  [genUpper, genLower, genNumbers, genSymbols].forEach(cb => {
    cb.addEventListener('change', generateUserPassword);
  });

  btnRegenerate.addEventListener('click', generateUserPassword);

  btnUseGen.addEventListener('click', () => {
    const pwd = genPasswordPreview.textContent;
    if (pwd && pwd !== 'Selecciona alguna opción') {
      newPasswordInput.value = pwd;
      newPasswordConfirmInput.value = pwd;
      newPasswordInput.type = 'text';
      
      const strength = evaluatePasswordStrength(pwd);
      if (strengthBar) {
        strengthBar.style.width = `${(strength.score / 4) * 100}%`;
        strengthBar.style.backgroundColor = strength.color;
      }
      if (strengthText) {
        strengthText.textContent = strength.label;
      }

      const icon = toggleNewPasswordBtn.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
      if (window.lucide) window.lucide.createIcons();

      generatorPanel.classList.add('hidden');
      showToast('Contraseña maestra generada aplicada a ambos campos.', 'success');
    }
  });

  // Cambiar Contraseña Maestra
  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeUser = Storage.getActiveUser();
    const currentMaster = currentPasswordInput.value;
    const newMaster = newPasswordInput.value;
    const newMasterConfirm = newPasswordConfirmInput.value;

    if (newMaster !== newMasterConfirm) {
      showToast('Las nuevas contraseñas no coinciden.', 'danger');
      return;
    }

    if (newMaster.length < 8) {
      showToast('La nueva contraseña debe tener al menos 8 caracteres.', 'danger');
      return;
    }

    try {
      // Intentar obtener la clave de recuperación para validar la contraseña actual
      const recoveryKey = await Storage.getOrGenerateRecoveryKey(activeUser, currentMaster);
      
      // Actualizar la contraseña maestra
      await Storage.updateMasterPassword(activeUser, newMaster, recoveryKey);
      
      showToast('Contraseña maestra actualizada con éxito.', 'success');
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      newPasswordConfirmInput.value = '';
      modal.classList.add('hidden');
    } catch (err) {
      showToast('Error al actualizar: Contraseña actual incorrecta.', 'danger');
    }
  });

  // Revelar Clave de Recuperación
  btnRevealRecovery.addEventListener('click', async () => {
    const activeUser = Storage.getActiveUser();
    const password = revealPasswordInput.value;
    if (!password) {
      showToast('Por favor ingresa tu contraseña maestra.', 'danger');
      return;
    }

    try {
      const recoveryKey = await Storage.getOrGenerateRecoveryKey(activeUser, password);
      recoveryKeyText.textContent = recoveryKey;
      recoveryWrapper.classList.remove('hidden');
      revealPasswordInput.value = '';
      showToast('Clave de recuperación revelada.', 'success');
    } catch (err) {
      showToast('Contraseña maestra incorrecta.', 'danger');
    }
  });

  // Copiar Clave de Recuperación
  btnCopyRecovery.addEventListener('click', () => {
    const key = recoveryKeyText.textContent;
    if (key && key !== 'ZENT-XXXX-XXXX-XXXX-XXXX') {
      navigator.clipboard.writeText(key)
        .then(() => {
          showToast('Clave de recuperación copiada.', 'success');
          triggerCopyFeedback(btnCopyRecovery);
        })
        .catch(() => showToast('Error al copiar.', 'danger'));
    }
  });
}

// --- INTEGRACIÓN Y AYUDANTES DE GOOGLE DRIVE (SINCRONIZACIÓN EN LA NUBE) ---

function initGDriveClient() {
  const clientId = GDrive.getClientId();
  if (clientId) {
    const activeUser = Storage.getActiveUser();
    GDrive.init(clientId, (token) => {
      console.log("Auto-Init: Token de Google obtenido.");
      if (activeUser) {
        updateSyncUI(activeUser);
      }
    });
  }
}

function updateSyncUI(username) {
  const isLinked = GDrive.isLinked(username);
  const clientId = GDrive.getClientId();
  
  const syncClientId = document.getElementById('sync-client-id');
  const syncStatusDot = document.getElementById('sync-status-dot');
  const syncStatusText = document.getElementById('sync-status-text');
  const btnSyncLink = document.getElementById('btn-sync-link');
  const btnSyncUnlink = document.getElementById('btn-sync-unlink');
  const syncActionsPanel = document.getElementById('sync-actions-panel');
  const syncAutoToggle = document.getElementById('sync-auto-toggle');
  const syncLastTime = document.getElementById('sync-last-time');

  if (syncClientId) syncClientId.value = clientId;

  if (isLinked) {
    if (syncStatusDot) syncStatusDot.style.backgroundColor = 'var(--success)';
    if (syncStatusText) syncStatusText.textContent = 'Vinculado a Google Drive';
    if (btnSyncLink) btnSyncLink.classList.add('hidden');
    if (btnSyncUnlink) btnSyncUnlink.classList.remove('hidden');
    if (syncActionsPanel) syncActionsPanel.classList.remove('hidden');
    
    const autoSync = GDrive.isAutoSyncEnabled(username);
    if (syncAutoToggle) syncAutoToggle.checked = autoSync;
    
    const lastSync = localStorage.getItem(`zentry_one_gdrive_last_sync_${username}`);
    if (syncLastTime) {
      syncLastTime.textContent = lastSync ? `Última sincronización: ${lastSync}` : 'Última sincronización: Nunca';
    }
  } else {
    if (syncStatusDot) syncStatusDot.style.backgroundColor = 'var(--text-muted)';
    if (syncStatusText) syncStatusText.textContent = 'No Vinculado';
    if (btnSyncLink) btnSyncLink.classList.remove('hidden');
    if (btnSyncUnlink) btnSyncUnlink.classList.add('hidden');
    if (syncActionsPanel) syncActionsPanel.classList.add('hidden');
  }
}

function setupGDriveEventListeners() {
  // 1. Botones del Modal de Perfil (Sincronización)
  const btnSyncLink = document.getElementById('btn-sync-link');
  const btnSyncUnlink = document.getElementById('btn-sync-unlink');
  const syncClientId = document.getElementById('sync-client-id');
  const syncAutoToggle = document.getElementById('sync-auto-toggle');
  const btnSyncPush = document.getElementById('btn-sync-push');
  const btnSyncPull = document.getElementById('btn-sync-pull');
  const btnSyncMerge = document.getElementById('btn-sync-merge');

  // Vincular cuenta
  if (btnSyncLink) {
    btnSyncLink.addEventListener('click', async () => {
      const clientId = syncClientId.value.trim();
      const user = Storage.getActiveUser();
      if (!clientId) {
        showToast('Por favor ingresa un Google Client ID válido.', 'danger');
        return;
      }
      if (!user) return;

      GDrive.saveClientId(clientId);
      showToast('Autenticando con Google...', 'info');

      try {
        const success = GDrive.init(clientId);
        if (!success) throw new Error("No se pudo cargar el cliente de Google.");
        
        const token = await GDrive.authenticate();
        GDrive.setLinked(user, true);
        GDrive.setAutoSyncEnabled(user, true); // Activar por defecto

        showToast('Buscando bóvedas existentes en Drive...', 'info');
        const file = await GDrive.findFile(user, token);
        if (file) {
          GDrive.saveFileId(user, file.id);
          await executeCloudMerge(user, token, file.id);
          showToast('Google Drive vinculado. Se fusionaron tus datos locales y de la nube.', 'success');
        } else {
          await executeCloudPush(user, token);
          showToast('Google Drive vinculado. Bóveda inicial creada en la nube.', 'success');
        }
        
        // Actualizar UI
        updateSyncUI(user);
        loadAndDisplayVault();
      } catch (err) {
        showToast('Error al vincular Google Drive: ' + err.message, 'danger');
        GDrive.setLinked(user, false);
        updateSyncUI(user);
      }
    });
  }

  // Desvincular cuenta
  if (btnSyncUnlink) {
    btnSyncUnlink.addEventListener('click', () => {
      const user = Storage.getActiveUser();
      if (!user) return;
      openConfirmModal(
        'Desvincular Google Drive',
        '¿Estás seguro de que deseas desvincular Google Drive? Se detendrá la sincronización automática, pero tu bóveda local no se borrará.',
        () => {
          GDrive.setLinked(user, false);
          updateSyncUI(user);
          
          const roleDisplay = document.getElementById('active-user-role-display');
          if (roleDisplay) {
            roleDisplay.textContent = 'Sesión Local';
            roleDisplay.style.color = 'var(--text-muted)';
          }
          
          showToast('Google Drive desvinculado.', 'info');
        }
      );
    });
  }

  // Activar/desactivar auto-sync
  if (syncAutoToggle) {
    syncAutoToggle.addEventListener('change', () => {
      const user = Storage.getActiveUser();
      if (!user) return;
      const enabled = syncAutoToggle.checked;
      GDrive.setAutoSyncEnabled(user, enabled);
      showToast(enabled ? 'Sincronización automática activada.' : 'Sincronización automática desactivada.', 'info');
    });
  }

  // Push manual
  if (btnSyncPush) {
    btnSyncPush.addEventListener('click', async () => {
      const user = Storage.getActiveUser();
      if (!user) return;
      btnSyncPush.disabled = true;
      showToast('Subiendo bóveda a Google Drive...', 'info');
      try {
        await GDrive.executeWithRetry(async (token) => {
          await executeCloudPush(user, token);
        });
        showToast('Bóveda local subida con éxito.', 'success');
        updateSyncUI(user);
      } catch (err) {
        showToast('Error al subir bóveda: ' + err.message, 'danger');
      } finally {
        btnSyncPush.disabled = false;
      }
    });
  }

  // Pull manual
  if (btnSyncPull) {
    btnSyncPull.addEventListener('click', () => {
      const user = Storage.getActiveUser();
      if (!user) return;
      
      openConfirmModal(
        'Descargar desde la Nube',
        'Esta acción sobrescribirá todos tus datos locales con la versión de Google Drive. Los datos locales que no hayan sido respaldados se perderán. ¿Continuar?',
        async () => {
          btnSyncPull.disabled = true;
          showToast('Descargando bóveda...', 'info');
          try {
            await GDrive.executeWithRetry(async (token) => {
              const fileId = GDrive.getFileId(user) || (await GDrive.findFile(user, token))?.id;
              if (!fileId) throw new Error("No se encontró bóveda en la nube para descargar.");
              GDrive.saveFileId(user, fileId);
              await executeCloudPull(user, token, fileId);
            });
            showToast('Bóveda descargada con éxito.', 'success');
            loadAndDisplayVault();
            updateSyncUI(user);
          } catch (err) {
            showToast('Error al descargar: ' + err.message, 'danger');
          } finally {
            btnSyncPull.disabled = false;
          }
        }
      );
    });
  }

  // Merge manual
  if (btnSyncMerge) {
    btnSyncMerge.addEventListener('click', async () => {
      const user = Storage.getActiveUser();
      if (!user) return;
      btnSyncMerge.disabled = true;
      showToast('Combinando datos local y nube...', 'info');
      try {
        await GDrive.executeWithRetry(async (token) => {
          const fileId = GDrive.getFileId(user) || (await GDrive.findFile(user, token))?.id;
          await executeCloudMerge(user, token, fileId);
        });
        showToast('Sincronización por fusión completada.', 'success');
        loadAndDisplayVault();
        updateSyncUI(user);
      } catch (err) {
        showToast('Error al combinar datos: ' + err.message, 'danger');
      } finally {
        btnSyncMerge.disabled = false;
      }
    });
  }

  // 2. Eventos de Restauración en Pantalla de Login (Dispositivo Nuevo)
  const btnRestoreCloudTrigger = document.getElementById('btn-restore-cloud-trigger');
  const restoreCloudModal = document.getElementById('restore-cloud-modal');
  const btnCloseRestoreCloud = document.getElementById('btn-close-restore-cloud');
  const restoreStep1 = document.getElementById('restore-step-1');
  const restoreStep2 = document.getElementById('restore-step-2');
  const restoreStep3 = document.getElementById('restore-step-3');
  const restoreClientId = document.getElementById('restore-client-id');
  const btnRestoreConnect = document.getElementById('btn-restore-connect');
  const restoreVaultsList = document.getElementById('restore-vaults-list');
  const btnRestoreBack = document.getElementById('btn-restore-back');
  const btnRestoreFinish = document.getElementById('btn-restore-finish');

  let restoreToken = null;

  if (btnRestoreCloudTrigger) {
    btnRestoreCloudTrigger.addEventListener('click', () => {
      const savedClientId = GDrive.getClientId();
      if (restoreClientId) restoreClientId.value = savedClientId;

      if (restoreStep1) restoreStep1.classList.remove('hidden');
      if (restoreStep2) restoreStep2.classList.add('hidden');
      if (restoreStep3) restoreStep3.classList.add('hidden');
      
      if (restoreCloudModal) restoreCloudModal.classList.remove('hidden');
    });
  }

  if (btnCloseRestoreCloud) {
    btnCloseRestoreCloud.addEventListener('click', () => {
      if (restoreCloudModal) restoreCloudModal.classList.add('hidden');
    });
  }

  if (btnRestoreConnect) {
    btnRestoreConnect.addEventListener('click', async () => {
      const clientId = restoreClientId.value.trim();
      if (!clientId) {
        showToast('Ingresa un Google Client ID válido.', 'danger');
        return;
      }
      GDrive.saveClientId(clientId);
      btnRestoreConnect.disabled = true;
      showToast('Conectando con Google...', 'info');

      try {
        const success = GDrive.init(clientId);
        if (!success) throw new Error("No se pudo cargar la API de Google.");
        
        restoreToken = await GDrive.authenticate();
        showToast('Buscando copias de seguridad...', 'info');

        const files = await GDrive.listAllVaultFiles(restoreToken);
        if (files.length === 0) {
          showToast('No se encontraron copias de seguridad en esta cuenta.', 'warning');
          btnRestoreConnect.disabled = false;
          return;
        }

        if (restoreVaultsList) {
          restoreVaultsList.innerHTML = '';
          files.forEach(file => {
            const match = file.name.match(/zentryone_vault_(.+)\.json/);
            const user = match ? match[1] : 'Usuario desconocido';
            const dateStr = new Date(file.modifiedTime).toLocaleString();

            const item = document.createElement('div');
            item.className = 'vault-list-item';
            item.style.cssText = 'padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: background-color 0.2s;';
            item.innerHTML = `
              <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${user}</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">Modificado: ${dateStr}</div>
            `;
            
            item.onmouseover = () => item.style.backgroundColor = 'var(--bg-hover)';
            item.onmouseout = () => item.style.backgroundColor = '';

            item.addEventListener('click', async () => {
              showToast(`Descargando bóveda de ${user}...`, 'info');
              try {
                const bundle = await GDrive.downloadFile(file.id, restoreToken);
                restoreVaultBundle(bundle);
                GDrive.setLinked(user, true);
                GDrive.saveFileId(user, file.id);
                GDrive.setAutoSyncEnabled(user, true);

                if (restoreStep2) restoreStep2.classList.add('hidden');
                if (restoreStep3) restoreStep3.classList.remove('hidden');
              } catch (ex) {
                showToast('Error al restaurar: ' + ex.message, 'danger');
              }
            });

            restoreVaultsList.appendChild(item);
          });
        }

        if (restoreStep1) restoreStep1.classList.add('hidden');
        if (restoreStep2) restoreStep2.classList.remove('hidden');
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'danger');
      } finally {
        btnRestoreConnect.disabled = false;
      }
    });
  }

  if (btnRestoreBack) {
    btnRestoreBack.addEventListener('click', () => {
      if (restoreStep2) restoreStep2.classList.add('hidden');
      if (restoreStep1) restoreStep1.classList.remove('hidden');
    });
  }

  if (btnRestoreFinish) {
    btnRestoreFinish.addEventListener('click', () => {
      if (restoreCloudModal) restoreCloudModal.classList.add('hidden');
      initApp();
    });
  }
}

function getVaultBundle(username) {
  const normalized = username.toLowerCase().trim();
  return {
    username: normalized,
    master: JSON.parse(localStorage.getItem(`zentry_one_vault_key_${normalized}_master`)),
    recovery: JSON.parse(localStorage.getItem(`zentry_one_vault_key_${normalized}_recovery`)),
    recovery_wrapped: JSON.parse(localStorage.getItem(`zentry_one_recovery_wrapped_${normalized}`)),
    vault: JSON.parse(localStorage.getItem(`zentry_one_vault_${normalized}`)),
    lastUpdated: new Date().toISOString()
  };
}

function restoreVaultBundle(bundle) {
  const normalized = bundle.username.toLowerCase().trim();
  localStorage.setItem(`zentry_one_vault_key_${normalized}_master`, JSON.stringify(bundle.master));
  localStorage.setItem(`zentry_one_vault_key_${normalized}_recovery`, JSON.stringify(bundle.recovery));
  localStorage.setItem(`zentry_one_recovery_wrapped_${normalized}`, JSON.stringify(bundle.recovery_wrapped));
  localStorage.setItem(`zentry_one_vault_${normalized}`, JSON.stringify(bundle.vault));
  Storage.addUser(normalized);
}

async function executeCloudPush(username, token) {
  const bundle = getVaultBundle(username);
  let fileId = GDrive.getFileId(username);

  if (!fileId) {
    const file = await GDrive.findFile(username, token);
    if (file) {
      fileId = file.id;
      GDrive.saveFileId(username, fileId);
    }
  }

  if (fileId) {
    await GDrive.updateFileContent(fileId, bundle, token);
  } else {
    const newId = await GDrive.createFile(username, bundle, token);
    GDrive.saveFileId(username, newId);
  }

  localStorage.setItem(`zentry_one_gdrive_last_sync_${username}`, new Date().toLocaleString());
}

async function executeCloudPull(username, token, fileId) {
  const bundle = await GDrive.downloadFile(fileId, token);
  restoreVaultBundle(bundle);
  localStorage.setItem(`zentry_one_gdrive_last_sync_${username}`, new Date().toLocaleString());
}

async function executeCloudMerge(username, token, fileId) {
  if (!fileId) {
    await executeCloudPush(username, token);
    return;
  }

  const cloudBundle = await GDrive.downloadFile(fileId, token);
  if (!cloudBundle || !cloudBundle.vault) return;

  const tempKey = `zentry_one_vault_${username}`;
  const originalLocalPayload = localStorage.getItem(tempKey);

  let decryptedCloudVault = { accounts: [], categories: [], workspaces: [] };
  try {
    localStorage.setItem(tempKey, JSON.stringify(cloudBundle.vault));
    decryptedCloudVault = await Storage.loadVault();
  } catch (err) {
    console.error("Error al descifrar bóveda de la nube para fusionar:", err);
  } finally {
    if (originalLocalPayload) {
      localStorage.setItem(tempKey, originalLocalPayload);
    } else {
      localStorage.removeItem(tempKey);
    }
  }

  const localVault = vault;
  const mergedVault = mergeVaults(localVault, decryptedCloudVault);

  const localCount = localVault.accounts ? localVault.accounts.length : 0;
  const mergedCount = mergedVault.accounts ? mergedVault.accounts.length : 0;
  
  vault = mergedVault;
  await Storage.saveVault(vault);
  
  const newBundle = getVaultBundle(username);
  await GDrive.updateFileContent(fileId, newBundle, token);

  if (mergedCount !== localCount) {
    refreshAccountsList();
    updateSidebarBadges();
    renderSecurityDashboard();
    showToast(`Bóveda sincronizada con éxito (${mergedCount - localCount} cuentas nuevas importadas).`, 'success');
  }
}

async function triggerAutoSyncPullAndMerge(username) {
  const roleDisplay = document.getElementById('active-user-role-display');
  if (roleDisplay) {
    roleDisplay.textContent = 'Sincronizando...';
    roleDisplay.style.color = 'var(--primary-glow)';
  }

  try {
    let fileId = GDrive.getFileId(username);
    await GDrive.executeWithRetry(async (token) => {
      if (!fileId) {
        const file = await GDrive.findFile(username, token);
        if (file) {
          fileId = file.id;
          GDrive.saveFileId(username, fileId);
        }
      }
      
      if (fileId) {
        await executeCloudMerge(username, token, fileId);
      } else {
        await executeCloudPush(username, token);
      }
    });

    if (roleDisplay) {
      roleDisplay.textContent = 'Drive Sincronizado';
      roleDisplay.style.color = 'var(--success)';
    }
    localStorage.setItem(`zentry_one_gdrive_last_sync_${username}`, new Date().toLocaleString());
  } catch (err) {
    console.error("Error en sincronización automática inicial:", err);
    if (roleDisplay) {
      roleDisplay.textContent = 'Sesión Local';
      roleDisplay.style.color = 'var(--text-muted)';
    }
  }
}

let isSyncing = false;
let pendingSyncUser = null;

async function triggerAutoSyncPush(username) {
  if (isSyncing) {
    pendingSyncUser = username;
    return;
  }

  isSyncing = true;
  const roleDisplay = document.getElementById('active-user-role-display');
  if (roleDisplay) {
    roleDisplay.textContent = 'Sincronizando...';
    roleDisplay.style.color = 'var(--primary-glow)';
  }

  try {
    await GDrive.executeWithRetry(async (token) => {
      await executeCloudPush(username, token);
    });
    
    if (roleDisplay) {
      roleDisplay.textContent = 'Drive Sincronizado';
      roleDisplay.style.color = 'var(--success)';
    }
    localStorage.setItem(`zentry_one_gdrive_last_sync_${username}`, new Date().toLocaleString());
  } catch (err) {
    console.error("Error en sincronización automática al guardar:", err);
    if (roleDisplay) {
      roleDisplay.textContent = 'Sesión Local (Pendiente)';
      roleDisplay.style.color = 'var(--danger)';
    }
  } finally {
    isSyncing = false;
    if (pendingSyncUser) {
      const nextUser = pendingSyncUser;
      pendingSyncUser = null;
      triggerAutoSyncPush(nextUser);
    }
  }
}

function mergeVaults(local, cloud) {
  const merged = {
    workspaces: local.workspaces ? [...local.workspaces] : [{ id: 'default', name: 'General' }],
    categories: local.categories ? [...local.categories] : [],
    accounts: local.accounts ? [...local.accounts] : []
  };

  if (cloud.workspaces && Array.isArray(cloud.workspaces)) {
    cloud.workspaces.forEach(cWs => {
      if (cWs && cWs.id && !merged.workspaces.some(lWs => lWs.id === cWs.id)) {
        merged.workspaces.push(cWs);
      }
    });
  }

  if (cloud.categories && Array.isArray(cloud.categories)) {
    cloud.categories.forEach(cCg => {
      if (cCg && cCg.id && !merged.categories.some(lCg => lCg.id === cCg.id)) {
        merged.categories.push(cCg);
      }
    });
  }

  if (cloud.accounts && Array.isArray(cloud.accounts)) {
    cloud.accounts.forEach(cAc => {
      if (!cAc || !cAc.id) return;
      const existingIdx = merged.accounts.findIndex(lAc => lAc.id === cAc.id);
      if (existingIdx === -1) {
        merged.accounts.push(cAc);
      } else {
        const localTime = getNewestHistoryTimestamp(merged.accounts[existingIdx]);
        const cloudTime = getNewestHistoryTimestamp(cAc);
        if (cloudTime > localTime) {
          merged.accounts[existingIdx] = cAc;
        }
      }
    });
  }

  return merged;
}

function getNewestHistoryTimestamp(account) {
  if (!account || !account.history || !Array.isArray(account.history) || account.history.length === 0) return 0;
  let newest = 0;
  account.history.forEach(h => {
    if (h && h.timestamp) {
      const t = new Date(h.timestamp).getTime();
      if (!isNaN(t) && t > newest) {
        newest = t;
      }
    }
  });
  return newest;
}

function clearDragOverClasses() {
  document.querySelectorAll('.drag-over-above').forEach(el => el.classList.remove('drag-over-above'));
  document.querySelectorAll('.drag-over-below').forEach(el => el.classList.remove('drag-over-below'));
}
