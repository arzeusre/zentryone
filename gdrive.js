/**
 * gdrive.js
 * Cliente de integración para Google Drive API v3 y Google Identity Services (GIS).
 * Permite la sincronización Zero-Knowledge en la nube de la bóveda de Zentry One.
 */

let tokenClient = null;
let activeAccessToken = null;
let authCallbackResolve = null;
let authCallbackReject = null;

export const GDrive = {
  // --- MÉTODOS DE CONFIGURACIÓN ---
  
  getClientId() {
    return localStorage.getItem('zentry_one_gdrive_client_id') || '';
  },

  saveClientId(clientId) {
    if (clientId) {
      localStorage.setItem('zentry_one_gdrive_client_id', clientId.trim());
    } else {
      localStorage.removeItem('zentry_one_gdrive_client_id');
    }
  },

  isLinked(username) {
    const normalized = username.toLowerCase().trim();
    return localStorage.getItem(`zentry_one_gdrive_linked_${normalized}`) === 'true';
  },

  setLinked(username, linked) {
    const normalized = username.toLowerCase().trim();
    if (linked) {
      localStorage.setItem(`zentry_one_gdrive_linked_${normalized}`, 'true');
    } else {
      localStorage.removeItem(`zentry_one_gdrive_linked_${normalized}`);
      localStorage.removeItem(`zentry_one_gdrive_file_id_${normalized}`);
      localStorage.removeItem(`zentry_one_gdrive_auto_sync_${normalized}`);
    }
  },

  isAutoSyncEnabled(username) {
    const normalized = username.toLowerCase().trim();
    return localStorage.getItem(`zentry_one_gdrive_auto_sync_${normalized}`) === 'true';
  },

  setAutoSyncEnabled(username, enabled) {
    const normalized = username.toLowerCase().trim();
    if (enabled) {
      localStorage.setItem(`zentry_one_gdrive_auto_sync_${normalized}`, 'true');
    } else {
      localStorage.setItem(`zentry_one_gdrive_auto_sync_${normalized}`, 'false');
    }
  },

  getFileId(username) {
    const normalized = username.toLowerCase().trim();
    return localStorage.getItem(`zentry_one_gdrive_file_id_${normalized}`) || '';
  },

  saveFileId(username, fileId) {
    const normalized = username.toLowerCase().trim();
    if (fileId) {
      localStorage.setItem(`zentry_one_gdrive_file_id_${normalized}`, fileId);
    } else {
      localStorage.removeItem(`zentry_one_gdrive_file_id_${normalized}`);
    }
  },

  // --- FLUJO DE AUTENTICACIÓN ---

  /**
   * Inicializa el Token Client de Google Identity Services.
   * @param {string} clientId 
   * @param {function} [onTokenReceived] 
   * @returns {boolean}
   */
  init(clientId, onTokenReceived) {
    if (!window.google) {
      console.error("SDK de Google Identity Services no cargado en window.");
      return false;
    }
    
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            activeAccessToken = tokenResponse.access_token;
            if (onTokenReceived) onTokenReceived(activeAccessToken);
            if (authCallbackResolve) {
              authCallbackResolve(activeAccessToken);
              authCallbackResolve = null;
              authCallbackReject = null;
            }
          } else {
            const err = new Error("No se obtuvo el token de acceso de Google.");
            if (authCallbackReject) {
              authCallbackReject(err);
              authCallbackResolve = null;
              authCallbackReject = null;
            }
          }
        },
      });
      return true;
    } catch (e) {
      console.error("Error al inicializar Google Token Client:", e);
      return false;
    }
  },

  /**
   * Inicia el flujo OAuth para obtener un token de acceso fresco (abre popup si es necesario).
   * @returns {Promise<string>}
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        const clientId = this.getClientId();
        if (!clientId) {
          reject(new Error("No hay Client ID configurado para Google Drive."));
          return;
        }
        const success = this.init(clientId);
        if (!success) {
          reject(new Error("No se pudo inicializar la librería de Google. Verifica tu conexión."));
          return;
        }
      }
      
      authCallbackResolve = resolve;
      authCallbackReject = reject;
      
      try {
        // Solicitar token. Si el usuario ya autorizó, el popup es rápido o transparente.
        tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        reject(new Error("Error al abrir ventana de autorización de Google: " + e.message));
      }
    });
  },

  getAccessToken() {
    return activeAccessToken;
  },

  setAccessToken(token) {
    activeAccessToken = token;
  },

  /**
   * Ejecuta una operación de la API de Google Drive. Si falla por falta de token (401),
   * intenta re-autenticar al usuario una vez y reintenta la operación.
   * @param {function} apiFn - Función que recibe el token y devuelve una promesa.
   * @returns {Promise<any>}
   */
  async executeWithRetry(apiFn) {
    try {
      if (!activeAccessToken) {
        await this.authenticate();
      }
      return await apiFn(activeAccessToken);
    } catch (error) {
      if (error.message === "UNAUTHORIZED") {
        console.warn("Token de Google Drive inválido o expirado. Intentando renovar...");
        await this.authenticate();
        return await apiFn(activeAccessToken);
      }
      throw error;
    }
  },

  // --- LLAMADAS DIRECTAS A LA API REST (FETCH) ---

  /**
   * Busca si existe el archivo de bóveda cifrada en Google Drive.
   * @param {string} username 
   * @param {string} token 
   * @returns {Promise<object|null>}
   */
  async findFile(username, token) {
    const normalized = username.toLowerCase().trim();
    const query = encodeURIComponent(`name = 'zentryone_vault_${normalized}.json' and trashed = false`);
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(`Error de red al buscar archivo en Drive: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  },

  /**
   * Descarga y parsea el archivo de la bóveda cifrada desde Google Drive.
   * @param {string} fileId 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  async downloadFile(fileId, token) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(`Error de red al descargar archivo de Drive: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Crea un nuevo archivo vacío de metadatos en Google Drive y luego sube su contenido.
   * @param {string} username 
   * @param {object} bundleData 
   * @param {string} token 
   * @returns {Promise<string>} - ID del archivo creado.
   */
  async createFile(username, bundleData, token) {
    const normalized = username.toLowerCase().trim();
    
    // 1. Crear metadatos del archivo
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `zentryone_vault_${normalized}.json`,
        mimeType: 'application/json'
      })
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(`Error de red al registrar metadatos en Drive: ${response.status} ${response.statusText}`);
    }

    const fileMeta = await response.json();
    const fileId = fileMeta.id;

    // 2. Subir el contenido real al ID asignado
    await this.updateFileContent(fileId, bundleData, token);
    return fileId;
  },

  /**
   * Sobrescribe el contenido de un archivo existente en Google Drive.
   * @param {string} fileId 
   * @param {object} bundleData 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  async updateFileContent(fileId, bundleData, token) {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bundleData)
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(`Error de red al subir contenido a Drive: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Lista todos los archivos con patrón zentryone_vault_*.json para poder restaurar cuentas.
   * @param {string} token 
   * @returns {Promise<Array>}
   */
  async listAllVaultFiles(token) {
    const query = encodeURIComponent("name contains 'zentryone_vault_' and name contains '.json' and trashed = false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(`Error de red al listar bóvedas en Drive: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }
};
