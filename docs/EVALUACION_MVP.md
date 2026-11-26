# Evaluación de Matab y plan del MVP

Producto: SaaS económico para médicos independientes. Cliente inicial: una doctora con su consultorio y, opcionalmente, una asistente. Precio objetivo: ~US$10/mes por médico.

Base: [Matab — Clinic Management](https://github.com/abdulrehmankz1/clinic-management) (MIT). Se conserva el aviso de licencia y el crédito (`BASED_ON` en `src/lib/brand.ts`, pie de la landing y `LICENSE`).

---

## 1. Qué trae Matab y qué hicimos con cada parte

| Módulo | Estado en Matab | Decisión MVP | Notas |
|---|---|---|---|
| Multi-tenant (consultorios aislados) | Sólido: access control deny-by-default, `forceTenant`, pruebas de aislamiento | **Reutilizar tal cual** | Se reforzó con validación de relaciones entre consultorios (ver §4) |
| Usuarios y roles (owner/doctor/receptionist/superAdmin) | Completo | **Reutilizar + adaptar** | Nuevo concepto *médico titular*: el owner puede atender (`practitioner`) |
| Pacientes | Básico (nombre, teléfono, sexo, edad, alergias) | **Ampliado** | Cédula/pasaporte, correo, dirección, ocupación, seguro (ARS), contacto de emergencia, antecedentes |
| Citas / agenda | Muy bueno: vista lista + línea de tiempo, anti-doble reserva transaccional, disponibilidad por médico, sin cita con turno | **Reutilizar + simplificar** | Con un solo médico se oculta el paso "Médico" y el panel de horarios; agendar desde el expediente |
| Consultas (historia clínica) | Síntomas, diagnóstico, signos vitales básicos, receta | **Ampliado** | Motivo, HEA, examen físico, plan, estudios, notas privadas, 9 signos vitales + IMC, edición auditada |
| Recetas imprimibles | A5 por `window.print()` | **Rehecha en español** | Membrete del médico, exequátur, cédula, seguro, alergias, indicaciones, estudios, firma |
| Facturación y pagos | Completo (totales derivados, anulación, pagos parciales, recibo) | **Reutilizar** | Se agregó método de pago "Seguro médico (ARS)" y RNC del consultorio |
| Reportes / exportación CSV | Completo con auditoría de exportación | **Reutilizar** | Traducido; ingresos del mes y por médico |
| Planes y límites | Código + hook `enforcePlanLimit` + flujo de solicitud de mejora | **Reutilizar** | Nuevo plan `pro` (US$10/mes). Precios visibles; cobro real pendiente |
| Auditoría | Append-only, solo escribible por hooks | **Reutilizar + ampliar** | Nuevas acciones: paciente creado/editado, consulta creada/editada (registra campos cambiados, no valores) |
| Autoregistro + aprobación | Transaccional, honeypot, rate limit | **Reutilizar** | Paso nuevo: "¿Médico independiente o clínica?", especialidad y exequátur |
| Recordatorios WhatsApp (`wa.me`) + resumen diario por correo | Funcional, sin costo de API | **Reutilizar** | Mensaje en español y números dominicanos (809/829/849 → +1) |
| Consola superadmin | Funcional | **Reutilizar** | Traducida |
| Panel de Payload (`/admin`) | Solo superadmin | **Reutilizar** | En español (`i18n`) |

**Conclusión:** ~85 % del código se reutiliza directamente. El trabajo del MVP fue traducir y localizar, simplificar para un solo médico, ampliar el expediente clínico y cerrar varios huecos de seguridad. No hubo que reescribir ningún módulo central.

---

## 2. Cambios realizados en esta iteración

### Idioma, localización y marca
- Toda la interfaz, los correos, los mensajes de error, el CSV y el panel admin están en español (trato de *usted*).
- Formatos `es-DO`: `RD$1,500`, `mié, 7 oct · 11:26 a. m.`; calendario en español con la semana empezando en lunes.
- Valores por defecto: República Dominicana, DOP, `America/Santo_Domingo`, citas de 20 min, 08:00–18:00. Monedas y zonas horarias de LatAm y España.
- **Marca configurable**: el nombre del producto sale de `NEXT_PUBLIC_APP_NAME` (por defecto "Consultorio"). Ningún texto lo tiene escrito a mano. Ver `src/lib/brand.ts`.
- Paleta propia "azul clínico" (tokens en `globals.css`), en lugar del verde azulado de Matab.

### Experiencia para la doctora independiente
- **Médico titular**: en un consultorio individual, la cuenta titular *es* la doctora. Aparece en la agenda, firma recetas y cuenta como el médico del plan. No hace falta crear un "usuario médico" aparte (`src/lib/practice.ts`).
- **Tipo de práctica** (`individual` | `clinic`) por consultorio. En modo individual el menú se simplifica: Inicio, Agenda y Pacientes, más un bloque de administración con Reportes, Asistente, Auditoría, Mi plan y Configuración.
- **"Atender ahora"** desde el expediente: abre la consulta sin agendar antes (crea una llegada sin cita y la marca en espera).
- Agendar desde el expediente precarga el paciente. Con un solo médico desaparece el paso de elegir médico.
- Configuración → **Mi perfil médico**: activar "Atiendo pacientes", especialidad, exequátur, tarifa, días y horario.
- Datos demo dominicanos: `doctora@demo.app` (titular que atiende), `asistente@demo.app` y `owner@clinica.app` (modo clínica). Todos usan la contraseña `password123`.

### Historia clínica
- Expediente con pestañas: **Historia clínica** (antecedentes y consultas completas), Resumen, Citas y Facturas.
- Formulario de consulta en 5 pasos:
  1. Motivo de consulta y HEA.
  2. Signos vitales con IMC calculado.
  3. Examen físico y diagnóstico.
  4. Receta con cantidad a dispensar.
  5. Plan, estudios, próxima cita y notas privadas.
- Mientras se consulta se ven las alergias y el resumen de enfermedades crónicas y medicamentos del paciente.
- Las consultas se pueden **editar** después. Cada edición queda en la auditoría con los campos cambiados.

### Roles y permisos
| Acción | Titular | Médico | Asistente |
|---|---|---|---|
| Agenda, pacientes (datos generales), cobros | ✅ | ✅ | ✅ |
| Antecedentes del paciente | ✅ | ✅ | ❌ (ni lee ni escribe) |
| HEA, examen físico, notas privadas de la consulta | ✅ | ✅ | ❌ (puede ver diagnóstico y receta para imprimir) |
| Registrar / editar consultas | ✅ | ✅ | ❌ |
| Anular facturas, equipo, configuración, plan, auditoría, reportes | ✅ | ❌ | ❌ |

La restricción es **a nivel de campo en Payload**, así que aplica en todas las rutas (UI, API REST, GraphQL), no solo en pantalla.

---

## 3. Arquitectura preparada para crecer

- **Un consultorio = un tenant.** Varios médicos dentro del mismo tenant ya funcionan (modo `clinic`). Pasar de individual a clínica es cambiar un ajuste, sin migrar datos.
- **El modelo de practicante** (`isPractitioner` / `practitionerWhere`) es el único punto que decide "quién atiende". Agenda, reportes, plan y validaciones lo usan.
- **Planes en código** (`src/lib/plans.ts`):

  | Plan | Médicos | Pacientes | Precio |
  |---|---|---|---|
  | `free` (Prueba) | 1 | 50 | Gratis |
  | `pro` (Profesional) | 1 | ilimitados | US$10/mes |
  | `clinic` | hasta 5 | ilimitados | US$10 por médico |
  | `plus` | ilimitados | ilimitados | US$10 por médico |

  Los límites se aplican en hooks del servidor.
- **Pendiente para multi-clínica real** (un médico que trabaja en dos consultorios): hoy un usuario pertenece a un solo tenant. La evolución natural es una colección `memberships (user, tenant, role)` y un selector de consultorio. El diseño actual de acceso (`getTenantID`) es el único lugar que habría que cambiar.

---

## 4. Seguridad (resumen; detalle en `docs/SEGURIDAD.md`)

**Corregido en esta iteración:**
- **Referencias cruzadas entre consultorios.** Una cita o factura podía apuntar a un paciente o médico de *otro* consultorio, porque el id viene del cliente. Ahora se valida en los hooks de la colección, y el agendado ya no revela el nombre de un médico ajeno.
- **Datos clínicos y la asistente.** La asistente ya no puede leer los antecedentes ni la narrativa clínica.
- **Bloqueo de cuenta.** Se bloquea 10 min tras 5 intentos fallidos y la sesión expira a las 12 h.
- **Cabeceras de seguridad y caché.** HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`. `no-store` en `/dashboard` y `/print`.
- **Autobloqueo del titular.** El titular no puede quitarse su propio rol ni desactivarse.
- **Auditoría de expedientes y consultas.** Guarda los nombres de los campos cambiados, no los valores.
- **Respaldos.** Script `scripts/backup.sh` con `mongodump`, compresión, cifrado GPG opcional, verificación y retención.

**Pruebas:** `tests/int/mvp.int.spec.ts` cubre estas garantías. La suite completa tiene 112 pruebas.

---

## 5. Hoja de ruta sugerida

### Antes de producción (bloqueante)
1. Revisar y completar `docs/SEGURIDAD.md`, que incluye la lista de verificación previa a producción.
2. MongoDB Atlas (replica set) con backups automáticos + `scripts/backup.sh` diario hacia almacenamiento externo; **probar una restauración**.
3. `PAYLOAD_SECRET` y `CRON_SECRET` fuertes; `RESEND_API_KEY` y dominio verificado para correos.
4. Definir el nombre comercial y dominio (`NEXT_PUBLIC_APP_NAME`), política de privacidad y términos.
5. Rehacer capturas/demos de la landing (siguen mostrando la UI anterior en inglés).

### MVP+ (primeras semanas)
- Cobro de la suscripción (Stripe / PayPal; para RD evaluar AZUL o CardNET) y periodo de prueba con fecha de vencimiento.
- Documentos adicionales: certificado médico, indicación de estudios en hoja aparte, referimiento.
- Recordatorios automáticos por WhatsApp Business API (hoy son enlaces `wa.me` manuales).
- Plantillas de receta/consulta frecuentes y catálogo de medicamentos.
- Adjuntos (resultados de laboratorio, imágenes) con almacenamiento cifrado.
- Numeración de comprobantes fiscales (NCF) si la doctora factura con comprobante.

### Más adelante
- Membresías multi-consultorio, portal del paciente, agenda pública para reservar en línea, CIE-10 para diagnósticos.

---

## 6. Cómo ejecutar

```bash
pnpm install
cp .env.example .env            # complete PAYLOAD_SECRET
docker compose up -d            # MongoDB replica set
pnpm seed                       # datos demo dominicanos
pnpm dev                        # http://localhost:3000
pnpm test                       # 112 pruebas de integración (borran la BD de desarrollo)
```
