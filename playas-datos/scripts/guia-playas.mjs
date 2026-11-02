#!/usr/bin/env node
// Descarga y procesa datos de la Guía de Playas de España (MITECO)

import { readJSON, writeJSON, parseArgs, download, normalizarNombrePlaya, campo, hoy } from './utils.mjs';
import fs from 'fs';

// URL del dataset en datos.gob.es (CKAN API)
const GUIA_PLAYAS_DATASET_ID = 'e0dat0002-guia-de-playas-de-espana';
const CKAN_API_URL = 'https://datos.gob.es/apidata/catalog/dataset';
const GUIA_PLAYAS_URL = `${CKAN_API_URL}/${GUIA_PLAYAS_DATASET_ID}`;

/**
 * Descarga la Guía de Playas desde datos.gob.es usando CKAN API
 */
async function descargarGuiaPlayas() {
  console.log('\nDescargando Guía de Playas de España desde datos.gob.es...');
  
  try {
    // 1. Obtener metadata del dataset para encontrar URL de descarga
    const metadataUrl = `${CKAN_API_URL}/${GUIA_PLAYAS_DATASET_ID}`;
    console.log(`  Consultando metadata: ${metadataUrl}`);
    
    const metadataResponse = await download(metadataUrl);
    const metadata = JSON.parse(metadataResponse);
    
    // 2. Buscar recurso CSV o JSON
    if (!metadata.result || !metadata.result.distribution) {
      console.log('  ⚠️  No se encontraron distribuciones del dataset');
      return [];
    }
    
    const distributions = metadata.result.distribution;
    const csvResource = distributions.find(d => 
      d.format?.toUpperCase() === 'CSV' || 
      d.mediaType === 'text/csv' ||
      d.accessURL?.includes('.csv')
    );
    
    if (!csvResource) {
      console.log('  ⚠️  No se encontró recurso CSV en el dataset');
      console.log(`  Formatos disponibles: ${distributions.map(d => d.format).join(', ')}`);
      return [];
    }
    
    const downloadUrl = csvResource.accessURL;
    console.log(`  Descargando CSV desde: ${downloadUrl}`);
    
    // 3. Descargar y parsear CSV
    const csvData = await download(downloadUrl);
    const playas = parsearCSVGuiaPlayas(csvData);
    
    console.log(`  ✓ ${playas.length} playas descargadas`);
    
    // Filtrar solo provincia de Alicante
    const playasAlicante = playas.filter(p => 
      p.provincia && p.provincia.toLowerCase().includes('alicante')
    );
    
    console.log(`  ✓ ${playasAlicante.length} playas de Alicante`);
    return playasAlicante;
    
  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
    return [];
  }
}

/**
 * Parsea CSV de Guía de Playas (formato simplificado)
 */
function parsearCSVGuiaPlayas(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const header = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
  const playas = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < header.length) continue;
    
    const playa = {};
    header.forEach((key, idx) => {
      playa[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = values[idx] || null;
    });
    
    playas.push(playa);
  }
  
  return playas;
}

/**
 * Limpia nombre bilingüe (toma solo parte española antes de " · ")
 */
function limpiarNombreBilingue(nombre) {
  if (nombre.includes(' · ')) {
    return nombre.split(' · ')[0].trim();
  }
  return nombre;
}

/**
 * Busca una playa en la Guía de Playas por nombre y municipio
 */
function buscarPlaya(nombre, municipio, dataset) {
  if (!dataset || dataset.length === 0) {
    return null;
  }
  
  const nombreLimpio = limpiarNombreBilingue(nombre);
  const nombreNorm = normalizarNombrePlaya(nombreLimpio);
  const municipioNorm = municipio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Buscar coincidencia por nombre y municipio
  const match = dataset.find(p => {
    const pNombreLimpio = limpiarNombreBilingue(p.nombre || '');
    const pNombre = normalizarNombrePlaya(pNombreLimpio);
    const pMunicipio = (p.municipio || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Match exacto de municipio y nombre
    if (pMunicipio === municipioNorm && pNombre === nombreNorm) {
      return true;
    }
    
    // Match parcial (municipio contiene o nombre contiene)
    if (pMunicipio.includes(municipioNorm) || municipioNorm.includes(pMunicipio)) {
      if (pNombre === nombreNorm) {
        return true;
      }
    }
    
    return false;
  });
  
  return match;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, dataset) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const match = buscarPlaya(playa.nombre, playa.municipio, dataset);
  
  if (!match) {
    console.log('  ❌ No encontrada en Guía de Playas');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      longitud_m: campo(null, null, null, null),
      anchura_m: campo(null, null, null, null),
      tipo_arena: campo(null, null, null, null),
      ocupacion: campo(null, null, null, null),
      grado_urbanizacion: campo(null, null, null, null),
      paseo_maritimo: campo(null, null, null, null),
      nudismo: campo(null, null, null, null),
      bandera_azul: campo(null, null, null, null),
      accesibilidad: campo(null, null, null, null)
    };
  }
  
  console.log('  ✓ Encontrada en Guía de Playas');
  
  const fuente = 'Guía de Playas de España (MITECO)';
  const url = GUIA_PLAYAS_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    longitud_m: campo(match.longitud, fuente, url, 'dataset'),
    anchura_m: campo(match.anchura, fuente, url, 'dataset'),
    tipo_arena: campo(match.tipo_arena, fuente, url, 'dataset'),
    ocupacion: campo(match.ocupacion, fuente, url, 'dataset'),
    grado_urbanizacion: campo(match.grado_urbanizacion, fuente, url, 'dataset'),
    paseo_maritimo: campo(match.paseo_maritimo, fuente, url, 'dataset'),
    nudismo: campo(match.nudismo, fuente, url, 'dataset'),
    bandera_azul: campo(match.bandera_azul, fuente, url, 'dataset'),
    accesibilidad: campo(match.accesibilidad, fuente, url, 'dataset')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/guia-playas.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Guía de Playas ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Descargar dataset
  const dataset = await descargarGuiaPlayas();
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, dataset);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.longitud_m.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas encontradas en Guía de Playas`);
}

main().catch(console.error);
