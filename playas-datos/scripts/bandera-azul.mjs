#!/usr/bin/env node
// Extrae el listado de Banderas Azules 2026 para Alicante desde ADEAC

import { readJSON, writeJSON, parseArgs, download, downloadBinary, normalizarNombrePlaya, campo } from './utils.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// URL de ADEAC (Asociación de Educación Ambiental y del Consumidor)
const BANDERA_AZUL_URL = 'https://www.banderaazul.org';
// Intentar URL directa al PDF más reciente (actualizar año según disponibilidad)
const BANDERA_AZUL_PDF_2025 = 'https://www.banderaazul.org/sites/default/files/playas_2025.pdf';
const BANDERA_AZUL_PDF_2024 = 'https://www.adeac.es/sites/default/files/playas_bandera_azul_2024.pdf';

/**
 * Descarga y parsea el PDF de Banderas Azules
 */
async function descargarBanderasAzules() {
  console.log('\nDescargando listado de Banderas Azules...');
  
  // Intentar años más recientes primero
  const urls = [
    { url: BANDERA_AZUL_PDF_2025, year: 2025 },
    { url: BANDERA_AZUL_PDF_2024, year: 2024 }
  ];
  
  for (const { url, year } of urls) {
    try {
      console.log(`  Intentando descargar PDF ${year}: ${url}`);
      const pdfBuffer = await downloadBinary(url);
      console.log(`  ✓ Descargado PDF (${pdfBuffer.length} bytes)`);
      
      // Parsear PDF
      const pdfData = await pdfParse(pdfBuffer);
      console.log(`  ✓ PDF parseado (${pdfData.numpages} páginas)`);
      
      // Extraer playas de Alicante del texto
      const playasAlicante = extraerPlayasAlicantePDF(pdfData.text, year);
      console.log(`  ✓ ${playasAlicante.length} playas con Bandera Azul en Alicante (${year})`);
      
      return playasAlicante;
      
    } catch (error) {
      console.log(`  [WARN] No se pudo descargar PDF ${year}: ${error.message}`);
      continue;
    }
  }
  
  console.log('  ⚠️  No se pudo descargar ningún PDF de Bandera Azul');
  
  // Fallback: usar archivo local si existe
  try {
    if (fs.existsSync('data/raw/bandera-azul-2024-alicante.json')) {
      console.log('  Usando datos de referencia locales (data/raw/bandera-azul-2024-alicante.json)');
      const localData = readJSON('data/raw/bandera-azul-2024-alicante.json');
      return localData;
    }
  } catch (e) {}
  
  return [];
}

/**
 * Extrae playas de Alicante del texto del PDF
 */
function extraerPlayasAlicantePDF(text, year) {
  const playas = [];
  const lines = text.split('\n');
  
  let enSeccionAlicante = false;
  
  for (const line of lines) {
    const lineTrim = line.trim();
    
    // Detectar inicio de sección Alicante
    if (lineTrim.match(/alicante/i) && !lineTrim.match(/valencia|castellón|murcia/i)) {
      enSeccionAlicante = true;
      continue;
    }
    
    // Detectar fin de sección (siguiente provincia)
    if (enSeccionAlicante && lineTrim.match(/^(barcelona|tarragona|girona|valencia|castellón|murcia|almería|granada|málaga)/i)) {
      enSeccionAlicante = false;
    }
    
    // Extraer playas en sección Alicante
    if (enSeccionAlicante && lineTrim.length > 3) {
      // Filtrar líneas que parecen nombres de playas
      if (lineTrim.match(/playa|platja|cala|beach/i)) {
        // Limpiar y normalizar
        let nombre = lineTrim
          .replace(/^\d+[\.\-\s]*/,' ') // Quitar números al inicio
          .replace(/\s+/g, ' ')
          .trim();
        
        if (nombre.length > 5 && nombre.length < 100) {
          playas.push({
            nombre,
            year,
            municipio: null // Extraer si está en el PDF
          });
        }
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
  const year = result || 2024;
  
  console.log(`  ${tiene ? '✓' : '✗'} Bandera Azul ${year}: ${tiene ? 'SÍ' : 'NO'}`);
  
  const fuente = `ADEAC - Bandera Azul ${year}`;
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
