# Zentry One 🛡️

**Zentry One** es un gestor de credenciales e infraestructura crítica de nivel corporativo que opera bajo una arquitectura estricta de **Conocimiento Cero (Zero-Knowledge)** y de ejecución del lado del cliente (**Serverless**). La información se encripta de forma local en el navegador del usuario y nunca se transmite a servidores externos.

---

## ✨ Características Principales

*   **Aislamiento Multiusuario Local:** Soporte para múltiples perfiles de usuario independientes en un mismo dispositivo, con almacenes de datos completamente cifrados e independientes.
*   **Espacios de Trabajo (Workspaces):** Permite organizar tus cuentas por áreas de infraestructura (ej: General, Producción, Desarrollo, Cliente A).
*   **Categorías Dinámicas:** Creación y gestión de categorías personalizadas con iconos y colores HSL/Hex en el sidebar.
*   **Bitácora e Historial de Contraseñas:** Registro histórico completo de todas las contraseñas utilizadas en cada cuenta y los motivos de sus actualizaciones para auditoría y cumplimiento de control de cambios.
*   **Auditoría de Seguridad en Tiempo Real:** Dashboard integrado que alerta sobre:
    *   Contraseñas reutilizadas en diferentes servicios.
    *   Contraseñas débiles (evaluador de robustez).
    *   Credenciales expiradas (con antigüedad mayor a 90 días).
*   **Generador de Contraseñas de Alta Seguridad:** Generadores integrados y colapsables tanto en la creación de cuentas como en el registro de usuarios y rotación de contraseña maestra.
*   **Tema Claro y Oscuro Armónico:** Diseño de interfaz ultra premium ("Alabastro Platino" y "Oscuro Obsidiana") con variables CSS fluidas y micro-animaciones interactivas.

---

## 🔒 Arquitectura de Seguridad (Hardening)

Zentry One ha sido sometido a un riguroso endurecimiento de seguridad (hardening) para evitar cualquier vector de vulnerabilidad o robo de información:

### 1. Criptografía de Nivel Militar
*   **Derivación de Clave:** Utiliza el algoritmo **PBKDF2-HMAC-SHA256** con **600,000 iteraciones** (estándar recomendado por OWASP) para derivar las claves de bóveda a partir de la contraseña maestra del usuario.
*   **Cifrado Simétrico:** Bóvedas cifradas con **AES-GCM de 256 bits** usando Initialization Vectors (IV) de 12 bytes y sales de 16 bytes generados aleatoriamente de forma segura (`window.crypto.getRandomValues`).
*   **Retrocompatibilidad:** Soporte automático para payloads antiguos (100k iteraciones) y nuevos (600k iteraciones) de forma transparente.

### 2. Política de Seguridad de Contenido (CSP)
El proyecto implementa una etiqueta meta CSP restrictiva que impide por completo el robo o exfiltración de credenciales:
*   `connect-src 'none'`: Bloquea todas las llamadas HTTP salientes (`fetch`, `XMLHttpRequest`, `WebSockets`). Incluso ante un caso de script hostil, este no tiene capacidad de red para enviar los datos robados a un servidor externo.
*   `img-src 'self' data:`: Impide el robo de datos embebidos en URLs de imagen.
*   `frame-src 'none'`: Protege la aplicación contra ataques de Clickjacking.

### 3. Sanitización Estricta contra XSS
*   Todas las cargas de datos e importaciones pasan por la función `validateAndSanitizeVault(vault)`, la cual limpia los strings, recorta longitudes de campos para mantener la integridad del layout, y valida que las categorías y colores sigan patrones alfanuméricos/HSL válidos antes de insertarlos en el DOM mediante `innerHTML`.

### 4. Higiene del Portapapeles
*   El copiado de contraseñas se limpia automáticamente del portapapeles a los 30 segundos.
*   Al bloquear la bóveda o cerrar sesión (Logout), el portapapeles se limpia de forma instantánea y se cancelan todos los temporizadores en memoria RAM.

---

## ☁️ Sincronización en la Nube (Google Drive)

Zentry One permite la sincronización automática de credenciales entre múltiples dispositivos (como tu PC y tu teléfono celular) utilizando tu cuenta de **Google Drive**.

*   **Seguridad Zero-Knowledge:** Los datos se cifran localmente en tu navegador antes de subirse. Google solo almacena datos cifrados indescifrables.
*   **Privacidad:** La aplicación solicita acceso exclusivo mediante el permiso `drive.file` (solo lee/escribe el archivo que ella misma crea). No tiene acceso a ningún otro archivo en tu nube.
*   **Fusión Inteligente (Merge):** Algoritmo integrado para combinar de forma segura las credenciales de diferentes dispositivos sin sobrescribir ni perder datos.

Para configurar tu cuenta de sincronización y obtener tu Google Client ID gratuito, consulta la [Guía de Uso y Sincronización con Google Drive](./GUIA_SINCRONIZACION.md).

---

## 📂 Estructura de Archivos

*   `index.html`: Estructura y maquetación de las vistas (Pantalla de desbloqueo, Dashboard de Auditoría, Detalle de Cuentas y Modales).
*   `style.css`: Hoja de estilos premium con soporte responsivo y variables CSS adaptativas para temas claros y oscuros.
*   `app.js`: Controlador principal de UI, validaciones de formularios y gestión de eventos de la aplicación.
*   `storage.js`: Capa de datos que implementa las operaciones de carga, guardado, renombrado y saneamiento del LocalStorage.
*   `crypto.js`: Envoltura de funciones de cifrado, descifrado y derivación de claves usando la API nativa **Web Crypto API**.
*   `gdrive.js`: Módulo de comunicación directa con la API de Google Drive v3 y autenticación con Google Identity Services.
*   `test_security.html`: Suite integrada de pruebas automatizadas de seguridad en el cliente.
*   `GUIA_SINCRONIZACION.md`: Guía detallada paso a paso para configurar la nube de Google y realizar la sincronización/restauración de cuentas.

---

## 🛠️ Cómo Ejecutar el Proyecto Localmente

Zentry One no requiere bases de datos del lado del servidor ni configuraciones complejas.

1.  Clona este repositorio o descarga los archivos.
2.  Dado que los módulos de JavaScript (`import`/`export`) exigen ejecutarse en un entorno HTTP para evitar restricciones CORS, levanta un servidor web local en la carpeta del proyecto. Por ejemplo, si tienes Python:
    ```bash
    python -m http.server 8000
    ```
3.  Abre tu navegador e ingresa a:
    [http://localhost:8000](http://localhost:8000)

---

## 🧪 Ejecución de la Suite de Pruebas de Seguridad

Para comprobar la efectividad de las medidas de seguridad del proyecto en tu navegador actual:
1.  Con el servidor local encendido, ingresa a:
    [http://localhost:8000/test_security.html](http://localhost:8000/test_security.html)
2.  La página ejecutará automáticamente pruebas de sanitización XSS, límites de caracteres, derivación criptográfica PBKDF2 y bloqueo de llamadas a red externa (CSP).
