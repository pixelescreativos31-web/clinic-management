# Brief del rediseño (léase antes de tocar una pantalla)

Fuente visual: `README.md` (tokens) y los `.dc.html` de esta carpeta. Fuente funcional: el código actual.
El paquete se hizo con una especificación vieja. Donde choque, MANDA ESTO:

1. **Solo interfaz.** No cambies colecciones de Payload, hooks, acciones del servidor, validaciones, permisos ni datos. Las pantallas deben seguir haciendo exactamente lo mismo. Hay clínicas reales en producción.
2. **Sin impuestos.** Nada de NCF, e-CF, 606/607, ITBIS en cobros de clínicas ni «datos fiscales». Si la pantalla actual no lo tiene, no lo agregues.
3. **Roles y términos:** Titular (no «Dueño»), Médico, Terapeuta, Asistente (no «Recepción»), Súper admin. Menú: Panel, Agenda, Pacientes, Caja, Informes, Equipo, Auditoría, Configuración, Mi plan.
4. **Estados de cita:** Programada (borde gris), Confirmada (azul claro, si existiera), En sala (fondo azul #1d4ed8), En consulta (fondo primario), Atendida (verde: el verde es SOLO para Atendida/Pagada/Firmada), No asistió (fondo tinta #1c1917), Cancelada (hundido). Usa `apptStatusStyle` (src/lib/apptStatus.ts) y `StatusBadge` (src/components/ui-kit.tsx), ya actualizados.
5. **Notas:** si la pantalla tiene «notas privadas», el texto visible es «Nota personal».
6. **Precios:** los de `src/lib/plans.ts` (PLAN_LIMITS / PLAN_QUOTAS), nunca los del paquete.
7. **Rojo #b91c1c solo para alergias y valores críticos.** Eliminar/anular usa tinta (`btnDanger` ya es tinta). Errores de formulario en ámbar #b45309.
8. **Sin íconos decorativos:** toda acción lleva texto. Quita los íconos de los botones y menús que rediseñes (puedes dejar los imprescindibles de un control, p. ej. flechas de calendario).
9. **Tokens:** fondo #fafaf7, superficie #fff, hundido #f0eeec, línea #e7e5e4, línea-2 #f0eeec (separador de filas), línea-3 #d6d3d1 (borde de campo/botón secundario), tinta #1c1917, apagado #57534e, primario #0f766e (hover #115e59), profundo #042f2e, info #1d4ed8, ok #15803d, aviso #b45309. Clases Tailwind disponibles: bg-sunken, border-line-3, bg-inv, bg-deep, text-deep-muted, etc. Geist es la fuente (`font-sans`; `font-mono` para folios/códigos). `tabular-nums` en toda cifra.
10. **Forma:** radios 6 insignias, 8 botón pequeño, 10 botones/campos, 12 tarjetas, 14–16 hojas. Bordes de 1px, sin sombras (salvo hojas/modales). Botones 44px de alto, campos 44–48, etiqueta de campo 12–13/500 arriba. Título de pantalla en `AppHeader` (17/600). Título de tarjeta 15–17/600. Nada clínico por debajo de 13px. Campos a 16px en teléfono.
11. **Estructura de página del dashboard:** usa `AppHeader` (título, `backHref` para vistas hijas, `actions`) y `AppContent` (ancho máx. 1080, 860 en consulta) de `src/components/AppHeader.tsx`. NO edites `AppHeader.tsx`, `Sidebar.tsx`, `primitives.tsx`, `ui-kit.tsx`, `ui/*`, `globals.css` ni `apptStatus.ts`: son compartidos. Si tu página pasa a renderizar su propio `AppHeader`, anótalo en tu informe con la regex de ruta para que la agreguen a `REDESIGNED`.
12. **Estados:** cada lista con estado vacío (una línea + una acción), y los errores existentes en ámbar.
13. **Responsive:** sin desplazamiento horizontal de página a 375px; tablas con scroll horizontal dentro de su tarjeta.
14. No hagas commits. Verifica con `npx tsc --noEmit -p .` (debe quedar limpio). No arranques otro servidor: ya corre uno en http://localhost:3000 (puedes usar `curl -s` para comprobar que la ruta responde 200/307).
