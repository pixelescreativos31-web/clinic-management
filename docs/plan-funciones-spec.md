# Plan: funciones de la especificación que faltan en el código

Fecha: 25/11/2026 · Rama: `claude/medira-spec-features-a9f122` (sale de `bcda1ef`, rediseño «Clinical Calm»).
Fuente: especificación de medira (Claude Doc, secciones 1–21) comparada con el código actual.

## Reglas que aplican a todas las fases

- **Nada toca a los clientes actuales.** Todo cambio de esquema es aditivo: colecciones nuevas, o campos opcionales o con valor por defecto. Ninguna migración borra ni reescribe datos.
- Una función nueva que cambia cómo entra o trabaja una clínica existente (por ejemplo, la 2FA obligatoria) llega con un **periodo de gracia** y un aviso. No se le impone de golpe a nadie que ya use el sistema.
- Las claves de plan (`free`, `pro`, `clinic`, `plus`, `public`) y de rol que ya están guardadas no se renombran. Solo cambian las etiquetas en pantalla.
- Cada fase lleva pruebas de integración en `tests/int`, deja `tsc --noEmit` limpio y termina en un commit. Las pruebas corren solo contra una Mongo desechable.
- Toda integración externa (PayPal, IA, WhatsApp) va detrás de un **adaptador**. En las pruebas y en desarrollo se usa uno falso. Sin credenciales, la función se ve como «no disponible» y nada falla.
- Diseño: tokens de `globals.css`, `AppHeader`/`AppContent` y `BRIEF_REDISENO.md`. Sin iconos decorativos. El rojo es solo para alertas clínicas.

## Qué hay hoy y qué falta

| Área | Hoy en el código | Falta según la especificación |
|---|---|---|
| Seguridad (§10) | Bloqueo de 10 min tras 5 intentos fallidos. Sesión de 12 h. Contraseña de 8 caracteres o más, que solo se exige al registrarse y al restablecerla. | 2FA con app autenticadora y 10 códigos de respaldo, obligatoria para el Titular y el Administrador. «Recordar este dispositivo» por 30 días. Mínimo de 10 caracteres. Cierre por inactividad. Sesiones activas. Pedir 2FA otra vez en acciones delicadas. |
| Roles (§1, §10) | superAdmin, owner (Titular), doctor, therapist, receptionist (Asistente). | **Administrador** y **Contador**. Tabla de permisos «quién ve qué». |
| Planes y cuotas (§2) | `PLAN_LIMITS` y `PLAN_QUOTAS` (estudios IA, WhatsApp, óptica, almacenamiento), con `assertQuota` y `recordUsage` listos pero sin uso real. Página «Mi plan» con barras. | Cuotas de **consultas dictadas**, **resúmenes con IA** y **recordatorios por correo (Gratis)**. **Paquetes de cuota** (90 días) y complementos. Pantalla de uso completa: dos grupos, 80 % en amarillo, 100 % con «Comprar paquete». Avisos al 80 % y al 100 %. |
| Prueba y cobro (§3) | La mejora de plan es una solicitud que aprueba a mano el súper admin. No hay pasarela. El registro deja la clínica «pendiente». | **Prueba de 3 días** en los planes de pago. **PayPal Suscripciones** con webhook verificado. Estados de suscripción. Cobranza de 10 días que termina bajando a Gratis. Recibos. Pago único de paquetes. |
| WhatsApp (§5) | Solo enlaces manuales `wa.me`. | Número propio de cada clínica a través de un **BSP** (Meta Embedded Signup). Plantillas. Recordatorios automáticos con botones Confirmar, Cancelar y Cambiar hora. Webhook. Horario silencioso. Cuota. |
| IA (§11, §13) | Nada. | **Dictado de consultas**: grabar, transcribir y llenar un borrador que el médico revisa campo por campo. Consentimiento del paciente. Celular y PC enlazados. Luego, resúmenes con IA. |
| Contabilidad (§12) | Facturas con pagos parciales y método «Seguro (ARS)». Informes mensuales y exportación CSV. | **Caja** con apertura, arqueo y cierre. **Gastos** y proveedores. **ARS** con autorización, cobertura, reclamaciones y conciliación. **Honorarios** por médico. Cuentas por cobrar por antigüedad. |
| Turnos (§21) | Turno del día para pacientes sin cita (T-01…), que puede repetirse. Estado «En sala». | Servicios, puestos y filas. Contador atómico. Consola de atención. **Pantalla de TV con voz**. Página del turno para el paciente. Kiosco. Flujo en vivo. |
| Soporte («Ver como», §16.10) | Nada. | El súper admin entra a una cuenta solo con permiso del Titular, por 24 h, en solo lectura, con los datos clínicos ocultos y una franja visible. |

