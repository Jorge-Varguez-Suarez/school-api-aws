require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const crypto = require("crypto");
const { sequelize, Alumno, Profesor } = require("./database");
const app = express();

app.use(express.json());
const PORT = process.env.PORT || 80;
const upload = multer({ storage: multer.memoryStorage() });

// Las credenciales se leen de variables de entorno (ver .env.example).
// El SDK toma AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y AWS_SESSION_TOKEN automáticamente.
AWS.config.update({ region: process.env.AWS_REGION || "us-east-1" });

const s3 = new AWS.S3();
const sns = new AWS.SNS();
const dynamo = new AWS.DynamoDB.DocumentClient();
const SESSIONS_TABLE = process.env.DYNAMO_SESSIONS_TABLE || "sesiones-alumnos";

sequelize.sync();

const handleValidation = (err, res) => {
  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeUniqueConstraintError"
  ) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  return res.status(500).json({ error: err.message });
};

const methodNotAllowed = (req, res) =>
  res.status(405).json({ error: "Método no permitido" });

/* --- RUTAS ESTÁNDAR --- */
app
  .route("/alumnos")
  .get(async (req, res) => res.status(200).json(await Alumno.findAll()))
  .post(async (req, res) => {
    try {
      res.status(201).json(await Alumno.create(req.body));
    } catch (err) {
      handleValidation(err, res);
    }
  })
  .all(methodNotAllowed);

app
  .route("/alumnos/:id")
  .get(async (req, res) => {
    const a = await Alumno.findByPk(req.params.id);
    a ? res.status(200).json(a) : res.status(404).json({ error: "No existe" });
  })
  .put(async (req, res) => {
    try {
      const a = await Alumno.findByPk(req.params.id);
      if (!a) return res.status(404).json({ error: "No existe" });
      await a.update(req.body);
      res.status(200).json(a);
    } catch (err) {
      handleValidation(err, res);
    }
  })
  .delete(async (req, res) => {
    const a = await Alumno.findByPk(req.params.id);
    if (!a) return res.status(404).json({ error: "No existe" });
    await a.destroy();
    res.status(200).json({ mensaje: "Eliminado" });
  });

app
  .route("/profesores")
  .get(async (req, res) => res.status(200).json(await Profesor.findAll()))
  .post(async (req, res) => {
    try {
      res.status(201).json(await Profesor.create(req.body));
    } catch (err) {
      handleValidation(err, res);
    }
  })
  .all(methodNotAllowed);

app
  .route("/profesores/:id")
  .get(async (req, res) => {
    const p = await Profesor.findByPk(req.params.id);
    p ? res.status(200).json(p) : res.status(404).json({ error: "No existe" });
  })
  .put(async (req, res) => {
    try {
      const p = await Profesor.findByPk(req.params.id);
      if (!p) return res.status(404).json({ error: "No existe" });
      await p.update(req.body);
      res.status(200).json(p);
    } catch (err) {
      handleValidation(err, res);
    }
  })
  .delete(async (req, res) => {
    const p = await Profesor.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: "No existe" });
    await p.destroy();
    res.status(200).json({ mensaje: "Eliminado" });
  });

/* --- SERVICIOS DE AWS --- */

// S3: foto de perfil del alumno (lectura pública para poder mostrarla)
app.post("/alumnos/:id/fotoPerfil", upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta la foto" });
    const a = await Alumno.findByPk(req.params.id);
    if (!a) return res.status(404).json({ error: "No existe" });

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `foto-${a.id}.jpg`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read",
    };

    const result = await s3.upload(params).promise();
    await a.update({ fotoPerfilUrl: result.Location });
    res.status(200).json({ fotoPerfilUrl: result.Location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SNS: notificación por correo con los datos del alumno
app.post("/alumnos/:id/email", async (req, res) => {
  try {
    const a = await Alumno.findByPk(req.params.id);
    if (!a) return res.status(404).json({ error: "No existe" });
    await sns
      .publish({
        Message: `Alumno: ${a.nombres}, Promedio: ${a.promedio}`,
        TopicArn: process.env.SNS_TOPIC_ARN,
      })
      .promise();
    res.status(200).json({ mensaje: "Enviado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DynamoDB: sesiones. Fallos de validación o inexistencia responden 400.
app.post("/alumnos/:id/session/login", async (req, res) => {
  try {
    const a = await Alumno.findByPk(req.params.id);
    if (!a || a.password !== req.body.password)
      return res.status(400).json({ error: "Login fallido" });

    const item = {
      id: crypto.randomUUID(),
      alumnoId: a.id,
      active: true,
      sessionString: crypto.randomBytes(64).toString("hex"),
      fecha: Math.floor(Date.now() / 1000),
    };

    await dynamo.put({ TableName: SESSIONS_TABLE, Item: item }).promise();
    res.status(200).json({ sessionString: item.sessionString });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/alumnos/:id/session/verify", async (req, res) => {
  try {
    const { sessionString } = req.body;
    const result = await dynamo
      .scan({
        TableName: SESSIONS_TABLE,
        FilterExpression: "sessionString = :ss AND active = :act",
        ExpressionAttributeValues: { ":ss": sessionString || "", ":act": true },
      })
      .promise();

    if (result.Items && result.Items.length > 0) {
      res.status(200).json({ mensaje: "Válida" });
    } else {
      res.status(400).json({ error: "Sesión inválida" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/alumnos/:id/session/logout", async (req, res) => {
  try {
    const { sessionString } = req.body;
    const result = await dynamo
      .scan({
        TableName: SESSIONS_TABLE,
        FilterExpression: "sessionString = :ss",
        ExpressionAttributeValues: { ":ss": sessionString || "" },
      })
      .promise();

    if (result.Items && result.Items.length > 0) {
      await dynamo
        .update({
          TableName: SESSIONS_TABLE,
          Key: { id: result.Items[0].id },
          UpdateExpression: "set active = :a",
          ExpressionAttributeValues: { ":a": false },
        })
        .promise();
      res.status(200).json({ mensaje: "Cerrada" });
    } else {
      res.status(400).json({ error: "No encontrada para cerrar" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: "No encontrado" }));

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
