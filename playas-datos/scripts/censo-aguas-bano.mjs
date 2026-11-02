#!/usr/bin/env node
// Descarga y procesa el Censo de Zonas de Aguas de Baño (MITECO)

import { readJSON, writeJSON, parseArgs, downloadBinary, normalizarNombrePlaya, campo, haversine } from './utils.mjs';
import fs from 'fs';

// URL de descarga del censo (verificar formato actual: GeoPackage, SHP, KMZ)
const CENSO_URL = 'https://www.miteco.gob.es/fr/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html';

/**
 * Descarga el Censo de Aguas de Baño
 * NOTA: Requiere verificación manual del formato y URL de descarga directa
 */
async function descargarCenso() {
  console.log('\nDescargando Censo de Zonas de Aguas de Baño...');
  console.log(`Página de descarga: ${CENSO_URL}`);
  console.log('⚠️  Este dataset requiere descarga manual y conversión a GeoJSON');
  console.log('    Formatos disponibles: SHP, GML, KMZ, GeoPackage');
  console.log('    Herramientas sugeridas: ogr2ogr (GDAL) para convertir a GeoJSON');
  
  // En una implementación completa:
  // 1. Descargar archivo (ej. KMZ o GeoPackage)
  // 2. Extraer si es necesario
  // 3. Convertir a GeoJSON con ogr2ogr o biblioteca JS
  // 4. Filtrar a provincia Alicante
  
  return [];
}

/**
 * Busca una playa en el censo por coordenadas (si las tenemos) o por nombre
 */
function buscarEnCenso(playa, censo, coordsData) {
  if (!censo || censo.length === 0) {
    return null;
  }
  
  // Si tenemos coordenadas, buscar por proximidad
  const coords = coordsData?.find(c => c.slug === playa.slug);
  if (coords && coords.lat.valor && coords.lng.valor) {
    const cercanas = censo
      .filter(z => z.lat && z.lng)
      .map(z => ({
        ...z,
        distancia: haversine(coords.lat.valor, coords.lng.valor, z.lat, z.lng)
      }))
      .filter(z => z.distancia < 0.5) // Menos de 500m
      .sort((a, b) => a.distancia - b.distancia);
    
    if (cercanas.length > 0) {
      return cercanas[0];
    }
  }
  
  // Fallback: buscar por nombre
  const nombreNorm = normalizarNombrePlaya(playa.nombre);
  const match = censo.find(z => 
    normalizarNombrePlaya(z.nombre || '') === nombreNorm
  );
  
  return match;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, censo, coordsData) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const match = buscarEnCenso(playa, censo, coordsData);
  
  if (!match) {
    console.log('  ❌ No encontrada en Censo de Aguas de Baño');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      codigo_zona: campo(null, null, null, null),
      tipo_zona: campo(null, null, null, null)
    };
  }
  
  console.log('  ✓ Encontrada en Censo');
  
  const fuente = 'Censo de Zonas de Aguas de Baño (MITECO)';
  const url = CENSO_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    codigo_zona: campo(match.codigo, fuente, url, 'dataset'),
    tipo_zona: campo(match.tipo, fuente, url, 'dataset')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/censo-aguas-bano.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Censo de Aguas de Baño ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Intentar cargar coordenadas si existen
  let coordsData = null;
  try {
    if (fs.existsSync('data/sources/coordenadas.json')) {
      coordsData = readJSON('data/sources/coordenadas.json');
    }
  } catch (e) {}
  
  // Descargar censo
  const censo = await descargarCenso();
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, censo, coordsData);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.codigo_zona.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas encontradas en Censo`);
}

main().catch(console.error);
