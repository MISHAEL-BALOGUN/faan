Build a complete, simple web application called “FAAN ICT Equipment and Maintenance Management System” for the ICT department of the Federal Airports Authority of Nigeria in Ikeja, Lagos.

The app should help ICT staff register equipment, record faults, assign technicians, and keep maintenance histories. Treat this as a proposed student project and demonstration, without claiming it is an officially approved FAAN system.

TECHNOLOGY

Use:

- React with TypeScript and Vite for the frontend.
- Tailwind CSS for styling.
- Node.js with Express and TypeScript for the backend.
- SQLite with Prisma ORM for the database.
Keep the SQLite database on the backend. All users must access the same records through the API. Do not use localStorage as the main database.

USER ROLES

1. Administrator:

- Manage user accounts and equipment records.
- View all fault reports.
- Assign faults to technicians.
- Update maintenance records.
- Access reports.

1. Technician:

- View equipment records.
- Submit fault reports.
- View assigned faults.
- Update the status of assigned faults.
- Record work performed and repair outcomes.
Use secure login and logout, hashed passwords, and backend role checks. Do not allow public registration. Provide a seed script that creates demonstration accounts.

MAIN FEATURES

1. Dashboard
Display:

- Total equipment.
- Operational equipment.
- Equipment under maintenance.
- Open fault reports.
- Resolved fault reports.
- Recent faults and maintenance activities.
Calculate these figures from the database.

1. Equipment management
Allow administrators to add, view, edit, search, and filter equipment.
Equipment fields:

- Unique asset number.
- Equipment name.
- Category: desktop, laptop, printer, router, switch, UPS, or other.
- Brand and model.
- Serial number, if available.
- Department.
- Location or office.
- Assigned staff member, if applicable.
- Purchase date, if known.
- Condition: operational, faulty, under maintenance, or retired.
- Notes.
Each equipment detail page should display its fault and maintenance history. Prevent duplicate asset numbers. Equipment with existing history should be retired rather than permanently deleted.

1. Staff directory
Store:

- Staff name.
- Staff ID.
- Department.
- Email.
- Phone number.
Staff directory entries are separate from login accounts. An equipment assignment should reference a staff record.

1. Fault reporting
Allow administrators and technicians to create fault reports linked to equipment.
Fault fields:

- Automatically generated unique reference number.
- Equipment.
- Short problem title.
- Problem description.
- Priority: low, medium, or high.
- Reporter.
- Report date.
- Assigned technician.
- Status: reported, under repair, or resolved.
- Resolution date, when applicable.
Allow searching and filtering by equipment, status, priority, and technician.

1. Maintenance records
For each fault, record:

- Technician responsible.
- Date of maintenance.
- Work performed.
- Parts replaced, if any.
- Repair cost in Nigerian naira, if applicable.
- Outcome.
- Additional notes.
A fault can have multiple maintenance entries. Resolving a fault must require a resolution summary and automatically record the resolution date.

Keep equipment condition consistent with its faults. Do not automatically mark equipment operational while another unresolved fault remains.

1. Reports
Provide:

- Equipment list.
- Open faults.
- Completed repairs.
- Maintenance history within a selected date range.
Support CSV export and a simple printable report layout.

DATABASE DESIGN

Create related tables for:

- Users.
- Staff.
- Equipment.
- FaultReports.
- MaintenanceRecords.
Use primary keys, foreign keys, timestamps, and appropriate indexes. Enable SQLite foreign-key enforcement. Validate related records and use transactions where several records must update together.

DESIGN

Use a clean, professional interface with dark green, white, and charcoal colours.

Include navigation for:

- Dashboard.
- Equipment.
- Staff.
- Fault Reports.
- Maintenance.
- Reports.
- User Management, visible only to administrators.
Use readable forms, clear tables, status badges, confirmation dialogs, and helpful validation messages. Support desktop and mobile screens. Include loading, empty, error, and success states.

SECURITY AND VALIDATION

- Validate data on the backend.
- Protect every private API endpoint.
- Enforce permissions on the backend.
- Technicians must only update faults assigned to them.
- Store passwords as secure hashes.
- Use secure session cookies.
- Protect cookie-authenticated changes against CSRF.
- Keep secrets in environment variables.
- Return helpful errors without exposing internal details.
- Reject negative maintenance costs and invalid status changes.
SAMPLE DATA

Seed fictional staff, equipment, faults, and maintenance records. Clearly label the dataset as demonstration data. Do not invent real FAAN staff or confidential records.

DELIVERABLES

Provide:

1. Complete working frontend and backend.
2. Prisma schema and database migrations.
3. Demonstration seed script.
4. An .env.example file.
5. README with installation, database setup, development commands, and demonstration login details.
6. Instructions for backing up and restoring SQLite.
7. A brief explanation of the database relationships.
8. Basic tests for login permissions, equipment creation, fault assignment, and fault resolution.
Use a server with persistent disk storage when hosting SQLite. Explain that separate app instances must not each use independent database files.

BUILD PROCESS

Implement the project fully rather than producing only a plan or interface mockup. Connect every screen to the backend and database. Verify the main workflow:

Administrator logs in → creates staff and equipment records → reports a fault → assigns a technician → technician records maintenance → resolves the fault → dashboard and reports update.

Keep the first version focused and easy for a student to understand. Do not add AI, payment processing, flight tracking, or unrelated airport features.


use the lasu-logo in the download folder in this system 