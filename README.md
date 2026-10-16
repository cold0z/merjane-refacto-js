### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`

### Notes de refactoring

**Structure** (`src/`)

- `controllers/` : HTTP uniquement (validation de l'id, appel du service, réponse)
- `services/impl/order.service.ts` : charge les produits de la commande et délègue chacun au bon handler
- `services/impl/handlers/` : un handler par type de produit (`NORMAL`, `SEASONAL`, `EXPIRABLE`), chacun avec ses règles métier
- `repositories/` : seul endroit qui parle à la base (Drizzle)
- `di/` : câblage des dépendances (awilix)

**Démarche** : j'ai d'abord écrit des tests de caractérisation sur le code d'origine (tous les cas métier), puis refactoré par petites étapes en relançant `pnpm test` à chaque fois.

**Comportement** : identique à l'existant, à une exception près : une commande inexistante renvoie maintenant un `404` au lieu d'une erreur 500 (test dédié).

**Non touchés** : `notification.service.ts` et `notifications.port.ts` (marqués `WARN`).

**Pistes d'amélioration** : un type `ProductType` plutôt qu'une `string` (supprimerait les `!` sur les dates), un décrément de stock atomique (deux commandes simultanées), renommer `ProductService` et les clés `ps` / `ns`.
