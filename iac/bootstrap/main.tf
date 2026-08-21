# Enable every API the other stacks depend on. Without this, a fresh project
# fails apply with an opaque "API not enabled" error partway through.
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudtasks.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "storage.googleapis.com", # profile-photo bucket
    "cloudresourcemanager.googleapis.com",
  ])

  service = each.value

  # Never let a `terraform destroy` disable APIs — it would break resources
  # created outside this stack.
  disable_on_destroy = false
}

resource "google_storage_bucket" "tfstate" {
  name     = var.state_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # State history. Recovering a clobbered state is the whole point.
  versioning { enabled = true }

  lifecycle_rule {
    condition {
      num_newer_versions = 20
    }
    action { type = "Delete" }
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "state_bucket" {
  value = google_storage_bucket.tfstate.name
}
