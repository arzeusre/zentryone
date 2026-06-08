/**
 * storage.js
 * Capa de abstracción de datos para el gestor de contraseñas Zentry One.
 * Implementa almacenamiento multiusuario local aislado (Zero-Knowledge)
 * y flujo de recuperación mediante Clave de Emergencia.
 */

import { encryptData, decryptData } from './crypto.js';

// Estado de sesión en memoria (se pierde al recargar)
let activeVaultKey = null;
let activeUsername = null;

export const Storage = {
  // --- GESTIÓN DE USUARIOS ---
  /**
   * Obtiene la lista de usuarios registrados.
   * @returns {string[]}
   */
  getUsers() {
    try {
      const usersRaw = localStorage.getItem('zentry_one_users');
      return usersRaw ? JSON.parse(usersRaw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Comprueba si existe un usuario registrado.
   * @param {string} username 
   * @returns {boolean}
   */
  hasUser(username) {
    const users = this.getUsers();
    return users.includes(username.toLowerCase().trim());
  },

  /**
   * Agrega un usuario a la lista de registros.
   * @param {string} username 
   */
  addUser(username) {
    const users = this.getUsers();
    const normalized = username.toLowerCase().trim();
    if (!users.includes(normalized)) {
      users.push(normalized);
      localStorage.setItem('zentry_one_users', JSON.stringify(users));
    }
  },

  // --- MÉTODOS DE CRIPTOGRAFÍA DE BÓVEDA ---
  /**
   * Genera una clave aleatoria fuerte de 256 bits codificada en Base64.
   * @returns {string}
   */
  generateVaultKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes));
  },

  /**
   * Genera una clave de recuperación estructurada ZENT-XXXX-XXXX-XXXX-XXXX.
   * @returns {string}
   */
  generateRecoveryKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitar caracteres confusos
    const part = () => {
      let str = '';
      for (let i = 0; i < 4; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        str += chars[idx];
      }
      return str;
    };
    return `ZENT-${part()}-${part()}-${part()}-${part()}`;
  },

  // --- REGISTRO, LOGIN Y RECUPERACIÓN ---
  /**
   * Registra un nuevo usuario, genera su vaultKey aleatoria y la envuelve (wrap)
   * con la contraseña maestra y la clave de recuperación.
   * @param {string} username 
   * @param {string} masterPassword 
   * @param {string} [recoveryKeyInput]
   * @returns {Promise<string>} - Clave de recuperación generada.
   */
  async registerUser(username, masterPassword, recoveryKeyInput = null) {
    const normalized = username.toLowerCase().trim();
    const recoveryKey = recoveryKeyInput || this.generateRecoveryKey();
    
    // Generar la clave simétrica maestra para la bóveda de este usuario
    const vaultKey = this.generateVaultKey();
    
    // Envolver la clave de la bóveda usando la contraseña maestra del usuario
    const masterPayload = await encryptData(vaultKey, masterPassword);
    localStorage.setItem(`zentry_one_vault_key_${normalized}_master`, JSON.stringify(masterPayload));
    
    // Envolver la clave de la bóveda usando la clave de recuperación de emergencia
    const recoveryPayload = await encryptData(vaultKey, recoveryKey);
    localStorage.setItem(`zentry_one_vault_key_${normalized}_recovery`, JSON.stringify(recoveryPayload));

    // Envolver la clave de recuperación usando la contraseña maestra del usuario (para poder revelarla)
    const recoveryWrappedPayload = await encryptData(recoveryKey, masterPassword);
    localStorage.setItem(`zentry_one_recovery_wrapped_${normalized}`, JSON.stringify(recoveryWrappedPayload));
    
    // Crear bóveda inicial vacía cifrada con la clave de la bóveda
    const initialVault = {
      accounts: [],
      categories: [],
      workspaces: [{ id: 'default', name: 'General' }]
    };
    const vaultPayload = await encryptData(JSON.stringify(initialVault), vaultKey);
    localStorage.setItem(`zentry_one_vault_${normalized}`, JSON.stringify(vaultPayload));
    
    // Añadir a la lista de usuarios del navegador
    this.addUser(normalized);
    
    // Autenticar automáticamente al registrar
    activeVaultKey = vaultKey;
    activeUsername = normalized;
    
    return recoveryKey;
  },

  /**
   * Autentica a un usuario descifrando su vaultKey con la contraseña maestra.
   * @param {string} username 
   * @param {string} masterPassword 
   * @returns {Promise<boolean>}
   */
  async loginUser(username, masterPassword) {
    const normalized = username.toLowerCase().trim();
    if (!this.hasUser(normalized)) {
      throw new Error('El usuario ingresado no existe en este dispositivo.');
    }
    
    const keyRaw = localStorage.getItem(`zentry_one_vault_key_${normalized}_master`);
    if (!keyRaw) {
      throw new Error('No se encontró la clave maestra del usuario.');
    }
    
    try {
      const payload = JSON.parse(keyRaw);
      const vaultKey = await decryptData(payload.ciphertext, payload.salt, payload.iv, masterPassword, payload.iterations || 100000);
      
      activeVaultKey = vaultKey;
      activeUsername = normalized;
      return true;
    } catch {
      throw new Error('Contraseña maestra incorrecta.');
    }
  },

  /**
   * Recupera una cuenta usando la Clave de Recuperación y redefine la contraseña maestra.
   * @param {string} username 
   * @param {string} recoveryKey 
   * @param {string} newMasterPassword 
   * @returns {Promise<boolean>}
   */
  async recoverUser(username, recoveryKey, newMasterPassword) {
    const normalized = username.toLowerCase().trim();
    if (!this.hasUser(normalized)) {
      throw new Error('El usuario ingresado no existe en este dispositivo.');
    }
    
    const recoveryRaw = localStorage.getItem(`zentry_one_vault_key_${normalized}_recovery`);
    if (!recoveryRaw) {
      throw new Error('No se encontró información de recuperación para este usuario.');
    }
    
    try {
      const payload = JSON.parse(recoveryRaw);
      const vaultKey = await decryptData(payload.ciphertext, payload.salt, payload.iv, recoveryKey.trim().toUpperCase(), payload.iterations || 100000);
      
      // Volver a envolver la vaultKey con la nueva contraseña maestra
      const newMasterPayload = await encryptData(vaultKey, newMasterPassword);
      localStorage.setItem(`zentry_one_vault_key_${normalized}_master`, JSON.stringify(newMasterPayload));

      // Envolver la clave de recuperación usando la nueva contraseña maestra
      const newRecoveryWrappedPayload = await encryptData(recoveryKey.trim().toUpperCase(), newMasterPassword);
      localStorage.setItem(`zentry_one_recovery_wrapped_${normalized}`, JSON.stringify(newRecoveryWrappedPayload));
      
      // Iniciar sesión
      activeVaultKey = vaultKey;
      activeUsername = normalized;
      return true;
    } catch {
      throw new Error('La clave de recuperación ingresada es inválida o incorrecta.');
    }
  },

  // --- OPERACIONES DE LECTURA Y ESCRITURA ---
  /**
   * Carga el vault descifrado del usuario activo.
   * @returns {Promise<object>}
   */
  async loadVault() {
    if (!activeVaultKey || !activeUsername) {
      throw new Error('No hay ninguna sesión activa en Zentry One.');
    }
    
    const vaultRaw = localStorage.getItem(`zentry_one_vault_${activeUsername}`);
    if (!vaultRaw) {
      return { accounts: [], categories: [], workspaces: [] };
    }
    
    try {
      const payload = JSON.parse(vaultRaw);
      const decryptedText = await decryptData(payload.ciphertext, payload.salt, payload.iv, activeVaultKey, payload.iterations || 100000);
      const rawVault = JSON.parse(decryptedText);
      return this.validateAndSanitizeVault(rawVault);
    } catch {
      throw new Error('Error al descifrar el almacén de datos del usuario.');
    }
  },

  /**
   * Guarda el vault del usuario activo cifrándolo con su vaultKey.
   * @param {object} database 
   * @returns {Promise<void>}
   */
  async saveVault(database) {
    if (!activeVaultKey || !activeUsername) {
      throw new Error('No hay ninguna sesión activa en Zentry One.');
    }
    
    try {
      const cleartext = JSON.stringify(database);
      const payload = await encryptData(cleartext, activeVaultKey);
      localStorage.setItem(`zentry_one_vault_${activeUsername}`, JSON.stringify(payload));
    } catch (error) {
      throw new Error('Error al guardar bóveda: ' + error.message);
    }
  },

  /**
   * Cierra la sesión borrando las claves de la memoria RAM.
   */
  logout() {
    activeVaultKey = null;
    activeUsername = null;
  },

  /**
   * Retorna el nombre de usuario activo de la sesión.
   * @returns {string|null}
   */
  getActiveUser() {
    return activeUsername;
  },

  // --- SOPORTE DE MIGRACIÓN DESDE SENTINEL VAULT ---
  /**
   * Comprueba si existe una bóveda de la versión anterior.
   * @returns {boolean}
   */
  hasLegacyVault() {
    return localStorage.getItem('antigravity_password_manager_vault') !== null;
  },

  /**
   * Migra los datos de la bóveda antigua al registrar un nuevo usuario de Zentry One.
   * @param {string} username 
   * @param {string} masterPassword 
   * @param {string} legacyMasterPassword 
   * @returns {Promise<string>} - Clave de recuperación para el nuevo usuario.
   */
  async migrateLegacyVault(username, masterPassword, legacyMasterPassword) {
    const rawData = localStorage.getItem('antigravity_password_manager_vault');
    if (!rawData) {
      throw new Error('No se detectó ninguna base de datos antigua.');
    }
    
    let legacyDB;
    try {
      const encryptedPayload = JSON.parse(rawData);
      const decryptedText = await decryptData(
        encryptedPayload.ciphertext,
        encryptedPayload.salt,
        encryptedPayload.iv,
        legacyMasterPassword,
        encryptedPayload.iterations || 100000
      );
      legacyDB = JSON.parse(decryptedText);
    } catch {
      throw new Error('La contraseña maestra antigua ingresada no es válida.');
    }
    
    // Registrar el nuevo usuario de Zentry One
    const recoveryKey = await this.registerUser(username, masterPassword);
    
    // Guardar los datos antiguos en la nueva bóveda del usuario, saneándolos
    const cleanLegacyDB = this.validateAndSanitizeVault(legacyDB);
    await this.saveVault(cleanLegacyDB);
    
    // Eliminar la bóveda antigua heredada para completar la migración
    localStorage.removeItem('antigravity_password_manager_vault');
    
    return recoveryKey;
  },

  // --- MÉTODOS DE ACTUALIZACIÓN DE PERFIL ---
  /**
   * Renombra un usuario existente cambiando todas sus claves y base de datos asociadas en LocalStorage.
   * @param {string} oldUsername 
   * @param {string} newUsername 
   */
  renameUser(oldUsername, newUsername) {
    const oldNormalized = oldUsername.toLowerCase().trim();
    const newNormalized = newUsername.toLowerCase().trim();
    
    if (this.hasUser(newNormalized)) {
      throw new Error('El nombre de usuario nuevo ya está en uso.');
    }
    
    // Mover datos de bóveda
    const vaultData = localStorage.getItem(`zentry_one_vault_${oldNormalized}`);
    if (vaultData) localStorage.setItem(`zentry_one_vault_${newNormalized}`, vaultData);
    
    const masterKeyData = localStorage.getItem(`zentry_one_vault_key_${oldNormalized}_master`);
    if (masterKeyData) localStorage.setItem(`zentry_one_vault_key_${newNormalized}_master`, masterKeyData);
    
    const recoveryKeyData = localStorage.getItem(`zentry_one_vault_key_${oldNormalized}_recovery`);
    if (recoveryKeyData) localStorage.setItem(`zentry_one_vault_key_${newNormalized}_recovery`, recoveryKeyData);

    const recoveryWrappedData = localStorage.getItem(`zentry_one_recovery_wrapped_${oldNormalized}`);
    if (recoveryWrappedData) localStorage.setItem(`zentry_one_recovery_wrapped_${newNormalized}`, recoveryWrappedData);
    
    // Eliminar viejos datos
    localStorage.removeItem(`zentry_one_vault_${oldNormalized}`);
    localStorage.removeItem(`zentry_one_vault_key_${oldNormalized}_master`);
    localStorage.removeItem(`zentry_one_vault_key_${oldNormalized}_recovery`);
    localStorage.removeItem(`zentry_one_recovery_wrapped_${oldNormalized}`);
    
    // Actualizar lista global de usuarios
    let users = this.getUsers();
    users = users.map(u => u === oldNormalized ? newNormalized : u);
    localStorage.setItem('zentry_one_users', JSON.stringify(users));
    
    activeUsername = newNormalized;
  },

  /**
   * Actualiza la contraseña maestra del usuario actual re-envolviendo la vaultKey simétrica.
   * @param {string} username 
   * @param {string} newMasterPassword 
   * @param {string} [recoveryKey] - Clave de recuperación para re-envolver
   */
  async updateMasterPassword(username, newMasterPassword, recoveryKey = null) {
    const normalized = username.toLowerCase().trim();
    if (!activeVaultKey) {
      throw new Error('No hay ninguna sesión activa en Zentry One.');
    }
    
    const newMasterPayload = await encryptData(activeVaultKey, newMasterPassword);
    localStorage.setItem(`zentry_one_vault_key_${normalized}_master`, JSON.stringify(newMasterPayload));

    if (recoveryKey) {
      const wrappedPayload = await encryptData(recoveryKey, newMasterPassword);
      localStorage.setItem(`zentry_one_recovery_wrapped_${normalized}`, JSON.stringify(wrappedPayload));
    }
  },

  /**
   * Obtiene la clave de recuperación descifrándola con la contraseña maestra actual o genera una nueva si no existe.
   * @param {string} username 
   * @param {string} masterPassword 
   * @returns {Promise<string>}
   */
  async getOrGenerateRecoveryKey(username, masterPassword) {
    const normalized = username.toLowerCase().trim();
    const wrappedRaw = localStorage.getItem(`zentry_one_recovery_wrapped_${normalized}`);
    if (wrappedRaw) {
      try {
        const payload = JSON.parse(wrappedRaw);
        const recoveryKey = await decryptData(payload.ciphertext, payload.salt, payload.iv, masterPassword, payload.iterations || 100000);
        return recoveryKey;
      } catch (error) {
        throw new Error('Contraseña maestra incorrecta.');
      }
    } else {
      // Si no existe la clave de recuperación envuelta (bóvedas anteriores o migradas), generar una nueva
      const recoveryKey = this.generateRecoveryKey();
      
      // Envolverla con la contraseña maestra actual
      const wrappedPayload = await encryptData(recoveryKey, masterPassword);
      localStorage.setItem(`zentry_one_recovery_wrapped_${normalized}`, JSON.stringify(wrappedPayload));
      
      // Actualizar la clave de recuperación que envuelve la activeVaultKey
      if (!activeVaultKey) {
        throw new Error('No hay ninguna sesión activa para inicializar la clave de recuperación.');
      }
      const recoveryPayload = await encryptData(activeVaultKey, recoveryKey);
      localStorage.setItem(`zentry_one_vault_key_${normalized}_recovery`, JSON.stringify(recoveryPayload));
      
      return recoveryKey;
    }
  },

  // --- ELIMINACIÓN Y RESTABLECIMIENTO ---
  /**
   * Elimina completamente la cuenta del usuario activo y sus datos asociados.
   */
  resetUserVault() {
    if (!activeUsername) return;
    const normalized = activeUsername;
    
    localStorage.removeItem(`zentry_one_vault_${normalized}`);
    localStorage.removeItem(`zentry_one_vault_key_${normalized}_master`);
    localStorage.removeItem(`zentry_one_vault_key_${normalized}_recovery`);
    localStorage.removeItem(`zentry_one_recovery_wrapped_${normalized}`);
    
    let users = this.getUsers();
    users = users.filter(u => u !== normalized);
    localStorage.setItem('zentry_one_users', JSON.stringify(users));
    
    this.logout();
  },

  /**
   * Restablece por completo todo el LocalStorage de Zentry One (Factory Reset).
   */
  resetAll() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('zentry_one_') || key === 'antigravity_password_manager_vault') {
        localStorage.removeItem(key);
      }
    });
    this.logout();
  },

  /**
   * Valida y sanea la estructura completa de una bóveda para evitar XSS y corrupción.
   * @param {object} rawVault 
   * @returns {object} - Bóveda saneada y segura.
   */
  validateAndSanitizeVault(rawVault) {
    const cleanVault = {
      accounts: [],
      categories: [],
      workspaces: []
    };

    if (!rawVault || typeof rawVault !== 'object') {
      return cleanVault;
    }

    // 1. Sanear Categorías
    if (rawVault.categories && Array.isArray(rawVault.categories)) {
      rawVault.categories.forEach(cat => {
        if (cat && typeof cat === 'object') {
          const id = typeof cat.id === 'string' ? cat.id.trim() : '';
          const name = typeof cat.name === 'string' ? cat.name.trim().substring(0, 24) : 'Categoría';
          const icon = typeof cat.icon === 'string' && /^[a-zA-Z0-9_-]+$/.test(cat.icon.trim()) ? cat.icon.trim() : 'folder';
          
          let color = 'hsl(215, 15%, 60%)';
          if (typeof cat.color === 'string') {
            const trimmedColor = cat.color.trim();
            if (/^hsl\(\d+,\s*\d+%\s*,\s*\d+%\)$/.test(trimmedColor) || /^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
              color = trimmedColor;
            }
          }

          if (id) {
            cleanVault.categories.push({ id, name, icon, color });
          }
        }
      });
    }

    // 2. Sanear Espacios de Trabajo
    if (rawVault.workspaces && Array.isArray(rawVault.workspaces)) {
      rawVault.workspaces.forEach(ws => {
        if (ws && typeof ws === 'object') {
          const id = typeof ws.id === 'string' ? ws.id.trim() : '';
          const name = typeof ws.name === 'string' ? ws.name.trim().substring(0, 24) : 'Espacio';

          if (id) {
            cleanVault.workspaces.push({ id, name });
          }
        }
      });
    }

    // Garantizar espacio "General" por defecto
    const hasDefaultWs = cleanVault.workspaces.some(ws => ws.id === 'default');
    if (!hasDefaultWs) {
      cleanVault.workspaces.unshift({ id: 'default', name: 'General' });
    }

    // 3. Sanear Cuentas
    if (rawVault.accounts && Array.isArray(rawVault.accounts)) {
      rawVault.accounts.forEach(acc => {
        if (acc && typeof acc === 'object') {
          const id = typeof acc.id === 'string' ? acc.id.trim() : '';
          const name = typeof acc.name === 'string' ? acc.name.trim().substring(0, 50) : 'Cuenta';
          const category = typeof acc.category === 'string' ? acc.category.trim() : 'other';
          const username = typeof acc.username === 'string' ? acc.username.trim().substring(0, 100) : 'usuario';
          const password = typeof acc.password === 'string' ? acc.password.substring(0, 128) : '';
          const url = typeof acc.url === 'string' ? acc.url.trim().substring(0, 255) : '';
          const workspaceId = typeof acc.workspaceId === 'string' ? acc.workspaceId.trim() : 'default';
          const notes = typeof acc.notes === 'string' ? acc.notes.substring(0, 1000) : '';

          // Campos personalizados
          const customFields = [];
          if (acc.customFields && Array.isArray(acc.customFields)) {
            acc.customFields.forEach(field => {
              if (field && typeof field === 'object') {
                const label = typeof field.label === 'string' ? field.label.trim().substring(0, 32) : '';
                const value = typeof field.value === 'string' ? field.value.trim().substring(0, 128) : '';
                if (label && value) {
                  customFields.push({ label, value });
                }
              }
            });
          }

          // Historial de contraseñas
          const history = [];
          if (acc.history && Array.isArray(acc.history)) {
            acc.history.forEach(hist => {
              if (hist && typeof hist === 'object') {
                const histId = typeof hist.id === 'string' ? hist.id.trim() : 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const timestamp = typeof hist.timestamp === 'string' ? hist.timestamp.trim() : new Date().toISOString();
                const histPassword = typeof hist.password === 'string' ? hist.password.substring(0, 128) : '';
                const reason = typeof hist.reason === 'string' ? hist.reason.trim().substring(0, 100) : 'Actualización';
                if (histPassword) {
                  history.push({ id: histId, timestamp, password: histPassword, reason });
                }
              }
            });
          }

          if (id) {
            cleanVault.accounts.push({
              id, name, category, username, password, url, workspaceId, customFields, notes, history
            });
          }
        }
      });
    }

    return cleanVault;
  }
};
