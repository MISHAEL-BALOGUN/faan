import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export { prisma };

// SQLite has no native enum type, so the schema stores these as plain strings.
export type Role = 'ADMIN' | 'TECHNICIAN';
export type EquipmentCondition = 'OPERATIONAL' | 'FAULTY' | 'UNDER_MAINTENANCE' | 'RETIRED';
export type FaultStatus = 'REPORTED' | 'UNDER_REPAIR' | 'RESOLVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieSession({
  name: 'faan_session',
  keys: [process.env.SESSION_SECRET || 'development-only-change-before-deploy'],
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000,
}));

type SessionData = { userId?: string; csrfToken?: string };
type AuthRequest = Request & { authUser?: { id: string; role: Role; name: string; email: string } };
const fail = (res: Response, status: number, error: string) => res.status(status).json({ error });
const asyncRoute = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => { void Promise.resolve(handler(req as AuthRequest, res, next)).catch(next); };
const sessionOf = (req: Request) => req.session as (SessionData | null);

const requireAuth = asyncRoute(async (req, res, next) => {
  const userId = sessionOf(req)?.userId;
  if (!userId) return fail(res, 401, 'Please sign in to continue.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true, email: true, isActive: true } });
  if (!user || !user.isActive) return fail(res, 401, 'Your session is no longer active. Please sign in again.');
  req.authUser = { ...user, role: user.role as Role };
  next();
});
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) =>
  req.authUser?.role === 'ADMIN' ? next() : fail(res, 403, 'Administrator access is required.');
const csrf = (req: Request, res: Response, next: NextFunction) => {
  const expected = sessionOf(req)?.csrfToken;
  if (!expected || req.get('x-csrf-token') !== expected) return fail(res, 403, 'Your session token is missing or expired. Refresh and try again.');
  next();
};
const s = z.string().trim().min(1).max(500);
const optionalText = z.string().trim().max(2000).optional().or(z.literal(''));
const equipmentSchema = z.object({
  assetNumber: s, name: s, category: z.enum(['DESKTOP', 'LAPTOP', 'PRINTER', 'ROUTER', 'SWITCH', 'UPS', 'OTHER']),
  brand: optionalText, model: optionalText, serialNumber: optionalText, department: s, location: s,
  assignedStaffId: z.string().optional().nullable(), purchaseDate: z.string().optional().nullable(),
  condition: z.enum(['OPERATIONAL', 'FAULTY', 'UNDER_MAINTENANCE', 'RETIRED']).optional(), notes: optionalText,
});
const staffSchema = z.object({ name: s, staffId: s, department: s, email: z.string().email().optional().or(z.literal('')), phone: optionalText });
const faultSchema = z.object({ equipmentId: s, title: s, description: s, priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM') });
const maintenanceSchema = z.object({ faultId: s, workPerformed: s, partsReplaced: optionalText, costNaira: z.number().min(0).optional().nullable(), outcome: s, notes: optionalText, performedAt: z.string().optional() });
const userSchema = z.object({ name: s, email: z.string().email(), password: z.string().min(10).max(128), role: z.enum(['ADMIN', 'TECHNICIAN']) });
const displayFault = { equipment: { select: { id: true, assetNumber: true, name: true, condition: true } }, reportedBy: { select: { id: true, name: true } }, assignedTechnician: { select: { id: true, name: true, email: true } }, maintenance: { include: { technician: { select: { id: true, name: true } } }, orderBy: { performedAt: 'desc' as const } } };

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/auth/csrf', (req, res) => {
  const session = (sessionOf(req) || {}) as SessionData;
  session.csrfToken ||= randomBytes(32).toString('hex');
  req.session = session;
  res.json({ csrfToken: session.csrfToken });
});
app.post('/api/auth/login', csrf, asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return fail(res, 400, 'Enter a valid email and password.');
  const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
  if (!user?.isActive || !await bcrypt.compare(body.data.password, user.passwordHash)) return fail(res, 401, 'Email or password is incorrect.');
  const csrfToken = sessionOf(req)?.csrfToken;
  req.session = { userId: user.id, csrfToken };
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));
app.post('/api/auth/logout', csrf, requireAuth, (req, res) => { req.session = null; res.status(204).end(); });
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => res.json({ user: req.authUser }));

