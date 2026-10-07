# Seguridad, privacidad y continuidad

Este documento resume cómo se protege la información clínica y qué falta verificar antes de producción. Tenga presente que se trata de **datos de salud**: en República Dominicana aplica la Ley 172-13 (protección de datos personales) y la Ley General de Salud 42-01 (confidencialidad del expediente). Revise con asesoría legal el aviso de privacidad, el consentimiento y el contrato con cada médico, que actúa como responsable del tratamiento mientras nosotros actuamos como encargados.

## 1. Aislamiento entre cuentas (multi-tenant)

| Control | Dónde | Prueba |
|---|---|---|
| Toda consulta de datos se filtra por el consultorio del usuario (deny-by-default) | `src/access/index.ts` | `isolation.int.spec.ts` |
| El `tenant` se fija en el servidor y lo que envíe el cliente se ignora | `src/hooks/tenant.ts` | `isolation.int.spec.ts` |
| Paciente y médico de una cita deben ser del mismo consultorio | `collections/Appointments.ts` | `mvp.int.spec.ts` |
| Consulta y paciente de una factura deben ser del mismo consultorio | `collections/Invoices.ts` | `mvp.int.spec.ts` |
| Una consulta solo se crea sobre una cita del mismo consultorio | `collections/Visits.ts` | `billing.int.spec.ts` |
| El panel `/admin` y la API REST de usuarios son solo para superadmin | `collections/Users.ts` | — |
| Las páginas cargan con `overrideAccess: false` y vuelven a comprobar el tenant (404 si no coincide) | páginas en `app/(frontend)` | — |

**Riesgo residual:** varias páginas de listado usan `overrideAccess: true` con un `where` por tenant escrito a mano. Son correctas hoy, pero un error futuro ahí filtraría datos. Al tocar una de esas consultas, prefiera `overrideAccess: false, user`.

## 2. Permisos por rol

Consulte la matriz en `docs/EVALUACION_MVP.md` §2. La confidencialidad clínica se aplica **por campo**:

- `patients.history` (antecedentes): lectura y escritura solo para roles clínicos.
- `visits.symptoms`, `visits.physicalExam` y `visits.notes`: lectura solo para roles clínicos.

**Decisión pendiente:** en modo clínica con varios médicos, todos los médicos del consultorio ven todas las consultas, como en Matab. Si se requiere "cada médico ve solo a sus pacientes", hay que añadir una regla de acceso por `doctor`.

## 3. Autenticación y sesiones

- Contraseñas con hash (Payload/pbkdf2). Mínimo 8 caracteres en el autoregistro.
- Bloqueo de 10 minutos tras 5 intentos fallidos. Sesión de 12 horas (`collections/Users.ts`).
- La cookie `payload-token` es `httpOnly`, `sameSite=lax` y `secure` en producción.
- Verificación de correo en el autoregistro (si hay `RESEND_API_KEY`). Los consultorios nuevos quedan **pendientes** hasta que un superadmin los aprueba.
- El titular no puede quitarse su propio rol ni desactivarse.

**Pendiente:**
- 2FA (TOTP) para titulares y superadmin.
- Rate limit del login por IP, además del bloqueo por cuenta.
- El rate limit del autoregistro es en memoria y confía en `X-Forwarded-For`. En producción detrás de un proxy, use la IP que entrega la plataforma, o un limitador compartido como Upstash o Vercel KV si hay varias instancias.

## 4. Cabeceras HTTP

Configuradas en `next.config.ts`:
- HSTS.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`.
- `poweredByHeader: false`.
- `Cache-Control: private, no-store` en `/dashboard/*` y `/print/*`.

**Pendiente:** Content-Security-Policy con nonce. Requiere ajustar los scripts en línea de Next y del panel de Payload.

## 5. Auditoría

Colección `auditLogs` append-only. Nadie, ni siquiera el superadmin, puede crear, editar ni borrar registros por la API. Solo escriben los hooks del servidor.

**Se registra:**
- Citas: creadas, canceladas y cambios de estado.
- Facturas anuladas y pagos registrados.
- Equipo: altas, desactivaciones y cambios de rol.
- Configuración y plan.
- Exportaciones de datos.
- Desde este MVP: **paciente creado o editado** y **consulta creada o editada**. Se guardan los *nombres* de los campos cambiados, nunca los valores, para que la auditoría no sea una segunda copia de datos clínicos.

**Pendiente:**
- Registrar *lecturas* de expedientes ("quién abrió la historia de X"). Algunas normativas lo exigen.
- Registrar inicios de sesión fallidos y exitosos.
- Política de retención de la auditoría.

## 6. Respaldos y recuperación

1. **Primaria:** MongoDB Atlas con *Cloud Backup* y restauración a un punto en el tiempo (PITR) activada.
2. **Secundaria, independiente del proveedor:** ejecute `scripts/backup.sh` cada noche:
   ```bash
   DATABASE_URL=... BACKUP_DIR=/ruta BACKUP_GPG_RECIPIENT=ops@dominio ./scripts/backup.sh
   ```
   Luego suba el archivo cifrado a almacenamiento externo (S3, Backblaze B2) con versionado.
3. **Probar la restauración cada mes** en una base aislada:
   ```bash
   mongorestore --archive=... --gzip --drop
   ```
   Anote el tiempo real de restauración (RTO) y la antigüedad máxima de datos (RPO).
4. Los registros clínicos **no se borran**: citas, consultas y facturas tienen `delete: denyAll` o solo superadmin.

## 7. Lista de verificación previa a producción

- [ ] `PAYLOAD_SECRET` de 32+ bytes aleatorios, distinto por entorno; `CRON_SECRET` configurado.
- [ ] MongoDB en replica set (Atlas), usuario de BD con permisos mínimos, IPs restringidas, TLS.
- [ ] Backups automáticos + `backup.sh` hacia almacenamiento externo + **restauración probada**.
- [ ] HTTPS forzado y dominio propio; confirmar que las cabeceras responden (`curl -I`).
- [ ] Cuenta superadmin con contraseña fuerte (y 2FA cuando exista); **borrar las cuentas demo** (`pnpm seed` se niega a ejecutarse en producción sin `FORCE_SEED=1`).
- [ ] `RESEND_API_KEY` con dominio verificado (SPF/DKIM) para correos de verificación y restablecimiento.
- [ ] Aviso de privacidad, términos de uso y contrato de encargado de tratamiento con cada médico.
- [ ] Monitoreo de errores (Sentry o similar) **sin** enviar datos clínicos en los eventos.
- [ ] Revisión de dependencias (`pnpm audit`) y actualización de Payload/Next.
- [ ] Ejecutar `pnpm test` contra una base de datos de pruebas separada. Hoy las pruebas usan la misma base que el desarrollo y la borran.
