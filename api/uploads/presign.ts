import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_EXTENSION_BY_TYPE,
  MAX_IMAGE_SIZE_BYTES,
// La extensión ".js" (y no ".ts", ni sin extensión) es obligatoria acá.
//
// El package.json declara "type": "module", así que esta función corre como ESM
// en Node, y el resolvedor de ESM NO completa extensiones: pide la ruta exacta.
// Se escribe ".js" y no ".ts" porque es el nombre que va a tener el archivo YA
// COMPILADO, que es lo que existe en el servidor en tiempo de ejecución.
//
// Vite sí completa extensiones al empaquetar el frontend, y por eso este error
// no aparece en desarrollo: se manifiesta recién al ejecutar la función
// desplegada.
} from "../../src/constants/uploads.js";

// ============================================================================
// POST /api/uploads/presign
//
// Devuelve una URL prefirmada de corta duración para que el navegador suba una
// imagen DIRECTO a S3, sin que las credenciales de AWS salgan nunca del
// servidor.
//
// Por qué este rodeo en vez de subir el archivo al servidor y que él lo reenvíe:
// el servidor firma, pero nunca ve los bytes. La imagen viaja del navegador a S3
// en una sola conexión, sin ocupar memoria ni tiempo de ejecución de la función.
// Y lo más importante: la clave secreta de AWS jamás se expone.
//
// Este archivo vive en api/ y NO en src/. Esa separación es física, no
// decorativa: todo lo que está en src/ termina dentro del bundle que descarga el
// navegador, donde cualquiera puede leerlo. api/ solo corre en el servidor de
// Vercel.
// ============================================================================

// Cuánto vive la URL firmada. Corta a propósito: es el tiempo que alguien tiene
// para usarla si llegara a interceptarla. 5 minutos alcanzan de sobra para subir
// una imagen de hasta 5 MB.
const PRESIGN_EXPIRATION_SECONDS = 300;

// Prefijo dentro del bucket. La política del usuario IAM debe limitarse a este
// prefijo: aunque la credencial se filtrara, no podría tocar nada más.
const UPLOAD_KEY_PREFIX = "products";

// ---------------------------------------------------------------------------
// Configuración del servidor
// ---------------------------------------------------------------------------

// NINGUNA de estas variables lleva el prefijo VITE_, y eso no es un detalle de
// estilo: Vite reemplaza literalmente por su valor todo lo que empiece con VITE_
// al construir el bundle. Una clave de AWS con ese prefijo quedaría escrita en
// texto plano dentro de un archivo .js público. Sin el prefijo, Vite ni las mira,
// y solo existen acá, en process.env del servidor.
const serverEnvSchema = z.object({
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
});

// Solo los tres campos del service account que realmente se usan. Validarlos
// evita el error más críptico de este flujo: si el JSON está mal pegado en el
// dashboard, firebase-admin falla mucho más adelante con un mensaje que no
// menciona la variable de entorno.
const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

function getServerEnv(): ServerEnv {
  // Se cachea porque Vercel reutiliza la misma instancia de la función entre
  // requests: validar en cada llamada sería trabajo repetido sin sentido.
  if (cachedEnv === null) {
    cachedEnv = serverEnvSchema.parse(process.env);
  }
  return cachedEnv;
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function getAdminApp(): App {
  // getApps() devuelve las apps ya inicializadas. Sin este chequeo, la segunda
  // request sobre una instancia reutilizada intentaría inicializar de nuevo y
  // fallaría con "The default Firebase app already exists".
  const [existingApp] = getApps();
  if (existingApp) {
    return existingApp;
  }

  const env = getServerEnv();
  const serviceAccount = serviceAccountSchema.parse(
    JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON),
  );

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      // La clave privada es un texto multilínea. Según cómo se haya pegado en el
      // dashboard de Vercel, los saltos de línea pueden quedar como la secuencia
      // literal de dos caracteres \ y n en vez de saltos reales, y entonces la
      // firma falla con un error de OpenSSL que no dice nada útil. Este replace
      // cubre ese caso y es inofensivo cuando los saltos ya son reales.
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

// ---------------------------------------------------------------------------
// Respuestas de error
// ---------------------------------------------------------------------------

// Formato consistente { code, message }: el "code" es el contrato estable que
// puede leer el frontend, el "message" es el texto humano. Nunca se incluye el
// error original — sus mensajes pueden revelar nombres de buckets, rutas
// internas o detalles de las reglas de seguridad.
function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}

// ---------------------------------------------------------------------------
// Cuerpo de la request
// ---------------------------------------------------------------------------

