# Consultorio — gestión simple para médicos independientes

SaaS económico (≈ US$10/mes por médico) para consultorios pequeños: agenda de citas,
expediente e historia clínica, recetas imprimibles, facturación simple, recordatorios
por WhatsApp y acceso para la asistente. Interfaz 100 % en español, pensada para
República Dominicana y Latinoamérica.

> El nombre del producto es configurable (`NEXT_PUBLIC_APP_NAME`); "Consultorio" es
> un nombre provisional.

Construido sobre [Matab — Clinic Management](https://github.com/abdulrehmankz1/clinic-management)
de Abdul Rehman (licencia MIT): Payload CMS 3 + Next.js 16 + MongoDB, multi-tenant.

## Documentación

- **[docs/EVALUACION_MVP.md](docs/EVALUACION_MVP.md)** — evaluación de Matab, qué se
  reutilizó, cambios del MVP, arquitectura para crecer y hoja de ruta.
- **[docs/SEGURIDAD.md](docs/SEGURIDAD.md)** — aislamiento entre cuentas, permisos,
  auditoría, respaldos y lista de verificación antes de producción.

## Funciones

- **Médico independiente primero:** la titular de la cuenta es la doctora (aparece en
  la agenda, firma recetas). Menú simplificado; modo "clínica" disponible para crecer.
- **Agenda:** lista y línea de tiempo, anti-doble reserva transaccional, pacientes sin
  cita con turno, recordatorio por WhatsApp en un clic.
- **Expediente:** cédula, seguro (ARS), contacto de emergencia, alergias destacadas y
  antecedentes (solo personal clínico).
- **Consulta:** motivo, historia de la enfermedad actual, 9 signos vitales + IMC,
  examen físico, diagnóstico, receta, plan, estudios, próxima cita y notas privadas.
  "Atender ahora" desde el expediente; edición auditada.
- **Receta A5** con membrete, exequátur, datos del paciente y firma.
- **Facturación y pagos**, recibos, reportes mensuales y exportación CSV auditada.
- **Planes y límites** (Prueba / Profesional / Clínica / Plus), autoregistro con
  aprobación, consola de superadministrador, registro de auditoría inmutable.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env          # complete PAYLOAD_SECRET
docker compose up -d          # MongoDB en replica set (requerido para transacciones)
pnpm seed                     # datos demo dominicanos
pnpm dev                      # http://localhost:3000
```

### Accesos demo (contraseña `password123`)

| Rol | Correo |
|---|---|
| Doctora titular (consultorio individual) | `doctora@demo.app` |
| Asistente | `asistente@demo.app` |
| Titular de clínica (varios médicos) | `owner@clinica.app` |
| Médico de la clínica | `doctor1@clinica.app` |
| Superadministrador | `super@clinic.app` |

## Pruebas

```bash
pnpm test        # pruebas de integración (aislamiento, agenda, facturación, planes, MVP…)
```

> Las pruebas usan y **borran** la base de datos de desarrollo; ejecute `pnpm seed` después.

## Respaldos

```bash
DATABASE_URL=... ./scripts/backup.sh   # mongodump comprimido, verificación y retención
```

## Créditos y licencia

Basado en [matab — Clinic Management](https://github.com/abdulrehmankz1/clinic-management)
por [Abdul Rehman](https://github.com/abdulrehmankz1). Licencia MIT — ver [LICENSE](LICENSE).
