# Handoff: EMR — Frontpage, Dashboard mobile-first y Agenda pública

Repositorio destino: `pixelescreativos31-web/clinic-management` (Next.js App Router + Payload CMS, Tailwind, fuentes vía `src/lib/fonts.ts`).

## Cómo usar este paquete con Claude Code

1. Copie la carpeta `design_handoff_emr/` a la raíz del repo `clinic-management`.
2. Abra Claude Code en el repo y pegue un prompt como:

```
Lee design_handoff_emr/README.md. Los .dc.html son referencias de diseño en HTML
(no código a copiar). Recrea cada pantalla en este codebase (Next.js App Router,
Tailwind, Payload) reutilizando src/components/primitives.tsx y los patrones
existentes. Empieza por la pantalla 1 (frontpage) y para antes de la 2 para que
yo revise. Mantén el modelo de datos actual; no cambies colecciones de Payload
salvo lo indicado en "Backend necesario".
```

3. Revise cada pantalla en el navegador antes de pedir la siguiente. Orden sugerido: Frontpage → Agendar público → App (Inicio y Agenda) → Consulta → Expediente → Cobrar → Reportes.
4. Tip: abra los `.dc.html` en el navegador mientras Claude Code trabaja; puede pedirle "compara con la referencia X y ajusta espaciados".

## Sobre los archivos de diseño

Los `.dc.html` son **prototipos de referencia hechos en HTML**: muestran look, jerarquía, copy e interacciones. No son código de producción. La tarea es **recrearlos dentro del entorno existente del repo** (React/Next, Tailwind, componentes propios).

## Fidelidad

**Alta fidelidad (hifi).** Colores, tipografía, espaciados, copy e interacciones son finales salvo lo marcado como "pendiente del cliente". Recrear pixel-perfect con las librerías del repo.

## Pantallas

### 1. Frontpage — `EMR Frontpage.dc.html` → `src/app/(frontend)/page.tsx`
Página pública de marketing. Reemplaza la actual.
- **Nav** fija: logo EMR (cuadro teal 28px con "+", radio 8) + "Historia Clínica Digital"; links Cómo funciona / Funciones / Precios / FAQ; botón "Entrar" y CTA "Crear cuenta gratis" (teal sólido, radio 10).
- **Hero** fondo gradiente `linear-gradient(135deg,#0c211d 0%,#0d4a42 55%,#0d6e60 100%)` + rejilla sutil 48px `rgba(255,255,255,.04)`. Grid 2 columnas (minmax 300px), gap 56, padding 72/24/128. Izquierda: etiqueta pill "Historia clínica digital para médicos y clínicas" (borde `rgba(58,214,187,.35)`, texto `#3ad6bb`), H1 Bricolage Grotesque 700 `clamp(40px,5.2vw,64px)`, línea 1.02; párrafo 17–18px `#9fb5ae`; CTAs. Derecha: foto del médico (`public/images/hero-doctor2.jpg`, radio 24, borde `rgba(255,255,255,.14)`) con un mockup de agenda blanco superpuesto (radio 14, sombra `0 40px 90px -30px rgba(0,0,0,.7)`) y burbuja de WhatsApp (abajo‑derecha, 200px).
- **Franja "Por qué EMR"**: tarjeta blanca `margin-top:-56px`, radio 20, sombra `0 30px 60px -30px rgba(12,33,29,.45)`. Panel teal `#0d6e60` + 3 datos (número Bricolage 40px teal, título 15/600, texto 13 `#65716c`). Grid `repeat(auto-fit,minmax(min(100%,440px),1fr))`; los datos en subgrid `minmax(200px,1fr)`.
- **Cómo funciona**: 3 tarjetas radio 18, padding `160px 28px 32px`, número gigante 240px Bricolage como fondo (`#e2efec`; en la primera tarjeta, teal sólido con número `rgba(58,214,187,.22)`).
- **Funciones**: grid de tarjetas; tintes alternos `#e2efec` (teal), `#e9f0f9` (azul), `#e8f4ec` (verde).
- **Precios** (fondo `linear-gradient(160deg,#0d6e60,#0d4a42 50%,#0c211d)`), dos pestañas pill (activa `#3ad6bb` texto `#0c211d`):
  - *Médicos y consultorios*: Gratis US$0/mes (1 médico, hasta 50 pacientes, agenda/expediente/recetas, facturación) · **Médico independiente US$25/mes** (destacado, tarjeta `#0c211d`, outline `#3ad6bb`; pacientes ilimitados, cuenta asistente, WhatsApp, formatos por especialidad, reportes/Excel) · Consultorio US$50/mes (hasta 3 médicos, asistentes, agenda y reportes por médico, auditoría).
  - *Clínicas e instituciones*: Clínica privada US$15 por médico/mes (ilimitado, migración ¹, soporte prioritario ¹) · Hospital público "Cotizado" (contrato institucional ¹, capacitación ¹, instalación on‑premise). Nota ¹ "Servicios de acompañamiento incluidos; se coordinan al contratar". CTA "Contáctenos" → `mailto:gelinson@pixelescreativos.com.do`.
