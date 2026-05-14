locals {
  image_uri = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}/${var.image_name}:${var.image_tag}"

  cloud_run_sa_email = var.cloud_run_service_account_email
}

resource "google_project_service" "enabled" {
  for_each = var.enable_apis ? toset(var.apis) : toset([])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

resource "google_storage_bucket" "terraform_state" {
  count = var.create_terraform_state_bucket ? 1 : 0

  name     = var.terraform_state_bucket
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.enabled]
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repo_id
  description   = var.artifact_registry_description
  format        = "DOCKER"

  depends_on = [google_project_service.enabled]
}

resource "google_artifact_registry_repository_iam_member" "cloud_run_pull" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.docker.name

  role   = "roles/artifactregistry.reader"
  member = "serviceAccount:service-${data.google_project.current.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service" "api" {
  provider = google-beta

  name     = var.cloud_run_service_name
  project  = var.project_id
  location = var.region

  template {
    service_account = local.cloud_run_sa_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = local.image_uri

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      ports {
        container_port = var.container_port
      }

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [
    google_project_service.enabled,
    google_artifact_registry_repository.docker,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  provider = google-beta

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name

  role   = "roles/run.invoker"
  member = "allUsers"
}

