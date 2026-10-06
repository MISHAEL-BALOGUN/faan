import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/db.js';
const DEMO_NOTE = 'Fictional demonstration record — not official FAAN data.';

async function main() {
  const passwordHash = await bcrypt.hash('DemoAdmin!2026', 12);
  const techHash = await bcrypt.hash('DemoTech!2026', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin.demo@example.test' },
    update: {},
    create: { name: 'Ada Demonstration', email: 'admin.demo@example.test', passwordHash, role: 'ADMIN' },
  });
  const technician = await prisma.user.upsert({
    where: { email: 'technician.demo@example.test' },
    update: {},
    create: { name: 'Bola Example', email: 'technician.demo@example.test', passwordHash: techHash, role: 'TECHNICIAN' },
  });
  const technician2 = await prisma.user.upsert({
    where: { email: 'technician2.demo@example.test' },
    update: {},
    create: { name: 'Tunde Sample', email: 'technician2.demo@example.test', passwordHash: techHash, role: 'TECHNICIAN' },
  });

  const staffSeed = [
    { name: 'Chika Sample', staffId: 'DEMO-STAFF-001', department: 'ICT Operations', email: 'chika.sample@example.test', phone: '0800 000 0001' },
    { name: 'Ifeoma Fictional', staffId: 'DEMO-STAFF-002', department: 'Finance', email: 'ifeoma.sample@example.test', phone: '0800 000 0002' },
    { name: 'Musa Example', staffId: 'DEMO-STAFF-003', department: 'Airside Operations', email: 'musa.sample@example.test', phone: '0800 000 0003' },
    { name: 'Ngozi Sample', staffId: 'DEMO-STAFF-004', department: 'Human Resources', email: 'ngozi.sample@example.test', phone: '0800 000 0004' },
  ];
  const staff: Record<string, { id: string }> = {};
  for (const row of staffSeed) {
    staff[row.staffId] = await prisma.staff.upsert({ where: { staffId: row.staffId }, update: {}, create: row });
  }

  const equipmentSeed = [
    { assetNumber: 'DEMO-ICT-001', name: 'Latitude 5440 Laptop', category: 'LAPTOP', brand: 'Dell', model: 'Latitude 5440', serialNumber: 'DEMO-SERIAL-001', department: 'ICT Operations', location: 'Ikeja · Demo Office 01', assignedStaffId: staff['DEMO-STAFF-001'].id, condition: 'UNDER_MAINTENANCE', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-002', name: 'LaserJet Pro Printer', category: 'PRINTER', brand: 'HP', model: 'LaserJet Pro', serialNumber: 'DEMO-SERIAL-002', department: 'ICT Operations', location: 'Ikeja · Demo Office 02', assignedStaffId: staff['DEMO-STAFF-002'].id, condition: 'OPERATIONAL', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-003', name: 'Core Switch Access', category: 'SWITCH', brand: 'Cisco', model: 'Catalyst 2960', serialNumber: 'DEMO-SERIAL-003', department: 'Network Services', location: 'Ikeja · Demo Server Room', assignedStaffId: null, condition: 'OPERATIONAL', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-004', name: 'Office Desktop PC', category: 'DESKTOP', brand: 'HP', model: 'ProDesk 400', serialNumber: 'DEMO-SERIAL-004', department: 'Finance', location: 'Ikeja · Demo Finance Wing', assignedStaffId: staff['DEMO-STAFF-002'].id, condition: 'FAULTY', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-005', name: 'Wireless Router', category: 'ROUTER', brand: 'TP-Link', model: 'Archer C7', serialNumber: 'DEMO-SERIAL-005', department: 'Airside Operations', location: 'Ikeja · Demo Airside Desk', assignedStaffId: staff['DEMO-STAFF-003'].id, condition: 'OPERATIONAL', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-006', name: 'UPS 1500VA', category: 'UPS', brand: 'APC', model: 'Smart-UPS 1500', serialNumber: 'DEMO-SERIAL-006', department: 'ICT Operations', location: 'Ikeja · Demo Server Room', assignedStaffId: null, condition: 'OPERATIONAL', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-007', name: 'Reception Multifunction Printer', category: 'PRINTER', brand: 'Canon', model: 'imageRUNNER', serialNumber: 'DEMO-SERIAL-007', department: 'Human Resources', location: 'Ikeja · Demo Reception', assignedStaffId: staff['DEMO-STAFF-004'].id, condition: 'UNDER_MAINTENANCE', notes: DEMO_NOTE },
    { assetNumber: 'DEMO-ICT-008', name: 'Retired Legacy Desktop', category: 'DESKTOP', brand: 'Lenovo', model: 'ThinkCentre M70', serialNumber: 'DEMO-SERIAL-008', department: 'ICT Operations', location: 'Ikeja · Demo Storage', assignedStaffId: null, condition: 'RETIRED', notes: DEMO_NOTE },
  ];
  const equipment: Record<string, { id: string }> = {};
  for (const row of equipmentSeed) {
    equipment[row.assetNumber] = await prisma.equipment.upsert({
      where: { assetNumber: row.assetNumber },
      update: {},
      create: { ...row, purchaseDate: new Date('2023-05-12') },
    });
  }

  async function ensureFault(reference: string, data: Omit<Prisma.FaultReportUncheckedCreateInput, 'reference'>) {
    const existing = await prisma.faultReport.findUnique({ where: { reference } });
    return existing ?? prisma.faultReport.create({ data: { ...data, reference } });
  }

  const fault1 = await ensureFault('FR-DEMO-0001', {
    equipmentId: equipment['DEMO-ICT-001'].id,
    title: 'Intermittent network connection',
    description: 'Fictional demonstration issue: network connection drops during normal use.',
    priority: 'MEDIUM',
    reportedById: admin.id,
    assignedTechnicianId: technician.id,
    status: 'UNDER_REPAIR',
  });
  const fault2 = await ensureFault('FR-DEMO-0002', {
    equipmentId: equipment['DEMO-ICT-004'].id,
    title: 'Desktop will not power on',
    description: 'Fictional demonstration issue: no display or fan noise when power button is pressed.',
    priority: 'HIGH',
    reportedById: admin.id,
    assignedTechnicianId: technician2.id,
    status: 'UNDER_REPAIR',
  });
  const fault3 = await ensureFault('FR-DEMO-0003', {
    equipmentId: equipment['DEMO-ICT-007'].id,
    title: 'Paper jam on every print job',
    description: 'Fictional demonstration issue: repeated paper jams in the feeder tray.',
    priority: 'MEDIUM',
    reportedById: admin.id,
    assignedTechnicianId: technician.id,
    status: 'REPORTED',
  });
  const fault4 = await ensureFault('FR-DEMO-0004', {
    equipmentId: equipment['DEMO-ICT-002'].id,
    title: 'Faded print output',
    description: 'Fictional demonstration issue: prints appear light after toner replacement.',
    priority: 'LOW',
    reportedById: admin.id,
    assignedTechnicianId: technician.id,
    status: 'RESOLVED',
    resolvedAt: new Date('2026-09-18T11:30:00Z'),
    resolutionSummary: 'Replaced toner cartridge and ran alignment; print quality restored.',
  });

  const maintenanceSeed = [
    {
      faultId: fault1.id, technicianId: technician.id, performedAt: new Date('2026-09-22T09:15:00Z'),
      workPerformed: 'Checked network adapter and updated driver.', partsReplaced: 'None', costNaira: 0,
      outcome: 'Connection stable during initial test; follow-up pending.', notes: 'Fictional demonstration maintenance entry.',
    },
    {
      faultId: fault2.id, technicianId: technician2.id, performedAt: new Date('2026-09-25T14:05:00Z'),
      workPerformed: 'Opened chassis, tested PSU output, and cleaned dust from power connectors.', partsReplaced: 'None yet', costNaira: 0,
      outcome: 'PSU output unstable under load; replacement PSU ordered.', notes: 'Fictional demonstration maintenance entry.',
    },
    {
      faultId: fault4.id, technicianId: technician.id, performedAt: new Date('2026-09-18T10:00:00Z'),
      workPerformed: 'Replaced toner cartridge and ran printer alignment utility.', partsReplaced: 'HP toner cartridge', costNaira: 48500,
      outcome: 'Print quality restored to normal contrast.', notes: 'Fictional demonstration maintenance entry.',
    },
  ];
  for (const row of maintenanceSeed) {
    const existing = await prisma.maintenanceRecord.findFirst({ where: { faultId: row.faultId, workPerformed: row.workPerformed } });
    if (!existing) await prisma.maintenanceRecord.create({ data: row });
  }

  console.log('Demo data ready.');
  console.log('Accounts:');
  console.log(`  Admin:      ${admin.email} / DemoAdmin!2026`);
  console.log(`  Technician: ${technician.email} / DemoTech!2026`);
  console.log(`  Technician: ${technician2.email} / DemoTech!2026`);
  console.log('All names, contacts, assets, faults, and maintenance entries are fictional demonstration data.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