La página de inicio (`src/components/HomeLanding.tsx`) **ya promete** cosas que no existen: 2FA con app y 10 códigos (:462, :468), consultas dictadas con IA (:324), confirmación por WhatsApp (:350), «3 días gratis» (:515, :543, :685), caja con arqueo (:439) y aviso de 10 días antes de bajar a Gratis (:144). Por eso esas funciones van primero.

## Fases (ordenadas por valor y riesgo)

### Fase 1: Verificación en dos pasos (2FA) y contraseñas

Va primero porque la página la promete, no depende de ningún proveedor externo y es la más barata de construir.

- **TOTP (RFC 6238)** implementado con `node:crypto`, sin dependencias. El secreto se guarda cifrado con AES-256-GCM, con una llave derivada de `PAYLOAD_SECRET`.
- **Flujo de activación:** QR y clave manual, confirmar con un código, y 10 códigos de respaldo de un solo uso (se guarda su hash). La pantalla no deja seguir hasta marcar «Ya los guardé».
- **Inicio de sesión en dos pasos.** El hook `beforeLogin` rechaza el login de quien tenga 2FA activa, salvo que el código ya se haya verificado. Esto cierra también el atajo de `/api/users/login`. La acción de login verifica la contraseña, crea un reto firmado de 5 minutos y pide el código. Con el código correcto se emite la sesión normal de Payload.
- **«Recordar este dispositivo 30 días»:** cookie firmada, desmarcada por defecto.
- **Obligatoria para el Titular.** Las clínicas nuevas la activan en el registro. Las clínicas existentes ven un aviso con «Activar ahora» y tienen un periodo de gracia (propuesta: 14 días) antes de que se les exija.
- **Seguridad de la clínica (Titular):** «Exigir 2FA a todo el equipo», ver quién la tiene y «Restablecer 2FA» de un miembro. Esta última acción pide la 2FA del Titular y queda en Auditoría.
- **Mi seguridad:** activar o desactivar (desactivar pide código), regenerar códigos de respaldo y cambiar la contraseña.
- **Contraseñas:** mínimo de 10 caracteres para las contraseñas **nuevas** (registro, restablecimiento, personal nuevo y cambio). Las contraseñas actuales siguen sirviendo.
- **Campos nuevos (opcionales) en `users`:** `twoFactor { enabled, secretEnc, backupCodes[{hash, usedAt}], enabledAt }` y `twoFactorRequiredAt`.
- **Campos nuevos en `tenants`:** `settings.security { require2faAll, twoFactorGraceUntil }`.
- **Auditoría:** acciones nuevas `2fa.enable`, `2fa.disable`, `2fa.reset` y `2fa.backup_used`.
- **Pruebas:** el código TOTP con su ventana de ±30 s, códigos de respaldo de un solo uso, login bloqueado sin código (también por la API), periodo de gracia y aislamiento entre clínicas.

### Fase 2: Uso de cuotas y paquetes (sin cobro todavía)

- Recursos nuevos: `aiDictations`, `aiSummaries` y `emailReminders` (este último solo en Gratis), con los valores de §2 en `PLAN_QUOTAS`.
- Colección **`quotaPacks`**: clínica, recurso, unidades, usadas, vence (90 días), origen (`paypal`, `admin` o `gift`). `effectiveQuota()` suma la cuota del mes más los paquetes vigentes. Se gasta primero la cuota del mes y después el paquete que vence antes.
- **Pantalla de uso** («Mi plan → Uso»), en dos grupos:
  - «Topes de su cuenta»: médicos, usuarios, pacientes y almacenamiento.
  - «Cuotas de este mes», con «Se reinicia el 1 de …».
  - Barras en amarillo al 80 % y al 100 %, con los botones «Comprar paquete» y «Mejorar plan» y los textos exactos de §2.
- Correo y aviso al Titular al llegar al 80 % y al 100 %, una sola vez por periodo. Usa el campo nuevo `notifiedAt` en `usageCounters`.
- El súper admin puede regalar o asignar paquetes. Esto deja todo listo para venderlos en la Fase 3.

> Diferencias con la especificación que hay que confirmar: Gratis tiene hoy 10 estudios con IA y 2 GB (la especificación dice 5 y 1 GB), y Consultorio tiene 50 GB (la especificación dice 100 GB). **Bajar cuotas afectaría a cuentas reales**, así que propongo dejarlas como están hasta que usted lo decida.

### Fase 3: Prueba gratis y PayPal

