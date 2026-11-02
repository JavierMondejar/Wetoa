#!/usr/bin/env node
// Obtiene datos de calidad del agua de baño desde European Environment Agency

import { readJSON, writeJSON, parseArgs, download, downloadBinary, normalizarNombrePlaya, campo } from './utils.mjs';
import fs from 'fs';

// URL del endpoint de datos de la EEA (CSV descargable)
// Usar el CSV más reciente disponible de bathing water quality
const EEA_BATHING_WATER_CSV = 'https://www.eea.europa.eu/api/SITE/downloads/bathing-water-quality/bw-qual-assessments-2023.csv';

/**
 * Descarga datos de calidad del agua de la EEA
 */
async function descargarCalidadAgua() {
  console.log('\nDescargando datos de calidad del agua desde EEA...');
  console.log(`  URL: ${EEA_BATHING_WATER_CSV}`);
  
  try {
    const csvData = await download(EEA_BATHING_WATER_CSV);
    const playas = parsearCSVCalidadAgua(csvData);
    
    console.log(`  ✓ ${playas.length} zonas de baño descargadas`);
    
    // Filtrar solo España
    const playasEspana = playas.filter(p => 
      p.country && p.country.toUpperCase() === 'SPAIN'
    );
    
    console.log(`  ✓ ${playasEspana.length} zonas de baño de España`);
    return playasEspana;
    
  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
    console.log('  ⚠️  Intentando URL alternativa o año anterior...');
    
    // Fallback: Probar año anterior
    try {
      const fallbackUrl = 'https://www.eea.europa.eu/api/SITE/downloads/bathing-water-quality/bw-qual-assessments-2022.csv';
      console.log(`  Intentando: ${fallbackUrl}`);
      const csvData = await download(fallbackUrl);
      const playas = parsearCSVCalidadAgua(csvData);
      const playasEspana = playas.filter(p => p.country?.toUpperCase() === 'SPAIN');
      console.log(`  ✓ ${playasEspana.length} zonas de baño de España (2022)`);
      return playasEspana;
    } catch (fallbackError) {
      console.error(`  [ERROR] Fallback también falló: ${fallbackError.message}`);
      return [];
    }
  }
}

/**
 * Parsea CSV de calidad del agua de EEA
 */
function parsearCSVCalidadAgua(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const playas = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Parsear CSV respetando comillas
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    if (values.length < header.length) continue;
    
    const playa = {};
    header.forEach((key, idx) => {
      playa[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = values[idx]?.replace(/^"|"$/g, '') || null;
    });
    
    playas.push(playa);
  }
  
  return playas;
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
