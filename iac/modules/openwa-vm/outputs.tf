output "instance_name" {
  value = google_compute_instance.openwa.name
}

output "zone" {
  value = google_compute_instance.openwa.zone
}

output "external_ip" {
  value = google_compute_address.openwa.address
}

output "service_account_email" {
  value = google_service_account.openwa.email
}
