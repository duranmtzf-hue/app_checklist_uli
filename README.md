# Visitas y Auditorías ULI

Aplicación para realizar visitas y auditorías a sucursales desde el celular. Todo queda ordenado por **región → distrito → sucursal**.

## Características

- **Inicio de sesión** por usuario
- **Roles**: evaluador, gerente, regional, admin
- **Estructura**: Regionales → Distritos → Sucursales
- **Visitas**: selección regional → distrito → sucursal, checklist completo (sí/no, observaciones, números, %, fotos), plan de acción, historial
- **Reportes**: resumen por sucursal, distrito y regional; comparación entre sucursales; historial
- **Compartir**: envío por correo (resumen, hallazgos, plan de acción)
- **Offline**: guarda en el celular sin internet y sincroniza al conectar
- **PWA**: instalable en el móvil, funciona en el navegador

## Cómo ejecutar

### Requisitos

- Node.js 18+

### 1. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Iniciar backend

```bash
cd backend
npm run dev
```

El API quedará en `http://localhost:4000`. La primera vez se crea la base de datos y un usuario inicial.

### 3. Iniciar frontend

```bash
cd frontend
npm run dev
```

Abre en el navegador la URL que indique Vite (por ejemplo `http://localhost:5173`).

### Usuario inicial

- **Email:** `admin@uli.com`
- **Contraseña:** `admin123`

(Conviene cambiar la contraseña en producción.)

## Configuración opcional

### Backend (`.env` en `backend/`)

Copia `backend/.env.example` a `backend/.env` y ajusta:

- `JWT_SECRET`: secreto para los tokens (obligatorio en producción)
- `SMTP_*`, `EMAIL_FROM`: para poder enviar correos con el resumen de la visita

### Checklist

El checklist por defecto incluye ítems de ejemplo. Un usuario **admin** puede ampliarlo desde la API (por ejemplo con Postman) en `GET/POST /api/checklist/plantilla`. Los tipos de ítem son: `si_no`, `texto`, `numero`, `porcentaje`, `foto`.

## Estructura del proyecto

- `backend/`: API Node (Express, SQLite)
- `frontend/`: PWA React (Vite, Tailwind)
- Login, roles, CRUD de regionales/distritos/sucursales, visitas con checklist, reportes, envío por correo, almacenamiento offline con sincronización al volver a tener conexión.
