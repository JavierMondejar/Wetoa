// Utilidades comunes para el pipeline de datos de playas

import fs from 'fs';
import https from 'https';
import http from 'http';

/**
 * Lee un archivo JSON
 */
export function readJSON(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

/**
 * Escribe un archivo JSON con formato bonito
 */
export function writeJSON(path, data) {
  fs.mkdirSync(path.substring(0, path.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Parsea argumentos de línea de comandos --flag value
 */
export function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].substring(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

/**
 * Descarga contenido de una URL (soporta HTTP y HTTPS)
 */
export function download(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, options).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

/**
 * Descarga archivo binario
 */
export function downloadBinary(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBinary(res.headers.location, options).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

/**
 * Espera N milisegundos
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normaliza nombre de playa para comparación (quita artículos, acentos, minúsculas)
 */
export function normalizarNombrePlaya(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\b(playa|platja|cala|de|del|la|el|l'|d')\b/g, '') // quitar palabras comunes
    .replace(/[^a-z0-9]/g, '') // solo alfanuméricos
    .trim();
}

/**
 * Calcula distancia haversine entre dos puntos (en km)
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Crea un objeto de campo con proveniencia
 */
export function campo(valor, fuente, url, metodo, confianza = 'alta') {
  const fecha = new Date().toISOString().split('T')[0];
  if (valor === null || valor === undefined) {
    return { valor: null, estado: 'por confirmar' };
  }
  return { valor, fuente, url, fecha, metodo, confianza };
}

/**
 * Obtiene fecha de hoy en formato YYYY-MM-DD
 */
export function hoy() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Tabla de equivalencias valenciá-castellano para nombres de playas
 */
export const equivalenciasValenciano = {
  'platja': 'playa',
  'cala': 'cala',
  'espigo': 'espigón',
  'muntanyar': 'montañar',
  'granadella': 'granadella',
  'portitxol': 'portichol',
  'ambolo': 'ambolo',
  'barraca': 'barraca',
  'moraira': 'moraira'
};
