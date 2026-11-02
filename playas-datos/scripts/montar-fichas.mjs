#!/usr/bin/env node
// Monta fichas finales combinando todas las fuentes y genera informe de completitud

import { readJSON, writeJSON, parseArgs, haversine, normalizarNombrePlaya } from './utils.mjs';
import fs from 'fs';
import path from 'path';

/**
 * Carga todas las fuentes de datos disponibles
 */
function cargarFuentes() {
  const fuentes = {};
  const archivos = [
    'coordenadas',
    'guia-playas',
    'censo-aguas-bano',
    'calidad-agua',
    'bandera-azul',
    'osm-servicios',
    'clima-agua',
    'cercanas'
  ];
  
  for (const archivo of archivos) {
    const ruta = `data/sources/${archivo}.json`;
    if (fs.existsSync(ruta)) {
      fuentes[archivo] = readJSON(ruta);
      console.log(`✓ Cargado: ${archivo}.json (${fuentes[archivo].length} registros)`);
    } else {
      console.log(`⚠️  No encontrado: ${archivo}.json`);
      fuentes[archivo] = [];
    }
  }
  
  return fuentes;
}

/**
 * Combina datos de una playa desde todas las fuentes
 */
function montarFicha(playa, fuentes) {
  const ficha = {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    tipo: playa.tipo,
    urls: {
      es: playa.url_es,
      en: playa.url_en
    },
    keyword_principal: playa.keyword_principal,
    notion_id: playa.notion_id
  };
  
  // Coordenadas
  const coords = fuentes.coordenadas.find(c => c.slug === playa.slug);
  if (coords) {
    ficha.coordenadas = {
      lat: coords.lat,
      lng: coords.lng
    };
  }
  
  // Guía de Playas
  const guia = fuentes['guia-playas'].find(g => g.slug === playa.slug);
  if (guia) {
    ficha.dimensiones = {
      longitud_m: guia.longitud_m,
      anchura_m: guia.anchura_m
    };
    ficha.caracteristicas = {
      tipo_arena: guia.tipo_arena,
      ocupacion: guia.ocupacion,
      grado_urbanizacion: guia.grado_urbanizacion,
      paseo_maritimo: guia.paseo_maritimo,
      nudismo: guia.nudismo,
      accesibilidad: guia.accesibilidad
    };
  }
  
  // Censo de Aguas de Baño
  const censo = fuentes['censo-aguas-bano'].find(c => c.slug === playa.slug);
  if (censo) {
    ficha.censo_aguas_bano = {
      codigo_zona: censo.codigo_zona,
      tipo_zona: censo.tipo_zona
    };
  }
  
  // Calidad del Agua
  const calidad = fuentes['calidad-agua'].find(c => c.slug === playa.slug);
  if (calidad) {
    ficha.calidad_agua = {
      calidad_2024: calidad.calidad_2024,
      calidad_2025: calidad.calidad_2025,
      apta_bano: calidad.apta_bano
    };
  }
  
  // Bandera Azul
  const bandera = fuentes['bandera-azul'].find(b => b.slug === playa.slug);
  if (bandera) {
    ficha.bandera_azul_2026 = bandera.bandera_azul_2026;
  }
  
  // Servicios OSM
  const servicios = fuentes['osm-servicios'].find(s => s.slug === playa.slug);
  if (servicios) {
    ficha.servicios = servicios.servicios;
  }
  
  // Clima del Agua
  const clima = fuentes['clima-agua'].find(c => c.slug === playa.slug);
  if (clima) {
    ficha.temperatura_agua = clima.temperatura_agua_mensual;
  }
  
  // Playas Cercanas
  const cercanas = fuentes.cercanas.find(c => c.slug === playa.slug);
  if (cercanas) {
    ficha.playas_cercanas = cercanas.playas_cercanas;
  }
  
  return ficha;
}

/**
 * Calcula completitud de una ficha
 */
function calcularCompletitud(ficha) {
  let total = 0;
  let completos = 0;
  
  function contarCampos(obj) {
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        if (obj[key].valor !== undefined) {
          total++;
          if (obj[key].valor !== null) {
            completos++;
          }
        } else {
          contarCampos(obj[key]);
        }
      }
    }
  }
  
  contarCampos(ficha);
  
  return {
    total,
    completos,
    porcentaje: total > 0 ? Math.round(completos / total * 100) : 0
  };
}

/**
 * Genera informe de completitud
 */
