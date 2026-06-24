# Arquitectura del Sistema - EconoService

EconoService es una aplicación web para la gestión de servicio técnico de electrodomésticos y equipos, migrado desde un sistema heredado de Microsoft Access y optimizado para ejecutarse en la nube utilizando **Firebase** y una arquitectura SPA moderna con **React 19 + TypeScript + Tailwind CSS** ejecutado sobre **Vite**.

## 1. Diseño de Arquitectura

El sistema está diseñado para ser altamente modular, eficiente y totalmente compatible con el **Plan Spark de Firebase (Gratuito)**, minimizando las lecturas/escrituras en Firestore y evitando el uso de Cloud Functions mediante la delegación de reglas en el cliente junto a **Firestore Security Rules**.

### Estructura de Directorios

```text
src/
  app/                 # Páginas principales del flujo de la aplicación
  components/          # Componentes de UI globales y de presentación (Botones, Inputs, Cards)
  features/            # Módulos completos con su propia UI y lógica de negocio
    dashboard/
    clientes/
    equipos/
    tecnicos/
    servicios/
    presupuestos/
    agenda/
    gastos/
  services/            # Clases y funciones de acceso a servicios (Auth, Firestore, Storage)
  hooks/               # Custom React hooks (useAuth, etc.)
  lib/                 # Inicializaciones de librerías (firebase.ts, utils.ts)
  types/               # Definiciones de tipos TypeScript y Enums
  schemas/             # Validaciones con Zod para formularios
  providers/           # Proveedores de contexto (AuthProvider, ThemeProvider)
```

---

## 2. Modelo de Datos (Firestore)

El diseño de las colecciones e índices de Firestore optimiza el acceso de lectura y escritura:

### Colección: `users`
* Almacena el perfil del usuario autenticado, su rol y estado.
* Ubicación: `/users/{uid}`

### Colección: `clientes`
* Directorio de clientes con marcas especiales (ej. Cliente Problemático).
* Ubicación: `/clientes/{id}`

### Colección: `tecnicos`
* Registro de técnicos especialistas.
* Ubicación: `/tecnicos/{id}`

### Colección: `equipos`
* Catálogo de aparatos vinculados a clientes.
* Ubicación: `/equipos/{id}`

### Colección: `servicios` (Principal)
* Representa el ciclo de vida de un servicio técnico.
* Ubicación: `/servicios/{id}`
* Subcolección: `historial` (Ubicación: `/servicios/{id}/historial/{id}`) para auditoría de cambios.

### Colección: `presupuestos`
* Registra presupuestos asociados a servicios.
* Ubicación: `/presupuestos/{id}`
* Subcolección: `items` (Ubicación: `/presupuestos/{id}/items/{id}`) para ítems detallados.

### Colección: `gastos`
* Control de egresos del taller.
* Ubicación: `/gastos/{id}`

---

## 3. Seguridad y Control de Acceso (RBAC)

Se definen 4 roles en la aplicación:
1. **admin**: Acceso completo de lectura, creación, actualización y eliminación en todas las colecciones.
2. **recepcion**: CRUD de clientes, servicios, presupuestos y agenda. Sin permisos para eliminar registros históricos del taller o reconfigurar usuarios críticos.
3. **tecnico**: Acceso de lectura de servicios. Permiso exclusivo para modificar diagnóstico, estado de servicio, observaciones de taller y repuestos necesarios.
4. **consulta**: Solo lectura en todo el sistema.

Estas restricciones se replican a nivel de UI (ocultando botones y vistas) y se garantizan a nivel de base de datos a través de **Firestore Security Rules** consultando el rol del usuario desde `/users/$(request.auth.uid)`.

---

## 4. Estrategia de Despliegue en Firebase Spark Plan

* **Paginación en Tablas**: Limita el consumo de lecturas al traer lotes pequeños (ej. 20 elementos) en lugar de descargar colecciones completas.
* **Storage Estructurado**: Almacenamiento organizado por carpetas `/servicios/{servicioId}/` para facturas, fotos y presupuestos.
* **No Real-Time Excesivo**: Uso de consultas explícitas bajo demanda mediante botones de recarga u operaciones dirigidas para evitar que los listeners abiertos en segundo plano consuman cuotas de lectura gratuitas.
