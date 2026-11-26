# Handoff: medira.do — sitio, flujos y aplicación

Repositorio destino: el EMR actual (Next.js App Router + Payload CMS 3 + MongoDB, Tailwind, shadcn/ui en `src/components/ui`). En el código el proyecto todavía se llama EMR; la marca es **medira** (siempre en minúscula).

## Resumen

Rediseño completo de medira como SaaS: sitio público, registro y acceso con 2FA, plan y cobro, páginas del paciente, y la aplicación del consultorio con fichas por especialidad. Estilo **Clinical Calm**: minimalismo cálido, mucha información sin saturar.

La fuente de verdad funcional es `especificacion.pdf` (44 páginas). Este paquete es su traducción visual.

## Sobre los archivos de diseño

Los `.dc.html` son **referencias de diseño hechas en HTML**: prototipos que muestran aspecto, jerarquía, textos e interacciones. **No son código de producción.** La tarea es **recrearlos dentro del repo existente** (React/Next, Tailwind, shadcn/Radix, Payload) reutilizando sus patrones y `src/components/primitives.tsx`.

Para verlos, abra cualquier `.dc.html` en el navegador (necesitan `support.js` en la misma carpeta). Todos los datos son de ejemplo.

## Fidelidad

**Alta fidelidad.** Colores, tipografía, espaciados, textos e interacciones son finales salvo lo listado en «Pendiente del cliente». Recrear con fidelidad usando las librerías del repo.

## Cómo usar este paquete con Claude Code

1. Copie `design_handoff_medira/` a la raíz del repo.
2. Pegue un prompt como:

```
Lee design_handoff_medira/README.md y especificacion.pdf. Los .dc.html son
referencias de diseño en HTML, no código a copiar. Recrea cada pantalla en este
codebase (Next.js App Router, Tailwind, shadcn/ui, Payload). Empieza por los
tokens y los componentes base, luego el sitio público, y para antes de la
aplicación para que yo revise. No cambies colecciones de Payload salvo lo
indicado en «Backend necesario».
```

3. Orden sugerido: tokens → sitio público → registro y acceso → plan y cobro → aplicación (panel, agenda, pacientes, ficha, consulta, receta) → dinero → páginas del paciente → súper admin → fase 2.

## Archivos

| Archivo | Contenido | Destino sugerido |
|---|---|---|
| `medira Inicio.dc.html` | Página de inicio | `src/app/(frontend)/page.tsx` |
| `medira Precios.dc.html` | Planes, comparación, extras | `src/app/(frontend)/precios/page.tsx` (nueva) |
| `medira Sitio.dc.html` | Seguridad, Especialidad, Hospitales, Ayuda, Estado, Legal | rutas públicas nuevas |
| `medira Flujos.dc.html` | 51 pantallas: registro, acceso, cobro, paciente, reserva, portal, telemedicina | `signup`, `login`, `verify-email`, `reset-password`, `agendar/[slug]`, rutas públicas por enlace |
| `medira App.dc.html` | Aplicación completa | `src/app/(frontend)/dashboard/**` |
| `medira Sistema.dc.html` | Tokens, componentes, correos, WhatsApp, PDF | referencia |
| `pruebas.html`, `pruebas-1280.html` | Pruebas automáticas de los prototipos a 390 y 1280 px | solo referencia |
| `especificacion.pdf` | Especificación funcional | fuente de verdad |

`medira Flujos.dc.html` acepta el identificador de pantalla en la URL (`#e1`, `#c5`, `#p2`…). `medira Sitio.dc.html` acepta `#seguridad`, `#especialidad`, `#hospitales`, `#ayuda`, `#estado`, `#terminos`.

## Tokens de diseño

### Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#fafaf7` | `#0c0a09` | Fondo de página |
| `--surface` | `#ffffff` | `#1c1917` | Tarjetas, campos |
| `--sunken` | `#f0eeec` | `#292524` | Controles segmentados, esqueletos |
| `--line` | `#e7e5e4` | `#2e2a27` | Borde de tarjeta |
| `--line-2` | `#f0eeec` | `#292524` | Separador de filas |
| `--line-3` | `#d6d3d1` | `#44403c` | Borde de campo y botón secundario |
| `--ink` | `#1c1917` | `#fafaf9` | Texto |
| `--muted` | `#57534e` | `#a8a29e` | Texto secundario |
| `--muted-2` | `#44403c` | `#d6d3d1` | Etiquetas de campo |
| `--inv` | `#1c1917` | `#57534e` | Botón de peligro, opción seleccionada, aviso flotante |
| Primario | `#0f766e` | igual | Acción principal (fondo) |
| Primario hover | `#115e59` | igual | |
| `--brand-t` | `#0f766e` | `#2dd4bf` | Primario usado como texto |
| Profundo | `#042f2e` | igual | Hero, tarjeta destacada, encabezado del sitio |
| Borde sobre profundo | `#134e4a` / `#2b6b65` | | |
| Texto sobre profundo | `#ffffff`, secundario `#b6d4cf`, enlaces `#d5e5e2` | | |
| Acento sobre profundo | `#2dd4bf` | | Pestaña activa, cursor del código 2FA |
| `--ok-t` | `#15803d` | `#4ade80` | Confirmado |
| `--warn-t` | `#b45309` | `#fbbf24` | Aviso, marca de IA |
| Información | `#1d4ed8` | igual | «En sala», franja «Ver como» |
| **Alerta clínica** | `#b91c1c` | igual | **Solo** alergias y valores críticos |

