# Siguiente bloque aprobado en el plan, pendiente de aprobar el arte

No está implementado en esta entrega artística. Mantener este contrato al continuar:

- Cuatro ataques iniciales desbloqueados/equipados: mini-squat, knee-pushup, birddog, short-superman. No inventar evidencia física. Cuatro slots al entrar a la torre infinita.
- Cada tercer piso superado de CADA expedición concede una oportunidad para elegir una prueba de habilidad elegible. Repetir expediciones vuelve a conceder oportunidades. Oportunidades pendientes persistentes; fallar no las consume; liquidación idempotente.
- Pruebas por profundidad del árbol: 4/6/8 repeticiones o 6/10/15 segundos, alternancia par, cadencia controlada específica y descansos libres.
- Nueva semilla por expedición; generación reproducible al reanudar. Variedad de identidad/equipo/tipo/patrón en enemigos normales, sin arquetipo consecutivo idéntico. No afirmar infinitos sprites distintos.
- Jefe cada5pisos:19identidades en5–95, un jefe centenario en100. Repetir ciclo en105–200 con dificultad acotada.
- Cada jefe concede UNA elección: mejora temporal de ataque equipado (+10% potencia base, tope+50% por ataque/expedición) O oportunidad de prueba Flash. Recuperación completa si todos los ataques alcanzan el límite.
- Flash requiere ataque base conocido y oportunidad ganada al jefe. Variante permanente tras prueba, ocupa el mismo slot y no puede duplicarse con versión normal. Lista inicial squat/pushup. No aplicar a yoga/estabilidad/holds.
- Flash:3ciclos válidos de referencia personal, prueba6repeticiones válidas de calidad/cadencia. Bonus hasta×1.25 con banda de cadencia acotada; mayor velocidad fuera de banda no da más daño. Eventos con inicio/final del movimiento completo, pausas y seguimiento perdido excluidos. Manual no inventa bonus de velocidad detectada.
- Training Grounds:30ejercicios disponibles inmediatamente independientemente del repertorio de combate. Entrenar no desbloquea ataques/especializaciones/Flash por sí mismo. Conservar modos manual/cámara y procedencia.
- Versionar partidas de Battle Tower conservando progreso; expediciones activas anteriores terminan con sus reglas actuales. Reducer compartido con Supabase y recibos idempotentes.
- Tras aprobación gráfica extender dirección a protagonistas/enemigos20jefes/arenas/minijuegos/UI/HUD. Ilustración mediante generación artística, retoques nativos y animación por poses. Sin reintroducir Phaser: integración en renderizador React/Canvas actual.
- Pruebas:inicio4,catálogo30, hitos3/5/15, ciclo95/100/105/200, semillas/reanudación, no duplicación, persistencia temporal/permanente, evidenciaFlash,5resoluciones y sistemas existentes.
