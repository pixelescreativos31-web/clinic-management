# Feedback igaleno → mejoras EMR + soporte para oftalmología

> Documento de análisis y planificación. Fecha: 2026-11-25.
> Origen: notas de voz/WhatsApp sobre el sistema "igalenus" + pedido de evaluar si estamos listos para clínicas estéticas y generales, y preparar el EMR para **doctores oculares (oftalmología)**.

---

## 0. Respuesta directa a tu pregunta

**¿Ahora mismo estamos preparados para clínicas estéticas y generales?** → **Sí.**

El EMR modela la especialidad con un concepto llamado **perfil del consultorio** (`src/lib/profiles.ts`), y hoy existen tres perfiles:

| Perfil | Etiqueta en la app | Plantillas de consulta que habilita |
|---|---|---|
| `general` | Medicina general | general |
| `nutrition` | Nutrición | nutrition, general, program |
| `aesthetic` | **Estética y spa** | general, nutrition, program, **massage** |

Es decir: **general** y **estética** ya están cubiertas (y nutrición de regalo). Estética incluso trae el rol **terapeuta** (masajista/cosmetóloga) y la hoja de masaje.

**¿Y oftalmología?** → **No existe nada ocular en el sistema** (cero referencias a agudeza visual, refracción, PIO, OD/OS, fondo de ojo). **Pero** la arquitectura ya está diseñada para agregar especialidades nuevas, y el propio código lo documenta: *"una nueva especialidad (oftalmología, odontología…) es un nuevo módulo de formato como `nutrition.ts` / `massage.ts` más una entrada aquí"*. Añadir oftalmología es un patrón repetible, no una reescritura. Detalle en la §4.

---

## ⭐ Visión central: perfiles por especialidad, y que todo se adapte

> De tus notas de voz + tu mensaje: *"es necesario que tengamos perfiles por especialidad y que todo se adapte según el perfil y la especialidad."*

Esto es **exactamente lo que el EMR ya hace**, y es nuestro mayor diferenciador:

- Hoy el **perfil del consultorio** (general / nutrición / estética) define qué **plantillas de consulta** aparecen, y el formulario, el guardado y la vista imprimible se adaptan solos a ese perfil. Cambiar el perfil = otra experiencia clínica, sin tocar código.
- En las notas de voz, Carlos lo vende con esas mismas palabras: *"por el perfil que tú le creas al doctor y su especialidad, se va a adaptar a esas cosas."* Ya estamos del lado correcto.

**Posicionamiento (de los audios):** los sistemas grandes de hospitales —**SEDMA**, el **HOMS** ("el Home" en Santiago), **Plaza de la Salud** ("la plaza del sur")— corren plataformas pesadas tipo **SAP**. Nuestro nicho es el **doctor independiente / clínica pequeña** que quiere algo **personalizable por especialidad** sin esa complejidad. "Perfiles por especialidad" no es una función más: **es la tesis del producto.**

**Qué se adapta hoy por especialidad vs. qué debemos extender para cumplir "todo se adapta":**

| Área | ¿Se adapta hoy? | Para profundizar |
|---|---|---|
| Formulario de consulta / historia clínica | ✅ Sí (formatos por perfil) | **Agregar oftalmología** (y futuras especialidades) |
| Receta imprimible | Parcial (receta médica genérica) | **Receta óptica** para oftalmología; receta propia por especialidad |
| Antecedentes / intake del paciente | Genérico | Campos de antecedentes propios por especialidad (p. ej. oculares) |
| Agenda (motivos/tipos de cita, duración) | Genérico | Motivos y duraciones sugeridos por especialidad |
| Reportes / terminología del tablero | Genérico | Ajustes menores por especialidad |

El motor ya existe; **"que todo se adapte" = estirar esa misma lógica de perfil** hacia receta, antecedentes y agenda, empezando por sumar el perfil de **oftalmología**.

---

## 1. Qué es igaleno (investigación)

El producto se llama **igaleno** (igaleno.com), no "igalenus". Es un software médico en la nube (España) para gestión de clínicas, por módulos: recepción/agenda, consulta e historia clínica, portal del paciente y administración/facturación.

> En las notas de voz también lo llaman **"Lennox"**; según tú, **Lennox e igaleno son el mismo producto**, así que lo tratamos como una sola referencia. (Una búsqueda de "Lennox" como EMR dominicano no arroja un producto propio con ese nombre, lo que lo confirma.)

**Importante — lo que el sitio oficial realmente anuncia vs. lo que recordamos de la demo:**

| Función que anotamos | ¿Anunciada oficialmente por igaleno? |
|---|---|
| Recetas al **WhatsApp** del paciente | **No.** Los recordatorios que anuncian son por **SMS o email**. El único WhatsApp del sitio es el botón de contacto con su ventas. |
| Mensaje **5 días antes y el día antes** de la cita | **No especifican tiempos.** Solo "envío automático de SMS o emails de recordatorio". |
| El paciente **confirma en el mismo sistema** | **No explícito.** Dicen "libérate de las pesadas llamadas de confirmación" (los recordatorios sustituyen la llamada), pero no describen un flujo de confirmación del paciente. |
| Subir estudios | **Parcial.** El portal del paciente permite "descargar y subir documentos"; las plantillas permiten adjuntar "fotos, pruebas o tratamientos". No hablan de "estudios"/imágenes médicas como tal. |
| **IA** que hace los reportes de los estudios | **No aparece en ninguna parte.** Sus "informes" son solo "edita e imprime informes del historial médico". |
| Oftalmología | **No** está en su lista de especialidades. Sus plantillas son "personalizables para cualquier especialidad". |

**Conclusión de la investigación:** varias de las funciones que más nos gustaron (**recetas por WhatsApp, recordatorios programados a X días, confirmación del paciente, y sobre todo la IA que lee estudios y genera reportes**) **no son funciones estándar anunciadas por igaleno** — son, en parte, lo que vimos en demo o lo que *querríamos tener*. Buena noticia: eso no es copiar a un competidor, es **diferenciarnos**. Varias ya tienen cimientos en nuestro código.

