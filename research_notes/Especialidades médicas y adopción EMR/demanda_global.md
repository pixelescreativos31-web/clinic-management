# Demanda global de especialidades médicas (2023–2026)

> Notas de investigación para priorizar qué plantillas de especialidad construir primero en un EMR/EHR SaaS.
> Enfoque: especialidades ambulatorias / de consultorio relevantes para clínicas pequeñas y práctica privada.
>
> **Caveat transversal e importante:** no existe un ranking mundial único y auditado de médicos por especialidad. La WHO/OECD publican densidad de *médicos* y *dentistas* pero no un desglose global por especialidad. Los conteos por especialidad más granulares disponibles son de **EE. UU.** (AAMC, Definitive Healthcare, ADA). Las cifras de "mercado" (tamaño, CAGR) provienen de firmas de market-research (IMARC, Grand View, DelveInsight, etc.) que **definen los mercados de forma distinta**, por lo que varían ampliamente y no son comparables entre sí. Se señala el origen y el año en cada dato.

---

## Pregunta 1: ¿Qué especialidades tienen el mayor número de practicantes y el mayor volumen de visitas ambulatorias en el mundo?

### Takeaway
No hay datos mundiales por especialidad; el mejor proxy granular es EE. UU. En conteo de *proveedores*, dominan atención primaria (medicina familiar, medicina interna, pediatría) más una enorme base de proveedores no-médicos ambulatorios (asistentes médicos, fisioterapeutas, trabajadores sociales clínicos, psicólogos, optometristas, quiroprácticos). En *volumen de visitas ambulatorias*, la atención primaria concentra ~50–55% de las visitas de consultorio en EE. UU.

