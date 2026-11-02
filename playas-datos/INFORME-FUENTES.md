# Informe de Fuentes de Datos - Playas Alicante

**Fecha**: 2 noviembre 2026  
**Pipeline**: `playas-datos/`  
**Objetivo**: Construir fichas de playa para 127 playas de Alicante con datos verificables

## Estado de las Fuentes

### ✅ Fuentes Operativas

#### 1. **Coordenadas (Nominatim + Overpass OSM)**
- **Estado**: FUNCIONAL
- **URL**: `https://nominatim.openstreetmap.org/search`
- **Método**: API pública sin clave
- **Datos**: Latitud/longitud de playas
- **Observaciones**: 
  - Soporta variantes valencianas de nombres
  - Fallback a Overpass si Nominatim falla
  - Rate limit: 1 req/s con User-Agent personalizado

#### 2. **Servicios OSM (Overpass)**
- **Estado**: FUNCIONAL con ajustes
- **URL**: `https://overpass-api.de/api/interpreter`
- **Método**: Consulta Overpass QL
- **Datos**: Parkings, baños, paradas de bus cerca de playas
- **Observaciones**:
  - Timeout ajustado a 90s
  - Radio reducido a 300m para evitar timeouts
  - Rate limit: 1 req/s
  - Reintentos con backoff exponencial

#### 3. **Clima/Agua (Open-Meteo Marine)**
- **Estado**: FUNCIONAL
- **URL**: `https://marine-api.open-meteo.com/v1/marine`
- **Método**: API pública sin clave
- **Datos**: Temperatura superficial del mar (`sea_surface_temperature`)
- **Observaciones**:
  - Parámetro correcto: `sea_surface_temperature` (no `ocean_temperature`)
  - Datos históricos disponibles

#### 4. **Playas Cercanas (Haversine)**
- **Estado**: FUNCIONAL
- **Método**: Cálculo geométrico local
- **Datos**: 3 playas más cercanas por distancia euclidiana
- **Observaciones**: No requiere descarga externa

### ❌ Fuentes No Disponibles

#### 5. **Calidad del Agua (EEA - European Environment Agency)**
- **Estado**: **NO DISPONIBLE**
- **URL**: `https://www.eea.europa.eu/api/SITE/downloads/bathing-water-quality/bw-qual-assessments-2023.csv`
- **Problema**: 
  - La URL del CSV retorna redirecciones HTML en lugar del CSV
  - La EEA ha reestructurado su API de datos (Discodata)
  - El endpoint correcto no ha sido identificado aún
- **Solución requerida**: 
  - Investigar nueva API Discodata de la EEA
  - O buscar fuente alternativa (MITECO, Generalitat Valenciana)

#### 6. **Guía de Playas (MITECO / datos.gob.es)**
- **Estado**: **NO DISPONIBLE**
- **URL**: `https://datos.gob.es/apidata/catalog/dataset/ea0018816-censo-de-playas`
- **Problema**:
  - El dataset CKAN retorna `items: []` vacío
  - La API de distribuciones no reconoce el parámetro `dataset=`
  - MITECO no publica descarga directa del Censo de Playas
- **Solución requerida**:
  - Contactar con datos.gob.es o MITECO para nueva URL
  - O encontrar descarga alternativa

#### 7. **Censo de Aguas de Baño (MITECO Shapefile)**
- **Estado**: **NO DISPONIBLE**
- **URL**: `https://www.miteco.gob.es/content/dam/miteco/es/cartografia-y-sig/ide/descargas/01-agua/censo_zonas_bano.zip`
- **Problema**:
  - HTTP 302 → 404
  - El archivo ZIP ha sido movido o eliminado del servidor IDE
- **Solución requerida**:
  - Buscar nueva ubicación del archivo en miteco.gob.es
  - O usar fuente alternativa (servicios WMS/WFS de MITECO)

#### 8. **Bandera Azul 2026 (ADEAC PDF)**
- **Estado**: **PARCIALMENTE DISPONIBLE**
- **URL**: `https://www.banderaazul.org/sites/default/files/2026/Rueda-de-prensa-2026/Relación%20Playas%20Galardonadas%202026.pdf`
- **Problema**:
  - El PDF oficial existe y se descarga correctamente
  - El parser `pdf-parse` tiene problemas de compatibilidad con ESM
  - Error: "Class constructors cannot be invoked without 'new'"
- **Solución requerida**:
  - Usar herramienta CLI externa (`pdftotext` de poppler-utils)
  - O parsear manualmente el PDF una vez y cachear resultados
  - O extraer texto con otra librería compatible ESM

## Resumen

| Fuente | Estado | Datos Obtenibles |
|--------|--------|------------------|
| Coordenadas (OSM) | ✅ Operativo | Lat/lon |
| Servicios OSM | ✅ Operativo | Parkings, baños, transporte |
| Clima/Agua (Open-Meteo) | ✅ Operativo | Temperatura del mar |
| Playas Cercanas | ✅ Operativo | Distancias |
| Calidad Agua (EEA) | ❌ No disponible | - |
| Guía Playas (MITECO) | ❌ No disponible | - |
| Censo Baño (MITECO) | ❌ No disponible | - |
| Bandera Azul (ADEAC) | ⚠️ PDF existe, parser falla | - |

**Fuentes operativas**: 4 de 8 (50%)  
**Completitud estimada de fichas**: ~40-50% con fuentes actuales

## Próximos Pasos

1. **Corto plazo**: Ejecutar `npm run pilot` con las 4 fuentes operativas y generar fichas parciales honestas
2. **Medio plazo**: Investigar APIs actualizadas de EEA, MITECO y datos.gob.es
3. **Bandera Azul**: Implementar extracción con `pdftotext` CLI o parser alternativo
4. **Validación**: Comparar resultados con datos publicados en webs municipales

## Contacto Fuentes

- **EEA**: https://www.eea.europa.eu/en/contact-us
- **MITECO**: ide@miteco.es
- **datos.gob.es**: soporte@datos.gob.es  
- **ADEAC (Bandera Azul)**: adeac@adeac.es