app.use('/api', requireAuth);
app.use('/api', (req, res, next) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? csrf(req, res, next) : next());

app.get('/api/dashboard', asyncRoute(async (req, res) => {
  const [totalEquipment, operationalEquipment, underMaintenanceEquipment, openFaults, resolvedFaults, recentFaults, recentMaintenance] = await Promise.all([
    prisma.equipment.count(), prisma.equipment.count({ where: { condition: 'OPERATIONAL' } }),
    prisma.equipment.count({ where: { condition: 'UNDER_MAINTENANCE' } }),
    prisma.faultReport.count({ where: { status: { not: 'RESOLVED' } } }),
    prisma.faultReport.count({ where: { status: 'RESOLVED' } }),
    prisma.faultReport.findMany({ where: req.authUser?.role === 'TECHNICIAN' ? { assignedTechnicianId: req.authUser.id } : {}, take: 6, orderBy: { reportedAt: 'desc' }, include: displayFault }),
    prisma.maintenanceRecord.findMany({ where: req.authUser?.role === 'TECHNICIAN' ? { technicianId: req.authUser.id } : {}, take: 5, orderBy: { performedAt: 'desc' }, include: { fault: { include: { equipment: { select: { assetNumber: true, name: true } } } }, technician: { select: { name: true } } } }),
  ]);
  res.json({ totalEquipment, operationalEquipment, underMaintenanceEquipment, openFaults, resolvedFaults, recentFaults, recentMaintenance });
}));

app.get('/api/equipment', asyncRoute(async (_req, res) => {
  const q = String(_req.query.q || '').trim();
  const where: Prisma.EquipmentWhereInput = q ? { OR: [{ assetNumber: { contains: q } }, { name: { contains: q } }, { department: { contains: q } }, { location: { contains: q } }] } : {};
  if (_req.query.condition) where.condition = String(_req.query.condition) as EquipmentCondition;
  if (_req.query.category) where.category = String(_req.query.category) as Prisma.EquipmentWhereInput['category'];
  res.json(await prisma.equipment.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { assignedStaff: true, _count: { select: { faults: true } } } }));
}));
app.get('/api/equipment/:id', asyncRoute(async (req: AuthRequest, res) => {
  const item = await prisma.equipment.findUnique({ where: { id: req.params.id }, include: { assignedStaff: { select: { id: true, name: true, staffId: true, department: true } }, faults: { where: req.authUser?.role === 'TECHNICIAN' ? { assignedTechnicianId: req.authUser.id } : {}, orderBy: { reportedAt: 'desc' }, include: displayFault } } });
  return item ? res.json(item) : fail(res, 404, 'Equipment record not found.');
}));
app.post('/api/equipment', requireAdmin, asyncRoute(async (req, res) => {
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Check the equipment details.');
  const data = parsed.data;
  const item = await prisma.equipment.create({ data: { ...data, category: data.category, condition: data.condition || 'OPERATIONAL', brand: data.brand || null, model: data.model || null, serialNumber: data.serialNumber || null, notes: data.notes || null, assignedStaffId: data.assignedStaffId || null, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null } });
  res.status(201).json(item);
}));
app.put('/api/equipment/:id', requireAdmin, asyncRoute(async (req, res) => {
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Check the equipment details.');
  const data = parsed.data;
  const item = await prisma.$transaction(async tx => {
    const unresolved = await tx.faultReport.findMany({ where: { equipmentId: req.params.id, status: { not: 'RESOLVED' } }, select: { status: true } });
    const condition = data.condition === 'RETIRED' ? 'RETIRED' : unresolved.length ? unresolved.some(f => f.status === 'UNDER_REPAIR') ? 'UNDER_MAINTENANCE' : 'FAULTY' : data.condition;
    return tx.equipment.update({ where: { id: req.params.id }, data: { ...data, condition, brand: data.brand || null, model: data.model || null, serialNumber: data.serialNumber || null, notes: data.notes || null, assignedStaffId: data.assignedStaffId || null, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null } });
  });
  res.json(item);
}));
app.delete('/api/equipment/:id', requireAdmin, asyncRoute(async (req, res) => {
  const item = await prisma.equipment.findUnique({ where: { id: req.params.id }, include: { _count: { select: { faults: true } } } });
  if (!item) return fail(res, 404, 'Equipment record not found.');
  if (item._count.faults) await prisma.equipment.update({ where: { id: item.id }, data: { condition: 'RETIRED' } });
  else await prisma.equipment.delete({ where: { id: item.id } });
  res.status(204).end();
}));