### Cited Findings
- **Ranking de proveedores EE. UU. (Definitive Healthcare PhysicianView, datos 2025):** 1) Asistente médico (196.201), 2) Fisioterapeuta (169.320), 3) Trabajador social clínico (154.480), 4) Medicina familiar (131.150), 5) Medicina interna (129.849), 6) Psicólogo clínico (115.337), 7) Pediatría (70.822), 8) Quiropráctica (67.156), 9) Medicina de emergencia (65.270), 10) Optometría (56.487), 11) Anestesiología (52.348), 12) Psiquiatría (51.431), 13) Terapia ocupacional (46.170), 14) Obstetricia/Ginecología (45.997), 15) Radiología diagnóstica (38.771), 16) Fonoaudiología (37.991), 17) Hospitalista (34.762), 18) Cirugía general (30.845), 19) Cirugía ortopédica (27.446), 20) Cardiología (24.811), 21) Neurología (23.998), 22) Oftalmología (21.196), 23) Podología (19.757), 24) Nutrición/dietética (19.617), 25) Gastroenterología (17.754) — [Definitive Healthcare](https://www.definitivehc.com/resources/healthcare-insights/top-medical-specialties-number-healthcare-providers)
- **Conteo de médicos activos EE. UU. (AAMC, datos 2021):** las mayores especialidades son medicina interna (120.342), medicina familiar/general (118.641) y pediatría (60.305) — [AAMC](https://www.aamc.org/data-reports/workforce/data/active-physicians-largest-specialties-2019)
- **Volumen de visitas ambulatorias EE. UU. (NAMCS 2016):** atención primaria 54,5% de las visitas de consultorio, especialidades médicas 26,5%, especialidades quirúrgicas 18,9%; patrón similar en 2018 — [CDC NCHS NAMCS](https://www.cdc.gov/nchs/data/ahcd/namcs_summary/2016_namcs_web_tables.pdf)
- **Histórico EE. UU. (NCHS 2005):** los médicos de atención primaria en consultorio recibían ~49% de todas las visitas de atención ambulatoria — [CDC NCHS](https://stacks.cdc.gov/view/cdc/123251/cdc_123251_DS1.pdf)
- **Volumen ambulatorio total (Vizient, 2025, EE. UU.):** se esperaban más de 4.500 millones de encuentros en el entorno ambulatorio en 2024 — [Vizient](https://vizientinc.com/insights/all/2025/courting-a-more-effective-ambulatory-strategy-access-metrics-are-king)
- **Médicos por densidad (WHO GHO):** la categoría "médicos" de la WHO agrupa generalistas + especialistas + no-clasificados; no los separa por especialidad en los datos públicos — [WHO GHO](https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/health-workforce)
- **Proporción generalistas (OECD Health at a Glance 2025, datos 2023):** los médicos generales/de familia son ~21% de todos los médicos en promedio OECD; rango de >⅓ (Canadá, Finlandia, Bélgica) a 6% (Grecia, Corea) — [OECD](https://www.oecd.org/en/publications/health-at-a-glance-2025_8f9e3f98-en/full-report/doctors-by-age-gender-and-category_a854aaab.html)
- **Dentistas (mundo):** estimación de ≥1,6 millones de dentistas globalmente (estudio con datos FDI/WHO, cifras algo antiguas); China tiene el mayor número (~637.000 según blog RCSEd 2025); EE. UU. 205.088 dentistas activos en 2025 (60,0 por 100.000 hab., ADA) — [PMC/FDI](https://pmc.ncbi.nlm.nih.gov/articles/PMC9378901); [RCSEd](https://www.rcsed.ac.uk/news-resources/rcsed-blog/2025/may/dental-dean-update-how-many-dentists-does-the-world-need); [ADA](https://ada.org/dentistworkforce)

### Inferences
- Para un EMR SaaS de clínicas pequeñas, las especialidades con mayor "masa instalada" de profesionales que trabajan **fuera del hospital** son: atención primaria (familiar/interna/pediatría), salud mental (psicología + psiquiatría), rehabilitación (fisioterapia + terapia ocupacional + fonoaudiología), optometría/oftalmología, quiropráctica, odontología, OB/GYN, podología y nutrición. Esto coincide con el top del ranking de *proveedores* (no solo médicos MD).
- El volumen de visitas se concentra en atención primaria, lo que sugiere que una plantilla genérica de consulta + plantillas de primaria cubren la mayor parte del volumen ambulatorio.

### Gaps
- No se encontró un ranking mundial por especialidad con conteos de practicantes (solo EE. UU.). Un desglose WHO/OECD por especialidad no está disponible públicamente de forma consistente.
- No hay cifra global de volumen de visitas ambulatorias por especialidad fuera de EE. UU.
- La cifra global de dentistas es antigua e internamente inconsistente entre fuentes.

---

## Pregunta 2: ¿Qué especialidades ambulatorias crecen más rápido en demanda?

### Takeaway
Las fuentes miden cosas distintas (crecimiento de volumen, demanda por incentivos de reclutamiento, empleo proyectado), por lo que difieren. De forma consistente aparecen como alta demanda: **cardiología, neurología/neurociencias, gastroenterología, psiquiatría/salud mental, dermatología y endocrinología**. La atención primaria lidera el reclutamiento por puro volumen.

### Cited Findings
- **Crecimiento de volumen ambulatorio a 10 años (Kaufman Hall / Sg2, EE. UU.):** cardiovascular +25%, neurociencias +23%, centros de cirugía ambulatoria (ASC) +14%; las visitas E&M ambulatorias crecerían ~15,4% en la década (Vizient) — [Kaufman Hall](https://www.kaufmanhall.com/insights/infographic/outpatient-shift-turning-new-specialties); [Vizient](https://vizientinc.com/insights/all/2025/courting-a-more-effective-ambulatory-strategy-access-metrics-are-king)
- **Demanda por incentivos de reclutamiento (AMN vía AMA, 2025):** top de demanda absoluta = hematología/oncología, gastroenterología, endocrinología, cardiología, seguidas de radiología, urología, reumatología, anestesiología y neurología — [AMA](https://www.ama-assn.org/medical-students/preparing-residency/your-dream-specialty-among-10-most-demand)
- **Reclutamiento por avisos (Doximity 2026):** lidera atención primaria; 3 de las 4 especialidades más reclutadas son medicina interna, medicina familiar y pediatría; psiquiatría 3.ª — [Becker's ASC](https://www.beckersasc.com/asc-news/the-most-in-demand-physician-specialties/)
- **Empleo proyectado EE. UU. (BLS, hasta 2033, datos mayo 2024):** mayor crecimiento proyectado en psiquiatría (8%), neurología (7%) y dermatología (7%) — [BLS](https://www.bls.gov/ooh/fastest-growing.htm)
- **Cardiología ambulatoria:** descrita como una de las especialidades de más rápido crecimiento entre los ASC y foco de inversión hospitalaria/ASC — [Becker's ASC](https://www.beckersasc.com/cardiology/eyeing-the-future-hospitals-ascs-invest-in-outpatient-cardiology/)
- **Salud mental (WHO Mental Health Atlas 2024, publicado sep-2025):** >1.000 millones de personas viven con trastornos de salud mental; es la 2.ª causa de discapacidad de largo plazo a nivel global; mediana global de ~13 trabajadores de salud mental por 100.000 hab. — [WHO](https://www.who.int/news/item/02-09-2025-over-a-billion-people-living-with-mental-health-conditions-services-require-urgent-scale-up)

### Inferences
- Para un EMR ambulatorio, las plantillas de mayor "momentum" de demanda son cardiología, dermatología, psiquiatría/salud mental, gastroenterología y endocrinología — todas con fuerte componente de consulta/seguimiento crónico y muchas viables en consultorio privado.
- La demanda de salud mental es global (no solo EE. UU.) y estructuralmente desatendida, lo que la hace atractiva como plantilla temprana.

### Gaps
- Casi todos los datos de "crecimiento" y "empleo proyectado" son de EE. UU.; no hay serie global equivalente por especialidad.
- No se halló un ranking autoritativo único de especialidades ambulatorias por crecimiento 2025 a nivel mundial.

---

## Pregunta 3: ¿Qué especialidades son más relevantes para práctica privada, de consultorio, de pago directo (cash-pay) o clínica pequeña (vs. solo hospitalaria)?

### Takeaway
Las especialidades intrínsecamente ambulatorias/consultorio y con fuerte componente cash-pay o de clínica pequeña son: **odontología, dermatología (estética), oftalmología/optometría, fisioterapia/rehabilitación, psicología/psiquiatría, medicina estética, nutrición, quiropráctica, podología, ginecología** y atención primaria. Los mercados de estética y wellness son los de mayor tono cash-pay.

### Cited Findings
- **Estética médica (proxy más cercano a cash-pay):** mercado global de medical aesthetics US$17,16 mil millones en 2024 → US$35,32 mil millones para 2030 (CAGR 12,8%); otra estimación $22,2B (2024) → $37,9B (2029), CAGR 11,3% — [MarketsandMarkets](https://prnewswire.co.uk/news-releases/medical-aesthetics-market-to-hit-us-35-32-billion-by-2030-with-12-8-cagr--marketsandmarkets-302336922.html)
- **Dermocosmética (categoría de producto, no servicio):** US$69,8 mil millones en 2024 → US$110,1 mil millones para 2030, CAGR 7,9% — [GII/dermocosmetics](https://www.gii.co.jp/report/go1779927-dermocosmetics.html)
- **Fisioterapia — peso ambulatorio:** el segmento de clínicas ambulatorias fue el de mayor cuota de ingresos (41%) del mercado de physical therapy en 2024; el segmento presencial dominó con 72% en 2025 — [Towards Healthcare](https://www.towardshealthcare.com/insights/physical-therapy-market-sizing); [DelveInsight](https://www.delveinsight.com/report-store/physical-therapy-market)
- **Base de proveedores ambulatorios no-hospitalarios (EE. UU., Definitive 2025):** fisioterapeutas (169.320), trabajadores sociales clínicos (154.480), psicólogos clínicos (115.337), quiroprácticos (67.156), optometristas (56.487), terapeutas ocupacionales (46.170) — todos típicamente consultorio/clínica pequeña — [Definitive Healthcare](https://www.definitivehc.com/resources/healthcare-insights/top-medical-specialties-number-healthcare-providers)
- **Sistemas centrados en especialistas:** en Japón los médicos generales/de familia son muy poco comunes y la mayoría de las consultas son con especialistas (relevante para mercados asiáticos donde el paciente va directo al especialista en consultorio) — [OECD](https://www.oecd.org/en/publications/health-at-a-glance-2025_8f9e3f98-en/full-report/doctors-by-age-gender-and-category_a854aaab.html)

### Inferences
- Para un SaaS de clínicas pequeñas/pago directo, las plantillas con mejor ajuste son las de especialidades que operan fuera del hospital y con alto volumen de consultas repetidas: odontología, dermatología/estética, oftalmología+optometría, fisioterapia, psicología/psiquiatría, nutrición, ginecología, podología y medicina estética/wellness. Esto encaja con el contexto del proyecto (clínica de estética real "Fénix Stetic" y feedback de oftalmología en `docs/feedback-igaleno-y-oftalmologia.md`).
- Estética y dermocosmética crecen a doble dígito y son mayoritariamente cash-pay, lo que reduce la fricción de integración con seguros/facturación compleja — ventaja para un MVP.

### Gaps
- No existe una cifra que aísle específicamente "dermatología cash-pay en consultorio"; solo proxies de estética/dermocosmética.
- No hay datos globales de qué porcentaje de cada especialidad opera en consultorio privado vs. hospital, salvo observaciones cualitativas (OECD/Japón).

---

## Pregunta 4: Demanda impulsada por envejecimiento (oftalmología, cardiología, endocrinología, ortopedia)

### Takeaway
El envejecimiento poblacional y la enfermedad crónica son el motor de demanda más consistente en todas las fuentes para oftalmología, cardiología, endocrinología/diabetes y ortopedia. La población 60+ superaría los 2.000 millones hacia 2050; en EE. UU. la población 65+ crecería 34,1% entre 2021 y 2036 frente a 8,4% de la población total.

### Cited Findings
- **Demografía (EE. UU., AAMC 2024):** la población total crecería 8,4% (2021–2036) pero la de 65+ crecería 34,1%; es el principal driver del déficit de médicos proyectado — [AAMC](https://www.aamc.org/news/press-releases/new-aamc-report-shows-continuing-projected-physician-shortage)
- **Déficit de médicos EE. UU. (AAMC, mar-2024):** déficit total proyectado de 13.500 a 86.000 médicos para 2036; atención primaria −20.200 a −40.400; quirúrgicas −10.100 a −19.900; especialidades médicas de −5.500 a +3.700 (posible superávit en cuidados críticos/neumología y endocrinología); otras de −19.500 a +4.300 — [AAMC](https://www.aamc.org/media/75231/download)
- **Oftalmología (demografía + mercado de dispositivos):** población 60+ >2.000 millones hacia 2050 citada como driver; mercado de dispositivos oftálmicos ~USD 28,6B (2024, IMARC) a ~USD 60B (2024, DelveInsight) según definición, CAGR ~3,5–5%; drivers = envejecimiento, diabetes, miopía creciente — [DelveInsight](https://www.delveinsight.com/blog/smart-ophthalmology-devices-eye-care); [IMARC](https://www.imarcgroup.com/ophthalmic-devices-market)
- **Cardiología:** mayor cuota por área de enfermedad del mercado de servicios de salud en 2025; segmento MedTech líder impulsado por aumento age-related de cardiopatía, ictus e hipertensión — [Cervicorn](https://www.cervicornconsulting.com/healthcare-services-market)
- **Endocrinología/diabetes:** la diabetes afecta a >500 millones de personas (2023), impulsando monitoreo y cuidado crónico; endocrinología aparece como especialidad de alta demanda de reclutamiento (AMN 2025). No se halló un market-size aislado de endocrinología — [AMA](https://www.ama-assn.org/medical-students/preparing-residency/your-dream-specialty-among-10-most-demand)
- **Ortopedia:** dispositivos ortopédicos ~26,3% de los ingresos de dispositivos médicos en 2025 (mayor cuota por tipo); demanda ligada a artritis, fracturas y osteoporosis en adultos mayores — [Benchmark Intl](https://www.benchmarkintl.com/insights/healthcare-devices-and-supplies-industry-report/)
- **Mercado de specialty care (Fortune Business Insights, reproducido):** $5,25 billones (trillion) en 2025 → $8,67 billones para 2034, atribuido a enfermedad crónica, envejecimiento y tecnología — [Fortune Business Insights](https://www.fortunebusinessinsights.com/specialty-care-market-119258)

### Inferences
- Las cuatro especialidades envejecimiento-dependientes (oftalmología, cardiología, endocrinología, ortopedia) tienen demanda estructural creciente y alto volumen de seguimiento crónico — buen ajuste para plantillas de EMR que gestionen controles recurrentes, mediciones seriadas y adherencia.
- Oftalmología y endocrinología/diabetes combinan envejecimiento + alto volumen ambulatorio + viabilidad en consultorio privado, lo que las hace candidatas fuertes para plantillas tempranas (consistente con el feedback de oftalmología ya en el proyecto).

### Gaps
- No hay market-size global específico de endocrinología como servicio (solo diabetes/dispositivos).
- Las proyecciones de déficit por especialidad son solo de EE. UU.; no hay equivalente global por especialidad.
- Las cifras de mercado son de vendors (press releases) con metodologías no auditadas y bases 2024 muy dispares; usar como direccionales, no exactas.

---

## Síntesis para priorización de plantillas EMR (inferencia del investigador)

Combinando masa instalada de proveedores ambulatorios + crecimiento de demanda + ajuste a clínica pequeña/cash-pay + envejecimiento, el orden sugerido de plantillas (todas defendibles con las fuentes anteriores) sería aproximadamente:

1. **Atención primaria / medicina general** (mayor volumen de visitas y de médicos; plantilla base reutilizable).
2. **Odontología** (enorme base global de proveedores, mayormente consultorio privado y cash-pay).
3. **Dermatología + estética/medicina estética** (crecimiento doble dígito, cash-pay, ya hay clínica real en el proyecto — Fénix Stetic).
4. **Oftalmología + optometría** (envejecimiento, alto volumen, consultorio; ya hay feedback de oftalmología en el repo).
5. **Fisioterapia / rehabilitación** (2.ª mayor base de proveedores en EE. UU.; 41% del mercado es ambulatorio).
6. **Psicología / psiquiatría / salud mental** (demanda global desatendida, >1.000M afectados, cash-pay frecuente).
7. **Cardiología** y **endocrinología/diabetes** (envejecimiento, crónicos, alta demanda de reclutamiento).
8. **Ginecología**, **nutrición**, **podología**, **quiropráctica** (consultorio, base amplia de proveedores).

Este orden es una inferencia de priorización, no un dato citado; las cifras que lo respaldan están en las secciones anteriores.
