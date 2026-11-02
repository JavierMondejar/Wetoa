#!/usr/bin/env node
// Extrae el listado de Banderas Azules 2026 para Alicante desde ADEAC

import { readJSON, writeJSON, parseArgs, download, downloadBinary, normalizarNombrePlaya, campo } from './utils.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// URL de ADEAC y fuente periodística con listado 2026
const BANDERA_AZUL_URL = 'https://www.banderaazul.org';
const VALENCIA_BONITA_2026_URL = 'https://www.valenciabonita.es/2026/05/05/banderas-azules-comunitat-valenciana-2026/';

/**
 * Descarga listado 2026 desde artículo de prensa (Valencia Bonita)
 */
async function descargarBanderasAzules() {
  console.log('\nDescargando listado de Banderas Azules 2026...');
  console.log(`  Fuente: ${VALENCIA_BONITA_2026_URL}`);
  
  try {
    const html = await download(VALENCIA_BONITA_2026_URL);
    const playasAlicante = extraerPlayasHTML(html);
    console.log(`  ✓ ${playasAlicante.length} playas con Bandera Azul 2026 en Alicante`);
    return playasAlicante;
  } catch (error) {
    console.error(`  [ERROR] No se pudo descargar artículo: ${error.message}`);
    return [];
  }
}

/**
 * Extrae playas de Alicante del HTML del artículo
 */
function extraerPlayasHTML(html) {
  const playas = [];
  
  // Buscar sección de Alicante en el HTML
  const alicanteSectionMatch = html.match(/ALICANTE[\s\S]*?(?=CASTELLÓN|$)/i);
  if (!alicanteSectionMatch) {
    console.log('  [WARN] No se encontró sección de Alicante en el artículo');
    return [];
  }
  
  const alicateSection = alicanteSectionMatch[0];
  
  // Extraer líneas con nombres de playas (típicamente en <li> o <p>)
  const playaMatches = alicateSection.match(/<li[^>]*>([^<]+)<\/li>|<p[^>]*>([^<]+)<\/p>/gi) || [];
  
  for (const match of playaMatches) {
    // Quitar tags HTML
    let texto = match.replace(/<[^>]+>/g, '').trim();
    
    // Filtrar solo líneas que parecen nombres de playas
    if (texto.match(/playa|platja|cala/i) && texto.length > 5 && texto.length < 150) {
      // Extraer municipio si está entre paréntesis
      const municipioMatch = texto.match(/\(([^)]+)\)/);
      const municipio = municipioMatch ? municipioMatch[1].trim() : null;
      
      // Limpiar nombre
      let nombre = texto
        .replace(/\([^)]+\)/g, '') // Quitar municipio entre paréntesis
        .replace(/^\d+[\.\-\s]*/, '') // Quitar números al inicio
        .replace(/\s+/g, ' ')
        .trim();
      
      if (nombre) {
        playas.push({
          nombre,
          municipio,
          year: 2026
        });
      }
    }
  }
  
  return playas;
}

/**
 * Limpia nombre bilingüe (toma solo parte española antes de " · ")
 */
function limpiarNombreBiligue(nombre) {
  if (nombre.includes(' · ')) {
    return nombre.split(' · ')[0].trim();
  }
  return nombre;
}

/**
 * Busca si una playa tiene Bandera Azul
 */
function tieneBanderaAzul(playa, listado) {
  if (!listado || listado.length === 0) {
    return null;
  }
  
  const nombreLimpio = limpiarNombreBiligue(playa.nombre);
  const nombreNorm = normalizarNombrePlaya(nombreLimpio);
  const municipioNorm = playa.municipio.toLowerCase();
  
  const match = listado.find(b => {
    const bNombreLimpio = limpiarNombreBiligue(b.nombre || '');
    const bNombre = normalizarNombrePlaya(bNombreLimpio);
    const bMunicipio = (b.municipio || '').toLowerCase();
    
    // Match por nombre y municipio
    if (bMunicipio === municipioNorm && bNombre === nombreNorm) {
      return true;
    }
    
    // Match solo por nombre si municipio no está disponible
    if (!b.municipio && bNombre === nombreNorm) {
      return true;
    }
    
    return false;
  });
  
  return match ? match.year : false;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, listado) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const result = tieneBanderaAzul(playa, listado);
  
  if (result === null) {
    console.log('  ⚠️  No se pudo verificar (listado no disponible)');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      bandera_azul_2026: campo(null, null, null, null)
    };
  }
  
  const tiene = result !== false;
  const year = result || 2026;
  
  console.log(`  ${tiene ? '✓' : '✗'} Bandera Azul ${year}: ${tiene ? 'SÍ' : 'NO'}`);
  
  const fuente = `Valencia Bonita (prensa) - Bandera Azul ${year}`;
  const url = VALENCIA_BONITA_2026_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    bandera_azul_2026: campo(tiene, fuente, url, 'dataset', 'media') // Confianza media (fuente periodística)
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
