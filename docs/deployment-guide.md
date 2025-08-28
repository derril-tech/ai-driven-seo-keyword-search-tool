# SEO Tool Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the AI-Driven SEO Keyword Research Tool to production environments using Kubernetes and Helm.

## Prerequisites

### Infrastructure Requirements

- **Kubernetes Cluster**: v1.24+ with at least 3 worker nodes
- **Node Resources**: Minimum 16 CPU cores, 64GB RAM per node
- **Storage**: 2TB+ SSD storage with dynamic provisioning
- **Network**: Load balancer support, ingress controller
- **SSL/TLS**: Certificate management (cert-manager recommended)

### Software Requirements

- `kubectl` v1.24+
- `helm` v3.8+
- `docker` v20.10+
- `aws-cli` v2.0+ (if using AWS)

### External Services

- **Domain Names**: Primary domain and API subdomain
- **DNS Management**: Route 53, CloudFlare, or similar
- **SSL Certificates**: Let's Encrypt or commercial certificates
- **Email Service**: SMTP server for notifications
- **Monitoring**: Prometheus/Grafana or external monitoring service

## Pre-Deployment Setup

### 1. Cluster Preparation

```bash
# Create namespace
kubectl create namespace seo-tool

# Label namespace for monitoring
kubectl label namespace seo-tool monitoring=enabled

# Install cert-manager (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Install ingress-nginx (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

### 2. Storage Classes

```bash
# Create fast SSD storage class (example for AWS)
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
allowVolumeExpansion: true
EOF
```

### 3. Secrets Management

```bash
# Create secrets for sensitive data
kubectl create secret generic seo-tool-secrets \
  --from-literal=DB_PASSWORD="your-secure-db-password" \
  --from-literal=REDIS_PASSWORD="your-secure-redis-password" \
  --from-literal=JWT_SECRET="your-jwt-secret-key" \
  --from-literal=SERP_API_KEY="your-serp-api-key" \
  --from-literal=OPENAI_API_KEY="your-openai-api-key" \
  --namespace=seo-tool

# Create TLS secret for ingress (if using custom certificates)
kubectl create secret tls seo-tool-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  --namespace=seo-tool
```

## Deployment Steps

### 1. Deploy Infrastructure Components

```bash
# Deploy PostgreSQL
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql \
  --namespace seo-tool \
  --set auth.postgresPassword="your-secure-password" \
  --set auth.database="seo_tool" \
  --set primary.persistence.size="100Gi" \
  --set primary.persistence.storageClass="fast-ssd"

# Deploy Redis
helm install redis bitnami/redis \
  --namespace seo-tool \
  --set auth.password="your-secure-password" \
  --set master.persistence.size="10Gi" \
  --set master.persistence.storageClass="fast-ssd"

# Deploy OpenSearch
helm repo add opensearch https://opensearch-project.github.io/helm-charts/
helm install opensearch opensearch/opensearch \
  --namespace seo-tool \
  --set replicas=3 \
  --set persistence.size="200Gi" \
  --set persistence.storageClass="fast-ssd"

# Deploy NATS
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm install nats nats/nats \
  --namespace seo-tool \
  --set nats.jetstream.enabled=true
```

### 2. Deploy Application

```bash
# Add SEO Tool Helm repository (replace with actual repository)
helm repo add seo-tool https://charts.seo-tool.com
helm repo update

# Deploy SEO Tool
helm install seo-tool seo-tool/seo-tool \
  --namespace seo-tool \
  --values production-values.yaml \
  --wait \
  --timeout=10m
```

### 3. Configure Monitoring

```bash
# Deploy Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace seo-tool \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName="fast-ssd" \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage="50Gi"

# Deploy Grafana dashboards
kubectl apply -f monitoring/grafana/dashboards/
```

## Post-Deployment Configuration

### 1. Database Initialization

```bash
# Run database migrations
kubectl exec -n seo-tool deployment/gateway -- npm run migration:run

# Create initial admin user
kubectl exec -n seo-tool deployment/gateway -- npm run seed:admin
```

### 2. SSL/TLS Configuration

```bash
# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 3. DNS Configuration

```bash
# Get ingress IP address
kubectl get ingress -n seo-tool seo-tool-ingress

# Configure DNS records:
# A record: seo-tool.com -> INGRESS_IP
# A record: api.seo-tool.com -> INGRESS_IP
```

