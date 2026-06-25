# Guía de Despliegue en Vercel 🚀

Esta aplicación está completamente configurada para funcionar de manera nativa en **Vercel** como un proyecto Full-Stack utilizando **Vite (React)** para el frontend y **Vercel Serverless Functions** para las funciones de API de Inteligencia Artificial (Gemini).

---

## 📋 Pasos para Desplegar

### 1. Preparar el Repositorio
Asegúrate de subir todos los archivos de este proyecto (incluyendo `vercel.json` y la carpeta `api/`) a tu repositorio de **GitHub**, **GitLab** o **Bitbucket**.

### 2. Importar en Vercel
1. Ve a tu panel de control de [Vercel](https://vercel.com).
2. Haz clic en **"Add New"** > **"Project"**.
3. Importa tu repositorio desde tu proveedor de Git.

### 3. Configurar Parámetros del Proyecto
Vercel detectará automáticamente que el proyecto utiliza **Vite**.
* **Build Command:** `vite build` o `npm run build` *(ambos funcionarán perfectamente)*
* **Output Directory:** `dist`

### 4. Variables de Entorno (Environment Variables) 🔑

Esta configuración es **opcional** si ya tienes configurada tu clave en el **Panel del Administrador Global**:

* **Prioridad Absoluta de la Base de Datos**: El chatbot de insumos está diseñado para leer automáticamente la clave de API configurada en la sección de **Ajustes -> Gemini** del panel de administración (guardada en Firestore).
* **Uso de Variables de Entorno en Vercel**: Si prefieres centralizar la clave sin guardarla en la base de datos o como respaldo, puedes definir la siguiente variable en Vercel:

| Nombre de la Variable | Valor | Descripción |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `tu-api-key-de-gemini` | (Opcional) Clave de API de respaldo para la Inteligencia Artificial. |

---

## 🛠️ Detalles Técnicos de la Configuración

* **`/vercel.json`**: Configura las reglas de enrutamiento para asegurar que las rutas del frontend SPA (como `/servicios`, `/insumos`, etc.) se reescriban correctamente a `/index.html` al recargar la página. Además, canaliza las llamadas a `/api/*` hacia nuestras funciones serverless.
* **`/api/insumos/chat.ts`**: Es una **función serverless nativa de Vercel Node.js** que procesa las peticiones de chat con Gemini. No requiere un servidor Express activo en producción, lo que reduce costos y latencia a cero cuando no se usa.
* **Firebase**: El SDK del lado del cliente está configurado directamente en `/src/lib/firebase.ts` utilizando la base de datos de producción provista, por lo que tus datos e inicio de sesión persistirán perfectamente.
