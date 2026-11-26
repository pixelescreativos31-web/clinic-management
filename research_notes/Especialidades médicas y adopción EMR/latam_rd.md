# Especialidades médicas y tipos de clínica en América Latina y República Dominicana (2023–2026): priorización de plantillas para un EMR/EHR SaaS

_Scope note: enfoque primario en República Dominicana (RD), con contexto regional de América Latina. Datos 2023–2026. Varias cifras provienen de gremios (ADARS, ANDECLIP, ADTS) o notas de prensa, no de estadísticas independientes; se señala la fuente en cada caso. Fecha de compilación: 2026-11-25._

## 1. Especialidades y tipos de clínica más comunes en la práctica privada ambulatoria (RD y LatAm)

### Takeaway
En RD, el volumen ambulatorio está dominado por **medicina general, ginecología/obstetricia y pediatría**, seguidas por especialidades de alta frecuencia de receta (cardiología, traumatología). A nivel LatAm, la consulta privada ambulatoria se concentra en los mismos campos de atención primaria y de la mujer/niño, más odontología, dermatología/estética y oftalmología como verticales de consultorio privado. No existe un ranking nacional único de práctica privada por especialidad en RD; las mejores proxies son las consultas de la Red Pública y los datos de prescripción.

### Cited Findings
- **Consultas externas Red Pública RD 2024 (proxy de demanda):** obstetricia 428,260; medicina general 423,252; pediatría 380,078; ginecología 330,331. En 2024 las mujeres accedieron a 4,738,214 consultas externas en hospitales públicos — [Presidencia RD, vía WebSearch](https://presidencia.gob.do/noticias/red-publica-ofrece-abordaje-integral-de-salud-la-mujer-registra-mas-de-cuatro-millones-de) (página devolvió 403 al fetch; cifras tomadas del snippet de búsqueda)
- **Prescripción por especialidad (informe IQVIA, 2026):** médicos generales ~13% de las recetas; luego ginecólogos (~13%) y pediatras (~11%). El artículo tenía errores de formato en la parte de cardiología/traumatología — [El Día, "¿Quiénes recetan más medicamentos en RD?"](https://eldia.com.do/quienes-recetan-mas-medicamentos-en-republica-dominicana-un-informe-tiene-la-respuesta/)
- **Servicios más demandados en un hospital privado de referencia (HOMS, Santiago):** odontología, cirugía estética y cirugía robótica figuran entre los más solicitados — [El Caribe, "HOMS crece demanda..."](https://www.elcaribe.com.do/panorama/region-norte/homs-crece-demanda-cobertura-servicios-de-turismo-de-salud/)
- **LatAm — intenciones de especialidad (estudio 11 países, estudiantes de medicina):** mujeres eligen Pediatría (15.8%), Gineco-obstetricia (11.0%), Cardiología (8.7%), Cirugía general (8.6%), Oncología (6.4%). Son intenciones de carrera, no práctica real — [PMC/NCBI](https://pmc.ncbi.nlm.nih.gov/articles/PMC7171868/table/Tab2)
- **México — distribución de consultorios por especialidad:** la odontología representa ~12.75% de los consultorios del país — [Statista](https://statista.com/statistics/1328541/distribution-medical-offices-mexico-by-specialization)
- **México — foco de clínicas privadas:** se concentran en campos específicos como oftalmología, dermatología y odontología — [Statista Outpatient Care Mexico](https://statista.com/outlook/hmo/hospitals/outpatient-care/mexico)
- **Brasil/LatAm — clínicas walk-in privadas:** las esperas públicas en São Paulo y Rio empujan a la población trabajadora hacia clínicas privadas de acceso rápido — [Data Cube Research](https://www.datacuberesearch.com/latin-america-outpatient-care-market)

### Inferences
- Para un EMR SaaS dominicano, las plantillas de **primer nivel a priorizar** son: medicina general/familiar, ginecología-obstetricia y pediatría (mayor volumen de consulta). Luego odontología, dermatología/estética y oftalmología como verticales privados de alto crecimiento y alto pago de bolsillo.
- La convergencia RD-LatAm es fuerte: los mismos 3–4 campos (primaria, mujer/niño, odontología, estética/derma, oftalmología) dominan el consultorio privado en toda la región, lo que permite plantillas reutilizables con localización.

### Gaps
- No hay censo nacional RD de médicos en práctica privada desglosado por especialidad; las cifras de Red Pública son del sector público y pueden no reflejar la distribución privada.
- La parte de cardiología/traumatología del informe IQVIA no pudo verificarse por errores de formato en la fuente secundaria.

## 2. Estructura del sistema privado de salud dominicano (ARS, e-CF/DGII, SNS, clínicas vs. hospitales)

### Takeaway
RD tiene cobertura de seguro casi universal (98.1%) vía el Seguro Familiar de Salud (SFS), operado por ARS; las clínicas privadas obtienen 80–90% de sus ingresos de contratos con ARS más copagos de bolsillo. La facturación electrónica (e-CF) ante la DGII es obligatoria por Ley 32-23 y se está desplegando por segmentos de contribuyente hasta finales de 2026, lo que crea un requisito funcional directo para un EMR con módulo de facturación.

### Cited Findings
- **Cobertura SFS (cierre 1T 2024):** 98.1% de la población; 10,508,357 afiliados sobre población estimada de 10,711,155 — [elDinero, 8 may 2024](https://eldinero.com.do/277687/el-98-1-de-la-poblacion-dominicana-tiene-seguro-medico/)
- **Desglose por régimen (2024):** Subsidiado (financiado por el Estado) 55.1% = 5,797,171 personas; Contributivo 43.9% = 4,711,180 personas (2,159,730 cotizantes, 2,294,556 dependientes directos, 256,894 indirectos) — [elDinero](https://eldinero.com.do/277687/el-98-1-de-la-poblacion-dominicana-tiene-seguro-medico/)
- **Per cápita mensual (2024):** Contributivo RD$1,683.22; Subsidiado RD$259.43 por afiliado — [elDinero](https://eldinero.com.do/277687/el-98-1-de-la-poblacion-dominicana-tiene-seguro-medico/)
- **Número de ARS:** el régimen contributivo opera con 17 ARS (2 estatales, 3 de autogestión, 12 privadas); 7 privadas afiliadas a ADARS — [elDinero](https://eldinero.com.do/277687/el-98-1-de-la-poblacion-dominicana-tiene-seguro-medico/); ADARS reportó >2.4 millones de afiliados en 7 ARS privadas (sep 2024) — [Diario Libre](https://diariolibre.com/actualidad/salud/2024/09/04/adars-conmemora-su-23-aniversario-con-24-millones-de-afiliados/2839726)
- **Concentración de mercado ARS (nov 2024):** ARS SeNaSa, ARS Primera y ARS Mapfre Salud concentran >70% del mercado — [El Nuevo Diario, estudio ProCompetencia](https://elnuevodiario.com.do/tres-ars-concentran-el-70-del-mercado-en-el-pais-revela-estudio-de-procompetencia/)
- **Gasto oncológico ARS 2024:** RD$12 mil millones; >180,000 afiliados SFS atendidos por cáncer — [Diario Libre/Sisalril](https://www.diariolibre.com/actualidad/salud/2025/02/06/ars-reportaron-rd-12-mil-millones-en-pacientes-con-cancer/2991723)
- **Clínicas privadas — peso y dependencia de ARS:** ANDECLIP agrupa 138 clínicas; su presidente afirma que las clínicas privadas brindan ~50% de los servicios médicos a la población — [El Día](https://eldia.com.do/afp-han-sido-las-beneficiadas-de-la-seguridad-social-afirma-andeclip/). El sector privado atiende a ~4.5 millones de dominicanos — [Acento](https://acento.com.do/economia/el-negocio-de-las-clinicas-9073181.html)
- **Fuente de ingresos de las clínicas:** 80–90% de los ingresos provienen de contratos privados con ARS (tarifas "privadas y confidenciales"); la mayor parte se concentra en hospitalización; pacientes pagan copagos "cuantiosos" definidos por clínicas, médicos y laboratorios — [Acento, "Así funciona el negocio de las clínicas"](https://acento.com.do/economia/asi-funciona-el-negocio-de-las-clinicas-9078000.html)
- **Gasto de bolsillo:** ~23.6% del gasto total en salud (OPS 2024, citado en opinión); un gerente de ARS lo sitúa en 26–27% — [Acento](https://acento.com.do/opinion/porcentaje-del-pib-invertido-salud-nivel-impacto-8654312.html); [Acento/ARS Primera](https://acento.com.do/salud/gerente-general-de-ars-primera-gasto-de-bolsillo-en-salud-es-26-del-gasto-general-9196267.html). Los hogares gastan más en salud que lo que invierte el Estado — [Diario Libre](https://www.diariolibre.com/economia/los-hogares-gastan-mas-en-salud-que-lo-que-el-estado-invierte-en-el-sector-GA14728835)
- **Gasto público en salud:** ~3.29% del PIB (OPS 2024, vía opinión); baja a ~1.8% con metodología de gasto funcional — [Acento](https://acento.com.do/opinion/porcentaje-del-pib-invertido-salud-nivel-impacto-8654312.html); [Diario Libre](https://www.diariolibre.com/economia/los-hogares-gastan-mas-en-salud-que-lo-que-el-estado-invierte-en-el-sector-GA14728835)
- **Facturación electrónica (e-CF) obligatoria — Ley 32-23:** el uso de la Factura Electrónica es obligatorio en todo el territorio; grandes y medianos contribuyentes deben emitir e-CF de forma exclusiva desde el 1 nov 2026; prórroga para pequeños/micro/no clasificados hasta 15 nov 2026 — [DGII](https://dgii.gov.do/noticias/Paginas/DGII-informa-emision-exclusiva-de-facturas-electronicas-para-Grandes-Locales-y-Medianos-contribuyentes-desde-noviembre.aspx); [KPMG](https://kpmg.com/do/es/tendencias/flashes-fiscales/dgii-informa-sobre-la-emision-exclusiva-de-comprobantes-fiscales-electronicos-para-grandes-contribuyentes-locales-y-medianos.html)
- **Volumen e-CF:** la DGII ha recibido >2,000 millones de Comprobantes Fiscales Electrónicos — [DGII](https://dgii.gov.do/noticias/Paginas/DGII-logra-recepcion-mas-2000-millones-Comprobantes-Fiscales-Electronicos.aspx)
- **Servicios de salud exentos de ITBIS** (impuesto al valor agregado) — [Acento](https://acento.com.do/economia/asi-funciona-el-negocio-de-las-clinicas-9078000.html)

### Inferences
- Un EMR SaaS competitivo en RD casi obligatoriamente necesita **módulo de e-CF integrado con DGII** (o integración con un facturador autorizado), dado el mandato legal 32-23 y el calendario que ya alcanza a profesionales liberales/consultorios.
- El flujo de ingresos de las clínicas está dominado por ARS: el EMR debería soportar **autorizaciones, codificación de servicios, conciliación y reclamos a ARS**, no solo facturación de bolsillo. La concentración en 3 ARS (SeNaSa, Primera, Mapfre) permite priorizar integraciones/plantillas de reclamo.
- El alto gasto de bolsillo (~24–27%) implica que los consultorios de especialidades privadas (estética, odontología, oftalmología) operan con pago directo, lo que favorece módulos de cobro/recibo y paquetes, no solo adjudicación por seguro.

### Gaps
- No se confirmó el segmento/fecha exacta de e-CF específicamente para "consultorios médicos" (clasificados como profesional liberal); la DGII usa el término "profesional liberal" pero las fuentes no precisan su plazo.
- No se encontró censo oficial del total de clínicas privadas ni desglose por tamaño/camas/especialidad; ANDECLIP (138) agrupa solo a sus miembros.
- Cifras de gasto (% PIB, bolsillo) provienen de columnas de opinión citando OPS 2024, no del informe primario OPS ni de cuentas nacionales del Banco Central/MSP.

## 3. Especialidades y clínicas en auge (estética, odontología, oftalmología, wellness)

### Takeaway
El **turismo de salud** es el motor de crecimiento más documentado en RD, generando >US$1,300 millones anuales, con **odontología (implantes) y cirugía estética** como los servicios punta; RD es líder del Caribe en turismo médico. A nivel LatAm, la estética médica crece a ~10% CAGR. Esto hace de estética/spa médico, odontología y oftalmología verticales prioritarios de alto valor.

### Cited Findings
- **Ingresos turismo de salud RD:** >US$1,300 millones en 2025 (ministro de Salud Víctor Atallah) — [elDinero](https://eldinero.com.do/329125/turismo-de-salud-genera-mas-de-us1300-millones-anuales-en-republica-dominicana/); cifra similar atribuida a 2022–2023 por ADTS — [El Día](https://eldia.com.do/turismo-de-salud-genera-mas-de-us1300-millones-al-ano-e-impulsa-inversion-tecnologica/)
- **Base 2022 (ADTS):** 338,747 viajes por salud generaron US$1,321 millones — [El Día](https://eldia.com.do/turismo-de-salud-genera-mas-de-us1300-millones-al-ano-e-impulsa-inversion-tecnologica/)
- **Pacientes dentales internacionales (2022):** >179,000 pacientes; gasto promedio del turista dental >US$5,000; ahorros de hasta 60% frente a EE.UU./Canadá — [elDinero](https://eldinero.com.do/329619/republica-dominicana-lidera-el-turismo-odontologico-en-el-caribe/)
- **Ranking turismo médico (Medical Tourism Index):** RD #1 del Caribe, #2 de América Latina, #19 del mundo — [elDinero](https://eldinero.com.do/329619/republica-dominicana-lidera-el-turismo-odontologico-en-el-caribe/)
- **Proyección 2028:** RD podría recibir 500,000 turistas de salud/año para 2028 (estimación ADTS, sujeta a sinergia público-privada) — [El Día](https://eldia.com.do/turismo-de-salud-genera-mas-de-us1300-millones-al-ano-e-impulsa-inversion-tecnologica/)
- **Gasto relativo:** el turista de salud gasta de 6 a 8 veces más que el turista tradicional — [Diario Libre](https://diariolibre.com/economia/turismo/2024/02/13/turismo-de-salud-pacientes-extranjeros-gastan-hasta-us9000/2612664)
- **Servicios dentales = más demandados** en turismo de salud, especialmente implantes dentales, junto con servicios de estética — [WebSearch snippet, Segundo Estudio Turismo de Salud y Bienestar](https://newsinamerica.com/pdcc/boletin/2025/republica-dominicana-lidera-el-turismo-odontologico-en-el-caribe/)
- **Acreditación pendiente:** actualmente ninguna clínica dental tiene acreditación internacional; el Colegio de Odontólogos urge habilitación/acreditación obligatoria de centros — [elDinero](https://eldinero.com.do/329619/republica-dominicana-lidera-el-turismo-odontologico-en-el-caribe/); [El Día](https://eldia.com.do/colegio-de-odontologos-urge-a-acreditarse-para-impulsar-el-turismo-medico-en-el-pais/)
- **LatAm — estética médica:** ~US$786.5 millones en 2025 → ~US$1,404.8 millones en 2031 (CAGR 9.6%); Brasil domina — [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/geography/medical-aesthetics-market/Latin-America)
- **LatAm — dispositivos de estética médica:** US$2.11 mil millones en 2023 → US$7.32 mil millones en 2035 (CAGR 10.9%); adopción en spas médicos, clínicas de dermatología y centros de belleza — [Allied Market Research](https://alliedmarketresearch.com/press-release/latin-america-medical-aesthetic-devices-market.html)
- **LatAm — atención ambulatoria total:** ~US$224.03 mil millones al cierre de 2025, +7.3% interanual — [Data Cube Research](https://www.datacuberesearch.com/latin-america-outpatient-care-market); Sudamérica US$30.93 mil millones (2024), Brasil US$17.68 mil millones (2024) — [Statista](https://statista.com/outlook/hmo/hospitals/outpatient-care/south-america)
- **Cirugía robótica** emergiendo como servicio de alta demanda en hospitales de referencia (HOMS) — [El Caribe](https://www.elcaribe.com.do/panorama/region-norte/homs-crece-demanda-cobertura-servicios-de-turismo-de-salud/)

### Inferences
- **Odontología, cirugía estética/plástica, dermatología y oftalmología** son verticales de pago-privado de rápido crecimiento: plantillas EMR específicas (odontograma, fichas estéticas con fotos antes/después, consentimientos, oftalmología con refracción) tienen alta disposición a pagar.
- El turismo de salud implica pacientes extranjeros y paquetes: el EMR podría diferenciarse con soporte multi-idioma, cotizaciones/paquetes, y documentación para acreditación internacional (que hoy es un hueco del mercado).

### Gaps
- La cifra de US$1,300 millones se atribuye a distintos años (2022, 2023, 2025) según la fuente; conviene fijar el año antes de citar.
- Proyección de 500,000 (2028) es estimación gremial (ADTS), no dato oficial del Ministerio de Turismo.
- No se halló cifra 2024 específica de ingresos de clínicas de dermatología/oftalmología en RD ni número de consultorios por estas especialidades.

## 4. Regulación del expediente clínico electrónico en RD (expediente único / historia clínica electrónica)

### Takeaway
RD **no tiene todavía una norma específica vigente y consolidada** sobre el expediente clínico electrónico privado; el marco está en construcción. Existe (a) un proyecto de ley de Historia Clínica Electrónica, (b) un proyecto SNS–Indotel para interconectar la Red Pública con un expediente único, y (c) la Ley 172-13 de Protección de Datos como marco de base (sin disposiciones de salud específicas). Esto es relevante: un EMR debe diseñarse para cumplir protección de datos e interoperabilidad futura, pero hoy no enfrenta un estándar técnico obligatorio de ECE en el sector privado.

### Cited Findings
- **Proyecto de ley:** un senador propuso crear la Historia Clínica Electrónica y un Registro Nacional de Historias Clínicas Electrónicas, apoyado en el art. 113 de la Constitución y la Ley 42-01 (Ley General de Salud); las fuentes no confirman aprobación — [Senado RD / memoria histórica](https://memoriahistorica.senadord.gob.do/bitstreams/73578172-06cf-47a9-b19e-53268e400db9/download)
- **Protección de datos (Ley 172-13):** es punto de partida pero no contiene disposiciones específicas sobre salud, consentimiento electrónico ni portabilidad de expedientes clínicos — [elDinero, jul 2025](https://eldinero.com.do/?p=329703)
- **Proyecto SNS–Indotel (2026):** busca integrar al 100% de la Red Pública (primer, segundo y tercer nivel; hospitales regionales y provinciales) en una plataforma centralizada de expediente clínico único; acceso mediante cédula + código + autorización del paciente para consultar historial, referencias, estudios y laboratorio en cualquier centro; objetivo "un solo programa en los centros de salud" sin documentación física — [DPL News, may 2026](https://dplnews.com/?p=317094)
- **Compromiso de gobierno abierto:** el Plan de Acción 2024–2028 (OGP) incluye el compromiso DO0069 sobre el expediente único de salud — [Open Government Partnership](https://www.opengovpartnership.org/es/members/dominican-republic/commitments/DO0069/)
- **Interoperabilidad estatal (base previa):** la norma NORTIC A4:2014 regula la interoperabilidad entre organismos del Gobierno (marco general, no específico de salud) — [DGII/NORTIC A4-2014](https://dgii.gov.do/transparencia/marcoLegal/Documents/Normativas/NORTIC-A4-2014.pdf)

### Inferences
- Para el sector privado (objetivo del SaaS), **no hay un estándar técnico de ECE obligatorio hoy**; la palanca regulatoria inmediata y dura es la **facturación e-CF/DGII** (sección 2), no el expediente.
- Conviene diseñar el EMR para: cumplimiento de Ley 172-13 (consentimiento, seguridad de datos), identificación por cédula, y futura interoperabilidad con la plataforma pública (expediente único) — posicionándolo como "listo para la norma que viene".
- El proyecto SNS–Indotel es público; si prospera un Registro Nacional, un EMR privado con capacidad de exportar/interoperar tendría ventaja.

### Gaps
- No se confirmó si el proyecto de ley de Historia Clínica Electrónica fue aprobado ni su estado legislativo actual.
- No hay cronograma, fases ni presupuesto públicos del proyecto SNS–Indotel.
- No se encontró reglamento del Ministerio de Salud Pública (MSP) que fije requisitos técnicos de expediente electrónico para clínicas/consultorios privados; verificar Gaceta Oficial y portal del MSP/SNS.