## Verification

### 1. Health Checks

```bash
# Check all pods are running
kubectl get pods -n seo-tool

# Check services
kubectl get services -n seo-tool

# Check ingress
kubectl get ingress -n seo-tool

# Test health endpoints
curl -k https://api.seo-tool.com/health
curl -k https://seo-tool.com/health
```

### 2. Functionality Tests

```bash
# Run integration tests
kubectl run test-pod --image=seo-tool/test-runner:latest \
  --rm -i --tty --restart=Never \
  --namespace=seo-tool \
  -- npm run test:integration

# Run performance tests
k6 run tests/performance/load-test.js \
  --env BASE_URL=https://api.seo-tool.com \
  --env AUTH_TOKEN=your-test-token
```

## Scaling Configuration

### 1. Horizontal Pod Autoscaler

```bash
# Enable HPA for frontend
kubectl autoscale deployment frontend \
  --namespace=seo-tool \
  --cpu-percent=70 \
  --min=3 \
  --max=10

# Enable HPA for gateway
kubectl autoscale deployment gateway \
  --namespace=seo-tool \
  --cpu-percent=70 \
  --min=3 \
  --max=10
```

### 2. Vertical Pod Autoscaler

```bash
# Install VPA (if not already installed)
kubectl apply -f https://github.com/kubernetes/autoscaler/releases/download/vertical-pod-autoscaler-0.13.0/vpa-release-0.13.0.yaml

# Configure VPA for workers
kubectl apply -f k8s/vpa/
```

## Backup Configuration

### 1. Automated Backups

```bash
# Create backup CronJob
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: seo-tool-backup
  namespace: seo-tool
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: seo-tool/backup:latest
            env:
            - name: S3_BUCKET
              value: "seo-tool-backups"
            - name: RETENTION_DAYS
              value: "30"
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
EOF
```

## Monitoring and Alerting

### 1. Alert Configuration

```bash
# Apply alert rules
kubectl apply -f monitoring/prometheus/alert_rules.yml

# Configure AlertManager
kubectl apply -f monitoring/alertmanager/config.yml
```

### 2. Dashboard Setup

```bash
# Import Grafana dashboards
kubectl apply -f monitoring/grafana/dashboards/
```

## Security Hardening

### 1. Network Policies

```bash
# Apply network policies
kubectl apply -f security/security-policies.yaml
```

### 2. Pod Security Standards

```bash
# Enable Pod Security Standards
kubectl label namespace seo-tool \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

## Troubleshooting

### Common Issues

1. **Pods not starting**: Check resource limits and node capacity
2. **Database connection issues**: Verify secrets and network policies
3. **SSL certificate issues**: Check cert-manager logs and DNS configuration
4. **High memory usage**: Review resource limits and enable VPA

### Debugging Commands

```bash
# Check pod logs
kubectl logs -n seo-tool deployment/gateway --tail=100

# Describe pod for events
kubectl describe pod -n seo-tool <pod-name>

# Check resource usage
kubectl top pods -n seo-tool

# Port forward for debugging
kubectl port-forward -n seo-tool service/gateway-service 3000:80
```

## Maintenance

### 1. Updates

```bash
# Update application
helm upgrade seo-tool seo-tool/seo-tool \
  --namespace seo-tool \
  --values production-values.yaml

# Update infrastructure components
helm upgrade postgres bitnami/postgresql --namespace seo-tool
```

### 2. Backup Verification

```bash
# Test backup restoration
kubectl exec -n seo-tool deployment/postgres -- \
  pg_restore -h localhost -U postgres -d seo_tool_test /backups/latest.dump
```

## Performance Optimization

### 1. Resource Tuning

- Monitor resource usage and adjust limits
- Use VPA recommendations for optimal sizing
- Configure appropriate storage classes

### 2. Database Optimization

- Regular VACUUM and ANALYZE operations
- Index optimization based on query patterns
- Connection pooling configuration

### 3. Caching Strategy

- Redis configuration optimization
- CDN setup for static assets
- Application-level caching tuning

## Support and Maintenance

### Contact Information

- **Operations Team**: ops@yourdomain.com
- **Development Team**: dev@yourdomain.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX

### Documentation

- [API Documentation](https://api.seo-tool.com/docs)
- [User Guide](https://docs.seo-tool.com)
- [Troubleshooting Guide](https://docs.seo-tool.com/troubleshooting)
