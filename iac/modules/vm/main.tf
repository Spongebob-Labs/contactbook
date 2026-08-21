# The VM itself is NOT managed here. contactbook-server already exists and is
# serving; importing it risks Terraform proposing a replacement over a trivial
# attribute drift. It is referenced read-only so its IP and service account can
# feed the rest of the config.
#
# To bring it under management later: `tofu import module.vm.google_compute_instance.api ...`
# after converting this data block to a resource.
data "google_compute_instance" "api" {
  project = var.project_id
  zone    = var.zone
  name    = var.vm_name
}

# Only 80/443 from the internet. Caddy terminates TLS and proxies to the app on
# an internal Docker network; the app port is never published to the host.
# Cloud Tasks reaches the app over 443 like any other client.
#
# Targeted by network tag rather than applying network-wide. The VM currently has
# NO tags, so this rule does nothing until you run:
#
#   gcloud compute instances add-tags contactbook-server \
#     --zone=europe-west2-c --tags=contactbook-api
#
# That is a safe, non-destructive metadata change — no restart, no recreation.
# Until then 80/443 stay open via the pre-existing `contactbook-openwa-web` rule,
# which is network-wide and named for a service this VM has nothing to do with.
# Relying on that is the kind of thing that gets "cleaned up" and takes prod down.
resource "google_compute_firewall" "web" {
  count = var.manage_firewall ? 1 : 0

  name    = "${var.name_prefix}-allow-web"
  project = var.project_id
  network = var.network

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [var.network_tag]
}

output "vm_service_account" {
  value = try(data.google_compute_instance.api.service_account[0].email, null)
}
output "vm_external_ip" {
  value = try(data.google_compute_instance.api.network_interface[0].access_config[0].nat_ip, null)
}
