resource "aws_ecr_repository" "this" {
  for_each             = var.enabled ? toset(var.repositories) : []
  name                 = "${var.name_prefix}/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}