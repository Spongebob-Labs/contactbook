resource "google_storage_bucket" "profile_photos" {
  count = var.create_profile_photos_bucket ? 1 : 0

  name     = var.profile_photos_bucket_name
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  cors {
    origin          = var.profile_photos_cors_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "profile_photos_public_read" {
  count = var.create_profile_photos_bucket ? 1 : 0

  bucket = google_storage_bucket.profile_photos[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket_iam_member" "profile_photos_cloud_run_admin" {
  count = var.create_profile_photos_bucket ? 1 : 0

  bucket = google_storage_bucket.profile_photos[0].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.cloud_run_runtime_sa_email}"
}