Regla dura: el rojo nunca se usa para «eliminar», errores de formulario ni decoración. Las acciones destructivas usan tinta (`--inv`); los errores de validación usan ámbar.

Mapear estos tokens a las variables de shadcn en `globals.css` (`--background`, `--card`, `--border`, `--primary`…) con su bloque `.dark`.

### Tipografía

- **Geist** 400/500/600 para todo. **Geist Mono** 400/500 para folios, NCF, códigos y atajos. Cargar con `next/font/google` en `src/lib/fonts.ts`.
- `font-variant-numeric: tabular-nums` en toda cifra (signos vitales, dinero, horas).
- Escala: título de página `clamp(34px,5.6vw,64px)`/500/`-0.04em`/1.04 (sitio); título de sección `clamp(26px,3.2vw,38px)`/500/`-0.03em`/1.1 (sitio); título de pantalla 22/600/`-0.03em` (app); título de tarjeta 15–17/600; texto 15–16/400/1.5; etiqueta 12–13/500; cifra grande 22–24/500/`-0.03em`; valor de campo clínico 16–18/500.
- Nada clínico por debajo de 13 px. Campos a 16 px en teléfono (evita el zoom de iOS).

### Forma, espacio y movimiento

- Radios: 6 (insignias), 8 (botón pequeño, fila de papel), 10 (botones, campos, opciones), 12 (tarjetas), 14–16 (ventanas grandes, hojas).
- Bordes de 1 px. Sombras casi nulas; la única fuerte es la ventana del hero: `0 30px 60px -30px rgba(4,47,46,.55)`.
- Espaciado: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 48; secciones del sitio `clamp(56px,7vw,96px)`.
- Altura mínima táctil 44 px (botones 44–50, campos 44–48, opciones 40).
- Transiciones de 150–200 ms, solo `background`, `color`, `border-color`, `transform`. Hoja y aviso: `translateY(12px)→0` + opacidad, .2 s ease-out.
- Respetar `prefers-reduced-motion`.

### Componentes base (ver `medira Sistema.dc.html`)

- **Botón**: principal (fondo primario, texto blanco), secundario (borde `--line-3`, fondo `--surface`), peligro (fondo `--inv`), enlace (texto `--brand-t`), inactivo (`#a8a29e`). Radio 10, 500, 14–16 px.
- **Campo**: alto 44–48, borde `--line-3`, radio 10, etiqueta 12–13/500 arriba, ayuda 12 debajo. Campo de alergias con borde `#b91c1c`.
- **Control segmentado**: pista `--sunken` con relleno de 3 px, opción activa `--surface` radio 8.
- **Opción seleccionable (chip)**: alto 40, radio 10; activa fondo `--inv` texto blanco.
- **Interruptor**: 48×28, perilla 22, activo primario.
- **Insignia de estado**: 12/600, radio 6, relleno 2–3×8. Programada (borde gris), Confirmada (borde y texto verde), En sala (fondo azul), En consulta (fondo primario), Atendido (fondo hundido), No asistió (fondo tinta), `pronto` y `Ejemplo` (borde discontinuo).
- **Marca de IA**: borde y texto ámbar, «Generado por IA · revisar», siempre con la fuente visible.
- **Barra de cuota**: pista 6 px `--sunken`, relleno primario; ámbar desde el 80% con «Aviso al 80%».
- **Banner de cuenta**: prueba (hundido), pago fallido (ámbar con botón blanco), Gratis (tinta), cancelada (hundido).
- **Hoja**: superposición `rgba(28,25,23,.45)`; centrada con radio 14 en escritorio, inferior con radio `16px 16px 0 0` en teléfono; ancho máximo 520.
- **Aviso flotante**: fondo tinta, radio 10, 2.6 s.
- **Membrete de PDF**: nombre de la clínica 16/600, línea inferior de 2 px en tinta, folio y fecha en mono a la derecha, QR abajo a la izquierda, firma y sello abajo a la derecha.

