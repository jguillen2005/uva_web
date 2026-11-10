# Sistema UVA — Contrato de backend (Odoo 19 + microservicios)

Este documento es la **fuente de verdad** entre las tres capas. Cualquier cambio de forma de datos se hace aquí primero.

```
 React (Vite)  ──HTTP /api/*──►  gateway (nginx :8080)
                                     │  /api/reportes/*      → svc-reportes      :4001
                                     │  /api/catalogos/*     → svc-catalogos     :4002
                                     │  /api/solicitudes/*   → svc-solicitudes   :4003
                                     │  /api/operacion/*     → svc-operacion     :4004
                                     │  /api/calidad/*       → svc-calidad       :4005
                                     │  /api/dictaminacion/* → svc-dictaminacion :4006
                                     ▼
                     cada microservicio ──JSON-2 API──► Odoo 19 (:8069) ──► PostgreSQL 17
```

* **Odoo 19 Community, on-premise** (imagen `odoo:19.0`), base de datos `uva`.
* Los microservicios (Node 22, Express, ESM) llaman a Odoo **solo** vía la API externa JSON-2 de Odoo 19:
  `POST {ODOO_URL}/json/2/{model}/{method}` con cabeceras
  `Authorization: bearer {ODOO_API_KEY}`, `X-Odoo-Database: {ODOO_DB}`, `Content-Type: application/json`.
  El cuerpo lleva los argumentos con nombre (`{"ids": [...], "context": {...}, ...kwargs}`).
* La lógica de negocio vive en Odoo. Toda lectura/acción que usa el frontend se expone como **método público
  `@api.model`** en el modelo abstracto `uva.api` (módulo `uva_api`), que devuelve JSON **ya con la forma que
  espera la vista** (claves en camelCase, fechas ya formateadas como texto `dd/mm/aaaa` cuando la vista así las
  muestra). Los microservicios son delgados: validan entrada, llaman `uva.api.<método>` y responden.
* La API key la genera `scripts/bootstrap` para el usuario técnico `api_uva` y se guarda en `backend/.env`.
  El navegador **nunca** ve la API key.

## Formato de respuesta HTTP

* Éxito: `200` con el JSON del método (sin envoltorio).
* Error: `4xx/5xx` con `{"error": "<mensaje legible en español>"}`.
* Todas las acciones (POST/PATCH) devuelven `{"ok": true, "message": "<texto para toast>", ...datos}`.
  El frontend muestra `message` en el toast.

## Módulos Odoo (`backend/odoo/addons/`)

| Módulo | Modelos | Depende de |
|---|---|---|
| `uva_core` | grupos/roles, `res.partner` (cliente UVA), `uva.pozo`, `uva.verificador`, secuencia folio `UVA-####`, menú raíz | `base`, `mail` |
| `uva_formatos` | `uva.formato`, `uva.formato.seccion`, `uva.formato.punto`, `uva.formato.rubro`, `uva.formato.tipo` | `uva_core` |
| `uva_solicitudes` | `uva.solicitud`, `uva.solicitud.documento` | `uva_core` |
| `uva_instrumentos` | `uva.instrumento`, `uva.calibracion`, `uva.calibracion.paso` | `uva_core` |
| `uva_operacion` | `uva.visita`, `uva.prestamo`, `uva.prestamo.linea` | `uva_solicitudes`, `uva_instrumentos` |
| `uva_dictaminacion` | `uva.expediente`, `uva.expediente.punto`, `uva.expediente.foto`, `uva.dictamen`, `uva.conagua.carga`, `uva.expediente.log` | `uva_operacion`, `uva_formatos` |
| `uva_api` | `uva.api` (AbstractModel) con los métodos de la tabla de abajo | todos los anteriores |
| `uva_demo` | datos semilla (XML/CSV) con **exactamente** los datos que hoy están en `src/data/mockData.ts` y en los arreglos inline de las vistas | `uva_api` |

Roles (grupos `res.groups`, categoría "Sistema UVA") = columnas de `UsuariosView`:
Administrador, Coordinador, Inspector, Gerente Técnico, Registro CONAGUA, Responsable de equipos, Consulta.

## Endpoints

