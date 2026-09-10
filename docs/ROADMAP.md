# Roadmap

Estados usados: **pendiente**, **en curso**, **completado**. Una entrega
solo se marca como completada cuando se cumplen todos sus criterios de
aceptacion.

## MVP-1A — Personas y creacion de splits

**Estado: completado.**

- Base del proyecto web (Next.js + TypeScript + PostgreSQL + Prisma +
  Tailwind CSS).
- Gestion de personas: alta, edicion de nombre y correo, listado con
  numero de splits en los que participan.
- Creacion de splits en borrador (nombre, descripcion opcional, lunes de
  inicio, numero de semanas) y generacion automatica de sus semanas.
- Edicion de un split mientras esta en borrador.
- Incorporacion de participantes (persona + alias + nivel + semana
  inicial), tanto en borrador como con el split activo.
- Edicion de alias y nivel de un participante.
- Activacion de un split cuando tiene al menos un participante.
- Documentacion del proyecto y descubrimiento funcional del Split 8.

## MVP-1B — KPI activos y configuracion

**Estado: pendiente.**

- Catalogo cerrado de los 10 KPI descritos en
  `docs/DISCOVERY-1-SPLIT-8.md`.
- Activar o desactivar KPI por split.
- Configurar los parametros de cada KPI activado (multiplicadores por
  nivel, maximos base, parametros propios de su tipo de calculo).
- Todavia no se permite crear KPI nuevos ni introducir formulas o codigo
  libre: los tipos de calculo son fijos y conocidos por el sistema.

## IMPORT-1 — Auditoria e implementacion de cargas

**Estado: pendiente de recibir los Excel originales.**

- El usuario proporcionara ejemplos reales de los Excel de entrada tal
  como llegan hoy (Productividad, Escalados, Calidad, Llamadas,
  Articulos, Formaciones) y de las entradas manuales (Estabilidad,
  Cronomagia, Dedicacion).
- A partir de esos ejemplos se definiran columnas, encabezados,
  variaciones de nombres, duplicados, vacios, ceros, correcciones y
  previsualizacion antes de guardar.
- No se disenara la importacion a partir de las hojas ya transformadas
  del libro historico: debe partir de los ficheros originales.

## MVP-1C — Resultados

**Estado: pendiente.**

- Apertura de una semana para carga de datos.
- Calculo de los KPI activos segun sus parametros configurados.
- Panel de administracion para revisar los resultados antes de
  publicarlos.
- Vista individual del resultado de cada participante.
- Clasificacion general acumulada, basada en los puntos KPI (sin capas de
  juego adicionales todavia).

## Capas posteriores (fuera de alcance por ahora)

**Estado: pendiente**, documentadas unicamente para no perder contexto:

- Autenticacion y cuentas (administrador y participante).
- Facciones y clasificacion de faccion (basada en el promedio de los tres
  mejores renombres semanales del equipo).
- Profesiones, con bonus sobre pares de KPI.
- Localizaciones, con bonus semanales.
- Objetos permanentes y efectos acumulables.
- Economia: creditos equivalentes a puntos KPI, compras y saldo.
- Renombre derivado de la posicion semanal, y ajustes de juego.
- Ficha individual en PDF y envio por correo mediante Outlook.
- Integracion con Power BI.
- Un sistema generico de plugins o funcionalidades, o una API publica.

Ver `docs/DISCOVERY-1-SPLIT-8.md` para el detalle funcional de estas
capas historicas.
