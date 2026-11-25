# Tipos de visita (no-consulta) en el sistema de turnos y tablero en vivo "Flujo de pacientes del día"

Contexto: EMR SaaS para consultorios, clínicas y hospitales en República Dominicana (medira.do). Investigado en noviembre de 2026. Casi todas las fuentes son documentación o marketing de proveedores, y lo señalo donde importa. Fuentes específicas de RD fueron escasas (ver Gaps).

## 1. Motivos de visita típicos por tipo de negocio: cuáles requieren profesional, cuáles van a un mostrador y cuáles tienen varios pasos

### Takeaway
Las fuentes respaldan una distinción de tres tipos de "servicio":
- **Con profesional y agenda**: consulta médica, masaje, facial, láser, odontología, fisioterapia.
- **De mostrador o ventanilla, sin profesional asignado**: caja, admisión, entrega de resultados, información, retiro de documentos.
- **Recorridos de varios pasos**: por ejemplo recepción → caja → toma de muestra en un laboratorio, o admisión → triaje → consulta → caja en un hospital.

Hay además una cuarta variante: servicios que solo consumen un recurso (sala, equipo) y no necesitan personal.

### Cited Findings
- En software de laboratorio LatAm, el paciente pasa secuencialmente de recepción a caja y luego a toma de muestra, y avanza automáticamente al siguiente puesto tras ser atendido en el primero — [CLINSIS portafolio laboratorio](https://www.clinsis.com/pdf/PortafolioCLINSISLabo.pdf)
- El SIHCE del MINSA (Perú) separa módulos interconectados: programación de turnos, ventanilla única, triaje, consulta externa, caja y laboratorio. Las órdenes de laboratorio llegan desde citas y desde los módulos asistenciales — [MINSA SIHCE Manual Laboratorio](https://www.minsa.gob.pe/sihce/manualess/MU_LABORATORIO.pdf); [MINSA Ventanilla Única](https://www.minsa.gob.pe/sihce/manualess/MU_VENTANILLA_UNICA.pdf)
- Un turnero gubernamental argentino organiza las agendas por "trámite", con reserva online, presencial y telefónica, y requisitos propios de cada trámite. Es el modelo de la ventanilla administrativa — [Manual Turnero Córdoba](https://www.cba.gov.ar/wp-content/4p96humuzp/2015/09/Manual-Turnero.pdf)
- En el gestor de turnos de la Historia de Salud Integrada de Río Negro, los turnos clínicos se asignan a la agenda de cada profesional y quedan vinculados a la historia clínica electrónica — [Río Negro HSI Turnos](https://salud.rionegro.gov.ar/documentos/informatica/Modulos%20HSI/Turnos-V-1-12-0-OK.docx.pdf)
- Una tesis peruana analiza por separado el proceso de atención en admisión y el de caja en una clínica, y modela con simulación el tiempo total en el sistema. Admisión y caja son etapas de cola propias — [Tesis PUCP](https://tesis.pucp.edu.pe/bitstreams/b023e859-663b-4efe-be6d-4ef00043378f/download)
- Spa y bienestar: Fresha permite servicios que usan un recurso sin miembro del equipo (p. ej. sauna, cama de bronceado) desactivando "Team members required" — [Fresha Help: bookable resources](https://www.fresha.com/help-center/knowledge-base/calendar/101215-create-and-manage-resources)
- Jane App también admite servicios que no requieren profesional (sauna, ejercicios de rehabilitación autoguiados) — [Jane Guide: Resource booking](https://jane.app/guide/resource-booking)
- Una cita de spa normalmente requiere a la vez un proveedor y una sala de tratamiento, así que los errores de agenda afectan a varios recursos — [Mindbody blog spas](https://www.mindbodyonline.com/business/education/blog/booking-and-scheduling-software-spas)
- Doctoralia muestra servicios separados para primera visita y visita sucesiva (p. ej. "Primera visita terapia" y "Consulta sucesiva terapia individual"). El tipo de consulta es un servicio distinto, no un simple atributo — [Perfil Doctoralia.es](https://www.doctoralia.es/jaime-arca-delgado/psicologo/pontevedra)
- Laboratorio en RD: Amadita tiene sucursales autorizadas para "toma y recepción de muestras" con alcances de análisis distintos según la sede. La toma de muestras es un servicio de sucursal separado del análisis — [Certificados ISO Amadita](https://amadita.com/wp-content/uploads/2023/09/certificados-ISO-9001-2021.pdf)
- Pautas comunes de preanalítica en LatAm: ayuno de 8 h para química general y de 12 h para perfil lipídico. Por eso la toma de muestras se concentra temprano en la mañana — [Fundación Bioquímica Argentina 2026](https://www.fba.org.ar/wp-content/uploads/2026/02/AVANCE-3-GTFPYPA.pdf); [Swiss Medical manual pacientes](https://www.swissmedical.com.ar/subsitio/laboratorio/pdf/manual_pacientes.pdf)
- Q-nomy (proveedor de gestión de colas, distinto de Qmatic) describe recorridos sanitarios de varios pasos: ingreso de walk-ins, preparación previa a la visita, rutas de atención de varias etapas y pasos administrativos, con reglas de enrutamiento y traspasos entre personal — [Q-nomy Healthcare](https://www.qnomy.com/healthcare)

### Inferences
Taxonomía propuesta para medira.do. Es una síntesis de diseño, no un hallazgo citado.

| Tipo de negocio | Motivos típicos | ¿Profesional? | ¿Mostrador? | ¿Varios pasos? |
|---|---|---|---|---|
| Consultorio médico | Consulta (primera vez / seguimiento), lectura de resultados, certificado médico, receta | Sí | Recepción y caja antes o después | Sí: recepción → (signos vitales) → consulta → caja |
| Clínica de especialidades | Consultas por especialidad, procedimientos menores, curaciones, inyecciones, vacunación | Sí (médico o enfermería) | Admisión, caja, autorización de ARS | Sí |
| Centro estético / spa | Masaje, facial, depilación láser, botox o rellenos (médico) | Sí (terapeuta o médico) + sala o equipo | Recepción y caja | Normalmente de un paso más el cobro |
| Laboratorio clínico | Toma de muestras, entrega de resultados, cotización | Toma: flebotomista. Entrega: no | Recepción, caja, ARS | Sí: recepción → caja/ARS → toma |
| Centro de imágenes | Rayos X, sonografía, tomografía, resonancia, mamografía | Técnico o radiólogo + equipo | Recepción, caja/ARS, entrega de resultados | Sí: preparación (contraste, cambio de ropa) |
| Odontología | Limpieza, evaluación, tratamiento por fases | Sí + sillón | Caja | Planes de tratamiento de varias citas |
| Fisioterapia | Sesiones (a menudo paquetes), evaluación inicial | Sí; a veces un terapeuta con varios pacientes | Caja | Recurrente |
| Vacunación | Aplicación de vacuna | Enfermería | Registro | Corto |
| Farmacia de la clínica | Despacho de receta | Farmacéutico o despachador | Sí | Suele ser el paso final |
| Caja / facturación | Pago, cuadre de cobertura ARS | No | Sí | Paso intermedio o final |
| Autorizaciones de ARS | Validar afiliado y obtener número de autorización | No (personal administrativo) | Sí | Pre-requisito de consulta, laboratorio o imágenes |
| Entrega de resultados / documentos / certificados / información | Retiro físico o consulta | No | Sí | Un paso |

- El modelo de datos necesita, como mínimo:
  - un campo que indique si la atención es **en mostrador** (lo atiende cualquier persona de ese puesto) o **con profesional** (con nombre);
  - **recursos requeridos** (sala o equipo);
  - una **duración** (con agenda) frente a una atención inmediata **por orden de llegada** (walk-in);
  - una **ruta o plantilla de recorrido**, es decir, la secuencia ordenada de etapas.
- En RD, la autorización de ARS es un paso de mostrador que bloquea servicios clínicos cubiertos. Conviene modelarla como etapa del recorrido y no como tipo de visita independiente. Es una inferencia: no encontré documentación de procesos de ARS.

### Gaps
- No encontré fuentes primarias que describan los flujos operativos actuales de ARS en RD (tiempos de autorización, autorización en línea o telefónica, por cada ARS). La búsqueda devolvió solo material irrelevante o de la época COVID.
- No encontré estudios de caso de colas o turnos en clínicas o laboratorios dominicanos (Amadita, Referencia, CEDIMAT, HOMS). Los ejemplos LatAm citados son de Perú y Argentina.
- No encontré datos de mezcla de motivos de visita (porcentaje de visitas no clínicas) en clínicas dominicanas.

## 2. Cómo modelan servicios, recursos, duraciones y enrutamiento los sistemas de colas y agenda

### Takeaway
Las herramientas de agenda (Fresha, Jane, Mindbody, Doctoralia) modelan un **servicio** como tipo de cita con duración, precio, personal elegible y **recursos requeridos** (sala o equipo). Las herramientas de colas (Qmatic, Qminder, Waitwhile, Q-nomy) modelan **líneas o servicios por orden de llegada** y **recorridos** de varias etapas (pre-llegada → check-in → espera → atención → post-atención), con traspasos entre puestos. La reserva solo está disponible si el servicio, el profesional y todos los recursos requeridos están libres a la vez.

### Cited Findings
- **Fresha**:
  - Los recursos son salas, equipos o espacios. Un recurso asignado a un servicio queda bloqueado durante la cita para evitar dobles reservas.
  - Los "resource types" se asignan al servicio en Catálogo > Servicio > Recursos > "Add requirement".
  - Un servicio solo aparece reservable si se presta en esa sede, tiene un miembro del equipo disponible y los recursos requeridos están libres.
  - Si el tipo de recurso no tiene recursos, el requisito se ignora.

  — [Fresha Help: Manage bookable resources](https://www.fresha.com/help-center/knowledge-base/calendar/101215-create-and-manage-resources); [Fresha Help: service availability](https://www.fresha.com/help-center/knowledge-base/catalog/102404-manage-service-availability)
- Fresha Bookable Resources permite que un servicio requiera varios recursos en una misma cita, reservados juntos — [Fresha blog](https://www.fresha.com/blog/fresha-bookable-resources-feature)
- **Jane App**:
  - Los recursos se asignan al tipo de tratamiento en Advanced Scheduling, y el tratamiento solo se reserva si hay suficiente recurso libre (plan Thrive).
  - "Resource Booking" sirve para salas compartidas por orden de llegada. "Rooms" sirve para la sala de un solo profesional o para citas solapadas (quiropráctico o acupuntor con varios pacientes a la vez).
  - Ejemplo de "pools": una visita inicial exclusiva consume el recurso del profesional más una sala, y una cita estándar solo consume sala. Así un profesional atiende a varios pacientes en ciertas visitas.

  — [Jane Guide: Resource booking](https://jane.app/guide/resource-booking); [Jane Guide: putting resources to work](https://jane.app/guide/putting-resources-to-work); [Jane Guide: room booking](https://jane.app/guide/room-booking)
- **Mindbody**:
  - El tiempo de amortiguación (buffer) entre citas se configura alargando la duración de reserva en el tipo de cita, y el cliente no lo ve.
  - Desde octubre de 2024 un tipo de cita puede tener varias opciones de precio.
  - Los add-ons se asocian a tipos de cita.
  - No encontré documentación de un "processing time" separado.

  — [Mindbody scheduling](https://www.mindbodyonline.com/en-gb/business/scheduling); [Mindbody Oct 2024 recap](https://mindbodyonline.com/business/education/blog/october-2024-product-recap)
- **Doctoralia / Docplanner**: los servicios se listan por separado (primera visita frente a sucesiva) con su precio. El profesional debe mantener su disponibilidad actualizada en el software — [Doctoralia.es perfil](https://www.doctoralia.es/jaime-arca-delgado/psicologo/pontevedra); [Doctoralia.cl términos](https://www.doctoralia.cl/ecommerce-terms)
- **Qmatic Orchestra**: el recorrido se divide en etapas pre-servicio, check-in, espera, servicio y post-servicio, con vías física y virtual — [G-Cloud service definition](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/720711/443153374376503-service-definition-document-2026-01-29-1009.pdf)
- **Qmatic Patient Flow**:
  - Gestiona el flujo "desde pre-llegada, llegada y tratamiento hasta post-tratamiento" en una plataforma.
  - Incluye reserva online, recordatorios, auto check-in por QR o enlace, y Mobile Ticket o SMS para esperar fuera.
  - Ofrece integración con el HIS y un "AI Live Dashboard" de colas, esperas y desempeño con pronóstico de personal.

  — [Qmatic Patient Flow Management](https://qmatic.com/solutions/patient-flow-management-system)
- Qmatic lanzó un paquete sanitario con middleware HL7 que conecta Orchestra 7 con sistemas de información hospitalaria — [Qmatic blog archive](https://www.qmatic.com/blog/archive/2014/02)
- **Q-nomy**: los recorridos de varios pasos secuencian etapas, aplican reglas condicionales y enrutan juntos front-office y back-office — [Q-nomy Journey Solutions](https://www.qnomy.com/solutions/)
- **Waitwhile** distingue el origen de la visita: booking (cita), waitlist (por orden de llegada), waitlisted booking (cita que entra en cola al llegar), direct-to-served y direct-to-completed. Los estados son booked → waiting → serving → completed, con cancelled, no-show o removed en cualquier estado — [Waitwhile Metrics guide](https://help.waitwhile.com/en/articles/9235583-metrics-guide-and-glossary)
- **Qminder** organiza la atención por "service lines" (líneas de servicio) por ubicación, y permite filtrar por línea, por empleado y por estado del visitante (en espera, atendido, no-show) — [Qminder analytics](https://www.qminder.com/features/analytics/); [Qminder Help: location performance](https://help.qminder.com/location-performance-in-data-insights)
- **NextGen Room Tracker**:
  - Las salas tienen estados con color.
  - Una sala sin paciente solo puede estar en "Empty – Ready for Patient" o "Empty – Needs Cleaning".
  - Hacer el checkout del paciente no libera la sala, hay que cambiar el estado a Empty.
  - Los estados del paciente son new, checked in y checked out.

  — [NextGen Room Tracker](https://www.community.nextgen.com/mtknowledge/articles/Knowledge/Room-Tracker); [NextGen Patient Tracker](https://www.community.nextgen.com/mtknowledge/articles/Knowledge/Patient-Tracker)

### Inferences
- Modelo recomendado para medira.do:
  - **ServiceType**: nombre, categoría (clínico / estético / diagnóstico / administrativo), modo (con agenda, walk-in o ambos), duración por defecto, buffer, ¿requiere profesional?, roles elegibles, tipos de recurso requeridos, precio o cobertura ARS, y si requiere autorización.
  - **ServicePoint / Station**: consultorio, cabina, sillón, ventanilla de caja, ventanilla ARS, área de toma de muestras, equipo de imagen.
  - **JourneyTemplate**: lista ordenada de etapas por tipo de servicio.
  - **Visit/Ticket**: lleva la etapa actual y una marca de tiempo por cada transición.
- La distinción de Waitwhile entre cita y walk-in, con la "cita que entra en cola al llegar", encaja bien con el consultorio dominicano, donde suelen mezclarse citas con orden de llegada. Esto es una inferencia: no tengo fuentes de RD que lo midan.
- La regla de Fresha ("reservable solo si profesional y recursos están libres") y la de NextGen ("la sala no se libera con el checkout, requiere limpieza") son reglas de negocio directamente reutilizables para cabinas de láser y consultorios.

### Gaps
- No pude leer la documentación técnica de Qmatic sobre reglas de transferencia entre puntos de servicio (la página pública no las detalla).
- No conseguí la documentación del producto de TeleTracking ni de los tableros de Cerner/Oracle Health.
- Las duraciones típicas por servicio estético (láser, facial, masaje) no se confirmaron en fuentes. No las incluyo.

## 3. Tableros en tiempo real de flujo de pacientes: KPIs, visualizaciones, alertas y comparaciones

### Takeaway
Los tableros operativos reales combinan cuatro elementos:
- un **tablero en vivo por etapa o sala**, con tarjetas que muestran el tiempo transcurrido;
- **KPIs instantáneos**: en sala, espera actual, promedio y máxima, atendidos y no-shows;
- **desglose por hora del día**;
- **métricas derivadas de marcas de tiempo por etapa**: espera por etapa, tiempo total en clínica o cycle time, y utilización de salas.

Las definiciones de "tiempo de espera" varían mucho, así que hay que fijarlas explícitamente.

### Cited Findings
- **Waitwhile**: glosario de métricas.
  - Avg/Max/Min wait duration: de entrar en cola a inicio de atención, excluye citas y visitas no atendidas.
  - Avg serve duration: de inicio de atención a completado.
  - Avg total duration: espera más atención.
  - Alert-to-serve: del primer aviso al paciente al inicio de atención.
  - Avg wait estimation error: diferencia absoluta entre la espera estimada y la real.
  - Dropoff rate: (canceladas + removidas + no-show) / total.
  - Cancel rate y no-show rate.
  - Average/max line length: posición inicial en la cola.
  - Serve rate: atendidos / registrados.
  - Tiempos de llegada a atención según la etiqueta del paciente: llegó, confirmado o retrasado.
  - Order value por visita.
  - Cada métrica tiene versión por "Hour of Day".

  — [Waitwhile Metrics guide and glossary](https://help.waitwhile.com/en/articles/9235583-metrics-guide-and-glossary)
- Waitwhile: los gráficos muestran por defecto el total diario y pueden cambiar a "Hour of Day", que promedia cada métrica por hora en el rango elegido. La pestaña Overview muestra citas, en cola, atendidos, espera promedio junto con la espera más larga, tasa de abandono y mensajes. "Stats" es la vista en tiempo real por sede. El plan gratuito no tiene Analytics — [Waitwhile: analytics charts](https://help.waitwhile.com/en/articles/8112248-understanding-the-analytics-charts); [Waitwhile: analytics overview](https://help.waitwhile.com/en/articles/9250541-analytics-overview); [Waitwhile Stats](https://help.waitwhile.com/en/articles/9357435-stats)
- **Qminder**:
  - La app muestra en tiempo real el número de visitantes y la espera y atención promedio por sede, con filtros por sede, periodo, empleado, línea y estado.
  - Añadió "Total Time" en la vista de servicio: tiempo desde el check-in, que suma espera y atención.
  - Tiene informes de volumen, no-show y horas pico, y una vista por empleado con número de visitantes y tiempo medio de atención.

  — [Qminder analytics](https://www.qminder.com/features/analytics/); [Qminder Total Time](https://www.qminder.com/blog/company-news/total-time-qminder-update/); [Qminder Help: location performance](https://support.qminder.com/en/articles/614498-location-performance); [Qminder service dashboard](https://www.qminder.com/features/service-dashboard/)
- **Ambulatorio (artículo ACHE Wisconsin, patrocinado por el proveedor FlowOne)**:
  - Propone una cuadrícula con salas en filas y etapas en columnas. Ejemplos de etapas: roomed, MA complete, imaging complete, ready for provider.
  - Recomienda mostrar quién es responsable de la siguiente acción y registrar una marca de tiempo en cada cambio de estado.
  - KPIs propuestos: espera por etapa, demoras en traspasos, utilización y rotación de salas, salidas a tiempo frente a horas extra, duración de cita por tipo de paciente y tiempo cara a cara con el médico.
  - Alertas opcionales por espera prolongada, con umbral definido localmente.
  - El médico puede reordenar pacientes (por ejemplo ver primero al que más espera).
  - Reporta +25% de satisfacción en una clínica ortopédica. Es un dato del proveedor, no verificado.

  — [ACHE Wisconsin: Making the Invisible Visible in Ambulatory Care](https://wisconsin.ache.org/news/making-the-invisible-visible-in-ambulatory-care-real-time-tracking)
- Epic (ambulatorio) registra marcas de tiempo como ARVL_LIST_REMOVE_DTTM, FIRST_ROOM_ASSIGN_DTTM y ROOMED_DTTM para medir la salida de la sala de espera. La fuente es material de estudio no oficial — [Brainscape Clinic Visits](https://brainscape.com/flashcards/clinic-visits-14279663/packs/21633676)
- En una clínica de atención primaria, enfermeras y médicos cambian el color de un "punto" para indicar el estado del paciente. Es la versión analógica del tablero de estados — [Tesis UVA](https://libraetd.lib.virginia.edu/downloads/f1881m93b)
- Digitail Flowboard mueve la tarjeta a la columna "Checked In" y empieza a mostrar el tiempo de espera transcurrido. Synctimes agrupa a los pacientes con check-in por profesional — [Digitail Flowboard](https://help.digitail.io/en/articles/16101384-the-flowboard-update-early-access); [Synctimes flowstations](https://help.synctimes.com/user-guide/how-tos/flowstations)
- OpenEMR incluye un "Patient Flow Board" de código abierto con estados de cita y tiempos, útil como referencia — [OpenEMR Patient Flow Board](https://www.open-emr.org/wiki/index.php/Patient_Flow_Board)
- **Epic ED Track Board**:
  - El censo o "whiteboard" es el punto central de acceso a la información operativa y clínica.
  - Desde la versión de febrero de 2019 muchos centros permiten a los médicos personalizar las columnas por vista.
  - Un proyecto de la Universidad de Utah redujo columnas y permitió personalizarlas.
  - Los tableros pueden configurarse interactivos o de solo lectura.

  — [ACEP: things you can do on your own Epic](https://acep.org/administration/quality/health-information-technology/epic-articles/things-you-can-do-on-your-own-epic); [Utah: Reengineering the ED Track Board](https://collections.lib.utah.edu/ark:/87278/s6w717he); [TruBridge Tracking Board](https://hostedhelp.cpsi.com/TruBridge/TrackingBoardEDIS/usage.html); [PMC: ED whiteboard](https://pmc.ncbi.nlm.nih.gov/articles/PMC2274795)
- **Emergencias (ED)**: puerta-médico (CMS OP-20) es el intervalo de llegada a primera evaluación por un profesional cualificado. LWBS (OP-22) son los pacientes que se van antes de ser evaluados. Se recomienda mostrar la espera actual (actualizada cada pocos minutos) junto con tendencias de 24 h, semanal o mensual — [Klipfolio ER wait time](https://www.klipfolio.com/kpis/healthcare/er-wait-times)
- LWBS se considera el indicador más difícil de manipular, mientras que puerta-médico puede maquillarse. Las comparaciones entre departamentos engañan si no se ajustan por agudeza — [Becker's / TeamHealth](https://www.beckershospitalreview.com/care-coordination/the-quiet-gaps-in-ed-performance-data-and-what-execs-can-do-about-them/)
- La admisión con médico en el triaje redujo la espera llegada-médico en 25 min de media y la estancia en emergencias en 36 min, con LWBS del 1.2% — [PMC6863656](https://pmc.ncbi.nlm.nih.gov/articles/PMC6863656)
- **IHI cycle time**: minutos desde la llegada hasta la salida en la visita ambulatoria, para separar el tiempo productivo de la espera. TNA (tercera cita disponible) mide la demora para conseguir cita, y cycle time mide la demora durante la cita — [NAM: Best Practices in Health Care Scheduling](https://nam.edu/perspectives-2015-innovation-and-best-practices-in-health-care-scheduling/); [AAFP FPM 2002](https://www.aafp.org/fpm/2002/0600/p45.html)
- Ejemplo de meta: un proyecto de atención primaria buscó un cycle time de 60 min o menos desde una línea base de 71 min, con la satisfacción con la espera como medida de balance — [PMC7223280 (BMJ Open Quality)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7223280)
- Existen al menos 10 definiciones distintas de "tiempo de espera" en la literatura de operaciones ambulatorias — [PMC7341863](https://pmc.ncbi.nlm.nih.gov/articles/PMC7341863)
- Una patente de tableros en tiempo real describe una actualización del estado del departamento aproximadamente cada 1 a 5 minutos. Es una patente, no un estándar — [USPTO 11257587](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11257587)

### Inferences
Especificación sugerida del tablero "Flujo de pacientes del día". Es una síntesis de las fuentes anteriores.

- **Franja de KPIs en vivo**:
  - Pacientes en sala ahora, total y por etapa.
  - Espera actual: la mayor y la mediana de los que esperan ahora.
  - Espera promedio de hoy.
  - Puerta-profesional promedio de hoy, es decir llegada → inicio de la atención con profesional.
  - Tiempo total en clínica (cycle time) promedio de hoy.
  - Atendidos hoy y por hora.
  - No-shows de hoy (citas sin check-in pasada una tolerancia).
  - Abandonos (con check-in pero sin atender).
  - Error de estimación de espera, si se ofrecen estimaciones (Waitwhile).
- **Tablero en vivo** tipo kanban con columnas por etapa: agendado / llegó / en espera / en atención / pendiente de caja o resultados / completado. Alternativa: una cuadrícula consultorio × etapa (ACHE). Cada tarjeta lleva el tiempo transcurrido en la etapa con semáforo de color, el servicio, el profesional o puesto y el responsable de la siguiente acción.
- **Ocupación por consultorio o profesional**: estado de sala ocupada / libre / en limpieza (NextGen), pacientes atendidos y tiempo medio de atención por profesional (Qminder).
- **Mapa de calor por hora** (llegadas, espera promedio, abandonos), inspirado en el "Hour of Day" de Waitwhile. Comparar con el promedio del mismo día de la semana y con ayer. Es inferencia: no encontré una fuente que documente explícitamente "vs ayer" en estos productos.
- **Cuellos de botella**: la espera promedio por etapa resalta la etapa con mayor espera (caja, ARS o consulta).
- **Alertas**: espera mayor de X minutos por servicio, configurable. Ninguna fuente da un umbral estándar. Los umbrales se definen localmente según ACHE.
- Para hospitales con emergencias, añadir puerta-médico, LWBS y estancia, con mediana y percentil 90, no solo promedios (recomendación del resumen de Becker's/Klipfolio).
- Todas las métricas se derivan de marcas de tiempo por transición de etapa. Por eso el requisito técnico central es registrar el evento con hora en cada cambio de estado.

### Gaps
- No obtuve documentación primaria de TeleTracking, Qmatic AI Live Dashboard ni Cerner FirstNet con capturas o listas de KPIs. Lo dicho sobre Qmatic proviene de su página de producto.
- No encontré fuentes que documenten visualizaciones Sankey o embudo del recorrido del paciente en productos comerciales. Son posibles, pero no tienen respaldo.
- No hay benchmarks de espera publicados para República Dominicana o el Caribe.

## 4. Privacidad: nombres de pacientes en tableros internos frente a pantallas públicas

### Takeaway
Para EE. UU., HHS permite llamar a pacientes por nombre y usar hojas de registro si la información se limita (sin motivo de consulta) y hay salvaguardas razonables. En RD, la Ley 172-13 trata los datos de salud como datos sensibles con protección reforzada. Práctica recomendada:
- Las **pantallas públicas** muestran solo número de turno o un identificador abreviado y el puesto.
- Los **tableros internos** autenticados pueden mostrar el nombre.
- El **motivo o servicio clínico** nunca aparece en pantalla pública.

### Cited Findings
- HHS (HIPAA): los prestadores pueden usar hojas de registro o llamar a los pacientes por nombre en la sala de espera "siempre que la información divulgada esté adecuadamente limitada". Que otros oigan el nombre es una divulgación incidental permitida si hay salvaguardas razonables y se aplica el mínimo necesario — [HHS FAQ sign-in sheets](https://www.hhs.gov/hipaa/for-professionals/faq/may-health-care-providers-use-sign-in-sheets/index.html); [HHS Incidental uses and disclosures](https://www.hhs.gov/hipaa/for-professionals/faq/incidental-uses-and-disclosures/index.html)
- La hoja de registro no debe mostrar información médica innecesaria, como el motivo de la visita. Puede incluir nombre, hora de llegada y profesional — [HHS FAQ archivada](https://webarchive.library.unt.edu/eot2008/20080925132021/http://www.hhs.gov/hipaafaq/providers/smaller/199.html); [AAFP FPM 2018](https://www.aafp.org/pubs/fpm/issues/2018/0300/p12.html)
- HHS tiene una FAQ específica sobre si se pueden poner nombres de pacientes fuera de las habitaciones o en tableros. La página devolvió 403 y no pude verificar el texto — [HHS FAQ post names](https://www.hhs.gov/hipaa/for-professionals/faq/may-health-care-providers-post-names/index.html)
- RD, Ley 172-13 (Gaceta Oficial 10737, 15 dic 2013): define los datos de salud (art. 6) y exige consentimiento para tratar datos sensibles (art. 76). Los centros de salud pueden tratarlos conforme a la legislación sanitaria respetando el secreto profesional. Fuentes secundarias, conviene verificar el texto oficial — [DataGuidance DR overview](https://www.DataGuidance.com/notes/dominican-republic-data-protection-overview); [PH Law: Ley 172-13](https://phlaw.com/es/ley-172-13-sobre-proteccion-de-datos-personales/); [PwC texto Ley 172-13](https://pwc.com/ia/es/servicios/Regulacion-Legal/RD-Ley-172-13%20.pdf)
- Los tableros de seguimiento pueden configurarse de solo lectura o interactivos, lo que permite separar las vistas de visualización de las de trabajo — [TruBridge Tracking Board](https://hostedhelp.cpsi.com/TruBridge/TrackingBoardEDIS/usage.html)
- Qmatic y Q-nomy usan ticket móvil o SMS para que el paciente espere fuera y reciba el aviso de turno sin mostrar su nombre en una pantalla — [Qmatic Patient Flow](https://qmatic.com/solutions/patient-flow-management-system)
- El artículo de ACHE afirma que su tablero es "HIPAA compliant by design" sin detallar salvaguardas, y recomienda revisar las prácticas de visualización en pasillos con el equipo de cumplimiento — [ACHE Wisconsin](https://wisconsin.ache.org/news/making-the-invisible-visible-in-ambulatory-care-real-time-tracking)

### Inferences
Diseño propuesto para medira.do:
- **Pantalla pública (TV de sala de espera)**: código de turno (p. ej. "C-014"), nombre del puesto ("Consultorio 3", "Caja 1") y, como opción configurable, el nombre abreviado (nombre de pila e inicial del apellido). Nunca el motivo, el servicio clínico, la especialidad sensible (psiquiatría, VIH, ginecología) ni la cédula.
- **Tablero del administrador o del personal**: requiere inicio de sesión y control por rol. Puede mostrar el nombre completo y el servicio. El detalle clínico queda en el expediente, no en el tablero.
- Usar el mínimo necesario incluso internamente: por ejemplo, la recepción no necesita ver el diagnóstico.
- Aviso por WhatsApp o SMS como alternativa a llamar por nombre. Es inferencia de diseño: WhatsApp es el canal dominante en RD, pero no tengo una fuente citada en esta investigación.

### Gaps
- No encontré una guía o resolución dominicana específica (MISPAS, SISALRIL, o la Ley 42-01 de Salud) sobre mostrar nombres de pacientes en pantallas o llamarlos en voz alta.
- No pude acceder al texto de la FAQ de HHS sobre nombres en tableros (error 403).
- No sé si hay reformas de la Ley 172-13 aprobadas a 2026. Hay proyectos de modificación en el Senado (p. ej. 2021, n.º 00486) sin confirmación de aprobación — [Senado RD proyecto 00486](https://memoriahistorica.senadord.gob.do/items/8703a0e9-823a-475a-8e20-b863e0db8b3c/full)
