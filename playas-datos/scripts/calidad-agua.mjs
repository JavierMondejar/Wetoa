#!/usr/bin/env node
// Obtiene datos de calidad del agua de baño desde European Environment Agency

import { readJSON, writeJSON, parseArgs, download, downloadBinary, normalizarNombrePlaya, campo } from './utils.mjs';
import fs from 'fs';

// URLs de la European Environment Agency para datos de calidad de agua
const EEA_BATHING_WATER_URL = 'https://www.eea.europa.eu/data-and-maps/data/bathing-water-directive-status-of-bathing-water';

/**
 * Descarga datos de calidad del agua de la EEA
 * La EEA proporciona archivos descargables (CSV, Excel, GeoJSON)
 */
async function descargarCalidadAgua() {
  console.log('\nDescargando datos de calidad del agua...');
  console.log(`Fuente: European Environment Agency`);
  console.log(`URL: ${EEA_BATHING_WATER_URL}`);
  console.log('⚠️  Requiere verificar URL de descarga directa del dataset CSV/Excel');
  console.log('    Alternativa: Náyade (MITECO) si ofrece descarga sin clave');
  
  // La EEA publica datos anuales de calidad del agua de baño
  // Formato típico: CSV con columnas como:
  // - Country, Region, Site name, Coordinates, Quality (Excellent/Good/Sufficient/Poor)
  
  try {
    // Aquí iría la descarga real del CSV/Excel
    // const data = await download('URL_DIRECTA_AL_CSV');
    // return parsearDatosCalidad(data);
    
    return [];
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return [];
  }
}

/**
 * Busca datos de calidad para una playa
 */
function buscarCalidadAgua(playa, dataset, coordsData) {
  if (!dataset || dataset.length === 0) {
    return null;
  }
  
  const nombreNorm = normalizarNombrePlaya(playa.nombre);
  
  // Buscar por nombre normalizado
  const match = dataset.find(d => {
    const dNombre = normalizarNombrePlaya(d.nombre || '');
    return dNombre === nombreNorm;
  });
  
  return match;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, dataset, coordsData) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const match = buscarCalidadAgua(playa, dataset, coordsData);
  
  if (!match) {
    console.log('  ❌ No se encontraron datos de calidad del agua');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      calidad_2024: campo(null, null, null, null),
      calidad_2025: campo(null, null, null, null),
      apta_bano: campo(null, null, null, null)
    };
  }
  
  console.log(`  ✓ Calidad encontrada: ${match.calidad}`);
  
  const fuente = 'European Environment Agency - Bathing Water Quality';
  const url = EEA_BATHING_WATER_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    calidad_2024: campo(match.calidad_2024, fuente, url, 'dataset'),
    calidad_2025: campo(match.calidad_2025, fuente, url, 'dataset'),
    apta_bano: campo(match.apta !== false, fuente, url, 'dataset')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/calidad-agua.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Calidad del Agua ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Cargar coordenadas si existen
  let coordsData = null;
  try {
    if (fs.existsSync('data/sources/coordenadas.json')) {
      coordsData = readJSON('data/sources/coordenadas.json');
    }
  } catch (e) {}
  
  // Descargar dataset
  const dataset = await descargarCalidadAgua();
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, dataset, coordsData);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.calidad_2025.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas con datos de calidad`);
}

main().catch(console.error);
