import { initializeApp } from "firebase/app";
import { getFirestore, writeBatch, collection, doc } from "firebase/firestore";
import { envSchema } from "../src/lib/envSchema.js";
import { CATEGORIES, type CategoryId } from "../src/constants/categories.js";
import type { ProductDoc } from "../src/types/product.js";

// Este script corre con Node (vía tsx), no dentro de Vite: import.meta.env no
// existe acá, así que cargamos el .env manualmente con la API nativa de Node
// y validamos con el mismo envSchema que usa el navegador (sin duplicarlo),
// pero leyendo de process.env en vez de import.meta.env.
process.loadEnvFile(".env");
const env = envSchema.parse(process.env);

// Conexión propia a Firestore (no reutiliza src/lib/firebase.ts): ese archivo
// está pensado para el bundle de Vite (resolución "bundler"), mientras que
// este script corre bajo Node con resolución "nodenext", que exige extensión
// ".js" en todos los imports relativos de la cadena.
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

// Nombres de producto por categoría. Se repiten a propósito varias marcas
// ("Nike", "Adidas", "Nintendo", "Nivea") en distintas categorías, para poder
// demostrar la búsqueda por prefijo (ej: "ni" o "a") combinada con el filtro
// de categoría durante la verificación manual.
const CATALOG_SEED: Record<CategoryId, string[]> = {
  calzado: [
    "Nike Air Max 90",
    "Nike Air Force 1",
    "Nike Zoom Pegasus 40",
    "Nike Revolution 6",
    "Nike Court Vision",
    "Adidas Ultraboost 22",
    "Adidas Superstar",
    "Adidas Stan Smith",
    "Adidas Gazelle",
    "Puma Suede Classic",
    "Puma RS-X",
    "Reebok Classic Leather",
    "Reebok Club C 85",
    "Vans Old Skool",
    "Vans Sk8-Hi",
    "New Balance 574",
  ],
  ropa: [
    "Nike Dri-FIT Remera",
    "Nike Windrunner Campera",
    "Nike Sportswear Short",
    "Nike Tech Fleece Buzo",
    "Adidas Track Jacket",
    "Adidas Firebird Pantalón",
    "Adidas 3-Stripes Short",
    "Puma Essentials Hoodie",
    "Puma Classics Pantalón",
    "Levi's 501 Jean",
    "Levi's Trucker Campera",
    "Champion Reverse Weave Buzo",
    "Under Armour Tech Remera",
    "The North Face Campera",
    "Wrangler Jean Slim",
  ],
  accesorios: [
    "Nike Heritage Mochila",
    "Nike Dri-FIT Gorra",
    "Nike Elite Medias",
    "Adidas Linear Mochila",
    "Adidas Baseball Gorra",
    "Adidas Running Cinturón",
    "Puma Phase Mochila",
    "Ray-Ban Aviator Anteojos",
    "Casio G-Shock Reloj",
    "Fossil Cuero Reloj",
    "Nixon Time Teller Reloj",
    "Herschel Little America Mochila",
    "New Era 9FIFTY Gorra",
    "Vans Old Skool Riñonera",
    "Nivea Kit Viaje Neceser",
  ],
  electronica: [
    "Nintendo Switch OLED",
    "Nintendo Switch Lite",
    "Nintendo 3DS XL",
    "Apple AirPods Pro",
    "Apple Watch SE",
    "Apple iPad 10",
    "Asus ROG Mouse",
    "Asus VivoBook Notebook",
    "Asus Zenfone Celular",
    "Samsung Galaxy A54",
    "Samsung Smart TV 50",
    "Sony WH-1000XM5 Auriculares",
    "LG Monitor 27",
    "Xiaomi Redmi Note",
    "Logitech MX Master Mouse",
  ],
  hogar: [
    "Nivea Set Aromatizador",
    "Nivea Difusor Ambiente",
    "Ariston Cafetera",
    "Ariston Pava Eléctrica",
    "Oster Licuadora",
    "Philips Aspiradora",
    "Philips Plancha Vapor",
    "Tefal Sartén Antiadherente",
    "Umco Juego de Sábanas",
    "Cannon Toallas Set",
    "Essen Olla a Presión",
    "Adidas Toalla Deportiva",
    "Nike Vaso Térmico",
    "Home Elegance Cortinas",
  ],
};

// Rango de precio (ARS) por categoría, solo para que la UI se vea realista.
const PRICE_RANGES: Record<CategoryId, [number, number]> = {
  calzado: [15000, 80000],
  ropa: [8000, 45000],
  accesorios: [3000, 60000],
  electronica: [20000, 900000],
  hogar: [5000, 150000],
};

interface SeedProduct {
  name: string;
  categoryId: CategoryId;
  price: number;
}

function randomPrice(min: number, max: number): number {
  // Redondeado a la decena más cercana para que no se vea un número "de más".
  return Math.round((Math.random() * (max - min) + min) / 10) * 10;
}

// Con noUncheckedIndexedAccess, indexar un Record siempre da "V | undefined"
// (por si la clave no existiera). Acá SÍ debería existir siempre una entrada
// por cada categoría de CATEGORIES; si no la hay, es un error de configuración
// real (alguien agregó una categoría y se olvidó de sumarla acá) y preferimos
// fallar fuerte y claro en vez de generar productos con datos incompletos.
function getRequired<K extends string, V>(record: Record<K, V>, key: K): V {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`Falta configuración de seed para la categoría "${key}"`);
  }
  return value;
}

function buildSeedProducts(): SeedProduct[] {
  const products: SeedProduct[] = [];

  for (const category of CATEGORIES) {
    const names = getRequired(CATALOG_SEED, category.id);
    const [min, max] = getRequired(PRICE_RANGES, category.id);

    for (const name of names) {
      products.push({ name, categoryId: category.id, price: randomPrice(min, max) });
    }
  }

  return products;
}

async function seed(): Promise<void> {
  const products = buildSeedProducts();
  const productsRef = collection(db, "products");
  const batch = writeBatch(db);

  for (const product of products) {
    const docRef = doc(productsRef);
    const data: ProductDoc = {
      name: product.name,
      nameLower: product.name.toLowerCase(),
      categoryId: product.categoryId,
      price: product.price,
    };
    batch.set(docRef, data);
  }

  try {
    await batch.commit();
    console.log(`Seed completado: ${products.length} productos insertados en 'products'.`);
  } catch (error) {
    console.error("Error al insertar el seed:", error);
    process.exitCode = 1;
  }
}

seed();
