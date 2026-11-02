#!/usr/bin/env node
// Descarga y procesa datos de la Guía de Playas de España (MITECO)

import { readJSON, writeJSON, parseArgs, download, normalizarNombrePlaya, campo, hoy } from './utils.mjs';

// URL del dataset en datos.gob.es
// Nota: Verificar la URL actual y formato del archivo (puede ser CSV, JSON, o necesitar descarga de ZIP)
const GUIA_PLAYAS_URL = 'https://datos.gob.es/en/catalogo/e0dat0002-guia-de-playas-de-espana';

/**
 * Descarga la Guía de Playas
 * NOTA: La URL real del archivo debe verificarse manualmente en datos.gob.es
 * El dataset puede estar en varios formatos (CSV, XLS, JSON)
 */
async function descargarGuiaPlayas() {
  console.log('\nDescargando Guía de Playas de España...');
  console.log('NOTA: Esta URL debe verificarse manualmente en datos.gob.es');
  console.log(`URL del catálogo: ${GUIA_PLAYAS_URL}`);
  
  // Por ahora, simulamos la estructura esperada basada en la documentación típica de MITECO
  // En una implementación real, aquí descargaríamos el CSV/JSON desde la URL directa
  
  try {
    // Intentar descargar desde posible URL directa
    // const data = await download('URL_DIRECTA_AL_CSV');
    // return parsearCSV(data);
    
    console.log('⚠️  Descarga no implementada: verificar formato y URL exacta en datos.gob.es');
    return [];
  } catch (error) {
    console.error(`Error descargando: ${error.message}`);
    return [];
  }
}

/**
 * Busca una playa en la Guía de Playas por nombre y municipio
 */
function buscarPlaya(nombre, municipio, dataset) {
  if (!dataset || dataset.length === 0) {
    return null;
  }
  
  const nombreNorm = normalizarNombrePlaya(nombre);
  const municipioNorm = municipio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Buscar coincidencia exacta
  const match = dataset.find(p => {
    const pNombre = normalizarNombrePlaya(p.nombre || '');
    const pMunicipio = (p.municipio || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return pNombre === nombreNorm && pMunicipio.includes(municipioNorm);
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
