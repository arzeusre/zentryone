/**
 * crypto.js
 * Módulo encargado del cifrado y descifrado de datos en el cliente (Zero-Knowledge)
 * utilizando Web Crypto API.
 */

const KEY_LEN = 256; // bits

/**
 * Deriva una clave criptográfica (CryptoKey) a partir de la contraseña maestra, un salt y un conteo de iteraciones.
 * @param {string} masterPassword - Contraseña maestra.
 * @param {Uint8Array} salt - Bytes del salt.
 * @param {number} iterations - Iteraciones PBKDF2.
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(masterPassword, salt, iterations) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(masterPassword);

  // Importar la contraseña como una clave base
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derivar la clave AES-GCM
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta un texto utilizando la contraseña maestra y un número de iteraciones (por defecto 600,000).
 * Retorna un objeto con el texto cifrado, el salt, el iv y las iteraciones.
 * @param {string} cleartext - Texto plano a encriptar.
 * @param {string} masterPassword - Contraseña maestra.
 * @param {number} [iterations=600000] - Iteraciones para derivar la clave.
 * @returns {Promise<{ ciphertext: string, salt: string, iv: string, iterations: number }>}
 */
export async function encryptData(cleartext, masterPassword, iterations = 600000) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(cleartext);

  // Generar 16 bytes de sal aleatoria y 12 bytes de IV aleatorio
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derivar la clave
  const key = await deriveKey(masterPassword, salt, iterations);

  // Encriptar
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBytes
  );

  // Convertir buffers a cadenas Base64 para almacenamiento
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    iterations: iterations
  };
}

/**
 * Desencripta un texto cifrado utilizando la contraseña maestra, los metadatos de cifrado y el número de iteraciones.
 * @param {string} ciphertextBase64 - Cifrado en Base64.
 * @param {string} saltBase64 - Sal en Base64.
 * @param {string} ivBase64 - IV en Base64.
 * @param {string} masterPassword - Contraseña maestra.
 * @param {number} [iterations=100000] - Iteraciones para derivar la clave (100k por defecto para compatibilidad).
 * @returns {Promise<string>} - Texto plano descifrado.
 */
export async function decryptData(ciphertextBase64, saltBase64, ivBase64, masterPassword, iterations = 100000) {
  const decoder = new TextDecoder();

  // Convertir Base64 de vuelta a Uint8Arrays
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

  // Derivar la clave
  const key = await deriveKey(masterPassword, salt, iterations);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new Error('Contraseña maestra incorrecta o datos corruptos.');
  }
}