- **Demostración**: cuentas demo + foto `public/images/reception.jpg` con pie "Datos de ejemplo".
- **FAQ**: acordeón sobre `#e2efec`, filas con borde `#cfe3dd`, botón circular teal con "+".

### 2. Agenda pública por médico — `EMR Agendar.dc.html` → `src/app/(frontend)/agendar/[slug]/page.tsx` (NUEVA)
Página sin login para que el paciente reserve. Layout móvil 1 columna; escritorio `340px minmax(0,1fr)`, máx 960px.
- **Tarjeta del médico**: barra superior 6px teal, avatar 64 (foto), nombre Bricolage 22/700, especialidad + exequátur 13 `#6b7577`; 3 filas con iconos Material Symbols `location_on`, `schedule`, `payments`.
- **Progreso** 3 barras 4px (`#0d6e60` completadas, `#dfe4e4` pendientes): Fecha y hora · Sus datos · Confirmación.
- **Paso 1**: selector de tipo (2 tarjetas radio 12, borde 1.5px; activa `#e6f1ee`/`#0d6e60`); tira de días horizontal (botones 54px, radio 12; activo `#15201e` texto blanco; cerrados opacidad .4 y `cursor:not-allowed`); horarios `repeat(auto-fill,minmax(84px,1fr))`, botón 46px, activo `#15201e`. CTA 52px: deshabilitado `#dfe4e4`/`#6b7577` con texto "Elija un horario", habilitado teal con "Continuar · Jue 8 de octubre, 2:00".
- **Paso 2**: resumen verde con `event_available` y link "Cambiar"; inputs 50px radio 12 fondo `#fafbfb` (Nombre, WhatsApp `inputMode=tel`, Motivo opcional), checkbox "Es mi primera vez". Validación: nombre > 2 chars y teléfono ≥ 10 dígitos. Nota "Sin pago en línea. Paga en el consultorio."
- **Paso 3**: `check_circle` relleno 36px sobre círculo `#e8f4ec`, título "Cita confirmada", tabla Paciente/Tipo/Lugar/Código, botones "Añadir al calendario" (.ics) y "Ver en WhatsApp" (teal), link "Necesito cambiar o cancelar".

### 3. App del consultorio (mobile-first) — `EMR App.dc.html` → `src/app/(frontend)/dashboard/**`
Un shell, siete vistas. Tweaks del prototipo: `vista` Móvil/Escritorio y `rol` Médico/Asistente (en producción: viewport y rol real del usuario).
- **Shell**: fondo `#f4f6f6`. Header sticky 56px `rgba(244,246,246,.92)` + blur, título Bricolage 18/600 + subtítulo 12 `#6b7577`, botón atrás 40px (`arrow_back`) cuando la vista no es raíz. Móvil: **barra inferior de 5 pestañas** (Inicio `home`, Agenda `calendar_month`, Pacientes `group`, Cobros `payments`, Reportes `bar_chart`), icono dentro de pill 52×30 `#e6f1ee` cuando activo, FILL 1; etiqueta 10/600. Escritorio: sidebar 232px blanca con los mismos ítems.
- **Inicio**: tarjeta teal "Siguiente paciente" (una acción primaria que cambia según estado: Registrar llegada → Atender ahora; asistente ve "Avisar al médico") + botón Expediente; 3 KPIs (Citas hoy / Atendidas verde `#1a7a50` / En sala azul `#2563ab`); 4 accesos rápidos (Nueva cita `calendar_add_on`, Paciente sin cita `directions_walk`, Nuevo paciente `person_add`, Cobrar `payments`) mín. 76px; Saldos pendientes; Próximas hoy. Escritorio: grid 2 columnas.
- **Agenda**: tira de días; toggle Lista / Línea de tiempo (activo `#15201e`); tarjeta de cita con borde izquierdo 4px del color de estado y **solo las acciones válidas para su estado**: Programada → Registrar llegada (teal) + WhatsApp + No asistió; En sala/Sin cita → Atender ahora (azul, solo médico); Atendido → Cobrar consulta + Imprimir receta. Línea de tiempo: filas `56px 1fr`, punto rojo `#b3261e` en la hora actual, huecos "Libre · tocar para agendar".
- **Pacientes**: buscador 48px; filas 60px con avatar, nombre, teléfono · edad, badge ALERGIA (`#fbeceb`/`#b3261e`) y nº expediente.
- **Expediente**: cabecera con alergias siempre visibles (`priority_high`), botón principal "Registrar consulta" a todo ancho, Llamar / WhatsApp; "Última medición" 4 celdas; pestañas Historial / Datos / Facturas. Historial: tarjetas con etiqueta de tipo (Consulta teal, Factura ámbar `#faf3e6`/`#b45309`, Laboratorio azul) y botón "Imprimir receta".
- **Consulta** (sustituye el formulario largo): alergias arriba; selector "Formato" General / Nutrición / Pediatría (cambia campos; Nutrición = antropometría: peso actual, habitual, talla, IMC, cintura, cadera, abdomen, brazos, glúteos, meta). **Obligatorios solo Motivo y Diagnóstico** (chips de diagnósticos frecuentes). Secciones plegables: Signos vitales/Antropometría, Interrogatorio (preguntas Sí/No en pills), Receta (medicamento, frecuencia en chips, días, indicaciones, "+ Agregar medicamento"), Laboratorio (chips multiselección), Tratamiento y seguimiento (1 semana / 15 días / 1 mes / 3 meses). Barra fija inferior: "Guardar consulta" (teal, sombra) + "Guardar e imprimir"; en móvil se sitúa a 82px del borde para no tapar las pestañas. Guardar marca la cita como Atendida y vuelve a Agenda.
- **Cobrar**: factura (líneas, "+ Agregar servicio", Pagado, Saldo pendiente destacado ámbar 26px); método en 3 botones; monto 50px 20/600 + botón "Total"; "Registrar pago" descuenta del saldo; Imprimir recibo / Enviar por WhatsApp.
- **Reportes**: chips de mes; 4 KPIs; barras 14 días (`#9fd3c7`, hoy `#0d6e60`, vacío `#e3e7e7`); Imprimir / Exportar Excel.

