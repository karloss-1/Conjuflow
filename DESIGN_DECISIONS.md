# Decisiones de diseño y pedagogía de ConjuFlow

Estado: decisiones vigentes, sujetas a revisión. Inspección: 9 de septiembre de 2026, rama `main`, base [faca8a4](https://github.com/karloss-1/Conjuflow/commit/faca8a4).

## Cómo interpretar estas notas

Este documento conserva el contexto para continuar el proyecto sin depender de conversaciones anteriores. No convierte las decisiones en restricciones permanentes: pueden cambiar según los estudiantes, la evidencia pedagógica o los objetivos del proyecto. Antes de cambiarlas, conviene entender su propósito, evaluar sus consecuencias y actualizar estas notas.

**Hecho** significa comportamiento comprobado en el código, datos, pruebas o historial. **Razonamiento inferido** explica una utilidad plausible del diseño; no atribuye al autor una motivación histórica que el repositorio no conserva. Aquí no se presenta evidencia experimental de eficacia ni una reconstrucción completa de las conversaciones de diseño.

## 1. Propósito y unidad de aprendizaje

**Hecho.** La interfaz define el producto como práctica de verbos del español mexicano. Cada tarjeta presenta un verbo y un tiempo; al revelar muestra el paradigma. La ayuda pide recordar todas las formas y calificar la más difícil. No hay corrección automática de texto ni evaluación de pronunciación.

Se usan yo, tú, él/ella/usted, nosotros y ellos/ellas/ustedes; no se muestra vosotros. Hay ocho tarjetas por verbo: presente de indicativo, pretérito, imperfecto, futuro, condicional, presente de subjuntivo, imperfecto de subjuntivo e imperativo.

**Razonamiento inferido.** Practicar el paradigma junto favorece observar relaciones entre personas y recuperar un sistema de formas, con alcance compatible con el español mexicano. La unidad FSRS es verbo × tiempo, no cada persona individual. Esto simplifica el seguimiento, pero una sola forma difícil puede hacer repetir formas ya conocidas. El producto complementa el vocabulario de Mexican Spanish Flashcards; no sustituye la práctica comunicativa.

**Revisión.** Considerar tarjetas por persona, ejemplos en contexto u otras variedades si las necesidades del alumnado lo justifican. Un cambio de unidad requiere decidir qué hacer con el progreso existente.

Fuentes: [interfaz y ayuda](index.html), [renderizado y sesiones](app.js), [paradigmas](core.js).

## 2. Selección de 170 verbos y fuente editable

**Hecho.** El [CSV maestro](Conjugaciones_Final_170_verbos_1360_tarjetas_patron_exclusivo.csv) contiene 170 verbos y 1.360 tarjetas únicas. Sustituyó al piloto en [b9d88ce](https://github.com/karloss-1/Conjuflow/commit/b9d88ce). Incluye verbos no pronominales y pronominales como quedar/quedarse. Hay 167 verbos con rango de corpus y tres sin él: conducir, construir e incluir, equivalentes a 24 tarjetas con rango vacío. Haber tiene una tarjeta de imperativo no aplicable: quedan 1.359 tarjetas aplicables.

**Razonamiento inferido.** El conjunto combina vocabulario con rango y cobertura de familias morfológicas; los tres verbos sin rango aportan familias visibles como -ucir y -uir. Eso es compatible con una selección pedagógica más amplia que un corte estricto de frecuencia. No prueba por qué se eligió exactamente cada verbo ni que 170 sea un tamaño óptimo.

**Información no recuperada.** El repositorio no identifica suficientemente el corpus, su versión, método de ranking ni el proceso completo de inclusión/exclusión. No debe describirse la lista como los 170 verbos más frecuentes ni inventarse la procedencia del ranking.

El CSV es la fuente editable; [scripts/csv_to_js.py](scripts/csv_to_js.py) genera [data/conjugations.js](data/conjugations.js), que no se edita manualmente. El convertidor valida columnas, IDs y patrón exclusivo; no calcula conjugaciones ni demuestra su corrección lingüística. Los conteos y ejemplos están comprobados en [tests/check_dataset.js](tests/check_dataset.js).

**Revisión.** Ajustar cobertura con necesidades reales y registrar fuente y motivo de cada ampliación. “Final” en el nombre del CSV designa la versión actual, no una prohibición de revisarlo.

## 3. Eliminación del filtro de frecuencia

**Hecho.** No existe un selector de frecuencia en la UI ni una condición de rango en los filtros. Las pruebas exigen que un valor heredado de `rank` no afecte al resultado. El rango se conserva como metadato y desempate en la cola: primero vencidas, después nuevas; dentro de cada grupo, fecha de vencimiento y luego rango. Los rangos ausentes se ordenan al final del desempate.

**Razonamiento inferido.** Quitar ese filtro evita que un corte numérico o un rango ausente oculte familias útiles del conjunto seleccionado. Permite elegir la dificultad morfológica por tiempo y patrón, manteniendo parte del orden de frecuencia. No significa que la frecuencia haya dejado de importar. No se conserva una justificación histórica completa de su eliminación.

**Revisión.** Reintroducir priorización por frecuencia si resulta útil, distinguiendo ranking de corpus, cobertura pedagógica y disponibilidad FSRS, con tratamiento explícito de verbos sin rango.

Fuentes: [core.js](core.js), [app.js](app.js), [tests/pattern_context.js](tests/pattern_context.js).

## 4. Un patrón pedagógico exclusivo por tarjeta

**Hecho.** Desde [ffd19be](https://github.com/karloss-1/Conjuflow/commit/ffd19be), `patrones_tarjeta` contiene una sola categoría; se copia a `pattern`. El convertidor rechaza valores vacíos o con punto y coma. La selección usa igualdad exacta, no pertenencia a varias etiquetas.

**Razonamiento inferido.** La categoría expresa el foco didáctico predominante de esa tarjeta. Evita que el mismo paradigma aparezca simultáneamente en varios grupos que el estudiante intenta practicar por separado. No afirma que el verbo solo tenga un fenómeno lingüístico.

La prioridad **está materializada en cada fila del CSV**. No existe en el programa un algoritmo general que deduzca el patrón ni una jerarquía universal entre todas las categorías. Los siguientes criterios resumen asignaciones comprobadas; al ampliar el conjunto hay que revisar casos análogos y excepciones, no convertir esta descripción en reglas automáticas sin validarlas.

| Tiempo | Organización vigente y precedencias observables |
| --- | --- |
| Presente de indicativo | Se distinguen regular, cambios vocálicos e→ie/o→ue/e→i/u→ue, yo→-go, yo→-zco, yo irregular, -uir→y y muy irregular. Tener, venir y decir quedan en muy irregular aunque combinen cambios que podrían describirse con otras etiquetas. Hacer se agrupa en yo→-go; conocer en yo→-zco. |
| Pretérito | Se separan muy irregular, raíz en j, raíz irregular, i→y, cambio ortográfico, cambios e→i/o→u de tercera persona y regular. Decir/traer/conducir se agrupan específicamente en raíz en j; tener en raíz irregular; leer en i→y; empezar en cambio ortográfico, no en el e→ie del presente. |
| Imperfecto | Solo regular y muy irregular en los datos actuales. Ser, ir, ver y las variantes irse/verse están en muy irregular; la irregularidad de otros tiempos no se hereda automáticamente. |
| Futuro y condicional | Solo regular y raíz irregular. Tener se agrupa en raíz irregular; ser es regular en estos tiempos. Ambos tiempos tienen actualmente 154 tarjetas regulares y 16 de raíz irregular. |
| Presente de subjuntivo | Se distinguen muy irregular, yo irregular, cambios vocálicos, patrones combinados de -ir, -uir→y, cambio ortográfico y regular. Empezar prioriza e→ie sobre el cambio z→c; jugar prioriza u→ue sobre g→gu. Sentir usa e→ie/e→i (-ir) y dormir o→ue/o→u (-ir). Conocer usa yo irregular aquí, aunque en indicativo se etiqueta yo→-zco. |
| Imperfecto de subjuntivo | Conserva familias relacionadas con la raíz del pretérito: muy irregular, raíz en j, raíz irregular, i→y, e→i, o→u y regular. Leer sigue en i→y; sentir pasa a e→i sin limitar la etiqueta a tercera persona. Empezar es regular aquí. |
| Imperativo | Clasifica el conjunto afirmativo/negativo: muy irregular, yo irregular, cambios vocálicos simples y combinados, -uir→y, cambio ortográfico, -cer→-zc-, -ucir→-uzc-, regular y no aplicable. Jugar prioriza u→ue; conocer usa -cer→-zc- y conducir -ucir→-uzc-. Tener está en muy irregular. Haber es no aplicable. |

Son categorías pedagógicas editoriales, no una taxonomía lingüística exhaustiva. Por ejemplo, `muy irregular` incluye enviar en algunos tiempos según el CSV vigente; la etiqueta no debe interpretarse como una medida cuantitativa universal de irregularidad.

**Revisión.** Si una categoría confunde o es lingüísticamente discutible, revisar las formas, las notas y la clasificación en conjunto. Documentar el motivo del cambio y actualizar las pruebas de ejemplos. No preservar una etiqueta solamente porque aparezca en esta tabla.

Fuentes: CSV maestro, [tests/check_dataset.js](tests/check_dataset.js), [tests/pattern_context.js](tests/pattern_context.js), [core.js](core.js).

## 5. Imperativo unificado

**Hecho.** Afirmativo y negativo comparten una tarjeta `imperativo` y un estado FSRS. Cada fila reúne ambas formas con “ / ” para tú, usted, nosotros y ustedes; no se muestra yo. La ayuda pide recordar ambas polaridades. Haber se conserva en los datos con nota de uso raro/marginal y `aplicable=no`, pero queda fuera de la práctica.

**Razonamiento inferido.** Ver ambas formas juntas permite compararlas, incluida la colocación de pronombres. Reduce dos unidades de repaso a una, a costa de mayor carga por tarjeta. Excluir haber prioriza el uso práctico sin perder el registro de la decisión.

**Revisión.** Separar polaridades si la carga dificulta el aprendizaje; planificar explícitamente la nueva identidad y el tratamiento del progreso, sin asumir una conversión automática.

## 6. Filtros contextuales y sesión estable

**Hecho.** Se elige un tiempo y se combinan regularidad de la tarjeta, terminación, tipo pronominal y patrón. “Irregulares” incluye todo valor distinto de regular, incluidos cambios ortográficos. La aplicabilidad se comprueba antes de incluir una tarjeta.

Las opciones de Pattern se recalculan usando los otros cuatro filtros. Pattern no filtra sus propias opciones. Una selección incompatible vuelve a “Todos”; si no hay patrones disponibles se desactiva el selector. Esto se basa en contenido aplicable, no en si las tarjetas están vencidas.

**Razonamiento inferido.** Mostrar solo categorías presentes reduce combinaciones sin sentido; clasificar por tarjeta evita tratar un verbo como irregular en todos los tiempos. Separar “coincidencias” de “vencidas/nuevas” aclara por qué no todas se practican ahora.

Al iniciar se guarda una instantánea de filtros y tarjetas. Editar controles no modifica esa sesión hasta pulsar Start practice otra vez. Así, lo que se repasa mantiene un criterio estable.

Fuentes: [core.js](core.js), [app.js](app.js), pruebas de patrones.

## 7. Recuperación activa, FSRS y progreso de ronda

**Hecho.** Se usa la copia local de `ts-fsrs@5.4.1`, con configuración predeterminada. Solo Again/Hard/Good/Easy llaman al planificador y guardan la revisión; están desactivados antes de revelar. La ayuda indica: Again si falla cualquier forma, hay un error o se consulta la respuesta; Hard si todas son correctas con dificultad; Good si hay alguna vacilación; Easy si todas salen inmediatamente.

Previous/Next recorren tarjetas pendientes sin calificar ni deshacer revisiones. Una tarjeta calificada sale de la cola. Las futuras no se adelantan; al agotarse la ronda se informa del siguiente vencimiento y pueden comenzar nuevas rondas cuando corresponda.

La barra cuenta tarjetas calificadas en la ronda, no posiciones navegadas ni dominio del idioma. El historial FSRS se conserva entre rondas.

**Razonamiento inferido.** Recuperar antes de mirar y autoevaluar la forma más difícil evita que reconocer la respuesta se confunda con producirla. El espaciado adapta fechas a las calificaciones; su utilidad depende también de la consistencia de esa autoevaluación. No hay validación pedagógica específica de esta configuración en el repo.

**Revisión.** Evaluar carga de paradigmas, consistencia de calificaciones y comportamiento del planificador antes de cambiar la unidad o sus parámetros. Conservar la distinción entre navegar, revisar y dominar.

Fuentes: [index.html](index.html), [app.js](app.js), [tests/fsrs_invariants.js](tests/fsrs_invariants.js), [tests/session_progress.js](tests/session_progress.js).

## 8. Persistencia propia y separación de Mexican Spanish Flashcards

**Hecho.** IndexedDB usa `conjuflow-db`, versión 1, almacén `cardProgress`, clave `cardId`. Los registros incluyen estado FSRS, versión del planificador y fecha de actualización. Solo se cargan registros con la versión de planificador esperada. Los filtros usan la clave independiente de localStorage `conjuflow-filters-v1`; no alteran la identidad de repaso.

La separación quedó explícita en [8bd901d](https://github.com/karloss-1/Conjuflow/commit/8bd901d): se abandonó el nombre de base compartido y una actualización que podía borrar almacenes. La app actual no copia automáticamente el progreso de aquella base anterior.

**Razonamiento respaldado por el cambio.** Mantener nombres y esquemas propios evita que apps alojadas bajo el mismo origen interfieran entre sí. Aprender el significado de un verbo en Mexican Spanish Flashcards y conjugarlo aquí son objetivos distintos; sus estados de memoria no son intercambiables.

El repositorio conserva contenido y lógica, no los datos de estudio del navegador. No hay sincronización de cuenta ni exportación de progreso implementadas. Borrar datos del sitio puede perder ese progreso.

**Revisión.** Una futura integración, cambio de IDs o versión FSRS requiere una estrategia explícita de migración y recuperación, no solo compartir el nombre de la base.

## 9. Arquitectura, PWA e interfaz

**Hecho.** Es una app estática sin backend ni compilación para servirla: HTML/CSS/JavaScript, contenido generado y dependencia FSRS local. Tiene manifiesto y [service worker](sw.js) que precarga recursos para uso sin conexión tras una instalación/carga correcta. La limpieza solo elimina cachés con prefijo `conjuflow-`, desde [27bb6b9](https://github.com/karloss-1/Conjuflow/commit/27bb6b9).

La UI da prioridad a tiempo y regularidad, relega filtros adicionales a More filters y pliega los controles al empezar. No muestra una tarjeta antes de iniciar. La ayuda reúne instrucciones y criterios de calificación. Hay controles de teclado, foco visible y adaptación a pantallas pequeñas.

**Razonamiento inferido.** Reducir infraestructura facilita alojamiento y mantenimiento; una tarjeta central y controles secundarios plegados concentran la atención en recuperar formas. La caché propia complementa la separación de bases de datos. La accesibilidad incorporada es una base de diseño, no una certificación de cumplimiento.

**Revisión.** Revisar accesibilidad, idioma de los controles, legibilidad y experiencia móvil con usuarios. Si cambian recursos, revisar el versionado de caché; las notas Markdown no requieren modificarlo.

## 10. Cómo continuar el proyecto

Leer estas notas junto al [README](README.md), el CSV y las pruebas. El código describe el comportamiento actual; estas notas explican su contexto y límites. Para decisiones nuevas, registrar fecha, necesidad del alumnado, alternativas, motivo, consecuencias y evidencia que permitiría reconsiderarlas. Si falta el razonamiento histórico, mantenerlo como desconocido hasta recuperar una fuente; no inventarlo.

La inspección no encontró AGENTS.md ni instrucciones de una rama documental alternativa. Estas notas se añaden a main; las ramas de respaldo y de UI no se usan como fuente normativa del estado vigente.
