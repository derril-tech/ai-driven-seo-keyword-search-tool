#!/bin/bash

# SEO Tool Backup Script
# This script performs automated backups of all critical data

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
S3_BUCKET="${S3_BACKUP_BUCKET:-seo-tool-backups}"
S3_REGION="${S3_BACKUP_REGION:-us-east-1}"

# Database configuration
DB_HOST="${DB_HOST:-postgres-service}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-seo_tool}"
DB_USER="${DB_USER:-seo_user}"
DB_PASSWORD="${DB_PASSWORD}"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-redis-service}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

log "Starting backup process..."

# 1. PostgreSQL Backup
log "Backing up PostgreSQL database..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --verbose \
    --no-password \
    --format=custom \
    --compress=9 \
    --file="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    log "PostgreSQL backup completed successfully"
else
    log "ERROR: PostgreSQL backup failed"
    exit 1
fi

# 2. Redis Backup
log "Backing up Redis data..."
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --rdb "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

if [ $? -eq 0 ]; then
    log "Redis backup completed successfully"
else
    log "ERROR: Redis backup failed"
    exit 1
fi

# 3. Configuration Backup
log "Backing up Kubernetes configurations..."
kubectl get all -n seo-tool -o yaml > "${BACKUP_DIR}/k8s_resources_${TIMESTAMP}.yaml"
kubectl get configmaps -n seo-tool -o yaml > "${BACKUP_DIR}/k8s_configmaps_${TIMESTAMP}.yaml"
kubectl get secrets -n seo-tool -o yaml > "${BACKUP_DIR}/k8s_secrets_${TIMESTAMP}.yaml"
kubectl get pvc -n seo-tool -o yaml > "${BACKUP_DIR}/k8s_pvc_${TIMESTAMP}.yaml"

# 4. Application Data Backup (if using persistent volumes)
log "Backing up persistent volume data..."
if kubectl get pvc -n seo-tool | grep -q "postgres-pvc"; then
    kubectl exec -n seo-tool deployment/postgres -- tar czf - /var/lib/postgresql/data > "${BACKUP_DIR}/postgres_data_${TIMESTAMP}.tar.gz"
fi

# 5. Monitoring Data Backup
log "Backing up monitoring data..."
if kubectl get pvc -n seo-tool | grep -q "prometheus-pvc"; then
    kubectl exec -n seo-tool deployment/prometheus -- tar czf - /prometheus > "${BACKUP_DIR}/prometheus_data_${TIMESTAMP}.tar.gz"
fi

# 6. Create backup manifest
log "Creating backup manifest..."
cat > "${BACKUP_DIR}/manifest_${TIMESTAMP}.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "version": "1.0.0",
  "components": {
    "postgres": {
      "file": "postgres_${TIMESTAMP}.dump",
      "size": "$(stat -c%s "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump" 2>/dev/null || echo 0)"
    },
    "redis": {
      "file": "redis_${TIMESTAMP}.rdb",
      "size": "$(stat -c%s "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb" 2>/dev/null || echo 0)"
    },
    "kubernetes": {
      "resources": "k8s_resources_${TIMESTAMP}.yaml",
      "configmaps": "k8s_configmaps_${TIMESTAMP}.yaml",
      "secrets": "k8s_secrets_${TIMESTAMP}.yaml",
      "pvc": "k8s_pvc_${TIMESTAMP}.yaml"
    }
  },
  "retention_policy": {
    "days": ${RETENTION_DAYS}
  }
}
EOF

# 7. Compress backup
log "Compressing backup files..."
cd "${BACKUP_DIR}"
tar czf "seo_tool_backup_${TIMESTAMP}.tar.gz" \
    "postgres_${TIMESTAMP}.dump" \
    "redis_${TIMESTAMP}.rdb" \
    "k8s_resources_${TIMESTAMP}.yaml" \
    "k8s_configmaps_${TIMESTAMP}.yaml" \
    "k8s_secrets_${TIMESTAMP}.yaml" \
    "k8s_pvc_${TIMESTAMP}.yaml" \
    "manifest_${TIMESTAMP}.json" \
    "postgres_data_${TIMESTAMP}.tar.gz" 2>/dev/null || true \
    "prometheus_data_${TIMESTAMP}.tar.gz" 2>/dev/null || true

# 8. Upload to S3 (if configured)
if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    log "Uploading backup to S3..."
    aws s3 cp "seo_tool_backup_${TIMESTAMP}.tar.gz" "s3://${S3_BUCKET}/backups/" \
        --region "${S3_REGION}" \
        --storage-class STANDARD_IA
    
    if [ $? -eq 0 ]; then
        log "Backup uploaded to S3 successfully"
    else
        log "WARNING: Failed to upload backup to S3"
    fi
fi

# 9. Cleanup old backups
log "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "seo_tool_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "postgres_*.dump" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "redis_*.rdb" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "k8s_*.yaml" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "manifest_*.json" -mtime +${RETENTION_DAYS} -delete

# 10. Cleanup S3 old backups (if configured)
if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    log "Cleaning up old S3 backups..."
    CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
    aws s3api list-objects-v2 \
        --bucket "${S3_BUCKET}" \
        --prefix "backups/" \
        --query "Contents[?LastModified<'${CUTOFF_DATE}'].Key" \
        --output text | \
    while read -r key; do
        if [ -n "$key" ]; then
            aws s3 rm "s3://${S3_BUCKET}/${key}"
        fi
    done
fi

# 11. Verify backup integrity
log "Verifying backup integrity..."
if [ -f "seo_tool_backup_${TIMESTAMP}.tar.gz" ]; then
    tar tzf "seo_tool_backup_${TIMESTAMP}.tar.gz" > /dev/null
    if [ $? -eq 0 ]; then
        log "Backup integrity verified successfully"
    else
        log "ERROR: Backup integrity check failed"
        exit 1
    fi
fi

# 12. Generate backup report
BACKUP_SIZE=$(stat -c%s "seo_tool_backup_${TIMESTAMP}.tar.gz" 2>/dev/null || echo 0)
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

log "Backup completed successfully!"
log "Backup file: seo_tool_backup_${TIMESTAMP}.tar.gz"
log "Backup size: ${BACKUP_SIZE_MB} MB"
log "Retention: ${RETENTION_DAYS} days"

# Send notification (if configured)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ SEO Tool backup completed successfully\\nFile: seo_tool_backup_${TIMESTAMP}.tar.gz\\nSize: ${BACKUP_SIZE_MB} MB\"}" \
        "${SLACK_WEBHOOK_URL}"
fi

log "Backup process completed."