## Interacciones y estados
- Toast negro `#15201e` pill, 2.6s, animación `emr-toast`; en móvil a 96px del borde inferior.
- Sheet inferior (Nueva cita / Sin cita): overlay `rgba(12,33,29,.45)`, panel radio 18 arriba, animación `translateY(100%)→0` .25s ease-out; nueva cita exige elegir horario libre; sin cita asigna turno "T‑04".
- Estados de cita: `sched` Programada (`#e6f1ee`/`#0d6e60`), `waiting` En sala (`#e9f0f9`/`#2563ab`), `walkin` Sin cita (azul), `done` Atendido (`#e8f4ec`/`#1a7a50`), `noshow` No asistió (`#faf3e6`/`#b45309`). Mapear a `status` de la colección `appointments` y `ACTIVE_STATUSES` en `src/lib/constants.ts`.
- Objetivos táctiles ≥44px; inputs numéricos con `inputMode`; fuente ≥16px en inputs móviles para evitar zoom en iOS.

## Backend necesario (Payload)
- Ruta pública `/agendar/[slug]`: campo `slug` y `publicBooking` (horario, duración por servicio, precios, dirección) en `doctors`/`users`; endpoint que lista huecos libres usando `findConflict` de `src/lib/booking.ts` y crea la cita con `status: scheduled` y origen `web`.
- Confirmación/recordatorio por WhatsApp (link `wa.me` prellenado basta en v1).
- Campo `format` en `visits` (general | nutrition | pediatrics) con sus campos antropométricos opcionales.
- Pagos parciales en `invoices` (ya existe saldo; confirmar métodos Efectivo / Tarjeta / Transferencia).

## Tokens de diseño
- Colores: teal `#0d6e60` (hover `#0a584d`), teal claro `#e6f1ee` / `#e2efec`, acento `#3ad6bb`, tinta `#0c211d`, texto `#15201e`, texto secundario `#6b7577` / `#65716c`, borde `#e3e7e7` / `#eef1f1`, fondo app `#f4f6f6`, fondo página `#e9ecec`, papel frontpage `#f7f6f2`, azul `#2563ab`/`#e9f0f9`, verde `#1a7a50`/`#e8f4ec`, ámbar `#b45309`/`#faf3e6`, rojo `#b3261e`/`#fbeceb`.
- Tipografía: Bricolage Grotesque 600/700 (títulos, cifras), DM Sans 400/500/600 (texto). Añadir ambas en `src/lib/fonts.ts` vía `next/font/google`.
- Iconos: Material Symbols Rounded (Google Fonts), 18–22px, `FILL 1` para pestaña activa.
- Radios: 6 (badges), 10 (botones), 12 (inputs), 14–16 (tarjetas), 18–20 (tarjetas grandes), 999 (pills).
- Sombras: `0 8px 20px -10px rgba(13,110,96,.6)` (CTA), `0 30px 60px -30px rgba(12,33,29,.45)` (tarjeta elevada), `0 40px 90px -30px rgba(0,0,0,.7)` (hero).
- Espaciado: 4/6/8/10/12/14/16/24/28/32/48/96.

## Assets
- `public/images/hero-doctor2.jpg`, `public/images/reception.jpg` (ya en el repo). Reemplazar la foto del hero por una con licencia definitiva si se desea (pendiente del cliente).
- Datos de la Dra. Ana Jiménez (foto, dirección, exequátur, precios) son placeholders — pendientes del cliente.

## Archivos
- `EMR Frontpage.dc.html`
- `EMR Agendar.dc.html`
- `EMR App.dc.html`
- `support.js` (runtime de los prototipos; solo para abrirlos en el navegador)