## Pantallas

### 1. Sitio público

**Inicio** (`medira Inicio.dc.html`)
- Encabezado fijo profundo de 60 px: marca, enlaces, «Entrar», botón blanco «Empezar gratis». En teléfono (<760 px) los enlaces pasan a un botón «Menú» desplegable.
- Hero profundo centrado: título, bajada, dos botones. Debajo, una **ventana del producto** que sobresale 120 px del bloque oscuro: buscador con ⌘K que escribe solo, selector de especialidad (General / Nutrición / Estética), selector de densidad, ficha del paciente con alergia en rojo y nota dictada con marca de IA, agenda cuyos estados avanzan cada 2.2 s, caja del día y uso de WhatsApp.
- Mosaico de producto: WhatsApp con botones que funcionan, paleta de comandos, receta firmada, uso del plan, cobro y cierre de caja.
- Seguridad: código de dos pasos que se llena solo, registro de actividad que rota, cuatro tarjetas (cifrado, aislamiento, respaldo, Ley 172-13).
- Planes: interruptor Mensual / Anual, cuatro tarjetas (4 columnas ≥1120 px, 2×2 hasta 760, carrusel horizontal en teléfono) y franja de Hospital.
- Preguntas desplegables, llamado final y pie.
- **No mencionar la pasarela de pago por nombre en ningún texto público.**

**Precios**: mismo encabezado y hero; tarjetas que sobresalen del bloque oscuro; comparación completa (tabla con desplazamiento horizontal en teléfono, columna de Médico independiente resaltada); extras; preguntas sobre el cobro.

**Sitio**: Seguridad y privacidad (seis tarjetas, tabla «Quién ve qué», proveedores), Especialidad (ficha + documento por especialidad), Hospitales (beneficios + formulario de demo con confirmación), Ayuda, Estado del servicio, Legal.

**Planes y precios** (dólares):

| Plan | Mensual | Anual (2 meses gratis) |
|---|---|---|
| Gratis | US$0 | — |
| Médico independiente | US$34.95 | US$349.50 |
| Consultorio | US$49.95 | US$499.50 |
| Clínica privada | US$14.95 por médico, mínimo 4 | US$149.50 por médico |
| Hospital | Cotizado | — |

Los límites de cada plan están en la sección 2 de la especificación y en la tabla de `medira Precios.dc.html`.

### 2. Flujos (`medira Flujos.dc.html`)

Una tarjeta centrada de 440 px (390 px para páginas del paciente, sobre fondo `--sunken` y con el membrete de la clínica). Barra de progreso de 4 px por paso.

- **Registro**: elegir plan → cuenta → verificar correo → su práctica → 2FA → códigos de respaldo → resumen de la prueba (o cuenta Gratis lista).
- **Entrar y 2FA**: entrar, código, código de respaldo, perdí mi teléfono, recuperar y crear contraseña, demasiados intentos, aceptar invitación, perfil del médico invitado, invitación vencida, sesión por vencer.
- **Plan y cobro**: resumen con y sin prueba, confirmando, prueba iniciada, no completado, pago fallido, elegir usuarios activos, cuenta en Gratis, cancelar, comprar paquete.
- **Páginas del paciente**: verificar identidad, receta, resumen, resultados, enlace vencido, confirmar cita, cita confirmada, cambiar cita, ficha de ingreso, firmar consentimiento, encuesta, verificar documento por QR (válida / reemplazada / anulada), darse de baja.
- **Reserva en línea**: fecha y hora, datos, confirmación.
- **Fase 2**: portal del paciente (entrar con código, inicio, pagar saldo, pago recibido), sala de espera de telemedicina.

**Lógica del registro (obligatoria):**
- El plan elegido define los textos, el resumen y el destino: Gratis salta el pago.
- Tipo de organización → plan sugerido: Consultorio → Médico independiente; Clínica estética → Consultorio; Clínica de especialidades y Policlínica → Clínica privada; Hospital → formulario de demo. Si difiere del elegido, se avisa y se ofrece cambiar con un botón.
- «¿Usted atiende pacientes?»: si no, no se pide especialidad.
- Clínica privada pide número de médicos (mínimo 4) y el precio es `14.95 × médicos`.
- Validación: nombre no vacío, correo válido, contraseña ≥10 caracteres, términos aceptados, código de 6 dígitos, nombre de la clínica, especialidad si atiende. Un mensaje por error, en ámbar, que dice qué falta.
- Los datos se arrastran: el correo aparece al verificar; el resumen muestra plan, clínica, titular y monto; al entrar, la aplicación usa nombre, clínica, plan, precio y especialidad.
- Los códigos de respaldo no dejan continuar hasta marcar «Ya guardé mis códigos».