`{id}` es siempre el id de registro Odoo como string, salvo que se indique folio. La columna "Forma" señala
el dato actual del frontend cuya forma debe replicarse 1:1.

### svc-reportes — `/api/reportes`
| Método HTTP | Ruta | `uva.api.<método>(kwargs)` | Forma de respuesta |
|---|---|---|---|
| GET | `/tablero` | `get_tablero()` | `{kpis: KPIItem[], alerts: AlertItem[], stages: mockStages, todayVisits: mockTodayVisits}` |
| GET | `/estadisticas?periodo=` | `get_estadisticas(periodo)` | `{months, stages, nonConformities, inspectors}` = arreglos de `EstadisticasView.tsx:15-60` |
| GET | `/estadisticas/export` | `export_estadisticas_csv(periodo)` → `{filename, content}` | el servicio responde `text/csv` con `Content-Disposition` |

### svc-catalogos — `/api/catalogos`
| GET | `/clientes` | `get_clientes()` | `ClientItem[]` (con `wells: WellSite[]`) |
| POST | `/clientes` | `create_cliente(vals)` | `{ok, message, cliente: ClientItem}` |
| PUT | `/clientes/{id}` | `update_cliente(cliente_id, vals)` | `{ok, message, cliente}` |
| POST | `/clientes/{id}/pozos` | `create_pozo(cliente_id, vals)` | `{ok, message, pozo: WellSite}` |
| POST | `/clientes/sync-aspel` | `sync_aspel()` | `{ok, message}` (stub de integración, registra en chatter) |
| GET | `/verificadores` | `get_verificadores()` | `VerificadorItem[]` |
| GET | `/usuarios` | `get_usuarios()` | `{users, rolesHeaders, matrix}` = `UsuariosView.tsx:10-40` |
| GET | `/perfil` | `get_perfil(login)` | `PerfilData` (usuario en sesión, roles, permisos efectivos, preferencias) |
| PUT | `/perfil` | `update_perfil(login, vals)` | body `{phone?, prefs?}` → `{ok, message, perfil}` |
| GET | `/formatos` | `get_formatos()` | `FormatoItem[]` |
| POST | `/formatos` | `create_formato(vals)` vals: `{codigo, nombre, version, etapa, estructura, checklistItems?, sections?}` | `{ok, message, formato}` |
| POST | `/formatos/{id}/enviar-aprobacion` | `formato_enviar_aprobacion(formato_id)` | `{ok, message}` |
| GET | `/formatos/{id}/estructura` | `get_formato_estructura(formato_id)` | `{sections, points}` = `EditorView.tsx:28-90` |
| PUT | `/formatos/{id}/estructura` | `save_formato_estructura(formato_id, sections, points)` | `{ok, message}` |
| GET | `/formatos/plantillas-alta` | `get_alta_formato_defaults()` | `{checklistItems, wordFields, sections}` = `AltaFormatoView.tsx:18-50` |
| GET | `/tipos` | `get_tipos()` | `{panels, coverage}` = `TiposView.tsx:11-90` |

Para `/formatos/{id}/...` el frontend usa el código y versión vigentes: si `id` no es numérico se interpreta como
`code` (p.ej. `F-18-AC`) y se toma la versión más reciente.

### svc-solicitudes — `/api/solicitudes`
| GET | `/` | `get_solicitudes()` | `Solicitud[]` |
| POST | `/` | `create_solicitud(vals)` vals: `{client, well, title, kind}` | `{ok, message, solicitud: Solicitud}` |
| PATCH | `/{id}/documentos/{docId}` | `solicitud_set_documento(solicitud_id, documento_id, complete, filename)` | `{ok, message, solicitud}` |
| PATCH | `/{id}/estado` | `solicitud_set_estado(solicitud_id, status)` | `{ok, message, solicitud}` |

