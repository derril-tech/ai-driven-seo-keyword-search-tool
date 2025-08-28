# Deployment Runbook

## Overview
This runbook provides step-by-step procedures for deploying the AI SEO Keyword Research Tool to different environments.

## Environments

### Development
- **Purpose**: Feature development and testing
- **URL**: `https://dev.ai-seo-tool.com`
- **Database**: `ai_seo_tool_dev`
- **Auto-deploy**: On every commit to `develop` branch

### Staging
- **Purpose**: Pre-production testing and validation
- **URL**: `https://staging.ai-seo-tool.com`
- **Database**: `ai_seo_tool_staging`
- **Auto-deploy**: On every commit to `main` branch

### Production
- **Purpose**: Live customer-facing environment
- **URL**: `https://ai-seo-tool.com`
- **Database**: `ai_seo_tool_prod`
- **Manual deployment**: Requires approval and manual trigger

## Pre-Deployment Checklist

### 1. Code Review
- [ ] All changes reviewed and approved
- [ ] Tests passing in CI/CD pipeline
- [ ] Security scan completed
- [ ] Performance tests passed
- [ ] Documentation updated

### 2. Database Changes
- [ ] Database migrations tested in staging
- [ ] Backup strategy in place
- [ ] Rollback plan prepared
- [ ] Data migration scripts ready

### 3. Configuration
- [ ] Environment variables updated
- [ ] Feature flags configured
- [ ] API keys rotated if needed
- [ ] Monitoring alerts configured

### 4. Dependencies
- [ ] External service dependencies checked
- [ ] Third-party API quotas verified
- [ ] CDN cache cleared if needed
- [ ] Worker queue drained if necessary

## Deployment Procedures

### Development Deployment

#### Automated Deployment
```bash
# Development deploys automatically on push to develop branch
git push origin develop
```

#### Manual Deployment (if needed)
```bash
# Build and deploy to development
npm run deploy:dev
```

#### Verification Steps
1. Check deployment status in CI/CD dashboard
2. Verify application is accessible at dev URL
3. Run smoke tests
4. Check monitoring dashboards
5. Verify database connectivity

### Staging Deployment

#### Automated Deployment
```bash
# Staging deploys automatically on push to main branch
git push origin main
```

#### Manual Deployment (if needed)
```bash
# Build and deploy to staging
npm run deploy:staging
```

#### Verification Steps
1. Check deployment status in CI/CD dashboard
2. Verify application is accessible at staging URL
3. Run full test suite
4. Perform integration testing
5. Check all service endpoints
6. Verify database migrations
7. Test external API integrations
8. Check monitoring and alerting

### Production Deployment

#### Pre-Production Steps
1. **Schedule Deployment**
   - Choose low-traffic window
   - Notify stakeholders
   - Prepare rollback plan
   - Set up monitoring

2. **Final Verification**
   - Run staging tests one more time
   - Verify all configurations
   - Check external service status
   - Review deployment checklist

#### Deployment Process

##### Step 1: Database Migration
```bash
# Run database migrations
npm run migrate:prod

# Verify migration success
npm run migrate:status
```

##### Step 2: Deploy Infrastructure
```bash
# Deploy infrastructure changes
npm run deploy:infra:prod

# Verify infrastructure health
npm run health:check:infra
```

##### Step 3: Deploy Services
```bash
# Deploy backend services
npm run deploy:backend:prod

# Deploy frontend
npm run deploy:frontend:prod

# Deploy workers
npm run deploy:workers:prod
```

##### Step 4: Verification
```bash
# Run health checks
npm run health:check:prod

# Run smoke tests
npm run test:smoke:prod

# Verify monitoring
npm run monitor:check:prod
```

#### Post-Deployment Verification

##### Immediate Checks (0-5 minutes)
1. **Service Health**
   - All services responding
   - Database connectivity
   - External API access
   - Worker queues processing

2. **Application Functionality**
   - User authentication working
   - Core features accessible
   - API endpoints responding
   - Frontend loading properly

3. **Monitoring**
   - Error rates normal
   - Response times acceptable
   - Resource utilization healthy
   - Alerts not firing

##### Extended Verification (5-30 minutes)
1. **Performance Testing**
   - Load test critical endpoints
   - Verify response times
   - Check resource usage
   - Monitor queue depths