- **Adaptador de pasarela** (`src/lib/billing/gateway.ts`) con PayPal Suscripciones y una versión falsa para las pruebas. Variables de entorno: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` y `PAYPAL_ENV`, solo en `.env`.
- **Campos nuevos en `tenants`:** `billing { subscriptionId, subscriptionStatus, billingPlan, interval, trialUsed, trialEndsAt, currentPeriodEnd, pastDueSince, downgradedAt, payerEmailMasked }`.
- **Colecciones nuevas:**
  - `billingEvents`: id del evento (único, para no aplicar un aviso dos veces), tipo, clínica, procesado y error.
  - `billingReceipts`: recibos `MED-2026-000123`.
- **Pantallas:** planes con interruptor mensual/anual, resumen antes de PayPal («hoy paga US$0»), vuelta de PayPal (confirmando, éxito o no completado), cancelar con motivo y oferta de bajar de plan, y «Recuperar mi plan».
- **Webhook** `/api/billing/paypal/webhook`, verificado con `verify-webhook-signature`. Un aviso fuera de orden nunca deshace uno más nuevo.
- **Trabajo diario de cobranza** dentro del cron que ya existe: avisos los días 3, 7 y 9, y bajada a Gratis el día 10 sin borrar nada.
- **Una sola prueba** por clínica, correo, teléfono y RNC.
- **Pago único de paquetes** con PayPal Orders.
- **Las clínicas actuales no cambian:** sin `billing.subscriptionId` siguen con el plan que les asignó el súper admin («plan manual»). Ninguna baja a Gratis.
- **Pruebas:** con la pasarela falsa (sin red), avisos duplicados o fuera de orden, el calendario de cobranza y la bajada a Gratis manteniendo todos los datos.

**Estado (hecho):**

- Para activarlo en producción hacen falta, en `.env`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` (`sandbox` o `live`) y `PAYPAL_PLAN_IDS`.
  - `PAYPAL_PLAN_IDS` es un JSON con los planes creados en PayPal, por ejemplo `{"pro.month.trial":"P-…","pro.month":"P-…","pro.year.trial":"P-…",…}`.
  - Son dos planes por plan y ciclo: uno con 3 días de prueba y otro sin prueba. El anual cuesta 10 meses.
  - En PayPal, el webhook apunta a `/api/billing/paypal/webhook`.
- Sin esas variables, nada cambia: se mantiene el flujo de «Solicitar mejora».
- Para una demostración local: `BILLING_GATEWAY=fake` (pasarela falsa que aprueba sola). Esta pasarela nunca funciona con `NODE_ENV=production`.
- Además de lo planeado:
  - Colección `trialClaims` con hashes, para la regla de una sola prueba. También se aplica por cuenta de PayPal.
  - `users.planSuspendedAt`: al bajar a Gratis se cierran las sesiones del personal y no pueden entrar. Al volver a pagar se reactivan.
- El aviso fuerte de cobranza (día 3 en adelante) usa ámbar sólido, no rojo, porque el rojo es solo para alertas clínicas (`globals.css`).
- **Pendiente:**
  - Prorrateo al cambiar de plan. Hoy la suscripción nueva reemplaza a la anterior y PayPal no prorratea.
  - Contratar un plan pagado desde el registro.
  - Consola de cobros del súper admin.
  - Cupones.
  - Avisos de cobranza por WhatsApp (Fase 5).

### Fase 4: Consultas dictadas con IA

- Botón «Dictar» en la consulta: el navegador graba con `MediaRecorder`, pide primero la casilla de consentimiento del paciente y sube el audio.
- **Adaptador de IA** en dos pasos:
  1. Transcribir el audio a texto (español).
  2. Pasar el texto a los campos de la ficha de la especialidad, con un modelo Claude y salida estructurada.
- El borrador se guarda marcado como «Generado por IA · revisar». El médico acepta, edita o descarta cada campo.
- Cuota `aiDictations`: cuenta 1 por paciente por día y solo cuando el borrador sale bien.
- **Colección nueva `dictations`:** consulta, estado, duración, consentimiento, borrador y error. El audio se borra al firmar o a los 30 días.
- «Dictar con mi celular» (QR de un solo uso y tiempo real) queda para una subfase **4b**.
- **Pruebas:** con el adaptador falso, la cuota, el consentimiento obligatorio y que el personal no pueda dictar.

### Fase 5: WhatsApp con el número de la clínica (BSP)

- **Colecciones nuevas:**
  - `whatsappConnections`: clínica, proveedor, wabaId, phoneNumberId, número, nombre visible, estado, calidad y token cifrado.
  - `whatsappTemplates`: estado de cada plantilla en Meta.
  - `messageLog`: mensaje enviado o fallido, si contó en la cuota y si se usó correo como respaldo.
