"""Render monitoring configuration from environment; values are JSON encoded."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit


def url(env, name, default=None):
    value = env.get(name, default)
    parsed = urlsplit(value or "")
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError(name + " must be an HTTP(S) URL without credentials or fragment")
    return value


def configuration(env):
    targets = [("catalog", url(env, "PROBE_CATALOG_URL")),
               ("community", url(env, "PROBE_COMMUNITY_URL")),
               ("admin", url(env, "PROBE_ADMIN_URL"))]
    relabel = [{"source_labels": ["__address__"], "target_label": "__param_target"},
               {"source_labels": ["__param_target"], "target_label": "instance"},
               {"target_label": "__address__", "replacement": "blackbox:9115"}]
    jobs = [{"job_name": "public-probes", "metrics_path": "/probe", "params": {"module": ["http_2xx"]},
             "static_configs": [{"targets": [value], "labels": {"service": key}} for key,value in targets], "relabel_configs": relabel},
            {"job_name": "internal-health", "metrics_path": "/probe", "params": {"module": ["http_2xx"]},
             "static_configs": [{"targets": [url(env, name, default)], "labels": {"service": key}} for key,name,default in [
                 ("public-api","PUBLIC_HEALTH_URL","http://public-api:3000/health"),
                 ("admin-api","ADMIN_HEALTH_URL","http://admin-api:3000/health"),
                 ("worker","WORKER_HEALTH_URL","http://worker:3000/health")]], "relabel_configs": relabel}]
    for job, targets in [("prometheus",["prometheus:9090"]), ("alertmanager",["alertmanager:9093"]),
                         ("backup",["backup-metrics:9100"]), ("postgres",["postgres-exporter:9187"]),
                         ("redis",["redis-exporter:9121"]),
                         ("application",["public-api:3000","admin-api:3000","worker:3000"])]:
        jobs.append({"job_name":job,"static_configs":[{"targets":targets}]})
    if env.get("MONITOR_HOST", "false") == "true":
        jobs.append({"job_name":"host","static_configs":[{"targets":["host-metrics:9100"]}]})
    prometheus = {"global":{"scrape_interval":"20s","evaluation_interval":"20s","scrape_timeout":"10s"},
                  "scrape_configs":jobs,"rule_files":["/etc/prometheus/alerts.yml"],
                  "alerting":{"alertmanagers":[{"static_configs":[{"targets":["alertmanager:9093"]}]}]}}
    receiver = {"name":"operations"}
    channel = env.get("ALERT_CHANNEL","none")
    if channel == "webhook":
        receiver["webhook_configs"] = [{"url":url(env,"ALERT_WEBHOOK_URL"),"send_resolved":True}]
    elif channel == "email":
        for name in ("ALERT_EMAIL_TO","SMTP_FROM","SMTP_SMARTHOST"):
            if not env.get(name): raise ValueError(name + " is required")
        receiver["email_configs"] = [{"to":env["ALERT_EMAIL_TO"],"from":env["SMTP_FROM"],
            "smarthost":env["SMTP_SMARTHOST"],"auth_username":env.get("SMTP_USERNAME",""),
            "auth_password":env.get("SMTP_PASSWORD",""),"require_tls":True,"send_resolved":True}]
    elif channel != "none":
        raise ValueError("ALERT_CHANNEL must be none, webhook or email")
    alertmanager = {"route":{"receiver":"operations","group_by":["alertname","job","service"],
                    "group_wait":"30s","group_interval":"5m","repeat_interval":"4h"},"receivers":[receiver]}
    age = int(env.get("BACKUP_MAX_AGE_SECONDS","90000"))
    if age < 60: raise ValueError("BACKUP_MAX_AGE_SECONDS must be at least 60")
    rules = [
        ("ServiceUnavailable", 'probe_success == 0', "2m", "服务探测失败"),
        ("MonitoringTargetMissing", 'up == 0', "2m", "监控采集失败"),
        ("PostgresUnavailable", 'pg_up == 0', "1m", "数据库连接失败"),
        ("RedisUnavailable", 'redis_up == 0', "1m", "Redis 连接失败"),
        ("BackupOverdue", f'time() - tasteinsight_backup_last_success_timestamp_seconds > {age} or absent(tasteinsight_backup_last_success_timestamp_seconds)', "5m", "有效备份已过期或尚未建立"),
        ("BackupFailed", 'tasteinsight_backup_last_run_success == 0', "1m", "最近一次备份失败"),
        ("BackupRetentionFailed", 'tasteinsight_backup_retention_success == 0', "5m", "备份保留策略执行失败"),
        ("AlertDeliveryDisabled", f'vector({int(channel == "none")}) == 1', "0m", "告警通知尚未启用"),
        ("AlertDeliveryFailed", 'increase(alertmanager_notifications_failed_total[10m]) > 0', "1m", "告警通知发送失败"),
        ("ApiHighErrorRate", 'sum by(instance)(rate(tasteinsight_http_requests_total{status=~"5.."}[5m])) / clamp_min(sum by(instance)(rate(tasteinsight_http_requests_total[5m])), 0.001) > 0.05', "5m", "API 服务端错误率超过 5%"),
        ("ApiSlow", 'histogram_quantile(0.95, sum by(le,instance)(rate(tasteinsight_http_duration_seconds_bucket[5m]))) > 2', "10m", "API P95 延迟超过 2 秒"),
        ("QueueBacklog", 'tasteinsight_queue_jobs{state="waiting"} > 100', "10m", "后台队列持续积压"),
        ("QueueFailures", 'tasteinsight_queue_jobs{state="failed"} > 0', "5m", "后台队列存在失败任务"),
        ("DiskSpaceLow", 'node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"} < 0.15', "5m", "磁盘可用空间低于 15%"),
        ("MemoryPressure", '1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes > 0.9', "10m", "主机内存持续紧张"),
        ("CertificateExpiring", 'probe_ssl_earliest_cert_expiry - time() < 14 * 86400', "10m", "服务证书将在 14 天内到期"),
    ]
    alerts={"groups":[{"name":"tasteinsight","rules":[{"alert":name,"expr":expr,"for":duration,
             "labels":{"severity":"warning"},"annotations":{"summary":summary}} for name,expr,duration,summary in rules]}]}
    return {"prometheus.yml":prometheus,"alertmanager.yml":alertmanager,"alerts.yml":alerts,
            "blackbox.yml":{"modules":{"http_2xx":{"prober":"http","timeout":"5s","http":{"preferred_ip_protocol":"ip4","follow_redirects":True}}}}}


if __name__ == "__main__":
    config = configuration(os.environ)
    output = Path(os.environ.get("CONFIG_DIR","/generated"))
    output.mkdir(parents=True,exist_ok=True)
    output.chmod(0o700)
    for name, value in config.items():
        (output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))
        (output/name).chmod(0o644)
    print("Monitoring configuration generated; alert delivery " + ("DISABLED" if os.environ.get("ALERT_CHANNEL","none")=="none" else "configured (delivery test required)"))
