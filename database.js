const { Sequelize, DataTypes } = require("sequelize");

// Conexión a MySQL (Amazon RDS) con datos de variables de entorno.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: Number(process.env.DB_PORT) || 3306,
    logging: false,
  },
);

const Alumno = sequelize.define(
  "Alumno",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombres: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    apellidos: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    matricula: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    promedio: { type: DataTypes.FLOAT, allowNull: false, validate: { min: 0, max: 100 } },
    fotoPerfilUrl: { type: DataTypes.TEXT, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  },
  { timestamps: false },
);

const Profesor = sequelize.define(
  "Profesor",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numeroEmpleado: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    nombres: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    apellidos: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    horasClase: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
  },
  { timestamps: false },
);

module.exports = { sequelize, Alumno, Profesor };
