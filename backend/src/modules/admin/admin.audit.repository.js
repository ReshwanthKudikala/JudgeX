// Audit log persistence for admin actions.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

class AuditLogRepository extends BaseRepository {
  async insert({ actorId, action, entityType, entityId, metadata }, client) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, actor_id, action, entity_type, entity_id, metadata, created_at`,
      [
        id,
        actorId,
        action,
        entityType,
        entityId || null,
        JSON.stringify(metadata || {}),
      ],
      client,
    );
  }

  async list({ page = 1, limit = 20, q, action, entityType, actorId }, client) {
    const { offset } = this.buildPagination({ page, limit });
    const where = ['1=1'];
    const params = [];
    let i = 1;

    if (q) {
      where.push(`(
        a.action ILIKE $${i}
        OR a.entity_type ILIKE $${i}
        OR u.username ILIKE $${i}
        OR CAST(a.entity_id AS TEXT) ILIKE $${i}
      )`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (action) {
      where.push(`a.action = $${i++}`);
      params.push(action);
    }
    if (entityType) {
      where.push(`a.entity_type = $${i++}`);
      params.push(entityType);
    }
    if (actorId) {
      where.push(`a.actor_id = $${i++}`);
      params.push(actorId);
    }

    const whereSql = where.join(' AND ');
    const countRow = await this.queryOne(
      `SELECT COUNT(*)::int AS total
         FROM audit_logs a
         INNER JOIN users u ON u.id = a.actor_id
        WHERE ${whereSql}`,
      params,
      client,
    );

    const rows = await this.queryMany(
      `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id,
              a.metadata, a.created_at, u.username AS actor_username
         FROM audit_logs a
         INNER JOIN users u ON u.id = a.actor_id
        WHERE ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
      client,
    );

    return {
      rows,
      pagination: this.paginationMeta({
        page,
        limit,
        total: countRow?.total ?? 0,
      }),
    };
  }
}

module.exports = {
  AuditLogRepository,
  auditLogRepository: new AuditLogRepository(),
};
