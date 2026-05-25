# State migration from iac/opentofu-new (Cloud Run + profile bucket only).
# After platform migration, copy remaining state here and remove platform addresses from state.
# If you have no local terraform.tfstate, use import instead (see iac/MIGRATE.md).

moved {
  from = google_cloud_run_v2_service.api
  to   = module.environment.google_cloud_run_v2_service.api
}

moved {
  from = google_cloud_run_v2_service_iam_member.public_invoker[0]
  to   = module.environment.google_cloud_run_v2_service_iam_member.public_invoker[0]
}

moved {
  from = google_storage_bucket.profile_photos[0]
  to   = module.environment.google_storage_bucket.profile_photos[0]
}

moved {
  from = google_storage_bucket_iam_member.profile_photos_public_read[0]
  to   = module.environment.google_storage_bucket_iam_member.profile_photos_public_read[0]
}

moved {
  from = google_storage_bucket_iam_member.profile_photos_cloud_run_admin[0]
  to   = module.environment.google_storage_bucket_iam_member.profile_photos_cloud_run_admin[0]
}
