# API Reference

All feature calls are exposed under `/api/trpc` through the scaffold's tRPC adapter. The client should use the generated `trpc` binding rather than ad-hoc fetch wrappers.

| Procedure                    | Access    | Purpose                                                      |
| ---------------------------- | --------- | ------------------------------------------------------------ |
| `auth.me`                    | Public    | Returns the current authenticated user or null.              |
| `auth.logout`                | Public    | Clears the secure session cookie.                            |
| `workspace.summary`          | Protected | Returns customer balance, request counts, and provider mode. |
| `workspace.smsOptions`       | Protected | Lists mock countries, services, and prices.                  |
| `workspace.createSmsRequest` | Protected | Validates and creates a mock SMS activation.                 |
| `workspace.createMailInbox`  | Protected | Validates and creates a mock temporary inbox.                |
| `workspace.ledger`           | Protected | Returns auditable wallet activity.                           |
| `admin.overview`             | Admin     | Returns protected operational metrics and audit signals.     |

Phase 1 endpoints are mock-only. No production provider credentials, payment gateways, or real-money actions are wired.
