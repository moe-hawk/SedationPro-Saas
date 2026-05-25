import type { FastifyRequest } from 'fastify';

import { Prisma } from '@sedation-pro/db';

import { db } from './db.js';

export interface AuditInput {
  readonly organizationId: string;
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly request?: FastifyRequest;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const userAgentHeader = input.request?.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(', ') : (userAgentHeader ?? null);

  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      ipAddress: input.request?.ip ?? null,
      userAgent,
      ...(input.metadata ? { metadataJson: input.metadata as Prisma.InputJsonObject } : {}),
    },
  });
}
