# MedLink Week 2 Backend (Windows)

Node.js + Express REST API with PostgreSQL/PostGIS, hospital/resource/specialist CRUD, nearby-hospital search, and JWT authentication.

> This is a student-project starter. Use synthetic data only. It is not a clinical system and does not provide verified live hospital availability.

## 1. Install prerequisites

1. Install Node.js 20 or newer: https://nodejs.org/
2. Install PostgreSQL for Windows: https://www.postgresql.org/download/windows/
3. During PostgreSQL setup, remember the password for the `postgres` user.
4. Install PostGIS for your PostgreSQL version using the PostGIS installer/Stack Builder or your PostgreSQL distribution.
5. Optional: install Postman for API testing.

Verify Node.js/npm in PowerShell:
```powershell
node --version
npm --version
```

## 2. Create the database

Open SQL Shell (psql) or pgAdmin and run:
```sql
CREATE DATABASE medlink;
```
Connect to the `medlink` database, then test PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Full_Version();
```
If extension creation fails, install the matching PostGIS package for your PostgreSQL version and retry. Do not continue until the PostGIS query works.

## 3. Configure the project

Extract the ZIP, open PowerShell in the `medlink-week2-backend` folder, and run:
```powershell
npm install
Copy-Item .env.example .env
notepad .env
```
Edit `.env`. Replace `YOUR_PASSWORD` in `DATABASE_URL` with your actual PostgreSQL password. Set `JWT_SECRET` to a random secret at least 32 characters long. Change `ADMIN_PASSWORD` to a strong private password. Do not commit `.env` to Git.

Example (replace the password):
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/medlink
JWT_SECRET=use-a-long-random-secret-string-of-at-least-32-chars
ADMIN_EMAIL=admin@medlink.local
ADMIN_PASSWORD=ChangeThisAdminPassword123!
```

## 4. Create tables and admin account

Run these commands in PowerShell from the project directory:
```powershell
npm run db:init
npm run admin:create
```
The schema creates `hospitals`, `hospital_resources`, `hospital_specialists`, and `users`. PostGIS stores hospital locations and adds a spatial index.

## 5. Start the API

```powershell
npm run dev
```
Expected output:
```text
Connected to PostgreSQL.
MedLink API listening at http://localhost:4000
```
Check in browser or Postman:
`GET http://localhost:4000/api/health`

## 6. Test with Postman

### A. Login as admin
`POST http://localhost:4000/api/auth/login`
Body → raw → JSON:
```json
{
  "email": "admin@medlink.local",
  "password": "ChangeThisAdminPassword123!"
}
```
Use the exact password configured in `.env`. Copy `token` from the response. In Postman, Authorization → Bearer Token → paste token. Alternatively add header `Authorization: Bearer YOUR_TOKEN`.

### B. Create a hospital (admin only)
`POST http://localhost:4000/api/hospitals`
```json
{
  "name": "MedLink Demo Hospital",
  "address": "Jammu, Jammu and Kashmir, India",
  "phone": "0191-000000",
  "email": "demo@example.test",
  "latitude": 32.7266,
  "longitude": 74.8570,
  "operationalStatus": "operational"
}
```
Save the returned hospital `id` for the next requests.

### C. Add resources
`POST http://localhost:4000/api/resources`
```json
{
  "hospitalId": 1,
  "resourceType": "ICU beds",
  "totalQuantity": 20,
  "availableQuantity": 5,
  "status": "available",
  "notes": "Synthetic test data"
}
```
Use your actual hospital ID. Repeat with resource types such as `ventilators`, `CT scanners`, or `oxygen units`.

### D. Add a specialist record
`POST http://localhost:4000/api/specialists`
```json
{
  "hospitalId": 1,
  "specialty": "Cardiology",
  "available": true,
  "countAvailable": 2,
  "dutyNotes": "Synthetic test data"
}
```

### E. Read data
- `GET http://localhost:4000/api/hospitals`
- `GET http://localhost:4000/api/hospitals/1`
- `GET http://localhost:4000/api/resources/hospital/1`
- `GET http://localhost:4000/api/specialists/hospital/1`

### F. Nearby hospital search
`GET http://localhost:4000/api/hospitals/nearby?lat=32.7266&lng=74.8570&radius=10000`
Radius is in metres. The response includes `distance_meters` and excludes hospitals marked `closed`.

### G. Update and delete
- `PUT /api/hospitals/1` (admin only)
- `PUT /api/resources/1` (admin or staff assigned to that hospital)
- `PUT /api/specialists/1` (admin or assigned staff)
- `DELETE /api/resources/1`
- `DELETE /api/specialists/1`
- `DELETE /api/hospitals/1` (admin only; cascades to its resources and specialists)

For PUT requests, send JSON fields to change. Resource quantity constraints are enforced in both the API and database.

### H. Create a hospital staff login
While authenticated as admin:
`POST http://localhost:4000/api/auth/staff`
```json
{
  "name": "Demo Hospital Staff",
  "email": "staff@example.test",
  "password": "A-Strong-Staff-Password-123",
  "hospitalId": 1
}
```
Staff can manage resource and specialist records only for their assigned hospital. Hospital creation, editing, and deletion are admin-only.

## 7. API route summary

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/staff` | Admin |
| GET | `/api/hospitals` | Authenticated |
| GET | `/api/hospitals/:id` | Authenticated |
| GET | `/api/hospitals/nearby?lat=&lng=&radius=` | Authenticated |
| POST | `/api/hospitals` | Admin |
| PUT/DELETE | `/api/hospitals/:id` | Admin |
| GET | `/api/resources/hospital/:hospitalId` | Authenticated |
| POST | `/api/resources` | Admin or assigned hospital staff |
| PUT/DELETE | `/api/resources/:id` | Admin or assigned hospital staff |
| GET | `/api/specialists/hospital/:hospitalId` | Authenticated |
| POST | `/api/specialists` | Admin or assigned hospital staff |
| PUT/DELETE | `/api/specialists/:id` | Admin or assigned hospital staff |

All protected endpoints require `Authorization: Bearer <token>`.

## 8. Common Windows troubleshooting

- **`psql` is not recognized:** open SQL Shell (psql) from the Start menu or add PostgreSQL's `bin` directory to PATH.
- **Password authentication failed:** correct the username/password in `.env`; URL-encode special characters in the password if necessary.
- **`extension "postgis" is not available`:** install PostGIS compatible with your PostgreSQL version.
- **Port 4000 is busy:** change `PORT=4001` in `.env`.
- **`JWT_SECRET` error:** use a random value of 32+ characters.
- **PowerShell blocks npm scripts:** try `npm.cmd install` and `npm.cmd run dev`.

## 9. Before sharing/publishing

- Never commit `.env` or real patient data.
- Use HTTPS, secret management, backups, audit logs, and stricter deployment configuration before any real deployment.
- The sample system uses JWT bearer tokens and role checks; consider token revocation/refresh and audit logging before production.
- Hospital resource status is only as trustworthy as its input data. This demo does not connect to live hospital systems.
