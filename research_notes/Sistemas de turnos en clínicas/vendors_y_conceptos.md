# Sistemas de gestión de turnos (queue management) en salud: vendors, conceptos, flujos y configuración

Notas de investigación (nov-2026) para especificar un sistema de turnos dentro de medira.do (EMR SaaS para clínicas en República Dominicana). Todas las afirmaciones van con fuente. Gran parte de la evidencia viene de marketing o documentación de los propios vendors; se indica cuando aplica.

## 1. ¿Qué productos lideran a nivel global y en LatAm, y cuáles son sus módulos principales?

### Takeaway
El mercado se divide en (a) plataformas enterprise on-premise/híbridas con hardware propio e integración HL7 al HIS (Qmatic Orchestra, Q-Flow de Q-nomy/ACF, Wavetec Spectra) y (b) SaaS en la nube, basados en tablet/TV y fáciles de autoservir (Qminder, Waitwhile, QLess, Qtip, QueuePad, Timeacle). En LatAm aparecen FluyApp (que se presenta como líder regional), ACF Technologies (que revende Q-Flow en México, El Salvador y Colombia), TurnosPR (Puerto Rico) y una larga cola de "digiturnos" locales. No encontré un vendor dominicano especializado en turnos para clínicas privadas.

### Cited Findings
**Enterprise / salud**
- **Qmatic Orchestra 7**: se posiciona como gestión del recorrido del paciente (*patient journey*). Su oferta de salud cubre tres flujos: pre-llegada, llegada y atención (*pre-arrival, arrival, serving*). Maneja citas, pacientes sin cita (*walk-ins*) y urgencias desde la llegada hasta el alta. — [Qmatic, new healthcare offering](https://www.qmatic.com/qmatic-insights/qmatic-releases-new-healthcare-offering)
- Qmatic: el módulo central de salud es un **middleware HL7** que conecta Orchestra 7 con el HIS. Sincroniza en tiempo real los datos de citas y pacientes, y permite llamar y redirigir pacientes mediante mensajes HL7. — [Qmatic HL7 interface](https://www.qmatic.com/qstore/hl7-interface); [Qmatic offering](https://www.qmatic.com/qmatic-insights/qmatic-releases-new-healthcare-offering)
- Módulos de Orchestra 7: reserva de citas online, tickets móviles, encuestas de satisfacción y BI/estadísticas. — [Qmatic offering](https://www.qmatic.com/qmatic-insights/qmatic-releases-new-healthcare-offering)
- Orchestra es la opción **on-premise** de Qmatic, "optimizada para organizaciones de salud que requieren control local total". — [Qmatic Patient Flow](https://www.qmatic.com/solutions/patient-flow-management-system) (vía resumen de búsqueda)
- Caso en español: el Hospital Universitari Mútua Terrassa usa Qmatic en Consultas Externas. El paciente lee su tarjeta sanitaria o el código de barras de su hoja de citación en un kiosco, que lo dirige a su consulta. El sistema resuelve cerca del 90% de las gestiones sin mostrador. — [CIO España](https://www.cio.com/article/2089037/el-hospital-universitari-mutua-terrassa-mejora-su-sistema-asistencial-gracias-a-qmatic.html)
- **Wavetec**: su plataforma enterprise **Spectra QMS** se acompaña de Cloud Appointment, Mobile-Q, WhatsApp Queuing, señalización digital Donatello, encuestas Opinion Plus, kioscos de autoservicio y analítica con IA. — [Wavetec, Villa Betania](https://www.wavetec.com/?p=86178)
- Caso Wavetec en la clínica Villa Betania (Roma): kiosco M-13, señalización Donatello, cola por WhatsApp en 3 idiomas y tableros Spectra. — [Wavetec](https://www.wavetec.com/?p=86178)
- **Q-Flow (Q-nomy; ACF Technologies como partner)** es una solución de servidor central que da a clínicas y departamentos recepción, cola, enrutamiento y gestión de la interacción, con agendamiento de citas opcional. — [Microsoft AppSource Q-Flow Patient Journey](https://appsource.microsoft.com/en-za/product/saas/q-nomy-4882971.qflowpatientjoureny) (vía resumen)
- ACF Technologies tiene oficinas en Ciudad de México, San Salvador y Bogotá. Su caso FUDEM (fundación oftalmológica de El Salvador) combinó Q-Flow con la herramienta clínica Viewmed: citas por call center, expediente centralizado y control de llegada. — [Q-nomy FUDEM](https://www.qnomy.com/case-studies/fudem-ophthalmology-foundation); [casestudies.com](https://www.casestudies.com/company/acf-technologies/case-study/fudem-customer-case-study)
- Qnomy: gestión de tareas de front y back office, enrutamiento por habilidades (*skill-based routing*), flujos personalizados y agendamiento multiservicio. Canales: kiosco, app, lobby virtual, video y chat. — [Qminder, listado de 20+ vendors](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/) (fuente de un competidor)

**SaaS en la nube**
- **Qminder**: tablero de citas y check-in compartido, alertas en tiempo real, reportes de espera, multi-sede e integración con EHR/CRM. Es HIPAA-ready con BAA. Canales: kiosco iPad, TV Apple TV y SMS. — [Qminder pricing](https://qminder.com/pricing); [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- **Waitwhile**: lista de espera + reservas, pantalla de TV, kiosco, constructor de flujos (*flow builder*), multi-idioma, SMS bidireccional y estimación de espera con IA (*WaitIQ*). — [Waitwhile pricing](https://waitwhile.com/pricing/)
- **QLess**: mensajería bidireccional, *callback queuing*, estimación predictiva de espera, cierre automático de la cola y sala de espera virtual. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- **Qtrac**: re-enrutamiento de la cola, alertas por umbral, modo "greeter" (recepcionista que registra en la entrada), modo offline y tablero multi-sede. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- **VirtuaQ**: colas multi-paso agrupadas (*pooled multi-step queues*), enrutamiento de prioridad/VIP e integración con HIS y señalización. **Leyline**: seguimiento del recorrido con un solo ticket. **Timeacle**: tickets multi-departamento. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)

**LatAm / hispanohablante**
- **FluyApp** se presenta como "#1 Queue Management Platform in LATAM", con presencia en 6 países y 99.5% de uptime garantizado. Incluye un agente de WhatsApp que confirma citas indicando la sucursal y un panel por sucursal (tickets, espera, atención, satisfacción). — [FluyApp](https://fluyapp.com/en) (vía resumen de búsqueda; marketing)
- **TurnosPR** (Puerto Rico): para hospital, laboratorio y consultorio; múltiples filas, servicios, alertas y prioridades. — [TurnosPR salud](https://w2.turnospr.com/en/salud/) (vía resumen; la página devolvió 403 al hacer fetch)
- **Netux "Mi Turno"** (Colombia): gestión de turnos para hospitales con reportes de tiempos de atención y turnos atendidos por día. — [Brochure Netux en ConnectAmericas](https://connectamericas.com/sites/default/files/company_files/Brochure%20Soluciones%20de%20Salud%20NX.pdf)
- En Colombia, "digiturno" funciona como término genérico. Hay implementaciones distintas: una PWA de pacientes (SYAC), el Ejército ("Digiturno Medicina Laboral") y un piloto en Cali llamado "SaluBot". — [SYAC boletín](https://syac.net.co/wp-content/uploads/2023/12/Boletin-Mayo-2023-DGH.pdf); [Alcaldía de Cali](https://www.cali.gov.co/publicaciones/180916/secretaria-de-salud-de-cali-pone-en-funcionamiento-una-herramienta-digital-para-el-agendamiento-de-citas-medicas-en-las-estaciones-del-mio/)
- **Clinsis** (sistema de laboratorio clínico/hospitalario): incluye un kiosco táctil donde el cliente elige el tipo de atención y el sistema imprime el ticket. Permite definir la prioridad según el tipo de cliente. — [Portafolio Clinsis Labo](https://www.clinsis.com/pdf/PortafolioCLINSISLabo.pdf) (vía resumen)
- Sector público en España: Madrid digitalizó la gestión de turnos en sus 418 centros de Atención Primaria (781 dispensadores, 2,363 pantallas, €4.5M). La Comunitat Valenciana lo hizo en 185 centros (€10.8M). Andalucía usa TurnoSAS. — [Comunidad de Madrid](https://www.comunidad.madrid/node/70558); [Valencia Plaza](https://valenciaplaza.com/valenciaplaza/sanidad-ha-instalado-sistema-digital-gestion-turnos-185-centros-sanitarios)

**República Dominicana**
- El SNS anunció en 2018 un "Sistema de Gestión de Citas Médicas" telefónico para la red pública, que empezaba por los 25 principales hospitales (70% de la demanda), incluido el Robert Reid Cabral. No se nombra al proveedor. — [El Nuevo Diario](https://elnuevodiario.com.do/sns-anuncia-sistema-de-gestion-de-citas-medicas-via-telefonica/); [Diario Libre](https://www.diariolibre.com/actualidad/salud/pacientes-que-asisten-a-hospitales-podran-hacer-citas-medicas-via-telefono-CA12038648)
- Banco Popular Dominicano registra más de 273 mil usos de su sistema de turnos y citas digitales. Es una señal de que el público dominicano ya está familiarizado con el turno digital en banca. — [Diario Libre](https://www.diariolibre.com/economia/banco-popular-registra-mas-de-273-mil-usos-de-turnos-y-citas-digitales-MM29527193)
- "Waitless" se lanzó en 2020 como app dominicana de telesalud con reserva de citas y turnos online. — [En Segundos](https://ensegundos.do/2020/10/28/lanzan-nueva-aplicacion-de-telesalud-de-republica-dominicana)

### Inferences
- En RD, el espacio "turnero integrado al EMR para clínica privada pequeña o mediana" parece poco ocupado. Las alternativas son hardware genérico de turnos (dispensador + pantalla, sin datos clínicos) o vendors enterprise caros. Esto es una oportunidad de diferenciación para medira.do.
- El patrón de los líderes es **cita + llegada/check-in + cola + llamado + pantalla + encuesta + BI** como un solo recorrido. Qminder y Waitwhile venden las citas como add-on o módulo; Qmatic las integra con el HIS vía HL7. Medira, al ser el propio EMR, tiene la integración "gratis".

### Gaps
- No pude verificar con fuente primaria las funcionalidades de **Turnomatic**, **Debitek** ni de un producto comercial llamado **DigiTurno**. Las búsquedas no devolvieron páginas de esos vendors.
- No encontré proveedores dominicanos de turneros (hardware o software) con presencia web indexada. Habría que consultar licitaciones del SNS/DGCP o distribuidores locales.
- No obtuve las cuotas de mercado reales de LatAm; "líder" es autodeclarado por los vendors.

## 2. Conceptos núcleo: servicios, puntos de atención, colas, recorridos multi-paso, numeración, prioridades, citas vs. walk-ins, rellamado/no-show, transferencia, pausa, cierre del día

### Takeaway
El modelo canónico (Qmatic/Qminder) es **Visita (ticket) → Servicio(s) → Cola → Punto de servicio (workstation = terminal + display)**. A eso se suman pools por punto de servicio o por usuario, transferencia entre colas, rellamado y no-show con un **resultado final de la visita** registrado para estadística. Los recorridos multi-paso con un solo ticket (registro → caja → muestras → médico) existen en los vendors enterprise ("one-ticket journey", "multi-step pooled queues").

### Cited Findings
- **Workstation**: en Qmatic Orchestra, un punto de servicio (p. ej. un mostrador) normalmente tiene dos componentes: un **terminal** (hardware o software) y un **display**. — [Guía de usuario Orchestra (espejo Iowa DOT)](https://testpartners.iowadot.gov/help/User's%20Guide/04_01%20callServe.5.5.html) (vía resumen de búsqueda; el servidor rechazó el fetch directo)
- **Pools**: cada punto de servicio tiene conectado un **Service Point Pool**. Las visitas pueden transferirse a una cola, a un pool de punto de servicio o a un pool de usuario (un funcionario específico). — [Orchestra User's Guide](https://testpartners.iowadot.gov/help/User's%20Guide/04_01%20callServe.5.6.html) (vía resumen)
- **Resultados de la visita** (*visit outcomes*) en el BI de Orchestra: incluyen *No show* ("el servicio fue llamado pero el cliente no se presentó"), transferencia a cola y transferencia a pool de punto de servicio. — [Orchestra BI User's Guide](https://testpartners.iowadot.gov/help/Business%20Intelligence%20User's%20Guide/0_BI_User_Guide_A4.1.26.html) (vía resumen; lista completa no verificada)
- **Rellamado (Recall)**: vuelve a anunciar la visita actual en pantallas y audio. Solo aplica a la transacción más reciente y mientras la visita no esté cerrada. — [Orchestra User's Guide](https://testpartners.iowadot.gov/help/User's%20Guide/04_01%20callServe.5.6.html) (vía resumen)
- **No-show**: si tras rellamar el cliente no aparece, se registra como No show y queda en estadística junto a las transacciones completadas. — [Orchestra User's Guide](https://testpartners.iowadot.gov/help/User's%20Guide/04_01%20callServe.5.6.html) (vía resumen)
- Qminder: los marcados como **No Show** se excluyen del cálculo de tiempos de espera y de servicio. Si el visitante aparece después, se usa **"Return to Queue"** para devolverlo a la cola. — [Qminder Help: Mark visitors as No-Show](https://help.qminder.com/mark-visitors-as-no-show); [Qminder Service View](https://help.qminder.com/service-view-guide)
- Qminder: **Forward** permite reenviar al visitante a otra línea o servicio de la misma sede. Es el mecanismo de recorrido multi-paso en Qminder. — [Qminder Help: Forward a visitor](https://help.qminder.com/forward-a-visitor-to-another-service)
- Qminder llama **"service lines"** a las colas y las ofrece ilimitadas en todos los planes. — [Qminder pricing](https://qminder.com/pricing)
- **Recorrido multi-paso con un ticket**: Leyline ofrece "one-ticket journey tracking", VirtuaQ "pooled multi-step queues" con enrutamiento prioridad/VIP y Timeacle "multi-department tickets". — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- Mútua Terrassa (Qmatic): el kiosco asigna el código y muestra **planta, sala de espera y box/médico**. El código aparece luego en el display de la puerta de la consulta. Si hay un problema con la cita, el paciente va al mostrador y recibe un **nuevo número de turno** (cola de incidencias). — [CIO España](https://www.cio.com/article/2089037/el-hospital-universitari-mutua-terrassa-mejora-su-sistema-asistencial-gracias-a-qmatic.html)
- **Citas + walk-ins**: Qmatic maneja citas, walk-ins y urgencias en el mismo flujo. Earlyone anuncia "appointment and walk-in blending". Waitwhile ofrece "synchronized waitlist and bookings" (plan Business). — [Qmatic](https://www.qmatic.com/qmatic-insights/qmatic-releases-new-healthcare-offering); [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/); [Waitwhile pricing](https://waitwhile.com/pricing/)
- Madrid AP: el software se integra con la historia clínica, así que el médico ve en su pantalla qué pacientes con cita ya llegaron. Se da prioridad a los casos en que la situación médica lo amerita. — [Comunidad de Madrid](https://www.comunidad.madrid/node/70558)
- **Prioridades**: Qmatic ofrece "priority routing" y Qwaiting/TurnosPR mencionan prioridades configurables. Clinsis define la prioridad por tipo de cliente. Un turnero LatAm (Yo Facturo) pone un botón de "atención preferencial" en el kiosco y argumenta que la prioridad de embarazadas, adultos mayores y discapacitados no debe depender de que el empleado recuerde revisarla. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/); [Clinsis](https://www.clinsis.com/pdf/PortafolioCLINSISLabo.pdf); [Yo Facturo](https://yo-facturo.com/blog/turnero-digital-sala-de-espera/) (vía resumen)
- **Reinicio diario**: Vizitor anuncia "nightly queue reset" (reinicio nocturno de la numeración y las colas). QLess ofrece "automatic queue closing" (cierre automático de la cola). — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- **Marco legal RD**: la Ley 352-98 de Protección a la Persona Envejeciente (reglamento Decreto 1372-04) es la base de la atención preferencial a adultos mayores. Un columnista la describe como el beneficio "más visible", por los "pases de fila". — [Ley 352-98 (DGJP)](https://www.dgjp.gob.do/wp-content/uploads/2022/05/Ley-Núm.-352-98.pdf); [Acento](https://acento.com.do/opinion/una-ley-quinceanera-210447.html)
- La Ley 5-13 sobre Discapacidad (reglamento Decreto 363-16, ente rector CONADIS) garantiza igualdad de derechos y equiparación de oportunidades a personas con discapacidad. — [Ley 5-13 (drlawyer)](https://drlawyer.com/espanol/wp-content/uploads/2020/06/Ley5-13Discapacidad.pdf); [Decreto 363-16](https://www.dgjp.gob.do/wp-content/uploads/2022/05/Decreto-Núm.-363-16.pdf)

### Inferences
- Modelo de datos sugerido, derivado de Qmatic/Qminder: `Sede → Servicio (prefijo, duración típica, prioridad base) → Cola → PuntoDeServicio (tipo: ventanilla/caja/consultorio/cubículo; servicios que atiende; usuario logueado; estado abierto/pausado/cerrado) → Ticket/Visita (número, servicio actual, recorrido pendiente, prioridad, cita_id opcional, paciente_id opcional) → Eventos (creado, llamado, rellamado, inicio, fin, transferido, no-show, regresado a cola)`. El "resultado de la visita" se guarda explícitamente para KPIs.
- Para clínicas en RD conviene una **prioridad por categorías** (adulto mayor ≥65, embarazada, discapacidad, urgencia) seleccionable en el kiosco o en recepción, con una regla configurable. Por ejemplo: intercalar 1 prioritario cada N normales, o prioritario siempre primero.
- Una cita que llega (check-in) debería entrar en la cola con un peso según su hora de cita. El patrón "el médico ve en su pantalla quién con cita ya llegó" (Madrid) encaja con la agenda existente de medira.
- Las convenciones más usuales de la industria son: numeración con prefijo por servicio (p. ej. "C-012" caja, "L-005" laboratorio), reinicio diario y llamado por código en lugar del nombre (privacidad). La fuente de Madrid/Mútua confirma el llamado por código; el prefijo por servicio no lo confirmó ninguna fuente fetcheada.

### Gaps
- No pude leer el texto del artículo exacto de la Ley 352-98 sobre preferencia en filas (el PDF de CONAPE devolvió error). Tampoco encontré un texto legal dominicano que obligue a dar prioridad a **embarazadas** en filas. Hay que verificarlo con un abogado o en el texto íntegro.
- No encontré documentación pública sobre la **pausa del puesto** (motivos de pausa como almuerzo o reunión) en Qmatic ni en Qminder. Es una funcionalidad común en la industria, pero queda sin cita aquí.
- No verifiqué con fuente las reglas de **"turno recuperado"** (re-ingreso tras no-show con prioridad) de vendors españoles.
- El comportamiento exacto de la numeración por prefijo en Qmatic/Q-Flow no fue verificado con documentación primaria.

## 3. Canales de emisión del ticket y qué muestra el ticket

### Takeaway
Los canales estándar son: kiosco táctil con impresora (a menudo con lectura de cédula o código de barras de la cita), QR que abre un ticket virtual web, SMS, WhatsApp (fuerte en LatAm y Medio Oriente), el recepcionista ("greeter") y el check-in desde una cita. El ticket muestra el código de llamado y el destino (servicio, sala o planta). Los virtuales añaden posición y espera estimada en tiempo real.

### Cited Findings
- Wavetec: un paciente con cita hace check-in en el kiosco, el portal web o por SMS/app (p. ej. WhatsApp) y recibe un ticket **físico o virtual**. También puede escanear un QR que lo redirige al chat de WhatsApp de la institución. — [Wavetec](https://www.wavetec.com/?p=86178) (vía resumen)
- Madrid AP: el paciente inserta su **tarjeta sanitaria** en el dispensador. El ticket impreso muestra el **código** con el que lo llamarán, la **sala de espera**, la **consulta** y la **planta**. Las pantallas llaman con aviso visual y sonoro. — [Comunidad de Madrid](https://www.comunidad.madrid/node/70558)
- Mútua Terrassa: lectura de tarjeta sanitaria o del **código de barras de la hoja de citación**. Los pacientes se ordenan "mediante códigos numéricos, con protección de datos". — [CIO España](https://www.cio.com/article/2089037/el-hospital-universitari-mutua-terrassa-mejora-su-sistema-asistencial-gracias-a-qmatic.html)
- Qminder: kiosco de check-in como **app de iPad**, pantalla de sala de espera como **app de Apple TV** y SMS multilingüe con chat bidireccional. — [Qminder pricing](https://qminder.com/pricing)
- Qminder Appointments add-on: **geofencing**, check-in con un clic y auto check-in, confirmaciones y recordatorios por texto. — [Qminder pricing](https://qminder.com/pricing)
- Vizitor: QR, OTP, tablet y móvil. QueueTix: QR o "location code" sin hardware adicional. QueuePad: llamado por nombre y rellamado con tablet como display. Qtrac: modo "greeter" y modo offline. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- Qwaiting y Wavetec ofrecen WhatsApp como canal. FluyApp tiene un agente de WhatsApp que confirma la cita con la sucursal. Salud Digna (México) atiende por WhatsApp a gran escala. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/); [FluyApp](https://fluyapp.com/en); [Mobile Time](https://mobiletime.la/noticias/31/03/2025/salud-digna-whatsapp/)
- Los recordatorios por WhatsApp en clínicas usan **plantillas aprobadas por Meta**. — [Aurora Inbox](https://www.aurorainbox.com/?p=38985) (vía resumen)
- Madrid y Mútua Terrassa usaron "informadores" de apoyo durante los primeros meses para enseñar a usar los kioscos. — [CIO España](https://www.cio.com/article/2089037/el-hospital-universitari-mutua-terrassa-mejora-su-sistema-asistencial-gracias-a-qmatic.html)

### Inferences
- Para RD, el canal de mayor adopción probable es **WhatsApp** (link o QR al ticket virtual y aviso "su turno se acerca"), seguido de **recepción** (la recepcionista emite el ticket) e impresora térmica. El kiosco de cédula sería un tier superior.
- Contenido mínimo del ticket: nombre de la clínica, **código** (prefijo + número), servicio, hora de emisión, personas delante y espera estimada, sala o piso, y un QR para seguir el turno en el móvil. No debe incluir el nombre completo ni el diagnóstico (privacidad, según el patrón de Madrid/Mútua).

### Gaps
- No encontré documentación de un vendor que lea la **cédula dominicana** en el kiosco.
- No obtuve costos de la API de WhatsApp Business para RD.

## 4. Consola del funcionario y tableros del supervisor

### Takeaway
Las acciones estándar de la consola son: **Llamar siguiente** (que en Qminder cierra implícitamente al anterior), **Finalizar sin llamar**, **Rellamar**, **No se presentó**, **Devolver a cola**, **Transferir/Reenviar** (a cola, a punto de servicio o a un funcionario), **Registrar resultado** y **Eliminar visita**. El supervisor ve en tiempo real cuántos esperan, la espera y la duración de atención por cola y por puesto, y recibe alertas por umbral.

### Cited Findings
- Qminder: **CALL NEXT** marca al visitante actual como atendido y llama al siguiente. **FINISH SERVING** termina sin llamar a otro, para dar tiempo a otras tareas. El menú (⋯) incluye No Show y Forward. — [Qminder Service View guide](https://help.qminder.com/service-view-guide); [Qminder Ending the service](https://support.qminder.com/en/articles/878925-ending-the-service)
- Qmatic Orchestra Connect Agent (app de iPad): llamar y atender, transferir a otras colas o funcionarios, eliminar visitas y **registrar resultados de la visita** para análisis. — [App Store Orchestra Connect Agent](https://apps.apple.com/in/app/orchestra-connect-agent/id1290649637) (vía resumen)
- Qmatic tiene terminales de hardware (KT2595, KT2695) además del terminal de software dentro de Orchestra. — [Orchestra Standard Unit Types Guide](https://testpartners.iowadot.gov/help/Standard%20Unit%20Types%20Guide/23_01%20terminals.4.02.html) (vía resumen)
- La vista de mostrador de Qmatic salud muestra tiempos de espera, tiempos de transacción y número de pacientes esperando, y se opera con pantalla táctil. — [Qmatic offering](https://www.qmatic.com/qmatic-insights/qmatic-releases-new-healthcare-offering)
- Qminder Business incluye reportes de desempeño por staff, sede y servicio, historial de visitantes y "service alerts". Premium agrega reportes organizacionales y vistas cross-location. — [Qminder pricing](https://qminder.com/pricing)
- Qtrac: alertas por umbral y tablero centralizado multi-sede. VirtuaQ: analítica con heatmaps. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- Qminder "Service Analyst" (add-on con IA): preguntas en lenguaje natural sobre visitas, equipos, servicios y sedes; análisis por funcionario; sentimiento del visitante; exportación a Excel/PDF. — [Qminder pricing](https://qminder.com/pricing)

### Inferences
- Consola mínima para medira: [Llamar siguiente] [Rellamar] [No se presentó] [Transferir ▸ servicio/consultorio] [Finalizar] [Pausar/Reanudar con motivo] y un selector del "punto de servicio" en el que el usuario está logueado. Para el médico, la acción "Llamar" puede vivir dentro de la agenda o lista de pacientes del día, que ya existe en el EMR.

### Gaps
- No encontré documentación citable sobre **pausa con motivos** ni sobre el **cierre de día** (qué pasa con los tickets abiertos al cerrar) en Qmatic o Qminder.

## 5. Precios y empaquetado

### Takeaway
Los SaaS publican precios. Qminder cobra por **usuarios** con sedes ilimitadas (desde USD 869/mes; las fuentes se contradicen). Waitwhile cobra por **volumen de visitas** y sedes (Free, luego desde USD 31/mes). Los vendors enterprise (Qmatic, Wavetec, Q-Flow, Qtrac, QLess) son "precio bajo solicitud" y venden hardware aparte. Los turneros pequeños parten de USD 20–80/mes.

### Cited Findings
- **Qminder** (página oficial): Business USD 869/mes o USD 9,468/año, con 25 usuarios. Premium USD 1,149/mes o USD 12,588/año, con 50 usuarios, API, webhooks, SSO y branding. Enterprise es a medida. Todos incluyen sedes, service lines, visitantes y dispositivos ilimitados. El hardware (iPads, Apple TV) se paga aparte. El SMS está incluido solo en EE.UU., UK y Canadá. Appointments y Service Analyst son add-ons a cotizar. — [Qminder pricing](https://qminder.com/pricing)
- Contradicción: un artículo antiguo de soporte de Qminder describe un modelo **por sede** (USD 499/mes por sede), y un resumen de búsqueda mencionaba un "Starter" de USD 389/mes. Domina la página de pricing fetcheada (Business/Premium). — [Qminder support pricing](https://support.qminder.com/en/articles/2308106-pricing); [Qminder pricing](https://qminder.com/pricing)
- **Waitwhile**: Free con 1 sede y 50 visitas/mes. Starter desde USD 31/mes con hasta 10 sedes y 2,500 visitas. Business desde USD 55/mes con 5,000 visitas, roles personalizados, API/webhooks y waitlist+bookings sincronizados. Enterprise con SSO, white-label y report builder. 20% de descuento anual. — [Waitwhile pricing](https://waitwhile.com/pricing/); otro rastreador reporta que Starter subió a USD 39/mes en nov-2026: [FrontDeskReview](https://frontdeskreview.com/software/waitlist-queue-management/waitwhile/)
- Otros precios de entrada: QueuePad desde USD 19.99/mes, Vizitor desde USD 36/mes, Timeacle desde €49.90/mes, Qtip desde €79/mes (con versión gratuita limitada), Leyline desde €80/mes y Nemo-Q desde USD 290/mes. Qmatic, Wavetec, Qtrac, QLess y Qnomy son bajo solicitud. — [Qminder blog](https://www.qminder.com/blog/queue-management/25-plus-best-patient-queueing-software/)
- Referencia de capex público: Madrid invirtió €4.5M para 418 centros, 781 dispensadores y 2,363 pantallas. — [Comunidad de Madrid](https://www.comunidad.madrid/node/70558)

### Inferences
- Los ejes de empaquetado habituales son: número de sedes, de usuarios o puestos, volumen de visitas, canales (el SMS/WhatsApp suele tener costo variable), kiosco/TV/branding, API/SSO y módulos (citas, encuestas, analítica con IA). Para medira encaja un **add-on de turnos** que escale por sede y puestos, con mensajes de WhatsApp medidos como cuota (en línea con los quotas medidos del plan B1 del repo).

### Gaps
- No encontré precios publicados de vendors LatAm (FluyApp, TurnosPR, Netux) ni de distribuidores en RD.

## 6. KPIs típicos

### Takeaway
Los KPIs base son: tiempo de espera (emisión → llamado), tiempo de atención (inicio → fin), número en espera, volumen atendido, tasa de no-show y de abandono (walk-away), utilización del funcionario y satisfacción. Se cortan por servicio, funcionario, punto, sede, hora del día y día.

### Cited Findings
- Espera promedio = tiempo total de espera ÷ clientes atendidos. Ejemplo: 300 min entre 60 personas = 5 min. — [Qminder blog, retail dashboard metrics](https://www.qminder.com/blog/retail-service-dashboard-performance-metrics/)
- Tiempo de servicio = suma de duraciones ÷ clientes atendidos, desglosado por funcionario, tipo de servicio, hora y sede. Por funcionario = minutos de servicio ÷ clientes atendidos por él. — [Qminder blog](https://www.qminder.com/blog/retail-service-dashboard-performance-metrics/); [Qminder ROI of queue analytics](https://www.qminder.com/blog/roi-of-queue-analytics/)
- Qminder lista la "Customer Walk-Away Rate" como métrica (la fórmula no se obtuvo). — [Qminder ROI](https://www.qminder.com/blog/roi-of-queue-analytics/)
- Utilización del staff = % del tiempo atendiendo frente a esperando clientes. — [Wavetec, queue management analytics](https://www.wavetec.com/blog/queue-management/queue-management-analytics/)
- Tasa de abandono (definición de contact center, aplicable por analogía) = abandonados ÷ (abandonados + atendidos) × 100. — [ServiceTitan docs](https://help.servicetitan.com/commercial/docs/understand-queue-performance-report-results-in-contact-center-pro)
- Qminder excluye los no-show de los promedios de espera y servicio. — [Qminder Help](https://help.qminder.com/mark-visitors-as-no-show)
- Qmatic registra los no-show en la estadística junto a las transacciones completadas. — [Orchestra User's Guide](https://testpartners.iowadot.gov/help/User's%20Guide/04_01%20callServe.5.6.html) (vía resumen)
- Netux "Mi Turno" reporta tiempos de atención y turnos atendidos por día. FluyApp reporta tickets, espera, atención y satisfacción por sucursal. — [Netux](https://connectamericas.com/sites/default/files/company_files/Brochure%20Soluciones%20de%20Salud%20NX.pdf); [FluyApp](https://fluyapp.com/en)
- Wavetec usa datos históricos y en tiempo real para pronosticar la demanda. — [Wavetec](https://www.wavetec.com/?p=86178)

### Inferences
- KPI set recomendado para medira: espera promedio y p90 por servicio; atención promedio por servicio y por médico/funcionario; tickets emitidos/atendidos/no-show/abandonados por día; % atendidos dentro de un objetivo (p. ej. <15 min); tiempo total en clínica (primer ticket → último fin, en recorridos multi-paso); llegada vs. hora de cita (puntualidad); distribución por hora (para dotación de personal). Para que sean válidos, el modelo de eventos debe guardar timestamps de emitido, llamado, inicio, fin y transferido.

### Gaps
- No encontré benchmarks publicados de espera en clínicas privadas de RD ni de LatAm.
