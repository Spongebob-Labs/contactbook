# Two queues, because Cloud Tasks has no priority within a queue and a
# user-blocking OTP must not sit behind a 500-recipient broadcast.
#
# No Cloud Scheduler here: scheduled work runs as in-process @Cron on the VM,
# guarded by a Postgres advisory lock. That is safe because deployment is a
# single host — it would NOT be safe on multi-instance compute.

resource "google_cloud_tasks_queue" "outbound" {
  name     = "${var.name_prefix}-messages-outbound"
  location = var.region

  rate_limits {
    max_dispatches_per_second = var.outbound_dispatches_per_second
    max_concurrent_dispatches = var.outbound_max_concurrent
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "10s"
    max_backoff        = "600s"
    max_doublings      = 4
    max_retry_duration = "3600s"
  }

  stackdriver_logging_config {
    sampling_ratio = 1.0
  }
}

resource "google_cloud_tasks_queue" "priority" {
  name     = "${var.name_prefix}-messages-priority"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 20
    max_concurrent_dispatches = 10
  }

  retry_config {
    max_attempts  = 3
    min_backoff   = "2s"
    max_backoff   = "30s"
    max_doublings = 2
  }

  stackdriver_logging_config {
    sampling_ratio = 1.0
  }
}

output "queue_outbound" { value = google_cloud_tasks_queue.outbound.name }
output "queue_priority" { value = google_cloud_tasks_queue.priority.name }