app.get('/api/staff', requireAdmin, asyncRoute(async (_req, res) => res.json(await prisma.staff.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { equipment: true } } } }))));
app.post('/api/staff', requireAdmin, asyncRoute(async (req, res) => {
  const p = staffSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the staff details.');
  res.status(201).json(await prisma.staff.create({ data: { ...p.data, email: p.data.email || null, phone: p.data.phone || null } }));
}));
app.put('/api/staff/:id', requireAdmin, asyncRoute(async (req, res) => {
  const p = staffSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the staff details.');
  res.json(await prisma.staff.update({ where: { id: req.params.id }, data: { ...p.data, email: p.data.email || null, phone: p.data.phone || null } }));
}));
app.delete('/api/staff/:id', requireAdmin, asyncRoute(async (req, res) => { await prisma.staff.delete({ where: { id: req.params.id } }); res.status(204).end(); }));

app.get('/api/users', requireAdmin, asyncRoute(async (_req, res) => res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }, orderBy: { createdAt: 'desc' } }))));
app.post('/api/users', requireAdmin, asyncRoute(async (req, res) => {
  const p = userSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the account details.');
  const user = await prisma.user.create({ data: { name: p.data.name, email: p.data.email.toLowerCase(), passwordHash: await bcrypt.hash(p.data.password, 12), role: p.data.role } });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
}));
app.patch('/api/users/:id/active', requireAdmin, asyncRoute(async (req, res) => {
  if (req.params.id === req.authUser?.id) return fail(res, 400, 'You cannot deactivate your own account.');
  const active = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!active.success) return fail(res, 400, 'Choose an account status.');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: active.data.isActive }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  res.json(user);
}));

