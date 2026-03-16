import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

export type MachineStatusResponse = {
  has_machine: boolean;
  ssh_key_id?: string | null;
  plan?: {
    tier: string;
    name: string;
    monthly_cost_cents: number;
    ram_mb: number;
    vcpu: number;
    storage_mb: number;
  };
  status?: string;
  current_period_end?: string;
  grace_deadline?: string | null;
  days_remaining?: number | null;
};

export async function getMachineStatus(orgId: string): Promise<MachineStatusResponse> {
  const billingRows = await db
    .select({
      billing: schema.orgMachineBilling,
      plan: schema.machinePlans,
    })
    .from(schema.orgMachineBilling)
    .innerJoin(schema.machinePlans, eq(schema.orgMachineBilling.machinePlanId, schema.machinePlans.id))
    .where(eq(schema.orgMachineBilling.organizationId, orgId))
    .limit(1);

  if (billingRows.length > 0) {
    const row = billingRows[0];
    let daysRemaining: number | null = null;
    if (row.billing.graceDeadline) {
      daysRemaining = Math.max(
        0,
        Math.ceil((row.billing.graceDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
    }

    return {
      has_machine: true,
      ssh_key_id: row.billing.sshKeyId,
      plan: {
        tier: row.plan.tier,
        name: row.plan.name,
        monthly_cost_cents: row.plan.monthlyCostCents,
        ram_mb: row.plan.ramMb,
        vcpu: row.plan.vcpu,
        storage_mb: row.plan.storageMb,
      },
      status: row.billing.status,
      current_period_end: row.billing.currentPeriodEnd.toISOString(),
      grace_deadline: row.billing.graceDeadline?.toISOString() ?? null,
      days_remaining: daysRemaining,
    };
  }

  const sshRow = await db
    .select({ id: schema.sshKeys.id })
    .from(schema.sshKeys)
    .where(
      and(
        eq(schema.sshKeys.organizationId, orgId),
        eq(schema.sshKeys.isActive, true),
      ),
    )
    .limit(1);

  if (sshRow.length > 0) {
    return {
      has_machine: true,
      ssh_key_id: sshRow[0].id,
      status: 'unbilled',
    };
  }

  return { has_machine: false };
}
