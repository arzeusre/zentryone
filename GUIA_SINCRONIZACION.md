# Guía de Uso y Sincronización en la Nube con Google Drive

Esta guía detalla el funcionamiento de la integración con **Google Drive API** en **Zentry One**, la cual permite la sincronización automática de credenciales entre múltiples dispositivos de forma segura y Zero-Knowledge.

---

## 🚀 Características de la Integración

### 1. Modelo Criptográfico Zero-Knowledge
* La bóveda de credenciales se cifra en tu dispositivo local **antes** de enviarse a Google Drive.
* Lo que se almacena en la nube es un archivo JSON con datos cifrados ilegibles (ciphertext, iv, salt, iterations).
* Google Drive funciona puramente como un disco duro en la nube: no puede ver ni descifrar tus contraseñas. Solo tú puedes descifrarlas localmente ingresando tu Contraseña Maestra.

### 2. Permiso Limitado y Seguro (`drive.file`)
* Zentry One utiliza el alcance (scope) `drive.file`. Esto significa que la aplicación **solo tiene acceso al archivo que ella misma crea** (`zentryone_vault_[usuario].json`). No puede leer tus fotos, documentos, correos ni ningún otro archivo personal de tu cuenta de Google.

### 3. Sincronización Automática e Inteligente
* **Auto-Sync:** Al activar esta opción, cualquier cambio local (guardar, editar o borrar cuentas) se sube automáticamente a la nube en segundo plano. Al iniciar sesión, el sistema descarga y combina los datos recientes.
* **Fusión Inteligente (Merge):** Si has hecho cambios en varios dispositivos sin conexión, al presionar "Combinar Datos (Merge)", Zentry One junta las cuentas de ambos dispositivos y, si hay IDs repetidos, conserva la versión con el historial de contraseña más reciente.

---

## 🛠️ Guía de Configuración Paso a Paso

Para sincronizar tus dispositivos, debes configurar un **Google Client ID** gratuito en Google Cloud. Sigue estos pasos detallados:

### Paso 1: Crear tu Google Client ID
1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/) con tu cuenta de Google.
2. Crea un proyecto vacío o selecciona uno existente desde la barra superior.
3. Activa la API de almacenamiento:
   * En el buscador de la barra superior, escribe **Google Drive API**.
   * Haz clic sobre ella y presiona el botón **Activar**.
4. Configura el consentimiento en la nueva interfaz de Google:
   * En el menú lateral izquierdo, haz clic en la pestaña **Público** (Audience).
   * Selecciona el tipo de usuario **Externo** y completa la información básica requerida (nombre de la app y tu correo).
   * **⚠️ Crucial:** En la sección inferior **Usuarios de prueba** (Test users), haz clic en el botón **+ Add users** (o *+ Agregar usuarios*) y añade la dirección exacta de tu correo de Gmail (ej: `tu-correo@gmail.com`). **Si omites este paso, Google bloqueará tu acceso con un Error 403: access_denied.**
5. Genera la credencial del cliente:
   * En el menú lateral izquierdo, haz clic en **Clientes** (o ve a *APIs y servicios > Credenciales*).
   * Haz clic en el botón **Crear credenciales** y selecciona **ID de cliente de OAuth**.
   * Tipo de aplicación: **Aplicación web**.
   * En **Orígenes de JavaScript autorizados**, agrega las URLs de origen permitidas (las URLs desde donde abrirás Zentry One):
     * Para pruebas locales: `http://localhost:8000`
     * Para tu GitHub Pages: `https://[tu-usuario].github.io`
   * Haz clic en **Crear** y copia el **ID de cliente** generado (un texto largo que termina en `.apps.googleusercontent.com`).

---

### Paso 2: Vincular tu Bóveda en tu Dispositivo Principal (Celular o PC)
1. Abre Zentry One en tu dispositivo principal e inicia sesión.
2. Abre la **Configuración de Cuenta** (icono de engranaje).
3. Pega tu **Google Client ID** en el campo de texto.
4. Haz clic en **Vincular Drive** y completa la autenticación en el popup de Google (si te muestra una advertencia de *"Google no ha verificado esta app"*, haz clic en *Configuración avanzada* y luego en *Ir a Zentry One (no seguro)*).
5. Asegúrate de marcar la casilla de **Sincronización Automática (Auto-Sync)**.
6. *¡Listo! Se creará un archivo cifrado `zentryone_vault_[tu-usuario].json` en la carpeta raíz de tu Google Drive.*

---

### Paso 3: Restaurar e Iniciar Sesión en tu Segundo Dispositivo
1. Abre la URL de Zentry One en tu segundo dispositivo.
2. En la pantalla inicial, haz clic en **Restaurar desde Google Drive**.
3. Ingresa el **mismo Google Client ID** y haz clic en **Conectar con Google** (iniciando sesión con tu misma cuenta de Gmail).
4. El asistente buscará en tu Drive, detectará tu usuario y te lo mostrará. Haz clic sobre él.
5. Los datos cifrados se descargarán localmente. Haz clic en **Ir a Iniciar Sesión**.
6. Introduce tu Contraseña Maestra y listo: ya tendrás tus cuentas sincronizadas. Asegúrate de marcar también **Sincronización Automática** en este dispositivo para que los cambios futuros se sincronicen solos.
