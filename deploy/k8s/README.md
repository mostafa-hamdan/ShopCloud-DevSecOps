# Kubernetes Deployment Layout

- `base/`: shared manifests for ShopCloud services
- `overlays/dev/`: first live environment target
- `overlays/prod/`: reserved for later

Public and private ingress will be separated when EKS deployment begins.