### svc-operacion — `/api/operacion`
| GET | `/programacion` | `get_programacion(semana)` | `{queueItems, inspectorsSchedule}` = `ProgramacionView.tsx:25-150` |
| POST | `/visitas` | `confirmar_visita(folio, inspector_code, fecha, hora, send_outlook, send_client_email)` | `{ok, message}` |
| GET | `/prestamos` | `get_prestamos()` | `{returnItems, ...}` = datos de `PrestamosView.tsx` |
| POST | `/prestamos/devolucion` | `registrar_devolucion(folio, items)` | `{ok, message}` |
| GET | `/campo/{folio}` | `get_campo_sesion(folio)` | `CampoSesion` (app PWA, `PreviewView`) |
| POST | `/campo/{folio}/respuesta` | `registrar_respuesta_campo(folio, punto, respuesta, fotos, observacion)` | `{ok, message}` |

### svc-calidad — `/api/calidad`
| GET | `/instrumentos` | `get_instrumentos()` | `InstrumentItem[]` |
| POST | `/instrumentos` | `create_instrumento(vals)` | `{ok, message, instrumento}` |
| GET | `/calibraciones/actual` | `get_calibracion_actual()` | `{instrument, steps}` = `CalibracionView.tsx:13-45` |
| PUT | `/calibraciones/{id}/pasos` | `save_calibracion_pasos(calibracion_id, steps)` | `{ok, message}` |
| POST | `/calibraciones/{id}/completar` | `completar_calibracion(calibracion_id, cert_number, lab_name)` | `{ok, message}` |

### svc-dictaminacion — `/api/dictaminacion`
| GET | `/bandeja` | `get_bandeja()` | `{kpis, expedientes}` = `BandejaView.tsx:16-150` |
| GET | `/revision/{folio}` | `get_revision(folio)` | `{steps, sectionsSummary, pointsList, checks}` = `RevisionView.tsx:20-95` |
| POST | `/revision/{folio}/decision` | `registrar_decision(folio, decision, comentario)` decision ∈ `autorizar\|devolver\|inconforme` | `{ok, message, dictamen?}` |
| GET | `/dictamenes` | `get_dictamenes()` | arreglo de `DictamenesView.tsx:14-100` |
| GET | `/conagua` | `get_conagua()` | arreglo `items` de `ConaguaView.tsx:11-60` |
| POST | `/conagua/{id}/acuse` | `conagua_enviar_acuse(carga_id)` | `{ok, message, item}` |
| GET | `/expedientes/{folio}` | `get_expediente(folio)` | `{groups, docs, botSteps, logEntries}` = `ExpedienteView.tsx:16-80` |
| POST | `/expedientes/{folio}/carga-conagua` | `expediente_carga_conagua(folio, modo, acuse_filename)` | `{ok, message}` |

### Salud
Cada servicio expone `GET /health` → `{service, status:"ok", odoo:"ok"|"down"}`. El gateway expone `GET /api/health`.

## Integraciones externas (stubs)
Aspel SAE, SharePoint, Microsoft 365/Outlook y el portal CONAGUA se dejan como **stubs explícitos** en Odoo
(métodos que registran un mensaje en el chatter del registro y devuelven `ok`), señalados con `# TODO integración`.

## Anexo — ajustes acordados tras conectar el frontend
Las formas definitivas son los tipos de `src/types/index.ts` y los datos de `src/data/*.ts`.
* `get_conagua()`: cada item incluye `id` (id Odoo como texto).
* `get_programacion()`: además `weekLabel, dayHeaders, kpis, suggestedInspectors, equipment, defaultFecha, defaultHora` (opcionales).
* `get_prestamos()` → `{returnItems, loans, pendingDeliveryCount, receiverName}`.
* `get_calibracion_actual()` → `{id, instrument, steps, certificate?}`.
* kwargs opcionales extra: `confirmar_visita(equipo)`, `registrar_devolucion(recibio)`, `registrar_respuesta_campo(observacion)`, `completar_calibracion(cal_date, vigencia, notes)`.
* Folios se aceptan con o sin corchetes (`UVA-0001` ≡ `[UVA-0001]`).
* **Mi perfil / usuario en sesión:** los servicios leen el header `X-UVA-User` y lo pasan como `login`. Hoy el
  gateway **vacía** ese header (no hay SSO), así que Odoo usa el parámetro `uva.usuario_actual` (por omisión
  `gtorres`). Al integrar Entra ID, el gateway debe fijarlo con el usuario autenticado. «Cerrar sesión» es por
  ahora solo del lado del navegador.
