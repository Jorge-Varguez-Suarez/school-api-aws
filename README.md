# School API on AWS

REST API for managing students and teachers, built with Node.js and Express and integrated with four AWS services. Built as the course project for AWS Academy Cloud Foundations at Universidad Autónoma de Yucatán.

## AWS services

| Service | Used for |
| --- | --- |
| Amazon RDS (MySQL) | Student and teacher records, through Sequelize with field validations |
| Amazon S3 | Student profile-photo uploads |
| Amazon SNS | Email notifications with student data |
| Amazon DynamoDB | Login session management |

## Endpoints

| Method | Route | Description |
| --- | --- | --- |
| GET, POST | `/alumnos` | List or create students |
| GET, PUT, DELETE | `/alumnos/:id` | Read, update or delete a student |
| GET, POST | `/profesores` | List or create teachers |
| GET, PUT, DELETE | `/profesores/:id` | Read, update or delete a teacher |
| POST | `/alumnos/:id/fotoPerfil` | Upload a profile photo to S3 (multipart field `foto`) |
| POST | `/alumnos/:id/email` | Publish the student's data to an SNS topic |
| POST | `/alumnos/:id/session/login` | Start a session stored in DynamoDB |
| POST | `/alumnos/:id/session/verify` | Check whether a session is active |
| POST | `/alumnos/:id/session/logout` | Close a session |

Responses use standard HTTP status codes: 201 on create, 400 for invalid data or a failed login, 404 for missing records, 405 for unsupported methods and 500 for server errors.

## Running locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your RDS and AWS values.
3. `npm start`

All credentials are read from environment variables; `.env` is excluded by `.gitignore`.

## Next improvements

- Hash student passwords (for example with bcrypt) instead of storing them in plain text.
- Look up sessions by key instead of scanning the DynamoDB table.
- Migrate to AWS SDK for JavaScript v3.