- **Configuración → Mensajes y WhatsApp → «Conectar WhatsApp»**, con Meta Embedded Signup, la tarjeta del número, «Enviar mensaje de prueba» y «Desconectar».
- **Recordatorios automáticos** de 5 días, 1 día y 2 horas antes, en el cron. Respetan el horario silencioso (21:00–07:00) y el consentimiento del paciente (campo nuevo `patients.whatsappOptIn`).
- **Webhook** de botones: confirmar la cita (estado nuevo `confirmed`), cancelarla o cambiar la hora. «BAJA» desactiva el envío a ese paciente.
- La cuota `whatsappMessages` se descuenta solo cuando Meta acepta el mensaje. Si el mensaje falla o la cuota se acabó, se pasa a correo o al envío manual.
- **Bloqueado por una decisión suya:** el BSP (360dialog, Twilio u otro). Mientras tanto se desarrolla contra la cuenta de prueba de Meta y un adaptador falso.

### Fase 6: Roles Administrador y Contador, y acceso de soporte («Ver como»)

- **Roles nuevos** `admin` y `accountant`, que solo se agregan a la lista actual.
  - El Administrador hace todo lo del Titular menos el plan, el pago, cerrar la cuenta y transferirla. Ve historia clínica solo si atiende pacientes. 2FA obligatoria.
  - El Contador ve caja, facturas, informes y gastos. Nunca ve datos clínicos.
- Revisión de cada `access` y `requireRole`, más el menú por rol de `Sidebar.tsx`.
- **Pruebas de aislamiento por rol:** el Contador no puede leer consultas ni pacientes clínicos, y el Administrador no puede cambiar el plan.
- **Acceso de soporte («Ver como»):** el Titular da permiso por 24 h en Configuración → Accesos de soporte. El súper admin entra en solo lectura, con «Contenido clínico oculto para soporte» y una franja visible para la clínica. Todo queda en Auditoría. Colección nueva `supportGrants`.

### Fase 7: Contabilidad (caja, gastos, ARS, honorarios)

- **Caja:** colección `cashSessions` (cajero, sucursal, apertura con monto inicial, cierre con monto contado, esperado, diferencia y nota). Los pagos nuevos se ligan a la caja abierta. Los cobros anteriores quedan sin caja y siguen funcionando.
- **ARS:** campos opcionales en `invoices`: `insurance { ars, authorizationNumber, coveredAmount, patientAmount }`. Colección `insuranceClaims` con lote por ARS y periodo, estado (por enviar, enviada, pagada o glosada) y conciliación.
- **Gastos:** colecciones `expenses` (categoría y foto del comprobante) y `suppliers`.
- **Honorarios:** colección `feeRules` (porcentaje o monto fijo por médico y servicio) y liquidación por periodo, calculada a partir de las facturas.
- **Cuentas por cobrar** por antigüedad (0–30, 31–60, 61–90 y más de 90 días), calculadas con los `balanceDue` que ya existen.
- Sin impuestos: no hay NCF ni ITBIS. Solo el campo de referencia «Comprobante fiscal emitido fuera de medira».
- Candados por plan según §2.

### Fase 8: Turnos y pantalla de sala

- **Colecciones nuevas:**
  - `queueServices`: letra, color, tipo y duración.
  - `servicePoints`: puestos, con el nombre que dice la voz.
  - `queueTickets`: número, estado, paso, prioridad, llamados y horas.
  - `queueCounters`: contador atómico con `$inc`, para que no se repitan números.
- **Consola de atención:** llamar siguiente, volver a llamar, enviar a otro puesto, no respondió y deshacer.
- **Pantalla de TV** `/sala/[token]`, con sonido y voz por `speechSynthesis` en español. Página del turno para el paciente, sin cuenta.
- La cita y el turno son el mismo registro: Llegó, En espera, Llamado, En consulta, Atendido.
- El turno sin cita que existe hoy pasa a usar el contador atómico, sin cambiar los números que ya se dieron.

## Fuera de este plan por ahora

Recetas con folio y QR (§15), fotos clínicas con almacenamiento medido (§14), resúmenes médicos con IA (§11, después de la Fase 4), sucursales, reserva en línea completa, notificaciones en la app, importar desde Excel y la consola completa del súper admin (§16.10). Se pueden sumar como fases 9 en adelante.

## Decisiones que necesito de usted

1. **2FA en las clínicas actuales:** ¿14 días de gracia con un aviso, y después obligatoria para el Titular?
2. **Proveedor de transcripción para el dictado:** puede ser OpenAI, Deepgram u otro que firme no guardar datos. Claude no transcribe audio, pero sí puede llenar la ficha a partir del texto.
3. **BSP de WhatsApp**, para la Fase 5.
4. **Cuotas de Gratis y Consultorio:** ¿se igualan a la especificación o se quedan como están?
5. **«Ver como»:** ¿es el acceso de soporte del súper admin (§16.10) o una vista previa del Titular de lo que ve cada rol?
