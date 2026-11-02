#!/usr/bin/env node
// Descarga y procesa el Censo de Zonas de Aguas de Baño (MITECO)

import { readJSON, writeJSON, parseArgs, downloadBinary, normalizarNombrePlaya, campo, haversine } from './utils.mjs';
import fs from 'fs';
import { read as readShapefile } from 'shapefile';

// URL de descarga del censo (formato SHP comprimido)
const CENSO_URL = 'https://www.miteco.gob.es/fr/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html';
// URL directa al ZIP (típicamente disponible en el servidor de IDE)
const CENSO_DOWNLOAD_URL = 'https://www.miteco.gob.es/content/dam/miteco/es/cartografia-y-sig/ide/descargas/01-agua/censo_zonas_bano.zip';

/**
 * Descarga y convierte el Censo de Aguas de Baño desde MITECO
 */
async function descargarCenso() {
  console.log('\nDescargando Censo de Zonas de Aguas de Baño...');
  console.log(`  Intentando descarga desde: ${CENSO_DOWNLOAD_URL}`);
  
  try {
    // Intentar descargar el ZIP
    const zipBuffer = await downloadBinary(CENSO_DOWNLOAD_URL);
    console.log(`  ✓ Descargado ZIP (${zipBuffer.length} bytes)`);
    
    // Guardar temporalmente
    const zipPath = '/tmp/censo_zonas_bano.zip';
    fs.writeFileSync(zipPath, zipBuffer);
    
    // Extraer y convertir SHP a GeoJSON usando biblioteca shapefile
    const shpPath = '/tmp/censo_zonas_bano.shp'; // Ajustar según nombre real
    
    // Nota: Para simplificar, intentamos leer directamente si el ZIP contiene un SHP
    // En producción, deberíamos usar unzipper o similar
    console.log('  ⚠️  Conversión SHP→GeoJSON requiere extracción del ZIP');
    console.log('  Por ahora retornando dataset vacío (implementar con unzipper si es necesario)');
    
    return [];
    
  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
    console.log('  ⚠️  No se pudo descargar automáticamente');
    console.log('  Alternativa: Descargar manualmente y colocar GeoJSON en data/raw/');
    return [];
  }
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
