locals {
  github_wif_principal_set = var.enable_github_actions_wif ? (
    "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${var.github_actions_wif_pool_id}/attribute.repository/${var.github_repository}"
  ) : ""
}

resource "google_service_account" "github_actions" {
  count = var.enable_github_actions_wif ? 1 : 0

  project      = var.project_id
  account_id   = var.github_actions_service_account_id
  display_name = "GitHub Actions (Contactbook CI/CD)"
  description  = "Federated identity for GitHub Actions (Artifact Registry push, Cloud Run deploy)"

  depends_on = [google_project_service.enabled]
}

resource "google_iam_workload_identity_pool" "github_actions" {
  count = var.enable_github_actions_wif ? 1 : 0

  project                   = var.project_id
  workload_identity_pool_id = var.github_actions_wif_pool_id
  display_name              = "Contactbook GitHub"
  description               = "OIDC federation for GitHub Actions"

  depends_on = [google_project_service.enabled]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.enable_github_actions_wif ? 1 : 0

  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions[0].workload_identity_pool_id
  workload_identity_pool_provider_id = var.github_actions_wif_provider_id
  display_name                       = "GitHub OIDC"
  description                        = "token.actions.githubusercontent.com"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = format("assertion.repository==\"%s\"", var.github_repository)

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  depends_on = [google_iam_workload_identity_pool.github_actions]
}

resource "google_service_account_iam_member" "github_actions_wif_user" {
  count = var.enable_github_actions_wif ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_wif_principal_set
}

resource "google_artifact_registry_repository_iam_member" "github_actions_gar_writer" {
  count = var.enable_github_actions_wif ? 1 : 0

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.docker.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_actions[0].email}"

  depends_on = [
    google_service_account.github_actions,
    google_artifact_registry_repository.docker,
  ]
}

resource "google_project_iam_member" "github_actions_run_developer" {
  count = var.enable_github_actions_wif ? 1 : 0

  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

resource "google_service_account_iam_member" "github_actions_runtime_sa_user" {
  count = (
    var.enable_github_actions_wif
    && var.cloud_run_service_account_email != null
    && var.cloud_run_service_account_email != ""
  ) ? 1 : 0

  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.cloud_run_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions[0].email}"
}
