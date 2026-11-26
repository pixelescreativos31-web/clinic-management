# Pantalla de llamado de turnos y anuncio por voz (TV de sala de espera) para un SaaS web

Fecha de investigación: noviembre 2026. Contexto: clínicas en República Dominicana, app Next.js mostrada en TV / mini‑PC / Android TV / Fire TV.

## 1. Qué muestran las pantallas profesionales (layout, privacidad, multi‑pantalla, legibilidad, flash visual)

### Takeaway
El patrón de la industria es: turno actual grande ("A‑014 → Mostrador 3"), columnas paralelas por cola/servicio con color, número de personas esperando, y zona de media/publicidad en los momentos de poca actividad; la configuración es por pantalla (qué colas y qué datos muestra). La práctica segura en salud es mostrar código/número (o iniciales), nunca motivo de consulta.

### Cited Findings
- YoFacturo (turnero LatAm): la pantalla pública muestra por cada cola el número en atención y el mostrador asignado (ej. "A‑014 → Mostrador 3"), cuántas personas quedan esperando por cola, colas múltiples en columnas paralelas con color propio; puede pasar publicidad en momentos de poca actividad; se empareja con un **código de 6 dígitos** (el mismo sistema que su cartelería digital) y corre en Smart TV o navegador — [YoFacturo, turnero digital sala de espera](https://yo-facturo.com/blog/turnero-digital-sala-de-espera/)
- YoFacturo: numeración correlativa con prefijo por cola ("A‑014"); ticket impreso o solo en pantalla a elección; impresora de tickets opcional; recomienda separar atenciones rápidas y largas en colas paralelas y marcar atención preferencial al sacar turno — [YoFacturo](https://yo-facturo.com/blog/turnero-digital-sala-de-espera/)
- YoFacturo: en un consultorio con un solo profesional y pocos pacientes/hora "alcanza con llamar de viva voz"; la pantalla puede ser TV/monitor + Smart TV, Chromecast o mini PC — [YoFacturo, hardware para consultorio](https://yo-facturo.com/blog/hardware-para-veterinaria-y-consultorio/)
- Pantalla del operador (vendor LatAm): muestra próximos turnos, botón llamar siguiente, atender, finalizar, **rellamar**, **marcar ausente** — resultado de búsqueda sobre [aturnos.com](https://aturnos.com/retail-management)
- Catálogo de sistema hospitalario (NX/Ibernex): "Notificación Pop up de tipo audible y visual. Llamado de turno por voz" — [Brochure Soluciones de Salud NX](https://connectamericas.com/sites/default/files/company_files/Brochure%20Soluciones%20de%20Salud%20NX.pdf)
- Caso clínica en Taiwán (CAYIN): una pantalla compartida entre dos consultas, con actualizaciones casi sincronizadas con los avisos de voz — [CAYIN case study](https://cayintech.com/es/download/case_studies/jbclinic_taiwan.pdf)
- Qminder: cada TV se configura por separado (qué nombres y líneas son visibles, qué aparece en la notificación al visitante, cuándo se limpian los tickets); tiene vista de notificación que muestra la línea cuando se llama a alguien; usa señales visuales y de audio; corre como app de Apple TV; incluido en todos los planes — [Qminder help/settings](https://support.qminder.com/en/articles/3672049-qminder-tv-app-settings); [Qminder waiting room TV](https://www.qminder.com/features/waiting-room-tv/)
- Qmatic Display: app Android de media player que entrega media, gráficos, estado de cola y anuncios de voz — [Qmatic voice announcements](https://www.qmatic.com/products/voice-announcements)
- Privacidad (HHS/HIPAA, referencia de buena práctica, no ley dominicana): se permite llamar nombres en sala de espera como divulgación incidental si hay salvaguardas razonables y "mínimo necesario"; hojas de registro aceptables si solo listan nombres y no el motivo médico; no se exigen cambios estructurales — [HHS FAQ incidental disclosures](https://www.hhs.gov/hipaa/for-professionals/faq/incidental-uses-and-disclosures/index.html); [OSU HIPAA](https://u.osu.edu/hipaa/?p=47)
- Legibilidad: regla general **1 pulgada de altura de letra por cada 10 pies** (~2,5 cm por 3 m), mínimo 3" para info importante (WMU); Daktronics usa 1"/25 pies (más laxa); el contraste importa tanto como el tamaño; mensajes breves (regla "3x5") — [WMU digital signage](https://wmich.edu/digital-accessibility/creating-accessible-content/digital-signage); [Daktronics KB](https://www.daktronics.com/en-us/support/kb/000030569); [Brown best practices](https://ithelp.brown.edu/custom-images/files/Brown_BestPractices_Final_7.22.15%20%20.pdf)

### Inferences
- Para 3–5 m (10–16 pies) con la regla conservadora: texto secundario (últimos llamados, columnas) ≥ 2,5–4 cm de altura de mayúscula; turno actual mucho mayor (≥ 10–15 cm). En una TV de 43" (≈ 53 cm de alto útil en 16:9) esto implica ~5–8 % de la altura de pantalla para texto secundario y ~20–30 % para el turno actual — usar `vh`/`clamp()` en CSS, no px.
- Layout recomendado: banda superior (logo clínica + reloj/fecha), bloque "LLAMANDO AHORA" grande (turno + consultorio), lista de últimos 4–6 llamados, opcional columnas por servicio/médico con "en espera: N", zona de media/mensajes de salud, ticker inferior. Durante un llamado, el bloque principal hace **flash/parpadeo de alto contraste por 3–5 s** (cubre a personas con hipoacusia; sin pasar de 3 destellos/segundo para evitar riesgo fotosensible — umbral WCAG 2.3.1, no verificado en esta sesión).
- Privacidad en contexto RD: usar por defecto turno alfanumérico; opción configurable "nombre + inicial del apellido" (ej. "María G.") para clínicas pequeñas; nunca mostrar especialidad sensible si identifica (p. ej., "Psiquiatría", "VIH") — usar "Consultorio 2" en vez del nombre del servicio cuando sea sensible.
- Multi‑pantalla: cada display = registro con filtro de colas/consultorios/área (piso 1, piso 2), igual que Qminder.

### Gaps
- No obtuve documentación de Wavetec ni Waitwhile sobre layouts; no verifiqué el texto exacto de WCAG 2.3.1 en esta sesión.
- No hallé normativa dominicana específica sobre mostrar nombres de pacientes en pantallas (Ley 172‑13 de datos personales y Ley 42‑01 de salud no revisadas aquí).

## 2. Audio: campanilla + voz, repeticiones, y clips pregrabados vs TTS (navegador vs nube)

### Takeaway
Los vendors ofrecen ambas vías: archivos de voz pregrabados (concatenados) y TTS. Para un SaaS web, `speechSynthesis` del navegador es poco fiable en TV (voces dependen del OEM/motor instalado, pueden requerir red, caen a inglés). La solución robusta es TTS en la nube con **caché de frases pregeneradas** servidas como MP3 — el costo es casi nulo porque el vocabulario es finito.

### Cited Findings
- Qmatic: dos modos — archivos de voz pregrabados (vía Display App o media player) o **AI TTS integrado** en la Display App; voces masculinas/femeninas en 50+ idiomas incluyendo español; anuncio en idioma local + secundario; sonido seleccionable al llamar — [Qmatic voice announcements](https://www.qmatic.com/products/voice-announcements)
- Configuración típica de "media announce": elegir colas por player, si se pronuncia la letra de la cola, formatos "Number N", "Number N. Counter C", "Now serving ticket number N", o cadena personalizada — [Iowa DOT help, Hub Media Announce](https://testpartners.iowadot.gov/help/Standard%20Unit%20Types%20Guide/18_01%20displays.5.20.html)
- Web Speech en Android/Chrome: la lista de voces no refleja lo instalado; si falta el paquete de idioma, Chrome **cae a voz en inglés**; puede requerir que el usuario elija voz por región; Edge Android devuelve lista vacía; códigos de idioma inconsistentes (`es_US`, `spa-...`); `localService` indica voz offline y es fiable — [Readium, WebSpeech en navegadores/SO](https://readium.org/speech/docs/WebSpeech.html)
- Chrome desktop: sus voces Google precargadas **requieren conexión**; bug con utterances > 14 s; Edge "natural voices" también online — [Readium](https://readium.org/speech/docs/WebSpeech.html)
- La lista de voces en Android varía mucho por OEM, dispositivo y versión — [Readium](https://readium.org/speech/docs/WebSpeech.html)
- `getVoices()` puede devolver vacío al inicio; hay que esperar `voiceschanged` (caso documentado de fallo al buscar voz española) — [MDN getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices); [Caktus Group](https://caktusgroup.com/blog/2025/03/11/choosing-a-voice-for-speech-synthesis)
- Google Cloud TTS (páginas localizadas, nov 2026): WaveNet/Standard ~US$4 por 1M caracteres; Neural2 ~US$16/1M; Chirp 3 HD US$30/1M (primer millón/mes); Studio US$160/1M; Gemini TTS se cobra por tokens y tiene cambios de precio anunciados; se cuentan espacios y SSML (salvo `<mark>`) — [Google Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing) (nota: el fetch directo no renderizó la tabla; cifras vía páginas localizadas, una página inglesa mostraba etiquetas desalineadas para Neural2 — verificar)
- Amazon Polly: Neural US$16/1M caracteres; free tier 1M/mes por 12 meses; Generative US$30/1M; Long‑form US$100/1M — [AWS Polly pricing](https://aws.amazon.com/polly/pricing/)
- Azure AI Speech: TTS neural se factura por carácter, por 1M caracteres; variantes Neural y NeuralHD con precios separados; free tier F0 0,5M caracteres neurales/mes; tramos de compromiso — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/) (la cifra en USD no se renderizó)
- ElevenLabs Flash v2.5: ~US$0,04 por 1K caracteres (~US$40/1M) en página oficial según snippet; agregadores reportan US$0,05/1K; OpenRouter promocional a mitad de precio — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api); [OpenRouter](https://openrouter.ai/elevenlabs/eleven-flash-v2.5-20260930)
- Fully Kiosk tiene una "JavaScript API" para integrar lógica — [Fully Kiosk](https://www.fully-kiosk.com/en/)

### Inferences
- **Costo real de TTS en nube con caché**: la frase "Turno A‑12, pase al consultorio 2" ≈ 35 caracteres. Aun sin caché, 300 llamados/día × 30 días × 35 = 315 000 caracteres/mes ≈ US$1–5/mes por clínica con voces Neural (y dentro del free tier en Google/Azure/Polly). Con caché por frase completa (letra × número 1–999 × consultorio 1–20) o por segmentos, el costo es prácticamente un pago único.
- **Estrategia de segmentos (estilo pregrabado)**: generar una vez clips "Turno", "A".."Z", "uno".."novecientos noventa y nueve" (o leer dígitos), "pase al", "consultorio", "módulo", "caja", números de sala; concatenar en el cliente con Web Audio (decodeAudioData + programar buffers contiguos). Ventaja: offline, determinista, sin latencia. Desventaja: prosodia menos natural. Alternativa: frase completa generada on‑demand en el servidor y cacheada en almacenamiento (key = hash(texto+voz)), con el cliente pre‑cargando el MP3 antes de reproducir.
- Secuencia recomendada: chime (≈1 s, dos tonos) → 300 ms pausa → voz → repetir voz 1 vez tras 2–3 s (configurable 1–3 repeticiones) → si se pulsa "rellamar", repetir completo. Cola de reproducción serializada en el display para que dos llamados simultáneos no se solapen. Volumen como ajuste del display + ganancia de Web Audio (GainNode).
- Voces locales: para RD, una voz es‑US o es‑MX neutra suele ser más inteligible que es‑ES; Azure ofrece locale es‑DO (voces "Emilio"/"Ramona" según mi conocimiento previo, no verificado en esta sesión).
- `speechSynthesis` sirve solo como fallback (p. ej. en PC con Edge/Chrome online), filtrando `lang.startsWith('es')` y prefiriendo `localService`.

### Gaps
- No obtuve precios en USD confirmados para Azure Neural ni la tabla oficial de Google renderizada; cifras de Google vienen de páginas localizadas con una inconsistencia en Neural2.
- No hallé pruebas documentadas de `speechSynthesis` en Android TV/Google TV/Fire TV (Silk) específicamente; disponibilidad de voz española depende del motor TTS instalado en el dispositivo.
- No encontré cifras de latencia medidas para cada proveedor cloud.

## 3. Autoplay en TV/kiosco, Wake Lock, reconexión y comportamiento offline

### Takeaway
En navegador normal el audio queda bloqueado hasta un gesto del usuario; la solución práctica es (a) un botón "Activar sonido" al arrancar la pantalla (una vez por sesión de navegador), (b) políticas/flags de Chrome en mini‑PC (`AutoplayAllowlist` o `--autoplay-policy=no-user-gesture-required`), o (c) una app contenedora (Fully Kiosk Browser o app Android TV/WebView propia) que no aplica la política de autoplay.

### Cited Findings
- Chrome: autoplay con sonido permitido si el usuario interactuó con el dominio, si el Media Engagement Index superó el umbral (desktop), o si la PWA está instalada (desktop) / en pantalla de inicio (móvil); muted siempre permitido — [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- Chrome: `--autoplay-policy=no-user-gesture-required` desactiva la restricción; políticas empresariales `AutoplayAllowed` y `AutoplayAllowlist` para kioscos — [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- AudioContext creado antes de un gesto arranca "suspended"; se llama `resume()` tras gesto; monitorizar `state`/`statechange` — [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- En Chrome se puede añadir el sitio en chrome://settings/content/sound → "Allowed to play sound"; apps nativas de signage (Android, Fire OS, ChromeOS kiosk) no están sujetas a la política de autoplay; ChromeOS kiosk administrado (ChromeOS 140+) reproduce con sonido; dispositivos ChromeOS no administrados ya no soportados por ScreenCloud — [ScreenCloud autoplay troubleshooting](https://help.screencloud.com/en/articles/10119685-troubleshooting-autoplay-policy-and-audio-issues-with-screencloud)
- Fully Kiosk: opciones "Autoplay Videos" y "Autoplay Audio" (solo con etiquetas `<video>`/`<audio>` estáticas); "Custom Error URL" y "Load Error URL on Disconnection" (detecta desconexión haciendo ping a 8.8.8.8); en Fire TV hay que poner Graphics Acceleration Mode = None para reproducir vídeos embebidos; licencia PLUS 8,90 € (o US$10,99) + impuestos por dispositivo, descuento 10+; remote admin, REST API, JavaScript API — [Fully web content settings](https://www.fully-kiosk.com/docs/en/configuration/web-content); [Fully Fire FAQ](https://www.fully-kiosk.com/docs/en/faq/fire); [Fully Kiosk](https://www.fully-kiosk.com/en/)
- Screen Wake Lock API: solo HTTPS; `navigator.wakeLock.request('screen')`; el sistema la libera si la página se oculta/inactiva o batería baja → re‑adquirir en `visibilitychange`; Baseline 2025 (desde mar‑2025 en navegadores actuales) — [MDN Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)

### Inferences
- Flujo de arranque recomendado del display: pantalla "Toque/OK para activar sonido" (el control remoto de la TV genera keydown = gesto válido) → crear/`resume()` AudioContext, reproducir chime silencioso, decodificar clips → mostrar indicador "🔊 activo"; si `AudioContext.state !== 'running'` mostrar banner visible para que recepción lo note.
- Wake Lock como cinturón; en TVs además desactivar ahorro de energía/salvapantallas en ajustes del SO (Fully tiene ajustes de energía propios).
- Reconexión: reconectar con backoff exponencial + jitter, heartbeat cada 15–30 s, y al reconectar pedir snapshot completo del estado (últimos N llamados) — nunca depender solo de eventos incrementales. Recarga automática diaria de la página (madrugada) para limpiar fugas de memoria en navegadores de TV.
- Offline: service worker que cachea shell + clips de audio + fuentes; si se pierde red mostrar último estado con indicador discreto "sin conexión" y no reproducir anuncios viejos al reconectar (descartar llamados con antigüedad > ~60 s).
- Navegadores integrados de Smart TV (Tizen/webOS) y Silk de Fire TV son los menos predecibles; recomendar oficialmente Android TV box/Google TV/Fire TV con Fully Kiosk, o mini‑PC con Chrome en modo kiosco.

### Gaps
- Sin fuente sobre comportamiento de autoplay en Silk (Fire TV) o navegadores Tizen/webOS; no se confirmó que Fully "Autoplay Audio" permita Web Audio/`new Audio()` dinámico (la doc dice solo `<audio>` estático) — requiere prueba en dispositivo.
- La documentación JS de Fully (p. ej., `fully.textToSpeech`) no se pudo recuperar (404).

## 4. Entrega en tiempo real, emparejamiento y seguridad de la URL del display

### Takeaway
Para un display de solo lectura basta SSE (o WebSocket si ya existe infraestructura) con fallback a polling; el emparejamiento por código corto (6 dígitos, como YoFacturo) que emite un token de dispositivo revocable es el patrón de mercado.

### Cited Findings
- YoFacturo empareja la pantalla de turnos con un código de 6 dígitos (mismo mecanismo que su cartelería digital) — [YoFacturo](https://yo-facturo.com/blog/turnero-digital-sala-de-espera/)
- Qminder configura cada TV individualmente desde el panel (pantallas como dispositivos gestionados) — [Qminder TV settings](https://support.qminder.com/en/articles/3672049-qminder-tv-app-settings)

### Inferences
- **Transporte**: SSE (`EventSource`) es unidireccional, reconecta automáticamente y usa `Last-Event-ID`, ideal para "servidor → TV". En Next.js requiere un runtime Node con streaming (route handler con `ReadableStream`) y cuidado con proxies (Caddy/Cloudflare Tunnel: desactivar buffering, enviar comentarios keep‑alive cada ~15 s porque Cloudflare corta conexiones inactivas ~100 s). Con varias réplicas, publicar eventos vía Postgres LISTEN/NOTIFY o Redis pub/sub. Polling cada 2–3 s es un fallback aceptable (latencia de llamado tolerable en sala).
- **Emparejamiento**: display abre `/display` → muestra código de 6 caracteres de vida corta (5–10 min) → recepción lo introduce en el panel y elige sede/colas/consultorios → servidor emite token aleatorio largo (≥128 bits) ligado a `practiceId` + `displayId` con scope solo‑lectura de cola → se guarda en cookie httpOnly/localStorage del TV. Revocable desde el panel; "último visto" por heartbeat.
- **Seguridad**: la URL del display nunca debe exponer datos más allá de lo que se ve en la sala (turno, consultorio, iniciales opcionales); sin IDs de paciente ni endpoints que permitan enumerar; rate‑limit en el canje de códigos; los audios cacheados no deben contener nombres si la clínica elige solo números (si dice nombres, generar on‑demand y no persistir con clave adivinable).

### Gaps
- No se buscaron fuentes primarias (MDN SSE, Cloudflare timeouts) en esta sesión; las cifras de timeout de Cloudflare son conocimiento previo, verificar.

## 5. Hardware habitual en clínicas LatAm y precios aproximados

### Takeaway
No hace falta hardware propietario: TV común + reproductor (Smart TV, stick/box Android/Fire TV, Chromecast o mini PC), opcional PC/tablet de kiosco e impresora térmica de 80 mm. No conseguí precios en RD$ verificables.

### Cited Findings
- Basta PC o tablet en la entrada, TV común en sala y pantalla de operador por mostrador; equipo de entrada en modo kiosco o manejado por recepción; impresora opcional — [YoFacturo](https://yo-facturo.com/blog/turnero-digital-sala-de-espera/)
- Reproductor: Smart TV, Chromecast o mini PC — [YoFacturo hardware](https://yo-facturo.com/blog/hardware-para-veterinaria-y-consultorio/)
- Qminder usa Apple TV y declara que no requiere hardware especialista — [Qminder](https://www.qminder.com/features/waiting-room-tv/)
- Fully Kiosk PLUS: 8,90 €/US$10,99 por dispositivo — [Fully Kiosk](https://www.fully-kiosk.com/en/)
- En RD, la DGII lista distribuidores de impresoras homologadas (CECOMSA, IT Supply Dominicana, Tecnycomp, D&R Technology) — útil como canal para impresoras térmicas — [DGII impresoras homologadas](https://dgii.gov.do/ifc/ImpFiscal/ImpresorasHomologadas.aspx)

### Inferences
- Rangos orientativos (conocimiento general, no verificado para RD 2026): Fire TV Stick / Google TV Streamer básico US$30–60; Android TV box genérico US$30–80; mini PC Intel N100 US$120–200; TV 43" US$250–400; impresora térmica 80 mm ESC/POS con autocorte US$60–150; tablet kiosco + soporte US$150–300. Impresión desde web: vía impresora de red (ESC/POS sobre TCP 9100 desde un agente local) o diálogo de impresión del navegador con CSS de 80 mm.

### Gaps
- No obtuve precios en RD$ de tiendas dominicanas (Plaza Lama, Sirena, Ikea RD, CECOMSA) para Fire TV, boxes o impresoras.

## 6. Normas de accesibilidad para anuncios en países hispanohablantes / RD

### Takeaway
No hallé una norma dominicana específica sobre llamadores de turno; el marco general (Ley 5‑13 y su reglamento Decreto 363‑16, Ley 43‑23 de lengua de señas) exige formatos alternativos de comunicación, lo que justifica el doble canal visual + auditivo.

### Cited Findings
- Ley 5‑13 sobre discapacidad en RD (deroga Ley 42‑00) garantiza igualdad de derechos y menciona modos, medios y formatos alternativos de comunicación y TIC accesibles — [Ley 5‑13 (drlawyer)](https://drlawyer.com/espanol/wp-content/uploads/2020/06/Ley5-13Discapacidad.pdf)
- Reglamento de aplicación: Decreto 363‑16 (dic‑2016) — [DGJP Decreto 363‑16](https://www.dgjp.gob.do/wp-content/uploads/2022/05/Decreto-Núm.-363-16.pdf)
- Ley 43‑23 reconoce la lengua de señas como mecanismo oficial de comunicación de personas sordas — resultado de búsqueda, [Observatorio Justicia y Género](https://observatoriojusticiaygenero.poderjudicial.gob.do/documentos/PDF/normativas/NOR_ce_Lenguaje_de_Senas_de_la_R.D..pdf)
- Guía de señalización: mínimo 3" para información importante, alto contraste — [WMU](https://wmich.edu/digital-accessibility/creating-accessible-content/digital-signage)

### Inferences
- Requisitos de producto derivados: todo llamado debe ser simultáneamente visual (flash + texto grande) y auditivo; opción de anuncio bilingüe (es + en para turismo médico, como Qmatic soporta idioma secundario); alto contraste; no depender solo del color para distinguir colas (usar letra + color).

### Gaps
- No revisé el articulado concreto de la Ley 5‑13/Decreto 363‑16 sobre señalización en servicios de salud; tampoco normas de España (UNE 170001/170002) o México (NOM‑030/NMX accesibilidad) — no verificadas en esta sesión.
