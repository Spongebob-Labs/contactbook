# The identity Cloud Tasks presents when it pushes to the VM. Unlike Cloud Run,
# there is no IAM binding that gates the endpoint — the VM is plain HTTPS behind
# Caddy — so the APPLICATION verifies this account's OIDC token itself.
# See messaging-reliability.md §3.2.
resource "google_service_account" "invoker" {
  account_id   = "${var.name_prefix}-invoker"
  display_name = "Cloud Tasks OIDC invoker"
}

# The app, running on the VM as its attached SA, creates its own tasks.
resource "google_project_iam_member" "vm_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${var.vm_service_account}"
}

# Ops Agent on the VM ships container logs + host metrics.
resource "google_project_iam_member" "vm_telemetry" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${var.vm_service_account}"
}

output "invoker_service_account" { value = google_service_account.invoker.email }
