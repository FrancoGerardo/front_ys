# UML Editor Frontend

Aplicación Next.js 14 que consume la API del backend de UML Editor.

## Variables de entorno

Crea un archivo `.env.local` (o configura las variables en Railway):

```
NEXT_PUBLIC_API_URL=https://tu-backend-en-railway.up.railway.app
NEXT_PUBLIC_GEMINI_API_KEY=tu_clave_de_gemini
```

- `NEXT_PUBLIC_API_URL` debe apuntar al endpoint público del backend desplegado.
- `NEXT_PUBLIC_GEMINI_API_KEY` es opcional, pero necesario si utilizas las funciones de IA.

## Scripts

```
npm install
npm run dev
npm run build
npm run start
```

> El repositorio incluye `package-lock.json`, por lo que se recomienda usar **npm**.

## Despliegue en Railway

1. Define `NEXT_PUBLIC_API_URL` apuntando al servicio backend dentro de Railway.
2. Si usas las funciones de IA, añade `NEXT_PUBLIC_GEMINI_API_KEY`.
3. Establece el comando de inicio: `npm run start`.

