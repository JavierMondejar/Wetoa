#!/usr/bin/env node
// Obtiene coordenadas de playas desde datasets oficiales y Nominatim (fallback)

import { readJSON, writeJSON, parseArgs, download, sleep, normalizarNombrePlaya, campo } from './utils.mjs';

const USER_AGENT = 'WelcomeToAlicante/1.0 (contact@welcometoalicante.info)';
const ENABLE_NOMINATIM = process.env.ENABLE_NOMINATIM !== 'false';

/**
 * Limpia el nombre de playa para búsqueda (extrae solo la parte en español)
 */
function limpiarNombreParaBusqueda(nombre) {
  // Si tiene " · ", tomar solo la parte antes (español)
  if (nombre.includes(' · ')) {
    nombre = nombre.split(' · ')[0];
  }
  // Quitar texto entre paréntesis
  nombre = nombre.replace(/\s*\([^)]*\)/g, '');
  return nombre.trim();
}

/**
 * Genera variantes de nombres para búsqueda
 */
function generarVariantes(nombre, municipio) {
  const nombreLimpio = limpiarNombreParaBusqueda(nombre);
  
  // Variantes valencianas comunes
  const variantes = [
    `${nombreLimpio}, ${municipio}, Alicante, España`,
  ];
  
  // Variantes Platja/Playa, l'/de la, etc.
  if (nombreLimpio.includes('playa')) {
    variantes.push(`${nombreLimpio.replace('playa', 'platja')}, ${municipio}, Alicante, España`);
  }
  if (nombreLimpio.includes('espigo')) {
    variantes.push(`Platja de l'Espigó, ${municipio}, Alicante, España`);
    variantes.push(`L'Espigó, ${municipio}, Alicante, España`);
  }
  if (nombreLimpio.includes('mascarat')) {
    variantes.push(`Cala Mascarat, ${municipio}, Alicante, España`);
    variantes.push(`Mascarat, ${municipio}, Alicante, España`);
  }
  
  return variantes;
}

/**
 * Busca coordenadas en Nominatim con variantes (respetando política de uso: 1 req/s)
 */
async function buscarNominatim(nombre, municipio) {
  if (!ENABLE_NOMINATIM) {
    console.log(`  [SKIP] Nominatim deshabilitado (ENABLE_NOMINATIM=false)`);
    return null;
  }

  const variantes = generarVariantes(nombre, municipio);
  
  for (const query of variantes) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    
    try {
      const data = await download(url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const results = JSON.parse(data);
      
      await sleep(1000); // Respetar 1 req/s
      
      if (results.length === 0) {
        continue; // Probar siguiente variante
      }
      
      // Preferir resultados con tourism=beach o natural=beach
      const beach = results.find(r => 
        r.type === 'beach' || 
        r.class === 'tourism' || 
        r.class === 'natural'
      ) || results[0];
      
      return {
        lat: parseFloat(beach.lat),
        lng: parseFloat(beach.lon),
        fuente: 'Nominatim OSM',
        url: `https://nominatim.openstreetmap.org/ui/search.html?q=${encodeURIComponent(query)}`,
        confianza: results.length > 1 ? 'media' : 'alta',
        nota: results.length > 1 ? `${results.length} resultados encontrados` : null
      };
    } catch (error) {
      console.error(`  [ERROR] Nominatim variante "${query}": ${error.message}`);
      continue;
    }
  }
  
  return null; // Ninguna variante encontró resultados
}

/**
 * Busca playas en Overpass API dentro de un municipio
 */
async function buscarOverpassPorMunicipio(nombre, municipio) {
  if (!ENABLE_NOMINATIM) {
    return null;
  }

  const nombreNorm = normalizarNombrePlaya(nombre);
  
  // Query para buscar natural=beach dentro del municipio
  const query = `
    [out:json][timeout:25];
    area["name"="${municipio}"]["admin_level"~"^(8|9)$"]->.searchArea;
    (
      node["natural"="beach"](area.searchArea);
      way["natural"="beach"](area.searchArea);
    );
    out center;
  `;
  
  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const data = await download(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const result = JSON.parse(data);
    
    await sleep(1000);
    
    if (!result.elements || result.elements.length === 0) {
      return null;
    }
    
    // Buscar coincidencia por nombre
    for (const element of result.elements) {
      if (element.tags && element.tags.name) {
        const elemNombre = normalizarNombrePlaya(element.tags.name);
        if (elemNombre === nombreNorm || elemNombre.includes(nombreNorm) || nombreNorm.includes(elemNombre)) {
          const lat = element.lat || element.center?.lat;
          const lng = element.lon || element.center?.lon;
          if (lat && lng) {
            return {
              lat,
              lng,
              fuente: 'Overpass API OSM',
              url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`,
              confianza: 'media',
              nota: `Encontrado en área de ${municipio}`
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(`  [ERROR] Overpass: ${error.message}`);
  }
  
  return null;
}

/**
 * Busca en datasets oficiales (MITECO Guía de Playas)
 * Nota: Esta función será implementada cuando descarguemos el dataset
 */
function buscarEnDatasetOficial(nombre, municipio, datasets) {
  // Aquí buscaríamos en los datasets descargados por guia-playas.mjs y censo-aguas-bano.mjs
  // Por ahora retornamos null y dejamos que Nominatim haga el trabajo
  return null;
}

/**
 * Procesa una playa
 */
async function procesarPlaya(playa, datasets) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  // 1. Intentar desde datasets oficiales
  let coords = buscarEnDatasetOficial(playa.nombre, playa.municipio, datasets);
  
  // 2. Fallback a Nominatim con variantes
  if (!coords) {
    console.log('  Buscando en Nominatim (con variantes)...');
    coords = await buscarNominatim(playa.nombre, playa.municipio);
  }
  
  // 3. Fallback a Overpass por municipio
  if (!coords) {
    console.log('  Buscando en Overpass por área de municipio...');
    coords = await buscarOverpassPorMunicipio(playa.nombre, playa.municipio);
  }
  
  if (!coords) {
    console.log('  ❌ No se encontraron coordenadas');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      lat: campo(null, null, null, null),
      lng: campo(null, null, null, null)
    };
  }
  
  console.log(`  ✓ Coordenadas: ${coords.lat}, ${coords.lng} (${coords.fuente}, confianza: ${coords.confianza})`);
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    lat: campo(coords.lat, coords.fuente, coords.url, 'api', coords.confianza),
    lng: campo(coords.lng, coords.fuente, coords.url, 'api', coords.confianza),
    nota: coords.nota || null
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/coordenadas.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Coordenadas ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  console.log(`Nominatim: ${ENABLE_NOMINATIM ? 'habilitado' : 'deshabilitado'}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  const datasets = {}; // Aquí cargaríamos datasets oficiales si los tuviéramos
  const results = [];
  
  for (const beach of toProcess) {
    const result = await procesarPlaya(beach, datasets);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.lat.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas con coordenadas`);
}

main().catch(console.error);
