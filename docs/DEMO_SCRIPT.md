# Demo Script

## Goal
Show a clean, reliable project narrative without overselling unfinished cloud work.

## Suggested demo order
1. Show the repo structure and explain the local-first strategy.
2. Open the storefront and explain the customer path.
3. Use the customer demo login.
4. Search and filter products.
5. Add items to cart and open the checkout page.
6. Complete checkout.
7. Show:
   - order visible in admin
   - invoice PDF in `runtime/invoices/`
   - mock email file in `runtime/outbox/`
8. Open the admin dashboard.
9. Use the admin demo login and add a product.
10. Show docs:
   - architecture
   - deployment plan
   - cost notes
   - security and monitoring plans
11. Explain that AWS provisioning is staged and cost-gated.

## Demo talking points
- The app scope is intentionally small so the infrastructure story stays credible.
- Customer and admin access are already separated in the UI and service boundaries.
- Local invoice flow mirrors the future AWS event-driven design.
- Terraform, Kubernetes, and CI/CD are prepared before provisioning anything.