### 3. Aplicación (`medira App.dc.html`)

**Estructura**
- Escritorio (≥860 px): menú lateral fijo de 232 px, fondo `--surface`, borde derecho. Grupos: Clínica, Dinero, Administrar. Ítem de 36 px, radio 8, activo con fondo `--sunken` y 600.
- Teléfono: barra inferior fija de 64 px con Panel, Agenda, Pacientes, Caja y «Más» (hoja con todo el menú).
- Cabecera fija de 56 px: «Volver» en vistas hijas, título 17/600, buscador ⌘K, «Avisos» con contador.
- Contenido con ancho máximo 1080 (860 en consulta), relleno 20.

**Roles y permisos** (sección 10 de la especificación)

| Rol | Ve |
|---|---|
| Dueño | Todo lo de su clínica |
| Médico | Panel, agenda, pacientes, estudios, documentos, programa, videoconsultas, su configuración |
| Recepción | Panel, agenda, pacientes (solo contacto, citas y cobros), caja. Sin datos clínicos, motivos ni alergias |
| Contador | Panel con caja, todo el grupo Dinero, datos fiscales. Sin agenda ni pacientes |
| Súper admin | Equipo de medira: métricas, clínicas, suscripciones, uso, accesos de soporte, plantillas de WhatsApp. Sin datos clínicos |

**«Ver como»**: solo lo tiene una cuenta de dueño o de súper admin. El dueño puede ver como médico, recepción o contador; no como súper admin. Mientras está activo, una franja azul (`#1d4ed8`) dice «Está viendo la aplicación como…» con «Volver a mi vista». Es una vista previa: no cambia los permisos reales y debe quedar en la auditoría.

**Vistas**
- **Panel**: saludo, cuatro cifras por rol, tarjeta profunda «Siguiente paciente» con una acción principal (Atender ahora / Avisar al médico), agenda de hoy, acciones rápidas, pendientes, uso del plan, lista de bienvenida.
- **Agenda**: tira de días, Lista / Línea de tiempo / Semana, «Nueva cita», «Sin cita». Cada cita muestra solo las acciones válidas para su estado:
  - Programada o Confirmada → Registrar llegada, WhatsApp, No asistió
  - En sala → Atender ahora (médico) o Avisar al médico (recepción)
  - En consulta → Abrir consulta
  - Atendido → Cobrar, Receta
  - No asistió → Reagendar
- **Pacientes**: búsqueda, filas de 60 px con iniciales, insignia de alergia y «Ejemplo»; nuevo paciente; importar desde Excel en tres pasos.
- **Ficha del paciente**: cabecera con alergias siempre visibles; pestañas Resumen, Consultas, Recetas, Documentos, Estudios, Fotos, Cobros, Actividad. Resumen previo con IA (cinco líneas y su fuente), última medición, antecedentes.
- **Consulta**: selector de especialidad, dictado con IA (aquí o con el celular por QR), secciones plegables, barra fija inferior con «Guardar consulta» y «Guardar y recetar». Cada sugerencia de IA se acepta o se descarta por campo.
- **Receta y órdenes**: Medicamentos, Laboratorio, Imágenes, Lentes. Vista previa del papel, tamaño (Media carta, Carta, A5), firmar y luego imprimir, WhatsApp o correo. Aviso rojo si un medicamento choca con una alergia registrada. Registro del formulario 2064 para controlados.
- **Estudio**: archivo, interpretación con IA por valores, comentario del médico, compartir con el paciente, revisar y firmar.
- **Comparar fotos**: dos fechas, lado a lado o deslizador.
- **Generar documento**: tipo, con plantilla o con IA, datos de origen a la izquierda y borrador a la derecha.
- **Programa de peso**: cifras, gráfico de barras, controles.
- **Caja**: cobrar (hoja con método y cobertura de ARS), movimientos, arqueo de cierre.
- **Tablas** (cuentas por cobrar, ARS, comprobantes, gastos, honorarios, informes, inventario, sucursales, videoconsultas, equipo, actividad): cifras arriba, filtro de texto, tabla con desplazamiento horizontal, acción principal que abre un formulario o una hoja de confirmación.
- **Configuración**: diez secciones con campos e interruptores.
- **Plan y facturación**: plan y estado, uso del mes con barras, extras, recibos.

**Fichas por especialidad** (General, Nutrición y Estética listas; las demás «pronto» y usan la general hasta publicarse)

