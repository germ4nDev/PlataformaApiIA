/*
  PLATAFORMA · Migración 033 · Actividades de cada módulo asignadas al ADMINISTRADOR de su aplicación (OT-020, CC-129)
  Generada por _memoria/datos/permisos-033.js desde la matriz aprobada por el usuario el 2026-11-07 (documento «Plataforma — Actividades por
  módulo (OT-020)»). No editar a mano: cambiar permisos-mapa.js, regenerar la matriz y este archivo.
  Qué hace (idempotente; no borra nada, no toca otros roles):
    1. Crea en dbo.PTLActividades las 147 actividades nuevas (Plataforma 112, Porttos 35), tipo CRUD, activas,
       si su llavePermiso no existe todavía.
    2. Asigna TODAS las actividades activas de cada aplicación al rol ROLE_ADMINISTRADOR de esa misma aplicación con permiso = 1
       (inserta lo que falta y sube a 1 las filas de ese rol que estén en 0). Una aplicación sin ese rol se reporta y no se crea el rol.
  Va ANTES de publicar el API que exige estas llaves (OT-020 paso 4): sin ella, las rutas responden 403 a todos.
  Reversa: las actividades nuevas llevan descripcion = N'OT-020 · …'; sus filas de PTLActividadesRoles se borran por codigoActividad.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF COLUMNPROPERTY(OBJECT_ID(N'dbo.PTLActividades'), N'actividadId', 'IsIdentity') <> 1
   OR COLUMNPROPERTY(OBJECT_ID(N'dbo.PTLActividadesRoles'), N'actividadRoleId', 'IsIdentity') <> 1
BEGIN
  RAISERROR('actividadId o actividadRoleId no son IDENTITY: revisar la migración antes de correrla.', 16, 1);
  RETURN;
END

IF NOT EXISTS (SELECT 1 FROM dbo.PTLTiposActividad WHERE codigoTipoActividad = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8')
BEGIN
  RAISERROR('No existe el tipo de actividad CRUD esperado.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

DECLARE @nuevas TABLE (
  llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
  actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL,
  codigoAplicacion NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
  codigoSuite NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
  codigoModulo NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
  ubicacion NVARCHAR(400) COLLATE DATABASE_DEFAULT NOT NULL
);

INSERT INTO @nuevas (llavePermiso, actividad, codigoAplicacion, codigoSuite, codigoModulo, ubicacion) VALUES
  (N'ACT_ACT_ELIMINAR', N'Eliminar actividades', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'77c10d82-b0d2-4981-94b9-121f22fdb1ac', N'Plataforma · Actividades'),
  (N'ACT_TIPOSACT_CREAR', N'Crear tipos de actividad', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'77c10d82-b0d2-4981-94b9-121f22fdb1ac', N'Plataforma · Actividades'),
  (N'ACT_TIPOSACT_ELIMINAR', N'Eliminar tipos de actividad', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'77c10d82-b0d2-4981-94b9-121f22fdb1ac', N'Plataforma · Actividades'),
  (N'ACT_TIPOSACT_MODIFICAR', N'Modificar tipos de actividad', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'77c10d82-b0d2-4981-94b9-121f22fdb1ac', N'Plataforma · Actividades'),
  (N'ACT_MODULOS_CREAR', N'Crear módulos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a93fde14-0b06-45c3-8a78-7d44549050d5', N'Plataforma · Aplicaciones › Módulos'),
  (N'ACT_MODULOS_ELIMINAR', N'Eliminar módulos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a93fde14-0b06-45c3-8a78-7d44549050d5', N'Plataforma · Aplicaciones › Módulos'),
  (N'ACT_MODULOS_MODIFICAR', N'Modificar módulos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a93fde14-0b06-45c3-8a78-7d44549050d5', N'Plataforma · Aplicaciones › Módulos'),
  (N'ACT_SUITES_CREAR', N'Crear suites', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'525b5b77-a752-49f8-9836-974a3923892f', N'Plataforma · Aplicaciones › Suites'),
  (N'ACT_SUITES_ELIMINAR', N'Eliminar suites', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'525b5b77-a752-49f8-9836-974a3923892f', N'Plataforma · Aplicaciones › Suites'),
  (N'ACT_SUITES_MODIFICAR', N'Modificar suites', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'525b5b77-a752-49f8-9836-974a3923892f', N'Plataforma · Aplicaciones › Suites'),
  (N'ACT_VERSIONES_CREAR', N'Crear versiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'68945c28-28d6-4bc2-9a6d-ff10dcda740d', N'Plataforma · Aplicaciones › Versiones'),
  (N'ACT_VERSIONES_ELIMINAR', N'Eliminar versiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'68945c28-28d6-4bc2-9a6d-ff10dcda740d', N'Plataforma · Aplicaciones › Versiones'),
  (N'ACT_VERSIONES_MODIFICAR', N'Modificar versiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'68945c28-28d6-4bc2-9a6d-ff10dcda740d', N'Plataforma · Aplicaciones › Versiones'),
  (N'ACT_BBT_ELIMINAR', N'Eliminar bibliotecas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'f1b21d87-b57c-4df6-9206-766d76da6920', N'Plataforma · Biblioteca › Bibliotecas'),
  (N'ACT_BBT_MODIFICAR', N'Modificar bibliotecas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'f1b21d87-b57c-4df6-9206-766d76da6920', N'Plataforma · Biblioteca › Bibliotecas'),
  (N'ACT_GALERIAS_CREAR', N'Crear galerías', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'f1b21d87-b57c-4df6-9206-766d76da6920', N'Plataforma · Biblioteca › Bibliotecas'),
  (N'ACT_GALERIAS_ELIMINAR', N'Eliminar galerías', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'f1b21d87-b57c-4df6-9206-766d76da6920', N'Plataforma · Biblioteca › Bibliotecas'),
  (N'ACT_GALERIAS_MODIFICAR', N'Modificar galerías', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'f1b21d87-b57c-4df6-9206-766d76da6920', N'Plataforma · Biblioteca › Bibliotecas'),
  (N'ACT_FORMATOSGAL_CREAR', N'Crear formatos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a3749e82-6f77-4109-9dbc-1bfd6e94621f', N'Plataforma · Biblioteca › Formatos Galeria'),
  (N'ACT_FORMATOSGAL_ELIMINAR', N'Eliminar formatos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a3749e82-6f77-4109-9dbc-1bfd6e94621f', N'Plataforma · Biblioteca › Formatos Galeria'),
  (N'ACT_FORMATOSGAL_MODIFICAR', N'Modificar formatos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a3749e82-6f77-4109-9dbc-1bfd6e94621f', N'Plataforma · Biblioteca › Formatos Galeria'),
  (N'ACT_TIPOSGAL_CREAR', N'Crear tipos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'11af5de9-833a-417d-b536-5d2c6f27e9d6', N'Plataforma · Biblioteca › Tipos Galeria'),
  (N'ACT_TIPOSGAL_ELIMINAR', N'Eliminar tipos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'11af5de9-833a-417d-b536-5d2c6f27e9d6', N'Plataforma · Biblioteca › Tipos Galeria'),
  (N'ACT_TIPOSGAL_MODIFICAR', N'Modificar tipos de galería', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'11af5de9-833a-417d-b536-5d2c6f27e9d6', N'Plataforma · Biblioteca › Tipos Galeria'),
  (N'ACT_TIPOSLOG_CREAR', N'Crear tipos de log', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e1a8fa99-15db-479b-a0a4-9c2be72273d6', N'Plataforma · Logs › Tipos Logs'),
  (N'ACT_TIPOSLOG_ELIMINAR', N'Eliminar tipos de log', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e1a8fa99-15db-479b-a0a4-9c2be72273d6', N'Plataforma · Logs › Tipos Logs'),
  (N'ACT_TIPOSLOG_MODIFICAR', N'Modificar tipos de log', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e1a8fa99-15db-479b-a0a4-9c2be72273d6', N'Plataforma · Logs › Tipos Logs'),
  (N'ACT_MODPQ_MODIFICAR', N'Modificar módulos de paquete', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'92aa796a-e4e2-4e4e-99f0-7e72c3c2252d', N'Plataforma · Paquetes'),
  (N'ACT_TIPOSPAQ_CREAR', N'Crear tipos de paquete', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'92aa796a-e4e2-4e4e-99f0-7e72c3c2252d', N'Plataforma · Paquetes'),
  (N'ACT_TIPOSPAQ_ELIMINAR', N'Eliminar tipos de paquete', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'92aa796a-e4e2-4e4e-99f0-7e72c3c2252d', N'Plataforma · Paquetes'),
  (N'ACT_TIPOSPAQ_MODIFICAR', N'Modificar tipos de paquete', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'92aa796a-e4e2-4e4e-99f0-7e72c3c2252d', N'Plataforma · Paquetes'),
  (N'ACT_TIPOSPAGO_CREAR', N'Crear tipos de pago', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'3ba799e3-291e-4dce-8fd7-2e423e6e66e8', N'Plataforma · Precios › Tipos Valor'),
  (N'ACT_TIPOSPAGO_ELIMINAR', N'Eliminar tipos de pago', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'3ba799e3-291e-4dce-8fd7-2e423e6e66e8', N'Plataforma · Precios › Tipos Valor'),
  (N'ACT_TIPOSPAGO_MODIFICAR', N'Modificar tipos de pago', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'3ba799e3-291e-4dce-8fd7-2e423e6e66e8', N'Plataforma · Precios › Tipos Valor'),
  (N'ACT_CONEXIONES_CREAR', N'Crear conexiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e34adde0-6119-496c-8667-7894f9b3bb23', N'Plataforma · Servidores y DBs › Conexiones'),
  (N'ACT_CONEXIONES_ELIMINAR', N'Eliminar conexiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e34adde0-6119-496c-8667-7894f9b3bb23', N'Plataforma · Servidores y DBs › Conexiones'),
  (N'ACT_CONEXIONES_MODIFICAR', N'Modificar conexiones', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'e34adde0-6119-496c-8667-7894f9b3bb23', N'Plataforma · Servidores y DBs › Conexiones'),
  (N'ACT_SCRIPTS_CREAR', N'Crear scripts', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_SCRIPTS_EJECUTAR', N'Ejecutar scripts en las bases', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_SCRIPTS_ELIMINAR', N'Eliminar scripts', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_SCRIPTS_MODIFICAR', N'Modificar scripts', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_TIPOSSCRIPT_CREAR', N'Crear tipos de script', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_TIPOSSCRIPT_ELIMINAR', N'Eliminar tipos de script', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_TIPOSSCRIPT_MODIFICAR', N'Modificar tipos de script', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'09379d68-0feb-48d7-8a48-090a56c82d1d', N'Plataforma · Servidores y DBs › Scripts DBs'),
  (N'ACT_SERVIDORES_CREAR', N'Crear servidores', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'9e5e4196-be72-4ae0-a56b-ea38807a64cd', N'Plataforma · Servidores y DBs › Servidores'),
  (N'ACT_SERVIDORES_ELIMINAR', N'Eliminar servidores', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'9e5e4196-be72-4ae0-a56b-ea38807a64cd', N'Plataforma · Servidores y DBs › Servidores'),
  (N'ACT_SERVIDORES_MODIFICAR', N'Modificar servidores', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'9e5e4196-be72-4ae0-a56b-ea38807a64cd', N'Plataforma · Servidores y DBs › Servidores'),
  (N'ACT_CONTENIDOS_CREAR', N'Crear contenidos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'7f024bac-7ead-4823-a168-214f69094b4e', N'Plataforma · Sitios Web › Contenidos'),
  (N'ACT_CONTENIDOS_ELIMINAR', N'Eliminar contenidos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'7f024bac-7ead-4823-a168-214f69094b4e', N'Plataforma · Sitios Web › Contenidos'),
  (N'ACT_CONTENIDOS_MODIFICAR', N'Modificar contenidos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'7f024bac-7ead-4823-a168-214f69094b4e', N'Plataforma · Sitios Web › Contenidos'),
  (N'ACT_ENLACES_CREAR', N'Crear enlaces', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'64e34b06-ffb7-419b-b473-caafe11cd373', N'Plataforma · Sitios Web › Enlaces'),
  (N'ACT_ENLACES_ELIMINAR', N'Eliminar enlaces', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'64e34b06-ffb7-419b-b473-caafe11cd373', N'Plataforma · Sitios Web › Enlaces'),
  (N'ACT_ENLACES_MODIFICAR', N'Modificar enlaces', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'64e34b06-ffb7-419b-b473-caafe11cd373', N'Plataforma · Sitios Web › Enlaces'),
  (N'ACT_SITIOS_CREAR', N'Crear sitios', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'90628cde-27be-4782-9675-0bcf8efac252', N'Plataforma · Sitios Web › Sitios'),
  (N'ACT_SITIOS_ELIMINAR', N'Eliminar sitios', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'90628cde-27be-4782-9675-0bcf8efac252', N'Plataforma · Sitios Web › Sitios'),
  (N'ACT_SITIOS_MODIFICAR', N'Modificar sitios', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'90628cde-27be-4782-9675-0bcf8efac252', N'Plataforma · Sitios Web › Sitios'),
  (N'ACT_ADMINBD_INICIALIZAR', N'Inicializar la base de un suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'bdbe6d7f-bf78-4fa9-ba90-e357cdfc6c39', N'Plataforma · Suscriptores › Adiministración BD'),
  (N'ACT_FACTURACION_CREAR', N'Registrar pagos y facturación', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_FACTURACION_ELIMINAR', N'Eliminar facturación', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_FACTURACION_MODIFICAR', N'Modificar facturación', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_SUSCEMP_ELIMINAR', N'Eliminar empresas del suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_SUSCEMP_MODIFICAR', N'Modificar empresas del suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_SUSCPAQ_CREAR', N'Crear paquetes del suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_USUSC_CARGUE', N'Cargue masivo de usuarios del suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_USUSC_ELIMINAR', N'Eliminar usuarios del suscriptor', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_USUSC_EMPRESAS', N'Asignar empresas a los usuarios', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'22323ff7-68ee-4901-98ca-0ad0878cb19c', N'Plataforma · Suscriptores'),
  (N'ACT_CLASESTK_CREAR', N'Crear clases de ticket', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'0c034af6-26c9-44b1-b3ef-5b44083a82b9', N'Plataforma · Tickets › Clases Ticket'),
  (N'ACT_CLASESTK_ELIMINAR', N'Eliminar clases de ticket', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'0c034af6-26c9-44b1-b3ef-5b44083a82b9', N'Plataforma · Tickets › Clases Ticket'),
  (N'ACT_CLASESTK_MODIFICAR', N'Modificar clases de ticket', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'0c034af6-26c9-44b1-b3ef-5b44083a82b9', N'Plataforma · Tickets › Clases Ticket'),
  (N'ACT_SEGUIMIENTOS_CREAR', N'Crear seguimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a323b148-c912-4fdd-8f92-afb9e9e157a9', N'Plataforma · Tickets › Seguimientos'),
  (N'ACT_SEGUIMIENTOS_ELIMINAR', N'Eliminar seguimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a323b148-c912-4fdd-8f92-afb9e9e157a9', N'Plataforma · Tickets › Seguimientos'),
  (N'ACT_SEGUIMIENTOS_MODIFICAR', N'Modificar seguimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'a323b148-c912-4fdd-8f92-afb9e9e157a9', N'Plataforma · Tickets › Seguimientos'),
  (N'ACT_ESTADOS_CREAR', N'Crear estados', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_ESTADOS_ELIMINAR', N'Eliminar estados', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_ESTADOS_MODIFICAR', N'Modificar estados', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_REQUERIMIENTOS_CREAR', N'Crear requerimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_REQUERIMIENTOS_ELIMINAR', N'Eliminar requerimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_REQUERIMIENTOS_MODIFICAR', N'Modificar requerimientos', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TICKETS_CREAR', N'Crear tickets', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TICKETS_ELIMINAR', N'Eliminar tickets', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TICKETS_MODIFICAR', N'Modificar tickets', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TIPOSEST_CREAR', N'Crear tipos de estado', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TIPOSEST_ELIMINAR', N'Eliminar tipos de estado', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_TIPOSEST_MODIFICAR', N'Modificar tipos de estado', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'd7e3296c-8238-488b-bf88-54e96b0e3f4b', N'Plataforma · Tickets'),
  (N'ACT_ROLES_CREAR', N'Crear roles', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_ROLES_ELIMINAR', N'Eliminar roles', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_ROLES_MODIFICAR', N'Modificar roles', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_ROLES_PERMISOS', N'Asignar permisos a los roles', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_TIPOSROLE_CREAR', N'Crear tipos de rol', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_TIPOSROLE_ELIMINAR', N'Eliminar tipos de rol', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_TIPOSROLE_MODIFICAR', N'Modificar tipos de rol', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'ea4d2cc3-d25d-4c95-a2cc-894b5e37b6fd', N'Plataforma · Usuarios › Roles'),
  (N'ACT_COLORES_CREAR', N'Crear colores del navbar', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'615dcbd9-7685-48de-a186-9cb47b150a53', N'Plataforma · Utilidades › Colores Navbar'),
  (N'ACT_COLORES_ELIMINAR', N'Eliminar colores del navbar', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'615dcbd9-7685-48de-a186-9cb47b150a53', N'Plataforma · Utilidades › Colores Navbar'),
  (N'ACT_COLORES_MODIFICAR', N'Modificar colores del navbar', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'615dcbd9-7685-48de-a186-9cb47b150a53', N'Plataforma · Utilidades › Colores Navbar'),
  (N'ACT_IDIOMAS_CREAR', N'Crear idiomas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_IDIOMAS_ELIMINAR', N'Eliminar idiomas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_IDIOMAS_MODIFICAR', N'Modificar idiomas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_TEXTOS_CREAR', N'Crear textos de idioma', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_TEXTOS_ELIMINAR', N'Eliminar textos de idioma', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_TEXTOS_MODIFICAR', N'Modificar textos de idioma', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'4699b32f-5476-4b15-b86e-e2e0472722fd', N'Plataforma · Utilidades › Idiomas'),
  (N'ACT_SLIDER_CREAR', N'Crear slider de inicio', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'622009d9-48fa-429a-908b-d15985c32f97', N'Plataforma · Utilidades › Slider'),
  (N'ACT_SLIDER_ELIMINAR', N'Eliminar slider de inicio', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'622009d9-48fa-429a-908b-d15985c32f97', N'Plataforma · Utilidades › Slider'),
  (N'ACT_SLIDER_MODIFICAR', N'Modificar slider de inicio', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'622009d9-48fa-429a-908b-d15985c32f97', N'Plataforma · Utilidades › Slider'),
  (N'ACT_PESTANAS_CREAR', N'Crear pestañas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_PESTANAS_ELIMINAR', N'Eliminar pestañas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_PESTANAS_MODIFICAR', N'Modificar pestañas', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSPEST_CREAR', N'Crear tipos de pestaña', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSPEST_ELIMINAR', N'Eliminar tipos de pestaña', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSPEST_MODIFICAR', N'Modificar tipos de pestaña', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSWDGT_CREAR', N'Crear tipos de widget', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSWDGT_ELIMINAR', N'Eliminar tipos de widget', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_TIPOSWDGT_MODIFICAR', N'Modificar tipos de widget', N'e1a8fa99-15db-479b-a0a4-9c2be72273b5', N'e1a8fa99-15db-479b-a0a4-9c2be72273c9', N'46f2fc3b-de76-4113-9ee6-574be349f93e', N'Plataforma · Utilidades › Widgets'),
  (N'ACT_SIMULADOR_CONTROLAR', N'Iniciar o detener el simulador GNL', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'8396d973-ed98-43f0-be32-c93c21a8d2dc', N'Porttos · Configuracion › Cron Monitor'),
  (N'ACT_BODEGAS_CREAR', N'Crear bodegas', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_BODEGAS_MODIFICAR', N'Modificar bodegas', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_BODEGAS_MOVIMIENTO', N'Registrar movimientos en bodegas', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INGESTA_CARGAR', N'Cargar archivos de operación', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INGESTA_SINCRONIZAR', N'Forzar la sincronización de datos', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INV_ACTUALIZAR', N'Actualizar inventario de contenedores', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INV_CARGUE', N'Cargue masivo del inventario de contenedores', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INV_CREAR', N'Crear inventario de contenedores', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_INV_ELIMINAR', N'Eliminar inventario de contenedores', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62b9b', N'Porttos · Configuracion › Ingesta'),
  (N'ACT_FAROS_CREAR', N'Crear faros', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi', N'Porttos · Infraestructura › Faros'),
  (N'ACT_FAROS_ELIMINAR', N'Eliminar faros', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi', N'Porttos · Infraestructura › Faros'),
  (N'ACT_FAROS_MODIFICAR', N'Modificar faros', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi', N'Porttos · Infraestructura › Faros'),
  (N'ACT_INFRA_CREAR', N'Crear infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u2o5', N'Porttos · Infraestructura'),
  (N'ACT_INFRA_ELIMINAR', N'Eliminar infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u2o5', N'Porttos · Infraestructura'),
  (N'ACT_INFRA_MODIFICAR', N'Modificar infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u2o5', N'Porttos · Infraestructura'),
  (N'ACT_MUELLES_CREAR', N'Crear muelles', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u4sm', N'Porttos · Infraestructura › Muelles'),
  (N'ACT_MUELLES_ELIMINAR', N'Eliminar muelles', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u4sm', N'Porttos · Infraestructura › Muelles'),
  (N'ACT_MUELLES_MODIFICAR', N'Modificar muelles', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u4sm', N'Porttos · Infraestructura › Muelles'),
  (N'ACT_PUERTOS_CREAR', N'Crear puertos', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u76n', N'Porttos · Infraestructura › Puertos'),
  (N'ACT_PUERTOS_ELIMINAR', N'Eliminar puertos', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u76n', N'Porttos · Infraestructura › Puertos'),
  (N'ACT_PUERTOS_MODIFICAR', N'Modificar puertos', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u76n', N'Porttos · Infraestructura › Puertos'),
  (N'ACT_TERMINALES_CREAR', N'Crear terminales', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9zj', N'Porttos · Infraestructura › Terminales'),
  (N'ACT_TERMINALES_ELIMINAR', N'Eliminar terminales', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9zj', N'Porttos · Infraestructura › Terminales'),
  (N'ACT_TERMINALES_MODIFICAR', N'Modificar terminales', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9zj', N'Porttos · Infraestructura › Terminales'),
  (N'ACT_TIPOSINFRA_CREAR', N'Crear tipos de infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9E3', N'Porttos · Infraestructura › Tipos Infraestructura'),
  (N'ACT_TIPOSINFRA_ELIMINAR', N'Eliminar tipos de infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9E3', N'Porttos · Infraestructura › Tipos Infraestructura'),
  (N'ACT_TIPOSINFRA_MODIFICAR', N'Modificar tipos de infraestructura', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a007360d-6845-4481-b70b-e4d667611f06', N'733e3cfb-db6e-4eba-baa3-456d18c62u9E3', N'Porttos · Infraestructura › Tipos Infraestructura'),
  (N'ACT_ALERTAS_CREAR', N'Crear alertas', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_ALERTAS_REGLAS', N'Configurar reglas de alertas del mapa', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_EVENTOS_DESPEJAR', N'Despejar eventos viales', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_IA_ADMIN', N'Administrar la capa de IA', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_IA_ANALIZAR', N'Ejecutar análisis y resúmenes de IA', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_MOTONAVES_VINCULAR', N'Vincular motonaves', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control'),
  (N'ACT_TABLERO_PLANTILLA', N'Configurar la plantilla del tablero', N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa', N'a815687f-b9b6-4404-83dd-9a4074224320', N'914274bc-7dd5-403f-96ec-9d3065c5u3c8', N'Porttos · Panel Control › Tablero Control');

-- Módulos que no existen en esta base: se detiene sin cambiar nada
IF EXISTS (SELECT 1 FROM @nuevas n WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLModulosAP mo WHERE mo.codigoModulo = n.codigoModulo))
BEGIN
  SELECT n.llavePermiso, n.codigoModulo, n.ubicacion AS moduloFaltante FROM @nuevas n
  WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLModulosAP mo WHERE mo.codigoModulo = n.codigoModulo);
  RAISERROR('Hay actividades con un módulo que no existe en esta base (ver la lista). No se cambió nada.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Actividades nuevas
INSERT INTO dbo.PTLActividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), n.codigoAplicacion, n.codigoSuite, n.codigoModulo, N'e1a8fa99-15db-479b-a0a4-9c2be72272n8', n.llavePermiso, n.actividad,
       N'OT-020 · ' + n.ubicacion, 1, NULL, @ahora, NULL, @ahora
FROM @nuevas n
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLActividades a WHERE a.llavePermiso = n.llavePermiso);
DECLARE @creadas INT = @@ROWCOUNT;

-- 2a. Filas del ADMINISTRADOR que estaban en 0
UPDATE ar SET permiso = 1, fechaModificacion = @ahora
FROM dbo.PTLActividadesRoles ar
INNER JOIN dbo.PTLActividades a ON a.codigoActividad = ar.codigoActividad AND a.estadoActividad = 1
INNER JOIN dbo.PTLRolesAP r ON r.codigoRole = ar.codigoRole AND r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE ar.permiso = 0;
DECLARE @subidas INT = @@ROWCOUNT;

-- 2b. Actividades activas de cada aplicación que su ADMINISTRADOR no tiene
INSERT INTO dbo.PTLActividadesRoles (codigoActividadRole, codigoActividad, codigoRole, permiso,
                                     codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), a.codigoActividad, r.codigoRole, 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTLActividades a
INNER JOIN dbo.PTLRolesAP r ON r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE a.estadoActividad = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLActividadesRoles ar WHERE ar.codigoActividad = a.codigoActividad AND ar.codigoRole = r.codigoRole);
DECLARE @asignadas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Actividades creadas: ', @creadas, ' · asignaciones nuevas al ADMINISTRADOR: ', @asignadas, ' · subidas a permiso 1: ', @subidas);

-- Resumen por aplicación (Sistemas sin ROLE_ADMINISTRADOR: sale con rol NULL y se reporta)
SELECT ap.nombreAplicacion,
       r.nombreRole AS rolAdministrador,
       (SELECT COUNT(*) FROM dbo.PTLActividades a WHERE a.codigoAplicacion = ap.codigoAplicacion AND a.estadoActividad = 1) AS actividadesActivas,
       (SELECT COUNT(*) FROM dbo.PTLActividadesRoles ar INNER JOIN dbo.PTLActividades a ON a.codigoActividad = ar.codigoActividad
         WHERE ar.codigoRole = r.codigoRole AND ar.permiso = 1 AND a.estadoActividad = 1) AS actividadesDelAdministrador
FROM dbo.PTLAplicaciones ap
LEFT JOIN dbo.PTLRolesAP r ON r.codigoAplicacion = ap.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
ORDER BY ap.nombreAplicacion;
