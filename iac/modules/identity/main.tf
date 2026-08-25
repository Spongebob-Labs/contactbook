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

# cloudtasks.enqueuer (above) only grants "create tasks in a queue" — it
# does NOT grant permission to attach an OIDC identity to those tasks.
# Creating a task with oidcToken.serviceAccountEmail = invoker requires
# the CALLER (the VM's attached SA) to be allowed to act as that specific
# target SA. Missing this was found against the real deployed instance,
# not in review: every task creation failed with
# `PERMISSION_DENIED: ... lacks IAM permission
# "iam.serviceAccounts.actAs" for the resource "<invoker>"` until this
# binding was added (by hand first, then codified here).
resource "google_service_account_iam_member" "vm_can_act_as_invoker" {
  service_account_id = google_service_account.invoker.name
  role                = "roles/iam.serviceAccountUser"
  member              = "serviceAccount:${var.vm_service_account}"
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
