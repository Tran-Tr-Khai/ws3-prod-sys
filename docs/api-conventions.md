# HTTP API contract and naming

## Scope

This contract covers the completed WS3 domains only: MES snapshot/data
warehouse, Unrolling, Buffing, Tentering and the Tenter realtime relay.
Scouring is intentionally not mounted while its workflow is being refactored.
Transfer and Print remain unchanged until their business rules are confirmed.

## One API prefix

The website exposes one HTTP API prefix: `/api`. Frontend, Swagger and external
integrations must use this prefix. There is no parallel legacy or v1 API to
maintain, which keeps route ownership and debugging straightforward.

| Domain | Canonical prefix | Notes |
|---|---|---|
| Authentication | `/api/auth` | Browser session cookie is HTTP-only. |
| MES snapshot and data warehouse | `/api/ws3` | Read/import APIs backing the WS3 overview and warehouse. |
| Unrolling | `/api/ws3/unrolling` | Roll actions are production events. |
| Buffing | `/api/buffing/checks` | Images are child resources of a check. |
| Tentering | `/api/tentering/orders` | A machine is selected with `machine_id`; SOP is the order identifier. |
| Machine order progress | `/api/machine-orders/progress` | Shared progress state used by completed machine screens. |
| Support | `/api/support` | Operational notices and tickets. |
| Tenter realtime | `/ws/tenter-data?machine_id=TE-01` | WebSocket, authenticated by the same session cookie. |

## Naming rules

- Paths use lowercase kebab-case and plural nouns for collections.
- `GET` reads; `POST` creates an event/resource; `PUT` replaces a known
  resource; `PATCH` changes a field; `DELETE` removes a resource.
- Query parameter names and JSON fields use `snake_case`, matching the Python
  schemas and database-facing contracts.
- Times are ISO-8601 with an offset/UTC; dates are ISO `YYYY-MM-DD`.
- Collection endpoints always have a bounded `limit` where a full history is
  not required. Buffing defaults to 100 rows and permits at most 500.
- Authentication and authorization are enforced by the backend. Hiding a
  button in the UI is never an access-control mechanism.

## Future breaking changes

For a breaking change that cannot be released atomically, add `/api/v2` in a
dedicated migration. Document the affected consumers, migrate them, verify the
deployed build, then remove `/api` in a separate change. Do not add versions
when the request and response contract remains compatible.