app.get('/api/faults', asyncRoute(async (req: AuthRequest, res) => {
  const where: Prisma.FaultReportWhereInput = req.authUser?.role === 'TECHNICIAN' ? { assignedTechnicianId: req.authUser.id } : {};
  if (req.query.status) where.status = String(req.query.status) as FaultStatus;
  if (req.query.priority) where.priority = String(req.query.priority) as Priority;
  if (req.query.equipmentId) where.equipmentId = String(req.query.equipmentId);
  if (req.query.technicianId) where.assignedTechnicianId = String(req.query.technicianId);
  if (req.query.q) where.OR = [{ title: { contains: String(req.query.q) } }, { reference: { contains: String(req.query.q) } }];
  res.json(await prisma.faultReport.findMany({ where, orderBy: { reportedAt: 'desc' }, include: displayFault }));
}));
app.post('/api/faults', asyncRoute(async (req: AuthRequest, res) => {
  const p = faultSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the fault details.');
  const equipment = await prisma.equipment.findUnique({ where: { id: p.data.equipmentId } });
  if (!equipment || equipment.condition === 'RETIRED') return fail(res, 400, 'Select active equipment for this fault report.');
  const created = await prisma.$transaction(async tx => {
    const fault = await tx.faultReport.create({ data: { ...p.data, reference: `FR-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`, reportedById: req.authUser!.id } });
    const active = await tx.faultReport.findMany({ where: { equipmentId: equipment.id, status: { not: 'RESOLVED' } }, select: { status: true } });
    await tx.equipment.update({ where: { id: equipment.id }, data: { condition: active.some(f => f.status === 'UNDER_REPAIR') ? 'UNDER_MAINTENANCE' : 'FAULTY' } });
    return fault;
  });
  res.status(201).json(created);
}));
app.patch('/api/faults/:id/assign', requireAdmin, asyncRoute(async (req, res) => {
  const p = z.object({ technicianId: s }).safeParse(req.body); if (!p.success) return fail(res, 400, 'Choose a technician to assign.');
  const technician = await prisma.user.findUnique({ where: { id: p.data.technicianId } });
  if (!technician || technician.role !== 'TECHNICIAN' || !technician.isActive) return fail(res, 400, 'Choose an active technician account.');
  const existing = await prisma.faultReport.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 404, 'Fault report not found.');
  if (existing.status === 'RESOLVED') return fail(res, 400, 'Resolved faults cannot be reassigned.');
  const fault = await prisma.faultReport.update({ where: { id: req.params.id }, data: { assignedTechnicianId: technician.id }, include: displayFault });
  res.json(fault);
}));
app.patch('/api/faults/:id/status', asyncRoute(async (req: AuthRequest, res) => {
  const p = z.object({ status: z.enum(['REPORTED', 'UNDER_REPAIR', 'RESOLVED']), resolutionSummary: z.string().trim().min(5).max(2000).optional() }).safeParse(req.body);
  if (!p.success) return fail(res, 400, 'Choose a valid status and provide a resolution summary when resolving.');
  const existing = await prisma.faultReport.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 404, 'Fault report not found.');
  if (req.authUser?.role === 'TECHNICIAN' && existing.assignedTechnicianId !== req.authUser.id) return fail(res, 403, 'You can only update faults assigned to you.');
  if (existing.status === 'RESOLVED' || existing.status === p.data.status || (existing.status === 'REPORTED' && p.data.status !== 'UNDER_REPAIR') || (existing.status === 'UNDER_REPAIR' && p.data.status !== 'RESOLVED')) return fail(res, 400, 'That fault status change is not allowed.');
  if (p.data.status === 'RESOLVED' && !p.data.resolutionSummary) return fail(res, 400, 'A resolution summary is required.');
  if (p.data.status === 'RESOLVED' && !await prisma.maintenanceRecord.count({ where: { faultId: existing.id } })) return fail(res, 400, 'Record maintenance work before resolving this fault.');
  const updated = await prisma.$transaction(async tx => {
    const fault = await tx.faultReport.update({ where: { id: existing.id }, data: { status: p.data.status, ...(p.data.status === 'RESOLVED' ? { resolvedAt: new Date(), resolutionSummary: p.data.resolutionSummary } : {}) } });
    const unresolved = await tx.faultReport.findMany({ where: { equipmentId: existing.equipmentId, status: { not: 'RESOLVED' } }, select: { status: true } });
    const currentEquipment = await tx.equipment.findUniqueOrThrow({ where: { id: existing.equipmentId }, select: { condition: true } });
    const condition: EquipmentCondition = currentEquipment.condition === 'RETIRED' ? 'RETIRED' : unresolved.length === 0 ? 'OPERATIONAL' : unresolved.some(f => f.status === 'UNDER_REPAIR') ? 'UNDER_MAINTENANCE' : 'FAULTY';
    await tx.equipment.update({ where: { id: existing.equipmentId }, data: { condition } });
    return fault;
  });
  res.json(updated);
}));

