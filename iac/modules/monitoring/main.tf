resource "google_monitoring_notification_channel" "email" {
  display_name = "${var.name_prefix} alerts"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

# A CONFIG-class Twilio error means credentials, sender or template is broken —
# EVERY send is failing, not just one recipient's. Distinct from PERMANENT,
# which is normal background noise and deliberately not alerted on.
resource "google_logging_metric" "config_errors" {
  name   = "${var.name_prefix}/whatsapp_config_errors"
  filter = <<-EOT
    resource.type="gce_instance"
    labels."compute.googleapis.com/resource_name"="${var.vm_name}"
    jsonPayload.message="whatsapp.send_failed"
    jsonPayload.errorClass="CONFIG"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "config_errors" {
  count = var.enable_alerts ? 1 : 0

  display_name = "${var.name_prefix} — WhatsApp CONFIG error (all sends broken)"
  combiner     = "OR"
  severity     = "CRITICAL"

  conditions {
    display_name = "Any CONFIG-class send error"
    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.config_errors.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "60s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_DELTA"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
  documentation {
    content = "Credentials, WhatsApp sender or template registration is broken. Every outbound send is failing. Check TWILIO_* secrets and template approval status."
  }
}

resource "google_monitoring_uptime_check_config" "api" {
  display_name = "${var.name_prefix} API health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/v1/health/live"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.uptime_host
    }
  }
}

# Unlike Cloud Run, a VM gives you no built-in request metrics — an uptime check
# is the substitute. Deeper signals need the Ops Agent shipping container logs.
#
# outbox.oldest_pending_seconds is the single best health signal in the system,
# but it is a custom OTel gauge the app has to emit first. The alert policy for
# it is added once that metric descriptor exists — see observability.md §5.

output "notification_channel" { value = google_monitoring_notification_channel.email.id }
