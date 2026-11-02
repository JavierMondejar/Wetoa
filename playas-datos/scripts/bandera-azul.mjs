#!/usr/bin/env node
// Extrae el listado de Banderas Azules 2026 para Alicante desde ADEAC

import { readJSON, writeJSON, parseArgs, download, normalizarNombrePlaya, campo } from './utils.mjs';

// URL de ADEAC (Asociación de Educación Ambiental y del Consumidor)
const BANDERA_AZUL_URL = 'https://www.banderaazul.org';

/**
 * Descarga el listado de Banderas Azules 2026
 * NOTA: Típicamente se publica como PDF o página web
 */
async function descargarBanderasAzules() {
  console.log('\nDescargando listado de Banderas Azules 2026...');
  console.log(`Fuente: ADEAC (${BANDERA_AZUL_URL})`);
  console.log('⚠️  El listado oficial se publica en PDF o página web');
  console.log('    Requiere extracción manual o scraping de la página');
  
  // Posibles enfoques:
  // 1. Descargar PDF y extraer texto
  // 2. Scrapear página HTML del listado
  // 3. Buscar si ofrecen un endpoint JSON (poco probable)
  
  // Listado de ejemplo basado en playas típicas con Bandera Azul en Alicante
  // NOTA: Esto es solo para demostración, debe obtenerse del sitio oficial
  const ejemploPlayasBanderaAzul2025 = [
    'Playa de San Juan',
    'Playa del Postiguet',
    'Playa del Albir',
    'Playa de Levante (Benidorm)',
    'Playa de Poniente (Benidorm)',
    'Cala del Moraig',
    'Playa de la Granadella'
  ];
  
  return [];
}

/**
 * Busca si una playa tiene Bandera Azul
 */
function tieneBanderaAzul(playa, listado) {
  if (!listado || listado.length === 0) {
    return null;
  }
  
  const nombreNorm = normalizarNombrePlaya(playa.nombre);
  
  const match = listado.find(b => {
    const bNombre = normalizarNombrePlaya(b.nombre || '');
    return bNombre === nombreNorm;
  });
  
  return match !== undefined;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, listado) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const tiene = tieneBanderaAzul(playa, listado);
  
  if (tiene === null) {
    console.log('  ⚠️  No se pudo verificar (listado no disponible)');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      bandera_azul_2026: campo(null, null, null, null)
    };
  }
  
  console.log(`  ${tiene ? '✓' : '✗'} Bandera Azul 2026: ${tiene ? 'SÍ' : 'NO'}`);
  
  const fuente = 'ADEAC - Bandera Azul';
  const url = BANDERA_AZUL_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    bandera_azul_2026: campo(tiene, fuente, url, 'dataset')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/bandera-azul.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Bandera Azul ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Descargar listado
  const listado = await descargarBanderasAzules();
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, listado);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const conBandera = results.filter(r => r.bandera_azul_2026.valor === true).length;
  const verificados = results.filter(r => r.bandera_azul_2026.valor !== null).length;
  console.log(`\nResumen: ${conBandera} con Bandera Azul, ${verificados}/${results.length} verificadas`);
}

main().catch(console.error);