function generarInforme(fichas) {
  const informe = {
    fecha_generacion: new Date().toISOString().split('T')[0],
    total_playas: fichas.length,
    resumen_por_playa: [],
    resumen_por_fuente: {}
  };
  
  // Por playa
  for (const ficha of fichas) {
    const comp = calcularCompletitud(ficha);
    informe.resumen_por_playa.push({
      slug: ficha.slug,
      nombre: ficha.nombre,
      campos_totales: comp.total,
      campos_completos: comp.completos,
      completitud_porcentaje: comp.porcentaje
    });
  }
  
  // Por fuente
  const fuentes = ['coordenadas', 'guia-playas', 'censo-aguas-bano', 'calidad-agua', 'bandera-azul', 'osm-servicios', 'clima-agua', 'cercanas'];
  for (const fuente of fuentes) {
    let encontradas = 0;
    for (const ficha of fichas) {
      // Verificar si la ficha tiene datos de esta fuente
      let tieneDatos = false;
      
      if (fuente === 'coordenadas' && ficha.coordenadas?.lat?.valor) tieneDatos = true;
      else if (fuente === 'guia-playas' && ficha.dimensiones?.longitud_m?.valor) tieneDatos = true;
      else if (fuente === 'censo-aguas-bano' && ficha.censo_aguas_bano?.codigo_zona?.valor) tieneDatos = true;
      else if (fuente === 'calidad-agua' && ficha.calidad_agua?.calidad_2025?.valor) tieneDatos = true;
      else if (fuente === 'bandera-azul' && ficha.bandera_azul_2026?.valor !== null) tieneDatos = true;
      else if (fuente === 'osm-servicios' && ficha.servicios?.valor) tieneDatos = true;
      else if (fuente === 'clima-agua' && ficha.temperatura_agua?.valor) tieneDatos = true;
      else if (fuente === 'cercanas' && ficha.playas_cercanas?.valor) tieneDatos = true;
      
      if (tieneDatos) encontradas++;
    }
    
    informe.resumen_por_fuente[fuente] = {
      playas_con_datos: encontradas,
      cobertura_porcentaje: Math.round(encontradas / fichas.length * 100)
    };
  }
  
  return informe;
}

/**
 * Genera informe en markdown
 */
function generarInformeMd(informe) {
  let md = `# Informe de Completitud de Datos - Playas de Alicante\n\n`;
  md += `**Fecha:** ${informe.fecha_generacion}\n`;
  md += `**Total de playas:** ${informe.total_playas}\n\n`;
  
  md += `## Resumen por Fuente\n\n`;
  md += `| Fuente | Playas con Datos | Cobertura |\n`;
  md += `|--------|------------------|----------|\n`;
  for (const [fuente, datos] of Object.entries(informe.resumen_por_fuente)) {
    md += `| ${fuente} | ${datos.playas_con_datos}/${informe.total_playas} | ${datos.cobertura_porcentaje}% |\n`;
  }
  
  md += `\n## Resumen por Playa\n\n`;
  md += `| Playa | Campos Completos | Completitud |\n`;
  md += `|-------|------------------|-------------|\n`;
  
  const ordenadas = informe.resumen_por_playa.sort((a, b) => b.completitud_porcentaje - a.completitud_porcentaje);
  for (const playa of ordenadas) {
    md += `| ${playa.nombre} | ${playa.campos_completos}/${playa.campos_totales} | ${playa.completitud_porcentaje}% |\n`;
  }
  
  return md;
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Montar Fichas ===');
  console.log(`Input: ${input}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  console.log('\nCargando fuentes de datos...');
  const fuentes = cargarFuentes();
  
  console.log('\nMontando fichas...');
  const fichas = [];
  const cruzeDudoso = [];
  
  for (const beach of toProcess) {
    console.log(`\n[${beach.slug}] ${beach.nombre}`);
    const ficha = montarFicha(beach, fuentes);
    fichas.push(ficha);
    
    // Guardar ficha individual
    const outputPath = `data/fichas/${beach.slug}.json`;
    writeJSON(outputPath, ficha);
    console.log(`  ✓ Ficha guardada en ${outputPath}`);
  }
  
  console.log('\nGenerando informe de completitud...');
  const informe = generarInforme(fichas);
  writeJSON('data/informe-completitud.json', informe);
  console.log('✓ Informe JSON guardado en data/informe-completitud.json');
  
  const informeMd = generarInformeMd(informe);
  fs.writeFileSync('data/informe-completitud.md', informeMd, 'utf-8');
  console.log('✓ Informe Markdown guardado en data/informe-completitud.md');
  
  if (cruzeDudoso.length > 0) {
    writeJSON('data/cruce-dudoso.json', cruzeDudoso);
    console.log(`⚠️  ${cruzeDudoso.length} playas con cruce dudoso guardadas en data/cruce-dudoso.json`);
  }
  
  console.log('\n=== Resumen Final ===');
  console.log(`Fichas generadas: ${fichas.length}`);
  console.log('\nCobertura por fuente:');
  for (const [fuente, datos] of Object.entries(informe.resumen_por_fuente)) {
    console.log(`  ${fuente}: ${datos.cobertura_porcentaje}%`);
  }
}

main().catch(console.error);