2. **Feature Testing**
   - Test new features
   - Verify existing functionality
   - Check data integrity
   - Validate exports

3. **Integration Testing**
   - External API calls working
   - Webhook deliveries successful
   - Third-party integrations healthy
   - Payment processing (if applicable)

## Rollback Procedures

### When to Rollback
- High error rates (>5%)
- Performance degradation (>2x normal response time)
- Critical features broken
- Security issues detected
- Data integrity concerns

### Rollback Process

#### Step 1: Assess Impact
```bash
# Check current system status
npm run status:check

# Review error logs
npm run logs:errors

# Check monitoring dashboards
npm run monitor:dashboard
```

#### Step 2: Execute Rollback
```bash
# Rollback to previous version
npm run rollback:prod

# Verify rollback success
npm run health:check:prod
```

#### Step 3: Verify Recovery
```bash
# Run smoke tests
npm run test:smoke:prod

# Check all services
npm run service:check:all

# Monitor for stability
npm run monitor:watch
```

### Database Rollback
```bash
# Rollback database migrations
npm run migrate:rollback:prod

# Verify data integrity
npm run data:verify:prod
```

## Monitoring During Deployment

### Key Metrics to Watch
- **Error Rate**: Should be <1%
- **Response Time**: Should be <2s for 95th percentile
- **Throughput**: Should be normal for time of day
- **Resource Usage**: CPU <80%, Memory <85%
- **Queue Depth**: Should be processing normally

### Alert Thresholds
- **P0**: Service completely down
- **P1**: Error rate >5% or response time >5s
- **P2**: Error rate >2% or response time >2s
- **P3**: Error rate >1% or response time >1s

### Monitoring Commands
```bash
# Check service health
npm run health:check

# Monitor error rates
npm run monitor:errors

# Check response times
npm run monitor:performance

# View resource usage
npm run monitor:resources

# Check queue status
npm run monitor:queues
```

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Check build logs
npm run build:logs

# Verify dependencies
npm run deps:check

# Clear build cache
npm run build:clean
```

#### Service Startup Issues
```bash
# Check service logs
npm run logs:service

# Verify configuration
npm run config:verify

# Check environment variables
npm run env:check
```

#### Database Connection Issues
```bash
# Test database connectivity
npm run db:test

# Check connection pool
npm run db:pool:status

# Verify migrations
npm run migrate:status
```

#### Worker Queue Issues
```bash
# Check queue status
npm run queue:status

# Monitor worker processes
npm run worker:monitor

# Restart workers if needed
npm run worker:restart
```

## Post-Deployment Tasks

### 1. Documentation
- Update deployment logs
- Document any issues encountered
- Update runbooks if needed
- Record lessons learned

### 2. Monitoring
- Set up additional alerts if needed
- Configure new dashboards
- Update monitoring thresholds
- Test alert delivery

### 3. Communication
- Notify stakeholders of successful deployment
- Update status page
- Send deployment summary
- Schedule post-deployment review

### 4. Cleanup
- Remove old deployment artifacts
- Clean up temporary files
- Archive old logs
- Update deployment records

## Emergency Procedures

### Hot Fix Deployment
```bash
# Emergency hot fix process
npm run deploy:hotfix:prod

# Verify hot fix
npm run verify:hotfix
```

### Blue-Green Deployment
```bash
# Switch to blue environment
npm run deploy:blue:prod

# Verify blue environment
npm run verify:blue

# Switch traffic
npm run traffic:switch:blue
```

### Canary Deployment
```bash
# Deploy to canary
npm run deploy:canary:prod

# Monitor canary
npm run monitor:canary

# Gradually increase traffic
npm run traffic:increase:canary
```

## Security Considerations

### Pre-Deployment Security
- [ ] Security scan completed
- [ ] Vulnerabilities addressed
- [ ] Secrets rotated if needed
- [ ] Access controls verified

### Post-Deployment Security
- [ ] Security monitoring enabled
- [ ] Access logs reviewed
- [ ] Authentication working
- [ ] Authorization verified

## Compliance and Auditing

### Deployment Records
- Maintain deployment logs
- Record configuration changes
- Document rollback decisions
- Track security updates

### Audit Trail
- Log all deployment activities
- Record who performed actions
- Track configuration changes
- Maintain change history