app.get('/api/maintenance', asyncRoute(async (req: AuthRequest, res) => {
  const where: Prisma.MaintenanceRecordWhereInput = req.authUser?.role === 'TECHNICIAN' ? { technicianId: req.authUser.id } : {};
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && Number.isNaN(+from)) || (to && Number.isNaN(+to))) return fail(res, 400, 'Provide valid date filters.');
  if (from || to) where.performedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  res.json(await prisma.maintenanceRecord.findMany({ where, orderBy: { performedAt: 'desc' }, include: { fault: { include: { equipment: { select: { id: true, assetNumber: true, name: true } } } }, technician: { select: { id: true, name: true } } } }));
}));
app.post('/api/maintenance', asyncRoute(async (req: AuthRequest, res) => {
  const p = maintenanceSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the maintenance details.');
  const fault = await prisma.faultReport.findUnique({ where: { id: p.data.faultId } });
  if (!fault || fault.status === 'RESOLVED') return fail(res, 400, 'Select an open fault report.');
  if (!fault.assignedTechnicianId) return fail(res, 400, 'Assign a technician before recording maintenance.');
  if (req.authUser?.role === 'TECHNICIAN' && fault.assignedTechnicianId !== req.authUser.id) return fail(res, 403, 'You can only record work for faults assigned to you.');
  const performedAt = p.data.performedAt ? new Date(p.data.performedAt) : new Date();
  if (Number.isNaN(+performedAt)) return fail(res, 400, 'Provide a valid maintenance date.');
  const record = await prisma.$transaction(async tx => {
    const entry = await tx.maintenanceRecord.create({ data: { faultId: fault.id, technicianId: req.authUser!.role === 'TECHNICIAN' ? req.authUser!.id : fault.assignedTechnicianId!, performedAt, workPerformed: p.data.workPerformed, partsReplaced: p.data.partsReplaced || null, costNaira: p.data.costNaira ?? null, outcome: p.data.outcome, notes: p.data.notes || null } });
    if (fault.status === 'REPORTED') await tx.faultReport.update({ where: { id: fault.id }, data: { status: 'UNDER_REPAIR' } });
    const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: fault.equipmentId }, select: { condition: true } });
    if (equipment.condition !== 'RETIRED') await tx.equipment.update({ where: { id: fault.equipmentId }, data: { condition: 'UNDER_MAINTENANCE' } });
    return entry;
  });
  res.status(201).json(record);
}));
app.put('/api/maintenance/:id', asyncRoute(async (req: AuthRequest, res) => {
  const p = maintenanceSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the maintenance details.');
  const existing = await prisma.maintenanceRecord.findUnique({ where: { id: req.params.id }, include: { fault: true } });
  if (!existing) return fail(res, 404, 'Maintenance record not found.');
  if (req.authUser?.role === 'TECHNICIAN' && (existing.technicianId !== req.authUser.id || existing.fault.assignedTechnicianId !== req.authUser.id)) return fail(res, 403, 'You can only update your own work on assigned faults.');
  if (p.data.faultId !== existing.faultId) return fail(res, 400, 'Maintenance entries cannot be moved to a different fault.');
  const performedAt = p.data.performedAt ? new Date(p.data.performedAt) : existing.performedAt;
  if (Number.isNaN(+performedAt)) return fail(res, 400, 'Provide a valid maintenance date.');
  const record = await prisma.maintenanceRecord.update({ where: { id: existing.id }, data: { performedAt, workPerformed: p.data.workPerformed, partsReplaced: p.data.partsReplaced || null, costNaira: p.data.costNaira ?? null, outcome: p.data.outcome, notes: p.data.notes || null } });
  res.json(record);
}));

app.get('/api/reports', asyncRoute(async (req: AuthRequest, res) => {
  if (req.authUser?.role !== 'ADMIN') return fail(res, 403, 'Administrator access is required.');
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && Number.isNaN(+from)) || (to && Number.isNaN(+to))) return fail(res, 400, 'Provide valid date filters.');
  const dateFilter = from || to ? { gte: from, lte: to } : undefined;
  const [equipment, openFaults, completedRepairs, maintenance] = await Promise.all([
    prisma.equipment.findMany({ include: { assignedStaff: true }, orderBy: { assetNumber: 'asc' } }),
    prisma.faultReport.findMany({ where: { status: { not: 'RESOLVED' } }, include: displayFault, orderBy: { reportedAt: 'desc' } }),
    prisma.faultReport.findMany({ where: { status: 'RESOLVED', ...(dateFilter ? { resolvedAt: dateFilter } : {}) }, include: displayFault, orderBy: { resolvedAt: 'desc' } }),
    prisma.maintenanceRecord.findMany({ where: dateFilter ? { performedAt: dateFilter } : {}, include: { technician: { select: { name: true } }, fault: { include: { equipment: { select: { assetNumber: true, name: true } } } } }, orderBy: { performedAt: 'desc' } }),
  ]);
  res.json({ equipment, openFaults, completedRepairs, maintenance });
}));

const clientDist = resolve(process.cwd(), '../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => res.sendFile(resolve(clientDist, 'index.html'), error => { if (error) next(); }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail(res, 409, 'That unique value is already in use.');
    if (err.code === 'P2025') return fail(res, 404, 'The requested record was not found.');
    if (err.code === 'P2003') return fail(res, 400, 'A related record could not be found.');
  }
  console.error(err);
  return fail(res, 500, 'Something went wrong. Please try again.');
});

export default app;