// No se pide el nombre del archivo, y es deliberado: el nombre original del
// cliente no se usa para nada (la key se genera con un UUID y la extensión sale
// del contentType ya validado). Un dato que no se usa es un dato que no hace
// falta recibir, y todo lo que se recibe hay que validarlo.
const presignRequestSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_SIZE_BYTES),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Firma estándar de la Web (Request → Response). Al exportar la función con el
// nombre del método HTTP, Vercel enruta solo los POST acá y responde 405 al
// resto por su cuenta: no hace falta chequear el método a mano.
export async function POST(request: Request): Promise<Response> {
  try {
    // --- 1. Identidad: ¿quién sos? -----------------------------------------
    const authorizationHeader = request.headers.get("authorization");
    if (authorizationHeader === null || !authorizationHeader.startsWith("Bearer ")) {
      return errorResponse(401, "UNAUTHENTICATED", "Falta el token de autenticación.");
    }

    const idToken = authorizationHeader.slice("Bearer ".length);

    const adminApp = getAdminApp();
    let uid: string;
    try {
      // verifyIdToken chequea la firma del token contra las claves públicas de
      // Google y su expiración. Un token inventado o vencido no pasa de acá.
      const decodedToken = await getAuth(adminApp).verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch {
      return errorResponse(401, "INVALID_TOKEN", "Tu sesión no es válida. Iniciá sesión de nuevo.");
    }

    // --- 2. Permiso: ¿podés hacer esto? ------------------------------------
    // 401 y 403 son cosas distintas: 401 es "no sé quién sos", 403 es "sé quién
    // sos y no te alcanza". Devolver siempre 401 obligaría al cliente a mandar
    // al usuario a iniciar sesión de nuevo por un problema que no se arregla
    // volviendo a loguearse.
    //
    // El rol se lee de Firestore y no del token: los roles son una decisión de
    // negocio de esta app, viven en su base de datos, y así se puede cambiar el
    // rol de alguien sin tocar el sistema de autenticación.
    const userSnapshot = await getFirestore(adminApp).collection("users").doc(uid).get();
    if (userSnapshot.data()?.role !== "admin") {
      return errorResponse(403, "FORBIDDEN", "No tenés permisos para subir imágenes.");
    }

    // --- 3. Datos: ¿lo que mandás tiene sentido? ---------------------------
    const rawBody: unknown = await request.json();
    const parsedBody = presignRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return errorResponse(
        400,
        "INVALID_UPLOAD",
        "La imagen debe ser JPG, PNG o WebP y pesar menos de 5 MB.",
      );
    }

    const { contentType, size } = parsedBody.data;

    // --- 4. Firma ----------------------------------------------------------
    const env = getServerEnv();

    // El nombre del archivo se genera acá con un UUID, y la extensión sale del
    // contentType que ya validamos contra la whitelist. Nunca del nombre que
    // mandó el cliente: con "foto.png.html" alguien podría terminar sirviendo
    // HTML desde el dominio del bucket, que es la base de un XSS almacenado.
    // Un UUID además evita que dos admins se pisen los archivos entre sí.
    const objectKey = `${UPLOAD_KEY_PREFIX}/${randomUUID()}.${IMAGE_EXTENSION_BY_TYPE[contentType]}`;

    const s3Client = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        ContentType: contentType,
        ContentLength: size,
      }),
      {
        expiresIn: PRESIGN_EXPIRATION_SECONDS,
        // Sin esto, el Content-Type queda FUERA de la firma y el cliente podría
        // subir el archivo declarando cualquier tipo, salteándose la whitelist.
        // Con la cabecera firmada, S3 rechaza el PUT si el Content-Type que
        // manda el navegador no es exactamente el que se firmó acá.
        signableHeaders: new Set(["content-type"]),
      },
    );

    return Response.json({
      uploadUrl,
      publicUrl: `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${objectKey}`,
      key: objectKey,
    });
  } catch (error) {
    // Se loguea el error completo del lado del servidor (queda en los logs de
    // Vercel, donde solo lo ve el equipo) y al cliente le llega un mensaje
    // genérico. Nunca al revés: el mensaje de una excepción puede contener el
    // nombre del bucket, rutas internas o parte de la configuración.
    //
    // Nunca se loguea el cuerpo de la request ni el token: contienen datos que
    // no deben quedar escritos en ningún registro.
    console.error("[presign] Error al generar la URL de subida", error);
    return errorResponse(
      500,
      "PRESIGN_FAILED",
      "No pudimos preparar la subida de la imagen. Intentá de nuevo.",
    );
  }
}
