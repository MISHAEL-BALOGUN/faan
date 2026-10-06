import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app, { prisma } from './app.js';

async function signIn(email: string, password: string) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf');
  const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ email, password });
  return { agent, token: csrf.body.csrfToken, login };
}

describe('authentication and maintenance permissions', () => {
  let adminAgent: ReturnType<typeof request.agent>;
  let adminToken = '';
  let techAgent: ReturnType<typeof request.agent>;
  let techToken = '';
  let equipmentId = '';
  let faultId = '';

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.maintenanceRecord.deleteMany();
    await prisma.faultReport.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.user.deleteMany();
    const passwordHash = await bcrypt.hash('TestPass!2026', 4);
    await prisma.user.createMany({ data: [
      { id: 'test-admin', name: 'Test Admin', email: 'admin@test.example', passwordHash, role: 'ADMIN' },
      { id: 'test-tech', name: 'Test Tech', email: 'tech@test.example', passwordHash, role: 'TECHNICIAN' },
      { id: 'other-tech', name: 'Other Tech', email: 'other@test.example', passwordHash, role: 'TECHNICIAN' },
    ] });
    const admin = await signIn('admin@test.example', 'TestPass!2026');
    adminAgent = admin.agent; adminToken = admin.token;
    const tech = await signIn('tech@test.example', 'TestPass!2026');
    techAgent = tech.agent; techToken = tech.token;
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('requires login for private API routes and rejects a technician on admin routes', async () => {
    expect((await request(app).get('/api/equipment')).status).toBe(401);
    expect((await techAgent.post('/api/equipment').set('x-csrf-token', techToken).send({})).status).toBe(403);
  });
  it('allows an administrator to create equipment and rejects duplicate asset numbers', async () => {
    const payload = { assetNumber: 'TEST-ICT-001', name: 'Test laptop', category: 'LAPTOP', department: 'ICT', location: 'Demo office', condition: 'OPERATIONAL' };
    const created = await adminAgent.post('/api/equipment').set('x-csrf-token', adminToken).send(payload);
    expect(created.status).toBe(201); equipmentId = created.body.id;
    expect((await adminAgent.post('/api/equipment').set('x-csrf-token', adminToken).send(payload)).status).toBe(409);
    const fault = await adminAgent.post('/api/faults').set('x-csrf-token', adminToken).send({ equipmentId, title: 'No network', description: 'Test fault record', priority: 'HIGH' });
    expect(fault.status).toBe(201); faultId = fault.body.id;
  });
  it('assigns faults only to technician accounts and restricts technician updates', async () => {
    const assignment = await adminAgent.patch(`/api/faults/${faultId}/assign`).set('x-csrf-token', adminToken).send({ technicianId: 'test-tech' });
    expect(assignment.status).toBe(200);
    expect((await techAgent.patch(`/api/faults/${faultId}/status`).set('x-csrf-token', techToken).send({ status: 'UNDER_REPAIR' })).status).toBe(200);
    const other = await signIn('other@test.example', 'TestPass!2026');
    expect((await other.agent.patch(`/api/faults/${faultId}/status`).set('x-csrf-token', other.token).send({ status: 'RESOLVED', resolutionSummary: 'Not assigned' })).status).toBe(403);
    expect((await adminAgent.patch(`/api/faults/${faultId}/assign`).set('x-csrf-token', adminToken).send({ technicianId: 'test-admin' })).status).toBe(400);
    const work = await techAgent.post('/api/maintenance').set('x-csrf-token', techToken).send({ faultId, workPerformed: 'Replaced the damaged test network cable.', outcome: 'Stable connection confirmed.', costNaira: 0 });
    expect(work.status).toBe(201);
  });
  it('requires a resolution summary and timestamps resolved faults', async () => {
    expect((await techAgent.patch(`/api/faults/${faultId}/status`).set('x-csrf-token', techToken).send({ status: 'RESOLVED' })).status).toBe(400);
    const resolved = await techAgent.patch(`/api/faults/${faultId}/status`).set('x-csrf-token', techToken).send({ status: 'RESOLVED', resolutionSummary: 'Replaced cable and confirmed stable connection.' });
    expect(resolved.status).toBe(200); expect(resolved.body.resolvedAt).toBeTruthy();
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    expect(equipment?.condition).toBe('OPERATIONAL');
  });
});
