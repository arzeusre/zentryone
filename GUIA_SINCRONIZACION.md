# Guía de Uso y Sincronización en la Nube con Google Drive

Esta guía detalla el funcionamiento de la nueva integración con **Google Drive API** en **Zentry One**, la cual permite la sincronización automática de credenciales entre múltiples dispositivos de forma segura y Zero-Knowledge.

---

## 🚀 Nuevas Funcionalidades Implementadas

### 1. Módulo Independiente de Google Drive (`gdrive.js`)
* Se ha creado [gdrive.js](file:///D:/Proyectos/ANTIGRAVITY/password-manager/gdrive.js) para gestionar la lógica de autenticación mediante el nuevo SDK de Google Identity Services (GIS) y las peticiones directas HTTP a la API REST de Google Drive v3 (`fetch`).
* **Seguridad:** Trabaja únicamente con el alcance `drive.file`, lo que significa que la app solo puede ver y editar los archivos creados por ella misma. No tiene acceso al resto de archivos del usuario.

### 2. Panel de Sincronización en la Interfaz (`index.html`)
* Se agregó la sección **Sincronización (Google Drive)** dentro del modal de Configuración de Cuenta.
* Permite al usuario:
  * Ingresar y guardar su **Google Client ID** de forma segura.
  * **Vincular/Desvincular** su cuenta de Google Drive con un popup de inicio de sesión de Google.
  * Activar/desactivar la **Sincronización Automática (Auto-Sync)**.
  * Realizar acciones manuales: **Subir (Push)**, **Descargar (Pull)** y **Combinar (Merge)**.
  * Consultar el estado y hora de la última sincronización.
  * Leer una guía interactiva y plegable sobre cómo crear su Google Client ID gratis en Google Cloud.

### 3. Asistente de Restauración en la Pantalla de Inicio
* Se añadió el botón **"Restaurar desde Google Drive"** en la pantalla de Login para usuarios en dispositivos nuevos.
* Abre un asistente de 3 pasos:
  1. **Conectar:** El usuario ingresa su Client ID y se autentica.
  2. **Seleccionar:** La aplicación busca todas las bóvedas `zentryone_vault_*.json` en su Drive y lista los usuarios encontrados. El usuario selecciona su cuenta.
  3. **Listo:** Los archivos de seguridad cifrados se descargan e instalan localmente en el navegador, permitiendo al usuario iniciar sesión directamente con su contraseña maestra.

### 4. Sincronización en Segundo Plano y Fusión Inteligente (`app.js`)
* **Auto-Sync al Guardar:** Cualquier cambio local (agregar/editar/eliminar cuentas, categorías o espacios de trabajo) se sube automáticamente a la nube en segundo plano si la opción está activa, actualizando el estado del perfil en la barra lateral a **"Drive Sincronizado"** o indicando si está pendiente.
* **Auto-Sync al Entrar:** Al iniciar sesión, la app realiza un pull y merge silencioso para cargar cambios recientes realizados desde otros dispositivos antes de renderizar la UI.
* **Fusión Inteligente (Merge):** Si existen cuentas coincidentes por ID localmente y en la nube, se comparan los historiales de contraseñas y se conserva la versión más reciente (basada en el último cambio registrado), combinando los workspaces y categorías restantes de forma transparente y sin pérdidas.

---

## 🛠️ Guía de Pruebas y Verificación Manual

Para probar esta integración, sigue estos pasos:

### Paso 1: Crear tu Google Client ID (Gratis)
1. Ve a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto vacío.
2. Ve al buscador superior, busca **Google Drive API** y actívala.
3. Configura la plataforma de autenticación:
   * En el menú lateral izquierdo, haz clic en **Público** (Audience).
   * Configura el tipo de usuario como **Externo** y completa los datos mínimos (nombre de la app y tu correo).
   * **Importante:** En la sección **Usuarios de prueba** (Test users), haz clic en **+ Add users** (o *+ Agregar usuarios*) y añade la dirección de correo exacta con la que iniciarás sesión en Zentry One (ej: `tu-correo@gmail.com`). Si omites este paso, Google bloqueará tu acceso con un `Error 403: access_denied`.
4. Crea la credencial de cliente:
   * En el menú lateral izquierdo, haz clic en **Clientes** (o ve a *APIs y servicios > Credenciales*).
   * Haz clic en **Crear credenciales** y selecciona **ID de cliente de OAuth**.
   * Tipo de aplicación: **Aplicación web**.
   * En **Orígenes de JavaScript autorizados**, añade las URLs de origen permitidas:
     * Para pruebas locales: `http://localhost:8000`
     * Para tu GitHub Pages: `https://arzeusre.github.io`
   * Haz clic en **Crear** y copia el **ID de cliente** generado (un texto largo que termina en `.apps.googleusercontent.com`).

---

### Paso 2: Vincular y Probar Sincronización en el Dispositivo A (Local)
1. Inicia tu servidor local (`python -m http.server 8000`) y abre `http://localhost:8000` en tu navegador.
2. Inicia sesión en tu cuenta local.
3. Haz clic en el botón de engranaje de la barra lateral (Configuración de Cuenta).
4. Ve a la sección **Sincronización (Google Drive)**:
   * Pega tu **Google Client ID**.
   * Haz clic en **Vincular Drive**.
   * Se abrirá el popup de Google. Selecciona tu cuenta de Gmail (la que registraste como usuario de prueba).
   * Acepta los permisos de almacenamiento de la app.
5. Verifica que el estado cambia a **"Vinculado a Google Drive"** y el rol en la barra lateral inferior cambia a **"Drive Sincronizado"** en color verde.
6. Ve a tu Google Drive personal: deberías ver que se ha creado un archivo oculto o visible según el scope, llamado `zentryone_vault_[tu_usuario].json`. Si abres el archivo con un editor de texto, verás que todo su contenido está cifrado.

---

### Paso 3: Probar la Restauración en el Dispositivo B (Simulación con Incógnito)
1. Abre una nueva ventana en **Modo Incógnito** e ingresa a `http://localhost:8000` (esto simula un dispositivo completamente nuevo sin datos locales).
2. En la pantalla de registro/login, haz clic en **"Restaurar desde Google Drive"**.
3. Pega tu **Google Client ID** y haz clic en **Conectar con Google** (inicia sesión con la misma cuenta de Gmail).
4. El asistente buscará copias en la nube y te mostrará tu nombre de usuario. Haz clic sobre él.
5. El asistente descargará la bóveda y te mostrará la pantalla de éxito. Haz clic en **Ir a Iniciar Sesión**.
6. Ahora la pantalla de inicio te reconocerá. Introduce tu Contraseña Maestra y verifica que accedes a todas tus cuentas con éxito.

---

### Paso 4: Probar la Fusión de Datos (Merge)
1. Con la cuenta iniciada en ambos dispositivos (Dispositivo A y Dispositivo B en incógnito):
2. En el **Dispositivo A**, crea una credencial nueva llamada `Cuenta Dispositivo A`. Verás cómo se sincroniza automáticamente en segundo plano.
3. En el **Dispositivo B**, crea una credencial nueva llamada `Cuenta Dispositivo B`.
4. Ve al menú de configuración en cualquiera de ellos y haz clic en **Combinar Datos (Merge)**.
5. Verifica que ambos dispositivos ahora muestran tanto la `Cuenta Dispositivo A` como la `Cuenta Dispositivo B` en sus respectivos dashboards de forma unificada y sin sobreescrituras destructivas.

---

## ⚡ Mejoras de Scroll y Ordenamiento por Arrastre (Drag-and-Drop)

Hemos resuelto los problemas de scroll y desbordamiento en listas largas y agregado la funcionalidad de reordenamiento mediante arrastre para cuentas y categorías.

### 📋 Cambios de Diseño y Scroll
1. **Restricción de la Altura de Grilla (`min-height: 0`):**
   * Se aplicó `min-height: 0;` en las columnas `.sidebar`, `.accounts-column` y `.details-column` en la configuración de la grilla de escritorio. Esto evita que una lista larga de cuentas estire la grilla entera más allá del 100% del alto de la pantalla, previniendo que la parte inferior del sidebar (shortcuts, perfil, botones de acción) quede fuera de la vista.
2. **Scroll Independiente en el Sidebar (`overflow-y: auto`):**
   * Se configuró `.sidebar` con `overflow: hidden;` de manera que el panel de perfil, atajos de teclado y botones para exportar/importar/eliminar la bóveda permanezcan siempre fijos y visibles en la parte inferior del panel.
   * Se cambió `.sidebar-nav` a `overflow-y: auto;` y `min-height: 0;` para que, cuando haya muchas categorías, solo la lista de categorías scrollé verticalmente de forma independiente.

### 🖱️ Ordenamiento por Arrastre (Drag-and-Drop)
1. **Reordenamiento de Cuentas:**
   * Las tarjetas de la lista de cuentas central ahora tienen la propiedad `draggable="true"`.
   * El usuario puede hacer clic, arrastrar y soltar una tarjeta de cuenta encima o debajo de otra para ordenar la lista.
   * Al arrastrar, se muestra una indicación visual con una línea en color azul cobalto arriba (`.drag-over-above`) o abajo (`.drag-over-below`) de la tarjeta hovereada que indica la posición exacta de inserción.
   * Al soltar, se reubica la cuenta en el array de datos de la bóveda (`vault.accounts`), persistiendo el cambio inmediatamente en `localStorage` (y sincronizando con Google Drive si el Auto-Sync está activo) a través de `saveAndRefreshVault()`.
2. **Reordenamiento de Categorías:**
   * Las categorías personalizadas listadas en el sidebar ahora son arrastrables.
   * La categoría fija **"Todas las Cuentas"** está excluida de ser arrastrable o recibir soltados para mantener la consistencia de la interfaz.
   * La inserción utiliza la misma lógica e indicadores visuales que la de cuentas, actualizando el orden en `vault.categories` y guardándolo instantáneamente.

