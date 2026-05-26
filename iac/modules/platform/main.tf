locals {
  cloud_run_runtime_sa_email = (
    var.cloud_run_service_account_email != null && var.cloud_run_service_account_email != ""
  ) ? var.cloud_run_service_account_email : "${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  wif_apis = var.enable_github_actions_wif ? toset([
    "sts.googleapis.com",
    "iamcredentials.googleapis.com",
  ]) : toset([])

  enabled_google_apis = setunion(
    var.enable_apis ? toset(var.apis) : toset([]),
    local.wif_apis,
  )
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "enabled" {
  for_each = local.enabled_google_apis

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