*Fuentes: [igaleno – funcionalidades](https://www.igaleno.com/funcionalidades/), [igaleno – software gestión clínicas](https://www.igaleno.com/project/software-gestion-clinicas/).*

---

## 2. El feedback organizado en features (y qué tan lejos estamos)

Nuestra base técnica: **Next.js 16 + Payload CMS 3.85 (MongoDB)**, TypeScript. **No hay IA de ningún tipo** en el código, y los documentos (recetas, fichas, reportes) son **páginas HTML imprimibles** (no hay librería de PDF). El correo sale por **Resend**; hay un **cron** horario que ya manda el "resumen del día" al dueño del consultorio.

| # | Feature del feedback | Estado actual en nuestro EMR | Brecha | Esfuerzo |
|---|---|---|---|---|
| F1 | **Enviar la receta al WhatsApp del paciente** | La receta es un arreglo dentro de la Consulta (`Visits.prescription`) y hoy **solo se imprime** (`/print/prescription/[id]`). Ya existe un helper `src/lib/whatsapp.ts` que arma links `wa.me` con texto prellenado (hoy se usa para recordatorios manuales de cita). | Falta la ruta "enviar receta al paciente". Camino rápido: link `wa.me` con la receta en texto. Camino pro: PDF + WhatsApp Business API. | **Bajo** (versión link) / Medio (PDF+API) |
| F2 | **Recordatorios automáticos de cita (5 días antes + 1 día antes) con confirmación** | Hay agenda completa con estados (`scheduled, checked-in, completed, cancelled, no-show`), reserva pública y un **cron diario** que manda el agenda al dueño. WhatsApp hoy es **solo un link manual** que el asistente hace clic desde su teléfono. **No hay recordatorios programados por cita ni estado "confirmada".** | Falta: (a) programador que a X días/1 día dispare el recordatorio; (b) canal automático (email ya lo tenemos vía Resend; WhatsApp automático **requiere WhatsApp Business API**, p. ej. Twilio/Meta); (c) estado/flujo de **confirmación** del paciente (link que marca la cita como confirmada). | **Medio** (email) / Medio-alto (WhatsApp Business API) |
| F3 | **El paciente confirma la cita en el sistema** | Los estados existen pero no hay "confirmada" ni acción del paciente. | Agregar estado `confirmed` + link público tokenizado "Confirmar / Reagendar" (reusa la infraestructura de `/agendar/[slug]` y `BookingRequests`). | **Medio** |
| F4a | **Subir estudios** (archivos/imágenes del paciente) | El **único** sistema de subida es `ProgressPhotos` (fotos del programa de peso). Los "estudios indicados" (`labOrders`) son **texto libre**, no archivos. | Falta un sistema general de **documentos/estudios del paciente** (subir PDF/imágenes a una colección tipo `PatientDocuments`, con acceso por tenant). El patrón de `ProgressPhotos` sirve de base. | **Medio** |
| F4b | **IA que genera reportes de los estudios** | **No hay IA en ningún lugar del código.** Los "reportes" actuales (`src/lib/reports.ts`) son agregaciones determinísticas de la base (conteos mensuales). | Es la feature más nueva: integrar un modelo (visión + texto) que lea el estudio subido (F4a) y proponga un borrador de informe que el médico edita y firma. **Siempre con revisión del médico** (responsabilidad clínica). | **Alto** |

Las F1–F3 tienen cimientos reales en el código; F4 es terreno nuevo (subida de archivos + IA).

---

## 3. Nuestros planes (tiers) — cómo empaquetar esto

> Interpreto "mejorar nuestros planes" como **los planes de suscripción** (ya existe `src/lib/plans.ts` con topes y features bloqueadas por plan; "recordatorios por WhatsApp" ya figura como feature de plan superior). Si te referías al roadmap y no a los precios, dímelo y lo reenfoco.

Propuesta de empaquetado por valor (los nombres son tentativos):

- **Esencial** — agenda, historia clínica/consulta por especialidad, recetas imprimibles, reserva pública, resumen diario por email. *(≈ lo que ya tenemos.)*
- **Pro** — F1 (receta al WhatsApp), F2 recordatorios automáticos por email + F3 confirmación del paciente, F4a documentos/estudios del paciente. *(Lo que convierte "llevar el expediente" en "reducir ausencias y ahorrar trabajo".)*
- **Premium / IA** — F2 por **WhatsApp Business API** (mensajes de negocio), multi-sede, y **F4b: borrador de informe por IA sobre estudios**. *(La feature estrella, cobrable aparte por su costo de cómputo.)*
- **Por especialidad** — oftalmología (y futuras: odontología, etc.) como perfil activable; permite diferenciar precio/segmento (clínicas oculares).

Esto nos diferencia de igaleno justo donde su sitio **no** promete nada: WhatsApp real y **IA sobre estudios**.

---

## 4. Soporte para oftalmología (doctores oculares)

### 4.1 Qué debe capturar una historia clínica ocular
Basado en el estándar de la historia oftalmológica (anamnesis + exploración + refracción + hallazgos):

- **Motivo de consulta** y **antecedentes oculares** (ambliopía en la infancia, cirugías oculares, uso de gotas, uso de lentes/contacto).
- **Agudeza visual (AV)** de lejos y de cerca, por ojo **OD/OS**, con corrección (cc) y sin corrección (sc), y con **agujero estenopeico**.
- **Refracción**: autorefractómetro, refracción subjetiva (esfera / cilindro / eje / adición), **lensometría** de los lentes actuales.
- **Presión intraocular (PIO)** OD/OS (tonometría).
- **Reflejos pupilares** y **motilidad ocular**.
- **Segmento anterior** (biomicroscopía: párpados, conjuntiva, córnea, cámara anterior, iris, cristalino).
- **Segmento posterior / fondo de ojo** (papila, mácula, retina, vasos; con/sin dilatación).
- **Diagnóstico** (indicando ojo: OD / OS / AO).
- **Plan**: **receta óptica** (OD/OS esfera, cilindro, eje, adición, DP), medicamentos, y estudios indicados (OCT, campo visual, topografía).

### 4.2 Cómo encaja en nuestra arquitectura (el patrón ya existe)
Oftalmología sería un **nuevo formato de consulta** (`ConsultFormat = 'ophthalmology'`) y un **nuevo perfil** (`Oftalmología`), replicando exactamente lo que se hizo para masaje y nutrición. Pasos:

1. **Módulo puro** `src/lib/ophthalmology.ts` — arreglo `OPHTHALMOLOGY_FIELDS` (AV OD/OS cc/sc, refracción esf/cil/eje/add, PIO, segmento anterior/posterior, etc.) + normalizadores `toForm()`/`formTo…()` + helpers de impresión. Espejo de `src/lib/massage.ts`.
2. **Nuevo formato** en `src/lib/profiles.ts`: extender `ConsultFormat` con `'ophthalmology'` y sus etiquetas.
3. **Nuevo perfil** en `PROFILES`: `{ value: 'ophthalmology', label: 'Oftalmología', formats: ['general','ophthalmology'] }`.
4. **Grupo en el esquema** de `src/collections/Visits.ts`: grupo `ophthalmology` generado desde `OPHTHALMOLOGY_FIELDS` (como los grupos `nutrition`/`massage`), con acceso de solo-rol-clínico.
5. **Sub-componente de formulario** `src/components/OphthalmologySheet.tsx` + enganche en `src/components/VisitForm.tsx`.
6. **Normalización en servidor** en `dashboard/visits/actions.ts`.
7. **Vista imprimible** (ficha oftalmológica + receta óptica) en `src/app/(frontend)/print/...`.

La versión mínima es: **nuevo módulo de campos + una entrada en `PROFILES` + un grupo en la Consulta + un componente + una página de impresión.** Misma receta que ya validamos tres veces (nutrición, masaje, programa).

> Dato extra: la **receta óptica** (graduación de lentes) es distinta a la receta de medicamentos; conviene tratarla como su propia vista imprimible, no como el arreglo `prescription` actual.

---

## 5. Roadmap sugerido (por valor / esfuerzo)

1. **Oftalmología como perfil** (§4) — alto valor para el nuevo segmento, esfuerzo medio, patrón conocido. *Habilita vender a clínicas oculares ya.*
2. **F2 recordatorios automáticos por email + F3 confirmación** — ataca el dolor #1 (ausencias), reusa cron + Resend + reserva pública. Esfuerzo medio.
3. **F1 receta al WhatsApp (versión link `wa.me`)** — rápido, ya hay helper. Esfuerzo bajo.
4. **F4a documentos/estudios del paciente** — base para todo lo demás (y para IA). Esfuerzo medio.
5. **F2 WhatsApp automático (Business API)** — requiere proveedor (Twilio/Meta) y costo por mensaje. Medio-alto.
6. **F4b IA sobre estudios** — la joya diferenciadora; construir sobre F4a, siempre con revisión del médico. Alto.

---

## 6. Decisiones que necesito de ti
- ¿"Mejorar nuestros planes" = **precios/tiers** (como asumí en §3) o el **roadmap**?
- ¿Por dónde arrancamos a construir? Mi recomendación: **oftalmología como perfil** (paso 1), porque abre el segmento nuevo y es el patrón que mejor dominamos.
- Para WhatsApp automático de verdad (no link manual), ¿tienes o quieres una cuenta de **WhatsApp Business API** (Twilio/Meta)? Define si F2 es por email primero o WhatsApp desde el inicio.

---

# PARTE II — Investigación completa de la demo clínica de igalenus

> Fuente: recorrido a fondo de la **demo clínica oficial** (`gbook-gcp.igalenus.com/universal/demos-clinicos`), especialidad **Oftalmología**, el 2026-11-25. "Demo visual · datos de ejemplo · nada se guarda." Marca en la demo: **i.Galenus**.

## 7. El modelo mental de igalenus (cómo trabaja)

La demo no es un formulario: es un **motor de notas clínicas guiadas componible por especialidad**. La jerarquía es:

```
Especialidad  →  Tipo de consulta (flow)  →  Lista ordenada de secciones  →  cada sección usa un patrón de captura reutilizable
   Oftalmología      · Consulta 1ª vez            01..10 (ver §8)                 (por-ojo, chips, agregar-medición, atajos, texto)
                     · Retina                     set propio
                     · Estrabismo                 set propio
                     · Glaucoma                   01..11 (ver §10)
   Genética (próx.)
   Neurología (próx.)
```

- La pantalla de entrada es **"¿Qué consulta exploramos hoy?" → elige especialidad → elige tipo de consulta**. Eso es, a la vez, el patrón de **onboarding** y de **perfil de clínica**: elegir la especialidad aprovisiona todo el resto (secciones, atajos, receta, seguimiento).
- Cada *flow* es una URL propia (`?flow=oftalmologia_primera_vez`, `?flow=glaucoma_primera_vez`). Las secciones se **reutilizan** entre flows (Motivo, Agudeza+PIO, Refracción, Diagnóstico, Plan, Seguimiento son compartidas; otras son subespecializadas).
- Lema de producto: *"Notas clínicas guiadas, pensadas para médicos."* Pasos: **1 Elige · 2 Llena la nota guiada · 3 Compara y grafica.**

### Tres modos de llenar la MISMA nota
- **Guiada** — paso a paso, con divulgación progresiva (en la demo trae solo el Motivo; es el modo "asistente").
- **Completa** — acordeón con las 10–11 secciones + **índice lateral** navegable. Es el modo "experto".
- **Enfocada** — subconjunto de secciones para consultas rápidas.
- A la derecha, siempre, una **"Nota en construcción"** (preview en vivo del documento que se arma mientras escribes).

## 8. Inventario de secciones y campos — Oftalmología (consulta 1ª vez)

| # | Sección | Patrón de captura | Campos / opciones reales de la demo |
|---|---|---|---|
| 01 | **Motivo de consulta** | Texto del paciente (solo lectura) + atajos médicos | *Motivo referido por el paciente* (solo lectura, viene del intake). *Motivo médico* (chips): Visión borrosa · Dolor ocular · Ojo rojo · Revisión de rutina · Destellos/moscas · Pérdida visual · + Agregar otro |
| 02 | **Agudeza visual y PIO** | **Por ojo (OD/OI)** + botón "igualar ojos" | **AV** (escala: 20/15…20/400, CD 2m/1m/50cm/30cm, MM, FyS, PLDC, PLNDC, NPL) · **PH** (agujero estenopeico, misma escala) · **PIO** (mmHg) · Observaciones |
| 03 | **Refracción** | **Agregar medición**, cada una por ojo | Chips: Subjetiva · Cicloplégica · Objetiva · Anteojos · Lentes de contacto · Autoref · Adición · Queratometría · Paquimetría · Distancia Interpupilar. Cada medición por ojo = **Esf = Cil × Eje°** + **AV** · Comentarios |
| 04 | **Movimientos oculares** | Por ojo, ítems agregables | Movimientos (agregar hallazgos) · Comentarios |
| 05 | **Biomicroscopía** (seg. anterior) | **Agregar estructura**, hallazgo por ojo | Párpados · Saco lagrimal · Conjuntiva · Esclera · Córnea · Cámara anterior · Gonioscopía · Iris · Pupila · Cristalino-LIO · Fondo de saco · Comentarios |
| 06 | **Fondo de ojo** (polo posterior) | Agregar estructura | Nervio óptico · Mácula · Vítreo · Vasos · Periferia · Retina · Comentarios |
| 07 | **Diagnóstico** | Atajos + buscador de código | Ojo seco · Catarata · Glaucoma · Miopía · Astigmatismo · Retinopatía diabética · DMAE · Conjuntivitis · Pterigión · **+ Buscar/agregar (CIE-10)** · Observaciones |
| 08 | **Pronóstico** | Atajos | (chips de pronóstico) |
| 09 | **Plan de tratamiento** | Agregar sección de plan | Medicamentos · Indicaciones · Estudios · Laboratorio · **Lentes → "Prescripción de lentes"** (receta óptica) · Comentarios |
| 10 | **Seguimiento** | Intervalo | 1 semana · 2 semanas · 1 mes · 3 meses · 6 meses · 1 año · Alta · + Otro · Observaciones |

**Patrones de UI reutilizables** (esto es lo que hay que copiar como "piezas"):
1. **Captura por ojo (OD/OI)** con botón para igualar/copiar un ojo al otro.
2. **Escala clínica tipada** (la AV no es texto libre: es un selector con la escala completa) → permite graficar después.
3. **Chips de atajo + "Agregar otro"** (texto libre o búsqueda CIE-10).
4. **Repetidor "agregar medición/estructura"** (Refracción, Biomicroscopía, Fondo, Plan): el médico añade solo lo que exploró.
5. **"Igual que la última visita" / "Traer y editar"**: arrastra la atención previa y editas solo lo nuevo.
6. **Preview de documento en vivo** mientras llenas.

## 9. Contexto del paciente y cierre de la consulta

**Tres paneles de contexto** siempre accesibles desde la cabecera (no sacan al médico de la nota):
- **Antecedentes** — heredofamiliares, diagnósticos previos, alergias, medicación actual, **últimas mediciones** (AV/PIO con fecha) y últimas visitas.
- **Estudios** — estudios del paciente por categoría: **Imagen** (p. ej. Pentacam: mapas refractivos, cámara anterior, tamización de ectasia), **Funcionales** (Campimetría 24-2, OCT de nervio óptico), **Laboratorio** (HbA1c, glucosa), con fecha y descripción.
- **Atenciones** — historial de visitas; se puede **elegir una para compararla** con la nota en construcción.

**El paso 3 — Comparar y graficar (el gran diferenciador):**
- Vista **lado a lado**: *En construcción* vs. *atención previa*, sección por sección, con marcador **Δ** donde hay cambios. Selector para elegir con qué visita comparar.
- **Tendencia graficada** (porque los campos son tipados): toggles **Agudeza visual / PIO / Esfera**, líneas por ojo (OD/OI) a través del tiempo (p. ej. 08 ago → 10 nov → 12 mar → Hoy). Oro para enfermedad crónica (progresión de glaucoma/miopía).

**Al finalizar:**
- **Revisión de completitud contra norma** ("REVISIÓN NOM-004" — la norma mexicana de expediente clínico): marca datos faltantes (Diagnóstico, Pronóstico, Plan…) con "Ir a completar"; *"verificación orientativa; no sustituye el criterio del médico"*; botón "Finalizar de todos modos".
- Documento final con firma y **ACCIONES**: **Imprimir receta · Enviar al paciente · Descargar PDF · Agendar próxima cita · Solicitar estudios.**
- Cierra con una **encuesta anónima** de satisfacción (5 preguntas) — telemetría de producto.

## 10. Cómo maneja las ramas y especialidades (lo que pediste copiar)

Comparación de dos flows confirma el modelo **componible**:

| Oftalmología 1ª vez (10) | Glaucoma 1ª vez (11) |
|---|---|
| 01 Motivo de consulta | 01 Motivo de consulta |
| 02 Agudeza visual y PIO | 02 Agudeza visual y PIO |
| 03 Refracción | 03 Refracción |
| 04 Movimientos oculares | 04 **Segmento anterior** (= biomicroscopía, renombrada) |
| 05 Biomicroscopía | 05 **Gonioscopía** ⭐ |
| 06 Fondo de ojo | 06 **Nervio óptico (papila)** ⭐ |
| 07 Diagnóstico | 07 **Campo visual** ⭐ |
| 08 Pronóstico | 08 **Clasificación** ⭐ (estadificación de glaucoma) |
| 09 Plan de tratamiento | 09 Diagnóstico |
| 10 Seguimiento | 10 Plan de tratamiento · 11 Seguimiento |

**La regla de extrapolación:** hay una **biblioteca de secciones** reutilizables (Motivo, AV+PIO, Refracción, Segmento anterior, Diagnóstico, Plan, Seguimiento…) y cada *tipo de consulta* es solo **una lista ordenada que elige de esa biblioteca** + añade sus secciones propias. Crear una especialidad nueva = definir sus flows y qué secciones compone; no se reprograma nada.

## 11. Cómo lo llevamos a NUESTRO EMR (potenciar lo que tenemos)

Hoy tenemos: perfiles → formatos → grupos de campos en la Consulta (patrón `massage.ts`/`nutrition.ts`). Para igualar/superar a igalenus hay que subir ese motor un nivel:

| Capacidad de igalenus | ¿La tenemos? | Qué construir sobre lo nuestro |
|---|---|---|
| Biblioteca de **secciones componibles** por flow | Parcial (formatos planos por perfil) | Elevar `profiles.ts`: un *flow* = lista ordenada de secciones reutilizables. Base perfecta para extrapolar a otras especialidades |
| **Captura por ojo (OD/OI)** y escalas tipadas (AV/PIO/Esf) | No | Nuevo tipo de campo "por lado" + selects de escala clínica (habilita graficar) |
| **Repetidores** "agregar medición/estructura" | No | Nuevo tipo de campo lista-dinámica |
| **Nota en construcción** (preview en vivo) | No (solo `/print/*`) | Panel de preview en vivo junto al `VisitForm` |
| **Traer y editar** desde la última visita | Parcial (`Patients.history`) | Carry-forward por sección en la Consulta |
| Paneles **Antecedentes / Estudios / Atenciones** | Parcial | `Patients.history` ya cubre Antecedentes; falta colección **Estudios** (archivos por categoría) y panel de Atenciones |
| **Comparar + graficar tendencias** | No (`reports.ts` es agregado) | Requiere los campos tipados longitudinales; luego vista comparar + charts OD/OI |
| **Verificador de completitud** por norma | No | Igual que NOM-004 pero contra la **norma dominicana** de expediente |
| **Acciones post-consulta** (imprimir/enviar/PDF/agendar/solicitar estudios) | Parcial (solo imprimir) | Enviar al paciente (WhatsApp), agendar próxima cita (desde el intervalo de Seguimiento), solicitar estudios |

### 11.1 Onboarding y perfiles de clínica (tu punto)
- El selector de especialidad **ES** el onboarding: al crear la clínica, elegir especialidad(es) aprovisiona perfiles, flows, secciones, plantillas de receta y motivos de agenda. 
- Encaja directo con nuestro **perfil del consultorio**: hoy elige general/nutrición/estética; lo extendemos a *elige especialidad → se arma todo*. Un mismo tenant puede tener varios flows (p. ej. oftalmología + optometría).

### 11.2 Qué copiamos y qué MEJORAMOS (nuestra ventaja)
Copiar: el modelo componible, la captura por-ojo tipada, la nota en construcción, comparar+graficar, los paneles de contexto, el verificador de norma y las acciones de cierre.
**Mejorar / superar** (cosas que su demo NO tiene):
- **WhatsApp real** para "Enviar al paciente" y recordatorios 5d/1d + confirmación (su web solo ofrece SMS/email).
- **IA sobre estudios**: su panel de Estudios es solo adjuntos; nuestra apuesta es que la IA lea el estudio y proponga borrador de informe.
- **Norma dominicana** en el verificador (no la mexicana NOM-004).
- Receta óptica como documento imprimible propio (ellos la dejan como texto).

## 12. Siguiente entregable: wireframe
Con esto armo un **wireframe** de la "Consulta guiada por especialidad" para nuestro EMR (adaptado a nuestro stack y a la identidad teal), que potencia lo que ya tenemos y es extrapolable a cualquier especialidad. Ver artifact aparte.

---

# PARTE III — Perfiles: especialidades por médico + perfiles macro por organización

> Basado en el deep research `reports/Especialidades médicas y adopción EMR.md` (demanda global, RD/LatAm, adopción de EMR por especialidad, nichos de crecimiento). Las cifras de mercado son de firmas comerciales: tómalas como rangos direccionales.

## 13. El modelo de dos ejes (evolución de lo que ya existe)

| Eje | Qué define | Hoy en el código | Evolución |
|---|---|---|---|
| **A · Tipo de organización** (macro, por tenant) | Plan, módulos, roles, facturación, escala | `practiceType` = `individual` \| `clinic` | Enum de tipos de organización (§14) que activa módulos y plan |
| **B · Especialidad** (micro, por médico) | La consulta custom: flows, secciones, receta, motivos de agenda | `PracticeProfile` = general / nutrition / aesthetic → formatos | Perfil por médico (`Users.specialty`/`defaultFormat` ya existen) → flows con secciones reutilizables |

Un tenant = **un tipo de organización + N especialidades** (una por médico). En una clínica de especialidades, cada médico ve su consulta custom, pero comparten agenda, pacientes y facturación.

## 13.1 Lista priorizada de especialidades

**Por qué este orden:** cruza (1) el volumen real en RD (consultas 2024: obstetricia 428k, medicina general 423k, pediatría 380k, ginecología 330k), (2) el crecimiento y la disposición a pagar software (estética ~14% anual, GLP-1/nutrición, dental ~9–12%, fisio ~9–11%), (3) qué tan poco digitalizada está la especialidad (salud mental, la más rezagada) y (4) cuánto reusa de lo que ya tenemos.

### Nivel 0 — Ya existen / en curso
| Especialidad | Estado | Piezas custom |
|---|---|---|
| Medicina general / familiar | ✓ existe | Signos vitales, receta, órdenes de estudio |
| Estética y spa | ✓ existe | Hoja de masaje, rol terapeuta, programas, fotos de progreso |
| Nutrición / control de peso | ✓ existe | Antropometría, laboratorio, programa por semanas. **Potenciar para GLP-1** (titulación de dosis = visitas recurrentes) |
| Oftalmología (+ Retina, Glaucoma, Estrabismo, Córnea) | En curso | AV/PIO por ojo, refracción, biomicroscopía, fondo de ojo, receta óptica, tendencias |

### Nivel 1 — Siguientes (alto volumen en RD o alto valor cash-pay)
| Especialidad | Por qué | Piezas custom | Reusa |
|---|---|---|---|
| **1. Odontología** | Cash-pay, servicio líder del turismo de salud en RD (>179k pacientes dentales extranjeros en 2022), ~12.75% de los consultorios en México, software ~9–12% anual | **Odontograma** y periodontograma, plan y presupuesto por pieza, consentimientos | Fotos, programas/paquetes |
| **2. Ginecología y Obstetricia** | #1 y #4 en volumen en RD | Control prenatal (FUM/FPP, altura uterina, FCF), Papanicolaou/colposcopía, ecografía | Historia gineco-obstétrica de `Patients.history` (ya existe) |
| **3. Pediatría** | #3 en volumen en RD | Curvas de crecimiento (percentiles OMS), esquema de vacunas, hitos del desarrollo, dosis por peso | Motor de tendencias (curvas) |
| **4. Dermatología** | Cash-pay, ligada a estética | Mapa corporal de lesiones, fotos por lesión en el tiempo, dermatoscopía, fototipo | Módulo de fotos de progreso |

### Nivel 2 — Alto valor, siguiente ola
| Especialidad | Por qué | Piezas custom |
|---|---|---|
| **Fisioterapia / Rehabilitación** | 2.º grupo de proveedores en EE.UU., ~41% en clínicas ambulatorias, visitas recurrentes | ROM/goniometría, fuerza, dolor (EVA), notas SOAP por sesión, ejercicios en casa. Reusa rol terapeuta + tendencias |
| **Psicología / Psiquiatría** | Salud mental: la menos digitalizada y la que más usa teleconsulta (~12–15% anual) | Examen mental, escalas PHQ-9/GAD-7 graficables, notas de evolución, plan terapéutico, privacidad reforzada |
| **Cardiología** | Demanda en alza (+25% volumen ambulatorio a 10 años) | TA seriada, riesgo CV, NYHA, ECG/eco, tendencias |
| **Endocrinología / Diabetes** | >500M diabéticos; encaja con GLP-1 | HbA1c, glucosa, tiroides, lípidos con metas y tendencias |
| **Neurología** *(pedida)* | Neurociencias +23% a 10 años; neurología +7% al 2033 (datos de EE.UU.; no hay datos de RD/LatAm) | Examen neurológico (pares craneales, fuerza, reflejos, sensibilidad, marcha), escalas (Glasgow, NIHSS, MoCA), EEG/EMG. **Recomendación:** plantilla ligera dentro del perfil "clínica de especialidades", no un vertical aparte |

### Nivel 3 — Completar el catálogo
Ortopedia/Traumatología (región anatómica, ROM, imagen, plan quirúrgico) · **Cirugía plástica** (fuerte en RD por turismo médico: fotos, consentimientos, paciente internacional) · Otorrinolaringología (otoscopía, audiometría) · Gastroenterología · Urología (IPSS, PSA) · Neumología (espirometría) · Podología (mapa del pie) · Optometría (variante ligera de oftalmología) · Medicina ocupacional (aptitud laboral).

> **Nota sobre oftalmología:** su nicho de software es el más pequeño (~USD 345–635M, 5–9% anual) y el más técnico de integrar (equipos DICOM). Su valor para nosotros es **abrir el segmento de clínicas oculares y estrenar el motor de secciones componibles**, que luego reusan todas las demás.

## 14. Perfiles macro por tipo de organización (para los planes)

Las clínicas estéticas **no** son iguales a las de especialidades: cambia el modelo de negocio, los roles, la facturación y la carga regulatoria, no solo la plantilla de consulta.

| Perfil macro | Quién es | Lo que necesita (módulos) | Facturación | Plan sugerido |
|---|---|---|---|---|
| **Consultorio independiente** | 1 médico (+ asistente) | Agenda, consulta de su especialidad, receta, reserva pública | Cash + algo de ARS; e-CF | Esencial |
| **Clínica estética / spa** | Médicos + **terapeutas** (no médicos), alto componente cash | Paquetes y membresías, fotos antes/después, programas, consentimientos, CRM/marketing, paciente internacional | Mayormente cash/POS, e-CF | Estética (vertical propio) |
| **Clínica de especialidades** | Varios médicos de **distintas** especialidades | Un perfil custom por médico, agenda y pacientes compartidos, **referencias internas** entre especialidades, estudios | **ARS** (80–90% del ingreso de clínicas privadas en RD) + e-CF | Clínica / Pro |
| **Policlínica / centro general** | Alto volumen, general + algunas especialidades | Triaje/enfermería, laboratorio, turnos y sala de espera, multi-consultorio | ARS + e-CF | Clínica+ |
| **Hospital / internamiento** | Camas, emergencia, quirófano, multi-sede | Internamiento, áreas/servicios, emergencia, quirófano, roles ampliados, multi-sede | ARS compleja + e-CF | Enterprise (después) |

**Imprescindibles para RD en todos los planes con facturación:**
- **e-CF de la DGII** (Ley 32-23): la facturación electrónica es obligatoria y el despliegue llega a todos los contribuyentes en noviembre de 2026.
- **ARS:** autorizaciones, reclamaciones y conciliación. 3 ARS (SeNaSa, Primera, Mapfre) concentran >70% del mercado.
- **Expediente clínico:** RD no tiene todavía una norma técnica obligatoria para el expediente electrónico privado. Diseñar para la Ley 172-13 de protección de datos y para interoperar a futuro con el expediente único del SNS.

**Posicionamiento:** los hospitales grandes (SEDMA, HOMS, Plaza de la Salud) usan sistemas tipo SAP. Nuestro terreno es del **consultorio a la clínica de especialidades y la policlínica**; hospital va al final.

## 15. Para discutir
1. ¿Confirmamos el orden del Nivel 1 (Gineco-Obstetricia, Pediatría, Odontología, Dermatología) después de terminar oftalmología?
2. ¿El plan "Estética" va como vertical aparte del plan "Clínica"?
3. ¿e-CF/ARS entran ya en el roadmap? Son el requisito legal, no solo una mejora.
4. ¿Neurología y Fisioterapia se adelantan si ya hay clientes interesados?

---

# PARTE IV — SaaS "as intended": capacidades de los planes de igalenus

Fuente: igalenus.com/precios y /preguntas-frecuentes, leídas el 2026-11-25. Son afirmaciones del proveedor, no las verificamos en el producto.

## 16. Los planes de igalenus (USD, IVA incluido, solo tarjeta, sin cobro por usuario)

| | Expediente | Consultorio | Clínica | Institucional |
|---|---|---|---|---|
| Precio | $0 | $49/mes (o $47 anual) | $139/mes (o $133 anual) | A la medida |
| Usuarios | Ilimitados | Ilimitados | Ilimitados | Ilimitados |
| Sedes | 1 | 1 | Hasta 3 | Ilimitadas |
| Consultas dictadas con IA / mes | 15 | 100 | 300 | — |
| Estudios con IA / mes | 20 | 60 | 250 | — |
| Timbres CFDI (factura México) / mes | 10 | 100 | 400 | — |
| Almacenamiento | 10 GB | 50 GB | 200 GB | — |
| Recordatorios WhatsApp / mes | 100 (1er mes) | 1,000 | 2,000 | — |
| Óptica | 15 órdenes/mes | Ilimitada | Ilimitada | — |
| Inventario con lotes y caducidades | No | Sí | Sí | Sí |
| Integración hospital/laboratorio | No | No | No | Sí |

**Cómo cobran el excedente:** no bloquean. Avisan al 80% y al 100%, y el cliente puede fijar un tope mensual. Lo no usado pasa al mes siguiente, hasta una bolsa completa. Precio por unidad extra: estudio con IA $0.33, consulta dictada $0.17, timbre CFDI 2.50 MXN, almacenamiento $2 por cada 10 GB al mes. Email y portal del paciente son ilimitados; el tope solo aplica a WhatsApp.

**Lección de modelo:** igalenus no cobra por médico ni por paciente. Cobra por **uso medible** (IA, WhatsApp, facturas, GB). Nosotros hoy hacemos lo contrario: limitamos médicos y pacientes, y no medimos nada más.

## 17. Qué significa cada cosa, y si la podemos hacer

### "20 estudios con IA al mes"
El médico sube un estudio (igalenus solo nombra **OCT y campo visual**). La IA devuelve un **borrador de interpretación** que el médico revisa y firma; la IA nunca firma. Cada estudio interpretado consume 1 de la bolsa mensual. Guardar estudios sin interpretarlos no consume nada.
También ofrecen **"consulta dictada con IA"**: se graba la consulta y sale la nota estructurada como borrador. Cuenta 1 por paciente por día, no por minuto.

**¿Podemos?** Sí. Hacen falta tres piezas:
1. Una colección `Studies` (archivos por paciente: PDF/imagen, ojo OD/OI, fecha, tipo).
2. Una llamada a un modelo con visión que lea el PDF o la imagen y devuelva un borrador estructurado.
3. Un contador mensual por clínica.

El costo por estudio con un modelo de IA es de centavos de dólar, menor que los $0.33 que cobran ellos. Hay que validarlo con estudios reales antes de fijar precio.
Riesgo clínico: siempre como borrador firmado por el médico, igual que ellos. Empezar por estudios con texto (laboratorio, informes PDF de OCT/campo visual), que la IA lee bien, antes que imágenes crudas.

### WhatsApp: cómo funciona y si lo podemos hacer
- **Hoy tenemos:** links `wa.me` manuales (`src/lib/whatsapp.ts`). El médico hace clic y WhatsApp se abre con el texto listo. Nada se envía solo.
- **Lo de igalenus:**
  - Mensajes **automáticos**: confirmación al agendar, recordatorio la noche anterior y aviso si la cita se mueve.
  - El paciente recibe un **link personal sin contraseña** donde confirma o elige otro horario libre. El sistema registra que el cambio lo hizo el paciente.
  - También mandan receta y receta de lentes por WhatsApp.
- **Cómo se hace:** con la **API oficial de WhatsApp Business (Cloud API de Meta)**, directo o vía un proveedor (Twilio, 360dialog, etc.).
  - Requisitos: un número de la clínica o nuestro, verificado como empresa, y **plantillas de mensaje aprobadas por Meta** ("Hola {nombre}, le recordamos su cita el {fecha}…").
  - Meta cobra por mensaje de plantilla. Los de tipo "utilidad" (recordatorios) cuestan centavos de dólar; hay que verificar la tarifa de RD.
  - Por eso igalenus pone un **tope** (1,000/mes): es su costo real.
- **¿Podemos?** Sí, y casi todo lo demás ya existe:
  - El cron (`api/cron/daily-digest`) se convierte en el motor de recordatorios.
  - Las citas reciben un estado `confirmed`.
  - Se crea una página pública con token de un solo uso para confirmar o reagendar (igual que ya hacemos con BookingRequests).
  - Se añade un contador mensual de mensajes por plan.
  - Plan B sin API: email + link de confirmación (gratis e ilimitado) y WhatsApp solo en los planes de pago.

### "Óptica sin límite de órdenes"
Es el **módulo de venta óptica**:
- La receta de lentes de la consulta se convierte en **orden de venta** sin volver a escribir la graduación.
- Incluye catálogo de micas por laboratorio, índice y tratamiento; armazones y lentes de contacto del inventario; cotización con vencimiento; **abonos** (pagos parciales) y estado de la orden hasta la entrega.
- "Sin límite" = el plan gratis trae 15 órdenes al mes y los de pago, ilimitadas.

**¿Podemos?** Sí. Depende de tener antes la receta de lentes (oftalmología, Nivel 0) e inventario. Es un módulo vertical: solo se activa si la clínica tiene perfil oftalmología/óptica.

### "Inventario con lotes y caducidades"
- Control de existencias donde cada entrada registra **lote y fecha de vencimiento**: gotas, medicamentos, armazones, lentes de contacto.
- En estética sirve igual para **toxina botulínica y rellenos**, donde el lote importa legalmente.
- Funciones: alertas de vencimiento, salida del lote más viejo primero, y trazabilidad de qué lote se usó en qué paciente.
- igalenus no describe más que el nombre.

**¿Podemos?** Sí. Son 2 colecciones nuevas (`Products`, `StockLots`) más movimientos. Lo valioso es ligar el lote al paciente en la consulta (estética e inyectables).

### "50 GB"
Espacio para estudios, imágenes y documentos de pacientes. Según igalenus, 50 GB ≈ 10,000 estudios.

**¿Podemos?** Sí, pero **hoy no tenemos almacenamiento de archivos general** (solo `ProgressPhotos`). Hace falta:
- Un adaptador de almacenamiento de objetos para Payload (S3, Cloudflare R2 o MinIO en el homelab).
- Sumar los bytes por clínica.

### "1,000 recordatorios por WhatsApp"
Es el tope mensual de mensajes automáticos de WhatsApp de ese plan (ver arriba). No cobran por mensaje dentro del tope. Email y portal siguen ilimitados.

## 18. Qué le falta a nuestra capa SaaS (estado real del código)

| Pieza | Hoy | Falta |
|---|---|---|
| Planes | `src/lib/plans.ts`: 5 planes, solo limitan **médicos y pacientes** | Cuotas mensuales por recurso medido |
| Enforcement | `src/hooks/planLimit.ts`: bloquea solo el `create` de users/patients | Contador de uso por mes, avisos al 80/100%, tope sin bloquear la consulta |
| Cobro | Precios "solo de muestra"; el super admin cambia el plan a mano | Pasarela de pago, prueba gratis, upgrade self-service, facturas |
| Archivos | Solo `ProgressPhotos` | `Studies` + almacenamiento de objetos + cuota GB |
| WhatsApp | Links `wa.me` | Cloud API, plantillas, recordatorios 5d/1d, confirmación con token |
| IA | Nada | Interpretación de estudios; luego dictado |
| Óptica / inventario | Nada | Módulos verticales |
| Facturación fiscal RD | Nada | e-CF DGII (obligatorio para todos a nov-2026) y reclamaciones ARS |

**Pasarela de pago en RD:** Stripe no abre cuentas a comercios dominicanos. Las opciones a evaluar son Azul, CardNet, PayPal y dLocal. Hay que verificar antes de elegir.

## 19. Plan por fases (dos carriles en paralelo)

Los dos carriles tocan archivos distintos y pueden avanzar al mismo tiempo. Cada carril tiene una fase base que va primero.

### Carril A — Especialidades (el EMR se adapta al médico)
| Fase | Qué | Reutiliza |
|---|---|---|
| **A0 Motor de flujos** (base) | `profiles.ts` evoluciona a especialidad → flujos → secciones reutilizables. Especialidad **por médico** y tipo de organización **por clínica**. Onboarding de dos ejes. Los perfiles actuales (general, nutrición, estética) se migran sin romper datos. | profiles.ts, VisitForm, practiceType |
| A1 Oftalmología | Captura OD/OI, receta de lentes, comparar y tendencia, chequeo de completitud | A0 |
| A2 Odontología | Odontograma por pieza y plan de tratamiento | A0 |
| A3 Gineco-obstetricia | Control prenatal (FUM, FPP, semanas) | A0 |
| A4 Pediatría | Curvas de crecimiento y vacunas | A0 |
| A5 Dermatología | Mapa de lesiones con fotos | A0 + B2 (archivos) |
| A6+ Nivel 2–3 | Fisio, salud mental, cardio, endo, neuro (plantilla ligera)… | A0 |

### Carril B — SaaS (planes que se miden y se cobran)
| Fase | Qué | Depende de |
|---|---|---|
| **B1 Medición de uso** (base) | Colección `UsageCounters` (clínica × mes × recurso). `PLAN_LIMITS` gana cuotas mensuales: estudios IA, WhatsApp, GB, órdenes óptica. Avisos al 80/100% en el panel. Sin bloquear la atención. | — |
| B2 Archivos y estudios | `Studies` por paciente + almacenamiento de objetos + cuota GB | B1 |
| B3 Recordatorios y confirmación | Estado `confirmed`, página con token para confirmar/reagendar, recordatorios 5d y 1d por **email primero** y WhatsApp Cloud API después, envío de receta | B1 |
| B4 IA en estudios | Borrador de interpretación sobre `Studies`, contado contra la cuota | B1 + B2 |
| B5 Cobro | Pasarela de pago, prueba de 15 días, upgrade self-service | B1 |
| B6 Inventario + óptica | Lotes y caducidades; orden óptica desde la receta de lentes | A1 |
| B7 e-CF DGII + ARS | Facturación electrónica y reclamaciones | B5 |

### Propuesta de planes nuestros (borrador para discutir)
Seguimos sin cobrar por paciente. Los médicos sí siguen siendo un eje, porque es nuestro mercado: consultorio → clínica. Las cuotas medidas se añaden encima.

| | Gratis | Médico independiente | Consultorio (3 médicos) | Clínica privada |
|---|---|---|---|---|
| Estudios con IA / mes | 10 | 60 | 150 | 250 + por médico |
| Recordatorios WhatsApp / mes | 0 (solo email) | 500 | 1,000 | 2,000 |
| Almacenamiento | 2 GB | 25 GB | 50 GB | 200 GB |
| Módulos verticales | — | Según especialidad | Según especialidad | Óptica, inventario |

Las cifras son un punto de partida. Se fijan cuando B1 mida el uso real y conozcamos la tarifa de Meta y el costo de la IA.

## 20. Cobro con PayPal (B5) — investigación 2026-11-25

**Veredicto:** viable con matices. Hay que confirmarlo con la cuenta real antes de construir encima.

- **RD es mercado PayPal completo:** enviar, recibir y retirar. Las REST APIs funcionan con cuenta Business ([country codes](https://developer.paypal.com/api/rest/reference/country-codes), [supported features](https://developer.paypal.com/payouts/supported-features)).
- **Suscripciones por API:** exigen una cuenta Business habilitada para PayPal Subscriptions ([docs](https://developer.paypal.com/docs/subscriptions/integrate/)). Ninguna fuente excluye a RD, pero ninguna lo confirma país por país.
- **Cuenta a nombre propio (persona física):** no se pudo leer la página oficial de RD. Terceros mencionan cédula, cuenta bancaria local y verificación telefónica.
- **Riesgo principal:** RD **no** tiene Advanced Credit and Debit Cards. No hay campos de tarjeta propios. El pago con tarjeta sin cuenta PayPal en una suscripción depende de PayPal, así que hay que asumir que muchos médicos tendrán que crear cuenta PayPal.
- **Comisiones** ([PDF oficial ROW, 28-oct-2026](https://www.paypalobjects.com/marketing/ua/OA/merchant-fees/en-ROW-102826.pdf)):
  - Recibir: 5.40% + US$0.30. Con tarifa de comerciante aprobada baja a 4.40–4.90% según volumen.
  - Retirar a banco dominicano: 100 DOP en pesos, o 0.50% (mínimo US$10) en dólares.
  - Conversión de moneda: 3.5–4%.
- **Flujo técnico:**
  - Se crea un producto, luego un plan (admite período de prueba) y luego la suscripción; el médico aprueba en PayPal.
  - Los webhooks `BILLING.SUBSCRIPTION.*` y `PAYMENT.SALE.*` activan, suspenden o cancelan el plan del tenant.
  - Existe sandbox para probar.
- **DGII:** cobrar a clínicas dominicanas es actividad gravada. Hace falta RNC (el de persona física suele ser la cédula), comprobantes, probablemente ITBIS, y e-CF, que es obligatorio para pequeños contribuyentes desde el 15-nov-2026. Consultar con un contador.
- **Alternativas:**
  - **Azul / CardNet:** cobro en DOP con tarjetas locales y recurrente tokenizado. Requieren RNC y cuenta de comercio. Es lo mejor para clientes locales.
  - **Stripe:** solo vía LLC en EE. UU.
  - **Paddle / Lemon Squeezy:** venden como merchant of record. Hay que revisar si aceptan software médico y si pagan a RD.

**Plan recomendado:** PayPal primero, construido sobre B1 (los planes y cuotas ya medidos), con un adaptador de pasarela para poder sumar Azul/CardNet después sin tocar el resto.