| Especialidad | Secciones |
|---|---|
| General | Motivo, historia de la enfermedad actual, 9 signos vitales + IMC, examen físico, diagnóstico (CIE-10 opcional), diagnósticos frecuentes, plan, seguimiento, notas privadas |
| Nutrición | Motivo, antropometría (10 campos), hábitos, sueño y agua, evaluación, plan de alimentación, seguimiento |
| Estética | Tratamiento, ficha de sesión (zona, técnica, equipo, intensidad, duración, restantes), estado de la piel, fotos, nota, próxima sesión |
| Oftalmología | Motivo, antecedentes oculares, agudeza visual por ojo, refracción por ojo, presión intraocular, segmento anterior, fondo de ojo, diagnóstico, ojo, estudios |
| Odontología | Motivo, odontograma de 32 piezas (sana, caries, ausente, restaurada), periodonto, procedimiento, diagnóstico, plan, próxima cita |
| Gineco-obstetricia | Motivo, antecedentes (E·A·P·C, FUM, ciclos…), embarazo actual, signos vitales, signos de alarma, examen, diagnóstico, próximo control |
| Pediatría | Motivo, crecimiento con percentiles, desarrollo, vacunas, alimentación y sueño, examen, diagnóstico, seguimiento |

Solo son obligatorios Motivo y Diagnóstico. Implementar cada ficha como un módulo de formato, igual que `src/lib/nutrition.ts` y `src/lib/massage.ts`.

## Interacciones y estados

- **⌘K / Ctrl+K** abre la paleta; **Esc** cierra cualquier hoja.
- **Estados de cuenta**: Activa, En prueba, Pago fallido, Cancelada, Gratis. Cada uno cambia el banner y la tarjeta del plan. El personal ve una versión sin botón de pago.
- **Límites**: al 80% aviso; al 100% solo se rechaza esa acción. En Gratis, «Nuevo paciente» a los 50 abre la ventana de límite. Ver, editar, imprimir y exportar nunca se bloquean.
- **Estados de pantalla**: vacío (una línea y una acción), cargando (esqueleto), error (con reintento), sin permiso. En el prototipo son una pantalla genérica; en producción cada vista necesita los suyos.
- **Modo oscuro** completo por tokens; **densidad** Cómoda / Compacta. En el prototipo la compacta es una reducción del 10%; en producción debe reducir rellenos y alturas de fila.
- **Firmar una receta la cierra**: se guarda una copia fija; corregir la consulta emite una versión nueva.

## Estado y datos

- Sesión: usuario, rol, clínica, plan, estado de la suscripción, cuotas del mes.
- Cita: `scheduled | confirmed | checked-in | in-consult | completed | no-show`, más respuesta de WhatsApp.
- Consulta: formato (especialidad), campos del formato, borradores de IA por campo, estado del dictado.
- Receta: medicamentos, órdenes, tamaño de papel, firmada, versiones.
- Tablas: filas, filtro de texto.

## Backend necesario

Ver secciones 3, 5, 10, 12, 13 y 15 de la especificación. Lo que el diseño da por hecho:
- Estado `confirmed` y origen de la cita; respuesta del paciente por enlace.
- Formatos nuevos en `Visits`: oftalmología, odontología, gineco-obstetricia, pediatría.
- Campos de suscripción en la clínica y colección de eventos de cobro.
- 2FA con códigos de respaldo; sesiones activas.
- Documentos y estudios del paciente con enlaces firmados; borradores de IA siempre marcados.
- Receta firmada inmutable con folio y QR de verificación.
- Rol contador; auditoría de «Ver como».
- Caja con arqueo, cuentas por cobrar, ARS, comprobantes, gastos, honorarios.

## Recursos

- Sin íconos: toda acción lleva etiqueta de texto.
- Fotos: los prototipos actuales no usan fotos. Hay tres de archivo en `public/images` del repo.
- Los códigos QR, logos de clínica y fotos clínicas son marcadores rayados.

## Pendiente del cliente

- Logo de medira (hoy es el nombre en texto, Geist 600, `-0.04em`).
- Fotos reales de médicos y consultorios dominicanos.
- Textos legales: términos, privacidad, contrato de datos, cookies.
- Testimonios.
- Confirmar el precio de Clínica privada (US$14.95) y los precios de los extras.
- Confirmar que dueño y súper admin son roles distintos.

## No verificado en los prototipos

- El paso de datos del registro a la aplicación de punta a punta.
- Los estados vacío, cargando, error y sin permiso.
- Las cuatro fichas «pronto» son una propuesta de campos; validarlas con un especialista de cada área.
